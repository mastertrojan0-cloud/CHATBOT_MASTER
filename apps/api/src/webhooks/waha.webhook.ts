import { Request, Response } from 'express';
import { prisma } from '@flowdesk/db';
import { wahaService } from '../services/waha.service';
import { BusinessSegment, ContactSource, ConversationStatus, LeadStatus, PlanType } from '@prisma/client';
import { logger } from '../lib/logger';
import { getPresetFlow, runFlowEngine, type FlowContext, type FlowLead } from '@flowdesk/engine';

interface WahaMessagePayload {
  id: string;
  from: string;
  fromMe?: boolean;
  body?: string;
  text?: {
    body?: string;
  };
  caption?: string;
  timestamp: number;
  _data?: {
    notifyName?: string;
  };
}

interface WahaWebhookBody {
  event: string;
  session: string;
  payload: WahaMessagePayload;
}

function extractPhoneNumber(waId: string): string {
  return waId.replace(/@c\.us$/, '').replace(/\D/g, '');
}

function getConversationKey(sessionName: string, from: string): string {
  return `${sessionName}:${extractPhoneNumber(from)}`;
}

function getMessageText(payload: WahaMessagePayload): string {
  return (payload.body || payload.text?.body || payload.caption || '').trim();
}

function getMessageDate(payload: WahaMessagePayload): Date {
  const raw = (payload as any)?.timestamp;
  const numeric = typeof raw === 'string' ? Number(raw) : raw;

  if (typeof numeric === 'number' && Number.isFinite(numeric)) {
    // WAHA can send seconds or milliseconds depending on event shape.
    const ms = numeric > 1e12 ? numeric : numeric * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date();
}

function isInboundTextMessage(payload: WahaMessagePayload): boolean {
  return Boolean(payload.from && !payload.fromMe && getMessageText(payload));
}

function toPlan(plan: PlanType): 'FREE' | 'PRO' {
  return plan === 'PRO' ? 'PRO' : 'FREE';
}

function normalizeFlowContext(context: Record<string, unknown> | null, plan: PlanType): Partial<FlowContext> {
  const value = context && typeof context === 'object' ? context : {};
  const nextContext = value as Partial<FlowContext>;

  return {
    plan: toPlan(plan),
    currentStepId: typeof nextContext.currentStepId === 'string' ? nextContext.currentStepId : undefined,
    messageCount: typeof nextContext.messageCount === 'number' ? nextContext.messageCount : 0,
    completed: Boolean(nextContext.completed),
    collectedLead: nextContext.collectedLead && typeof nextContext.collectedLead === 'object'
      ? nextContext.collectedLead as FlowLead
      : {},
  };
}

function shouldRestartFlow(messageText: string): boolean {
  return ['iniciar', 'reiniciar', 'recomecar', 'comecar', 'menu'].includes(
    messageText.trim().toLowerCase()
  );
}

function getFlowForTenant(segment: BusinessSegment, plan: PlanType) {
  return getPresetFlow(segment, toPlan(plan));
}

export async function wahaWebhookHandler(req: Request, res: Response): Promise<void> {
  const { sessionName } = req.params;
  const body = req.body as WahaWebhookBody;

  res.status(200).json({ received: true });

  console.log(`[webhook] received event="${body.event}" session="${sessionName}"`);

  try {
    if (!['message', 'message.any'].includes(body.event)) {
      console.log(`[webhook] skipping event="${body.event}"`);
      return;
    }

    const payload = body.payload;
    const messageText = getMessageText(payload);

    console.log(`[webhook] from="${payload.from}" fromMe=${payload.fromMe} text="${messageText}"`);

    if (!isInboundTextMessage(payload)) {
      console.log(`[webhook] skipping: not inbound text (fromMe=${payload.fromMe} text="${messageText}")`);
      return;
    }

    if (payload.from.endsWith('@g.us') || payload.from.endsWith('@broadcast')) {
      console.log(`[webhook] skipping: group/broadcast message from="${payload.from}"`);
      return;
    }

    const tenant = await prisma.tenant.findFirst({
      where: { wahaSessionName: sessionName },
    }) ?? await prisma.tenant.findFirst({
      // Fallback: WAHA Core always uses "default" session.
      // If DB has an old tenant-scoped name stored, still find the active tenant.
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!tenant) {
      console.error(`[webhook] NO TENANT FOUND for session="${sessionName}" — run Connect to register webhook`);
      return;
    }
    if (!tenant.isActive) {
      console.warn(`[webhook] tenant="${tenant.id}" isActive=false — skipping`);
      return;
    }

    console.log(`[webhook] tenant="${tenant.id}" plan="${tenant.plan}" segment="${tenant.businessSegment}"`);

    const usage = (tenant.currentMonthUsage as Record<string, number>) || {};
    const messageCount = usage.messageCount || 0;

    if (tenant.plan === 'FREE' && messageCount >= 200) {
      console.warn(`[webhook] tenant="${tenant.id}" FREE limit reached (${messageCount})`);
      const ownerUser = await prisma.tenantUser.findFirst({
        where: { tenantId: tenant.id, role: 'OWNER' },
        select: { fullName: true },
      });
      await wahaService.sendMessage(
        'default',
        extractPhoneNumber(payload.from),
        `Ola! ${ownerUser?.fullName || 'voce'} atingiu o limite de mensagens do plano Free. Faça upgrade para o Pro para continuar.`
      );
      return;
    }

    const phone = extractPhoneNumber(payload.from);
    const phoneE164 = `+55${phone}`;
    const messageDate = getMessageDate(payload);

    const contact = await prisma.contact.upsert({
      where: {
        tenantId_whatsappPhoneE164: {
          tenantId: tenant.id,
          whatsappPhoneE164: phoneE164,
        },
      },
      create: {
        tenantId: tenant.id,
        whatsappPhone: phone,
        whatsappPhoneE164: phoneE164,
        name: payload._data?.notifyName || null,
        source: ContactSource.WHATSAPP,
        lastInboundAt: messageDate,
      },
      update: {
        name: payload._data?.notifyName || undefined,
        lastInboundAt: messageDate,
      },
    });

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        tenantId: tenant.id,
        contactId: contact.id,
        status: ConversationStatus.OPEN,
      },
      orderBy: { startedAt: 'desc' },
    });

    const flowContext = normalizeFlowContext(
      existingConversation?.context as Record<string, unknown> | null,
      tenant.plan
    );
    const flow = getFlowForTenant(tenant.businessSegment, tenant.plan);
    const restartFlow = shouldRestartFlow(messageText);
    const engineResult = runFlowEngine(
      restartFlow ? { plan: toPlan(tenant.plan) } : flowContext,
      restartFlow ? '' : messageText,
      flow
    );
    const responseText = engineResult.responses.map((item) => item.text).join('\n\n').trim();

    console.log(`[webhook] engine responses=${engineResult.responses.length} responseText="${responseText.slice(0, 80)}"`);

    const conversationKey = getConversationKey(sessionName, payload.from);

    const conversation = existingConversation
      ? await prisma.conversation.update({
          where: { id: existingConversation.id },
          data: {
            channelSessionId: conversationKey,
            lastMessageAt: messageDate,
            context: engineResult.nextContext as any,
          },
        })
      : await prisma.conversation.create({
          data: {
            tenantId: tenant.id,
            contactId: contact.id,
            channelSessionId: conversationKey,
            status: ConversationStatus.OPEN,
            startedAt: messageDate,
            lastMessageAt: messageDate,
            context: engineResult.nextContext as any,
          },
        });

    await prisma.message.create({
      data: {
        tenantId: tenant.id,
        contactId: contact.id,
        conversationId: conversation.id,
        externalMessageId: payload.id,
        direction: 'INBOUND',
        body: messageText,
        sentAt: messageDate,
        providerPayload: body as any,
      },
    });

    if (engineResult.lead) {
      const capturedLead = engineResult.lead;
      const existingLead = await prisma.lead.findFirst({
        where: {
          tenantId: tenant.id,
          contactId: contact.id,
          conversationId: conversation.id,
        },
      });

      const leadData = {
        tenantId: tenant.id,
        contactId: contact.id,
        conversationId: conversation.id,
        name: capturedLead.name || contact.name || null,
        phone: capturedLead.phone || phone,
        email: capturedLead.email || contact.email || null,
        status: LeadStatus.NEW,
        score: tenant.plan === 'PRO' ? 80 : 50,
        capturedData: {
          ...capturedLead,
          source: 'WHATSAPP',
          createdAt: new Date().toISOString(),
        } as any,
        source: ContactSource.WHATSAPP,
      };

      if (existingLead) {
        await prisma.lead.update({ where: { id: existingLead.id }, data: leadData });
      } else {
        await prisma.lead.create({ data: leadData });
      }
    }

    if (responseText) {
      console.log(`[webhook] sending response to phone="${phone}"`);
      try {
        await wahaService.sendMessage('default', phone, responseText);
        console.log(`[webhook] response sent OK`);
      } catch (sendErr: any) {
        console.error(`[webhook] sendMessage FAILED:`, sendErr?.response?.data || sendErr.message);
      }

      await prisma.message.create({
        data: {
          tenantId: tenant.id,
          contactId: contact.id,
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          body: responseText,
          sentAt: new Date(),
        },
      });

      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastOutboundAt: new Date() },
      });
    } else {
      console.warn(`[webhook] engine produced no response for text="${messageText}"`);
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        currentMonthUsage: {
          ...usage,
          messageCount: messageCount + 1,
        } as any,
      },
    });
  } catch (error) {
    logger.error({ error, body }, 'WAHA webhook error');
    console.error('[webhook] UNHANDLED ERROR:', error);
  }
}


import { Request, Response } from 'express';
import { prisma } from '@flowdesk/db';
import { wahaService } from '../services/waha.service';
import { BusinessSegment, ContactSource, ConversationStatus, LeadStatus, PlanType, Prisma } from '@prisma/client';
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
  payload: WahaMessagePayload | Record<string, unknown>;
}

function isValidWebhookBody(body: unknown): body is WahaWebhookBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const value = body as Record<string, unknown>;
  return typeof value.event === 'string' && typeof value.payload === 'object' && value.payload !== null;
}

const SESSION_RECOVERY_COOLDOWN_MS = 60_000;
const sessionRecoveryAttempts = new Map<string, number>();

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSessionWorking(sessionName: string, maxAttempts = 6): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const session = await wahaService.getSession(sessionName);
      if (session.session?.status === 'WORKING') {
        return true;
      }
    } catch {
      // Ignore transient WAHA read errors during restart.
    }
    await sleep(2000);
  }
  return false;
}

async function hardRecycleSession(sessionName: string): Promise<boolean> {
  try {
    await wahaService.stopSession(sessionName);
  } catch {
    // Ignore stop errors; session can already be stopped/restarting.
  }

  await sleep(1500);

  try {
    await wahaService.startSession(sessionName);
  } catch {
    // Ignore start errors here and rely on state check below.
  }

  return waitForSessionWorking(sessionName, 8);
}

function getFlowForTenant(segment: BusinessSegment, plan: PlanType) {
  return getPresetFlow(segment, toPlan(plan));
}

async function resolveTenantForSession(sessionName: string) {
  const matchedActiveTenants = await prisma.tenant.findMany({
    where: {
      wahaSessionName: sessionName,
      isActive: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 2,
  });

  if (matchedActiveTenants.length > 1) {
    logger.error(
      { sessionName, tenantIds: matchedActiveTenants.map((tenant) => tenant.id) },
      'WAHA session matched multiple active tenants'
    );
    return null;
  }

  if (matchedActiveTenants.length === 1) {
    return matchedActiveTenants[0]!;
  }

  const activeTenants = await prisma.tenant.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    take: 2,
  });

  if (activeTenants.length === 1) {
    const tenant = activeTenants[0]!;
    logger.warn(
      { sessionName, tenantId: tenant.id, wahaSessionName: tenant.wahaSessionName },
      'WAHA session resolved using single-tenant fallback'
    );
    return tenant;
  }

  if (activeTenants.length > 1) {
    logger.error(
      { sessionName, tenantIds: activeTenants.map((tenant) => tenant.id) },
      'WAHA session could not be resolved uniquely across active tenants'
    );
  }

  return null;
}

function extractSessionStatus(payload: Record<string, unknown>): string | null {
  const directStatus = payload.status;
  if (typeof directStatus === 'string' && directStatus.trim()) {
    return directStatus.trim().toUpperCase();
  }

  const nestedSession = payload.session;
  if (nestedSession && typeof nestedSession === 'object') {
    const nestedStatus = (nestedSession as Record<string, unknown>).status;
    if (typeof nestedStatus === 'string' && nestedStatus.trim()) {
      return nestedStatus.trim().toUpperCase();
    }
  }

  const nestedData = payload.data;
  if (nestedData && typeof nestedData === 'object') {
    const nestedStatus = (nestedData as Record<string, unknown>).status;
    if (typeof nestedStatus === 'string' && nestedStatus.trim()) {
      return nestedStatus.trim().toUpperCase();
    }
  }

  return null;
}

function canAttemptRecovery(sessionName: string): boolean {
  const lastAttemptAt = sessionRecoveryAttempts.get(sessionName) || 0;
  return Date.now() - lastAttemptAt >= SESSION_RECOVERY_COOLDOWN_MS;
}

async function handleSessionStatusEvent(sessionName: string, payload: Record<string, unknown>): Promise<void> {
  const status = extractSessionStatus(payload);
  const tenant = await resolveTenantForSession(sessionName);

  logger.info(
    {
      sessionName,
      status,
      tenantId: tenant?.id || null,
      payload,
    },
    'WAHA session status event received'
  );

  if (tenant && tenant.wahaSessionName !== sessionName) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { wahaSessionName: sessionName },
    });
  }

  if (!status) {
    return;
  }

  if (status === 'WORKING') {
    sessionRecoveryAttempts.delete(sessionName);
    return;
  }

  if (!['FAILED', 'STOPPED'].includes(status)) {
    return;
  }

  if (!canAttemptRecovery(sessionName)) {
    logger.warn({ sessionName, status }, 'Skipping WAHA session recovery due to cooldown');
    return;
  }

  sessionRecoveryAttempts.set(sessionName, Date.now());
  logger.warn({ sessionName, status }, 'Attempting automatic WAHA session recovery');

  try {
    await wahaService.restartSession(sessionName);
    let recovered = await waitForSessionWorking(sessionName, 8);

    if (!recovered) {
      recovered = await hardRecycleSession(sessionName);
    }

    logger.info({ sessionName, status, recovered }, 'WAHA session recovery finished');
  } catch (error) {
    logger.error({ sessionName, status, error }, 'WAHA session recovery failed');
  }
}

export async function wahaWebhookHandler(req: Request, res: Response): Promise<void> {
  const { sessionName } = req.params;
  const body = req.body as unknown;

  res.status(200).json({ received: true });

  if (!isValidWebhookBody(body)) {
    logger.warn({ sessionName, body }, 'WAHA webhook payload ignored: invalid shape');
    return;
  }

  console.log(`[webhook] received event="${body.event}" session="${sessionName}"`);

  try {
    if (body.event === 'session.status') {
      await handleSessionStatusEvent(sessionName, (body.payload || {}) as Record<string, unknown>);
      return;
    }

    if (!['message', 'message.any'].includes(body.event)) {
      console.log(`[webhook] skipping event="${body.event}"`);
      return;
    }

    const payload = body.payload as WahaMessagePayload;
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

    const tenant = await resolveTenantForSession(sessionName);

    if (!tenant) {
      console.error(`[webhook] NO TENANT FOUND for session="${sessionName}" — run Connect to register webhook`);
      return;
    }
    if (!tenant.isActive) {
      console.warn(`[webhook] tenant="${tenant.id}" isActive=false — skipping`);
      return;
    }

    console.log(`[webhook] tenant="${tenant.id}" plan="${tenant.plan}" segment="${tenant.businessSegment}"`);

    if (payload.id) {
      const duplicateInbound = await prisma.message.findFirst({
        where: {
          tenantId: tenant.id,
          externalMessageId: payload.id,
          direction: 'INBOUND',
        },
        select: { id: true },
      });

      if (duplicateInbound) {
        console.log(`[webhook] duplicate inbound ignored externalMessageId="${payload.id}"`);
        return;
      }
    }

    const usage = (tenant.currentMonthUsage as Record<string, number>) || {};
    const messageCount = usage.messageCount || 0;

    if (tenant.plan === 'FREE' && messageCount >= 200) {
      console.warn(`[webhook] tenant="${tenant.id}" FREE limit reached (${messageCount})`);
      const ownerUser = await prisma.tenantUser.findFirst({
        where: { tenantId: tenant.id, role: 'OWNER' },
        select: { fullName: true },
      });
      await wahaService.sendMessage(
        sessionName,
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

    let conversation;
    if (existingConversation) {
      conversation = await prisma.conversation.update({
        where: { id: existingConversation.id },
        data: {
          channelSessionId: conversationKey,
          lastMessageAt: messageDate,
          context: engineResult.nextContext as any,
        },
      });
    } else {
      try {
        conversation = await prisma.conversation.create({
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
      } catch (err: any) {
        const isUniqueConversation =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          Array.isArray(err.meta?.target) &&
          err.meta.target.includes('tenantId') &&
          err.meta.target.includes('channelSessionId');

        if (!isUniqueConversation) {
          throw err;
        }

        // Race condition between message.any and message for the same inbound.
        const concurrentConversation = await prisma.conversation.findFirst({
          where: {
            tenantId: tenant.id,
            channelSessionId: conversationKey,
          },
        });

        if (!concurrentConversation) {
          throw err;
        }

        conversation = await prisma.conversation.update({
          where: { id: concurrentConversation.id },
          data: {
            lastMessageAt: messageDate,
            context: engineResult.nextContext as any,
          },
        });
      }
    }

    try {
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
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        console.log(`[webhook] inbound insert duplicate ignored externalMessageId="${payload.id}"`);
        return;
      }
      throw err;
    }

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
      let sent = false;
      let lastSendError: any = null;
      let restartedSessionForSend = false;

      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          await wahaService.sendMessage(sessionName, phone, responseText);
          sent = true;
          console.log(`[webhook] response sent OK (attempt=${attempt})`);
          break;
        } catch (sendErr: any) {
          lastSendError = sendErr;
          const details = sendErr?.response?.data || sendErr?.message || String(sendErr);
          const detailsText = typeof details === 'string' ? details : JSON.stringify(details);
          console.warn(`[webhook] send attempt ${attempt} failed:`, details);

          const isDetachedFrame = detailsText.includes('detached Frame');
          const isTimeout = detailsText.toLowerCase().includes('timeout') || sendErr?.code === 'ECONNABORTED';
          const isServerError = typeof sendErr?.response?.status === 'number' && sendErr.response.status >= 500;
          if (isDetachedFrame && !restartedSessionForSend) {
            restartedSessionForSend = true;
            console.warn('[webhook] detached frame detected; restarting WAHA session before retry');
            try {
              await wahaService.restartSession(sessionName);
              let isWorking = await waitForSessionWorking(sessionName);
              if (!isWorking) {
                console.warn('[webhook] session not WORKING after restart; trying hard recycle stop/start');
                isWorking = await hardRecycleSession(sessionName);
              }
              console.log(`[webhook] session recovery working=${isWorking}`);
            } catch (restartErr: any) {
              console.error('[webhook] failed to restart session after detached frame:', restartErr?.message || restartErr);
            }
          }

          if (attempt < 4 && (isDetachedFrame || isTimeout || isServerError)) {
            await sleep(1000 * attempt);
            continue;
          }

          break;
        }
      }

      if (!sent) {
        console.error(`[webhook] sendMessage FAILED:`, lastSendError?.response?.data || lastSendError?.message || lastSendError);
      } else {
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
      }
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



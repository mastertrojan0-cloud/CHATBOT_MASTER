import { Request, Response } from 'express';
import { prisma } from '@flowdesk/db';
import { ContactSource, ConversationStatus, LeadStatus, MessageChannel, Prisma, type PlanType, type Tenant } from '@prisma/client';
import { getPresetFlow, runFlowEngine, type FlowContext, type FlowLead } from '@flowdesk/engine';
import { logger } from '../lib/logger';
import { TelegramService } from '../services/telegram.service';

interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  from?: TelegramUser;
  chat: TelegramChat;
}

interface TelegramWebhookBody {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

function getTelegramMessage(body: TelegramWebhookBody): TelegramMessage | null {
  return body.message || body.edited_message || null;
}

function getMessageText(message: TelegramMessage | null): string {
  return (message?.text || message?.caption || '').trim();
}

function getMessageDate(message: TelegramMessage | null): Date {
  const seconds = message?.date;
  if (typeof seconds === 'number' && Number.isFinite(seconds)) {
    const date = new Date(seconds * 1000);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date();
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
  return ['iniciar', 'reiniciar', 'recomecar', 'comecar', 'menu', '/start', '/menu', '/reset'].includes(
    messageText.trim().toLowerCase()
  );
}

function getFlowForTenant(tenant: Tenant) {
  return getPresetFlow(tenant.businessSegment, toPlan(tenant.plan));
}

function getConversationKey(tenantSlug: string, chatId: number): string {
  return `telegram:${tenantSlug}:${chatId}`;
}

function buildContactName(message: TelegramMessage): string | null {
  const firstName = message.from?.first_name?.trim();
  const lastName = message.from?.last_name?.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  if (fullName) {
    return fullName;
  }

  return message.from?.username?.trim() || null;
}

function assertTelegramSecret(req: Request, expected: string | null | undefined): boolean {
  const normalizedExpected = expected?.trim();

  if (!normalizedExpected) {
    return true;
  }

  const received = String(req.headers['x-telegram-bot-api-secret-token'] || '').trim();
  return received.length > 0 && received === normalizedExpected;
}

export async function telegramWebhookHandler(req: Request, res: Response): Promise<void> {
  const { tenantSlug } = req.params;
  const body = req.body as TelegramWebhookBody;

  try {
    const tenant = await prisma.tenant.findFirst({
      where: {
        slug: tenantSlug,
        isActive: true,
      },
    });

    if (!tenant) {
      logger.warn({ tenantSlug }, 'Telegram webhook received for unknown tenant');
      res.status(200).json({ received: true });
      return;
    }

    if (!assertTelegramSecret(req, tenant.telegramWebhookSecret)) {
      res.status(401).json({ success: false, error: 'Invalid Telegram webhook secret' });
      return;
    }

    if (!tenant.telegramBotToken) {
      res.status(200).json({ received: true });
      return;
    }

    res.status(200).json({ received: true });

    const telegramService = TelegramService.fromToken(tenant.telegramBotToken);
    const message = getTelegramMessage(body);
    const messageText = getMessageText(message);

    if (!message || !messageText) {
      return;
    }

    if (message.chat.type !== 'private') {
      return;
    }

    const externalMessageId = `telegram:${message.chat.id}:${message.message_id}`;
    const duplicateInbound = await prisma.message.findFirst({
      where: {
        tenantId: tenant.id,
        externalMessageId,
        direction: 'INBOUND',
      },
      select: { id: true },
    });

    if (duplicateInbound) {
      return;
    }

    const usage = (tenant.currentMonthUsage as Record<string, number>) || {};
    const messageCount = usage.messageCount || 0;

    if (tenant.plan === 'FREE' && messageCount >= 200) {
      await telegramService.sendMessage(
        message.chat.id,
        'Ola! O limite de mensagens do plano Free foi atingido. Faca upgrade para continuar usando o bot.'
      );
      return;
    }

    const messageDate = getMessageDate(message);
    const chatKey = `tg:${message.chat.id}`;
    const contact = await prisma.contact.upsert({
      where: {
        tenantId_whatsappPhoneE164: {
          tenantId: tenant.id,
          whatsappPhoneE164: chatKey,
        },
      },
      create: {
        tenantId: tenant.id,
        whatsappPhone: chatKey,
        whatsappPhoneE164: chatKey,
        externalId: String(message.from?.id || message.chat.id),
        name: buildContactName(message),
        source: ContactSource.API,
        lastInboundAt: messageDate,
      },
      update: {
        externalId: String(message.from?.id || message.chat.id),
        name: buildContactName(message) || undefined,
        lastInboundAt: messageDate,
      },
    });

    const conversationKey = getConversationKey(tenant.slug, message.chat.id);
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
    const restartFlow = shouldRestartFlow(messageText);
    const engineResult = runFlowEngine(
      restartFlow ? { plan: toPlan(tenant.plan) } : flowContext,
      restartFlow ? '' : messageText,
      getFlowForTenant(tenant)
    );
    const responseText = engineResult.responses.map((item) => item.text).join('\n\n').trim();

    let conversation;
    if (existingConversation) {
      conversation = await prisma.conversation.update({
        where: { id: existingConversation.id },
        data: {
          channelSessionId: conversationKey,
          lastMessageAt: messageDate,
          context: engineResult.nextContext as any,
          metadata: {
            ...(existingConversation.metadata as Record<string, unknown> | null),
            provider: 'TELEGRAM',
            chatId: message.chat.id,
          } as any,
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
            metadata: {
              provider: 'TELEGRAM',
              chatId: message.chat.id,
              username: message.from?.username || null,
            } as any,
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
          externalMessageId,
          direction: 'INBOUND',
          channel: MessageChannel.SYSTEM,
          body: messageText,
          sentAt: messageDate,
          metadata: {
            provider: 'TELEGRAM',
            updateId: body.update_id,
          } as any,
          providerPayload: body as any,
        },
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
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
        phone: capturedLead.phone || null,
        email: capturedLead.email || contact.email || null,
        status: LeadStatus.NEW,
        score: tenant.plan === 'PRO' ? 80 : 50,
        capturedData: {
          ...capturedLead,
          source: 'TELEGRAM',
          telegramUserId: message.from?.id || null,
          telegramChatId: message.chat.id,
          createdAt: new Date().toISOString(),
        } as any,
        source: ContactSource.API,
      };

      if (existingLead) {
        await prisma.lead.update({ where: { id: existingLead.id }, data: leadData });
      } else {
        await prisma.lead.create({ data: leadData });
      }
    }

    if (responseText) {
      const telegramResponse = await telegramService.sendMessage(message.chat.id, responseText);

      await prisma.message.create({
        data: {
          tenantId: tenant.id,
          contactId: contact.id,
          conversationId: conversation.id,
          externalMessageId: telegramResponse.result?.message_id
            ? `telegram:${message.chat.id}:${telegramResponse.result.message_id}`
            : null,
          direction: 'OUTBOUND',
          channel: MessageChannel.SYSTEM,
          body: responseText,
          sentAt: new Date(),
          metadata: {
            provider: 'TELEGRAM',
            chatId: message.chat.id,
          } as any,
        },
      });

      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastOutboundAt: new Date() },
      });
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
    logger.error({ error, body, tenantSlug }, 'Telegram webhook error');
  }
}

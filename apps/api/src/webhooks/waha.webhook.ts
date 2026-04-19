import { Request, Response } from 'express';
import { prisma } from '@flowdesk/db';
import { wahaService } from '../services/waha.service';
import { ContactSource, LeadStatus, ConversationStatus } from '@prisma/client';

interface WahaMessagePayload {
  id: string;
  from: string;
  body: string;
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

function getConversationState(context: Record<string, any> | null): string {
  return context?.state || 'NEW';
}

function setConversationState(context: Record<string, any>, state: string): Record<string, any> {
  return { ...context, state };
}

export async function wahaWebhookHandler(req: Request, res: Response): Promise<void> {
  const { sessionName } = req.params;
  const body = req.body as WahaWebhookBody;

  res.status(200).json({ received: true });

  try {
    if (body.event !== 'message') {
      return;
    }

    const { from, body: messageText, timestamp, _data } = body.payload;

    if (from.endsWith('@g.us') || from.endsWith('@broadcast')) {
      return;
    }

    const tenant = await prisma.tenant.findFirst({
      where: { wahaSessionName: sessionName },
    });

    if (!tenant || !tenant.isActive) {
      return;
    }

    const monthlyLimit = tenant.monthlyLeadLimit || 50;
    const usage = (tenant.currentMonthUsage as Record<string, number>) || {};
    const messageCount = usage.messageCount || 0;

    if (tenant.plan === 'FREE' && messageCount >= 200) {
      const ownerUser = await prisma.tenantUser.findFirst({
        where: { tenantId: tenant.id, role: 'OWNER' },
        select: { fullName: true },
      });

      await wahaService.sendMessage(
        sessionName,
        extractPhoneNumber(from),
        `Olá! ${ownerUser?.fullName || 'você'} atingiu o limite de mensagens do plano Free. Upgrade para Pro para continuar usando sem limites!`
      );
      return;
    }

    const phoneE164 = `+55${extractPhoneNumber(from)}`;
    const contact = await prisma.contact.upsert({
      where: {
        tenantId_whatsappPhoneE164: {
          tenantId: tenant.id,
          whatsappPhoneE164: phoneE164,
        },
      },
      create: {
        tenantId: tenant.id,
        whatsappPhone: extractPhoneNumber(from),
        whatsappPhoneE164: phoneE164,
        name: _data?.notifyName || null,
        source: ContactSource.WHATSAPP,
      },
      update: {
        name: _data?.notifyName || undefined,
        lastInboundAt: new Date(),
      },
    });

    const conversation = await prisma.conversation.findFirst({
      where: {
        tenantId: tenant.id,
        contactId: contact.id,
        status: ConversationStatus.OPEN,
      },
      orderBy: { startedAt: 'desc' },
    });

    const currentState = conversation?.context as Record<string, any> || { state: 'NEW' };
    let responseText = '';
    let newState = currentState;

    switch (currentState.state) {
      case 'NEW': {
        const greetings = [
          'Olá! 👋',
          `Bem-vindo ao atendimento da ${tenant.name}!`,
          '',
          'Por favor, informe seu *nome* para começarmos.',
        ].join('\n');
        
        responseText = greetings;
        newState = setConversationState(currentState, 'AWAITING_NAME');
        break;
      }

      case 'AWAITING_NAME': {
        responseText = `Prazer, ${messageText}! 📱\n\nAgora informe seu *telefone* com DDD (para contato futuro).`;
        newState = {
          name: messageText,
          state: 'AWAITING_PHONE',
        };
        break;
      }

      case 'AWAITING_PHONE': {
        const phoneDigits = messageText.replace(/\D/g, '');
        
        if (phoneDigits.length < 8) {
          responseText = 'Telefone inválido. Por favor, forneça um telefone com pelo menos 8 dígitos.';
          break;
        }

        responseText = `Perfeito! 📋\n\nQual é seu *interesse* ou produto que você procura?`;
        newState = {
          ...newState,
          phone: phoneDigits,
          state: 'AWAITING_INTEREST',
        };
        break;
      }

      case 'AWAITING_INTEREST': {
        const interest = messageText;
        
        await prisma.lead.create({
          data: {
            tenantId: tenant.id,
            contactId: contact.id,
            conversationId: conversation?.id,
            name: newState.name as string,
            phone: newState.phone as string,
            status: LeadStatus.NEW,
            score: 50,
            capturedData: {
              interest,
              source: 'WHATSAPP',
              createdAt: new Date().toISOString(),
            } as any,
            source: ContactSource.WHATSAPP,
          },
        });

        responseText = [
          'Obrigado! ✅',
          '',
          `Recebemos seu interesse em: *${interest}*`,
          '',
          'Em breve nossa equipe entrará em contato.',
          '',
          'Atendimento via FlowDesk',
        ].join('\n');

        newState = setConversationState(currentState, 'COMPLETE');
        break;
      }

      case 'COMPLETE': {
        responseText = 'Obrigado pelo contato! Ja estamos processando sua solicitação. 👍';
        break;
      }

      default: {
        responseText = 'Digite *iniciar* para um novo atendimento.';
        newState = { state: 'NEW' };
      }
    }

    if (conversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          context: newState as any,
        },
      });
    } else {
      await prisma.conversation.create({
        data: {
          tenantId: tenant.id,
          contactId: contact.id,
          channelSessionId: sessionName,
          status: ConversationStatus.OPEN,
          context: newState as any,
        },
      });
    }

    if (responseText) {
      await wahaService.sendMessage(sessionName, extractPhoneNumber(from), responseText);
    }

    const newUsage = {
      ...usage,
      messageCount: messageCount + 1,
    };

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        currentMonthUsage: newUsage as any,
      },
    });

    await prisma.message.create({
      data: {
        tenantId: tenant.id,
        contactId: contact.id,
        conversationId: conversation?.id,
        direction: 'INBOUND',
        body: messageText,
        sentAt: new Date(timestamp * 1000),
      },
    });

    if (responseText) {
      await prisma.message.create({
        data: {
          tenantId: tenant.id,
          contactId: contact.id,
          conversationId: conversation?.id,
          direction: 'OUTBOUND',
          body: responseText,
          sentAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error('WAHA webhook error:', error);
  }
}
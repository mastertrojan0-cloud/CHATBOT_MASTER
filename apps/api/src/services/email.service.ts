import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'FlowDesk <noreply@flowdesk.com.br>';

class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(RESEND_API_KEY);
  }

  async send({ to, subject, html }: { to: string; subject: string; html: string }) {
    try {
      const result = await this.resend.emails.send({
        from: RESEND_FROM,
        to,
        subject,
        html,
      });

      if (result.error) {
        console.error('Resend error:', result.error);
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data };
    } catch (error: any) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendLeadConfirmation({
    leadName,
    leadEmail,
    interest,
    businessName,
  }: {
    leadName: string;
    leadEmail: string;
    interest: string;
    businessName: string;
  }) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9f9f9; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 30px;">
            <h2 style="color: #1a1a1a; margin-bottom: 20px;">Olá, ${leadName}!</h2>
            
            <p style="color: #4a4a4a; line-height: 1.6;">
              Recebemos seu interesse em <strong>${interest}</strong>. 
              Em breve ${businessName} entrará em contato com você.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
              <p style="color: #9a9a9a; font-size: 14px;">
                Mensagem enviada via <strong>FlowDesk</strong>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.send({
      to: leadEmail,
      subject: `Confirmação de interesse em ${interest}`,
      html,
    });
  }

  async sendWeeklyReport({
    tenantEmail,
    businessName,
    leadsThisWeek,
    leadsPrevWeek,
    topInterests,
  }: {
    tenantEmail: string;
    businessName: string;
    leadsThisWeek: number;
    leadsPrevWeek: number;
    topInterests: { interest: string; count: number }[];
  }) {
    const variation = leadsPrevWeek > 0
      ? Math.round(((leadsThisWeek - leadsPrevWeek) / leadsPrevWeek) * 100)
      : 0;
    const variationEmoji = variation > 0 ? '📈' : variation < 0 ? '📉' : '➖';
    const variationText = variation > 0 
      ? `+${variation}%` 
      : `${variation}%`;

    const interestsList = topInterests
      .slice(0, 3)
      .map((item, i) => `<li>${item.interest}: ${item.count} leads</li>`)
      .join('');

    const dashboardUrl = process.env.FRONTEND_URL || 'https://flowdesk.com.br';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9f9f9; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 30px;">
            <h2 style="color: #1a1a1a; margin-bottom: 20px;">📊 Relatório Semanal — ${businessName}</h2>
            
            <div style="background-color: #f5f5f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <p style="font-size: 32px; font-weight: bold; color: #1a1a1a; margin: 0;">
                ${leadsThisWeek} <span style="font-size: 18px; color: #6a6a6a;">leads</span>
              </p>
              <p style="color: #6a6a6a; margin: 5px 0 0 0;">
                ${variationEmoji} ${variationText} vs semana anterior
              </p>
            </div>
            
            ${topInterests.length > 0 ? `
              <h3 style="color: #1a1a1a; margin-top: 20px;">Top Interesses</h3>
              <ul style="color: #4a4a4a; line-height: 1.8;">
                ${interestsList}
              </ul>
            ` : ''}
            
            <a href="${dashboardUrl}" 
               style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 6px;">
              Ver Dashboard
            </a>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
              <p style="color: #9a9a9a; font-size: 14px;">
                Relatório semanal via <strong>FlowDesk</strong>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.send({
      to: tenantEmail,
      subject: `📊 Semanal: ${leadsThisWeek} novos leads`,
      html,
    });
  }

  async sendPaymentFailed({
    tenantEmail,
    businessName,
  }: {
    tenantEmail: string;
    businessName: string;
  }) {
    const billingUrl = process.env.FRONTEND_URL 
      ? `${process.env.FRONTEND_URL}/settings?tab=billing` 
      : 'https://flowdesk.com.br/settings';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9f9f9; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 30px;">
            <h2 style="color: #dc2626; margin-bottom: 20px;">⚠️ Problema no pagamento</h2>
            
            <p style="color: #4a4a4a; line-height: 1.6;">
              Não foi possível processar o pagamento da sua assinatura <strong>FlowDesk Pro</strong> 
              para <strong>${businessName}</strong>.
            </p>
            
            <p style="color: #4a4a4a; line-height: 1.6;">
              Por favor, atualize sua forma de pagamento para evitar a suspensão do serviço.
            </p>
            
            <a href="${billingUrl}" 
               style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 6px;">
              Atualizar Pagamento
            </a>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
              <p style="color: #9a9a9a; font-size: 14px;">
                Mensagem automática via <strong>FlowDesk</strong>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.send({
      to: tenantEmail,
      subject: '⚠️ Ação necessária: problema no pagamento',
      html,
    });
  }
}

export const emailService = new EmailService();
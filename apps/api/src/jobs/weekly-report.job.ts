import cron from 'node-cron';
import { prisma } from '@flowdesk/db';
import { emailService } from '../services/email.service';
import { wahaService } from '../services/waha.service';
import { PlanType } from '@prisma/client';

export class WeeklyReportJob {
  start(): void {
    cron.schedule(
      '0 8 * * 1',
      async () => {
        console.log('[WeeklyReport] Iniciando job...');
        const startTime = Date.now();

        try {
          const tenants = await prisma.tenant.findMany({
            where: { isActive: true, plan: PlanType.PRO },
            include: {
              users: {
                where: { role: 'OWNER' },
                select: { email: true, fullName: true },
                take: 1,
              },
            },
          });

          console.log(`[WeeklyReport] Iniciando para ${tenants.length} tenants PRO`);

          const chunks = this.chunkArray(tenants, 5);

          for (const chunk of chunks) {
            await Promise.allSettled(
              chunk.map((tenant) => this.processTenant(tenant))
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`[WeeklyReport] Concluído. ${tenants.length} relatórios enviados em ${elapsed}s`);
        } catch (error) {
          console.error('[WeeklyReport] Erro ao executar job:', error);
        }
      },
      {
        scheduled: true,
        timezone: 'America/Sao_Paulo',
      }
    );

    console.log('[Jobs] Weekly report job registrado para toda segunda-feira às 08:00');
  }

  private async processTenant(tenant: any): Promise<void> {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const leadsThisWeek = await prisma.lead.count({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: sevenDaysAgo },
        },
      });

      const leadsPrevWeek = await prisma.lead.count({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      });

      const leads = await prisma.lead.findMany({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: sevenDaysAgo },
        },
        select: { capturedData: true },
      });

      const interestCount: Record<string, number> = {};
      leads.forEach((lead) => {
        const data = lead.capturedData as Record<string, unknown> | null;
        if (data?.interest) {
          const interests = Array.isArray(data.interest)
            ? data.interest
            : [data.interest];
          interests.forEach((interest: string) => {
            interestCount[interest] = (interestCount[interest] || 0) + 1;
          });
        }
      });

      const topInterests = Object.entries(interestCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([interest, count]) => ({ interest, count }));

      const ownerUser = tenant.users[0];

      if (ownerUser?.email) {
        await emailService.sendWeeklyReport({
          tenantEmail: ownerUser.email,
          businessName: tenant.name,
          leadsThisWeek,
          leadsPrevWeek,
          topInterests,
        });
      }

      if (tenant.wahaSessionName && tenant.notifyPhone) {
        const variation = leadsPrevWeek > 0
          ? Math.round(((leadsThisWeek - leadsPrevWeek) / leadsPrevWeek) * 100)
          : leadsThisWeek > 0 ? 100 : 0;
        const emoji = variation >= 0 ? '📈' : '📉';
        
        await wahaService.sendMessage(
          tenant.wahaSessionName,
          tenant.notifyPhone,
          `📊 Relatório semanal FlowDesk\n\n*${tenant.name}*\nLeads esta semana: ${leadsThisWeek} ${emoji} ${variation > 0 ? '+' : ''}${variation}%\n\nAcesse: ${process.env.FRONTEND_URL}/dashboard`
        );
      }

      console.log(`[WeeklyReport] Tenant ${tenant.name}: ${leadsThisWeek} leads`);
    } catch (error) {
      console.error(`[WeeklyReport] Erro ao processar tenant ${tenant.name}:`, error);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export const weeklyReportJob = new WeeklyReportJob();
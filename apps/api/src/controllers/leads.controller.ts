import { Request, Response } from 'express';
import { AuthRequest, LeadFilters, Lead } from '../types';
import { prisma } from '@flowdesk/db';
import { PlanType, LeadStatus } from '@prisma/client';
import { sendSuccess, sendError } from '../lib/response';

/**
 * Controller para gerenciar leads
 * Centraliza a lógica de negócio das operações com leads
 */

export class LeadsController {
  /**
   * Buscar leads com filtros, paginação e busca
   */
  static async getLeads(
    tenantId: string,
    filters: LeadFilters,
    page: number,
    limit: number
  ): Promise<{ data: Lead[]; total: number }> {
    const where: any = {
      tenantId,
    };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.scoreMin !== undefined) {
      where.score = { ...where.score, gte: filters.scoreMin };
    }

    if (filters.scoreMax !== undefined) {
      where.score = { ...where.score, lte: filters.scoreMax };
    }

    // TODO: Implementar filtros de interesse e data quando o schema permitir

    try {
      const [data, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.lead.count({ where }),
      ]);

      return { data, total };
    } catch (error) {
      console.error('Error fetching leads:', error);
      // Fallback para dados mockados se o banco não estiver disponível
      return {
        data: [],
        total: 0,
      };
    }
  }

  /**
   * Obter estatísticas do dashboard
   */
  static async getStats(tenantId: string) {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        leadsTodayResult,
        leadsMonthResult,
        leadsTotalResult,
        contactsCountResult,
        tenantResult,
      ] = await Promise.all([
        prisma.lead.count({
          where: {
            tenantId,
            createdAt: { gte: startOfToday },
          },
        }),
        prisma.lead.count({
          where: {
            tenantId,
            createdAt: { gte: startOfMonth },
          },
        }),
        prisma.lead.count({
          where: { tenantId },
        }),
        prisma.contact.count({
          where: { tenantId },
        }),
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            plan: true,
            monthlyMessageLimit: true,
            monthlyLeadLimit: true,
            currentMonthUsage: true,
          },
        }),
      ]);

      const convertedLeads = await prisma.lead.count({
        where: {
          tenantId,
          status: LeadStatus.WON,
        },
      });

      const conversionRate = leadsTotalResult > 0 
        ? Math.round((convertedLeads / leadsTotalResult) * 100) 
        : 0;

      const plan = tenantResult?.plan || PlanType.FREE;
      const isFree = plan === PlanType.FREE;

      const usage = tenantResult?.currentMonthUsage as Record<string, number> | null;
      const msgCountMonth = usage?.messageCount || 0;

      const topInterests = await this.getTopInterests(tenantId);
      const leadsByDay = await this.getLeadsByDay(tenantId, 14);

      return {
        leadsToday: leadsTodayResult,
        leadsMonth: leadsMonthResult,
        leadsTotal: leadsTotalResult,
        conversionRate,
        msgCountMonth,
        msgLimit: isFree ? 200 : null,
        contactCount: contactsCountResult,
        contactLimit: isFree ? 50 : null,
        topInterests,
        leadsByDay,
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }

  static async getStatsHandler(req: AuthRequest, res: Response): Promise<void> {
    try {
      const stats = await LeadsController.getStats(req.tenantId!);
      sendSuccess(res, stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      sendError(res, 'Failed to fetch stats', 'FETCH_STATS_ERROR', 500);
    }
  }

  /**
   * Obter top interesses dos leads
   */
  static async getTopInterests(tenantId: string): Promise<{ interest: string; count: number }[]> {
    try {
      const leads = await prisma.lead.findMany({
        where: { tenantId },
        select: { capturedData: true },
      });

      const interestCount: Record<string, number> = {};
      leads.forEach((lead) => {
        const data = lead.capturedData as Record<string, any> | null;
        if (data?.interest) {
          const interests = Array.isArray(data.interest) ? data.interest : [data.interest];
          interests.forEach((interest: string) => {
            interestCount[interest] = (interestCount[interest] || 0) + 1;
          });
        }
      });

      return Object.entries(interestCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([interest, count]) => ({ interest, count }));
    } catch (error) {
      console.error('Error fetching top interests:', error);
      return [];
    }
  }

  /**
   * Obter leads por dia (para gráficos)
   */
  static async getLeadsByDay(tenantId: string, days: number = 14) {
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startDate.setDate(startDate.getDate() - days + 1);

      const leads = await prisma.lead.findMany({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
        select: { createdAt: true },
      });

      const byDay: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (days - i - 1));
        byDay[date.toISOString().split('T')[0]] = 0;
      }

      leads.forEach((lead) => {
        const date = lead.createdAt.toISOString().split('T')[0];
        if (byDay[date] !== undefined) {
          byDay[date]++;
        }
      });

      return Object.entries(byDay)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));
    } catch (error) {
      console.error('Error fetching leads by day:', error);
      const now = new Date();
      return Array.from({ length: days }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (days - i - 1));
        return { date: date.toISOString().split('T')[0], count: 0 };
      });
    }
  }

  /**
   * Atualizar status de um lead
   */
  static async updateLead(leadId: string, tenantId: string, updates: any): Promise<Lead | null> {
    try {
      const lead = await prisma.lead.update({
        where: {
          id: leadId,
          tenantId, // Garante que só atualiza leads do tenant
        },
        data: updates,
      });

      return lead;
    } catch (error) {
      console.error('Error updating lead:', error);
      return null;
    }
  }

  /**
   * Deletar um lead
   */
  static async deleteLead(leadId: string, tenantId: string): Promise<boolean> {
    try {
      await prisma.lead.delete({
        where: {
          id: leadId,
          tenantId, // Garante que só deleta leads do tenant
        },
      });

      return true;
    } catch (error) {
      console.error('Error deleting lead:', error);
      return false;
    }
  }
}

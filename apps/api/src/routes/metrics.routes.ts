import { Router, Response } from 'express';
import { AuthRequest, authenticatedLimiter, requireAuth } from '../middleware';
import { LeadsController } from '../controllers/leads.controller';
import { prisma } from '@flowdesk/db';

const router = Router();

/**
 * GET /api/metrics
 * Métricas gerais do dashboard
 */
router.get(
  '/',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const stats = await LeadsController.getStats(req.tenantId!);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_METRICS_ERROR',
          message: 'Failed to fetch metrics',
        },
      });
    }
  }
);

/**
 * GET /api/metrics/leads-by-day
 * Leads por dia
 */
router.get(
  '/leads-by-day',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const days = parseInt((req.query.days as string) || '30');

      const data = await LeadsController.getLeadsByDay(req.tenantId!, days);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Error fetching leads by day:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_LEADS_BY_DAY_ERROR',
          message: 'Failed to fetch leads by day',
        },
      });
    }
  }
);

/**
 * GET /api/metrics/top-interests
 * Principais interesses (extraídos dos customFields dos leads)
 */
router.get(
  '/top-interests',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const leads = await prisma.lead.findMany({
        where: { tenantId: req.tenantId },
        select: { capturedData: true },
      });

      const interestCount: Record<string, number> = {};
      leads.forEach((lead) => {
        const data = lead.capturedData as Record<string, any> | null;
        if (data?.interests && Array.isArray(data.interests)) {
          data.interests.forEach((interest: string) => {
            interestCount[interest] = (interestCount[interest] || 0) + 1;
          });
        }
      });

      const total = leads.length || 1;
      const sorted = Object.entries(interestCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / total) * 100),
        }));

      res.json({
        success: true,
        data: sorted.length > 0 ? sorted : [
          { name: 'Sem dados', count: 0, percentage: 0 }
        ],
      });
    } catch (error) {
      console.error('Error fetching top interests:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_INTERESTS_ERROR',
          message: 'Failed to fetch top interests',
        },
      });
    }
  }
);

export default router;
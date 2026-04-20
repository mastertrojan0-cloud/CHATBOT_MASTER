import { Router, Response } from 'express';
import { AuthRequest, Lead, LeadFilters, PaginatedResponse } from '../types';
import { requireAuth, requirePro, authenticatedLimiter } from '../middleware';
import { sendSuccess, sendError } from '../lib/response';
import { LeadsController } from '../controllers/leads.controller';
import { prisma } from '@flowdesk/db';
import { PlanType, LeadStatus, ContactSource } from '@prisma/client';

const router = Router();

/**
 * POST /api/leads
 * Criar novo lead
 */
router.post(
  '/',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, phone, interest, email, neighborhood, urgency } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({
          success: false,
          error: 'Nome é obrigatório (mínimo 2 caracteres)',
        });
        return;
      }

      if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 8) {
        res.status(400).json({
          success: false,
          error: 'Telefone é obrigatório (mínimo 8 dígitos)',
        });
        return;
      }

      if (!interest) {
        res.status(400).json({
          success: false,
          error: 'Interesse é obrigatório',
        });
        return;
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { plan: true, monthlyLeadLimit: true },
      });

      if (!tenant) {
        res.status(404).json({
          success: false,
          error: 'Tenant não encontrado',
        });
        return;
      }

      const isFree = tenant.plan === PlanType.FREE;
      const leadLimit = isFree ? 50 : tenant.monthlyLeadLimit;

      if (isFree) {
        const currentLeadCount = await prisma.lead.count({
          where: { tenantId: req.tenantId },
        });

        if (currentLeadCount >= 50) {
          res.status(403).json({
            success: false,
            error: 'Limite de 50 leads atingido. Ative o Pro para continuar.',
          });
          return;
        }
      }

      const phoneDigits = phone.replace(/\D/g, '');
      const phoneE164 = `+55${phoneDigits}`;

      const existingContact = await prisma.contact.findUnique({
        where: {
          tenantId_whatsappPhoneE164: {
            tenantId: req.tenantId!,
            whatsappPhoneE164: phoneE164,
          },
        },
      });

      let contact;
      if (existingContact) {
        contact = await prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            name: name.trim(),
            email: email || existingContact.email,
          },
        });
      } else {
        contact = await prisma.contact.create({
          data: {
            tenantId: req.tenantId!,
            whatsappPhone: phone,
            whatsappPhoneE164: phoneE164,
            name: name.trim(),
            email: email || null,
            source: ContactSource.WHATSAPP,
          },
        });
      }

      let score = 10;
      if (name && name.trim().length >= 2) score += 20;
      if (phone && phone.replace(/\D/g, '').length >= 8) score += 20;
      if (interest) score += 20;
      if (email) score += 15;
      if (neighborhood) score += 10;
      if (urgency) score += 5;

      const capturedData: Record<string, unknown> = { interest };
      if (neighborhood) capturedData.neighborhood = neighborhood;
      if (urgency) capturedData.urgency = urgency;
      if (email) capturedData.email = email;

      const lead = await prisma.lead.create({
        data: {
          tenantId: req.tenantId!,
          contactId: contact.id,
          name: name.trim(),
          phone: phone,
          email: email || null,
          status: LeadStatus.NEW,
          score,
          capturedData: capturedData as any,
          source: ContactSource.WHATSAPP,
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              whatsappPhone: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: lead,
      });
    } catch (error: any) {
      console.error('Error creating lead:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao criar lead',
      });
    }
  }
);

/**
 * GET /api/leads
 * Lista leads com filtros, paginação e busca
 */
router.get(
  '/',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        page = '1',
        limit = '10',
        search,
        status,
        interestIn,
        scoreMin,
        scoreMax,
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, parseInt(limit as string) || 10);
      const skip = (pageNum - 1) * limitNum;

      // Construir filtros
      const filters: LeadFilters = {};

      if (search) filters.search = search as string;
      if (status) filters.status = status as Lead['status'];
      if (scoreMin) filters.scoreMin = parseInt(scoreMin as string);
      if (scoreMax) filters.scoreMax = parseInt(scoreMax as string);

      if (interestIn) {
        filters.interestIn = Array.isArray(interestIn)
          ? (interestIn as string[])
          : [(interestIn as string)];
      }

      // Usar controller real
      const { data, total } = await LeadsController.getLeads(req.tenantId || '', filters, pageNum, limitNum);

      res.json({
        success: true,
        data: {
          data,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        } as PaginatedResponse<Lead>,
      });
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_LEADS_ERROR',
          message: 'Failed to fetch leads',
        },
      });
    }
  }
);

/**
 * GET /api/leads/stats
 * Métricas do dashboard
 */
router.get(
  '/stats',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => LeadsController.getStatsHandler(req, res)
);

/**
 * GET /api/leads/leads-by-day
 * Leads por dia (últimos 30 dias)
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
 * GET /api/leads/top-interests
 * Principais interesses
 */
router.get(
  '/top-interests',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      // TODO: Implementar no banco de dados
      // Placeholder: retornar dados mockados
      const data = [
        { name: 'Produto A', count: 15, percentage: 32 },
        { name: 'Produto B', count: 12, percentage: 26 },
        { name: 'Produto C', count: 8, percentage: 17 },
        { name: 'Produto D', count: 12, percentage: 25 },
      ];

      res.json({
        success: true,
        data,
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

/**
 * PATCH /api/leads/:id
 * Atualizar status de um lead
 */
router.patch(
  '/:id',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, score, interests } = req.body;

      if (!req.tenantId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Tenant not found',
          },
        });
        return;
      }

      // Validar status
      if (status && !['new', 'contacted', 'interested', 'qualified', 'lost'].includes(status)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Invalid lead status',
          },
        });
        return;
      }

      // Usar controller real
      const updatedLead = await LeadsController.updateLead(id, req.tenantId as string, { status, score, interests });

      if (!updatedLead) {
        res.status(404).json({
          success: false,
          error: {
            code: 'LEAD_NOT_FOUND',
            message: 'Lead not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: updatedLead,
      });
    } catch (error) {
      console.error('Error updating lead:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_LEAD_ERROR',
          message: 'Failed to update lead',
        },
      });
    }
  }
);

/**
 * DELETE /api/leads/:id
 * Deletar um lead
 */
router.delete(
  '/:id',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!req.tenantId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Tenant not found',
          },
        });
        return;
      }

      // Usar controller real
      const deleted = await LeadsController.deleteLead(id, req.tenantId as string);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: {
            code: 'LEAD_NOT_FOUND',
            message: 'Lead not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: { id, deleted: true },
      });
    } catch (error) {
      console.error('Error deleting lead:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_LEAD_ERROR',
          message: 'Failed to delete lead',
        },
      });
    }
  }
);

/**
 * GET /api/leads/export/csv
 * Exportar leads em CSV (apenas Pro)
 */
router.get(
  '/export/csv',
  authenticatedLimiter,
  requireAuth,
  requirePro,
  async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { plan: true },
      });

      if (!tenant || tenant.plan !== PlanType.PRO) {
        res.status(403).json({
          success: false,
          error: 'Exportação disponível apenas no plano Pro',
        });
        return;
      }

      const leads = await prisma.lead.findMany({
        where: { tenantId: req.tenantId },
        include: {
          contact: {
            select: {
              name: true,
              whatsappPhone: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const escapeCSV = (value: unknown): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const formatDate = (date: Date | string): string => {
        const d = new Date(date);
        return d.toLocaleDateString('pt-BR');
      };

      const headers = ['Data', 'Nome', 'Telefone', 'Email', 'Interesse', 'Status', 'Score'];
      const rows = leads.map((lead) => [
        formatDate(lead.createdAt),
        escapeCSV(lead.contact?.name || lead.name || ''),
        escapeCSV(lead.contact?.whatsappPhone || lead.phone || ''),
        escapeCSV(lead.contact?.email || lead.email || ''),
        escapeCSV((lead.capturedData as Record<string, unknown>)?.interest || ''),
        escapeCSV(lead.status),
        escapeCSV(lead.score),
      ]);

      const csvContent = '\uFEFF' + 
        headers.join(';') + '\n' + 
        rows.map((row) => row.join(';')).join('\n');

      const today = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="leads-${today}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting leads:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao exportar leads',
      });
    }
  }
);

export default router;

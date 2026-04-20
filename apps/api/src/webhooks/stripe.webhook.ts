import { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe, STRIPE_PLANS } from '../config/stripe';
import { prisma } from '@flowdesk/db';
import { PlanType } from '@prisma/client';
import { emailService } from '../services/email.service';
import { invalidateTenantCache } from '../middleware';
import { logger } from '../lib/logger';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    logger.error({ err }, 'Webhook signature verification failed');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  res.status(200).json({ received: true });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!tenantId) {
          logger.error({ metadata: session.metadata }, 'No tenantId in checkout session metadata');
          return;
        }

        const planPriceId = session.line_items?.data[0]?.price?.id;
        const isYearly = planPriceId === STRIPE_PLANS.PRO_YEARLY;
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (isYearly ? 365 : 30));

        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan: PlanType.PRO,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: planPriceId || null,
            planExpiresAt: expiresAt,
            paymentFailedCount: 0,
          },
        });

        // Invalidate tenant cache to apply new plan immediately
        invalidateTenantCache(tenantId);

        console.log(`Tenant ${tenantId} upgraded to PRO`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const tenant = await prisma.tenant.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (!tenant) {
          logger.error({ customerId }, 'No tenant found for customer');
          return;
        }

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            plan: PlanType.FREE,
            stripeSubscriptionId: null,
            planExpiresAt: null,
          },
        });

        // Invalidate tenant cache to apply downgrade immediately
        invalidateTenantCache(tenant.id);

        console.log(`Tenant ${tenant.id} downgraded to FREE (subscription cancelled)`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const tenant = await prisma.tenant.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (!tenant) {
          console.error('No tenant found for customer', customerId);
          return;
        }

        const newFailedCount = tenant.paymentFailedCount + 1;
        
        console.log(`Payment failed for tenant ${tenant.id}. Failed count: ${newFailedCount}`);

        const ownerUser = await prisma.tenantUser.findFirst({
          where: { tenantId: tenant.id, role: 'OWNER' },
          select: { email: true },
        });

        if (ownerUser?.email) {
          emailService.sendPaymentFailed({
            tenantEmail: ownerUser.email,
            businessName: tenant.name,
          });
        }

        if (newFailedCount >= 3) {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              plan: PlanType.FREE,
              isActive: false,
              paymentFailedCount: newFailedCount,
            },
          });
          console.log(`Tenant ${tenant.id} suspended due to 3+ failed payments`);
        } else {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              paymentFailedCount: newFailedCount,
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const tenant = await prisma.tenant.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (!tenant) {
          return;
        }

        if (subscription.status === 'active') {
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
          
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              planExpiresAt: currentPeriodEnd,
              paymentFailedCount: 0,
            },
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
  }
}
import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY || '';
export const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

export const STRIPE_PLANS = {
  PRO_MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_xxx',
  PRO_YEARLY: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_yyy',
};

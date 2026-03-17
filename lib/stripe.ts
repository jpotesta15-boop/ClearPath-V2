/**
 * Stripe client and config for billing (Checkout, Customer Portal, webhooks).
 * Use STRIPE_SECRET_KEY server-side only; never expose to the client.
 */

import Stripe from 'stripe'

const secret = process.env.STRIPE_SECRET_KEY

export const stripe = secret ? new Stripe(secret) : null

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

/** Plan price IDs from env (set in Stripe Dashboard and .env.local) */
export const STRIPE_PRICES: Record<'starter' | 'pro' | 'scale', string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER_ID,
  pro: process.env.STRIPE_PRICE_PRO_ID,
  scale: process.env.STRIPE_PRICE_SCALE_ID,
}

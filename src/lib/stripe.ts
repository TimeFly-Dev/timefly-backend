import Stripe from 'stripe'

function getRequiredEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const STRIPE_SECRET_KEY = getRequiredEnvVar('STRIPE_SECRET_KEY')
const STRIPE_PRICE_PRO_MONTHLY = getRequiredEnvVar('STRIPE_PRICE_PRO_MONTHLY')
const STRIPE_PRICE_PRO_YEARLY = getRequiredEnvVar('STRIPE_PRICE_PRO_YEARLY')

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
  typescript: true,
})

export const PLANS = {
  PRO_MONTHLY: STRIPE_PRICE_PRO_MONTHLY,
  PRO_YEARLY: STRIPE_PRICE_PRO_YEARLY,
} as const
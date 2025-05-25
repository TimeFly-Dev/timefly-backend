import { z } from 'zod'
import { errorResponseSchema } from './authValidations'

// Schema for creating a checkout session
export const createCheckoutSessionSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
  successUrl: z.string().url('Valid success URL is required'),
  cancelUrl: z.string().url('Valid cancel URL is required')
})

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>

// Schema for checkout session response
export const checkoutSessionResponseSchema = z.object({
  id: z.string(),
  url: z.string().url()
})

// Schema for customer portal session
export const createCustomerPortalSessionSchema = z.object({
  returnUrl: z.string().url('Valid return URL is required')
})

export type CreateCustomerPortalSessionInput = z.infer<typeof createCustomerPortalSessionSchema>

// Schema for customer portal session response
export const customerPortalSessionResponseSchema = z.object({
  url: z.string().url()
})

// Schema for subscription response
export const subscriptionResponseSchema = z.object({
  status: z.string(),
  subscriptionId: z.string().nullable(),
  planId: z.string().nullable(),
  startDate: z.string().nullable().or(z.date().nullable()),
  endDate: z.string().nullable().or(z.date().nullable()),
  trialEndDate: z.string().nullable().or(z.date().nullable()),
  nextBillingDate: z.string().nullable().or(z.date().nullable())
})

// Schema for webhook event
export const webhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.any()
  })
})

// Schema for available plans response
export const availablePlansResponseSchema = z.object({
  plans: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    amount: z.number(),
    currency: z.string(),
    interval: z.string(),
    intervalCount: z.number()
  }))
})

// Export error response schema for Stripe endpoints
export { errorResponseSchema }

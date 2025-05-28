import { Hono } from 'hono'
import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { CONFIG } from '@/config'
import { stripe } from '@/lib/stripe'
import { 
  createCheckoutSession,
  handleSubscriptionChange,
  storeStripeEvent
} from '@/services/stripeService'
import { logger } from '@/utils/logger'

const stripeRoutes = new Hono()

// Middleware to verify user is authenticated
// async function verifyAuth(c: Context, next: Function) {
//   try {
//     const accessToken = getCookie(c, 'access_token')
    
//     if (!accessToken) {
//       return c.json({ error: 'Unauthorized - No access token' }, 401)
//     }
    
//     const payload = await verify(accessToken, CONFIG.JWT_ACCESS_SECRET)
//     c.set('userId', payload.id)
    
//     await next()
//   } catch (error) {
//     logger.error('Authentication error', { error })
//     return c.json({ error: 'Unauthorized - Invalid token' }, 401)
//   }
// }

// Create checkout session endpoint
stripeRoutes.post(
  '/create',
  // verifyAuth,
  async (c) => {
    try {
      const userId = c.get('userId')
      const { priceId, successUrl, cancelUrl } = await c.req.json()
      
      if (!priceId || !successUrl || !cancelUrl) {
        return c.json({ error: 'Missing required fields' }, 400)
      }
      
      // Create checkout session
      const session = await createCheckoutSession(
        userId,
        priceId,
        successUrl,
        cancelUrl
      )
      
      return c.json(session)
    } catch (error) {
      logger.error('Error creating checkout session', { error })
      return c.json({ error: 'Failed to create checkout session' }, 500)
    }
  }
)

// Stripe webhook handler
stripeRoutes.post(
  '/stripe',
  async (c) => {
    const signature = c.req.header('stripe-signature')
    
    if (!signature) {
      return c.json({ error: 'Missing Stripe signature' }, 400)
    }
    
    try {
      const body = await c.req.text()
      
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not set in environment variables')
      }

      // Verify webhook signature
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      )
      
      // Store event in database with proper type assertion
      const eventData = event.data.object as unknown as Record<string, unknown>
      await storeStripeEvent(event.id, event.type, eventData)
      
      // Handle specific event types
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await handleSubscriptionChange(eventData)
          break
      }
      
      return c.text('Webhook received')
    } catch (error) {
      logger.error('Webhook error', { error })
      return c.json({ error: 'Webhook error' }, 500)
    }
  }
)

export { stripeRoutes }
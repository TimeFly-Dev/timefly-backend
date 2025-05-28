import { mysqlPool } from '@/db/mysql'
import { stripe, PLANS } from '@/lib/stripe'
import { logger } from '@/utils/logger'
import type { StripeCheckoutSession } from '@/types/stripe'

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(
  userId: number,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<StripeCheckoutSession> {
  try {
    // Create the session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId.toString()
      }
    })

    return {
      id: session.id,
      url: session.url || ''
    }
  } catch (error) {
    logger.error('Error creating checkout session', { error, userId, priceId })
    throw error
  }
}

/**
 * Handle subscription created or updated
 */
export async function handleSubscriptionChange(subscription: Record<string, unknown>): Promise<void> {
  // const customerId = subscription.customer as string
  
  // Get user ID from metadata or lookup by customer ID
  const userId = subscription.metadata?.userId
  
  if (!userId) {
    logger.error('User ID not found in subscription metadata', { subscriptionId: subscription.id })
    return
  }
  
  const status = subscription.status
  const subscriptionId = subscription.id
  
  // Update user subscription status
  await mysqlPool.execute(
    `UPDATE users SET 
      subscription_status = ?,
      subscription_id = ?,
      current_plan_id = ?
    WHERE id = ?`,
    [
      status,
      subscriptionId,
      subscription.items.data[0]?.price.id || null,
      userId
    ]
  )
}

/**
 * Store Stripe webhook event
 */
export async function storeStripeEvent(eventId: string, eventType: string, data: Record<string, unknown>): Promise<void> {
  await mysqlPool.execute(
    'INSERT INTO stripe_events (stripe_event_id, event_type, data) VALUES (?, ?, ?)',
    [eventId, eventType, JSON.stringify(data)]
  )
}
export interface StripeCheckoutSession {
  id: string
  url: string
}

export interface StripeWebhookEvent {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}
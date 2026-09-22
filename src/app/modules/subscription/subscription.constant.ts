export const SUBSCRIPTION_PLAN = {
    MATURA: 'matura',
    SEMI_MATURA: 'semi_matura',
    PROVIME: 'provime',
    FULL_ACCESS: 'full-access'
} as const;

export const SUBSCRIPTION_PLAN_TYPE = {
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    ONE_TIME: 'one-time',
} as const;

export const SUBSCRIPTION_MODE = {
    ONE_MONTH: 'one_month1',
    THREE_MONTHS: 'three_months',
} as const;

export const SUBSCRIPTION_STATUS = {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled',
} as const;

export const PAYMENT_PROVIDER = {
    APPLE: 'Apple',
    GOOGLE_PLAY: 'Google Play',
    STRIPE: 'Stripe',
    CARD: 'Card',
    PAYPAL: 'PayPal',
    MANUAL: 'Manual',
} as const;

export type TSubscriptionPlan = (typeof SUBSCRIPTION_PLAN)[keyof typeof SUBSCRIPTION_PLAN];
export type TSubscriptionPlanType = (typeof SUBSCRIPTION_PLAN_TYPE)[keyof typeof SUBSCRIPTION_PLAN_TYPE];
export type TSubscriptionMode = (typeof SUBSCRIPTION_MODE)[keyof typeof SUBSCRIPTION_MODE];
export type TSubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];
export type TPaymentProvider = (typeof PAYMENT_PROVIDER)[keyof typeof PAYMENT_PROVIDER];

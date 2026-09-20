export const PAYMENT_METHOD = {
  COD: 'cash_on_delivery',
  STRIPE: 'stripe',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export const ORDER_SEARCHABLE_FIELDS = [
  'orderNumber',
  'shippingAddress.fullName',
  'shippingAddress.phoneNumber',
  'shippingAddress.city',
  'tracking.trackingNumber',
];

export const ORDER_FILTERABLE_FIELDS = [
  'searchTerm',
  'orderStatus',
  'paymentStatus',
  'paymentMethod',
  'startDate',
  'endDate',
  'minTotal',
  'maxTotal',
  'page',
  'limit',
  'sort',
];

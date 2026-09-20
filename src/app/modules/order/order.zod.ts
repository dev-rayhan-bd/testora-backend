import { z } from 'zod';
import { ORDER_STATUS, PAYMENT_METHOD } from './order.constant';

const checkoutItemSchema = z.object({
  productId: z
    .string({ message: 'Product ID is required' })
    .regex(/^[a-f\d]{24}$/i, { message: 'Invalid product ID format' }),
  variantId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, { message: 'Invalid variant ID format' })
    .optional(),
  quantity: z
    .number({ message: 'Quantity is required' })
    .int({ message: 'Quantity must be an integer' })
    .min(1, { message: 'Quantity must be at least 1' }),
});

const shippingAddressSchema = z.object({
  fullName: z
    .string({ message: 'Recipient full name is required' })
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters' }),
  phoneNumber: z
    .string({ message: 'Phone number is required' })
    .trim()
    .min(6, { message: 'Phone number must be at least 6 digits' }),
  streetAddress: z
    .string({ message: 'Street delivery address is required' })
    .trim()
    .min(5, { message: 'Street address must be at least 5 characters' }),
  city: z
    .string({ message: 'City is required' })
    .trim()
    .min(2, { message: 'City must be at least 2 characters' }),
  state: z.string().trim().optional(),
  postalCode: z
    .string({ message: 'Postal code is required' })
    .trim()
    .min(2, { message: 'Postal code is required' }),
  country: z.string().trim().default('Kosovo'),
});

const checkoutSchema = z.object({
  items: z
    .array(checkoutItemSchema, { message: 'Items array is required' })
    .min(1, { message: 'Order must contain at least one item' }),
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.enum(['cash_on_delivery', 'stripe'], {
    message: 'Payment method must be cash_on_delivery or stripe',
  }),
  couponCode: z.string().trim().optional(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, { message: 'Idempotency key must be at least 8 characters' })
    .optional(),
  notes: z.string().trim().optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(
    [
      ORDER_STATUS.PENDING,
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.CANCELLED,
    ],
    { message: 'Invalid order status transition' },
  ),
  cancellationReason: z.string().trim().optional(),
});

const addTrackingSchema = z.object({
  courierName: z
    .string({ message: 'Courier name is required' })
    .trim()
    .min(2, { message: 'Courier name must be at least 2 characters' }),
  trackingNumber: z
    .string({ message: 'Tracking number is required' })
    .trim()
    .min(3, { message: 'Tracking number must be at least 3 characters' }),
  trackingUrl: z
    .string()
    .url({ message: 'Tracking URL must be a valid URL' })
    .optional(),
  estimatedDelivery: z.coerce.date().optional(),
});

const refundOrderSchema = z.object({
  reason: z
    .string({ message: 'Refund reason is required' })
    .trim()
    .min(5, { message: 'Refund reason must be at least 5 characters' }),
  restockInventory: z.boolean().default(true),
});

const cancelOrderSchema = z.object({
  reason: z
    .string({ message: 'Cancellation reason is required' })
    .trim()
    .min(5, { message: 'Cancellation reason must be at least 5 characters' }),
});

const getOrdersQuerySchema = z.object({
  searchTerm: z.string().trim().optional(),
  orderStatus: z.enum(Object.values(ORDER_STATUS) as [string, ...string[]]).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  paymentMethod: z.enum(['cash_on_delivery', 'stripe']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minTotal: z.coerce.number().min(0).optional(),
  maxTotal: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  sort: z.string().optional(),
});

export type TCheckoutPayload = z.infer<typeof checkoutSchema>;
export type TUpdateOrderStatusPayload = z.infer<typeof updateOrderStatusSchema>;
export type TAddTrackingPayload = z.infer<typeof addTrackingSchema>;
export type TRefundOrderPayload = z.infer<typeof refundOrderSchema>;
export type TCancelOrderPayload = z.infer<typeof cancelOrderSchema>;
export type TGetOrdersQueryPayload = z.infer<typeof getOrdersQuerySchema>;

const orderZodSchema = {
  checkoutSchema,
  updateOrderStatusSchema,
  addTrackingSchema,
  refundOrderSchema,
  cancelOrderSchema,
  getOrdersQuerySchema,
};

export default orderZodSchema;

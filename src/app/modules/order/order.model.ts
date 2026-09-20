import { Schema, model, Types } from 'mongoose';
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from './order.constant';
import { IOrder, IOrderModel } from './order.interface';

const orderItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    variantId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    sku: {
      type: String,
      required: [true, 'Item SKU is required'],
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Item title is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Item unit price is required'],
      min: [0, 'Price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Item quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Item total price is required'],
      min: [0, 'Total price cannot be negative'],
    },
    image: {
      type: String,
      trim: true,
    },
    attributes: {
      color: { type: String, trim: true },
      size: { type: String, trim: true },
    },
  },
  { _id: true },
);

const shippingAddressSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Recipient full name is required'],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
    },
    streetAddress: {
      type: String,
      required: [true, 'Street delivery address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      default: 'Kosovo',
      trim: true,
    },
  },
  { _id: false },
);

const pricingSchema = new Schema(
  {
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
    },
    shippingFee: {
      type: Number,
      default: 0,
      min: [0, 'Shipping fee cannot be negative'],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
    },
  },
  { _id: false },
);

const paymentSchema = new Schema(
  {
    method: {
      type: String,
      enum: {
        values: Object.values(PAYMENT_METHOD),
        message: 'Payment method must be cash_on_delivery or stripe',
      },
      required: [true, 'Payment method is required'],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(PAYMENT_STATUS),
        message: 'Payment status must be pending, paid, failed, or refunded',
      },
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    transactionId: {
      type: String,
      trim: true,
    },
    stripeSessionId: {
      type: String,
      trim: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      trim: true,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const trackingSchema = new Schema(
  {
    courierName: {
      type: String,
      trim: true,
    },
    trackingNumber: {
      type: String,
      trim: true,
      index: true,
    },
    trackingUrl: {
      type: String,
      trim: true,
    },
    shippedAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    estimatedDelivery: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder, IOrderModel>(
  {
    orderNumber: {
      type: String,
      unique: true,
      trim: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: [true, 'Order items are required'],
      validate: [
        (val: any[]) => val.length > 0,
        'Order must have at least one item',
      ],
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: [true, 'Shipping address is required'],
    },
    pricing: {
      type: pricingSchema,
      required: [true, 'Pricing breakdown is required'],
    },
    coupon: {
      code: { type: String, trim: true },
      discountAmount: { type: Number, default: 0 },
    },
    payment: {
      type: paymentSchema,
      required: [true, 'Payment information is required'],
    },
    orderStatus: {
      type: String,
      enum: {
        values: Object.values(ORDER_STATUS),
        message: 'Invalid order status',
      },
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    tracking: {
      type: trackingSchema,
      default: () => ({}),
    },
    idempotencyKey: {
      type: String,
      required: [true, 'Idempotency key is required'],
      unique: true,
      trim: true,
      index: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Compound Indexes ────────────────────────────────────────────────────────
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, 'payment.status': 1 });
orderSchema.index({ createdAt: -1 });

orderSchema.statics.isIdempotencyKeyExists = async function (
  key: string,
): Promise<IOrder | null> {
  return this.findOne({ idempotencyKey: key });
};

// ── Pre-Save Hook: Auto generate Order Number ────────────────────────────────
orderSchema.pre('save', async function () {
  if (!this.orderNumber) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderNumber = `ORD-${dateStr}-${randomHex}`;
  }
});

const Order = model<IOrder, IOrderModel>('Order', orderSchema);

export default Order;

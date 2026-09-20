import { Document, Model, Types } from 'mongoose';

export type TPaymentMethod = 'cash_on_delivery' | 'stripe';
export type TPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type TOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface IOrderItem {
  product: Types.ObjectId;
  variantId?: Types.ObjectId;
  sku: string;
  title: string;
  price: number;
  quantity: number;
  totalPrice: number;
  image?: string;
  attributes?: {
    color?: string;
    size?: string;
  };
}

export interface IShippingAddress {
  fullName: string;
  phoneNumber: string;
  streetAddress: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface IOrderPricing {
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
}

export interface IOrderPayment {
  method: TPaymentMethod;
  status: TPaymentStatus;
  transactionId?: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: Date | null;
  refundedAt?: Date | null;
}

export interface IOrderTracking {
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
  estimatedDelivery?: Date | null;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  user: Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  pricing: IOrderPricing;
  coupon?: {
    code: string;
    discountAmount: number;
  } | null;
  payment: IOrderPayment;
  orderStatus: TOrderStatus;
  tracking: IOrderTracking;
  idempotencyKey: string;
  cancellationReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type IOrderDocument = IOrder;

export interface IOrderModel extends Model<IOrder> {
  isIdempotencyKeyExists(key: string): Promise<IOrder | null>;
}

export interface ICheckoutResult {
  order: IOrder;
  paymentMethod: TPaymentMethod;
  checkoutUrl?: string | null;
  sessionId?: string | null;
}

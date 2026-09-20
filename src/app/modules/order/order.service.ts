import mongoose, { ClientSession, Types } from 'mongoose';
import Stripe from 'stripe';
import QueryBuilder from '../../../builder/QueryBuilder';
import config from '../../../config';
import { BadRequestError, NotFoundError } from '../../errors/request/apiError';
import { couponService } from '../coupon/coupon.service';
import { productService } from '../product/product.service';
import Product from '../product/product.model';
import {
  ORDER_SEARCHABLE_FIELDS,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} from './order.constant';
import {
  ICheckoutResult,
  IOrder,
  IOrderItem,
  IOrderPayment,
  IOrderPricing,
  IOrderTracking,
} from './order.interface';
import Order from './order.model';
import {
  TAddTrackingPayload,
  TCheckoutPayload,
  TRefundOrderPayload,
  TUpdateOrderStatusPayload,
} from './order.zod';

const stripe = new Stripe(config.stripe_secret_key as string);

// ── 1. Create Checkout Order (ACID Transaction & Idempotency) ────────────────
const createCheckoutOrder = async (
  userId: string,
  payload: TCheckoutPayload,
  idempotencyKeyHeader?: string,
): Promise<ICheckoutResult> => {
  const idempotencyKey =
    idempotencyKeyHeader?.trim() ||
    payload.idempotencyKey?.trim() ||
    `IDEM-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // ── Idempotency Check: Prevent duplicate charge/order on network retries ──
  const existingOrder = await Order.isIdempotencyKeyExists(idempotencyKey);
  if (existingOrder) {
    let checkoutUrl: string | null = null;
    if (
      existingOrder.payment.method === PAYMENT_METHOD.STRIPE &&
      existingOrder.payment.stripeSessionId
    ) {
      try {
        const session = await stripe.checkout.sessions.retrieve(
          existingOrder.payment.stripeSessionId,
        );
        checkoutUrl = session.url;
      } catch (err) {
        // session expired or unavailable
      }
    }
    return {
      order: existingOrder,
      paymentMethod: existingOrder.payment.method,
      checkoutUrl,
      sessionId: existingOrder.payment.stripeSessionId,
    };
  }

  // ── Multi-Document ACID Transaction ───────────────────────────────────────
  const session: ClientSession = await mongoose.startSession();
  let createdOrder: IOrder;

  try {
    session.startTransaction();

    const orderItems: IOrderItem[] = [];
    let subtotal = 0;

    // 1. Verify availability and atomically deduct inventory
    for (const item of payload.items) {
      const stockCheck = await productService.checkStockAvailability(
        item.productId,
        item.quantity,
        item.variantId,
      );

      if (!stockCheck.isAvailable) {
        throw new BadRequestError(
          `Insufficient stock for '${stockCheck.product.title}'. Only ${stockCheck.currentStock} units available.`,
        );
      }

      // Atomically decrement stock inside the ACID transaction
      await productService.deductStock(
        item.productId,
        item.quantity,
        item.variantId,
        session,
      );

      const unitPrice = stockCheck.product.price;
      const itemTotal = Number((unitPrice * item.quantity).toFixed(2));
      subtotal += itemTotal;

      const fullProduct = await Product.findById(item.productId).session(session);
      const itemImage =
        stockCheck.product.variant?.image ||
        (fullProduct?.images && fullProduct.images.length > 0
          ? fullProduct.images[0]
          : '');

      orderItems.push({
        product: new Types.ObjectId(item.productId),
        variantId: item.variantId ? new Types.ObjectId(item.variantId) : undefined,
        sku: stockCheck.product.sku,
        title: stockCheck.product.title,
        price: unitPrice,
        quantity: item.quantity,
        totalPrice: itemTotal,
        image: itemImage,
        attributes: {
          color: stockCheck.product.variant?.color,
          size: stockCheck.product.variant?.size,
        },
      });
    }

    subtotal = Number(subtotal.toFixed(2));

    // 2. Shipping Calculation (Free shipping over $50, else $5.00 flat fee)
    const shippingFee = subtotal >= 50 ? 0 : 5.0;

    // 3. Coupon Voucher Verification & Calculation
    let discountAmount = 0;
    let couponData = null;

    if (payload.couponCode) {
      const couponResult = await couponService.validateAndCalculateDiscount(
        payload.couponCode,
        subtotal,
      );

      discountAmount = couponResult.discountAmount;
      couponData = {
        code: couponResult.coupon.code,
        discountAmount: couponResult.discountAmount,
      };

      // Increment coupon usage counter atomically within transaction
      await couponService.incrementCouponUsage(payload.couponCode, session);
    }

    const totalAmount = Number(
      Math.max(0, subtotal + shippingFee - discountAmount).toFixed(2),
    );

    const pricing: IOrderPricing = {
      subtotal,
      shippingFee,
      discountAmount,
      totalAmount,
    };

    const payment: IOrderPayment = {
      method: payload.paymentMethod,
      status: PAYMENT_STATUS.PENDING,
    };

    // 4. Create Order Record inside transaction
    const [orderDoc] = await Order.create(
      [
        {
          user: new Types.ObjectId(userId),
          items: orderItems,
          shippingAddress: payload.shippingAddress,
          pricing,
          coupon: couponData,
          payment,
          orderStatus:
            payload.paymentMethod === PAYMENT_METHOD.COD
              ? ORDER_STATUS.CONFIRMED
              : ORDER_STATUS.PENDING,
          idempotencyKey,
          notes: payload.notes,
        },
      ],
      { session },
    );

    createdOrder = orderDoc;

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  // ── Post-Transaction Payment Gateway Integration (Stripe) ─────────────────
  if (payload.paymentMethod === PAYMENT_METHOD.STRIPE) {
    try {
      const lineItems: any[] =
        createdOrder.items.map((item) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.title,
              images: item.image ? [item.image] : [],
              metadata: {
                sku: item.sku,
              },
            },
            unit_amount: Math.round(item.price * 100), // Stripe accepts cents
          },
          quantity: item.quantity,
        }));

      // If shipping fee applies
      if (createdOrder.pricing.shippingFee > 0) {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Standard Delivery Shipping',
            },
            unit_amount: Math.round(createdOrder.pricing.shippingFee * 100),
          },
          quantity: 1,
        });
      }

      // If discount applies, calculate proportional reduction or use coupon
      const frontendUrl = config.frontend_url || 'http://localhost:3000';

      const stripeSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: lineItems,
        client_reference_id: createdOrder._id.toString(),
        customer_email: payload.shippingAddress.phoneNumber ? undefined : undefined,
        metadata: {
          orderId: createdOrder._id.toString(),
          orderNumber: createdOrder.orderNumber,
          userId: userId,
        },
        success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${createdOrder._id}`,
        cancel_url: `${frontendUrl}/checkout/cancel?order_id=${createdOrder._id}`,
      });

      // Save stripe session ID on order
      createdOrder.payment.stripeSessionId = stripeSession.id;
      await createdOrder.save();

      return {
        order: createdOrder,
        paymentMethod: PAYMENT_METHOD.STRIPE,
        checkoutUrl: stripeSession.url,
        sessionId: stripeSession.id,
      };
    } catch (stripeError: any) {
      // If Stripe creation fails, order remains pending and can be re-attempted
      throw new BadRequestError(`Stripe Checkout initiation failed: ${stripeError.message}`);
    }
  }

  return {
    order: createdOrder,
    paymentMethod: PAYMENT_METHOD.COD,
    checkoutUrl: null,
    sessionId: null,
  };
};

// ── 2. Get Customer's Order History ──────────────────────────────────────────
const getMyOrders = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const filter: Record<string, any> = {
    user: new Types.ObjectId(userId),
  };

  const orderQuery = new QueryBuilder<IOrder>(
    Order.find(filter).populate('items.product', 'title slug images brand'),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await orderQuery.modelQuery;
  const meta = await orderQuery.countTotal();

  return {
    meta: {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: meta.totalPage,
    },
    data,
  };
};

// ── 3. Get Single Order Details ──────────────────────────────────────────────
const getOrderDetails = async (
  orderIdOrNumber: string,
  userId?: string,
  isAdmin = false,
): Promise<IOrder> => {
  const isObjectId = Types.ObjectId.isValid(orderIdOrNumber);

  const filter: Record<string, any> = isObjectId
    ? { _id: new Types.ObjectId(orderIdOrNumber) }
    : { orderNumber: orderIdOrNumber.trim() };

  if (!isAdmin && userId) {
    filter.user = new Types.ObjectId(userId);
  }

  const order = await Order.findOne(filter)
    .populate('user', 'fullName email')
    .populate('items.product', 'title slug images brand');

  if (!order) {
    throw new NotFoundError(
      `Order not found with identifier '${orderIdOrNumber}'.`,
    );
  }

  return order;
};

// ── 4. Get All Orders (Admin with Advanced Filtering) ────────────────────────
const getAllOrdersAdmin = async (query: Record<string, unknown>) => {
  const filter: Record<string, any> = {};

  if (query.orderStatus) {
    filter.orderStatus = query.orderStatus;
  }

  if (query.paymentStatus) {
    filter['payment.status'] = query.paymentStatus;
  }

  if (query.paymentMethod) {
    filter['payment.method'] = query.paymentMethod;
  }

  // Date Range Filtering
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) {
      filter.createdAt.$gte = new Date(query.startDate as string);
    }
    if (query.endDate) {
      filter.createdAt.$lte = new Date(query.endDate as string);
    }
  }

  // Total amount range
  if (query.minTotal !== undefined || query.maxTotal !== undefined) {
    filter['pricing.totalAmount'] = {};
    if (query.minTotal !== undefined) {
      filter['pricing.totalAmount'].$gte = Number(query.minTotal);
    }
    if (query.maxTotal !== undefined) {
      filter['pricing.totalAmount'].$lte = Number(query.maxTotal);
    }
  }

  const cleanQuery = { ...query };
  delete cleanQuery.orderStatus;
  delete cleanQuery.paymentStatus;
  delete cleanQuery.paymentMethod;
  delete cleanQuery.startDate;
  delete cleanQuery.endDate;
  delete cleanQuery.minTotal;
  delete cleanQuery.maxTotal;

  const orderQuery = new QueryBuilder<IOrder>(
    Order.find(filter)
      .populate('user', 'fullName email')
      .populate('items.product', 'title slug images brand'),
    cleanQuery,
  )
    .search(ORDER_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await orderQuery.modelQuery;
  const meta = await orderQuery.countTotal();

  return {
    meta: {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: meta.totalPage,
    },
    data,
  };
};

// ── 5. Update Order Status (Admin Workflow) ──────────────────────────────────
const updateOrderStatus = async (
  orderId: string,
  payload: TUpdateOrderStatusPayload,
): Promise<IOrder> => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError(`Order with ID '${orderId}' not found.`);
  }

  if (order.orderStatus === ORDER_STATUS.CANCELLED || order.orderStatus === ORDER_STATUS.REFUNDED) {
    throw new BadRequestError(
      `Cannot change status of an order that is already '${order.orderStatus}'.`,
    );
  }

  order.orderStatus = payload.status;

  if (payload.status === ORDER_STATUS.CANCELLED) {
    order.cancellationReason = payload.cancellationReason || 'Cancelled by administrator';
    // Restore inventory
    for (const item of order.items) {
      await productService.restoreStock(
        item.product.toString(),
        item.quantity,
        item.variantId?.toString(),
      );
    }
  } else if (payload.status === ORDER_STATUS.SHIPPED && !order.tracking.shippedAt) {
    order.tracking.shippedAt = new Date();
  } else if (payload.status === ORDER_STATUS.DELIVERED) {
    order.tracking.deliveredAt = new Date();
    // If COD, delivery implies payment received
    if (order.payment.method === PAYMENT_METHOD.COD && order.payment.status !== PAYMENT_STATUS.PAID) {
      order.payment.status = PAYMENT_STATUS.PAID;
      order.payment.paidAt = new Date();
    }
  }

  await order.save();
  return order;
};

// ── 6. Add Courier Tracking Information (Admin) ──────────────────────────────
const addTrackingInfo = async (
  orderId: string,
  payload: TAddTrackingPayload,
): Promise<IOrder> => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError(`Order with ID '${orderId}' not found.`);
  }

  order.tracking = {
    ...order.tracking,
    courierName: payload.courierName,
    trackingNumber: payload.trackingNumber,
    trackingUrl: payload.trackingUrl,
    estimatedDelivery: payload.estimatedDelivery || order.tracking.estimatedDelivery,
    shippedAt: order.tracking.shippedAt || new Date(),
  };

  // Auto transition to SHIPPED if currently CONFIRMED or PENDING
  if (order.orderStatus === ORDER_STATUS.CONFIRMED || order.orderStatus === ORDER_STATUS.PENDING) {
    order.orderStatus = ORDER_STATUS.SHIPPED;
  }

  await order.save();
  return order;
};

// ── 7. Cancel Order (Customer or Admin with Stock Restoration) ───────────────
const cancelOrder = async (
  orderId: string,
  userId?: string,
  isAdmin = false,
  reason = 'Cancelled by user',
): Promise<IOrder> => {
  const filter: Record<string, any> = { _id: new Types.ObjectId(orderId) };
  if (!isAdmin && userId) {
    filter.user = new Types.ObjectId(userId);
  }

  const order = await Order.findOne(filter);
  if (!order) {
    throw new NotFoundError(`Order '${orderId}' not found.`);
  }

  if (order.orderStatus !== ORDER_STATUS.PENDING && order.orderStatus !== ORDER_STATUS.CONFIRMED) {
    throw new BadRequestError(
      `Orders cannot be cancelled once they are in '${order.orderStatus}' status.`,
    );
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    order.orderStatus = ORDER_STATUS.CANCELLED;
    order.cancellationReason = reason;

    // Atomically restore stock back to products/variants
    for (const item of order.items) {
      await productService.restoreStock(
        item.product.toString(),
        item.quantity,
        item.variantId?.toString(),
        session,
      );
    }

    await order.save({ session });
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  return order;
};

// ── 8. Refund Order (Admin with Stripe Integration & Stock Restoration) ─────
const refundOrder = async (
  orderId: string,
  payload: TRefundOrderPayload,
): Promise<IOrder> => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError(`Order '${orderId}' not found.`);
  }

  if (order.orderStatus === ORDER_STATUS.REFUNDED) {
    throw new BadRequestError('This order has already been refunded.');
  }

  // 1. If paid via Stripe, trigger Stripe Refund API
  if (order.payment.method === PAYMENT_METHOD.STRIPE && order.payment.stripePaymentIntentId) {
    try {
      await stripe.refunds.create({
        payment_intent: order.payment.stripePaymentIntentId,
        reason: 'requested_by_customer',
      });
    } catch (stripeErr: any) {
      throw new BadRequestError(`Stripe Refund API error: ${stripeErr.message}`);
    }
  }

  // 2. ACID Transaction: update status and optionally restore stock
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    order.orderStatus = ORDER_STATUS.REFUNDED;
    order.payment.status = PAYMENT_STATUS.REFUNDED;
    order.payment.refundedAt = new Date();
    order.cancellationReason = payload.reason;

    if (payload.restockInventory) {
      for (const item of order.items) {
        await productService.restoreStock(
          item.product.toString(),
          item.quantity,
          item.variantId?.toString(),
          session,
        );
      }
    }

    await order.save({ session });
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  return order;
};

export const orderService = {
  createCheckoutOrder,
  getMyOrders,
  getOrderDetails,
  getAllOrdersAdmin,
  updateOrderStatus,
  addTrackingInfo,
  cancelOrder,
  refundOrder,
};

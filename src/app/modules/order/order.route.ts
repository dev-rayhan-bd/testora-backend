import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/request.validator';
import { USER_ROLE } from '../user/user.constant';
import { orderController } from './order.controller';
import orderZodSchema from './order.zod';

const orderRouter = Router();

// ── Customer Storefront Routes (Authenticated Student/User) ────────────────
/**
 * @route   POST /api/v1/orders/checkout
 * @desc    Initiate checkout / place order (Cash on Delivery or Stripe)
 * @access  Authenticated (Student / User)
 */
orderRouter.post(
  '/checkout',
  authMiddleware(USER_ROLE.STUDENT, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: orderZodSchema.checkoutSchema,
  }),
  orderController.createCheckoutOrder,
);

/**
 * @route   GET /api/v1/orders/my-orders
 * @desc    Retrieve logged-in user's order history with pagination
 * @access  Authenticated (Student / User)
 */
orderRouter.get(
  '/my-orders',
  authMiddleware(USER_ROLE.STUDENT, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  orderController.getMyOrders,
);

/**
 * @route   POST /api/v1/orders/:id/cancel
 * @desc    Cancel an unfulfilled order and restore inventory
 * @access  Authenticated (Student / User)
 */
orderRouter.post(
  '/:id/cancel',
  authMiddleware(USER_ROLE.STUDENT, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: orderZodSchema.cancelOrderSchema,
  }),
  orderController.cancelOrder,
);

// ── Admin Protected Routes ───────────────────────────────────────────────────
/**
 * @route   GET /api/v1/orders/admin/all
 * @desc    Get all orders across platform with advanced filters (Status, Date, Payment, Courier)
 * @access  Admin & Super Admin
 */
orderRouter.get(
  '/admin/all',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    query: orderZodSchema.getOrdersQuerySchema,
  }),
  orderController.getAllOrdersAdmin,
);

/**
 * @route   PATCH /api/v1/orders/admin/:id/status
 * @desc    Update order status workflow (pending -> confirmed -> shipped -> delivered -> cancelled)
 * @access  Admin & Super Admin
 */
orderRouter.patch(
  '/admin/:id/status',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: orderZodSchema.updateOrderStatusSchema,
  }),
  orderController.updateOrderStatus,
);

/**
 * @route   PATCH /api/v1/orders/admin/:id/tracking
 * @desc    Attach courier tracking number, carrier name, and URL
 * @access  Admin & Super Admin
 */
orderRouter.patch(
  '/admin/:id/tracking',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: orderZodSchema.addTrackingSchema,
  }),
  orderController.addTrackingInfo,
);

/**
 * @route   POST /api/v1/orders/admin/:id/refund
 * @desc    Trigger payment refund via Stripe and restore inventory in ACID transaction
 * @access  Admin & Super Admin
 */
orderRouter.post(
  '/admin/:id/refund',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: orderZodSchema.refundOrderSchema,
  }),
  orderController.refundOrder,
);

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Get order details (customer sees own, admin sees any)
 * @access  Authenticated
 */
orderRouter.get(
  '/:id',
  authMiddleware(USER_ROLE.STUDENT, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  orderController.getOrderDetails,
);

export default orderRouter;

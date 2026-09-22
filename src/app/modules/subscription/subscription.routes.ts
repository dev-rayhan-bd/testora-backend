import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/request.validator";
import { USER_ROLE } from "../user/user.constant";
import { subscriptionController } from "./subscription.controller";
import subscriptionZodSchema from "./subscription.zod";

const subscriptionRouter = Router();

// ── Mobile App Developer Endpoints (In-App Purchase Sync) ───────────────────
/**
 * @route   POST /api/v1/subscription/in-app-purchase
 * @desc    Record and verify mobile in-app purchase (Apple App Store / Google Play)
 * @access  Authenticated Students & Admins
 */
subscriptionRouter.post(
  "/in-app-purchase",
  authMiddleware(USER_ROLE.STUDENT, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: subscriptionZodSchema.inAppPurchaseSchema,
  }),
  subscriptionController.recordInAppPurchase
);

/**
 * @route   GET /api/v1/subscription/my-subscription
 * @desc    Get currently logged in user's active digital subscription
 * @access  Authenticated Students
 */
subscriptionRouter.get(
  "/my-subscription",
  authMiddleware(USER_ROLE.STUDENT, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  subscriptionController.getMySubscription
);

// ── Admin Dashboard Endpoints (Premium Subscribers Suite) ───────────────────
/**
 * @route   GET /api/v1/admin/subscriptions/overview
 * @desc    Top 4 stats cards: active, expired this month, cancelled, expiring soon (30d)
 * @access  Admin & Super Admin
 */
subscriptionRouter.get(
  "/overview",
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  subscriptionController.getSubscriptionOverview
);

/**
 * @route   GET /api/v1/admin/subscriptions/list
 * @desc    Search, product/plan/status/expiring filtering, and pagination for subscribers table
 * @access  Admin & Super Admin
 */
subscriptionRouter.get(
  "/list",
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    query: subscriptionZodSchema.getSubscriptionsQuerySchema,
  }),
  subscriptionController.getAllSubscriptions
);

/**
 * @route   PATCH /api/v1/admin/subscriptions/:id/status
 * @desc    Cancel plan, reactivate, or extend subscription expiry days
 * @access  Admin & Super Admin
 */
subscriptionRouter.patch(
  "/:id/status",
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: subscriptionZodSchema.updateSubscriptionStatusSchema,
  }),
  subscriptionController.updateSubscriptionStatus
);

export default subscriptionRouter;
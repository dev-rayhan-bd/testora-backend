import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/request.validator';
import { USER_ROLE } from '../user/user.constant';
import { couponController } from './coupon.controller';
import couponZodSchema from './coupon.zod';

const couponRouter = Router();

// ── Public Storefront Route ──────────────────────────────────────────────────
/**
 * @route   POST /api/v1/coupons/validate
 * @desc    Validate a voucher code and calculate potential discount
 * @access  Public / Authenticated Student
 */
couponRouter.post(
  '/validate',
  validateRequest({
    body: couponZodSchema.validateCouponSchema,
  }),
  couponController.validateCoupon,
);

// ── Admin Protected Routes ───────────────────────────────────────────────────
/**
 * @route   GET /api/v1/coupons
 * @desc    Get all coupons (Admin)
 * @access  Admin & Super Admin
 */
couponRouter.get(
  '/',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  couponController.getAllCoupons,
);

/**
 * @route   GET /api/v1/coupons/:id
 * @desc    Get single coupon details
 * @access  Admin & Super Admin
 */
couponRouter.get(
  '/:id',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  couponController.getCouponById,
);

/**
 * @route   POST /api/v1/coupons
 * @desc    Create new coupon code
 * @access  Admin & Super Admin
 */
couponRouter.post(
  '/',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: couponZodSchema.createCouponSchema,
  }),
  couponController.createCoupon,
);

/**
 * @route   PATCH /api/v1/coupons/:id
 * @desc    Update coupon details
 * @access  Admin & Super Admin
 */
couponRouter.patch(
  '/:id',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: couponZodSchema.updateCouponSchema,
  }),
  couponController.updateCoupon,
);

/**
 * @route   DELETE /api/v1/coupons/:id
 * @desc    Soft-delete coupon
 * @access  Admin & Super Admin
 */
couponRouter.delete(
  '/:id',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  couponController.deleteCoupon,
);

export default couponRouter;

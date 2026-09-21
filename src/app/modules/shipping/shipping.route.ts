import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/request.validator';
import { USER_ROLE } from '../user/user.constant';
import { shippingController } from './shipping.controller';
import shippingZodSchema from './shipping.zod';

const shippingRouter = Router();

// ── Public Storefront Endpoints ──────────────────────────────────────────────
/**
 * @route   GET /api/v1/shipping
 * @desc    Get active shipping configuration for storefront/cart banners
 * @access  Public
 */
shippingRouter.get('/', shippingController.getShippingSettings);

/**
 * @route   GET /api/v1/shipping/calculate
 * @desc    Calculate shipping fee for a given subtotal
 * @access  Public
 */
shippingRouter.get('/calculate', shippingController.calculateShipping);

// ── Admin Protected Endpoints ────────────────────────────────────────────────
/**
 * @route   PATCH /api/v1/shipping
 * @desc    Update shipping settings
 * @access  Admin & Super Admin
 */
shippingRouter.patch(
  '/',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: shippingZodSchema.updateShippingSettingSchema,
  }),
  shippingController.updateShippingSettings,
);

/**
 * @route   GET /api/v1/shipping/admin
 * @desc    Get shipping settings with audit details
 * @access  Admin & Super Admin
 */
shippingRouter.get(
  '/admin',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  shippingController.getShippingSettings,
);

/**
 * @route   PATCH /api/v1/shipping/admin
 * @desc    Update shipping settings from admin path
 * @access  Admin & Super Admin
 */
shippingRouter.patch(
  '/admin',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: shippingZodSchema.updateShippingSettingSchema,
  }),
  shippingController.updateShippingSettings,
);

export default shippingRouter;

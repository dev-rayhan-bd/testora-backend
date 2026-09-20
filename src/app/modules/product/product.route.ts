import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/request.validator';
import { USER_ROLE } from '../user/user.constant';
import { productController } from './product.controller';
import productZodSchema from './product.zod';

const productRouter = Router();

// ── Public Storefront Endpoints ──────────────────────────────────────────────
/**
 * @route   GET /api/v1/products
 * @desc    Public storefront product list with filtering, searching, price range, and pagination
 * @access  Public (Only returns active products)
 */
productRouter.get(
  '/',
  validateRequest({
    query: productZodSchema.getProductsQuerySchema,
  }),
  productController.getAllProducts,
);

/**
 * @route   POST /api/v1/products/check-stock
 * @desc    Helper for checkout / cart to verify inventory availability
 * @access  Public
 */
productRouter.post(
  '/check-stock',
  validateRequest({
    body: productZodSchema.checkStockAvailabilitySchema,
  }),
  productController.checkStockAvailability,
);

// ── Admin Dashboard & Management Endpoints (Secured) ─────────────────────────
/**
 * @route   GET /api/v1/products/admin/all
 * @desc    Admin listing of all products including drafts, hidden, and low-stock alerts
 * @access  Admin & Super Admin
 */
productRouter.get(
  '/admin/all',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    query: productZodSchema.getProductsQuerySchema,
  }),
  productController.getAllProductsAdmin,
);

/**
 * @route   POST /api/v1/products
 * @desc    Create a new product
 * @access  Admin & Super Admin
 */
productRouter.post(
  '/',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: productZodSchema.createProductSchema,
  }),
  productController.createProduct,
);

/**
 * @route   PATCH /api/v1/products/:id/restore
 * @desc    Restore a soft-deleted product
 * @access  Admin & Super Admin
 */
productRouter.patch(
  '/:id/restore',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  productController.restoreProduct,
);

/**
 * @route   PATCH /api/v1/products/:id
 * @desc    Update an existing product
 * @access  Admin & Super Admin
 */
productRouter.patch(
  '/:id',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: productZodSchema.updateProductSchema,
  }),
  productController.updateProduct,
);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Soft-delete a product
 * @access  Admin & Super Admin
 */
productRouter.delete(
  '/:id',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  productController.deleteProduct,
);

/**
 * @route   GET /api/v1/products/:idOrSlug
 * @desc    Get single product by Mongo ObjectId or unique slug
 * @access  Public (Active products) / Admin (Any status)
 */
productRouter.get(
  '/:idOrSlug',
  productController.getProductDetails,
);

export default productRouter;

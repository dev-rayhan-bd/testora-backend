import { Router } from 'express';
import { uploadFile } from '../../../helpers/fileuploader';
import authMiddleware from '../../middlewares/auth.middleware';
import {
  validateFormDataRequest,
  validateRequest,
} from '../../middlewares/request.validator';
import { validateFileSizes } from '../../middlewares/validateFileSize';
import { USER_ROLE } from '../user/user.constant';
import { categoryController } from './category.controller';
import categoryZodSchema from './category.zod';

const categoryRouter = Router();

// ── Public Storefront Endpoints ──────────────────────────────────────────────
/**
 * @route   GET /api/v1/categories
 * @desc    Get active categories with product count for navigation & filter menus
 * @access  Public
 */
categoryRouter.get('/', categoryController.getAllCategories);

/**
 * @route   GET /api/v1/categories/:idOrSlug
 * @desc    Get single category details
 * @access  Public
 */
categoryRouter.get('/:idOrSlug', categoryController.getCategoryByIdOrSlug);

// ── Admin Management Endpoints ────────────────────────────────────────────────
/**
 * @route   POST /api/v1/categories
 * @desc    Create new product category with optional image upload
 * @access  Admin & Super Admin
 */
categoryRouter.post(
  '/',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  uploadFile(),
  validateFileSizes,
  validateFormDataRequest(categoryZodSchema.createCategorySchema),
  categoryController.createCategory,
);

/**
 * @route   GET /api/v1/categories/admin/all
 * @desc    Admin view of all categories (including inactive)
 * @access  Admin & Super Admin
 */
categoryRouter.get(
  '/admin/all',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  categoryController.getAllCategories,
);

/**
 * @route   PATCH /api/v1/categories/:id
 * @desc    Update category info, image, or status
 * @access  Admin & Super Admin
 */
categoryRouter.patch(
  '/:id',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  uploadFile(),
  validateFileSizes,
  validateFormDataRequest(categoryZodSchema.updateCategorySchema),
  categoryController.updateCategory,
);

/**
 * @route   DELETE /api/v1/categories/:id
 * @desc    Soft-delete category with product association guard
 * @access  Admin & Super Admin
 */
categoryRouter.delete(
  '/:id',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  categoryController.deleteCategory,
);

export default categoryRouter;

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import { productService } from './product.service';

// ── 1. Create Product (Admin) ────────────────────────────────────────────────
const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const result = await productService.createProduct(req.body, files);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Product created successfully',
    data: result,
  });
});

// ── 2. Get All Products (Storefront / Public) ────────────────────────────────
const getAllProducts = asyncHandler(async (req: Request, res: Response) => {
  // Storefront always strictly filters for active products only (never shows drafts)
  const result = await productService.getAllProducts(req.query, false);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Products retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

// ── 3. Get All Products (Admin View) ─────────────────────────────────────────
const getAllProductsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await productService.getAllProducts(req.query, true);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Admin products list retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

// ── 4. Get Single Product (By ID or Slug) ────────────────────────────────────
const getProductDetails = asyncHandler(async (req: Request, res: Response) => {
  const idOrSlug = req.params.idOrSlug as string;
  // If user is admin, allow viewing draft/hidden products
  const isAdmin =
    req.user &&
    (req.user.role === 'admin' || req.user.role === 'super-admin');

  const result = await productService.getProductByIdOrSlug(idOrSlug, !!isAdmin);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Product details retrieved successfully',
    data: result,
  });
});

// ── 5. Update Product (Admin) ────────────────────────────────────────────────
const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const result = await productService.updateProduct(id, req.body, files);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Product updated successfully',
    data: result,
  });
});

// ── 6. Soft Delete Product (Admin) ───────────────────────────────────────────
const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await productService.deleteProduct(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Product soft-deleted successfully',
    data: result,
  });
});

// ── 7. Restore Soft-Deleted Product (Admin) ──────────────────────────────────
const restoreProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await productService.restoreProduct(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Product restored successfully',
    data: result,
  });
});

// ── 8. Check Stock Availability (Storefront / Checkout Helper) ───────────────
const checkStockAvailability = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId, quantity, variantId } = req.body;
    const result = await productService.checkStockAvailability(
      productId,
      Number(quantity),
      variantId,
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: result.isAvailable
        ? 'Requested stock is available'
        : 'Requested stock is not available',
      data: result,
    });
  },
);

export const productController = {
  createProduct,
  getAllProducts,
  getAllProductsAdmin,
  getProductDetails,
  updateProduct,
  deleteProduct,
  restoreProduct,
  checkStockAvailability,
};

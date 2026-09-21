import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import { categoryService } from './category.service';

const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files || req.file) as any;
  const result = await categoryService.createCategory(req.body, files);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Category created successfully',
    data: result,
  });
});

const getAllCategories = asyncHandler(async (req: Request, res: Response) => {
  const isAdmin =
    (req.user && (req.user.role === 'admin' || req.user.role === 'super-admin')) ||
    Boolean(req.originalUrl && req.originalUrl.includes('/admin'));

  const result = await categoryService.getAllCategories(req.query, isAdmin);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Categories retrieved successfully',
    meta: {
      page: result.meta.page,
      limit: result.meta.limit,
      total: result.meta.total,
      totalPages: result.meta.totalPage,
    },
    data: result.data,
  });
});

const getCategoryByIdOrSlug = asyncHandler(
  async (req: Request, res: Response) => {
    const idOrSlug = req.params.idOrSlug as string;
    const isAdmin =
      (req.user && (req.user.role === 'admin' || req.user.role === 'super-admin')) ||
      Boolean(req.originalUrl && req.originalUrl.includes('/admin'));

    const result = await categoryService.getCategoryByIdOrSlug(idOrSlug, isAdmin);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Category retrieved successfully',
      data: result,
    });
  },
);

const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const files = (req.files || req.file) as any;
  const result = await categoryService.updateCategory(id, req.body, files);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Category updated successfully',
    data: result,
  });
});

const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await categoryService.deleteCategory(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Category deleted successfully',
    data: result,
  });
});

export const categoryController = {
  createCategory,
  getAllCategories,
  getCategoryByIdOrSlug,
  updateCategory,
  deleteCategory,
};

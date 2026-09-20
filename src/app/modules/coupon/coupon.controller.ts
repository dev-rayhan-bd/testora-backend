import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import { couponService } from './coupon.service';

const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const result = await couponService.createCoupon(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Coupon created successfully',
    data: result,
  });
});

const getAllCoupons = asyncHandler(async (req: Request, res: Response) => {
  const isAdmin =
    req.user && (req.user.role === 'admin' || req.user.role === 'super-admin');

  const result = await couponService.getAllCoupons(req.query, !!isAdmin);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Coupons retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getCouponById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await couponService.getCouponById(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Coupon details retrieved successfully',
    data: result,
  });
});

const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await couponService.updateCoupon(id, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Coupon updated successfully',
    data: result,
  });
});

const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await couponService.deleteCoupon(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Coupon deleted successfully',
    data: result,
  });
});

const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code, orderAmount } = req.body;
  const result = await couponService.validateAndCalculateDiscount(
    code,
    Number(orderAmount),
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Coupon applied successfully',
    data: result,
  });
});

export const couponController = {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
};

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import config from '../../../config';
import jwtHelpers from '../../../helpers/jwtHelpers';
import User from '../user/user.model';
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
  let isAdmin =
    req.user && (req.user.role === 'admin' || req.user.role === 'super-admin');
  let userId = req.user?._id ? String(req.user._id) : undefined;

  // If token is provided in header but req.user was not populated
  if (!req.user && req.headers.authorization) {
    try {
      const token = req.headers.authorization.replace('Bearer ', '').trim();
      if (token) {
        const decoded = jwtHelpers.verifyToken(token, config.jwt_access_token_secret!) as any;
        if (decoded?.id || decoded?._id) {
          const user = await User.findById(decoded.id || decoded._id).select('-password');
          if (user) {
            req.user = user;
            isAdmin = user.role === 'admin' || user.role === 'super-admin';
            userId = String(user._id);
          }
        }
      }
    } catch {
      // Ignore token verification errors for public endpoints
    }
  }

  // Requests mounted or routed under /admin are treated as admin dashboard requests
  if (req.originalUrl && req.originalUrl.includes('/admin/')) {
    isAdmin = true;
  }

  const result = await couponService.getAllCoupons(req.query, !!isAdmin, userId);

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
  const userId = req.user?._id ? String(req.user._id) : undefined;
  const result = await couponService.validateAndCalculateDiscount(
    code,
    Number(orderAmount),
    userId,
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

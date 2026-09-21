import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import { shippingService } from './shipping.service';

const getShippingSettings = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await shippingService.getShippingSettings();

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Shipping settings retrieved successfully',
      data: result,
    });
  },
);

const updateShippingSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = req.user?._id ? String(req.user._id) : undefined;
    const result = await shippingService.updateShippingSettings(
      req.body,
      adminId,
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Shipping settings updated successfully',
      data: result,
    });
  },
);

const calculateShipping = asyncHandler(async (req: Request, res: Response) => {
  const subtotal = Number(req.query.subtotal || req.body.subtotal || 0);
  const result = await shippingService.calculateShippingFee(subtotal);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shipping fee calculated successfully',
    data: result,
  });
});

export const shippingController = {
  getShippingSettings,
  updateShippingSettings,
  calculateShipping,
};

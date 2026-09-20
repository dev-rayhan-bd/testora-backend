import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import { orderService } from './order.service';

const createCheckoutOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user._id.toString();
  const idempotencyHeader = req.headers['idempotency-key'] as string | undefined;

  const result = await orderService.createCheckoutOrder(
    userId,
    req.body,
    idempotencyHeader,
  );

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message:
      result.paymentMethod === 'stripe'
        ? 'Checkout initiated successfully. Please complete payment via the provided URL.'
        : 'Order placed successfully with Cash on Delivery.',
    data: result,
  });
});

const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user._id.toString();
  const result = await orderService.getMyOrders(userId, req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Your order history retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getOrderDetails = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id?.toString();
  const isAdmin =
    req.user && (req.user.role === 'admin' || req.user.role === 'super-admin');

  const result = await orderService.getOrderDetails(id as string, userId, !!isAdmin);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Order details retrieved successfully',
    data: result,
  });
});

const getAllOrdersAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.getAllOrdersAdmin(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'All customer orders retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await orderService.updateOrderStatus(id, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Order status updated to '${result.orderStatus}' successfully`,
    data: result,
  });
});

const addTrackingInfo = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await orderService.addTrackingInfo(id, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Courier tracking information added successfully',
    data: result,
  });
});

const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user?._id?.toString();
  const isAdmin =
    req.user && (req.user.role === 'admin' || req.user.role === 'super-admin');
  const reason = req.body.reason || 'Cancelled by customer';

  const result = await orderService.cancelOrder(id, userId, !!isAdmin, reason);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Order cancelled successfully and inventory restored',
    data: result,
  });
});

const refundOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await orderService.refundOrder(id, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Order refunded successfully and inventory adjusted',
    data: result,
  });
});

export const orderController = {
  createCheckoutOrder,
  getMyOrders,
  getOrderDetails,
  getAllOrdersAdmin,
  updateOrderStatus,
  addTrackingInfo,
  cancelOrder,
  refundOrder,
};

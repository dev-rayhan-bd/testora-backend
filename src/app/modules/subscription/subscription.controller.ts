import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import asyncHandler from "../../../shared/asynchandler";
import sendResponse from "../../../shared/sendResponse";
import { subscriptionService } from "./subscription.service";

// ── 1. App: Record In-App Purchase ──────────────────────────────────────────
const recordInAppPurchase = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any)._id || (req.user as any).id;
    const result = await subscriptionService.recordInAppPurchase(
      userId,
      req.body
    );

    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: "In-app purchase recorded and subscription activated successfully",
      data: result,
    });
  }
);

// ── 2. App: Get Current Active Subscription ─────────────────────────────────
const getMySubscription = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)._id || (req.user as any).id;
  const result = await subscriptionService.getMySubscription(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Active subscription retrieved successfully",
    data: result,
  });
});

// ── 3. Admin: Stats Overview ────────────────────────────────────────────────
const getSubscriptionOverview = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await subscriptionService.getSubscriptionOverview();

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Subscription overview metrics retrieved successfully",
      data: result,
    });
  }
);

// ── 4. Admin: Filtered & Paginated Subscription List ─────────────────────────
const getAllSubscriptions = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await subscriptionService.getAllSubscriptions(req.query);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Subscriptions list retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }
);

// ── 5. Admin: Update Subscription Status / Extend ────────────────────────────
const updateSubscriptionStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await subscriptionService.updateSubscriptionStatus(
      id as string,
      req.body
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Subscription status updated successfully",
      data: result,
    });
  }
);

export const subscriptionController = {
  recordInAppPurchase,
  getMySubscription,
  getSubscriptionOverview,
  getAllSubscriptions,
  updateSubscriptionStatus,
};
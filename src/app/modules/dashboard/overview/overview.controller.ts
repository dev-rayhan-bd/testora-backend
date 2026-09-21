import { Request, Response } from "express";
import asyncHandler from "../../../../shared/asynchandler";
import sendResponse from "../../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";
import { overviewUserService } from "./overview.service";

// ── Complete Aggregation Overview ──────────────────────────────────────────
const getCompleteOverviewIntoDb = asyncHandler(async (req: Request, res: Response) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const result = await overviewUserService.getCompleteDashboardOverview(year);
  res.set('Cache-Control', 'no-store');
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Admin dashboard overview data retrieved successfully',
    data: result,
  });
});

// ── Standalone / Legacy Endpoints ──────────────────────────────────────────
const getRecentUsersIntoDb = asyncHandler(async (req: Request, res: Response) => {
  const result = await overviewUserService.getRecentUsers();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.length > 0 ? 'Recent users data has been retrieved successfully' : 'No recent users found',
    data: result,
  });
});

const getUserGrowthIntoDb = asyncHandler(async (req: Request, res: Response) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const result = await overviewUserService.getUserGrowth(year);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User growth data has been retrieved successfully',
    data: result,
  });
});

const getStatsOverviewIntoDb = asyncHandler(async (req: Request, res: Response) => {
  const result = await overviewUserService.getStatsOverview();
  res.set('Cache-Control', 'no-store');
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Stats overview has been retrieved successfully',
    data: result,
  });
});

export const overviewController = {
  getCompleteOverviewIntoDb,
  getRecentUsersIntoDb,
  getUserGrowthIntoDb,
  getStatsOverviewIntoDb,
};
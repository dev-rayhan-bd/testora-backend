import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from "../../../shared/asynchandler";
import sendResponse from "../../../shared/sendResponse";
import { userDashboardService } from "./user.dashboard.service";


const getExamReadiness = asyncHandler(async (req: Request, res: Response) => {
    const result = await userDashboardService.getExamReadiness(req.user);
    // console.log(result);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Exam readiness data fetched successfully',
        data: result,
    });
});


const getInProgressSessions = asyncHandler(async (req: Request, res: Response) => {
    const result = await userDashboardService.getInProgressSessions(req.user);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'InProgress sessions fetched successfully',
        data: result,
    });
});

const getRecentActivity = asyncHandler(async (req: Request, res: Response) => {
    const result = await userDashboardService.getRecentActivity(req.user);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Recent activity fetched successfully',
        data: result,
    });
});

const getSubscriptionPlan = asyncHandler(async (req: Request, res: Response) => {
    const result = await userDashboardService.getSubscription(req.user);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Subscription plan fetched successfully',
        data: result,
    });
});

const getWeakTopics = asyncHandler(async (req: Request, res: Response) => {
    const result = await userDashboardService.getWeakTopics(req.user);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Weak topics data fetched successfully',
        data: result,
    });
});

const getPlatformStats = asyncHandler(async (req: Request, res: Response) => {
    const result = await userDashboardService.getPlatformStats();
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Platform stats fetched successfully',
        data: result,
    });
});


export const userDashboardController = {
    getExamReadiness,
    getInProgressSessions,
    getRecentActivity,
    getSubscriptionPlan,
    getWeakTopics,
    getPlatformStats
};


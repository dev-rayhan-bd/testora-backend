import { Request, Response } from "express";
import asyncHandler from "../../../../shared/asynchandler";
import sendResponse from "../../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";
import { userManagementService } from "./user.management.service";


const getUserStatsIntoDb = asyncHandler(async (req: Request, res: Response) => {
    const result = await userManagementService.getUserStats();
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'User stats retrieved successfully',
        data: result,
    });
});

const getAllUsersIntoDb = asyncHandler(async (req: Request, res: Response) => {
    const result = await userManagementService.getAllUsers(req.query);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Users retrieved successfully',
        meta: result.meta,
        data: result.data,
    });
});

const updateUserStatusIntoDb = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const result = await userManagementService.updateUserStatus(id as string, status);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'User status updated successfully',
        data: result,
    });
});

const getUserByIdIntoDb = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await userManagementService.getUserById(id as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'User details retrieved successfully',
        data: result,
    });
});

export const userManagementController = {
  getUserStatsIntoDb,
  getAllUsersIntoDb,
  updateUserStatusIntoDb,
  getUserByIdIntoDb,
};
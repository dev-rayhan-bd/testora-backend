import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import asyncHandler from "../../../shared/asynchandler";
import sendResponse from "../../../shared/sendResponse";
import { facultyService } from "./faculty.service";



const createFacultyIntodb = asyncHandler(async (req: Request, res: Response) => {
    const result = await facultyService.createFaculty(req.body);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Faculty created successfully.",
        data: result,
    });
});


const getAllFaculties = asyncHandler(async (req: Request, res: Response) => {
    const result = await facultyService.getAllFaculties(req.user);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Faculty retrieved successfully.",
        data: result,
    });
});

const getAllFacultiesDashboard = asyncHandler(async (req: Request, res: Response) => {
    const result = await facultyService.getAllFacultiesDashboard(req.query);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Faculties retrieved successfully.",
        data: result,
    });
});

const updateFaculty = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await facultyService.updateFaculty(id as string, req.body);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Faculty updated successfully.",
        data: result,
    });
});

const deleteFaculty = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await facultyService.deleteFaculty(id as string);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Faculty deleted successfully.",
        data: result,
    });
});

export const facultyController = {
    createFacultyIntodb,
    getAllFaculties,
    getAllFacultiesDashboard,
    updateFaculty,
    deleteFaculty,
};
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import asyncHandler from "../../../shared/asynchandler";
import sendResponse from "../../../shared/sendResponse";
import { departmentService } from "./department.service";


const createDepartmentIntodb = asyncHandler(async (req: Request, res: Response) => {
    const { faculty } = req.params;
    const result = await departmentService.createDepartmentUnderFaculty(req.body, faculty as string);
    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Department created successfully.",
        data: result,
    });
});


const getAllDepartments = asyncHandler(async (req: Request, res: Response) => {
    const { facultyId } = req.params;
    const result = await departmentService.getAllDepartmentByfaculty(req.user, facultyId as string);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Department retrieved successfully.",
        data: result,
    });
});

const getAllDepartmentsDashboard = asyncHandler(async (req: Request, res: Response) => {
    const result = await departmentService.getAllDepartmentsDashboard(req.query);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Departments retrieved successfully.",
        data: result,
    });
});

const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await departmentService.updateDepartment(id as string, req.body);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Department updated successfully.",
        data: result,
    });
});

const deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await departmentService.deleteDepartment(id as string);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Department deleted successfully.",
        data: result,
    });
});

export const departmentController = {
    createDepartmentIntodb,
    getAllDepartments,
    getAllDepartmentsDashboard,
    updateDepartment,
    deleteDepartment,
};
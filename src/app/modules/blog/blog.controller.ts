
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import asyncHandler from "../../../shared/asynchandler";
import sendResponse from "../../../shared/sendResponse";
import { blogService } from "./blog.service";
import { BlogFiles } from "./blog.interface";



const createBlogIntoDb = asyncHandler(async (req: Request, res: Response) => {
    const result = await blogService.createBlog(req.body, req.files as BlogFiles);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Blog created successfully.",
        data: result,
    });
});


const updateBlogIntoDb = asyncHandler(async (req: Request, res: Response) => {
    const result = await blogService.updateBlog(req.params.id as string, req.body, req.files as BlogFiles);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Blog updated successfully.",
        data: result,
    });
});


const getAllBlogsFromDb = asyncHandler(async (req: Request, res: Response) => {
    const result = await blogService.getAllBlogs(req.query);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Blogs retrieved successfully.",
        data: result,
    });
})

const getAllBlogDetailsFromDb = asyncHandler(async (req: Request, res: Response) => {
    const result = await blogService.getBlogDetails(req.params.id as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Blog details retrieved successfully.",
        data: result,
    });
})

const getBlogDetailsBySlugFromDb = asyncHandler(async (req: Request, res: Response) => {
    const result = await blogService.getBlogDetailsBySlug(req.params.slug as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Blog details retrieved successfully.",
        data: result,
    });
})

const deleteBlogFromDb = asyncHandler(async (req: Request, res: Response) => {
    const result = await blogService.deleteBlog(req.params.id as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Blog deleted successfully.",
        data: result,
    });
})

export const blogController = {
    createBlogIntoDb,
    updateBlogIntoDb,
    getAllBlogsFromDb,
    getAllBlogDetailsFromDb,
    getBlogDetailsBySlugFromDb,
    deleteBlogFromDb
};
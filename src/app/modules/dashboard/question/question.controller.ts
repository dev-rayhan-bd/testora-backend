import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import asyncHandler from "../../../../shared/asynchandler";
import sendResponse from "../../../../shared/sendResponse";
import { PassageFiles } from "../../passage/passage.interface";
import { dashboardQuestionService } from "./question.service";
import { TQuestionListInput, TTestListInput } from "./question.zod";




const getQuestionOverview = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.getQuestionOverview();
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Question overview retrieved successfully.",
        data: result,
    });
});

const getAllQuestions = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.getAllQuestions(req.query as unknown as TQuestionListInput);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Questions retrieved successfully.",
        meta: result.meta,
        data: result.questions,
    });
});

const getQuestionById = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.getQuestionById(req.params.questionId as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Question retrieved successfully.",
        data: result,
    });
});

const getAllTestArchiveIntoDashboard = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.getAllTestArchive(req.query as unknown as TTestListInput);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Test archive retrieved successfully.",
        meta: result.meta,
        data: result.tests,
    });
});


const createPassage = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.createPassage(req.body, req.files as PassageFiles);
    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Passage created successfully.",
        data: result,
    });
});


const getPassages = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.getPassages(req.query);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Passages retrieved successfully.",
        meta: result.meta,
        data: result.data,
    });
});

const importTestsFromCsvIntoDb = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const uploadedFile = files?.csv_file?.[0];

    if (!uploadedFile) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: "File upload is required (.csv or .xlsx)",
        });
    }

    const { summary, test, questions } = await dashboardQuestionService.importTestsFromFile(uploadedFile.buffer);
     console.log("Import Summary:", summary); // Log the summary for debugging
     console.log("Import Summary:", test, !test); // Log the summary for debugging
    if (summary.errors.length > 0 || !test) {
        return sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: false,
            message: "Validation completed with errors. No data was imported.",
            data: { summary },
        });
    }

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Test and questions imported successfully.",
        data: { summary, test, questions },
    });
});

// ── Question CRUD Handlers ───────────────────────────────────────────────────

const createQuestion = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const result = await dashboardQuestionService.createQuestion(req.body, files);
    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Question created successfully.",
        data: result,
    });
});

const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const result = await dashboardQuestionService.updateQuestion(req.params.questionId as string, req.body, files);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Question updated successfully.",
        data: result,
    });
});

const updateQuestionStatus = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.updateQuestionStatus(
        req.params.questionId as string,
        req.body.status
    );
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Question status updated successfully.",
        data: result,
    });
});

const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.deleteQuestion(req.params.questionId as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Question deleted successfully.",
        data: result,
    });
});

// ── Passage CRUD Handlers ────────────────────────────────────────────────────

const getPassageById = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.getPassageById(req.params.passageId as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Passage retrieved successfully.",
        data: result,
    });
});

const updatePassage = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as PassageFiles | undefined;
    const result = await dashboardQuestionService.updatePassage(req.params.passageId as string, req.body, files);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Passage updated successfully.",
        data: result,
    });
});

const togglePassageStatus = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.togglePassageStatus(req.params.passageId as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Passage status updated successfully.",
        data: result,
    });
});

const deletePassage = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.deletePassage(req.params.passageId as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Passage removed successfully.",
        data: result,
    });
});

// ── Test Archive Handlers ────────────────────────────────────────────────────

const createTest = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.createTest(req.body);
    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Test created successfully.",
        data: result,
    });
});

const getTestById = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.getTestById(req.params.testId as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Test retrieved successfully.",
        data: result,
    });
});

const updateTest = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.updateTest(req.params.testId as string, req.body);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Test updated successfully.",
        data: result,
    });
});

const updateTestStatus = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.updateTestStatus(req.params.testId as string, req.body.status);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Test status updated successfully.",
        data: result,
    });
});

const deleteTest = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.deleteTest(req.params.testId as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Test deleted successfully.",
        data: result,
    });
});

const duplicateTest = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.duplicateTest(req.params.testId as string, req.body);
    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Test duplicated successfully.",
        data: result,
    });
});

const copyYearQuestions = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.copyYearQuestions(
        req.body.sourceTestId,
        req.body.targetTestId
    );
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: result.message,
        data: result,
    });
});

// ── Meta Filters Handler ─────────────────────────────────────────────────────

const getQuestionMetaFilters = asyncHandler(async (req: Request, res: Response) => {
    const result = await dashboardQuestionService.getQuestionMetaFilters();
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Question meta filters retrieved successfully.",
        data: result,
    });
});

export const dashboardQuestionController = {
    getQuestionOverview,
    getAllQuestions,
    getQuestionById,
    createQuestion,
    updateQuestion,
    updateQuestionStatus,
    deleteQuestion,
    getAllTestArchiveIntoDashboard,
    createTest,
    getTestById,
    updateTest,
    updateTestStatus,
    deleteTest,
    duplicateTest,
    copyYearQuestions,
    createPassage,
    getPassages,
    getPassageById,
    updatePassage,
    togglePassageStatus,
    deletePassage,
    importTestsFromCsvIntoDb,
    getQuestionMetaFilters,
};
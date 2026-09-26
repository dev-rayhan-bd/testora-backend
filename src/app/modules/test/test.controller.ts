import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import asyncHandler from "../../../shared/asynchandler";
import sendResponse from "../../../shared/sendResponse";
import { testService } from "./test.service";

const createTest = asyncHandler(async (req: Request, res: Response) => {
  const result = await testService.createTest(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Test created successfully.",
    data: result,
  });
});

const importTestsFromCsvIntoDb = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const csvFile = files?.csv_file?.[0];

  if (!csvFile) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "CSV file upload is required",
    });
  }

  // Delegate the CSV import work to the service layer.
  const result = await testService.importTestsFromCsvFile(csvFile.buffer);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Test and questions imported successfully.",
    data: result,
  });
});


const getAllOfficialTestsIntoDb = asyncHandler(async (req: Request, res: Response) => {

  const { departments, page, limit } = req.query;

  const result = await testService.getAllOfficialTests(
    {
      examType: req.user.plan as string,
      faculty: req.user.faculty as string,
      departments: departments as string[],
      language: req.user.language as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    } as any);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.data.length > 0 ? "Official tests fetched successfully." : "No official tests found.",
    meta: result.meta,
    data: result.data,
  });
});

const getAllAdditionalTestsIntoDb = asyncHandler(async (req: Request, res: Response) => {
  const { departments, page, limit } = req.query;
  const result = await testService.getAllAdditionalTests({
    examType: req.user.plan as string,
    faculty: req.user.faculty as string,
    departments: departments as string[],
    language: req.user.language as string,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
  } as any);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.data.length > 0 ? "Additional tests fetched successfully." : "No additional tests found.",
    meta: result.meta,
    data: result.data,
  });
});

const getQuestionsByTestIdIntoDb = asyncHandler(async (req: Request, res: Response) => {
  const { testId } = req.params;

  const result = await testService.getQuestionsByTestId(testId as string, req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.data.length > 0
      ? "Questions fetched successfully for this test."
      : "No questions found matching your criteria.",
    meta: result.meta,
    data: {
      testTitle: result.testTitle,
      questions: result.data
    },
  });
});


const getYearRange = asyncHandler(async (req: Request, res: Response) => {
  const result = await testService.getYearRange(req.user.plan as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Year range retrieved successfully.",
    data: result,
  });
});

const getTestById = asyncHandler(async (req: Request, res: Response) => {
  const result = await testService.getTestById(req.params.id as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Test fetched successfully.",
    data: result,
  });
});

const getTestWithQuestions = asyncHandler(async (req: Request, res: Response) => {
  const result = await testService.getTestWithQuestions(req.params.id as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Test with questions fetched successfully.",
    data: result,
  });
});

// admin — question bank filter করে linkable questions দেখবে
const getLinkableQuestions = asyncHandler(async (req: Request, res: Response) => {
  const result = await testService.getLinkableQuestions(
    req.params.id as string,
    req.query
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Linkable questions fetched successfully.",
    data: result,
  });
});

const linkQuestions = asyncHandler(async (req: Request, res: Response) => {
  const result = await testService.linkQuestions(
    req.params.id as string,
    req.body.questionIds
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Questions linked successfully.",
    data: result,
  });
});

const removeQuestion = asyncHandler(async (req: Request, res: Response) => {
  const result = await testService.removeQuestion(
    req.params.id as string,
    req.params.questionId as string
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Question removed successfully.",
    data: result,
  });
});

const reorderQuestions = asyncHandler(async (req: Request, res: Response) => {
  const result = await testService.reorderQuestions(
    req.params.id as string,
    req.body.questionIds
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Questions reordered successfully.",
    data: result,
  });
});

const publishTest = asyncHandler(async (req: Request, res: Response) => {
  const result = await testService.publishTest(req.params.id as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Test published successfully.",
    data: result,
  });
});

const updateTest = asyncHandler(async (req: Request, res: Response) => {
  const result = await testService.updateTest(req.params.id as string, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Test updated successfully.",
    data: result,
  });
});

const deleteTest = asyncHandler(async (req: Request, res: Response) => {
  await testService.deleteTest(req.params.id as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Test deleted successfully.",
  });
});

export const testController = {
  createTest,
  importTestsFromCsvIntoDb,
  getAllOfficialTestsIntoDb,
  getAllAdditionalTestsIntoDb,
  getQuestionsByTestIdIntoDb,
  getTestById,
  getTestWithQuestions,
  getLinkableQuestions,
  linkQuestions,
  getYearRange,
  removeQuestion,
  reorderQuestions,
  publishTest,
  updateTest,
  deleteTest,
};
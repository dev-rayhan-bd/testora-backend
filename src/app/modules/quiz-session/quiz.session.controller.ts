import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import asyncHandler from "../../../shared/asynchandler";
import sendResponse from "../../../shared/sendResponse";
import { BadRequestError } from "../../errors/request/apiError";
import { quizSessionService } from "./quiz.session.service";


const getOfficialQuizzes = asyncHandler(async (req: Request, res: Response) => {
  console.log(req.query)
  const result = await quizSessionService.getOfficialQuizzes(req.user,req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Quiz fetched successfully.",
    meta: result.meta,
    data: result.data,
  });
});

const getAdditionalQuizzes = asyncHandler(async (req: Request, res: Response) => {
  const result = await quizSessionService.getAdditionalQuizzes(req.user,req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Quiz fetched successfully.",
    meta: result.meta,
    data: result.data,
  });
});



const getYearRange = asyncHandler(async (req: Request, res: Response) => {
  const result = await quizSessionService.getYearRange();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Year range retrieved successfully.",
    data: result,
  });
});

const getMandatorySubjects = asyncHandler(async (req: Request, res: Response) => {
  const { testId } = req.params;
  const result = await quizSessionService.getMandatorySubjects(req.user, testId as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Mandatory subjects retrieved successfully.",
    data: result,
  });
});


const startFullSimulationQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { testId } = req.params;
  const result = await quizSessionService.startFullSimulationQuiz(req.user, testId as string, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Full simulation quiz started successfully.",
    data: result,
  });
});

const startQuiz = asyncHandler(async (req: Request, res: Response) => {
  const result = await quizSessionService.startQuiz(req.user, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Quiz started successfully.",
    data: result,
  });
});

const completeQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const result = await quizSessionService.completeQuiz(sessionId as string, req.user);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Quiz completed successfully.",
    data: result,
  });
});

const getQuizSummary = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const result = await quizSessionService.getQuizSummary(sessionId as string, req.user._id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Quiz summary retrieved successfully.",
    data: result,
  });
});

const getReviewQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { index } = req.body;
  if (!index) {
    throw new BadRequestError("Question index is required.");
  }
  const result = await quizSessionService.getQuestionReview(sessionId as string, req.user._id, Number(index));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Quiz review retrieved successfully.",
    data: result,
  });
});

const getSessionStatus = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const result = await quizSessionService.getSessionStatus(sessionId as string, req.user._id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Session status retrieved successfully.",
    data: result,
  });
});

const getQuizMapIntodb = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const result = await quizSessionService.getQuizMap(sessionId as string, req.user._id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Quiz map retrieved successfully.",
    data: result,
  });
});

export const quizSessionController = {
  getOfficialQuizzes,
  getAdditionalQuizzes,
  startQuiz,
  completeQuiz,
  getReviewQuiz,
  getYearRange,
  getSessionStatus,
  startFullSimulationQuiz,
  getQuizMapIntodb,
  getQuizSummary,
  getMandatorySubjects
}
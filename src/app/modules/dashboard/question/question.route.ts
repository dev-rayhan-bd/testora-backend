import { Router } from "express";
import { uploadFile } from "../../../../helpers/fileuploader";
import authMiddleware from "../../../middlewares/auth.middleware";
import { validateFormDataRequest, validateRequest } from "../../../middlewares/request.validator";
import { validateFileSizes } from "../../../middlewares/validateFileSize";
import { USER_ROLE } from "../../user/user.constant";
import { dashboardQuestionController } from "./question.controller";
import questionQueryValidationZodSchema from "./question.zod";
import { subjectController } from "../../subject/subject.controller";
import subjectValidationZodSchema from "../../subject/subject.zod";

const dashboardQuestionRouter = Router();

// ── 1. Overview & Meta Filters ───────────────────────────────────────────────

dashboardQuestionRouter.get(
  "/overview",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.getQuestionOverview
);

dashboardQuestionRouter.get(
  "/meta-filters",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.getQuestionMetaFilters
);

// ── 1.1 Subjects Management ─────────────────────────────────────────────────

dashboardQuestionRouter.get(
  "/subjects",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    query: subjectValidationZodSchema.getSubjectQuerySchema,
  }),
  subjectController.getAllSubjects
);

dashboardQuestionRouter.post(
  "/subjects/add",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    body: subjectValidationZodSchema.createSubjectSchema,
  }),
  subjectController.createSubjectIntodb
);

dashboardQuestionRouter.patch(
  "/subjects/:id",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    body: subjectValidationZodSchema.updateSubjectSchema,
  }),
  subjectController.updateSubject
);

dashboardQuestionRouter.delete(
  "/subjects/:id",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  subjectController.deleteSubject
);

// ── 2. Passages Management (Must come before /:questionId routes) ────────────

dashboardQuestionRouter.get(
  "/passages",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.getPassages
);

dashboardQuestionRouter.post(
  "/passage/add",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  uploadFile(),
  validateFileSizes,
  validateFormDataRequest(questionQueryValidationZodSchema.passageSchema),
  dashboardQuestionController.createPassage
);

dashboardQuestionRouter.get(
  "/passage/:passageId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.getPassageById
);

dashboardQuestionRouter.patch(
  "/passage/:passageId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  uploadFile(),
  validateFileSizes,
  dashboardQuestionController.updatePassage
);

dashboardQuestionRouter.patch(
  "/passage/:passageId/status",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.togglePassageStatus
);

dashboardQuestionRouter.delete(
  "/passage/:passageId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.deletePassage
);

dashboardQuestionRouter.delete(
  "/passages/:passageId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.deletePassage
);

// ── 3. Test Archive Management (Must come before /:questionId routes) ────────

dashboardQuestionRouter.get(
  "/test-archive",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    query: questionQueryValidationZodSchema.testListValidation,
  }),
  dashboardQuestionController.getAllTestArchiveIntoDashboard
);

dashboardQuestionRouter.post(
  "/test-archive/create",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    body: questionQueryValidationZodSchema.createDashboardTestSchema,
  }),
  dashboardQuestionController.createTest
);

dashboardQuestionRouter.get(
  "/test-archive/:testId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.getTestById
);

dashboardQuestionRouter.patch(
  "/test-archive/:testId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    body: questionQueryValidationZodSchema.updateDashboardTestSchema,
  }),
  dashboardQuestionController.updateTest
);

dashboardQuestionRouter.patch(
  "/test-archive/:testId/status",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    body: questionQueryValidationZodSchema.updateTestStatusSchema,
  }),
  dashboardQuestionController.updateTestStatus
);

dashboardQuestionRouter.delete(
  "/test-archive/:testId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.deleteTest
);

dashboardQuestionRouter.delete(
  "/tests/:testId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.deleteTest
);

dashboardQuestionRouter.delete(
  "/test/:testId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.deleteTest
);

dashboardQuestionRouter.post(
  "/test-archive/:testId/duplicate",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    body: questionQueryValidationZodSchema.duplicateTestSchema,
  }),
  dashboardQuestionController.duplicateTest
);

dashboardQuestionRouter.post(
  "/test-archive/copy-year",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    body: questionQueryValidationZodSchema.copyYearSchema,
  }),
  dashboardQuestionController.copyYearQuestions
);

// ── 4. Import CSV ────────────────────────────────────────────────────────────

dashboardQuestionRouter.post(
  "/import-csv",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  uploadFile(),
  dashboardQuestionController.importTestsFromCsvIntoDb
);

// ── 5. Question Bank Management ──────────────────────────────────────────────

dashboardQuestionRouter.get(
  "/",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    query: questionQueryValidationZodSchema.questionListValidation,
  }),
  dashboardQuestionController.getAllQuestions
);

dashboardQuestionRouter.post(
  "/add",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  uploadFile(),
  validateFileSizes,
  dashboardQuestionController.createQuestion
);

dashboardQuestionRouter.post(
  "/",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  uploadFile(),
  validateFileSizes,
  dashboardQuestionController.createQuestion
);

dashboardQuestionRouter.get(
  "/single/:questionId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.getQuestionById
);

dashboardQuestionRouter.patch(
  "/:questionId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  uploadFile(),
  validateFileSizes,
  dashboardQuestionController.updateQuestion
);

dashboardQuestionRouter.patch(
  "/:questionId/status",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    body: questionQueryValidationZodSchema.updateQuestionStatusSchema,
  }),
  dashboardQuestionController.updateQuestionStatus
);

dashboardQuestionRouter.delete(
  "/:questionId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.deleteQuestion
);

dashboardQuestionRouter.delete(
  "/question/:questionId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.deleteQuestion
);

dashboardQuestionRouter.delete(
  "/questions/:questionId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.deleteQuestion
);

dashboardQuestionRouter.delete(
  "/delete/:questionId",
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  dashboardQuestionController.deleteQuestion
);

export default dashboardQuestionRouter;
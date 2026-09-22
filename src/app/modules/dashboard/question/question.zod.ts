import z from "zod";
import { ACCESS_TYPES, EXAM_TYPES, TEST_TYPES } from "../../../../interfaces";
import { QUERSTION_DIFFICULTY, QUERSTION_STATUS } from "../../question/question.constant";

export const questionListValidation = z.object({
  // pagination
  page: z.coerce
    .number()
    .int({ message: "Page must be an integer" })
    .min(1, { message: "Page must be at least 1" })
    .optional()
    .default(1),

  limit: z.coerce
    .number()
    .int({ message: "Limit must be an integer" })
    .min(1, { message: "Limit must be at least 1" })
    .max(100, { message: "Limit cannot exceed 100" })
    .optional()
    .default(20),

  // search
  searchTerm: z
    .string({ message: "Search term must be a string" })
    .trim()
    .optional(),

  // filters
  examType: z
    .enum(["semi_matura", "matura", "provime"], {
      message: "Exam type must be semi_matura, matura or provime",
    })
    .optional(),

  year: z.coerce
    .number({ message: "Year must be a number" })
    .int({ message: "Year must be an integer" })
    .min(2000, { message: "Year must be 2000 or later" })
    .max(new Date().getFullYear() + 5, { message: "Year cannot exceed reasonable future range" })
    .optional(),

  subjectName: z
    .string({ message: "Subject must be a string" })
    .trim()
    .optional(),

  questionText: z
    .string({ message: "Question text must be a string" })
    .trim()
    .optional(),

  facultyName: z
    .string({ message: "Faculty must be a string" })
    .trim()
    .optional(),

  departmentName: z
    .string({ message: "Department must be a string" })
    .trim()
    .optional(),

  passageId: z
    .string({ message: "Passage ID must be a string" })
    .regex(/^[a-f\d]{24}$/i, { message: "Passage ID must be a valid ObjectId" })
    .optional(),

  access: z
    .enum(["free", "premium"], {
      message: "Access must be free or premium",
    })
    .optional(),

  difficultyLevel: z
    .enum(["easy", "medium", "hard"], {
      message: "Difficulty level must be easy, medium or hard",
    })
    .optional(),

  status: z
    .enum(["published", "draft", "hidden", "archived"], {
      message: "Status must be published, draft, hidden or archived",
    })
    .optional(),
});



export const testListValidation = z.object({
  // pagination
  page: z.coerce
    .number()
    .int({ message: "Page must be an integer" })
    .min(1, { message: "Page must be at least 1" })
    .optional()
    .default(1),

  limit: z.coerce
    .number()
    .int({ message: "Limit must be an integer" })
    .min(1, { message: "Limit must be at least 1" })
    .max(100, { message: "Limit cannot exceed 100" })
    .optional()
    .default(20),

  // search
  searchTerm: z
    .string({ message: "Search term must be a string" })
    .trim()
    .optional(),

  // filters
  examType: z
    .enum(["semi_matura", "matura", "provime"], {
      message: "Exam type must be semi_matura, matura or provime",
    })
    .optional(),

  year: z.coerce
    .number({ message: "Year must be a number" })
    .int({ message: "Year must be an integer" })
    .min(2000, { message: "Year must be 2000 or later" })
    .max(new Date().getFullYear() + 5, { message: "Year cannot exceed reasonable future range" })
    .optional(),

  subjectName: z
    .string({ message: "Subject must be a string" })
    .trim()
    .optional(),


  facultyName: z
    .string({ message: "Faculty must be a string" })
    .trim()
    .optional(),

  departmentName: z
    .string({ message: "Department must be a string" })
    .trim()
    .optional(),

  title: z
    .string({ message: "Title must be a string" })
    .trim()
    .optional(),

  testCode: z
    .string({ message: "Test code must be a string" })
    .trim()
    .optional(),

  testType: z
    .enum(["official", "additional"], {
      message: "Test type must be official or additional",
    })
    .optional(),
  access: z
    .enum(["free", "premium"], {
      message: "Access must be free or premium",
    })
    .optional(),

  status: z
    .enum(["published", "draft"], {
      message: "Status must be published or draft",
    })
    .optional(),
});


export const passageSchema = z.object({
  passageCode: z.string({ message: "Passage code is required" }),
  title: z.string({ message: "Title is required" }),
  content: z.string({ message: "Content is required" }),
})


const csvQuestionOptionSchema = z.object({
  text: z.string({ message: "Option text is required" }).min(1, { message: "Option text cannot be empty" }),
  imageUrl: z.string({ message: "Option image URL must be a string" }).optional(),
});

export const importTestCsvRowSchema = z.object({
  testCode: z.string({ message: "testCode must be a string" }).optional(),
  testName: z.string({ message: "testName is required" }).optional(),
  examType: z.enum([EXAM_TYPES.ENTRANCE_EXAM, EXAM_TYPES.MATURA, EXAM_TYPES.SEMI_MATURA], { message: "Invalid exam type" }),
  year: z.coerce.number({ message: "Year is required" }).int({ message: "Year must be an integer" }).min(2000, { message: "Year must be 2000 or later" }).max(new Date().getFullYear(), { message: "Year cannot be in the future" }),
  testType: z.enum([TEST_TYPES.OFFICIAL, TEST_TYPES.ADDITIONAL], { message: "Test type must be official or additional" }),
  access: z.enum([ACCESS_TYPES.FREE, ACCESS_TYPES.PREMIUM], { message: "Invalid access type" }),
  questionText: z.string({ message: "Question text is required" }).min(1, { message: "Question text cannot be empty" }),
  questionImageUrl: z.string({ message: "Question image URL must be a string" }).optional(),
  options: z.array(csvQuestionOptionSchema, { message: "Options must be an array" }).min(2, { message: "At least 2 options are required" }).max(4, { message: "Maximum 4 options allowed" }),
  correctOptionIndex: z.coerce.number({ message: "Correct option index is required" }).int({ message: "Correct option index must be an integer" }).min(0, { message: "Correct option index must be 0 or greater" }).max(3, { message: "Correct option index must be 3 or less" }),
  explanation: z.string({ message: "Explanation must be a string" }).optional(),
  status: z.enum([QUERSTION_STATUS.DRAFT, QUERSTION_STATUS.PUBLISHED], { message: "Invalid question status" }).default(QUERSTION_STATUS.PUBLISHED),
  faculty: z.string({ message: "Faculty is required for provime" }).optional(),
  isMandatory: z.coerce.boolean({ message: "isMandatory must be a boolean" }).optional(),
  departments: z.array(z.string({ message: "Department must be a string" })).optional(),
  subject: z.string({ message: "Subject is required for semi_matura or matura" }).optional(),
  passage: z.string({ message: "Passage must be a string" }).optional(),
}).refine((data) => data.correctOptionIndex < data.options.length, {
  message: "correctOptionIndex is out of range",
  path: ["correctOptionIndex"],
}).superRefine((data, ctx) => {
  if (data.examType === EXAM_TYPES.ENTRANCE_EXAM) {
    if (!data.faculty) {
      ctx.addIssue({ code: "custom", path: ["faculty"], message: "Faculty is required when exam type is provime" });
    }
    if (!data.departments || data.departments.length === 0) {
      ctx.addIssue({ code: "custom", path: ["departments"], message: "At least one department is required when exam type is provime" });
    }
    if (data.departments && new Set(data.departments).size !== data.departments.length) {
      ctx.addIssue({ code: "custom", path: ["departments"], message: "Department IDs must be unique when exam type is provime" });
    }
  }

  if (data.examType === EXAM_TYPES.MATURA || data.examType === EXAM_TYPES.SEMI_MATURA) {
    if (!data.subject) {
      ctx.addIssue({ code: "custom", path: ["subject"], message: "Subject is required when exam type is semi_matura or matura" });
    }
    if (data.faculty) {
      ctx.addIssue({ code: "custom", path: ["faculty"], message: "Faculty is not allowed when exam type is semi_matura or matura" });
    }
    if (data.departments && data.departments.length > 0) {
      ctx.addIssue({ code: "custom", path: ["departments"], message: "Departments are not allowed when exam type is semi_matura or matura" });
    }
  }
});

export const updatePassageSchema = z.object({
  passageCode: z.string().trim().optional(),
  title: z.string().trim().optional(),
  content: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
});

const questionOptionSchema = z.object({
  text: z.string({ message: "Option text is required" }).min(1, { message: "Option text cannot be empty" }),
  imageUrl: z.string().optional(),
});

export const createDashboardQuestionSchema = z.object({
  examType: z.enum([EXAM_TYPES.ENTRANCE_EXAM, EXAM_TYPES.MATURA, EXAM_TYPES.SEMI_MATURA], {
    message: "Invalid exam type",
  }),
  year: z.coerce
    .number({ message: "Year is required" })
    .int()
    .min(2000)
    .max(new Date().getFullYear() + 5),
  questionText: z.string({ message: "Question text is required" }).min(1),
  questionImageUrl: z.string().optional(),
  options: z.array(questionOptionSchema).min(2).max(4),
  correctOptionIndex: z.coerce.number().int().min(0).max(3),
  explanation: z.string().optional(),
  difficultyLevel: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  access: z.enum(["free", "premium"]).optional().default("free"),
  status: z.enum(["published", "draft", "hidden", "archived"]).optional().default("published"),
  subject: z.string().optional(),
  faculty: z.string().optional(),
  departments: z.array(z.string()).optional(),
  passage: z.string().optional(),
  testIds: z.array(z.string()).optional(),
});

export const updateDashboardQuestionSchema = createDashboardQuestionSchema.partial();

export const updateQuestionStatusSchema = z.object({
  status: z.enum(["published", "draft", "hidden", "archived"], {
    message: "Status must be published, draft, hidden, or archived",
  }),
});

export const createDashboardTestSchema = z.object({
  title: z.string({ message: "Test title is required" }).min(1),
  testCode: z.string({ message: "Test code is required" }).min(1),
  examType: z.enum([EXAM_TYPES.ENTRANCE_EXAM, EXAM_TYPES.MATURA, EXAM_TYPES.SEMI_MATURA]),
  year: z.coerce.number().int().min(2000).max(new Date().getFullYear() + 5),
  testType: z.enum([TEST_TYPES.OFFICIAL, TEST_TYPES.ADDITIONAL]),
  access: z.enum([ACCESS_TYPES.FREE, ACCESS_TYPES.PREMIUM]),
  status: z.enum(["published", "draft", "hidden"]).optional().default("published"),
  subject: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  faculty: z.string().optional(),
  departments: z.array(z.string()).optional(),
  questionIds: z.array(z.string()).optional(),
});

export const updateDashboardTestSchema = createDashboardTestSchema.partial();

export const updateTestStatusSchema = z.object({
  status: z.enum(["published", "draft", "hidden"], {
    message: "Status must be published, draft, or hidden",
  }),
});

export const duplicateTestSchema = z.object({
  newTestCode: z.string().trim().optional(),
  newTitle: z.string().trim().optional(),
  newYear: z.coerce.number().int().min(2000).max(new Date().getFullYear() + 5).optional(),
});

export const copyYearSchema = z.object({
  sourceTestId: z.string({ message: "Source test ID is required" }),
  targetTestId: z.string({ message: "Target test ID is required" }),
});

export type TCreatePassagePayload = z.infer<typeof passageSchema>;
export type TUpdatePassagePayload = z.infer<typeof updatePassageSchema>;
export type TQuestionListInput = z.infer<typeof questionListValidation>;
export type TTestListInput = z.infer<typeof testListValidation>;
export type TCreateDashboardQuestionPayload = z.infer<typeof createDashboardQuestionSchema>;
export type TUpdateDashboardQuestionPayload = z.infer<typeof updateDashboardQuestionSchema>;
export type TCreateDashboardTestPayload = z.infer<typeof createDashboardTestSchema>;
export type TUpdateDashboardTestPayload = z.infer<typeof updateDashboardTestSchema>;

const questionQueryValidationZodSchema = {
  questionListValidation,
  testListValidation,
  passageSchema,
  updatePassageSchema,
  createDashboardQuestionSchema,
  updateDashboardQuestionSchema,
  updateQuestionStatusSchema,
  createDashboardTestSchema,
  updateDashboardTestSchema,
  updateTestStatusSchema,
  duplicateTestSchema,
  copyYearSchema,
};

export default questionQueryValidationZodSchema;
import z from "zod";
import { ACCESS_TYPES, EXAM_TYPES, TEST_TYPES } from "../../../interfaces";
import { QUERSTION_DIFFICULTY, QUERSTION_STATUS } from "../question/question.constant";


const createTestSchema = z.object({
    title: z.string({ message: "Title is required" }).min(1, { message: "Title cannot be empty" }),
    examType: z.enum([EXAM_TYPES.ENTRANCE_EXAM, EXAM_TYPES.MATURA, EXAM_TYPES.SEMI_MATURA], { message: "Invalid exam type" }),
    year: z
        .number({ message: "Year is required" })
        .int({ message: "Year must be an integer" })
        .min(2000, { message: "Year must be 2000 or later" })
        .max(new Date().getFullYear(), { message: "Year cannot be in the future" }),
    // structureType: z.string({ message: "Structure type is required" }).min(1, { message: "Structure type cannot be empty" }),
    testType: z.enum([TEST_TYPES.OFFICIAL, TEST_TYPES.ADDITIONAL], { message: "Test type must be official or additional" }),
    access: z.enum([ACCESS_TYPES.FREE, ACCESS_TYPES.PREMIUM], { message: "Access must be free or premium" }).default("free"),
    totalSubjects: z.coerce.number({ message: "Total subjects must be a number" }),
    durationMinutes: z.coerce.number({ message: "Duration minutes must be a number" }).min(1).optional(),
    faculty: z.string({ message: "Faculty ID must be a string" }).optional(),
    departmentss: z.array(z.string({ message: "Department ID must be a string" })).optional(),
    subjectss: z.array(z.string({ message: "Subject ID must be a string" })).optional(),
}).superRefine((data, ctx) => {

    if (data.examType === EXAM_TYPES.SEMI_MATURA || data.examType === EXAM_TYPES.MATURA) {
        if (!data.subjectss || data.subjectss.length === 0) {
            ctx.addIssue({
                code: 'custom',
                maximum: 1,
                origin: 'superRefine',
                inclusive: true,
                path: ['error'],
                message: "Subject ID is required when exam type is semi_matura or matura",
            });
        }
        if (data.departmentss && data.departmentss.length > 0) {
            ctx.addIssue({
                code: 'custom',
                maximum: 1,
                origin: 'superRefine',
                inclusive: true,
                path: ['error'],
                message: "Department ID is not required when exam type is semi_matura or matura",
            });
        }
        if (data.faculty) {
            ctx.addIssue({
                code: 'custom',
                maximum: 1,
                origin: 'superRefine',
                inclusive: true,
                path: ['error'],
                message: "Faculty ID is not required when exam type is semi_matura or matura",
            });
        }
    }

    if (data.examType === EXAM_TYPES.ENTRANCE_EXAM) {
        if (!data.faculty) {
            ctx.addIssue({
                code: 'custom',
                maximum: 1,
                origin: 'superRefine',
                inclusive: true,
                path: ['error'],
                message: "Faculty ID is required when exam type is entrance exam",
            });
        }
        if (!data.departmentss || data.departmentss.length === 0) {
            ctx.addIssue({
                code: 'custom',
                maximum: 1,
                origin: 'superRefine',
                inclusive: true,
                path: ['error'],
                message: "Department ID is required when exam type is entrance exam",
            });
        }

        if (data.subjectss && data.subjectss.length > 0) {
            ctx.addIssue({
                code: 'custom',
                maximum: 1,
                origin: 'superRefine',
                inclusive: true,
                path: ['error'],
                message: "Subject ID is not required when exam type is entrance exam",
            });
        }
    }
});;

const csvQuestionOptionSchema = z.object({
    text: z.string({ message: "Option text is required" }).min(1, { message: "Option text cannot be empty" }),
    imageUrl: z.string({ message: "Option image URL must be a string" }).optional(),
});

export const importTestCsvRowSchema = z.object({
    testCode: z.string({ message: "testCode must be a string" }).optional(),
    testName: z.string({ message: "testName is required" }).optional(),
    examType: z.enum([EXAM_TYPES.ENTRANCE_EXAM, EXAM_TYPES.MATURA, EXAM_TYPES.SEMI_MATURA], { message: "Invalid exam type" }),
    year: z.coerce.number({ message: "Year is required" }).int({ message: "Year must be an integer" }).min(2000, { message: "Year must be 2000 or later" }).max(new Date().getFullYear(), { message: "Year cannot be in the future" }),
    testType: z.literal(TEST_TYPES.OFFICIAL, { message: "Test type must be official" }),
    access: z.enum([ACCESS_TYPES.FREE, ACCESS_TYPES.PREMIUM], { message: "Invalid access type" }),
    questionText: z.string({ message: "Question text is required" }).min(1, { message: "Question text cannot be empty" }),
    questionImageUrl: z.string({ message: "Question image URL must be a string" }).optional(),
    options: z.array(csvQuestionOptionSchema, { message: "Options must be an array" }).min(2, { message: "At least 2 options are required" }).max(4, { message: "Maximum 4 options allowed" }),
    correctOptionIndex: z.coerce.number({ message: "Correct option index is required" }).int({ message: "Correct option index must be an integer" }).min(0, { message: "Correct option index must be 0 or greater" }),
    explanation: z.string({ message: "Explanation must be a string" }).optional(),
    difficultyLevel: z.enum([QUERSTION_DIFFICULTY.EASY, QUERSTION_DIFFICULTY.MEDIUM, QUERSTION_DIFFICULTY.HARD], { message: "Invalid difficulty level" }).default(QUERSTION_DIFFICULTY.EASY),
    status: z.enum([QUERSTION_STATUS.DRAFT, QUERSTION_STATUS.PUBLISHED], { message: "Invalid question status" }).default(QUERSTION_STATUS.PUBLISHED),
    faculty: z.string({ message: "Faculty is required for provime" }).optional(),
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


export type TCreateTestPayload = z.infer<
    typeof createTestSchema
>;

const testValidationZodSchema = {
    createTestSchema,
    importTestCsvRowSchema,
};

export default testValidationZodSchema;
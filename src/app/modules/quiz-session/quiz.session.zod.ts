import z from "zod";
import { EXAM_TYPES, TEST_TYPES } from "../../../interfaces";
import { QUERSTION_DIFFICULTY } from "../question/question.constant";

export const quizSessionSchema = z.object({
    year: z.coerce.number({ message: "Year is required" }).int({ message: "Year must be an integer" }).min(2000, { message: "Year must be 2000 or later" }).max(new Date().getFullYear(), { message: "Year cannot be in the future" }).optional(),
    subjectIds: z.array(z.string({ message: "Subject ID must be a string" })),
    facultyId: z.string({ message: "Faculty is required for provime" }).optional(),
    departmentIds: z.array(z.string({ message: "Department must be a string" })).optional(),
    questionCount: z.coerce.number({ message: "Question count must be a number" }).int({ message: "Question count must be an integer" }).min(1, { message: "Question count must be at least 1" }),
    mode: z.enum(["timed", "untimed"]).optional().default("timed"),
    isTimed: z.boolean().optional(),
    durationMinutes: z.coerce.number().optional(),
});

const fullSimulationSchema = z.object({
    subjects: z.array(z.string({ message: "Subject ID must be a string" })).optional(),
    departments: z.array(z.string({ message: "Department ID must be a string" })).optional(),
    mode: z.enum(["timed", "untimed"]).optional().default("timed"),
    isTimed: z.boolean().optional(),
}).superRefine((data, ctx) => {
    if (data.subjects?.length === 0 && data.departments?.length === 0) {
        ctx.addIssue({
            code: "custom",
            message: "At least one subject must be selected",
        });
    }
});

export type TQuizSessionPayload = z.infer<
    typeof quizSessionSchema
>;

export type TFullSimulationPayload = z.infer<
    typeof fullSimulationSchema
>;

const quizSessionValidationZodSchema = {
    quizSessionSchema,
    fullSimulationSchema
};

export default quizSessionValidationZodSchema;

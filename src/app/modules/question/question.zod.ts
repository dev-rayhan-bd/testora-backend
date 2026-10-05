import { z } from "zod";

// ─── Passage ──────────────────────────────────────────────────

const createPassageSchema = z.object({
  passage_code: z.string({ message: "Passage code is required" }).min(1, {
    message: "Passage code cannot be empty",
  }),
  title: z.string({ message: "Title is required" }).min(1, {
    message: "Title cannot be empty",
  }),
  content: z.string({ message: "Content is required" }).min(1, {
    message: "Content cannot be empty",
  }),
  exam_type: z.enum(["semi_matura", "matura", "provime"], {
    message: "Exam type must be semi_matura, matura or provime",
  }),
  year: z
    .number({ message: "Year is required" })
    .int({ message: "Year must be an integer" })
    .min(2000, { message: "Year must be 2000 or later" })
    .max(new Date().getFullYear(), { message: "Year cannot be in the future" }),
  subject_id: z.string({ message: "Subject ID must be a string" }).optional(),
});

const updatePassageSchema = z.object({
  passage_code: z.string({ message: "Passage code must be a string" }).min(1, {
    message: "Passage code cannot be empty",
  }).optional(),
  title: z.string({ message: "Title must be a string" }).min(1, {
    message: "Title cannot be empty",
  }).optional(),
  content: z.string({ message: "Content must be a string" }).min(1, {
    message: "Content cannot be empty",
  }).optional(),
  exam_type: z.enum(["semi_matura", "matura", "provime"], {
    message: "Exam type must be semi_matura, matura or provime",
  }).optional(),
  year: z
    .number({ message: "Year must be a number" })
    .int({ message: "Year must be an integer" })
    .min(2000, { message: "Year must be 2000 or later" })
    .max(new Date().getFullYear(), { message: "Year cannot be in the future" })
    .optional(),
  subject_id: z.string({ message: "Subject ID must be a string" }).optional(),
});

// ─── Question ─────────────────────────────────────────────────

const optionSchema = z.object({
  text: z.string({ message: "Option text is required" }).min(1, {
    message: "Option text cannot be empty",
  }),
  imageUrl: z
    .url({ message: "Invalid image URL" })
    .optional(),
});

// create question schema
export const createQuestionSchema = z
  .object({
    examType: z.enum(["semi_matura", "matura", "provime"], {
      message: "Exam type must be semi_matura, matura or provime",
    }),
    year: z.coerce
      .number({ message: "Year is required" })
      .int({ message: "Year must be an integer" })
      .min(2000, { message: "Year must be 2000 or later" })
      .max(new Date().getFullYear(), { message: "Year cannot be in the future" }),
    subject: z.string({ message: "Subject ID must be a string" }).optional(),
    faculty: z.string({ message: "Faculty ID must be a string" }).optional(),
    departments: z.array(z.string({ message: "Department ID must be a string" })).optional(),
    passage: z.string({ message: "Passage ID must be a string" }).optional(),
    source: z.enum(["archive", "practice", "both"], {
      message: "Source must be archive, practice or both",
    }).default("both"),
    testType: z.enum(["official", "additional"], {
      message: "Test type must be official or additional",
    }),
    access: z.enum(["free", "premium"], {
      message: "Access must be free or premium",
    }),
    questionText: z.string({ message: "Question text is required" }).min(1, {
      message: "Question text cannot be empty",
    }),
    questionImageUrl: z
      .url({ message: "Invalid image URL" })
      .optional(),
    options: z
      .array(optionSchema, { message: "Options must be an array" })
      .min(2, { message: "At least 2 options are required" })
      .max(4, { message: "Maximum 4 options allowed" }),
    correctOptionIndex: z.coerce
      .number({ message: "Correct option index is required" })
      .int({ message: "Correct option index must be an integer" })
      .min(0, { message: "Correct option index must be 0 or greater" }),
    explanation: z.string({ message: "Explanation must be a string" }).optional(),
    explanationImageUrl: z.string().optional(),
    status: z.enum(["draft", "published"], {
      message: "Status must be draft or published",
    }).default("draft"),
  })
  .refine((data) => data.correctOptionIndex < data.options.length, {
    message: "correctOptionIndex is out of range",
    path: ["correctOptionIndex"],
  }).superRefine((data, ctx) => {

    if (data.examType === "semi_matura" || data.examType === "matura") {
      if (!data.subject) {
        ctx.addIssue({
          code: 'custom',
          maximum: 1,
          origin: 'superRefine',
          inclusive: true,
          path: ['error'],
          message: "Subject ID is required when exam type is semi_matura or matura",
        });
      }
      if (data.departments || data.faculty) {
        ctx.addIssue({
          code: 'custom',
          maximum: 1,
          origin: 'superRefine',
          inclusive: true,
          path: ['error'],
          message: "Department ID or Faculty ID is not required when exam type is semi_matura or matura",
        });
      }
    }

    if (data.examType === "provime") {
      if (!data.faculty) {
        ctx.addIssue({
          code: 'custom',
          maximum: 1,
          origin: 'superRefine',
          inclusive: true,
          path: ['error'],
          message: "Faculty ID is required when exam type is provime",
        });
      }
      if (!data.departments) {
        ctx.addIssue({
          code: 'custom',
          maximum: 1,
          origin: 'superRefine',
          inclusive: true,
          path: ['error'],
          message: "Department ID is required when exam type is provime",
        });
      }

      if (data.subject) {
        ctx.addIssue({
          code: 'custom',
          maximum: 1,
          origin: 'superRefine',
          inclusive: true,
          path: ['error'],
          message: "Subject ID is not required when exam type is provime",
        });
      }
    }
  });

const updateQuestionSchema = z
  .object({
    examType: z.enum(["semi_matura", "matura", "provime"], {
      message: "Exam type must be semi_matura, matura or provime",
    }).optional(),
    year: z
      .number({ message: "Year must be a number" })
      .int({ message: "Year must be an integer" })
      .min(2000, { message: "Year must be 2000 or later" })
      .max(new Date().getFullYear(), { message: "Year cannot be in the future" })
      .optional(),
    subjects: z.string({ message: "Subject ID must be a string" }).optional(),
    faculty: z.string({ message: "Faculty ID must be a string" }).optional(),
    departments: z.string({ message: "Department ID must be a string" }).optional(),
    passage: z.string({ message: "Passage ID must be a string" }).optional(),
    source: z.enum(["archive", "practice", "both"], {
      message: "Source must be archive, practice or both",
    }).optional(),
    testType: z.enum(["official", "additional"], {
      message: "Test type must be official or additional",
    }).optional(),
    access: z.enum(["free", "premium"], {
      message: "Access must be free or premium",
    }).optional(),
    questionText: z.string({ message: "Question text must be a string" }).min(1, {
      message: "Question text cannot be empty",
    }).optional(),
    questionImageUrl: z
      .url({ message: "Invalid image URL" })
      .optional(),
    options: z
      .array(optionSchema, { message: "Options must be an array" })
      .min(2, { message: "At least 2 options are required" })
      .max(4, { message: "Maximum 4 options allowed" })
      .optional(),
    correctOptionIndex: z
      .number({ message: "Correct option index must be a number" })
      .int({ message: "Correct option index must be an integer" })
      .min(0, { message: "Correct option index must be 0 or greater" })
      .optional(),
    explanation: z.string({ message: "Explanation must be a string" }).optional(),
    explanationImageUrl: z.string().optional(),
    status: z.enum(["draft", "published"], {
      message: "Status must be draft or published",
    }).optional(),
  })
  .refine(
    (data) => {
      if (data.correctOptionIndex !== undefined && data.options !== undefined) {
        return data.correctOptionIndex < data.options.length;
      }
      return true;
    },
    {
      message: "correctOptionIndex is out of range",
      path: ["correctOptionIndex"],
    }
  );



export type TCreateQuestionPayload = z.infer<
  typeof createQuestionSchema
>;

const questionValidationZodSchema = {
  createQuestionSchema,
  updateQuestionSchema
};

export default questionValidationZodSchema;
import z from "zod";


const createSubjectSchema = z.object({
  name: z.string({ message: "Subject name must be a string" }).min(1, {
    message: "Subject name cannot be empty",
  }),
  examType: z.enum(["semi_matura", "matura", "provime"], {
    message: "Exam type must be semi_matura, matura or provime",
  }),
  nameInEnglish: z.string().optional(),
  nameInAlbanian: z.string().optional(),
  isElective: z.boolean().optional().default(false),
});

const updateSubjectSchema = createSubjectSchema.partial();

const getSubjectQuerySchema = z.object({
  examType: z.enum(["semi_matura", "matura", "provime", "all"]).optional(),
  searchTerm: z.string().optional(),
});

const getSubjectsByDepartmentsSchema = z.object({
   departments : z.array(z.string().min(1, {
    message: "Department ID cannot be empty",
  }))
});

export type TCreateSubjectPayload = z.infer<
  typeof createSubjectSchema
>;

export type TUpdateSubjectPayload = z.infer<
  typeof updateSubjectSchema
>;

export type TGetSubjectQueryPayload = z.infer<
  typeof getSubjectQuerySchema
>;


const subjectValidationZodSchema = {
  createSubjectSchema,
  updateSubjectSchema,
  getSubjectQuerySchema,
  getSubjectsByDepartmentsSchema
};

export default subjectValidationZodSchema;
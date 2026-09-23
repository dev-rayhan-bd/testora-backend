import z from "zod";

const createFacultySchema = z.object({
    name: z.string({ message: "Faculty name must be a string" }).min(1, {
        message: "Faculty name cannot be empty",
    }),
    nameInEnglish: z.string().optional(),
    nameInAlbanian: z.string().optional(),
});

const updateFacultySchema = createFacultySchema.partial();

const getFacultyQuerySchema = z.object({
    examType: z.enum(["semi_matura", "matura", "provime"], {
        message: "Exam type must be semi_matura, matura or provime",
    }),
});

const getAllFacultiesDashboardQuerySchema = z.object({
    searchTerm: z.string().optional(),
});

export type TCreateFacultyPayload = z.infer<
    typeof createFacultySchema
>;

export type TGetFacultyQueryPayload = z.infer<
    typeof getFacultyQuerySchema
>;

const facultyValidationZodSchema = {
    createFacultySchema,
    updateFacultySchema,
    getFacultyQuerySchema,
    getAllFacultiesDashboardQuerySchema,
};

export default facultyValidationZodSchema;
import z from "zod";

const createDepartmentSchema = z.object({
    name: z.string({ message: "Department name must be a string" }).min(1, {
        message: "Department name cannot be empty",
    }),
    nameInEnglish: z.string().optional(),
    nameInAlbanian: z.string().optional(),
});

const updateDepartmentSchema = createDepartmentSchema.partial();

const getDepartmentQuerySchema = z.object({
    examType: z.enum(["semi_matura", "matura", "provime"], {
        message: "Exam type must be semi_matura, matura or provime",
    }),
});

const getAllDepartmentsDashboardQuerySchema = z.object({
    searchTerm: z.string().optional(),
    faculty: z.string().optional(),
});

export type TCreateDepartmentPayload = z.infer<
    typeof createDepartmentSchema
>;

export type TGetDepartmentQueryPayload = z.infer<
    typeof getDepartmentQuerySchema
>;

const departmentValidationZodSchema = {
    createDepartmentSchema,
    updateDepartmentSchema,
    getDepartmentQuerySchema,
    getAllDepartmentsDashboardQuerySchema,
};

export default departmentValidationZodSchema;
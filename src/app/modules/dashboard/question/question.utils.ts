import mongoose, { Types } from "mongoose";
import * as XLSX from "xlsx";
import { EXAM_TYPES, TAccessTypes } from "../../../../interfaces";
import { BadRequestError } from "../../../errors/request/apiError";
import Department from "../../department/department.model";
import Faculty from "../../faculty/faculty.model";
import Passage from "../../passage/passage.model";
import Question from "../../question/question.model";
import Subject from "../../subject/subject.model";
import Test from "../../test/test.model";
import { importTestCsvRowSchema } from "./question.zod";

// export type NormalizedImportRow = {
//     testCode: string;
//     testName: string;
//     examType: string;
//     year: number;
//     source: string;
//     testType: string;
//     access: TAccessTypes;
//     questionText: string;
//     questionImageUrl?: string;
//     options: { text: string; imageUrl?: string }[];
//     correctOptionIndex: number;
//     explanation?: string;
//     difficultyLevel?: string;
//     status?: string;
//     faculty?: string;
//     departments?: string[];
//     subject?: string;
//     passage?: string;
// };

// const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");
// const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// export const readCsvRows = async (fileBuffer: Buffer) => {
//     // Read the CSV buffer as a stream.
//     const rows: Record<string, unknown>[] = [];
//     const stream = Readable.from([fileBuffer.toString("utf8")]);

//     await new Promise<void>((resolve, reject) => {
//         // Parse each CSV row into an object.
//         stream
//             .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
//             .on("data", (row) => rows.push(row))
//             .on("end", resolve)
//             .on("error", reject);
//     });

//     return rows;
// };

// export const getRowValue = (
//     row: Record<string, unknown>,
//     candidates: string | string[]
// ) => {
//     // Normalize candidates to a set of headers we accept (supports single string for simpler CSVs).
//     const candidateSet = new Set(
//         (Array.isArray(candidates) ? candidates : [candidates]).map((c) => normalizeHeader(c))
//     );

//     // Pick the first matching column value from the row.
//     for (const [key, value] of Object.entries(row)) {
//         const normalizedKey = normalizeHeader(key);
//         if (!candidateSet.has(normalizedKey)) continue;

//         if (value === undefined || value === null) {
//             return undefined;
//         }

//         const text = String(value).trim();
//         return text.length > 0 && text.toLowerCase() !== "null" ? text : undefined;
//     }

//     return undefined;
// };


// export const getRowValuesByPrefix = (row: Record<string, unknown>, prefix: string) => {
//     // Collect repeated columns like department[0], department[1].
//     const values = Object.entries(row)
//         .filter(([key, value]) => normalizeHeader(key).startsWith(prefix) && value !== undefined && value !== null)
//         .map(([, value]) => String(value).trim())
//         .filter((value) => value.length > 0 && value.toLowerCase() !== "null");

//     return [...new Set(values)];
// };

// export const resolveDocumentId = async (
//     model: any,
//     rawValue: string,
//     extraQuery: Record<string, unknown> = {}
// ) => {
//     // Resolve a human-readable code or name to a MongoDB ObjectId.
//     const value = rawValue.trim();
//     console.log({ value })
//     const orConditions: Array<Record<string, unknown>> = [
//         { name: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
//         { slug: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
//         { passageCode: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
//     ];

//     if (mongoose.isValidObjectId(value)) {
//         orConditions.unshift({ _id: value });
//     }

//     const doc = await model.findOne({
//         ...extraQuery,
//         $or: orConditions,
//     }).select("_id");

//     if (doc?._id || model.modelName !== "Department" || Object.keys(extraQuery).length === 0) {
//         return doc?._id ?? null;
//     }

//     // If the faculty-scoped lookup fails, retry by name/slug only so a valid department label
//     // in the CSV does not fail just because the faculty filter is too strict.
//     const fallbackDoc = await model.findOne({
//         $or: orConditions,
//     }).select("_id");
//     return fallbackDoc?._id ?? null;
// };

// export const resolveSubjectId = async (rawValue: string, examType: string) => {
//     // Resolve subjects by exam type so identical names in different exams do not collide.
//     const value = rawValue.trim();
//     const orConditions: Array<Record<string, unknown>> = [
//         { name: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
//         { slug: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
//     ];

//     if (mongoose.isValidObjectId(value)) {
//         orConditions.unshift({ _id: value });
//     }

//     const doc = await Subject.findOne({
//         examType,
//         isActive: true,
//         $or: orConditions,
//     }).select("_id");

//     return doc?._id ?? null;
// };

// // Build the question context (faculty, department, subject, passage) based on the exam type and CSV row data.
// export const buildQuestionContext = async (row: NormalizedImportRow) => {
//     // Resolve the question ownership fields from the exam type.
//     console.log(`Building question context for exam type: ${row.examType}`);
//     if (row.examType === EXAM_TYPES.ENTRANCE_EXAM) {
//         const facultyId = await resolveDocumentId(Faculty, row.faculty ?? "");
//         if (!facultyId) {
//             throw new BadRequestError(`Faculty not found: ${row.faculty ?? "empty"}`);
//         }

//         const departmentIds = await Promise.all(
//             (row.departments ?? []).map(async (department) => {
//                 const departmentId = await resolveDocumentId(Department, department, {
//                     faculty: facultyId,
//                     examType: EXAM_TYPES.ENTRANCE_EXAM,
//                 });
//                 if (!departmentId) {
//                     throw new BadRequestError(`Department not found: ${department}`);
//                 }

//                 return departmentId;
//             })
//         );
//         if (departmentIds.length === 0) {
//             throw new BadRequestError("At least one valid department is required for entrance exam questions");
//         }
//         const subjectId = await resolveSubjectId(row.subject ?? "", row.examType);
//         if (!subjectId) {
//             throw new BadRequestError(`Subject not found: ${row.subject ?? "empty"}`);
//         }
//         const passageId = row.passage ? await resolveDocumentId(Passage, row.passage, { faculty: facultyId }) : null;
//         console.log({ passageId })
//         return {
//             faculty: facultyId,
//             subject: subjectId,
//             departments: departmentIds,
//             passage: passageId ?? undefined,
//         };
//     }

//     const subjectId = await resolveSubjectId(row.subject ?? "", row.examType);
//     if (!subjectId) {
//         throw new BadRequestError(`Subject not found: ${row.subject ?? "empty"}`);
//     }

//     const passageId = row.passage ? await resolveDocumentId(Passage, row.passage) : null;
//     console.log({ passageId })
//     return {
//         subject: subjectId,
//         passage: passageId ?? undefined,
//     };
// };

// // Validate the CSV row based on the exam type requirements.
// export const normalizeImportRow = (row: Record<string, unknown>) => {
//     // Convert a raw CSV row into the schema-friendly payload.
//     return {
//         testCode: getRowValue(row, "testcode") ?? "",
//         testName: getRowValue(row, "testname") ?? "",
//         examType: getRowValue(row, "examtype") ?? "",
//         year: Number(getRowValue(row, "year") ?? 0),
//         source: getRowValue(row, "source") ?? "",
//         testType: getRowValue(row, "testtype") ?? "",
//         access: getRowValue(row, "access") ?? "",
//         questionText: getRowValue(row, "questiontext") ?? "",
//         questionImageUrl: getRowValue(row, "questionimageurl"),
//         options: [0, 1, 2, 3]
//             .map((optionIndex) => {
//                 const optionText = getRowValue(row, `option${optionIndex}text`);
//                 const optionImage = getRowValue(row, `option${optionIndex}imageurl`);

//                 return optionText ? { text: optionText, imageUrl: optionImage } : null;
//             })
//             .filter((option): option is { text: string; imageUrl: string | undefined } => option !== null),
//         correctOptionIndex: Number(getRowValue(row, "correctoptionindex") ?? 0),
//         explanation: getRowValue(row, "explanation"),
//         difficultyLevel: getRowValue(row, "difficultylevel"),
//         status: getRowValue(row, "status"),
//         faculty: getRowValue(row, "faculty"),
//         departments: getRowValuesByPrefix(row, "department"),
//         subject: getRowValue(row, "subject"),
//         passage: getRowValue(row, "passage"),
//     };
// };


export type NormalizedImportRow = {
    testCode: string;
    testName: string;
    examType: string;
    year: number;
    source: string;
    testType: string;
    access: TAccessTypes;
    questionText: string;
    questionImageUrl?: string;
    isMandatory?: boolean;
    options: { text: string; imageUrl?: string }[];
    correctOptionIndex: number;
    explanation?: string;
    explanationImageUrl?: string;
    difficultyLevel?: string;
    status?: string;
    faculty?: string;
    departments?: string[];
    subject?: string;
    passage?: string;
};

// Resolved DB references (faculty/department/subject/passage) for a single row.
export type ResolvedRowContext = {
    subject?: Types.ObjectId | null;
    faculty?: Types.ObjectId | null;
    departments?: Types.ObjectId[];
    passage?: Types.ObjectId | null;

};

// One fully-validated row plus its resolved references, ready to be written to the DB.
export type ValidatedRow = {
    row: NormalizedImportRow;
    rowNumber: number; // 1-based row number in the source file, used in messages
    context: ResolvedRowContext;
    isMandatory?: boolean;
};

export type ImportIssue = {
    row: number; // 1-based row number in the source file; 0 = file-level issue
    level: "error" | "warning";
    message: string;
};

// Summary returned to the client describing the outcome of the import attempt.
export type ImportValidationSummary = {
    totalRows: number;
    validRows: number;
    warnings: ImportIssue[];
    errors: ImportIssue[];
};


const toMongooseRefs = (context: ResolvedRowContext) => ({
    subject: context.subject ?? undefined,
    faculty: context.faculty ?? undefined,
    passage: context.passage ?? undefined,
});

const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Read tabular rows from an uploaded file buffer (.csv, .xlsx, or .xls).
 * SheetJS parses all three formats into the same worksheet structure,
 * so a single code path handles every supported format.
 */
export const readTabularRows = (fileBuffer: Buffer): Record<string, unknown>[] => {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
        throw new BadRequestError("The uploaded file does not contain any readable data");
    }

    const sheet = workbook.Sheets[firstSheetName];

    // defval: "" -> empty cells become "" instead of being omitted, so every
    // row object has a consistent set of keys.
    // raw: false -> numbers/dates are converted to strings the same way CSV cells would read.
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
    });

    // Trim header whitespace for every row.
    return rows.map((row) => {
        const trimmed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
            trimmed[key.trim()] = value;
        }
        return trimmed;
    });
};

/**
 * Look up a single value from a row by one or more candidate header names
 * (case-insensitive, ignoring non-alphanumeric characters).
 */
export const getRowValue = (
    row: Record<string, unknown>,
    candidates: string | string[]
): string | undefined => {
    const candidateSet = new Set(
        (Array.isArray(candidates) ? candidates : [candidates]).map((c) => normalizeHeader(c))
    );

    for (const [key, value] of Object.entries(row)) {
        const normalizedKey = normalizeHeader(key);
        if (!candidateSet.has(normalizedKey)) continue;

        if (value === undefined || value === null) {
            return undefined;
        }

        const text = String(value).trim();
        return text.length > 0 && text.toLowerCase() !== "null" ? text : undefined;
    }

    return undefined;
};


const parseBooleanCell = (value: string | undefined): boolean | undefined => {
    if (value === undefined) return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === "") return undefined;
    if (["true", "1", "yes", "y", "TRUE"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "FALSE"].includes(normalized)) return false;
    return undefined;
};

/**
 * Collect repeated columns like department[0], department[1], department[2]
 * into a deduplicated array of non-empty values.
 */
export const getRowValuesByPrefix = (row: Record<string, unknown>, prefix: string): string[] => {
    const values = Object.entries(row)
        .filter(([key, value]) => normalizeHeader(key).startsWith(prefix) && value !== undefined && value !== null)
        .map(([, value]) => String(value).trim())
        .filter((value) => value.length > 0 && value.toLowerCase() !== "null");

    return [...new Set(values)];
};

/**
 * Resolve a human-readable code/name (or a valid ObjectId) to a MongoDB document _id.
 * Matches against `name`, `slug`, and `passageCode` (case-insensitive, exact match).
 *
 * Special case: for the Department model, if a faculty-scoped lookup fails,
 * retry without the faculty filter so a valid department label doesn't fail
 * just because the faculty scoping was too strict.
 */
export const resolveDocumentId = async (
    model: any,
    rawValue: string,
    extraQuery: Record<string, unknown> = {}
): Promise<Types.ObjectId | null> => {
    const value = rawValue.trim();

    const orConditions: Array<Record<string, unknown>> = [
        { name: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
        { slug: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
        { passageCode: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
    ];

    if (mongoose.isValidObjectId(value)) {
        orConditions.unshift({ _id: value });
    }

    const doc = await model.findOne({ ...extraQuery, $or: orConditions }).select("_id");

    if (doc?._id || model.modelName !== "Department" || Object.keys(extraQuery).length === 0) {
        return doc?._id ?? null;
    }

    const fallbackDoc = await model.findOne({ $or: orConditions }).select("_id");
    return fallbackDoc?._id ?? null;
};

/**
 * Resolve a subject by name/slug/ObjectId, scoped to the given exam type so
 * identical subject names across different exam types do not collide.
 */
export const resolveSubjectId = async (
    rawValue: string,
    examType: string
): Promise<Types.ObjectId | null> => {
    const value = rawValue.trim();

    const orConditions: Array<Record<string, unknown>> = [
        { name: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
        { slug: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
    ];

    if (mongoose.isValidObjectId(value)) {
        orConditions.unshift({ _id: value });
    }

    const doc = await Subject.findOne({ examType, isActive: true, $or: orConditions }).select("_id");
    return doc?._id ?? null;
};

/**
 * Convert a raw row object (from CSV or Excel, via readTabularRows) into the
 * normalized shape used throughout the importer.
 */
export const normalizeImportRow = (row: Record<string, unknown>): NormalizedImportRow => {
    return {
        testCode: getRowValue(row, "testcode") ?? "",
        testName: getRowValue(row, "testname") ?? "",
        examType: getRowValue(row, "examtype") ?? "",
        year: Number(getRowValue(row, "year") ?? 0),
        source: getRowValue(row, "source") ?? "",
        testType: getRowValue(row, "testtype") ?? "",
        access: (getRowValue(row, "access") ?? "") as TAccessTypes,
        questionText: getRowValue(row, "questiontext") ?? "",
        questionImageUrl: getRowValue(row, "questionimageurl"),
        options: [0, 1, 2, 3]
            .map((optionIndex) => {
                const optionText = getRowValue(row, `option${optionIndex}text`);
                const optionImage = getRowValue(row, `option${optionIndex}imageurl`);
                return optionText ? { text: optionText, imageUrl: optionImage } : null;
            })
            .filter((option): option is { text: string; imageUrl: string | undefined } => option !== null),
        correctOptionIndex: Number(getRowValue(row, "correctoptionindex") ?? 0),
        explanation: getRowValue(row, "explanation"),
        explanationImageUrl: getRowValue(row, "explanationimageurl"),
        status: getRowValue(row, "status"),
        isMandatory: parseBooleanCell(getRowValue(row, "ismandatory")),
        faculty: getRowValue(row, "faculty"),
        departments: getRowValuesByPrefix(row, "department"),
        subject: getRowValue(row, "subject"),
        passage: getRowValue(row, ["passage", "passagecode"]),
    };
};



/* ------------------------------------------------------------------ */
/* Step 1: Per-row schema validation                                    */
/* ------------------------------------------------------------------ */

/**
 * Validate every row's fields using the zod schema, collecting issues
 * instead of throwing on the first failure.
 * Returns only the rows that passed schema validation, with their original row numbers.
 */
export const validateRowSchemas = (
    rawRows: Record<string, unknown>[],
    issues: ImportIssue[]
): { row: NormalizedImportRow; rowNumber: number }[] => {
    const passedRows: { row: NormalizedImportRow; rowNumber: number }[] = [];

    rawRows.forEach((rawRow, index) => {
        const rowNumber = index + 1;
        const normalizedRow = normalizeImportRow(rawRow);
        const validation = importTestCsvRowSchema.safeParse(normalizedRow);

        if (!validation.success) {
            for (const issue of validation.error.issues) {
                issues.push({ row: rowNumber, level: "error", message: issue.message });
            }
            return;
        }

        passedRows.push({ row: validation.data as NormalizedImportRow, rowNumber });
    });

    return passedRows;
};

/* ------------------------------------------------------------------ */
/* Step 2: File-level validation (shared testCode/testName/examType)    */
/* ------------------------------------------------------------------ */

/**
 * Validate constraints that apply across the whole file:
 * - all rows share the same examType
 * - testCode / testName are present and consistent
 * - exam-type-specific structural rules
 *
 * Returns the shared values needed to create/update the Test document,
 * or null if a blocking error prevents the import from proceeding.
 */
export const validateFileLevelRules = (
    allRows: { row: NormalizedImportRow; rowNumber: number }[],
    schemaValidRows: { row: NormalizedImportRow; rowNumber: number }[],
    issues: ImportIssue[]
): { testCode: string; testName: string; firstRow: NormalizedImportRow } | null => {
    if (allRows.length === 0) {
        issues.push({ row: 0, level: "error", message: "No rows found in file" });
        return null;
    }

    // --- testCode: search across ALL normalized rows ---
    const testCode = allRows.find(({ row }) => row.testCode.trim().length > 0)?.row.testCode.trim();
    if (!testCode) {
        issues.push({ row: 0, level: "error", message: "testCode is required in at least one row" });
    } else {
        const mismatched = allRows.find(
            ({ row }) => row.testCode.trim().length > 0 && row.testCode.trim() !== testCode
        );
        if (mismatched) {
            issues.push({ row: mismatched.rowNumber, level: "error", message: "All non-empty testCode values must match" });
        }
    }

    // --- testName: same as testCode ---
    const testName = allRows.find(({ row }) => row.testName.trim().length > 0)?.row.testName.trim();
    if (!testName) {
        issues.push({ row: 0, level: "error", message: "testName is required in at least one row" });
    } else {
        const mismatched = allRows.find(
            ({ row }) => row.testName.trim().length > 0 && row.testName.trim() !== testName
        );
        if (mismatched) {
            issues.push({ row: mismatched.rowNumber, level: "error", message: "All non-empty testName values must match" });
        }
    }

    // --- examType: every row must match the FIRST row's examType. ---
    // Report every mismatched row individually (not just a single generic error).
    const expectedExamType = allRows[0].row.examType;
    for (const { row, rowNumber } of allRows) {
        if (row.examType !== expectedExamType) {
            issues.push({
                row: rowNumber,
                level: "error",
                message: `examType "${row.examType}" does not match the file's examType "${expectedExamType}". All rows must use the same examType.`,
            });
        }
    }

    if (expectedExamType === EXAM_TYPES.MATURA) {
        const someDeclared = allRows.some(({ row }) => row.isMandatory !== undefined);
        if (someDeclared) {
            for (const { row, rowNumber } of allRows) {
                if (row.isMandatory === undefined) {
                    issues.push({
                        row: rowNumber,
                        level: "error",
                        message: "isMandatory must be set on every row once any row in this file declares it",
                    });
                }
            }
        }
    }

    // --- access: every row must match the FIRST row's access ---
    const expectedAccess = allRows[0].row.access;
    for (const { row, rowNumber } of allRows) {
        if (row.access && row.access !== expectedAccess) {
            issues.push({
                row: rowNumber,
                level: "error",
                message: `access "${row.access}" does not match the file's access "${expectedAccess}". All rows must use the same access level.`,
            });
        }
    }

    // --- testType: every row must match the FIRST row's testType ---
    const expectedTestType = allRows[0].row.testType;
    for (const { row, rowNumber } of allRows) {
        if (row.testType && row.testType !== expectedTestType) {
            issues.push({
                row: rowNumber,
                level: "error",
                message: `testType "${row.testType}" does not match the file's testType "${expectedTestType}". All rows must use the same testType.`,
            });
        }
    }

    // --- exam-type-specific structural rules, applied PER ROW based on that row's own examType ---
    for (const entry of schemaValidRows) {
        if (entry.row.examType === EXAM_TYPES.ENTRANCE_EXAM) {
            validateEntranceExamRow(entry, issues);
        } else {
            validateMaturaRow(entry, issues);
        }
    }

    if (issues.some((issue) => issue.level === "error") || !testCode || !testName) {
        return null;
    }

    const firstRow = schemaValidRows[0]?.row;
    if (!firstRow) return null;

    return { testCode, testName, firstRow };
};

// derived subjects

const deriveSubjectGroups = (rows: ValidatedRow[]) => {
    const mandatorySubjectIds = new Set<string>();
    const electiveSubjectIds = new Set<string>();

    for (const { row, context } of rows) {
        const subjectId = context.subject?.toString();
        if (!subjectId) continue;


        if (row.isMandatory === true) {
            mandatorySubjectIds.add(subjectId);
        } else if (row.isMandatory === false) {
            electiveSubjectIds.add(subjectId);
        }
    }

    return {
        mandatorySubjects: [...mandatorySubjectIds].map((id) => new Types.ObjectId(id)),
        electiveSubjects: [...electiveSubjectIds].map((id) => new Types.ObjectId(id)),
    };
};

const validateEntranceExamRow = (
    entry: { row: NormalizedImportRow; rowNumber: number },
    issues: ImportIssue[]
) => {
    const { row, rowNumber } = entry;

    if (!row.faculty || row.faculty.trim().length === 0) {
        issues.push({ row: rowNumber, level: "error", message: "faculty is required for entrance exam rows" });
    }

    if (!row.departments || row.departments.length === 0) {
        issues.push({ row: rowNumber, level: "error", message: "At least one department is required for entrance exam rows" });
    }
};

// Matura / semi_matura row: must have subject; faculty/departments not allowed.
const validateMaturaRow = (
    entry: { row: NormalizedImportRow; rowNumber: number },
    issues: ImportIssue[]
) => {
    const { row, rowNumber } = entry;

    if ((row.subject ?? "").trim().length === 0) {
        issues.push({ row: rowNumber, level: "error", message: "subject is required for matura/semi_matura rows" });
    }

    if ((row.faculty ?? "").trim().length > 0) {
        issues.push({ row: rowNumber, level: "error", message: "faculty is not allowed for matura/semi_matura rows" });
    }

    if (row.departments && row.departments.length > 0) {
        issues.push({ row: rowNumber, level: "error", message: "departments are not allowed for matura/semi_matura rows" });
    }
};


// Entrance exam: a single shared faculty across all rows, and at least one department per row.
export const validateEntranceExamFileRules = (
    rows: { row: NormalizedImportRow; rowNumber: number }[],
    issues: ImportIssue[]
) => {
    const faculty = rows.find(({ row }) => (row.faculty ?? "").trim().length > 0)?.row.faculty?.trim() ?? "";

    if (!faculty) {
        issues.push({ row: 0, level: "error", message: "faculty is required for entrance exam rows" });
        return;
    }

    const mismatched = rows.find(({ row }) => {
        const currentFaculty = (row.faculty ?? "").trim();
        return currentFaculty.length > 0 && currentFaculty !== faculty;
    });
    if (mismatched) {
        issues.push({ row: mismatched.rowNumber, level: "error", message: "All entrance exam rows must have the same faculty" });
    }

    for (const { row, rowNumber } of rows) {
        if (!row.departments || row.departments.length === 0) {
            issues.push({ row: rowNumber, level: "error", message: "Each entrance exam row must have at least one department" });
        }
    }
};

// Matura / semi_matura: subject required on every row; faculty/departments not allowed.
export const validateMaturaFileRules = (
    rows: { row: NormalizedImportRow; rowNumber: number }[],
    issues: ImportIssue[]
) => {
    for (const { row, rowNumber } of rows) {
        if ((row.subject ?? "").trim().length === 0) {
            issues.push({ row: rowNumber, level: "error", message: "Each matura/semi_matura row must have a subject" });
        }
        if ((row.faculty ?? "").trim().length > 0) {
            issues.push({ row: rowNumber, level: "error", message: "faculty is not allowed for matura/semi_matura rows" });
        }
        if (row.departments && row.departments.length > 0) {
            issues.push({ row: rowNumber, level: "error", message: "departments are not allowed for matura/semi_matura rows" });
        }
    }
};

/* ------------------------------------------------------------------ */
/* Step 3: Duplicate questionText detection within the same file        */
/* ------------------------------------------------------------------ */

/**
 * Detect duplicate questionText values within the same file.
 * Reports each duplicate as a warning and keeps only the first occurrence
 * of each questionText for further processing.
 */
export const dedupeRowsWithinFile = (
    rows: { row: NormalizedImportRow; rowNumber: number }[],
    issues: ImportIssue[]
): { row: NormalizedImportRow; rowNumber: number }[] => {
    const seen = new Map<string, number>(); // questionText -> first rowNumber seen
    const deduped: { row: NormalizedImportRow; rowNumber: number }[] = [];

    for (const entry of rows) {
        const key = entry.row.questionText.trim();
        const firstRowNumber = seen.get(key);

        if (firstRowNumber !== undefined) {
            issues.push({
                row: entry.rowNumber,
                level: "warning",
                message: `Duplicate questionText detected (first seen at row ${firstRowNumber}), this row was skipped`,
            });
            continue;
        }

        seen.set(key, entry.rowNumber);
        deduped.push(entry);
    }

    return deduped;
};

/* ------------------------------------------------------------------ */
/* Step 4: Resolve faculty / department / subject / passage references  */
/* ------------------------------------------------------------------ */

/**
 * Build the question context (faculty, departments, subject, passage) for a single row.
 * Pushes resolution problems onto `issues` rather than throwing.
 */
const buildRowContext = async (
    row: NormalizedImportRow,
    rowNumber: number,
    issues: ImportIssue[]
): Promise<ResolvedRowContext | null> => {
    if (row.examType === EXAM_TYPES.ENTRANCE_EXAM) {
        return buildEntranceExamContext(row, rowNumber, issues);
    }
    return buildMaturaContext(row, rowNumber, issues);
};

// Entrance exam rows: requires faculty + departments + subject (+ optional passage).
export const buildEntranceExamContext = async (
    row: NormalizedImportRow,
    rowNumber: number,
    issues: ImportIssue[]
): Promise<ResolvedRowContext | null> => {
    let hasError = false;

    const facultyId = await resolveDocumentId(Faculty, row.faculty ?? "");
    if (!facultyId) {
        issues.push({ row: rowNumber, level: "error", message: `Faculty not found: ${row.faculty ?? "empty"}` });
        hasError = true;
    }

    const departmentIds: Types.ObjectId[] = [];
    for (const department of row.departments ?? []) {
        const departmentId = facultyId
            ? await resolveDocumentId(Department, department, {
                faculty: facultyId,
                examType: EXAM_TYPES.ENTRANCE_EXAM,
            })
            : null;

        if (!departmentId) {
            issues.push({ row: rowNumber, level: "error", message: `Department not found: ${department}` });
            hasError = true;
        } else {
            departmentIds.push(departmentId);
        }
    }

    if ((row.departments ?? []).length === 0) {
        issues.push({
            row: rowNumber,
            level: "error",
            message: "At least one department is required for entrance exam questions",
        });
        hasError = true;
    }

    const subjectId = await resolveSubjectId(row.subject ?? "", row.examType);
    if (!subjectId) {
        issues.push({ row: rowNumber, level: "error", message: `Subject not found: ${row.subject ?? "empty"}` });
        hasError = true;
    }

    const passageId = row.passage ? await resolveDocumentId(Passage, row.passage) : null;
    if (row.passage && !passageId) {
        issues.push({
            row: rowNumber,
            level: "warning",
            message: `Passage not found, question will be created without a passage link: ${row.passage}`,
        });
    }

    if (hasError) return null;

    return {
        faculty: facultyId,
        subject: subjectId,
        departments: departmentIds,
        passage: passageId ?? undefined,
    };
};

// Matura / semi_matura rows: requires subject only (+ optional passage).
export const buildMaturaContext = async (
    row: NormalizedImportRow,
    rowNumber: number,
    issues: ImportIssue[]
): Promise<ResolvedRowContext | null> => {
    const subjectId = await resolveSubjectId(row.subject ?? "", row.examType);
    if (!subjectId) {
        issues.push({ row: rowNumber, level: "error", message: `Subject not found: ${row.subject ?? "empty"}` });
        return null;
    }

    const passageId = row.passage ? await resolveDocumentId(Passage, row.passage) : null;
    if (row.passage && !passageId) {
        issues.push({
            row: rowNumber,
            level: "warning",
            message: `Passage not found, question will be created without a passage link: ${row.passage}`,
        });
    }

    return {
        subject: subjectId,
        passage: passageId ?? undefined,
    };
};

/**
 * Resolve faculty/department/subject/passage references for every row, collecting issues.
 * Rows that fail resolution are dropped from the returned list (their errors are already recorded).
 */
export const resolveRowContexts = async (
    rows: { row: NormalizedImportRow; rowNumber: number }[],
    issues: ImportIssue[]
): Promise<ValidatedRow[]> => {
    const validated: ValidatedRow[] = [];

    for (const { row, rowNumber } of rows) {
        const context = await buildRowContext(row, rowNumber, issues);
        if (context) {
            validated.push({ row, rowNumber, context });
        }
    }

    return validated;
};

/* ------------------------------------------------------------------ */
/* Step 5: Free / premium duplicate-access enforcement                  */
/* ------------------------------------------------------------------ */

/**
 * Check the free/premium access rule against existing questions in the DB.
 * If a question with the same (questionText, examType, year) already exists
 * with a DIFFERENT access level (e.g. existing = free, incoming = premium),
 * the row is reported as an error and excluded from the write.
 */
export const enforceAccessConsistency = async (
    rows: ValidatedRow[],
    issues: ImportIssue[],
    session: any
): Promise<ValidatedRow[]> => {
    if (rows.length === 0) return rows;

    const orConditions = rows.map(({ row }) => ({
        questionText: row.questionText.trim(),
        examType: row.examType,
        year: row.year,
    }));

    const existingQuestions = await Question.find({ $or: orConditions }).session(session);

    const existingByKey = new Map<string, (typeof existingQuestions)[number]>();
    for (const q of existingQuestions) {
        existingByKey.set(`${q.questionText.trim()}||${q.examType}||${q.year}`, q);
    }

    const allowed: ValidatedRow[] = [];

    for (const entry of rows) {
        const key = `${entry.row.questionText.trim()}||${entry.row.examType}||${entry.row.year}`;
        const existing = existingByKey.get(key);

        if (existing && existing.access !== entry.row.access) {
            issues.push({
                row: entry.rowNumber,
                level: "error",
                message: `Question already exists with access="${existing.access}", cannot import as access="${entry.row.access}": "${entry.row.questionText}"`,
            });
            continue;
        }

        allowed.push(entry);
    }

    return allowed;
};

/* ------------------------------------------------------------------ */
/* Step 6: Create / update Test and Question documents                  */
/* ------------------------------------------------------------------ */

/**
 * Create the Test document (if it doesn't exist) and create/link Question
 * documents for all validated rows. Assumes all rows have already passed
 * validation and access checks.
 */
export const upsertTestAndQuestions = async ({
    testCode,
    testName,
    firstRow,
    rows,
    session,
}: {
    testCode: string;
    testName: string;
    firstRow: NormalizedImportRow;
    rows: ValidatedRow[];
    session: any;
}) => {
    const existingTest = await Test.findOne({ testCode }).session(session);

    if (
        existingTest &&
        (existingTest.examType !== firstRow.examType ||
            existingTest.year !== firstRow.year ||
            existingTest.testType !== firstRow.testType ||
            existingTest.access !== firstRow.access)
    ) {
        throw new BadRequestError(`Test already exists with a different exam type, year, test type or access: ${testCode}`);
    }

    const uniqueSubjectIds = [...new Set(rows.map(({ context }) => context.subject?.toString()).filter(Boolean))].map(
        (id) => new Types.ObjectId(id as string)
    );


    const { mandatorySubjects, electiveSubjects } = deriveSubjectGroups(rows);

    const uniqueDepartmentIds = [
        ...new Set(
            rows
                .flatMap(({ context }) => (context.departments ?? []).map((id) => id.toString()))
                .filter(Boolean)
        )
    ].map((id) => new Types.ObjectId(id));
   

    const createdTest =
        existingTest ??
        (
            await Test.create(
                [
                    {
                        title: testName,
                        testCode,
                        examType: firstRow.examType,
                        year: firstRow.year,
                        subjects: uniqueSubjectIds,
                        testType: firstRow.testType,
                        access: firstRow.access,
                        mandatorySubjects,
                        electiveSubjects,
                        totalQuestions: 0,
                        ...toMongooseRefs(rows[0]?.context ?? {}),
                        departments: uniqueDepartmentIds,
                    },
                ],
                { session }
            )
        )[0];

    // Determine which rows already have a corresponding Question document.
    const rowKey = (questionText: string, examType: string, year: number) => `${questionText.trim()}||${examType}||${year}`;

    const orConditions = rows.map(({ row }) => ({
        questionText: row.questionText.trim(),
        examType: row.examType,
        year: row.year,
    }));

    const existingQuestions = orConditions.length > 0 ? await Question.find({ $or: orConditions }).session(session) : [];

    const existingByKey = new Map<string, (typeof existingQuestions)[number]>();
    for (const q of existingQuestions) {
        existingByKey.set(rowKey(q.questionText, q.examType, q.year), q);
    }

    const toCreate: ValidatedRow[] = [];
    const toLinkExistingIds: string[] = [];

    for (const entry of rows) {
        const existing = existingByKey.get(rowKey(entry.row.questionText, entry.row.examType, entry.row.year));

        if (existing) {
            const alreadyLinked = existing.testIds?.map((id: any) => id.toString()).includes(createdTest._id.toString());
            if (!alreadyLinked) toLinkExistingIds.push(existing._id.toString());
        } else {
            toCreate.push(entry);
        }
    }

    // Create new Question documents for rows without an existing match.
    const newQuestionDocs = await Question.insertMany(
        toCreate.map(({ row, context }) => ({
            examType: row.examType,
            year: row.year,
            questionText: row.questionText.trim(),
            questionImageUrl: row.questionImageUrl,
            options: row.options,
            access: row.access,
            correctOptionIndex: row.correctOptionIndex,
            explanation: row.explanation,
            explanationImageUrl: row.explanationImageUrl,
            difficultyLevel: row.difficultyLevel,
            status: row.status,
            isMandatory: row.isMandatory,
            testIds: [createdTest._id],
            ...(row.examType === EXAM_TYPES.ENTRANCE_EXAM
                ? {
                    faculty: context.faculty,
                    departments: context.departments,
                    subject: context.subject,
                    passage: context.passage,
                }
                : {
                    subject: context.subject,
                    passage: context.passage,
                }),
        })),
        { session }
    );

    // Link existing Question documents to this test where needed.
    if (toLinkExistingIds.length > 0) {
        await Question.updateMany(
            { _id: { $in: toLinkExistingIds } },
            { $addToSet: { testIds: new Types.ObjectId(createdTest._id) } },
            { session }
        );
    }

    const newlyLinkedExisting =
        toLinkExistingIds.length > 0 ? await Question.find({ _id: { $in: toLinkExistingIds } }).session(session) : [];

    const totalAdded = newQuestionDocs.length + newlyLinkedExisting.length;
    const mergedMandatory = [...new Set([...(existingTest?.mandatorySubjects ?? []).map((id: any) => id.toString()), ...mandatorySubjects.map((id) => id.toString())])].map((id) => new Types.ObjectId(id));
    const mergedElective = [...new Set([...(existingTest?.electiveSubjects ?? []).map((id: any) => id.toString()), ...electiveSubjects.map((id) => id.toString())])].map((id) => new Types.ObjectId(id));
    await Test.findByIdAndUpdate(
        createdTest._id,
        {
            $set: {
                title: testName,
                testCode,
                examType: firstRow.examType,
                year: firstRow.year,
                testType: firstRow.testType,
                access: firstRow.access,
                mandatorySubjects: mergedMandatory,
                electiveSubjects: mergedElective,
                ...(toMongooseRefs(rows[0]?.context ?? {})),
            },
            $inc: { totalQuestions: totalAdded },
        },
        { session }
    );

    return {
        test: await Test.findById(createdTest._id).session(session),
        questions: [...newlyLinkedExisting, ...newQuestionDocs],
    };
};
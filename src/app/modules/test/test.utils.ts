import csv from "csv-parser";
import mongoose from "mongoose";
import { Readable } from "stream";
import { EXAM_TYPES, TAccessTypes } from "../../../interfaces";
import { BadRequestError } from "../../errors/request/apiError";
import Department from "../department/department.model";
import Faculty from "../faculty/faculty.model";
import Passage from "../passage/passage.model";
import Subject from "../subject/subject.model";
import Test from "./test.model";

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
    options: { text: string; imageUrl?: string }[];
    correctOptionIndex: number;
    explanation?: string;
    difficultyLevel?: string;
    status?: string;
    faculty?: string;
    departments?: string[];
    subject?: string;
    passage?: string;
};

const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const readCsvRows = async (fileBuffer: Buffer) => {
    // Read the CSV buffer as a stream.
    const rows: Record<string, unknown>[] = [];
    const stream = Readable.from([fileBuffer.toString("utf8")]);

    await new Promise<void>((resolve, reject) => {
        // Parse each CSV row into an object.
        stream
            .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
            .on("data", (row) => rows.push(row))
            .on("end", resolve)
            .on("error", reject);
    });

    return rows;
};

export const getRowValue = (
    row: Record<string, unknown>,
    candidates: string | string[]
) => {
    // Normalize candidates to a set of headers we accept (supports single string for simpler CSVs).
    const candidateSet = new Set(
        (Array.isArray(candidates) ? candidates : [candidates]).map((c) => normalizeHeader(c))
    );

    // Pick the first matching column value from the row.
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

export const getRowValuesByPrefix = (row: Record<string, unknown>, prefix: string) => {
    // Collect repeated columns like department[0], department[1].
    const values = Object.entries(row)
        .filter(([key, value]) => normalizeHeader(key).startsWith(prefix) && value !== undefined && value !== null)
        .map(([, value]) => String(value).trim())
        .filter((value) => value.length > 0 && value.toLowerCase() !== "null");

    return [...new Set(values)];
};

export const resolveDocumentId = async (
    model: any,
    rawValue: string,
    extraQuery: Record<string, unknown> = {}
) => {
    // Resolve a human-readable code or name to a MongoDB ObjectId.
    const value = rawValue.trim();
    console.log({ value })
    const orConditions: Array<Record<string, unknown>> = [
        { name: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
        { slug: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
        { passageCode: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
    ];

    if (mongoose.isValidObjectId(value)) {
        orConditions.unshift({ _id: value });
    }

    const doc = await model.findOne({
        ...extraQuery,
        $or: orConditions,
    }).select("_id");

    if (doc?._id || model.modelName !== "Department" || Object.keys(extraQuery).length === 0) {
        return doc?._id ?? null;
    }

    // If the faculty-scoped lookup fails, retry by name/slug only so a valid department label
    // in the CSV does not fail just because the faculty filter is too strict.
    const fallbackDoc = await model.findOne({
        $or: orConditions,
    }).select("_id");
    return fallbackDoc?._id ?? null;
};

export const resolveSubjectId = async (rawValue: string, examType: string) => {
    // Resolve subjects by exam type so identical names in different exams do not collide.
    const value = rawValue.trim();
    const orConditions: Array<Record<string, unknown>> = [
        { name: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
        { slug: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") } },
    ];

    if (mongoose.isValidObjectId(value)) {
        orConditions.unshift({ _id: value });
    }

    const doc = await Subject.findOne({
        examType,
        isActive: true,
        $or: orConditions,
    }).select("_id");

    return doc?._id ?? null;
};

// Build the question context (faculty, department, subject, passage) based on the exam type and CSV row data.
export const buildQuestionContext = async (row: NormalizedImportRow) => {
    // Resolve the question ownership fields from the exam type.
    console.log(`Building question context for exam type: ${row.examType}`);
    if (row.examType === EXAM_TYPES.ENTRANCE_EXAM) {
        const facultyId = await resolveDocumentId(Faculty, row.faculty ?? "");
        if (!facultyId) {
            throw new BadRequestError(`Faculty not found: ${row.faculty ?? "empty"}`);
        }

        const departmentIds = await Promise.all(
            (row.departments ?? []).map(async (department) => {
                const departmentId = await resolveDocumentId(Department, department, {
                    faculty: facultyId,
                    examType: EXAM_TYPES.ENTRANCE_EXAM,
                });
                if (!departmentId) {
                    throw new BadRequestError(`Department not found: ${department}`);
                }

                return departmentId;
            })
        );
        if (departmentIds.length === 0) {
            throw new BadRequestError("At least one valid department is required for entrance exam questions");
        }
        const subjectId = await resolveSubjectId(row.subject ?? "", row.examType);
        if (!subjectId) {
            throw new BadRequestError(`Subject not found: ${row.subject ?? "empty"}`);
        }
        const passageId = row.passage ? await resolveDocumentId(Passage, row.passage, { faculty: facultyId }) : null;
        console.log({ passageId })
        return {
            faculty: facultyId,
            subject: subjectId,
            departments: departmentIds,
            passage: passageId ?? undefined,
        };
    }

    const subjectId = await resolveSubjectId(row.subject ?? "", row.examType);
    if (!subjectId) {
        throw new BadRequestError(`Subject not found: ${row.subject ?? "empty"}`);
    }

    const passageId = row.passage ? await resolveDocumentId(Passage, row.passage) : null;
    console.log({ passageId })
    return {
        subject: subjectId,
        passage: passageId ?? undefined,
    };
};

// Validate the CSV row based on the exam type requirements.
export const normalizeImportRow = (row: Record<string, unknown>) => {
    // Convert a raw CSV row into the schema-friendly payload.
    return {
        testCode: getRowValue(row, "testcode") ?? "",
        testName: getRowValue(row, "testname") ?? "",
        examType: getRowValue(row, "examtype") ?? "",
        year: Number(getRowValue(row, "year") ?? 0),
        source: getRowValue(row, "source") ?? "",
        testType: getRowValue(row, "testtype") ?? "",
        access: getRowValue(row, "access") ?? "",
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
        difficultyLevel: getRowValue(row, "difficultylevel"),
        status: getRowValue(row, "status"),
        faculty: getRowValue(row, "faculty"),
        departments: getRowValuesByPrefix(row, "department"),
        subject: getRowValue(row, "subject"),
        passage: getRowValue(row, "passage"),
    };
};

// Main function to get paginated tests by type with optional filters.
export const getPaginatedTestsByType = async (
    testType: string,
    input: {
        examType?: string;
        faculty?: string;
        departments?: string[];  // department names array
        language?: string;
        page?: number;
        limit?: number;
    }
) => {
    const page = Number(input.page) || 1;
    const limit = Number(input.limit) || 20;
    const skip = (page - 1) * limit;

    console.log({ input })
    const query: any = {
        testType,
        isActive: true,
    };

    const departments = input.departments
        ? Array.isArray(input.departments)
            ? input.departments
            : [input.departments]
        : [];

    if (input.examType) {
        query.examType = input.examType;
    }
     

    if (input.examType === EXAM_TYPES.ENTRANCE_EXAM && input.faculty) {
        const facultyDoc = await Faculty.findOne({
            name: { $regex: new RegExp(`^${escapeRegExp(input.faculty)}$`, "i") },
        }).select("_id");
        console.log(`Resolved faculty "${input.faculty}" to ID: ${facultyDoc?._id}`);
        query.faculty = facultyDoc?._id;
    }


    // Department name diye id lookup
    if (departments && departments.length > 0) {
        const foundDepartments = await Department.find({
            name: {
                $in: departments.map(
                    (dept) => new RegExp(`^${dept}$`, "i")  // case-insensitive exact match
                ),
            },
        })
            .select("_id")
            .lean();
        console.log({foundDepartments})
        const departmentIds = foundDepartments.map((d) => d._id);

        // Kono department match na korle empty result return koro
        if (departmentIds.length === 0) {
            return {
                data: [],
                meta: { total: 0, page, limit, totalPages: 0 },
            };
        }

        query.departments = { $in: departmentIds };
    }

    const [tests, total] = await Promise.all([
        Test.find(query)
            .select("access title totalQuestions subjects year")
            .sort({ year: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Test.countDocuments(query),
    ]);

    const subjectsList = await Subject.find({ _id: { $in: tests.flatMap(test => test.subjects || []) }, examType: input.examType })
        .select("_id name nameInEnglish nameInAlbanian")
        .lean();

    console.log({ subjectsList })

    const formattedTests = tests.map((test) => {

    const testSubjectIds = test.subjects?.map(id => id.toString()) || [];

        return {
            testId: test._id,
            title: test.title,
            totalQuestions: test.totalQuestions,

            subjects: subjectsList
                .filter(subject => testSubjectIds.includes(subject._id.toString()))
                .map(sub => ({
                    _id: sub._id,
                    name: input.language === 'english' ? sub.nameInEnglish : sub.nameInAlbanian
                })),
            totalSubjects: test.subjects?.length || 0,
            access: test.access,
            isLock: test.access === "premium",
            year: test.year,
        };
    });

    return {
        data: formattedTests,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};
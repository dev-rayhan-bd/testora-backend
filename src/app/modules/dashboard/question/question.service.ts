import mongoose, { Schema, Types } from "mongoose";
import withTransaction from "../../../../helpers/withTransaction";
import { uploadToCloudinary } from "../../../cloudinary/uploadImageToCLoudinary";
import { BadRequestError, NotFoundError } from "../../../errors/request/apiError";
import Department from "../../department/department.model";
import Faculty from "../../faculty/faculty.model";
import { PassageFiles } from "../../passage/passage.interface";
import Passage from "../../passage/passage.model";
import Question from "../../question/question.model";
import { QuizSession } from "../../quiz-session/quiz.session.model";
import Subject from "../../subject/subject.model";
import Test from "../../test/test.model";
import User from "../../user/user.model";
import { dedupeRowsWithinFile, enforceAccessConsistency, normalizeImportRow, ImportIssue, ImportValidationSummary, readTabularRows, resolveRowContexts, upsertTestAndQuestions, validateFileLevelRules, validateRowSchemas } from "./question.utils";
import { TCreatePassagePayload, TQuestionListInput, TTestListInput } from "./question.zod";




// get question overview 
const getQuestionOverview = async () => {
    const [
        totalQuestions,
        publishedTests,
        totalPassages,
        activeStudents,
        totalQuizSessions
    ] = await Promise.all([
        Question.countDocuments({}),
        Test.countDocuments({ status: "published" }),
        Passage.countDocuments({}),
        User.countDocuments({ role: "student", status: "active" }),
        QuizSession.countDocuments({})
    ]);

    return {
        totalQuestions,
        publishedTests,
        totalPassages,
        activeStudents,
        totalQuizSessions
    };
}


// get al question
const getAllQuestions = async (input: TQuestionListInput) => {
    console.log(input)
    const page = Number(input.page) || 1;
    const limit = Number(input.limit) || 20;
    const skip = (page - 1) * limit;

    const matchQuery: Record<string, unknown> = {};

    // ── questionText search আলাদা field হিসেবে রাখো ──
    if (input.questionText?.trim()) {
        matchQuery.questionText = {
            $regex: input.questionText.trim(),
            $options: "i",
        };
    }
    console.log(input.examType)
    // simple filters
    if (input.examType) matchQuery.examType = input.examType;
    if (input.year) matchQuery.year = Number(input.year);
    if (input.access) matchQuery.access = input.access;
    if (input.difficultyLevel) matchQuery.difficultyLevel = input.difficultyLevel;

    // Status filtering: "archived" fetches only archived, "published"/"draft"/"hidden" fetches those, undefined fetches non-archived
    if (input.status === "archived") {
        matchQuery.status = "archived";
    } else if (input.status) {
        matchQuery.status = input.status;
        matchQuery.isActive = true;
    } else {
        matchQuery.status = { $ne: "archived" };
        matchQuery.isActive = true;
    }

    if (input.passageId && mongoose.isValidObjectId(input.passageId)) {
        matchQuery.passage = new Schema.Types.ObjectId(input.passageId);
    }

    // ── searchTerm → questionText / ID / passage / subject / faculty / department ──
    if (input.searchTerm?.trim()) {
        const term = input.searchTerm.trim();

        const [matchedSubject, matchedFaculty, matchedDepartment, matchedPassage] = await Promise.all([
            Subject.findOne({
                name: { $regex: term, $options: "i" },
                ...(input.examType && { examType: input.examType }),
            }).select("_id").lean(),

            Faculty.findOne({
                name: { $regex: term, $options: "i" },
            }).select("_id").lean(),

            Department.findOne({
                name: { $regex: term, $options: "i" },
            }).select("_id").lean(),

            Passage.findOne({
                $or: [
                    { passageCode: { $regex: term, $options: "i" } },
                    { title: { $regex: term, $options: "i" } },
                ],
            }).select("_id").lean(),
        ]);

        const orConditions: Record<string, unknown>[] = [
            { questionText: { $regex: term, $options: "i" } },
        ];

        if (mongoose.isValidObjectId(term)) {
            orConditions.push({ _id: new Types.ObjectId(term) });
        }

        if (matchedSubject) orConditions.push({ subject: matchedSubject._id });
        if (matchedFaculty) orConditions.push({ faculty: matchedFaculty._id });
        if (matchedDepartment) orConditions.push({ departments: { $in: [matchedDepartment._id] } });
        if (matchedPassage) orConditions.push({ passage: matchedPassage._id });

        const existing = matchQuery.$and as Record<string, unknown>[] | undefined;
        matchQuery.$and = [
            ...(existing ?? []),
            { $or: orConditions },
        ];
    }

    // ── Direct ID/name filter (searchTerm ছাড়া explicit filter) ──
    if (input.subjectName?.trim()) {
        const subject = await Subject.findOne({
            name: { $regex: input.subjectName.trim(), $options: "i" },
            // examType থাকলে সেই examType-এর subject, না থাকলে সব
            ...(input.examType && { examType: input.examType }),
        }).select("_id").lean();

        if (!subject) {
            return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
        }
        matchQuery.subject = subject._id;
    }

    if (input.facultyName?.trim()) {
        const faculty = await Faculty.findOne({
            name: { $regex: input.facultyName.trim(), $options: "i" },
        }).select("_id").lean();

        if (!faculty) {
            return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
        }
        matchQuery.faculty = faculty._id;
    }

    if (input.departmentName?.trim()) {
        const department = await Department.findOne({
            name: { $regex: input.departmentName.trim(), $options: "i" },
        }).select("_id").lean();

        if (!department) {
            return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
        }
        matchQuery.departments = { $in: [department._id] };
    }

    // ── Aggregation ──
    const aggregatePipeline: any[] = [
        { $match: matchQuery },

        // populate
        {
            $lookup: {
                from: "subjects",
                localField: "subject",
                foreignField: "_id",
                as: "subjectDetails",
            },
        },
        {
            $lookup: {
                from: "faculties",
                localField: "faculty",
                foreignField: "_id",
                as: "facultyDetails",
            },
        },
        {
            $lookup: {
                from: "departments",
                localField: "departments",
                foreignField: "_id",
                as: "departmentDetails",
            },
        },
        {
            $lookup: {
                from: "passages",
                localField: "passage",
                foreignField: "_id",
                as: "passageDetails",
            },
        },

        { $unwind: { path: "$subjectDetails", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$facultyDetails", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$passageDetails", preserveNullAndEmptyArrays: true } },

        { $sort: { createdAt: -1 } },

        {
            $facet: {
                metadata: [{ $count: "total" }],
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            examType: 1,
                            year: 1,
                            questionText: 1,
                            access: 1,
                            options: 1,
                            correctOptionIndex: 1,
                            difficultyLevel: 1,
                            status: 1,
                            createdAt: 1,
                            subject: {
                                $cond: {
                                    if: { $ifNull: ["$subjectDetails", false] },
                                    then: {
                                        _id: { $ifNull: ["$subjectDetails._id", null] },
                                        name: { $ifNull: ["$subjectDetails.name", null] },
                                    },
                                    else: null,
                                },
                            },

                            faculty: {
                                $cond: {
                                    if: { $ifNull: ["$facultyDetails", false] },
                                    then: {
                                        _id: { $ifNull: ["$facultyDetails._id", null] },
                                        name: { $ifNull: ["$facultyDetails.name", null] },
                                    },
                                    else: null,
                                },
                            },

                            passage: {
                                $cond: {
                                    if: { $ifNull: ["$passageDetails", false] },
                                    then: {
                                        _id: { $ifNull: ["$passageDetails._id", null] },
                                        passageCode: { $ifNull: ["$passageDetails.passageCode", null] },
                                        title: { $ifNull: ["$passageDetails.title", null] },
                                    },
                                    else: null,
                                },
                            },

                            departments: {
                                $map: {
                                    input: "$departmentDetails",
                                    as: "dept",
                                    in: { _id: "$$dept._id", name: "$$dept.name" },
                                },
                            },
                        },
                    },
                ],
            },
        },
    ];

    const result = await Question.aggregate(aggregatePipeline);
    const formattedData = result[0]?.data.map((item: any) => ({
        _id: item._id,
        examType: item.examType,
        year: item.year,
        questionText: item.questionText,
        options: item.options,
        correctOptionIndex: item.correctOptionIndex,
        correctAnswer: item.options?.[item.correctOptionIndex]?.text ?? null,
        access: item.access,
        difficultyLevel: item.difficultyLevel,
        status: item.status,
        createdAt: item.createdAt,
        subjectName: item.subject?.name ?? null,
        facultyName: item.faculty?.name ?? null,
        passageCode: item.passage?.passageCode ?? null,
    })) || [];

    const total = result[0]?.metadata[0]?.total || 0;

    return {
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
        questions: formattedData,
    };
};


// get single question
const getQuestionById = async (id: string) => {
    if (!mongoose.isValidObjectId(id)) {
        throw new BadRequestError("Invalid question ID");
    }

    const questionId = new Types.ObjectId(id);

    // ── Step 1: Question details ──
    const questionAgg = await Question.aggregate([
        { $match: { _id: questionId, isActive: true } },

        {
            $lookup: {
                from: "subjects",
                localField: "subject",
                foreignField: "_id",
                as: "subjectDetails",
            },
        },
        {
            $lookup: {
                from: "faculties",
                localField: "faculty",
                foreignField: "_id",
                as: "facultyDetails",
            },
        },
        {
            $lookup: {
                from: "departments",
                localField: "departments",
                foreignField: "_id",
                as: "departmentDetails",
            },
        },
        {
            $lookup: {
                from: "passages",
                localField: "passage",
                foreignField: "_id",
                as: "passageDetails",
            },
        },

        {
            $lookup: {
                from: "tests",
                localField: "testIds",
                foreignField: "_id",
                as: "testDetails",
            },
        },

        { $unwind: { path: "$subjectDetails", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$facultyDetails", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$passageDetails", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                _id: 1,
                examType: 1,
                year: 1,
                questionText: 1,
                questionImageUrl: { $ifNull: ["$questionImageUrl", null] },
                options: 1,
                correctOptionIndex: 1,
                explanation: { $ifNull: ["$explanation", null] },
                difficultyLevel: 1,
                access: 1,
                status: 1,
                testIds: {
                    $map: {
                        input: "$testDetails",
                        as: "test",
                        in: "$$test.title",
                    },
                },
                createdAt: 1,
                updatedAt: 1,

                subject: {
                    $cond: {
                        if: { $ifNull: ["$subjectDetails", false] },
                        then: {
                            _id: { $ifNull: ["$subjectDetails._id", null] },
                            name: { $ifNull: ["$subjectDetails.name", null] },
                        },
                        else: null,
                    },
                },
                faculty: {
                    $cond: {
                        if: { $ifNull: ["$facultyDetails", false] },
                        then: {
                            _id: { $ifNull: ["$facultyDetails._id", null] },
                            name: { $ifNull: ["$facultyDetails.name", null] },
                        },
                        else: null,
                    },
                },
                departments: {
                    $map: {
                        input: "$departmentDetails",
                        as: "dept",
                        in: { _id: "$$dept._id", name: "$$dept.name" },
                    },
                },
                passage: {
                    $cond: {
                        if: { $ifNull: ["$passageDetails", false] },
                        then: {
                            _id: { $ifNull: ["$passageDetails._id", null] },
                            passageCode: { $ifNull: ["$passageDetails.passageCode", null] },
                            title: { $ifNull: ["$passageDetails.title", null] },
                        },
                        else: null,
                    },
                },
            },
        },
    ]);

    if (!questionAgg.length) {
        throw new NotFoundError("Question not found");
    }

    const question = questionAgg[0];

    // ── Step 2: QuizSession থেকে attempt stats ──
    const statsAgg = await QuizSession.aggregate([
        // এই question যেসব session-এ attempt হয়েছে
        {
            $match: {
                "attempts.questionId": questionId,
            },
        },
        // attempts array unwind করো
        { $unwind: "$attempts" },
        // শুধু এই question-এর attempts রাখো
        {
            $match: {
                "attempts.questionId": questionId,
            },
        },
        // stats বের করো
        {
            $group: {
                _id: null,
                totalAttempts: { $sum: 1 },
                correctCount: {
                    $sum: { $cond: ["$attempts.isCorrect", 1, 0] },
                },
                wrongCount: {
                    $sum: { $cond: ["$attempts.isCorrect", 0, 1] },
                },
            },
        },
        {
            $project: {
                _id: 0,
                totalAttempts: 1,
                correctCount: 1,
                wrongCount: 1,
                // correct percentage
                correctPercentage: {
                    $cond: [
                        { $gt: ["$totalAttempts", 0] },
                        {
                            $round: [
                                { $multiply: [{ $divide: ["$correctCount", "$totalAttempts"] }, 100] },
                                1,
                            ],
                        },
                        0,
                    ],
                },
            },
        },
    ]);




    const stats = statsAgg[0] ?? {
        totalAttempts: 0,
        correctCount: 0,
        wrongCount: 0,
        correctPercentage: 0,
    };


    const formatted = {
        questionId: question._id,
        examType: question.examType,
        year: question.year,
        questionText: question.questionText,
        questionImageUrl: question.questionImageUrl,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        explanation: question.explanation,
        difficultyLevel: question.difficultyLevel,
        access: question.access,
        status: question.status,
        createdAt: question.createdAt,
        subjectName: question.subject?.name ?? null,
        facultyName: question.faculty?.name ?? null,
        departments: question.departments?.map((d: any) => d.name) ?? [],
        passage: question.passage ?? null,
        testIds: question.testIds ?? [],
        stats,
    };

    // ── Step 3: Merge ──
    return formatted
};


// get all test archive
const getAllTestArchive = async (input: TTestListInput) => {
    const page = Number(input.page) || 1;
    const limit = Number(input.limit) || 20;
    const skip = (page - 1) * limit;

    const matchQuery: Record<string, unknown> = {};

    if (input.examType) matchQuery.examType = input.examType;
    if (input.year) matchQuery.year = Number(input.year);
    if (input.access) matchQuery.access = input.access;
    if (input.testType) matchQuery.testType = input.testType;

    // Status filtering: "archived" fetches only archived, "published"/"draft"/"hidden" fetches those, undefined fetches non-archived
    if (input.status === "archived") {
        matchQuery.status = "archived";
    } else if (input.status) {
        matchQuery.status = input.status;
        matchQuery.isActive = true;
    } else {
        matchQuery.status = { $ne: "archived" };
        matchQuery.isActive = true;
    }

    // ── searchTerm → title, testCode, subject, faculty, department ──
    if (input.searchTerm?.trim()) {
        const term = input.searchTerm.trim();

        const [matchedSubject, matchedFaculty, matchedDepartment] = await Promise.all([
            Subject.findOne({
                name: { $regex: term, $options: "i" },
                ...(input.examType && { examType: input.examType }),
            }).select("_id").lean(),

            Faculty.findOne({
                name: { $regex: term, $options: "i" },
            }).select("_id").lean(),

            Department.findOne({
                name: { $regex: term, $options: "i" },
            }).select("_id").lean(),
        ]);

        const orConditions: Record<string, unknown>[] = [
            // title ও testCode সরাসরি field match
            { title: { $regex: term, $options: "i" } },
            { testCode: { $regex: term, $options: "i" } },
        ];

        if (matchedSubject) orConditions.push({ subject: matchedSubject._id });
        if (matchedFaculty) orConditions.push({ faculty: matchedFaculty._id });
        if (matchedDepartment) orConditions.push({ departments: { $in: [matchedDepartment._id] } });

        const existing = matchQuery.$and as Record<string, unknown>[] | undefined;
        matchQuery.$and = [
            ...(existing ?? []),
            { $or: orConditions },
        ];
    }

    // ── Direct filters ──
    if (input.title) matchQuery.title = { $regex: input.title.trim(), $options: "i" };
    if (input.testCode) matchQuery.testCode = { $regex: input.testCode.trim(), $options: "i" };

    if (input.subjectName?.trim()) {
        const subject = await Subject.findOne({
            name: { $regex: input.subjectName.trim(), $options: "i" },
            ...(input.examType && { examType: input.examType }),
        }).select("_id").lean();

        if (!subject) return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
        matchQuery.subject = subject._id;
    }

    if (input.facultyName?.trim()) {
        const faculty = await Faculty.findOne({
            name: { $regex: input.facultyName.trim(), $options: "i" },
        }).select("_id").lean();

        if (!faculty) return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
        matchQuery.faculty = faculty._id;
    }

    if (input.departmentName?.trim()) {
        const department = await Department.findOne({
            name: { $regex: input.departmentName.trim(), $options: "i" },
        }).select("_id").lean();

        if (!department) return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
        matchQuery.departments = { $in: [department._id] };
    }

    // ── Aggregation ──
    const aggregatePipeline: any[] = [
        { $match: matchQuery },

        {
            $lookup: {
                from: "subjects",
                localField: "subject",
                foreignField: "_id",
                as: "subjectDetails",
            },
        },
        {
            $lookup: {
                from: "faculties",
                localField: "faculty",
                foreignField: "_id",
                as: "facultyDetails",
            },
        },
        {
            $lookup: {
                from: "departments",
                localField: "departments",
                foreignField: "_id",
                as: "departmentDetails",
            },
        },

        { $unwind: { path: "$subjectDetails", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$facultyDetails", preserveNullAndEmptyArrays: true } },
        // passageDetails $lookup নেই তাই $unwind সরিয়ে দেওয়া হয়েছে

        { $sort: { createdAt: -1 } },

        {
            $facet: {
                metadata: [{ $count: "total" }],
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            testCode: 1,
                            testType: 1,
                            examType: 1,
                            year: 1,
                            access: 1,
                            status: 1,
                            createdAt: 1,
                            totalQuestions: 1,
                            subject: {
                                $cond: {
                                    if: { $ifNull: ["$subjectDetails", false] },
                                    then: {
                                        _id: { $ifNull: ["$subjectDetails._id", null] },
                                        name: { $ifNull: ["$subjectDetails.name", null] },
                                    },
                                    else: null,
                                },
                            },

                            faculty: {
                                $cond: {
                                    if: { $ifNull: ["$facultyDetails", false] },
                                    then: {
                                        _id: { $ifNull: ["$facultyDetails._id", null] },
                                        name: { $ifNull: ["$facultyDetails.name", null] },
                                    },
                                    else: null,
                                },
                            },

                            departments: {
                                $map: {
                                    input: "$departmentDetails",
                                    as: "dept",
                                    in: { _id: "$$dept._id", name: "$$dept.name" },
                                },
                            },
                        },
                    },
                ],
            },
        },
    ];

    const result = await Test.aggregate(aggregatePipeline);

    const formattedData = result[0]?.data.map((item: any) => ({
        _id: item._id,
        title: item.title ?? null,
        testCode: item.testCode ?? null,
        testType: item.testType ?? null,
        examType: item.examType ?? null,
        year: item.year ?? null,
        totalQuestions: item.totalQuestions ?? 0,
        access: item.access ?? null,
        status: item.status ?? null,
        createdAt: item.createdAt,
        subjectName: item.subject?.name ?? null,
        facultyName: item.faculty?.name ?? null,
        departments: item.departments?.map((d: any) => d.name) ?? [],
    })) || [];

    const total = result[0]?.metadata[0]?.total || 0;

    return {
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        tests: formattedData,
    };
};

// create passage
const createPassage = async (payload: TCreatePassagePayload
    , files: PassageFiles) => {
    // Create a passage record without linking questions here.

    let passageImageUrl: string | undefined;
    if (files?.passage_image?.[0]) {
        const uploaded = await uploadToCloudinary(
            files.passage_image[0],
            "passage_images"
        );
        passageImageUrl = uploaded.secure_url;
    }

    const isExistingPassage = await Passage.findOne({ passageCode: payload.passageCode });

    if (isExistingPassage) {
        throw new BadRequestError("Passage with this code already exists");
    }

    const passage = await Passage.create({ ...payload, passageImageUrl });

    if (!passage) {
        throw new BadRequestError("Failed to create passage");
    }
    return passage;
};

// get passages
const getPassages = async (query: Record<string, unknown>) => {
    const { searchTerm, page, limit, status } = query;

    // 1. Number convert kora ebong fallback set kora
    const pageNumber = parseInt(page as string) || 1;
    const limitNumber = parseInt(limit as string) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    // 2. Dynamic query object toiri kora
    const mongooseQuery: any = {};

    if (status === "active") {
        mongooseQuery.isActive = true;
    } else if (status === "inactive") {
        mongooseQuery.isActive = false;
    } else if (status !== "all") {
        mongooseQuery.isActive = true; // Default to active if status is not explicitly "all" or "inactive"
    }

    if (searchTerm) {
        mongooseQuery.$or = [
            { title: { $regex: searchTerm, $options: 'i' } },
            { content: { $regex: searchTerm, $options: 'i' } },
            { passageCode: { $regex: searchTerm, $options: 'i' } }
        ];
    }

    // 3. Database query execute kora
    const [passages, totalPassages] = await Promise.all([
        Passage.find(mongooseQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNumber),
        Passage.countDocuments(mongooseQuery)
    ]);

    // 4. Total pages calculate kora
    const totalPages = Math.ceil(totalPassages / limitNumber);

    // 5. Thikthak bhabe meta data response return kora
    return {
        meta: {
            page: pageNumber,
            limit: limitNumber,
            total: totalPassages, // Total data count
            totalPages: totalPages // Total page count
        },
        data: passages
    };
};

// import question and test from csv
const importTestsFromFile = async (
    fileBuffer: Buffer
): Promise<{
    summary: ImportValidationSummary;
    test?: any;
    questions?: any[];
}> => {
    const issues: ImportIssue[] = [];

    const rawRows = readTabularRows(fileBuffer);

    if (rawRows.length === 0) {
        return {
            summary: { totalRows: 0, validRows: 0, warnings: [], errors: [{ row: 0, level: "error", message: "File is empty" }] },
        };
    }

    const allNormalizedRows = rawRows.map((rawRow, index) => ({
        row: normalizeImportRow(rawRow),
        rowNumber: index + 1,
    }));

    const schemaValidRows = validateRowSchemas(rawRows, issues);
    const fileLevelInfo = validateFileLevelRules(allNormalizedRows, schemaValidRows, issues);
    const dedupedRows = dedupeRowsWithinFile(schemaValidRows, issues);
    const resolvedRows = await resolveRowContexts(dedupedRows, issues);

    const totalRows = rawRows.length;

    // ---- HERE: early-return when there are blocking errors ----
    if (issues.some((i) => i.level === "error") || !fileLevelInfo) {
        const errorCount = issues.filter((i) => i.level === "error").length;
        return {
            summary: {
                totalRows,
                validRows: Math.max(0, resolvedRows.length - errorCount),
                warnings: issues.filter((i) => i.level === "warning"),
                errors: issues.filter((i) => i.level === "error"),
            },
        };
    }

    const { testCode, testName, firstRow } = fileLevelInfo;

    const result = await withTransaction(async (session) => {
        const allowedRows = await enforceAccessConsistency(resolvedRows, issues, session);

        return upsertTestAndQuestions({
            testCode,
            testName,
            firstRow,
            rows: allowedRows,
            session,
        });
    });

    // ---- HERE: success return ----
    const errorCount = issues.filter((i) => i.level === "error").length;
    return {
        summary: {
            totalRows,
            validRows: Math.max(0, resolvedRows.length - errorCount),
            warnings: issues.filter((i) => i.level === "warning"),
            errors: issues.filter((i) => i.level === "error"),
        },
        test: {
            _id: result.test && result.test._id,
            title: result.test && result.test.title,
            testCode: result.test && result.test.testCode,
        },
    };
};

// ── Question Management CRUD & Status ────────────────────────────────────────

const createQuestion = async (payload: any, files?: any) => {
    let questionsPayload: any[] = [];
    let isBulk = false;

    // The user screenshot shows data field
    const rawQuestions = payload.data || payload.questions;

    if (rawQuestions) {
        isBulk = true;
        if (typeof rawQuestions === "string") {
            try {
                const parsed = JSON.parse(rawQuestions);
                if (parsed.questions && Array.isArray(parsed.questions)) {
                    // Extract common metadata by removing the 'questions' array
                    const { questions, ...commonMetadata } = parsed;
                    questionsPayload = questions.map((q: any) => ({ ...commonMetadata, ...q }));
                } else if (Array.isArray(parsed)) {
                    questionsPayload = parsed;
                } else {
                    questionsPayload = [parsed];
                }
            } catch (e) {
                throw new BadRequestError("Invalid questions/data JSON format");
            }
        } else if (typeof rawQuestions === "object" && rawQuestions !== null) {
            if (rawQuestions.questions && Array.isArray(rawQuestions.questions)) {
                const { questions, ...commonMetadata } = rawQuestions;
                questionsPayload = questions.map((q: any) => ({ ...commonMetadata, ...q }));
            } else if (Array.isArray(rawQuestions)) {
                questionsPayload = rawQuestions;
            } else {
                questionsPayload = [rawQuestions];
            }
        }
    } else if (Array.isArray(payload)) {
        isBulk = true;
        questionsPayload = payload;
    } else {
        questionsPayload = [payload];
    }

    // Process image uploads (array of files) and map them by their original filename
    const uploadedImagesMap: Record<string, string> = {};
    if (files?.question_image) {
        const imageFiles = Array.isArray(files.question_image) ? files.question_image : [files.question_image];
        
        // Upload all images concurrently
        const uploadPromises = imageFiles.map(async (file: any) => {
            const uploaded = await uploadToCloudinary(file, "question_images");
            // Map the secure_url to the original file name
            uploadedImagesMap[file.originalname] = uploaded.secure_url;
            return uploaded;
        });
        await Promise.all(uploadPromises);
    }

    const testIdsToUpdate = new Set<string>();

    const questionsToInsert = questionsPayload.map((qPayload, index) => {
        let options = qPayload.options;
        if (typeof options === "string") {
            try {
                options = JSON.parse(options);
            } catch (e) {
                throw new BadRequestError(`Invalid options JSON format at index ${index}`);
            }
        }

        let departments = qPayload.departments;
        if (typeof departments === "string") {
            try {
                departments = JSON.parse(departments);
            } catch (e) {
                departments = [departments];
            }
        }

        let questionImageUrl = null;
        if (isBulk && qPayload.imageName && uploadedImagesMap[qPayload.imageName]) {
            // Map by explicitly passed imageName
            questionImageUrl = uploadedImagesMap[qPayload.imageName];
        } else if (!isBulk && Object.keys(uploadedImagesMap).length > 0) {
            // Fallback for single legacy upload
            questionImageUrl = Object.values(uploadedImagesMap)[0];
        } else if (qPayload.questionImageUrl) {
            questionImageUrl = qPayload.questionImageUrl;
        }

        const questionData: any = {
            ...qPayload,
            options,
            departments,
            questionImageUrl,
            correctOptionIndex: Number(qPayload.correctOptionIndex) || 0,
            year: Number(qPayload.year) || undefined,
        };

        if (qPayload.subject && mongoose.isValidObjectId(qPayload.subject)) {
            questionData.subject = new Types.ObjectId(qPayload.subject);
        } else {
            delete questionData.subject;
        }

        if (qPayload.faculty && mongoose.isValidObjectId(qPayload.faculty)) {
            questionData.faculty = new Types.ObjectId(qPayload.faculty);
        } else {
            delete questionData.faculty;
        }

        if (qPayload.passage && mongoose.isValidObjectId(qPayload.passage)) {
            questionData.passage = new Types.ObjectId(qPayload.passage);
        } else {
            delete questionData.passage;
        }

        if (qPayload.testIds && Array.isArray(qPayload.testIds)) {
            qPayload.testIds.forEach((id: string) => testIdsToUpdate.add(id));
        }

        return questionData;
    });

    const createdQuestions = await Question.insertMany(questionsToInsert);

    if (testIdsToUpdate.size > 0) {
        await Test.updateMany(
            { _id: { $in: Array.from(testIdsToUpdate) } },
            { $inc: { totalQuestions: createdQuestions.length } }
        );
    }

    return isBulk ? createdQuestions : createdQuestions[0];
};

const updateQuestion = async (questionId: string, payload: any, files?: any) => {
    const question = await Question.findById(questionId);
    if (!question) {
        throw new NotFoundError("Question not found");
    }

    let questionImageUrl = question.questionImageUrl;
    if (files?.question_image?.[0]) {
        const uploaded = await uploadToCloudinary(files.question_image[0], "question_images");
        questionImageUrl = uploaded.secure_url;
    }

    let options = payload.options || question.options;
    if (typeof options === "string") {
        try {
            options = JSON.parse(options);
        } catch (e) {
            throw new BadRequestError("Invalid options JSON format");
        }
    }

    let departments = payload.departments || question.departments;
    if (typeof departments === "string") {
        try {
            departments = JSON.parse(departments);
        } catch (e) {
            departments = [departments];
        }
    }

    const updateData: any = {
        ...payload,
        options,
        departments,
        questionImageUrl,
    };

    if (payload.year) updateData.year = Number(payload.year);
    if (payload.correctOptionIndex !== undefined) {
        updateData.correctOptionIndex = Number(payload.correctOptionIndex);
    }

    if (payload.subject && mongoose.isValidObjectId(payload.subject)) {
        updateData.subject = new Types.ObjectId(payload.subject);
    }
    if (payload.faculty && mongoose.isValidObjectId(payload.faculty)) {
        updateData.faculty = new Types.ObjectId(payload.faculty);
    }
    if (payload.passage && mongoose.isValidObjectId(payload.passage)) {
        updateData.passage = new Types.ObjectId(payload.passage);
    }

    const updatedQuestion = await Question.findByIdAndUpdate(questionId, updateData, {
        new: true,
        runValidators: true,
    });

    return updatedQuestion;
};

const updateQuestionStatus = async (questionId: string, status: string) => {
    const question = await Question.findById(questionId);
    if (!question) {
        throw new NotFoundError("Question not found");
    }

    const updated = await Question.findByIdAndUpdate(
        questionId,
        {
            status,
            isActive: status !== "archived",
        },
        { new: true, runValidators: false }
    );
    return updated;
};

const deleteQuestion = async (questionId: string) => {
    const question = await Question.findById(questionId);
    if (!question) {
        throw new NotFoundError("Question not found");
    }

    // Move to Archive (Soft delete)
    await Question.findByIdAndUpdate(
        questionId,
        {
            status: "archived",
            isActive: false,
        },
        { runValidators: false }
    );

    return { message: "Question moved to archive successfully" };
};

const restoreQuestion = async (questionId: string, targetStatus: string = "published") => {
    const question = await Question.findById(questionId);
    if (!question) {
        throw new NotFoundError("Question not found");
    }

    const updated = await Question.findByIdAndUpdate(
        questionId,
        {
            status: targetStatus,
            isActive: true,
        },
        { new: true, runValidators: false }
    );

    return { message: "Question restored successfully", data: updated };
};

const permanentDeleteQuestion = async (questionId: string) => {
    const question = await Question.findById(questionId);
    if (!question) {
        throw new NotFoundError("Question not found");
    }

    // Decrement test counts if attached
    if (question.testIds && question.testIds.length > 0) {
        await Test.updateMany(
            { _id: { $in: question.testIds } },
            { $inc: { totalQuestions: -1 } }
        );
    }

    await Question.findByIdAndDelete(questionId);

    return { message: "Question permanently deleted successfully" };
};

const bulkPermanentDeleteQuestions = async (questionIds: string[]) => {
    if (!questionIds || questionIds.length === 0) {
        throw new BadRequestError("No question IDs provided");
    }

    const questions = await Question.find({ _id: { $in: questionIds } }).select("testIds").lean();
    const testCounts: Record<string, number> = {};
    questions.forEach(q => {
        (q.testIds || []).forEach((tId: any) => {
            const str = tId.toString();
            testCounts[str] = (testCounts[str] || 0) + 1;
        });
    });

    for (const [testId, count] of Object.entries(testCounts)) {
        await Test.findByIdAndUpdate(testId, { $inc: { totalQuestions: -count } });
    }

    const result = await Question.deleteMany({ _id: { $in: questionIds } });

    return {
        message: `Successfully permanently deleted ${result.deletedCount} questions`,
        deletedCount: result.deletedCount,
    };
};

const bulkRestoreQuestions = async (questionIds: string[], targetStatus: string = "published") => {
    if (!questionIds || questionIds.length === 0) {
        throw new BadRequestError("No question IDs provided");
    }

    const result = await Question.updateMany(
        { _id: { $in: questionIds } },
        { status: targetStatus, isActive: true }
    );

    return {
        message: `Successfully restored ${result.modifiedCount} questions`,
        modifiedCount: result.modifiedCount,
    };
};

const bulkArchiveQuestions = async (questionIds: string[]) => {
    if (!questionIds || questionIds.length === 0) {
        throw new BadRequestError("No question IDs provided");
    }

    const result = await Question.updateMany(
        { _id: { $in: questionIds } },
        { status: "archived", isActive: false }
    );

    return {
        message: `Successfully archived ${result.modifiedCount} questions`,
        modifiedCount: result.modifiedCount,
    };
};

// ── Passage Management ───────────────────────────────────────────────────────

const getPassageById = async (passageId: string) => {
    const passage = await Passage.findById(passageId);
    if (!passage) {
        throw new NotFoundError("Passage not found");
    }

    const linkedQuestionsCount = await Question.countDocuments({
        passage: passage._id,
        isActive: true,
    });

    return {
        ...passage.toObject(),
        linkedQuestionsCount,
    };
};

const updatePassage = async (passageId: string, payload: any, files?: any) => {
    const passage = await Passage.findById(passageId);
    if (!passage) {
        throw new NotFoundError("Passage not found");
    }

    let passageImageUrl = passage.passageImageUrl;
    if (files?.passage_image?.[0]) {
        const uploaded = await uploadToCloudinary(files.passage_image[0], "passage_images");
        passageImageUrl = uploaded.secure_url;
    }

    if (payload.passageCode && payload.passageCode !== passage.passageCode) {
        const codeExists = await Passage.findOne({
            passageCode: payload.passageCode,
            _id: { $ne: passageId },
        });
        if (codeExists) {
            throw new BadRequestError("Passage with this code already exists");
        }
    }

    const updated = await Passage.findByIdAndUpdate(
        passageId,
        { ...payload, passageImageUrl },
        { new: true, runValidators: true }
    );

    return updated;
};

const togglePassageStatus = async (passageId: string) => {
    const passage = await Passage.findById(passageId);
    if (!passage) {
        throw new NotFoundError("Passage not found");
    }

    passage.isActive = !passage.isActive;
    await passage.save();
    return passage;
};

const deletePassage = async (passageId: string) => {
    const passage = await Passage.findById(passageId);
    if (!passage) {
        throw new NotFoundError("Passage not found");
    }

    await Passage.findByIdAndDelete(passageId);

    return { message: "Passage removed successfully" };
};

// ── Test Archive Management & Tools ──────────────────────────────────────────

const createTest = async (payload: any) => {
    const existing = await Test.findOne({ testCode: payload.testCode });
    if (existing) {
        throw new BadRequestError("A test with this test code already exists");
    }

    const testData: any = {
        title: payload.title,
        testCode: payload.testCode,
        examType: payload.examType,
        year: Number(payload.year),
        testType: payload.testType,
        access: payload.access,
        status: payload.status || "published",
    };

    if (payload.subject && mongoose.isValidObjectId(payload.subject)) {
        testData.subjects = [new Types.ObjectId(payload.subject)];
    } else if (payload.subjects && Array.isArray(payload.subjects)) {
        testData.subjects = payload.subjects.filter((id: string) => mongoose.isValidObjectId(id));
    }

    if (payload.faculty && mongoose.isValidObjectId(payload.faculty)) {
        testData.faculty = new Types.ObjectId(payload.faculty);
    }

    if (payload.departments && Array.isArray(payload.departments)) {
        testData.departments = payload.departments.filter((id: string) => mongoose.isValidObjectId(id));
    }

    const test = await Test.create(testData);

    if (payload.questionIds && Array.isArray(payload.questionIds) && payload.questionIds.length > 0) {
        await Question.updateMany(
            { _id: { $in: payload.questionIds } },
            { $addToSet: { testIds: test._id } }
        );
        test.totalQuestions = payload.questionIds.length;
        await test.save();
    }

    return test;
};

const getTestById = async (testId: string) => {
    const test = await Test.findById(testId)
        .populate("subjects", "name")
        .populate("faculty", "name")
        .populate("departments", "name");

    if (!test) {
        throw new NotFoundError("Test not found");
    }

    const questions = await Question.find({ testIds: test._id, isActive: true })
        .populate("subject", "name")
        .populate("passage", "passageCode title");

    return {
        test,
        questions,
    };
};

const updateTest = async (testId: string, payload: any) => {
    const test = await Test.findById(testId);
    if (!test) {
        throw new NotFoundError("Test not found");
    }

    if (payload.testCode && payload.testCode !== test.testCode) {
        const codeExists = await Test.findOne({
            testCode: payload.testCode,
            _id: { $ne: testId },
        });
        if (codeExists) {
            throw new BadRequestError("A test with this test code already exists");
        }
    }

    const updated = await Test.findByIdAndUpdate(testId, payload, {
        new: true,
        runValidators: true,
    });

    if (payload.questionIds && Array.isArray(payload.questionIds)) {
        // Unlink questions no longer in the list
        await Question.updateMany(
            { testIds: testId, _id: { $nin: payload.questionIds } },
            { $pull: { testIds: testId } }
        );
        // Link new questions
        await Question.updateMany(
            { _id: { $in: payload.questionIds } },
            { $addToSet: { testIds: testId } }
        );
        updated!.totalQuestions = payload.questionIds.length;
        await updated!.save();
    }

    return updated;
};

const updateTestStatus = async (testId: string, status: string) => {
    const test = await Test.findById(testId);
    if (!test) {
        throw new NotFoundError("Test not found");
    }

    const updated = await Test.findByIdAndUpdate(
        testId,
        {
            status,
            isActive: status !== "archived",
        },
        { new: true, runValidators: false }
    );
    return updated;
};

const deleteTest = async (testId: string) => {
    const test = await Test.findById(testId);
    if (!test) {
        throw new NotFoundError("Test not found");
    }

    // Move to Archive (Soft delete)
    await Test.findByIdAndUpdate(
        testId,
        {
            status: "archived",
            isActive: false,
        },
        { runValidators: false }
    );

    return { message: "Test moved to archive successfully" };
};

const restoreTest = async (testId: string, targetStatus: string = "published") => {
    const test = await Test.findById(testId);
    if (!test) {
        throw new NotFoundError("Test not found");
    }

    const updated = await Test.findByIdAndUpdate(
        testId,
        {
            status: targetStatus,
            isActive: true,
        },
        { new: true, runValidators: false }
    );

    return { message: "Test restored successfully", data: updated };
};

const permanentDeleteTest = async (testId: string) => {
    const test = await Test.findById(testId);
    if (!test) {
        throw new NotFoundError("Test not found");
    }

    // Remove test link from questions
    await Question.updateMany({ testIds: testId }, { $pull: { testIds: testId } });

    await Test.findByIdAndDelete(testId);

    return { message: "Test permanently deleted successfully" };
};

const bulkPermanentDeleteTests = async (testIds: string[]) => {
    if (!testIds || testIds.length === 0) {
        throw new BadRequestError("No test IDs provided");
    }

    await Question.updateMany({ testIds: { $in: testIds } }, { $pull: { testIds: { $in: testIds } } });
    const result = await Test.deleteMany({ _id: { $in: testIds } });

    return {
        message: `Successfully permanently deleted ${result.deletedCount} tests`,
        deletedCount: result.deletedCount,
    };
};

const bulkRestoreTests = async (testIds: string[], targetStatus: string = "published") => {
    if (!testIds || testIds.length === 0) {
        throw new BadRequestError("No test IDs provided");
    }

    const result = await Test.updateMany(
        { _id: { $in: testIds } },
        { status: targetStatus, isActive: true }
    );

    return {
        message: `Successfully restored ${result.modifiedCount} tests`,
        modifiedCount: result.modifiedCount,
    };
};

const bulkArchiveTests = async (testIds: string[]) => {
    if (!testIds || testIds.length === 0) {
        throw new BadRequestError("No test IDs provided");
    }

    const result = await Test.updateMany(
        { _id: { $in: testIds } },
        { status: "archived", isActive: false }
    );

    return {
        message: `Successfully archived ${result.modifiedCount} tests`,
        modifiedCount: result.modifiedCount,
    };
};

const duplicateTest = async (
    testId: string,
    payload?: { newTestCode?: string; newTitle?: string; newYear?: number }
) => {
    const sourceTest = await Test.findById(testId);
    if (!sourceTest) {
        throw new NotFoundError("Source test not found");
    }

    const timestamp = Date.now().toString().slice(-4);
    const newTestCode = payload?.newTestCode?.trim() || `${sourceTest.testCode}-COPY-${timestamp}`;
    const newTitle = payload?.newTitle?.trim() || `${sourceTest.title} (Copy)`;
    const newYear = payload?.newYear || sourceTest.year;

    const codeExists = await Test.findOne({ testCode: newTestCode });
    if (codeExists) {
        throw new BadRequestError("Generated or provided test code already exists");
    }

    const newTestData: any = {
        title: newTitle,
        testCode: newTestCode,
        examType: sourceTest.examType,
        year: newYear,
        testType: sourceTest.testType,
        access: sourceTest.access,
        status: "draft",
        subjects: sourceTest.subjects,
        faculty: sourceTest.faculty,
        departments: sourceTest.departments,
        totalQuestions: sourceTest.totalQuestions,
    };

    const newTest = await Test.create(newTestData);

    // Link all questions from source test to the new test
    const questions = await Question.find({ testIds: sourceTest._id, isActive: true });
    if (questions.length > 0) {
        const questionIds = questions.map((q) => q._id);
        await Question.updateMany(
            { _id: { $in: questionIds } },
            { $addToSet: { testIds: newTest._id } }
        );
        newTest.totalQuestions = questions.length;
        await newTest.save();
    }

    return {
        message: "Test duplicated successfully with all linked questions preserved",
        test: newTest,
        copiedQuestionsCount: questions.length,
    };
};

const copyYearQuestions = async (sourceTestId: string, targetTestId: string) => {
    const [sourceTest, targetTest] = await Promise.all([
        Test.findById(sourceTestId),
        Test.findById(targetTestId),
    ]);

    if (!sourceTest) throw new NotFoundError("Source test not found");
    if (!targetTest) throw new NotFoundError("Target test not found");

    const sourceQuestions = await Question.find({ testIds: sourceTest._id, isActive: true });
    if (sourceQuestions.length === 0) {
        throw new BadRequestError("Source test has no questions to copy");
    }

    const questionIds = sourceQuestions.map((q) => q._id);
    await Question.updateMany(
        { _id: { $in: questionIds } },
        { $addToSet: { testIds: targetTest._id } }
    );

    const totalQuestions = await Question.countDocuments({ testIds: targetTest._id, isActive: true });
    targetTest.totalQuestions = totalQuestions;
    await targetTest.save();

    return {
        message: `Successfully copied ${questionIds.length} questions from ${sourceTest.title} to ${targetTest.title}`,
        totalQuestions,
    };
};

// ── Dropdown / Meta Filter Options ───────────────────────────────────────────

const getQuestionMetaFilters = async () => {
    const [subjects, faculties, departments, distinctYears] = await Promise.all([
        Subject.find({ isActive: true }).select("_id name examType").sort({ name: 1 }).lean(),
        Faculty.find({ isActive: true }).select("_id name").sort({ name: 1 }).lean(),
        Department.find({ isActive: true }).select("_id name faculty").sort({ name: 1 }).lean(),
        Question.distinct("year"),
    ]);

    const sortedYears = (distinctYears.length > 0 ? distinctYears : [2024, 2025, 2026])
        .filter((y): y is number => typeof y === "number")
        .sort((a, b) => b - a);

    return {
        examTypes: [
            { label: "Matura", value: "matura" },
            { label: "Semimatura", value: "semi_matura" },
            { label: "Entrance Exam (Provime)", value: "provime" },
        ],
        years: sortedYears,
        subjects,
        faculties,
        departments,
        difficultyLevels: [
            { label: "Easy", value: "easy" },
            { label: "Medium", value: "medium" },
            { label: "Hard", value: "hard" },
        ],
        accessTypes: [
            { label: "Free", value: "free" },
            { label: "Premium", value: "premium" },
        ],
        statuses: [
            { label: "Published", value: "published" },
            { label: "Draft", value: "draft" },
            { label: "Hidden", value: "hidden" },
            { label: "Archived", value: "archived" },
        ],
    };
};

export const dashboardQuestionService = {
    getQuestionOverview,
    getAllQuestions,
    getQuestionById,
    createQuestion,
    updateQuestion,
    updateQuestionStatus,
    deleteQuestion,
    restoreQuestion,
    permanentDeleteQuestion,
    bulkPermanentDeleteQuestions,
    bulkRestoreQuestions,
    bulkArchiveQuestions,
    getAllTestArchive,
    createTest,
    getTestById,
    updateTest,
    updateTestStatus,
    deleteTest,
    restoreTest,
    permanentDeleteTest,
    bulkPermanentDeleteTests,
    bulkRestoreTests,
    bulkArchiveTests,
    duplicateTest,
    copyYearQuestions,
    createPassage,
    getPassages,
    getPassageById,
    updatePassage,
    togglePassageStatus,
    deletePassage,
    importTestsFromFile,
    getQuestionMetaFilters,
};
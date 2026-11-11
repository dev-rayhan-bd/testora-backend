import csv from 'csv-parser';
import { Readable } from 'stream';
import { filterQuestions, QuestionFilterInput } from "../../../helpers/questionFilter";
import { EXAM_TYPES } from "../../../interfaces";
import { uploadToCloudinary } from "../../cloudinary/uploadImageToCLoudinary";
import { BadRequestError } from "../../errors/request/apiError";
import Department from "../department/department.model";
import Faculty from "../faculty/faculty.model";
import Subject from "../subject/subject.model";
import { IOption, IQuestion, QuestionFiles } from "./question.interface";
import Question from "./question.model";
import { createQuestionSchema, TCreateQuestionPayload } from "./question.zod";

const OPTION_KEYS = ["a", "b", "c", "d"] as const;

// create question
const createQuestion = async (
    payload: TCreateQuestionPayload,
    files?: QuestionFiles
): Promise<IQuestion> => {

    if (payload.examType && (payload.examType === EXAM_TYPES.MATURA || payload.examType === EXAM_TYPES.SEMI_MATURA)) {
        const isExistSubject = await Subject.findOne({ _id: payload.subject, examType: payload.examType }).select("_id");

        if (!isExistSubject) {
            throw new BadRequestError("Subject not found for the given exam type");
        }
    }

    if (payload.examType && (payload.examType === EXAM_TYPES.ENTRANCE_EXAM)) {
        if (payload.subject) {
            const isExistSubject = await Subject.findOne({ _id: payload.subject, examType: payload.examType }).select("_id");
            if (!isExistSubject) {
                throw new BadRequestError("Subject not found for the given exam type");
            }
        }
        const isExistFaculty = await Faculty.findOne({ _id: payload.faculty, examType: payload.examType }).select("_id");

        if (!isExistFaculty) {
            throw new BadRequestError("Faculty not found for the given exam type");
        }
        const deptIds = (Array.isArray(payload.departments) ? payload.departments : [payload.departments]).filter(Boolean) as string[];
        const validDeptsCount = await Department.countDocuments({ _id: { $in: deptIds as any }, faculty: payload.faculty });

        if (validDeptsCount === 0) {
            throw new BadRequestError("Department not found for the given faculty and exam type");
        }
    }

    let options: IOption[] = payload.options;
    if (!options || options.length < 2) {
        throw new BadRequestError("At least 2 options are required");
    }
    if (payload.correctOptionIndex >= options.length) {
        throw new BadRequestError("correctOptionIndex is out of range");
    }

    // duplicate check — same question text + exam_type + year
    const duplicate = await Question.findOne({
        questionText: payload.questionText.trim(),
        examType: payload.examType,
        year: payload.year,
        isActive: true,
    });
    if (duplicate) {
        throw new BadRequestError(
            "A question with the same text, exam type and year already exists"
        );
    }

    // upload question image
    let questionImageUrl: string | undefined;
    if (files?.question_image?.[0]) {
        const uploaded = await uploadToCloudinary(
            files.question_image[0],
            "question_images"
        );
        questionImageUrl = uploaded.secure_url;
    }

    // upload option images and merge into options array
    const finalOptions = await Promise.all(
        options.map(async (option, index) => {
            const key = OPTION_KEYS[index];
            const fileField = `option_${key}_image` as keyof QuestionFiles;
            const file = files?.[fileField]?.[0];

            if (file) {
                const uploaded = await uploadToCloudinary(file, "option_images");
                return { ...option, imageUrl: uploaded.secure_url };
            }
            return option;
        })
    );

    const question = await Question.create({
        ...payload,
        questionText: payload.questionText.trim(),
        questionImageUrl: questionImageUrl,
        options: finalOptions,
    });

    return question;
};

// fetch question
const fetchQuestions = async (
    input: QuestionFilterInput & { page?: number; limit?: number }
) => {
    const { page = 1, limit = 20, ...rest } = input;

    // Tomar proshno onujayi ekhane call hobe
    const query = await filterQuestions(rest);
    const skip = (page - 1) * limit;

    const pipeline: any[] = [
        { $match: query },

        // Subject Join (for all exam types)
        {
            $lookup: {
                from: "subjects",
                localField: "subject",
                foreignField: "_id",
                as: "subjectDetails"
            }
        },
        { $unwind: { path: "$subjectDetails", preserveNullAndEmptyArrays: true } },

        // Faculty Join (for provime)
        {
            $lookup: {
                from: "faculties",
                localField: "faculty",
                foreignField: "_id",
                as: "facultyDetails"
            }
        },
        { $unwind: { path: "$facultyDetails", preserveNullAndEmptyArrays: true } },

        // Department Join (for provime)
        {
            $lookup: {
                from: "departments",
                localField: "departments",
                foreignField: "_id",
                as: "departmentDetails"
            }
        },

        // Passage Join
        {
            $lookup: {
                from: "passages",
                localField: "passage",
                foreignField: "_id",
                as: "passageDetails"
            }
        },
        { $unwind: { path: "$passageDetails", preserveNullAndEmptyArrays: true } },

        { $sort: { createdAt: -1 } },

        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 0,
                            questionId: "$_id",
                            questionText: 1,
                            subjectId: { $ifNull: ["$subjectDetails._id", null] },
                            subjectName: { $ifNull: ["$subjectDetails.name", null] },
                            facultyId: { $ifNull: ["$facultyDetails._id", null] },
                            facultyName: { $ifNull: ["$facultyDetails.name", null] },
                            departments: {
                                $map: {
                                    input: "$departmentDetails",
                                    as: "d",
                                    in: { _id: "$$d._id", name: "$$d.name", slug: "$$d.slug" }
                                }
                            },
                            departmentName: {
                                $cond: {
                                    if: { $gt: [{ $size: { $ifNull: ["$departmentDetails", []] } }, 0] },
                                    then: { $arrayElemAt: ["$departmentDetails.name", 0] },
                                    else: null
                                }
                            },
                            passageTitle: { $ifNull: ["$passageDetails.title", null] },
                            status: 1,
                            year: 1,
                            examType: 1
                        }
                    }
                ],
                totalCount: [{ $count: "count" }]
            }
        }
    ];

    const result = await Question.aggregate(pipeline);

    const questions = result[0].data;
    const total = result[0].totalCount[0]?.count || 0;

    return {
        data: questions,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};


const importQuestionsToDb = async (fileBuffer: Buffer) => {
    const validQuestions: any[] = [];
    const failedRows: any[] = [];
    let rowNumber = 1;

    const stream = Readable.from(fileBuffer.toString());

    await new Promise((resolve, reject) => {
        stream
            .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
            .on('data', (row) => {
                rowNumber++;
                const formattedQuestion = {
                    examType: row.examType?.trim(),
                    year: row.year?.trim(),
                    faculty: row.faculty?.trim() || undefined,
                    departments: row.departments?.trim() || undefined,
                    subjects: row.subjects?.trim() || undefined,
                    source: row.source?.trim(),
                    testType: row.testType?.trim(),
                    access: row.access?.trim(),
                    questionText: row.questionText?.trim(),
                    questionImageUrl: row.questionImageUrl?.trim() || undefined,
                    options: [
                        { text: row['option[0].text']?.trim(), imageUrl: row['option[0].imageUrl']?.trim() || undefined },
                        { text: row['option[1].text']?.trim(), imageUrl: row['option[1].imageUrl']?.trim() || undefined },
                        { text: row['option[2].text']?.trim(), imageUrl: row['option[2].imageUrl']?.trim() || undefined },
                        { text: row['option[3].text']?.trim(), imageUrl: row['option[3].imageUrl']?.trim() || undefined },
                    ],
                    correctOptionIndex: parseInt(row.correctOptionIndex) || 0,
                    explanation: row.explanation?.trim() || undefined,
                    status: row.status?.trim() || 'published',
                };

                const validation = createQuestionSchema.safeParse(formattedQuestion);
                if (validation.success) {
                    validQuestions.push(validation.data);
                } else {
                    failedRows.push({
                        row: rowNumber,
                        data: row, // original CSV row data ta rekhe dilam
                        errors: validation.error.format(),
                    });
                }
            })
            .on('end', resolve)
            .on('error', reject);
    });

    if (validQuestions.length === 0) {
        return { success: false, validCount: 0, failedRows };
    }

    // --- Duplicate Check Logic ---
    const questionTexts = validQuestions.map((q) => q.questionText);
    const existingQuestions = await Question.find({
        questionText: { $in: questionTexts },
        subjects: validQuestions[0].subjects,
        year: { $in: validQuestions.map((q) => q.year) },
    }).select('questionText');

    const existingTextsSet = new Set(existingQuestions.map((q) => q.questionText));

    // Jegulo database-e nai (Insert hobe)
    const finalQuestionsToInsert = validQuestions.filter((q) => !existingTextsSet.has(q.questionText));

    // Jegulo database-e age thekei ache (Skip hobe)
    const skippedQuestions = validQuestions.filter((q) => existingTextsSet.has(q.questionText));

    let insertedResult: any = [];
    if (finalQuestionsToInsert.length > 0) {
        insertedResult = await Question.insertMany(finalQuestionsToInsert);
    }

    return {
        success: true,
        insertedData: insertedResult,     // Notun jegulo database-e gelo
        skippedData: skippedQuestions,    // Jegulo duplicate chilo
        failedData: failedRows,          // Jegulo validation fail korlo
    };
};



export const questionService = {
    createQuestion,
    fetchQuestions,
    importQuestionsToDb
    // getAllQuestions,
    // getQuestionById,
    // updateQuestion,
    // publishQuestion,
    // deleteQuestion,
};
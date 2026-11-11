import mongoose from "mongoose";
import { BadRequestError } from "../app/errors/request/apiError";
import Department from "../app/modules/department/department.model";
import Question from "../app/modules/question/question.model";
import Subject from "../app/modules/subject/subject.model";


export interface QuestionFilterInput {
    examType: "semi_matura" | "matura" | "provime";
    subject: string | string[];
    department?: string | string[];
    year?: number;
}

// ─── Main filter function ─────────────────────────────────────
export const filterQuestions = async (input: QuestionFilterInput) => {
    const { examType, subject, department, year } = input;

    let subjectsArray: string[] = [];
    let departmentsArray: string[] = [];

    if (subject) {
        subjectsArray = Array.isArray(subject) ? (subject as string[]) : [subject as string];
    }

    if (department) {
        departmentsArray = Array.isArray(department) ? (department as string[]) : [department as string];
    }
    console.log({ department })
    // ── semi_matura / matura ──────────────────────────────────
    if (examType === "semi_matura" || examType === "matura") {
        if (!subjectsArray || subjectsArray.length === 0) {
            throw new BadRequestError(
                `At least one subject is required for ${examType}`
            );
        }

        const objectIdSubjects = subjectsArray.filter((s) => mongoose.Types.ObjectId.isValid(s));
        const nameSubjects = subjectsArray.filter((s) => !mongoose.Types.ObjectId.isValid(s));

        const orConditions: any[] = [];
        if (objectIdSubjects.length > 0) orConditions.push({ _id: { $in: objectIdSubjects } });
        if (nameSubjects.length > 0) orConditions.push({ name: { $in: nameSubjects.map(n => new RegExp(`^${n}$`, "i")) } });

        const foundSubjects = await Subject.find({
            ...(orConditions.length > 1 ? { $or: orConditions } : (orConditions[0] || {})),
            examType,
            isActive: true,
        }).select("_id name");

        if (foundSubjects.length === 0) {
            throw new BadRequestError("No matching subjects found");
        }

        const subjectIds = foundSubjects.map((s) => s._id);

        const query: Record<string, unknown> = {
            examType,
            $or: [
                { subject: { $in: subjectIds } },
                { subjects: { $in: subjectIds } }
            ],
            source: { $in: ["archive", "both"] },
        };

        if (input.year) query.year = Number(input.year);
        return query;
    }

    // ── provime ───────────────────────────────────────────────
    if (examType === "provime") {
        const query: Record<string, unknown> = {
            examType,
            source: { $in: ["archive", "both"] },
        };

        if (departmentsArray && departmentsArray.length > 0) {
            const objectIdDepts = departmentsArray.filter((d) => mongoose.Types.ObjectId.isValid(d));
            const nameDepts = departmentsArray.filter((d) => !mongoose.Types.ObjectId.isValid(d));

            const orConditions: any[] = [];
            if (objectIdDepts.length > 0) orConditions.push({ _id: { $in: objectIdDepts } });
            if (nameDepts.length > 0) orConditions.push({ name: { $in: nameDepts.map(n => new RegExp(`^${n}$`, "i")) } });

            const foundDepartments = await Department.find({
                ...(orConditions.length > 1 ? { $or: orConditions } : (orConditions[0] || {})),
                examType,
                isActive: true,
            }).select("_id name");

            if (foundDepartments.length > 0) {
                query.departments = { $in: foundDepartments.map((d) => d._id) };
            }
        }

        if (subjectsArray && subjectsArray.length > 0) {
            const objectIdSubjects = subjectsArray.filter((s) => mongoose.Types.ObjectId.isValid(s));
            const nameSubjects = subjectsArray.filter((s) => !mongoose.Types.ObjectId.isValid(s));

            const orConditions: any[] = [];
            if (objectIdSubjects.length > 0) orConditions.push({ _id: { $in: objectIdSubjects } });
            if (nameSubjects.length > 0) orConditions.push({ name: { $in: nameSubjects.map(n => new RegExp(`^${n}$`, "i")) } });

            const foundSubjects = await Subject.find({
                ...(orConditions.length > 1 ? { $or: orConditions } : (orConditions[0] || {})),
                isActive: true,
            }).select("_id name");

            if (foundSubjects.length > 0) {
                const subIds = foundSubjects.map((s) => s._id);
                query.$or = [
                    { subject: { $in: subIds } },
                    { subjects: { $in: subIds } }
                ];
            }
        }

        if (input.year) query.year = Number(input.year);
        return query;
    }

    throw new BadRequestError("Invalid exam type");
};

// ─── Fetch questions (paginated) ───────────────────────────────
// export const fetchQuestions = async (
//     input: QuestionFilterInput & { page?: number; limit?: number }
// ) => {
//     const { page = 1, limit = 20, ...rest } = input;
//     const query = await filterQuestions(rest);
//     const skip = (page - 1) * limit;

//     const [total, questions] = await Promise.all([
//         Question.countDocuments(query),
//         Question.find(query)
//             .populate("subjects", "name slug")
//             .populate("departments", "name slug")
//             .populate("passage", "passageCode title content")
//             .skip(skip)
//             .limit(limit)
//             .sort({ createdAt: -1 }),
//     ]);

//     return {
//         questions,
//         pagination: {
//             total,
//             page,
//             limit,
//             totalPages: Math.ceil(total / limit),
//         },
//     };
// };

// ─── Fetch random questions (quiz generation) ──────────────────
export const fetchRandomQuestions = async (
    input: QuestionFilterInput & { count: number }
) => {
    const { count, ...rest } = input;

    // quiz generation এ source: practice | both
    const query = await filterQuestions({ ...rest });

    // source override করো quiz এর জন্য
    (query as Record<string, unknown>).source = { $in: ["practice", "both"] };
    (query as Record<string, unknown>).status = "published";

    return Question.aggregate([
        { $match: query },
        { $sample: { size: count } },
    ]);
};
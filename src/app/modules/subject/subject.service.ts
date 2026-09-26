import slugify from "slugify";

import { Types } from "mongoose";
import { TExamTypes, USER_LANGUAGES } from "../../../interfaces";
import { EXAM_TYPES } from "../../../interfaces/index";
import { BadRequestError } from "../../errors/request/apiError";
import Department from "../department/department.model";
import Faculty from "../faculty/faculty.model";
import { ISubject } from "./subject.interface";
import Subject from "./subject.model";
import { TGetSubjectQueryPayload } from "./subject.zod";
import { IUser } from "../user/user.interface";


import Question from "../question/question.model";

const createSubject = async (payload: any) => {
    const isExist = await Subject.findOne({
        name: { $regex: new RegExp(`^${payload.name}$`, 'i') },
        examType: payload.examType,
    });

    if (isExist) {
        throw new BadRequestError(
            `The subject name "${payload.name}" already exists for ${payload.examType}!`
        );
    }
    const generatedSlug = slugify(payload.name, { lower: true, strict: true });

    const subjectData = {
        ...payload,
        nameInEnglish: payload.nameInEnglish || payload.name,
        nameInAlbanian: payload.nameInAlbanian || payload.name,
        slug: generatedSlug,
    };

    const result = await Subject.create(subjectData);
    return result;
};


const getAllSubjects = async (query?: any) => {
    const filter: Record<string, unknown> = { isActive: true };

    if (query?.examType && query.examType !== "all") {
        filter.examType = query.examType;
    }
    if (query?.searchTerm?.trim()) {
        filter.name = { $regex: query.searchTerm.trim(), $options: "i" };
    }

    const result = await Subject.find(filter).sort({ createdAt: -1 });

    const formattedResult = await Promise.all(
        result.map(async (subject) => {
            const questionCount = await Question.countDocuments({
                subject: subject._id,
                isActive: true,
            });
            return {
                _id: subject._id,
                name: subject.name,
                nameInEnglish: subject.nameInEnglish,
                nameInAlbanian: subject.nameInAlbanian,
                slug: subject.slug,
                examType: subject.examType,
                isElective: subject.isElective,
                isActive: subject.isActive,
                questionCount,
                createdAt: subject.createdAt,
            };
        })
    );

    return formattedResult;
};

const updateSubject = async (id: string, payload: any) => {
    const subject = await Subject.findById(id);
    if (!subject) {
        throw new BadRequestError("Subject not found");
    }

    if (payload.name && payload.name !== subject.name) {
        const isExist = await Subject.findOne({
            name: { $regex: new RegExp(`^${payload.name}$`, 'i') },
            examType: payload.examType || subject.examType,
            _id: { $ne: id },
        });
        if (isExist) {
            throw new BadRequestError(`Subject name "${payload.name}" already exists!`);
        }
        payload.slug = slugify(payload.name, { lower: true, strict: true });
    }

    const updated = await Subject.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return updated;
};

const deleteSubject = async (id: string) => {
    const subject = await Subject.findById(id);
    if (!subject) {
        throw new BadRequestError("Subject not found");
    }

    subject.isActive = false;
    await subject.save();
    return { message: "Subject removed successfully" };
};

const getSubjectsOrDepartmentsByExamType = async (user:IUser) => {

    if (user.plan === EXAM_TYPES.MATURA || user.plan === EXAM_TYPES.SEMI_MATURA) {
        const subjects = await Subject.find({ examType: user.plan, isActive: true });
        return subjects.map(subject => ({
            subjectId: subject._id,
            name: user.language === USER_LANGUAGES.ENGLISH ? subject.nameInEnglish : subject.nameInAlbanian,
            slug: subject.slug,
            isElective: subject.isElective
        }));
    }
    else if (user.plan === EXAM_TYPES.ENTRANCE_EXAM) {
        const faculty = await Faculty.findOne({ name: user.faculty, examType: user.plan, isActive: true });
        const departments = await Department.find({ faculty: faculty?._id, examType: user.plan, isActive: true });
        return departments.map(department => ({
            departmentId: department._id,
            name: user.language === USER_LANGUAGES.ENGLISH ? department.nameInEnglish : department.nameInAlbanian,
            slug: department.slug,
        }));
    }

}


const getSubjectsByDepartments = async (user: IUser,departments: Types.ObjectId[]) => {

    const departmentIds = departments.map(id => new Types.ObjectId(id));

    const subjects = await Department.find({ _id: { $in: departmentIds } }).populate('subjects');

    const result: { subjectId: Types.ObjectId; name: string; slug: string }[] = [];

    const seenSubjectIds = new Set<string>();

    subjects.forEach(department => {
        if (department.subjects && Array.isArray(department.subjects)) {
            department.subjects.forEach((subject: any) => {
                const subjectIdStr = subject._id.toString(); 

                if (!seenSubjectIds.has(subjectIdStr)) {
                    seenSubjectIds.add(subjectIdStr); 

                    result.push({
                        subjectId: subject._id,
                        name: user.language === USER_LANGUAGES.ENGLISH ? subject.nameInEnglish : subject.nameInAlbanian,
                        slug: subject.slug
                    });
                }
            });
        }
    });

    return result;
};



export const subjectService = {
    createSubject,
    getAllSubjects,
    updateSubject,
    deleteSubject,
    getSubjectsOrDepartmentsByExamType,
    getSubjectsByDepartments
};
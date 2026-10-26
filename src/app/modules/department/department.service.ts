import slugify from "slugify";

import mongoose from "mongoose";
import { USER_LANGUAGES } from "../../../interfaces";
import { BadRequestError } from "../../errors/request/apiError";
import Faculty from "../faculty/faculty.model";
import { IUser } from "../user/user.interface";
import Department from "./department.model";
import { TCreateDepartmentPayload } from "./department.zod";


const createDepartmentUnderFaculty = async (payload: TCreateDepartmentPayload, faculty: string) => {

    const isFacultyExist = await Faculty.findOne({ _id: faculty });
    if (!isFacultyExist) {
        throw new BadRequestError("Faculty not found");
    }

    const isExist = await Department.findOne({
        name: { $regex: new RegExp(`^${payload.name}$`, 'i') },
        faculty,
        isActive: true,
    });

    if (isExist) {
        throw new BadRequestError(
            `The department name "${payload.name}" already exists `
        );
    }
    const generatedSlug = slugify(payload.name, { lower: true, strict: true });

    // If an inactive department with the same name exists under this faculty, restore/update it
    const inactiveDept = await Department.findOne({
        name: { $regex: new RegExp(`^${payload.name}$`, 'i') },
        faculty,
        isActive: false,
    });

    if (inactiveDept) {
        inactiveDept.name = payload.name;
        inactiveDept.nameInEnglish = payload.nameInEnglish || payload.name;
        inactiveDept.nameInAlbanian = payload.nameInAlbanian || payload.name;
        inactiveDept.slug = generatedSlug;
        inactiveDept.isActive = true;
        await inactiveDept.save();
        return {
            departments: inactiveDept._id,
            name: inactiveDept.name,
            slug: inactiveDept.slug,
            faculty: inactiveDept.faculty,
        };
    }

    const departmentData = {
        ...payload,
        slug: generatedSlug,
        faculty,
    };

    const result = await Department.create(departmentData);
    return {
        departments: result._id,
        name: result.name,
        slug: result.slug,
        faculty: result.faculty,
    };
};


const getAllDepartmentByfaculty = async (user: IUser, faculty: string) => {
    const result = await Department.find({ faculty: new mongoose.Types.ObjectId(faculty), isActive: true });

    const formattedResult = result.map(department => ({
        departments: department._id,
        name: user.language === USER_LANGUAGES.ENGLISH ? department.nameInEnglish : department.nameInAlbanian,
        slug: department.slug,
        faculty: department.faculty,
    }));

    return formattedResult;
};

const getAllDepartmentsDashboard = async (query?: any) => {
    const filter: Record<string, unknown> = { isActive: true };

    if (query?.searchTerm?.trim()) {
        filter.name = { $regex: query.searchTerm.trim(), $options: "i" };
    }
    
    if (query?.faculty) {
        filter.faculty = query.faculty;
    }

    const result = await Department.find(filter).populate('faculty', 'name').sort({ createdAt: -1 });
    return result;
};

const updateDepartment = async (id: string, payload: any) => {
    const department = await Department.findById(id);
    if (!department) {
        throw new BadRequestError("Department not found");
    }

    if (payload.name && payload.name !== department.name) {
        const isExist = await Department.findOne({
            name: { $regex: new RegExp(`^${payload.name}$`, 'i') },
            faculty: department.faculty,
            _id: { $ne: id },
            isActive: true,
        });
        if (isExist) {
            throw new BadRequestError(`Department name "${payload.name}" already exists under this faculty!`);
        }
        payload.slug = slugify(payload.name, { lower: true, strict: true });
    }

    const updated = await Department.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return updated;
};

const deleteDepartment = async (id: string) => {
    const department = await Department.findById(id);
    if (!department) {
        throw new BadRequestError("Department not found");
    }

    department.isActive = false;
    await department.save();
    return { message: "Department removed successfully" };
};


export const departmentService = {
    createDepartmentUnderFaculty,
    getAllDepartmentByfaculty,
    getAllDepartmentsDashboard,
    updateDepartment,
    deleteDepartment,
};
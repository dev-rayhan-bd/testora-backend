import slugify from "slugify";

import { BadRequestError } from "../../errors/request/apiError";

import Faculty from "./faculty.model";
import { TCreateFacultyPayload } from "./faculty.zod";
import { IUser } from "../user/user.interface";
import { USER_LANGUAGES } from "../../../interfaces";


const createFaculty = async (payload: TCreateFacultyPayload) => {
    const isExist = await Faculty.findOne({
        name: { $regex: new RegExp(`^${payload.name}$`, 'i') },
        isActive: true,
    });

    if (isExist) {
        throw new BadRequestError(
            `The faculty name "${payload.name}" already exists `
        );
    }
    const generatedSlug = slugify(payload.name, { lower: true, strict: true });

    // If an inactive faculty with the same name exists, restore/update it
    const inactiveFaculty = await Faculty.findOne({
        name: { $regex: new RegExp(`^${payload.name}$`, 'i') },
        isActive: false,
    });

    if (inactiveFaculty) {
        inactiveFaculty.name = payload.name;
        inactiveFaculty.nameInEnglish = payload.nameInEnglish || payload.name;
        inactiveFaculty.nameInAlbanian = payload.nameInAlbanian || payload.name;
        inactiveFaculty.slug = generatedSlug;
        inactiveFaculty.isActive = true;
        await inactiveFaculty.save();
        return {
            faculty: inactiveFaculty._id,
            name: inactiveFaculty.name,
            slug: inactiveFaculty.slug,
        };
    }

    const facultyData = {
        ...payload,
        slug: generatedSlug,
    };

    const result = await Faculty.create(facultyData);
    return {
        faculty: result._id,
        name: result.name,
        slug: result.slug,
    };
};


const getAllFaculties = async (user:IUser) => {
    console.log(user)
    console.log(user.language, user.email)
    const result = await Faculty.find({ isActive: true }).lean();
    console.log({result})
    const formattedResult = result.map(faculty => ({
        faculty: faculty._id,
        name: user.language === USER_LANGUAGES.ENGLISH ? faculty.nameInEnglish : faculty.nameInAlbanian,
        slug: faculty.slug,
    }));

    return formattedResult;
};

const getAllFacultiesDashboard = async (query?: any) => {
    const filter: Record<string, unknown> = { isActive: true };

    if (query?.searchTerm?.trim()) {
        filter.name = { $regex: query.searchTerm.trim(), $options: "i" };
    }

    const result = await Faculty.find(filter).sort({ createdAt: -1 });
    return result;
};

const updateFaculty = async (id: string, payload: any) => {
    const faculty = await Faculty.findById(id);
    if (!faculty) {
        throw new BadRequestError("Faculty not found");
    }

    if (payload.name && payload.name !== faculty.name) {
        const isExist = await Faculty.findOne({
            name: { $regex: new RegExp(`^${payload.name}$`, 'i') },
            _id: { $ne: id },
            isActive: true,
        });
        if (isExist) {
            throw new BadRequestError(`Faculty name "${payload.name}" already exists!`);
        }
        payload.slug = slugify(payload.name, { lower: true, strict: true });
    }

    const updated = await Faculty.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return updated;
};

const deleteFaculty = async (id: string) => {
    const faculty = await Faculty.findById(id);
    if (!faculty) {
        throw new BadRequestError("Faculty not found");
    }

    faculty.isActive = false;
    await faculty.save();
    return { message: "Faculty removed successfully" };
};

export const facultyService = {
    createFaculty,
    getAllFaculties,
    getAllFacultiesDashboard,
    updateFaculty,
    deleteFaculty,
};
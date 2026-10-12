import { Types } from "mongoose";

export interface IDepartment {
    _id?: Types.ObjectId;
    name: string;
    nameInEnglish: string;
    nameInAlbanian: string;
    slug: string;
    examType: 'provime';
    subjects?: Types.ObjectId[];
    faculty: Types.ObjectId;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
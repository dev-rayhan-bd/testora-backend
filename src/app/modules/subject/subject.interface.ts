import { Types } from "mongoose";
import { TExamTypes } from "../../../interfaces";

export interface ISubject {
    _id?: Types.ObjectId;
    name: string;
    nameInEnglish: string;
    nameInAlbanian: string;
    slug: string;
    examType: TExamTypes;
    isElective: boolean;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
import { Types } from "mongoose";

export interface IFaculty {
    _id?: Types.ObjectId;
    name: string;
    nameInEnglish: string;
    nameInAlbanian: string;
    slug: string;
    examType: "provime";
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
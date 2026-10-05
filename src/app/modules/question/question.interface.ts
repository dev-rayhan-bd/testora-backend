import { Types } from "mongoose";
import { TAccessTypes, TExamTypes, TTestTypes } from "../../../interfaces";
import { TQuestionDifficulty, TQuestionStatus, TSources } from "./question.constant";


export interface IOption {
    text: string;
    imageUrl?: string;
}

export interface QuestionFiles {
    question_image?: Express.Multer.File[];
    option_a_image?: Express.Multer.File[];
    option_b_image?: Express.Multer.File[];
    option_c_image?: Express.Multer.File[];
    option_d_image?: Express.Multer.File[];
    explanation_image?: Express.Multer.File[];
}


export interface IQuestion extends Document {
    examType: TExamTypes;
    year: number;
    subject?: Types.ObjectId;
    faculty?: Types.ObjectId;
    departments?: Types.ObjectId[];
    passage?: Types.ObjectId;
    questionText: string;
    access: TAccessTypes;
    questionImageUrl?: string;
    isMandatory?: boolean;
    options: IOption[];
    correctOptionIndex: number;
    explanation?: string;
    explanationImageUrl?: string;
    status: TQuestionStatus;
    testIds: Types.ObjectId[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
} 
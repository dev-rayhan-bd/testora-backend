import { Types } from "mongoose";
import { TAccessTypes, TExamTypes, TTestTypes } from "../../../interfaces";
import { TTestStatus } from "./test.constant";


export interface ITest {
    _id?: Types.ObjectId;
    title: string;
    examType: TExamTypes;
    testCode: string;
    year: number;
    testType: TTestTypes;
    access: TAccessTypes;
    faculty?: Types.ObjectId;
    departments?: Types.ObjectId[];
    subjects?: Types.ObjectId[];
    questionIds?: Types.ObjectId[];
    electiveSubjects?: Types.ObjectId[]; 
    mandatorySubjects?: Types.ObjectId[]; 
    status?: TTestStatus;
    totalQuestions?: number;
    totalSubjects?: number;
    durationMinutes?: number;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
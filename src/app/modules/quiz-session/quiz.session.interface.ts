import { Types } from "mongoose";
import { TExamTypes } from "../../../interfaces";
import { TQuestionDifficulty } from "../question/question.constant";
import { TQuizStatus } from "./quiz.session.constant";

export interface IQuestionAttempt {
  questionId: Types.ObjectId;
  subjectId: Types.ObjectId;
  selectedOptionIndex: number;
  isCorrect: boolean;
  answeredAt: Date;
}

export interface IQuizSession {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  examType: TExamTypes;
  subjectIds: Types.ObjectId[];
  faculty?: Types.ObjectId;
  departmentIds?: Types.ObjectId[];
  questionIds: Types.ObjectId[];
  totalQuestions: number;
  attempts: IQuestionAttempt[];
  questionSubjectMap: {
    questionId: Types.ObjectId;
    subjectId: Types.ObjectId;
  }[];
  passageQuestionMap: {
    passageId: Types.ObjectId;
    questionIds: Types.ObjectId[];
    start: number;
    end:number;
  }[];
  markedQuestionIds: Types.ObjectId[];
  correctCount: number;   // default: 0
  incorrectCount: number;   // default: 0

  durationSeconds: number;

  currentIndex: number;
  status: TQuizStatus;
  reviewSeenAt?: Date;

  startedAt: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
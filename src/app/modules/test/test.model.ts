import mongoose, { Schema } from "mongoose";
import { ACCESS_TYPES, EXAM_TYPES, TEST_TYPES } from "../../../interfaces";
import { TEST_STATUS } from "./test.constant";
import { ITest } from "./test.interface";


const TestSchema = new Schema<ITest>(
  {
    testCode: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    examType: {
      type: String,
      enum: Object.values(EXAM_TYPES),
      required: true,
    },
    faculty: { type: Schema.Types.ObjectId, ref: "Faculty", required: false },
    year: { type: Number, required: true },
    departments: [{ type: Schema.Types.ObjectId, ref: "Department", required: false }],
    subjects: [{ type: Schema.Types.ObjectId, ref: "Subject", required: false }],
    testType: {
      type: String,
      enum: Object.values(TEST_TYPES),
      required: true,

    },
    electiveSubjects: [{ type: Schema.Types.ObjectId, ref: "Subject", required: false }], // subjects students can choose from (only used when mandatory_elective)
    mandatorySubjects: [{ type: Schema.Types.ObjectId, ref: "Subject", required: false }], // subjects everyone gets (only used when mandatory_elective)
    access: {
      type: String,
      enum: Object.values(ACCESS_TYPES),
      required: true
    },
    status: {
      type: String,
      enum: Object.values(TEST_STATUS),
      default: TEST_STATUS.PUBLISHED,
    },
    totalQuestions: { type: Number, default: 0 },
    durationMinutes: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

TestSchema.index({ examType: 1, year: 1, testType: 1 });
TestSchema.index({ status: 1, isActive: 1 });

const Test = mongoose.model<ITest>("Test", TestSchema);
export default Test;
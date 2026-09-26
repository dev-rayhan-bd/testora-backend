import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Faculty from "../../src/app/modules/faculty/faculty.model";
import Department from "../../src/app/modules/department/department.model";

const MONGODB_URI = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/elearning";

async function fix() {
  console.log("Connecting to MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  await Faculty.updateMany({ examType: "entrance_exam" }, { examType: "provime" });
  await Department.updateMany({ examType: "entrance_exam" }, { examType: "provime" });

  console.log("Done updating examTypes");
  mongoose.disconnect();
}

fix().catch(console.error);

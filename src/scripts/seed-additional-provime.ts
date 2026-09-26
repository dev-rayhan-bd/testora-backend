import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Test from "../../src/app/modules/test/test.model";
import Question from "../../src/app/modules/question/question.model";

const MONGODB_URI = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/elearning";

async function seedAdditionalProvime() {
  console.log("Connecting to MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  const officialTest = await Test.findOne({ testType: 'official', examType: 'provime' });
  if (officialTest) {
    const newTest = await Test.create({ 
      title: officialTest.title + ' (Practice Version)', 
      testCode: officialTest.testCode + '-ADD2', 
      examType: officialTest.examType, 
      year: officialTest.year, 
      testType: 'additional', 
      access: officialTest.access, 
      totalQuestions: officialTest.totalQuestions, 
      subjects: officialTest.subjects, 
      faculty: officialTest.faculty,
      durationMinutes: officialTest.durationMinutes, 
      isActive: true, 
      status: 'published' 
    }); 
    
    await Question.updateMany({ testIds: officialTest._id }, { $push: { testIds: newTest._id } }); 
    console.log('Successfully created an additional entrance exam test!');
  } else {
    console.log('No official entrance exam test found to duplicate.');
  }

  mongoose.disconnect();
}

seedAdditionalProvime().catch(console.error);

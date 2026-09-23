import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Subject from "../../src/app/modules/subject/subject.model";
import Passage from "../../src/app/modules/passage/passage.model";
import Question from "../../src/app/modules/question/question.model";
import Test from "../../src/app/modules/test/test.model";

const MONGODB_URI = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/elearning";

async function seedRealData() {
  console.log("Connecting to MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  // 1. Fetch some existing subjects and passages seeded previously
  const mathSubject = await Subject.findOne({ name: "Matematikë", examType: "matura" });
  const albanianSubject = await Subject.findOne({ name: "Gjuhë Shqipe", examType: "matura" });
  const passage = await Passage.findOne({ passageCode: "P-1001" });

  if (!mathSubject || !albanianSubject) {
    console.error("Subjects not found. Please run seed-data.ts first to populate subjects.");
    process.exit(1);
  }

  // 2. Create a Real Test (Exam Paper)
  console.log("Creating Test: Matura 2024 (Official, Free)");
  let test = await Test.findOne({ testCode: "MAT-2024-OFFICIAL" });
  if (!test) {
    test = await Test.create({
      testCode: "MAT-2024-OFFICIAL",
      title: "Provimi i Maturës Shtetërore 2024 (Zyrtar)",
      examType: "matura",
      year: 2024,
      testType: "official",
      access: "free",
      subjects: [mathSubject._id, albanianSubject._id],
      status: "published",
      isActive: true,
      totalQuestions: 0
    });
    console.log("-> Test Created Successfully!");
  } else {
    console.log("-> Test already exists.");
  }

  // 3. Create Real Questions and link to the Test
  console.log("Seeding Real Questions...");

  const questions = [
    // Mathematics questions (standalone)
    {
      examType: "matura",
      year: 2024,
      access: "free",
      subject: mathSubject._id,
      questionText: "Gjeni derivatin e funksionit f(x) = 3x^2 + 5x - 2.",
      options: [
        { text: "f'(x) = 6x + 5" },
        { text: "f'(x) = 3x + 5" },
        { text: "f'(x) = 6x - 2" },
        { text: "f'(x) = 6x^2 + 5" }
      ],
      correctOptionIndex: 0,
      testIds: [test._id],
      status: "published"
    },
    {
      examType: "matura",
      year: 2024,
      access: "free",
      subject: mathSubject._id,
      questionText: "Zgjidhni ekuacionin: 2x - 4 = 10",
      options: [
        { text: "x = 5" },
        { text: "x = 7" },
        { text: "x = 6" },
        { text: "x = 8" }
      ],
      correctOptionIndex: 1,
      testIds: [test._id],
      status: "published"
    },
    // Albanian Language questions (linked to passage P-1001)
    {
      examType: "matura",
      year: 2024,
      access: "free",
      subject: albanianSubject._id,
      passage: passage?._id || undefined,
      questionText: "Cili është qëllimi kryesor i tekstit të mësipërm?",
      options: [
        { text: "Të përshkruajë luftërat e Rilindjes." },
        { text: "Të tregojë rëndësinë e shoqërive letrare dhe mbrojtjes së të drejtave gjatë Rilindjes Kombëtare." },
        { text: "Të analizojë poezitë e Naim Frashërit." },
        { text: "Të flasë për ekonominë e kohës." }
      ],
      correctOptionIndex: 1,
      testIds: [test._id],
      status: "published"
    },
    {
      examType: "matura",
      year: 2024,
      access: "free",
      subject: albanianSubject._id,
      passage: passage?._id || undefined,
      questionText: "Sipas tekstit, çfarë synonin shoqëritë patriotike?",
      options: [
        { text: "Zhvillimin e tregtisë ndërkombëtare." },
        { text: "Krijimin e perandorive të reja." },
        { text: "Arsimimin në gjuhën amtare dhe mbrojtjen e territoreve." },
        { text: "Asnjëra nga të mësipërmet." }
      ],
      correctOptionIndex: 2,
      testIds: [test._id],
      status: "published"
    }
  ];

  let addedQuestions = 0;
  for (const q of questions) {
    const existing = await Question.findOne({ questionText: q.questionText });
    if (!existing) {
      await Question.create(q);
      addedQuestions++;
      console.log(`+ Created Question: ${q.questionText}`);
    } else {
      console.log(`= Question already exists: ${q.questionText}`);
    }
  }

  // Update total questions in test
  if (addedQuestions > 0) {
    await Test.findByIdAndUpdate(test._id, { $inc: { totalQuestions: addedQuestions } });
    console.log(`\nUpdated Test totalQuestions count by +${addedQuestions}`);
  }

  console.log("\nDONE! Successfully seeded realistic Test and Question data.");
  await mongoose.disconnect();
}

seedRealData().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});

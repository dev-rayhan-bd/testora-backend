import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Subject from "../../src/app/modules/subject/subject.model";
import Question from "../../src/app/modules/question/question.model";
import Test from "../../src/app/modules/test/test.model";
import Blog from "../../src/app/modules/blog/blog.model";

const MONGODB_URI = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/elearning";

async function seedMoreData() {
  console.log("Connecting to MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  // ─────────────────────────────────────────────────────────────────
  // 1. SEED BLOGS
  // ─────────────────────────────────────────────────────────────────
  console.log("Seeding Blogs...");
  const blogs = [
    {
      title: "How to Prepare for the Matura Exam in 30 Days",
      content: "<p>Preparing for the Matura exam requires a lot of dedication and focus. Here are top 5 tips...</p>",
      category: "Matura",
      status: "published",
      publishedAt: new Date(),
    },
    {
      title: "Understanding Semi Matura Mathematics",
      content: "<p>The semi matura mathematics syllabus focuses heavily on algebra and geometry.</p>",
      category: "Semi Matura",
      status: "published",
      publishedAt: new Date(),
    },
    {
      title: "Top Universities and their Entrance Exams",
      content: "<p>Looking to get into top universities? Here is what you need to know about their entrance exams (Provime).</p>",
      category: "Entrance Exams",
      status: "published",
      publishedAt: new Date(),
    }
  ];

  for (const b of blogs) {
    const existing = await Blog.findOne({ title: b.title });
    if (!existing) {
      await Blog.create(b);
      console.log(`Blog created: ${b.title}`);
    } else {
      console.log(`Blog already exists: ${b.title}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. SEED SEMI MATURA TEST & QUESTIONS
  // ─────────────────────────────────────────────────────────────────
  console.log("Seeding Semi Matura Tests & Questions...");
  const smMathSubject = await Subject.findOne({ name: "Matematikë", examType: "semi_matura" });
  if (smMathSubject) {
    let smTest = await Test.findOne({ testCode: "SM-2024-MATH" });
    if (!smTest) {
      smTest = await Test.create({
        testCode: "SM-2024-MATH",
        title: "Testi i Gjysmë Maturës - Matematikë",
        examType: "semi_matura",
        year: 2024,
        testType: "official",
        access: "free",
        subjects: [smMathSubject._id],
        status: "published",
        isActive: true,
        totalQuestions: 0
      });
      console.log("Test Created: Semi Matura Math");
    }

    const smQuestion = await Question.findOne({ examType: "semi_matura", subject: smMathSubject._id });
    if (!smQuestion) {
      const q = await Question.create({
        examType: "semi_matura",
        year: 2024,
        access: "free",
        subject: smMathSubject._id,
        questionText: "Zgjidhni ekuacionin: 2x + 5 = 15",
        options: [
          { text: "x = 5" },
          { text: "x = 10" },
          { text: "x = 2.5" },
          { text: "x = 15" }
        ],
        correctOptionIndex: 0,
        status: "published"
      });
      await Test.findByIdAndUpdate(smTest._id, { $addToSet: { questions: q._id } });
      console.log("Question created for Semi Matura.");
    }
  } else {
    console.log("Subject for Semi Matura not found. Run seed-data.ts first.");
  }

  // ─────────────────────────────────────────────────────────────────
  // 3. SEED ENTRANCE (PROVIME) TEST & QUESTIONS
  // ─────────────────────────────────────────────────────────────────
  console.log("Seeding Entrance (Provime) Tests & Questions...");
  const provimeMathSubject = await Subject.findOne({ name: "Matematikë e Avancuar", examType: "provime" });
  if (provimeMathSubject) {
    let prTest = await Test.findOne({ testCode: "PR-2024-ADV" });
    if (!prTest) {
      prTest = await Test.create({
        testCode: "PR-2024-ADV",
        title: "Provimi Pranues - Matematikë e Avancuar",
        examType: "provime",
        year: 2024,
        testType: "official",
        access: "free",
        subjects: [provimeMathSubject._id],
        status: "published",
        isActive: true,
        totalQuestions: 0
      });
      console.log("Test Created: Entrance Exam (Advanced Math)");
    }

    const prQuestion = await Question.findOne({ examType: "provime", subject: provimeMathSubject._id });
    if (!prQuestion) {
      const q2 = await Question.create({
        examType: "provime",
        year: 2024,
        access: "free",
        subject: provimeMathSubject._id,
        questionText: "Gjeni integralin e pacaktuar të f(x) = 2x.",
        options: [
          { text: "x^2 + C" },
          { text: "2x^2 + C" },
          { text: "x + C" },
          { text: "2 + C" }
        ],
        correctOptionIndex: 0,
        status: "published"
      });
      await Test.findByIdAndUpdate(prTest._id, { $addToSet: { questions: q2._id } });
      console.log("Question created for Entrance Exam.");
    }
  } else {
    console.log("Subject for Provime not found. Run seed-data.ts first.");
  }

  console.log("✅ Seeding completed successfully!");
  mongoose.disconnect();
}

seedMoreData().catch(console.error);

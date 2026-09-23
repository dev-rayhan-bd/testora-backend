import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import slugify from "slugify";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Subject from "../../src/app/modules/subject/subject.model";
import Passage from "../../src/app/modules/passage/passage.model";

const MONGODB_URI = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/elearning";

const maturaSubjects = [
  { name: "Matematikë", nameInEnglish: "Mathematics", nameInAlbanian: "Matematikë", examType: "matura", isElective: false },
  { name: "Gjuhë Shqipe", nameInEnglish: "Albanian Language", nameInAlbanian: "Gjuhë Shqipe dhe Letërsi", examType: "matura", isElective: false },
  { name: "Anglisht", nameInEnglish: "English Language", nameInAlbanian: "Gjuhë Angleze", examType: "matura", isElective: false },
  { name: "Fizikë", nameInEnglish: "Physics", nameInAlbanian: "Fizikë", examType: "matura", isElective: true },
  { name: "Kimi", nameInEnglish: "Chemistry", nameInAlbanian: "Kimi", examType: "matura", isElective: true },
  { name: "Biologji", nameInEnglish: "Biology", nameInAlbanian: "Biologji", examType: "matura", isElective: true },
  { name: "Histori", nameInEnglish: "History", nameInAlbanian: "Histori", examType: "matura", isElective: true },
  { name: "Gjeografi", nameInEnglish: "Geography", nameInAlbanian: "Gjeografi", examType: "matura", isElective: true },
  { name: "TIK", nameInEnglish: "ICT / Informatics", nameInAlbanian: "TIK / Informatikë", examType: "matura", isElective: true },
];

const semiMaturaSubjects = [
  { name: "Matematikë", nameInEnglish: "Mathematics", nameInAlbanian: "Matematikë", examType: "semi_matura", isElective: false },
  { name: "Gjuhë Shqipe", nameInEnglish: "Albanian Language", nameInAlbanian: "Gjuhë Shqipe", examType: "semi_matura", isElective: false },
  { name: "Gjuhë Angleze", nameInEnglish: "English Language", nameInAlbanian: "Gjuhë Angleze", examType: "semi_matura", isElective: false },
  { name: "Fizikë", nameInEnglish: "Physics", nameInAlbanian: "Fizikë", examType: "semi_matura", isElective: false },
  { name: "Kimi", nameInEnglish: "Chemistry", nameInAlbanian: "Kimi", examType: "semi_matura", isElective: false },
  { name: "Biologji", nameInEnglish: "Biology", nameInAlbanian: "Biologji", examType: "semi_matura", isElective: false },
  { name: "Histori", nameInEnglish: "History", nameInAlbanian: "Histori", examType: "semi_matura", isElective: false },
  { name: "Gjeografi", nameInEnglish: "Geography", nameInAlbanian: "Gjeografi", examType: "semi_matura", isElective: false },
];

const provimeSubjects = [
  { name: "Matematikë e Avancuar", nameInEnglish: "Advanced Mathematics", nameInAlbanian: "Matematikë e Avancuar", examType: "provime", isElective: false },
  { name: "Fizikë Teknike", nameInEnglish: "Technical Physics", nameInAlbanian: "Fizikë Teknike", examType: "provime", isElective: false },
  { name: "Bazat e Programimit", nameInEnglish: "Programming Basics", nameInAlbanian: "Bazat e Programimit", examType: "provime", isElective: false },
];

async function seed() {
  console.log("Connecting to MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  console.log("Seeding Subjects...");
  const allToSeed = [...maturaSubjects, ...semiMaturaSubjects, ...provimeSubjects];

  const seededSubjects: Record<string, any> = {};

  for (const s of allToSeed) {
    const slug = slugify(`${s.name}-${s.examType}`, { lower: true, strict: true });
    let existing = await Subject.findOne({ slug });
    if (!existing) {
      existing = await Subject.findOne({ name: s.name, examType: s.examType });
    }

    if (!existing) {
      existing = await Subject.create({
        ...s,
        slug,
        isActive: true,
      });
      console.log(`+ Created subject: ${s.name} (${s.examType})`);
    } else {
      console.log(`= Already exists: ${s.name} (${s.examType})`);
    }

    seededSubjects[`${s.name}_${s.examType}`] = existing;
  }

  console.log("Seeding Sample Passages...");
  const passages = [
    {
      passageCode: "P-1001",
      title: "Lexim dhe Kuptim: Rilindja Kombëtare Shqiptare",
      content: "Periudha e Rilindjes Kombëtare Shqiptare shënon një kthesë të rëndësishme në vetëdijen dhe kulturën e popullit shqiptar. Gjatë kësaj kohe u krijuan shoqëri të shumta letrare dhe patriotike që synonin arsimimin në gjuhën amtare dhe mbrojtjen e të drejtave territoriale.",
      examType: "matura",
      subject: seededSubjects["Gjuhë Shqipe_matura"]?._id,
      year: 2024,
      isActive: true,
    },
    {
      passageCode: "P-1002",
      title: "English Reading Comprehension: Renewable Energy in the 21st Century",
      content: "Renewable energy sources such as solar and wind power are becoming increasingly vital as nations seek to reduce greenhouse gas emissions. Technological innovations in battery storage and smart grid management have dramatically lowered costs globally.",
      examType: "matura",
      subject: seededSubjects["Anglisht_matura"]?._id,
      year: 2025,
      isActive: true,
    },
    {
      passageCode: "P-1003",
      title: "Tekst Letrar: Poezia e Naim Frashërit",
      content: "Naim Frashëri përmes vargjeve të tij madhështore i këndoi dashurisë për atdheun, natyrës së bukur shqiptare dhe rëndësisë së dijes. Veprat e tij si 'Bagëti e Bujqësia' mbeten thesar i çmuar i letërsisë sonë.",
      examType: "semi_matura",
      subject: seededSubjects["Gjuhë Shqipe_semi_matura"]?._id,
      year: 2024,
      isActive: true,
    },
  ];

  for (const p of passages) {
    const existing = await Passage.findOne({ passageCode: p.passageCode });
    if (!existing) {
      await Passage.create(p);
      console.log(`+ Created passage: ${p.passageCode} - ${p.title}`);
    } else {
      console.log(`= Already exists passage: ${p.passageCode}`);
    }
  }

  const subjectCount = await Subject.countDocuments();
  const passageCount = await Passage.countDocuments();
  console.log(`\nDONE! Total Subjects in DB: ${subjectCount}, Total Passages in DB: ${passageCount}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});

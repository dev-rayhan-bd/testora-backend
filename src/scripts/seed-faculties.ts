import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import slugify from "slugify";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Faculty from "../../src/app/modules/faculty/faculty.model";
import Department from "../../src/app/modules/department/department.model";
import Subject from "../../src/app/modules/subject/subject.model";

const MONGODB_URI = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/elearning";

const facultiesData = [
  {
    name: "Fakulteti i Inxhinierisë dhe IT",
    nameInEnglish: "Faculty of Engineering and IT",
    nameInAlbanian: "Fakulteti i Inxhinierisë dhe IT",
    examType: "entrance_exam",
    departments: [
      {
        name: "Inxhinieri Softuerike",
        nameInEnglish: "Software Engineering",
        nameInAlbanian: "Inxhinieri Softuerike",
        examType: "entrance_exam",
        subjects: ["Matematikë e Avancuar", "Bazat e Programimit"],
      },
      {
        name: "Inxhinieri Kompjuterike",
        nameInEnglish: "Computer Engineering",
        nameInAlbanian: "Inxhinieri Kompjuterike",
        examType: "entrance_exam",
        subjects: ["Fizikë Teknike", "Matematikë e Avancuar"],
      }
    ]
  },
  {
    name: "Fakulteti i Mjekësisë",
    nameInEnglish: "Faculty of Medicine",
    nameInAlbanian: "Fakulteti i Mjekësisë",
    examType: "entrance_exam",
    departments: [
      {
        name: "Mjekësi e Përgjithshme",
        nameInEnglish: "General Medicine",
        nameInAlbanian: "Mjekësi e Përgjithshme",
        examType: "entrance_exam",
        subjects: [],
      }
    ]
  }
];

async function seedFacultiesAndDepartments() {
  console.log("Connecting to MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  // Get subjects
  const subjects = await Subject.find({ examType: "entrance_exam" });
  const subjectMap: Record<string, string> = {};
  for (const sub of subjects) {
    subjectMap[sub.name] = sub._id.toString();
  }

  console.log("Seeding Faculties and Departments...");

  for (const facData of facultiesData) {
    let faculty = await Faculty.findOne({ name: facData.name });
    
    if (!faculty) {
      faculty = await Faculty.create({
        name: facData.name,
        nameInEnglish: facData.nameInEnglish,
        nameInAlbanian: facData.nameInAlbanian,
        slug: slugify(facData.name, { lower: true, strict: true }),
        examType: facData.examType
      });
      console.log(`+ Created Faculty: ${faculty.name}`);
    } else {
      console.log(`= Faculty already exists: ${faculty.name}`);
    }

    for (const depData of facData.departments) {
      let department = await Department.findOne({ name: depData.name, faculty: faculty._id });
      
      const depSubjects = depData.subjects
        .map(subName => subjectMap[subName])
        .filter(Boolean); // keep only found subjects

      if (!department) {
        department = await Department.create({
          name: depData.name,
          nameInEnglish: depData.nameInEnglish,
          nameInAlbanian: depData.nameInAlbanian,
          slug: slugify(depData.name, { lower: true, strict: true }),
          faculty: faculty._id,
          examType: depData.examType,
          subjects: depSubjects
        });
        console.log(`  + Created Department: ${department.name}`);
      } else {
        console.log(`  = Department already exists: ${department.name}`);
      }
    }
  }

  console.log("DONE! Successfully seeded Faculties and Departments.");
  process.exit(0);
}

seedFacultiesAndDepartments().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});

import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Test from '../app/modules/test/test.model';
import Question from '../app/modules/question/question.model';
import Subject from '../app/modules/subject/subject.model';

async function migrateAndSync() {
  await mongoose.connect(process.env.MONGODB_URL as string);
  console.log('--- Connected to DB ---');

  // 1. Find chemistry subject
  const kimiSubject = await Subject.findOne({ name: { $regex: /^kimi$/i }, examType: 'provime' });
  console.log('Found Kimi (Chemistry) subject:', kimiSubject?._id, kimiSubject?.name);

  // 2. Fix chemistry questions that missed subject
  if (kimiSubject) {
    const fixedQuestions = await Question.updateMany(
      {
        testIds: new Types.ObjectId('6af1d1130825558f085dd960'),
        $or: [{ subject: { $exists: false } }, { subject: null }],
      },
      {
        $set: { subject: kimiSubject._id },
      }
    );
    console.log(`Updated ${fixedQuestions.modifiedCount} questions for 2016 Medicine test to subject: Kimi`);
  }

  // 3. For EVERY test in DB, sync subjects, departments, faculty and totalQuestions from linked questions
  const allTests = await Test.find({ isActive: true });
  console.log(`\nSyncing metadata for ${allTests.length} tests...`);

  for (const test of allTests) {
    const linkedQuestions = await Question.find({
      testIds: test._id,
      isActive: true,
    }).select('subject departments faculty isMandatory');

    const subjectIdSet = new Set<string>();
    const departmentIdSet = new Set<string>();
    let resolvedFaculty: Types.ObjectId | null = test.faculty || null;

    linkedQuestions.forEach((q) => {
      if (q.subject) {
        subjectIdSet.add(q.subject.toString());
      }
      if (q.departments && Array.isArray(q.departments)) {
        q.departments.forEach((d) => {
          if (d) departmentIdSet.add(d.toString());
        });
      }
      if (q.faculty && !resolvedFaculty) {
        resolvedFaculty = q.faculty as any;
      }
    });

    // If test had pre-existing subjects or departments, preserve them too
    (test.subjects || []).forEach((s) => {
      if (s) subjectIdSet.add(s.toString());
    });
    (test.departments || []).forEach((d) => {
      if (d) departmentIdSet.add(d.toString());
    });

    const finalSubjects = [...subjectIdSet].map((id) => new Types.ObjectId(id));
    const finalDepartments = [...departmentIdSet].map((id) => new Types.ObjectId(id));

    test.subjects = finalSubjects;
    test.departments = finalDepartments;
    test.totalQuestions = linkedQuestions.length;
    if (resolvedFaculty) test.faculty = resolvedFaculty;

    await test.save();

    console.log(`Synced Test "${test.title}" (${test._id}):`);
    console.log(`   Subjects (${test.subjects.length}):`, test.subjects);
    console.log(`   Departments (${test.departments.length}):`, test.departments);
    console.log(`   Total Questions: ${test.totalQuestions}`);
  }

  console.log('\n--- ALL TESTS SYNCED SUCCESSFULLY ---');
  await mongoose.disconnect();
}

migrateAndSync().catch(console.error);


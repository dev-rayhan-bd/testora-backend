
import { Types } from "mongoose";
import { BadRequestError, NotFoundError } from "../../errors/request/apiError";
import Question from "../question/question.model";
import Subscription from "../subscription/subscription.model";
import Test from "../test/test.model";
import { IUser } from "../user/user.interface";
import { QUIZ_STATUS } from "./quiz.session.constant";
import { QuizSession } from "./quiz.session.model";
import { getRemaining, shuffle, sortWithPassage, splitCountBySubject } from "./quiz.session.utils";
import { TFullSimulationPayload, TQuizSessionPayload } from "./quiz.session.zod";
import Department from "../department/department.model";



const getOfficialQuizzes = async (user: IUser, query: Record<string, unknown>) => {
  const { page, limit, departments } = query;

  console.log({departments})
  const pageNumber = parseInt(page as string) || 1;
  const limitNumber = parseInt(limit as string) || 10;
  const skip = (pageNumber - 1) * limitNumber;

  const testQuery: any = {
    examType: user.plan,
    testType: "official",
  };

  // 2. Jodi subjects thake ebong tar moddhe elements thake, tokhon query-te add koro
  if (departments) {
    const departmentsId = await Department.findOne( { name: departments as string }).select("_id").lean();
    console.log({departmentsId})
    testQuery.departments = { $in: [departmentsId] };
  }

  const [quizzes, totalQuizzes] = await Promise.all([
    Test.find(testQuery)
      .select("title totalQuestions subjects departments")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber),
    Test.countDocuments(testQuery)
  ]);

  const totalPages = Math.ceil(totalQuizzes / limitNumber);
  const formattedQuizes = quizzes.map((quiz) => ({
    _id: quiz._id,
    title: quiz.title,
    totalQuestions: quiz.totalQuestions,
    totalSubjects: quiz.subjects.length,
    totalDepartments: quiz.departments.length || undefined,
  }));

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total: totalQuizzes,
      totalPages: totalPages
    },
    data: formattedQuizes
  };
}


// get additional quizzes
const getAdditionalQuizzes = async (user: IUser, query: Record<string, unknown>) => {
  const { page, limit, departments } = query;

  const pageNumber = parseInt(page as string) || 1;
  const limitNumber = parseInt(limit as string) || 10;
  const skip = (pageNumber - 1) * limitNumber;

  const testQuery: any = {
    examType: user.plan,
    testType: "additional",
  };

  // 2. Jodi subjects thake ebong tar moddhe elements thake, tokhon query-te add koro
  if (departments) {
    testQuery.departments = departments;
  }

  const [quizzes, totalQuizzes] = await Promise.all([
    Test.find(testQuery)
      .select("title totalQuestions subjects departments")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber),
    Test.countDocuments(testQuery)
  ]);

  const totalPages = Math.ceil(totalQuizzes / limitNumber);
  const formattedQuizes = quizzes.map((quiz) => ({
    _id: quiz._id,
    title: quiz.title,
    totalQuestions: quiz.totalQuestions,
    totalSubjects: quiz.subjects.length,
    totalDepartments: quiz.departments.length || undefined,
  }));

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total: totalQuizzes,
      totalPages: totalPages
    },
    data: formattedQuizes
  };
}

// get max year and min year

const getYearRange = async () => {
  const result = await Test.aggregate([
    { $group: { _id: null, maxYear: { $max: "$year" }, minYear: { $min: "$year" } } }
  ]);
  console.log({result});
  return result[0] || { maxYear: null, minYear: null };
};

// get mandatory subjects

const getMandatorySubjects = async (user: IUser, testId: string) => {
  // Ekhane populate er por space diye shudhu darkari fields select kora hoyeche
  const test = await Test.findById(testId)
    .populate("mandatorySubjects", "name nameInEnglish nameInAlbanian")
    .populate("electiveSubjects", "name nameInEnglish nameInAlbanian")
    .lean();

  if (!test) throw new NotFoundError("Test not found.");

  const mapSubject = (sub: any) => ({
      _id: sub._id,
      name: user.language === 'english' ? sub.nameInEnglish : sub.nameInAlbanian,
  });

  return {
    mandatorySubjects: user.plan === 'matura' ? (test.mandatorySubjects as any[]).map(mapSubject) : [],
    electiveSubjects: user.plan === 'matura' ? (test.electiveSubjects as any[]).map(mapSubject) : []
  };
};

// start full simulation quiz
const startFullSimulationQuiz = async (user: IUser, testId: string, payload: TFullSimulationPayload) => {

  const existing = await QuizSession.find({
    user: user._id,
    status: QUIZ_STATUS.IN_PROGRESS,
  });
  if (existing.length > 3) {
    throw new BadRequestError(
      "You already have many active quiz sessions. Please complete or wait for them to expire."
    );
  }

  // ── Subscription check ──
  const now = new Date();
  const subscription = await Subscription.findOne({
    user: user._id,
    status: "active",
    endDate: { $gt: now },
  });
  const isPremium = !!subscription;

  // ── Test khuje validate koro ──
  const test = await Test.findOne({
    _id: new Types.ObjectId(testId),
    isActive: true,
  }).lean();

  if (!test) {
    throw new NotFoundError("Test not found.");
  }


  if (!isPremium && test.access === "premium") {
    throw new BadRequestError("This test requires a premium subscription.");
  }

  // ── Test-er testIds array e current test._id ase emon question khujo ──
  const query: any = {
    testIds: test._id,
    status: "published",
    isActive: true,
  };

  // 2. Jodi subjects thake ebong tar moddhe elements thake, tokhon query-te add koro
  if (payload.subjects && payload.subjects.length > 0) {
    query.subject = { $in: payload.subjects.map((id) => new Types.ObjectId(id)) };
  }

  if (payload.departments && payload.departments.length > 0) {
    query.departments = { $in: payload.departments.map((id) => new Types.ObjectId(id)) };
  }

  // 3. Ebar query object-ti find() er moddhe pass kore dao
  const questions = await Question.find(query)
    .select("_id subject passage order")
    .lean();

  if (questions.length === 0) {
    throw new NotFoundError("No active questions available for this test.");
  }

  // ── Shuffle koro (Fisher-Yates) ──
  const shuffled = shuffle(questions);

  // passage questions thakle serial wise sort koro
  const sorted = sortWithPassage(shuffled);

  const questionIds = sorted.map((q) => q._id);
  const totalQuestions = questionIds.length;
  const durationSeconds = totalQuestions * 60; // 1 min per question
  const startedAt = new Date();

  // ── questionSubjectMap ──
  const questionSubjectMap = sorted.map((q) => ({
    questionId: q._id,
    subjectId: q.subject,
  }));

  // ── passageQuestionMap ──
  const passageGroupMap = new Map
    <string,
      { questionIds: Types.ObjectId[]; start: number; end: number }
    >();

  sorted.forEach((q, idx) => {
    if (q.passage) {
      const key = q.passage.toString();
      const position = idx + 1; // 1-based

      if (!passageGroupMap.has(key)) {
        passageGroupMap.set(key, {
          questionIds: [],
          start: position,
          end: position,
        });
      }

      const entry = passageGroupMap.get(key)!;
      entry.questionIds.push(q._id);
      entry.end = position;
    }
  });

  const passageQuestionMap = [...passageGroupMap.entries()].map(
    ([passageId, data]) => ({
      passageId: new Types.ObjectId(passageId),
      questionIds: data.questionIds,
      start: data.start,
      end: data.end,
    })
  );

  const session = await QuizSession.create({
    user: user._id,
    examType: user.plan,
    questionIds,
    totalQuestions,
    durationSeconds,
    correctCount: 0,
    incorrectCount: 0,
    currentIndex: 0,
    markedQuestionIds: [],
    questionSubjectMap,
    passageQuestionMap,
    status: QUIZ_STATUS.IN_PROGRESS,
    startedAt,
  });

  return {
    sessionId: session._id,
    totalQuestions,
    durationSeconds,
    remainingSeconds: durationSeconds,
    currentIndex: 0,
    currentQuestionId: questionIds[0],
  };
};


// start quiz session
const startQuiz = async (user: IUser, payload: TQuizSessionPayload) => {
  const {
    subjectIds, facultyId,
    departmentIds, questionCount, year,
  } = payload;

  // একটাই in_progress session থাকতে পারবে
  const existing = await QuizSession.find({
    user: user._id,
    status: QUIZ_STATUS.IN_PROGRESS,
  });

  if (existing.length > 3) {
    throw new BadRequestError(
      "You already have many active quiz sessions. Please complete or wait for them to expire."
    );
  }

  // ── Subscription check ──
  const now = new Date();
  const subscription = await Subscription.findOne({
    user: user._id,
    status: "active",
    endDate: { $gt: now },
  });
  const isPremium = !!subscription;

  // ── Seen questions — completed + expired থেকে ──
  const seenAgg = await QuizSession.aggregate([
    {
      $match: {
        user: user._id,
        examType: user.plan,
        status: { $in: [QUIZ_STATUS.COMPLETED, QUIZ_STATUS.EXPIRED] },
      },
    },
    { $unwind: "$questionIds" },
    { $group: { _id: null, ids: { $addToSet: "$questionIds" } } },
  ]);
  const seenIds: Types.ObjectId[] = seenAgg[0]?.ids ?? [];

  // ── Subject-wise split: 50q, 3 subjects → [17, 17, 16] ──
  const counts = splitCountBySubject(questionCount, subjectIds.length);

  // base filter —
  const baseFilter: Record<string, unknown> = {
    examType: user.plan,
    status: "published",
    isActive: true,
  };

  // if premium has not free questions
  if (!isPremium) baseFilter.access = "free";
  if (year) baseFilter.year = Number(year);
  if (facultyId) baseFilter.faculty = new Types.ObjectId(facultyId);
  if (departmentIds?.length) {
    baseFilter.departments = {
      $in: departmentIds.map((id: string) => new Types.ObjectId(id)),
    };
  }

  // ── every subject different query ──
  const allQuestions: {
    _id: Types.ObjectId;
    subject: Types.ObjectId;
    passage?: Types.ObjectId;
    order?: number;
  }[] = [];

  for (let i = 0; i < subjectIds.length; i++) {
    const subjectId = new Types.ObjectId(subjectIds[i]);
    const neededCount = counts[i];

    // firstly try to fetch left seen 
    let qs = await Question.aggregate([
      {
        $match: {
          ...baseFilter,
          subject: subjectId,
          _id: { $nin: seenIds },
        },
      },
      { $sample: { size: neededCount } },
      { $project: { _id: 1, subject: 1, passage: 1, order: 1 } },
    ]);

    // pool end — seen reset, take question full pool
    if (qs.length < neededCount) {
      qs = await Question.aggregate([
        {
          $match: {
            ...baseFilter,
            subject: subjectId,
          },
        },
        { $sample: { size: neededCount } },
        { $project: { _id: 1, subject: 1, passage: 1, order: 1 } },
      ]);
    }

    // passage questions serial wise sort
    const sorted = sortWithPassage(qs);
    allQuestions.push(...sorted);
  }

  if (allQuestions.length === 0) {
    throw new NotFoundError("No questions available for the selected filters.");
  }

  const questionIds = allQuestions.map((q) => q._id);
  const totalQuestions = questionIds.length;
  const durationSeconds = totalQuestions * 60; // 1 min per question
  const startedAt = new Date();

  // ── questionSubjectMap ──
  // completeQuiz-এ subject-wise grid-এর জন্য
  // unanswered questions-এরও subject জানা যাবে
  const questionSubjectMap = allQuestions.map((q) => ({
    questionId: q._id,
    subjectId: q.subject,
  }));

  // ── passageQuestionMap ──
  // getQuestion-এ dynamic questionRange calculate করতে লাগবে
  const passageGroupMap = new Map<string, { questionIds: Types.ObjectId[]; start: number; end: number }>();

  allQuestions.forEach((q, idx) => {
    if (q.passage) {
      const key = q.passage.toString();
      const position = idx + 1; // 1-based

      if (!passageGroupMap.has(key)) {
        passageGroupMap.set(key, {
          questionIds: [],
          start: position,
          end: position,
        });
      }

      const entry = passageGroupMap.get(key)!;
      entry.questionIds.push(q._id);
      entry.end = position; // শেষ question-এর position update
    }
  });

  const passageQuestionMap = [...passageGroupMap.entries()].map(
    ([passageId, data]) => ({
      passageId: new Types.ObjectId(passageId),
      questionIds: data.questionIds,
      start: data.start,
      end: data.end,
    })
  );

  const session = await QuizSession.create({
    user: user._id,
    examType: user.plan,
    subjectIds: subjectIds.map((id: string) => new Types.ObjectId(id)),
    ...(facultyId && { faculty: new Types.ObjectId(facultyId) }),
    ...(departmentIds?.length && { departmentIds: departmentIds.map((id: string) => new Types.ObjectId(id)) }),
    ...(year && { year: Number(year) }),
    questionIds,
    totalQuestions,
    durationSeconds,
    correctCount: 0,
    incorrectCount: 0,
    currentIndex: 0,
    markedQuestionIds: [],
    questionSubjectMap,
    passageQuestionMap,
    status: QUIZ_STATUS.IN_PROGRESS,
    startedAt,
  });

  return {
    sessionId: session._id,
    totalQuestions,
    durationSeconds,
    remainingSeconds: durationSeconds,
    currentIndex: 0,
    currentQuestionId: questionIds[0],
  };
};

// submit single answer

// complete quiz session
const completeQuiz = async (sessionId: string, user: IUser) => {
  const session = await QuizSession.findOne({
    _id: new Types.ObjectId(sessionId),
    user: user._id,
  }).populate("questionSubjectMap.subjectId", "name nameInEnglish nameInAlbanian");

  if (!session) throw new NotFoundError("Session not found.");
  if (session.status === "completed") throw new BadRequestError("Quiz already completed.");
  if (session.status === "expired") throw new BadRequestError("Quiz has expired.");

  await QuizSession.updateOne(
    { _id: session._id },
    { $set: { status: "completed", completedAt: new Date() } }
  );

  const skippedCount =
    session.totalQuestions - session.correctCount - session.incorrectCount;

  const scorePercent = Math.round(
    (session.correctCount / session.totalQuestions) * 100
  );

  // ── attempt map — O(1) lookup ──
  const attemptMap = new Map(
    session.attempts.map((a) => [a.questionId.toString(), a])
  );

  // ── questionId → subjectDoc lookup ──
  const questionSubjectLookup = new Map(
    session.questionSubjectMap.map((q) => [
      q.questionId.toString(),
      q.subjectId,
    ])
  );

  // ── subject-wise breakdown — "Results by subject" ──
  const subjectResultMap = new Map
    <string,
      { subjectId: Types.ObjectId; name: string; correct: number; total: number }
    >();

  for (const q of session.questionSubjectMap) {
    const subjectDoc = q.subjectId as any;
    const key = (subjectDoc._id ?? subjectDoc).toString();
    const subjectName = user.language === 'english' ? (subjectDoc.nameInEnglish || subjectDoc.name) : (subjectDoc.nameInAlbanian || subjectDoc.name) || "";

    if (!subjectResultMap.has(key)) {
      subjectResultMap.set(key, {
        subjectId: subjectDoc._id ?? subjectDoc,
        name: subjectName,
        correct: 0,
        total: 0,
      });
    }

    const attempt = attemptMap.get(q.questionId.toString());
    const entry = subjectResultMap.get(key)!;
    entry.total += 1;
    if (attempt?.isCorrect) entry.correct += 1;
  }

  // ── subject-wise grouped questionGroups — grid-এর জন্য ──
  // Physics: [1,2,3...], Chemistry: [11,12,13...]
  const subjectQuestionMap = new Map
    <string,
      {
        subjectId: Types.ObjectId;
        name: string;
        questions: {
          index: number;
          questionId: Types.ObjectId;
          status: "correct" | "incorrect" | "unanswered";
        }[];
      }
    >();

  session.questionIds.forEach((qId, index) => {
    const attempt = attemptMap.get(qId.toString());
    const subjectDoc = questionSubjectLookup.get(qId.toString()) as any;
    const key = (subjectDoc?._id ?? subjectDoc)?.toString() ?? "unknown";
    const name = user.language === 'english' ? (subjectDoc?.nameInEnglish || subjectDoc?.name) : (subjectDoc?.nameInAlbanian || subjectDoc?.name) || "";

    if (!subjectQuestionMap.has(key)) {
      subjectQuestionMap.set(key, {
        subjectId: subjectDoc?._id ?? subjectDoc,
        name,
        questions: [],
      });
    }

    subjectQuestionMap.get(key)!.questions.push({
      index: index + 1,
      questionId: qId,
      status: !attempt
        ? "unanswered"
        : attempt.isCorrect ? "correct" : "incorrect",
    });
  });

  return {
    sessionId: session._id,
    totalQuestions: session.totalQuestions,
    correctCount: session.correctCount,
    incorrectCount: session.incorrectCount,
    skippedCount,
    scorePercent,
    // subject-wise result — "Results by subject"
    subjectResults: [...subjectResultMap.values()],
    // subject-wise grouped grid
    questionGroups: [...subjectQuestionMap.values()],
  };
};

// get quiz review
const getQuestionReview = async (sessionId: string, userId: Types.ObjectId, index: number) => {
  const session = await QuizSession.findOne({
    _id: new Types.ObjectId(sessionId),
    user: userId,
  }).select("status questionIds attempts");

  console.log({ index, sessionId })
  if (!session) throw new NotFoundError("Session not found.");
  if (session.status !== "completed") throw new BadRequestError("Quiz not completed.");

  const questionId = session.questionIds[index - 1];
  if (!questionId) throw new BadRequestError("Invalid index.");

  const question = await Question.findById(questionId)
    .select("questionText questionImageUrl options correctOptionIndex explanation passage subject");
  if (!question) throw new NotFoundError("Question not found.");

  const attempt = session.attempts.find(
    (a) => a.questionId.toString() === questionId.toString()
  );

  console.log({ question, attempt })
  return {
    index,
    questionText: question.questionText,
    questionImage: question.questionImageUrl ?? null,
    options: question.options,
    correctOptionIndex: question.correctOptionIndex,
    explanation: question.explanation ?? null,
    selectedOptionIndex: attempt?.selectedOptionIndex ?? null,
    status: !attempt
      ? "unanswered"
      : attempt.isCorrect ? "correct" : "incorrect",
  };
}

// get quiz session status
const getSessionStatus = async (sessionId: string, userId: Types.ObjectId) => {
  const session = await QuizSession.findOne({
    _id: new Types.ObjectId(sessionId),
    user: userId,
  }).select("-attempts");

  if (!session) throw new NotFoundError("Session not found.");

  return {
    status: session.status,
    remainingSeconds: Math.floor(getRemaining(session)),
    currentIndex: session.currentIndex,
    totalQuestions: session.totalQuestions,
    correctCount: session.correctCount,
    incorrectCount: session.incorrectCount,
  };
}

// get quiz map 
const getQuizMap = async (sessionId: string, userId: Types.ObjectId) => {
  const session = await QuizSession.findOne({
    _id: new Types.ObjectId(sessionId),
    user: userId,
  }).select("status questionIds attempts markedQuestionIds currentIndex totalQuestions");

  if (!session) throw new NotFoundError("Session not found.");
  if (session.status !== "in_progress") throw new BadRequestError("Quiz is not in progress.");

  const answeredMap = new Map(
    session.attempts.map((a) => [a.questionId.toString(), a])
  );
  const markedSet = new Set(
    session.markedQuestionIds.map((id) => id.toString())
  );

  const questions = session.questionIds.map((qId, index) => {
    const qIdStr = qId.toString();
    const attempt = answeredMap.get(qIdStr);
    const isMarked = markedSet.has(qIdStr);
    const isCurrent = index === session.currentIndex;

    // status priority: current > marked > answered > unanswered
    let status: "current" | "marked" | "answered" | "unanswered";
    if (isCurrent) status = "current";
    else if (isMarked) status = "marked";
    else if (attempt) status = "answered";
    else status = "unanswered";

    return {
      index,
      questionId: qId,
      status,
      selectedOptionIndex: attempt?.selectedOptionIndex ?? null,
    };
  });

  return {
    totalQuestions: session.totalQuestions,
    answeredCount: session.attempts.length,
    markedCount: session.markedQuestionIds.length,
    unansweredCount: session.totalQuestions - session.attempts.length,
    questions,
  };
}

// get quiz summary
const getQuizSummary = async (
  sessionId: string,
  userId: Types.ObjectId
) => {
  console.log({ sessionId, userId })
  const session = await QuizSession.findOne({
    _id: new Types.ObjectId(sessionId),
    user: userId,
  }).select("status totalQuestions attempts markedQuestionIds");

  if (!session) throw new NotFoundError("Session not found.");
  if (session.status !== "in_progress") throw new BadRequestError("Quiz is not in progress.");

  const answeredCount = session.attempts.length;
  const markedCount = session.markedQuestionIds.length;
  const unansweredCount = session.totalQuestions - answeredCount;

  return {
    totalQuestions: session.totalQuestions,
    answeredCount,
    unansweredCount,
    markedCount,
  };
};

export const quizSessionService = {
  startQuiz,
  completeQuiz,
  getQuestionReview,
  getSessionStatus,
  getYearRange,
  getQuizMap,
  getMandatorySubjects,
  getQuizSummary,
  getOfficialQuizzes,
  getAdditionalQuizzes,
  startFullSimulationQuiz,
};

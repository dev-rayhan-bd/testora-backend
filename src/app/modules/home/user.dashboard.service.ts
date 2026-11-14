import { QUIZ_STATUS } from "../quiz-session/quiz.session.constant";
import { QuizSession } from "../quiz-session/quiz.session.model";
import { IUser } from "../user/user.interface";
import Question from "../question/question.model";
import Test from "../test/test.model";
import Subject from "../subject/subject.model";
import { EXAM_TYPES, TExamTypes } from "../../../interfaces";

const getExamReadiness = async (user: IUser) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch all completed sessions for this user & plan
    const completedSessions = await QuizSession.find({
        user: user._id,
        examType: user.plan as TExamTypes,
        status: QUIZ_STATUS.COMPLETED,
    })
    .select("correctCount totalQuestions completedAt startedAt durationSeconds testId attempts")
    .sort({ completedAt: 1 })
    .lean();

    const recentSessions = (completedSessions as any[]).filter(
        (s) => s.completedAt && new Date(s.completedAt) >= sevenDaysAgo
    );

    // 1. Stats calculation (last 7 days activity, fallback to completed if no recent)
    const targetSessions = recentSessions.length > 0 ? recentSessions : completedSessions;
    const questionsPracticed = (targetSessions as any[]).reduce((sum, s) => sum + (s.totalQuestions || 0), 0);
    const correctAnswers = (targetSessions as any[]).reduce((sum, s) => sum + (s.correctCount || 0), 0);

    let studyTimeSeconds = 0;
    for (const s of targetSessions as any[]) {
        if (s.completedAt && s.startedAt) {
            const timeDiff = Math.max(0, Math.floor((new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 1000));
            studyTimeSeconds += (s.durationSeconds && s.durationSeconds < 86400) ? Math.min(timeDiff, s.durationSeconds) : timeDiff;
        } else if (s.durationSeconds && s.durationSeconds < 86400) {
            studyTimeSeconds += s.durationSeconds;
        }
    }
    const hours = Math.floor(studyTimeSeconds / 3600);
    const minutes = Math.floor((studyTimeSeconds % 3600) / 60);
    const studyTimeFormatted = `${hours}h ${minutes}m`;

    const mockTestsCompleted = (targetSessions as any[]).filter((s) => s.testId).length;

    // 2. Readiness percent
    const readinessPercent = questionsPracticed > 0 ? Math.round((correctAnswers / questionsPracticed) * 100) : 0;

    // 3. Feedback message
    let feedbackMessage = "You are making good progress. Focus more on weak subjects to improve your score.";
    if (readinessPercent >= 80) {
        feedbackMessage = "Excellent preparation! Keep maintaining this consistency to achieve top scores.";
    } else if (readinessPercent >= 60) {
        feedbackMessage = "You are making good progress. Focus more on weak subjects to improve your score.";
    } else if (readinessPercent >= 40) {
        feedbackMessage = "Steady progress. Increase daily practice and review difficult topics.";
    } else if (readinessPercent > 0) {
        feedbackMessage = "Keep practicing daily to build your confidence and readiness.";
    } else {
        feedbackMessage = "Start practicing quizzes to calculate your exam readiness score.";
    }

    // 4. Subject performance from attempts
    const subjectMap: Record<string, { total: number; correct: number }> = {};
    for (const s of (completedSessions as any[])) {
        if (s.attempts && Array.isArray(s.attempts)) {
            for (const att of s.attempts) {
                if (att.subjectId) {
                    const subId = att.subjectId.toString();
                    if (!subjectMap[subId]) {
                        subjectMap[subId] = { total: 0, correct: 0 };
                    }
                    subjectMap[subId].total += 1;
                    if (att.isCorrect) {
                        subjectMap[subId].correct += 1;
                    }
                }
            }
        }
    }

    let subjects = await Subject.find({
        examType: user.plan as TExamTypes,
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
    })
    .select("_id name nameInEnglish nameInAlbanian")
    .lean();

    if (subjects.length === 0) {
        subjects = await Subject.find({
            examType: user.plan as TExamTypes,
        })
        .select("_id name nameInEnglish nameInAlbanian")
        .lean();
    }

    const subjectPerformance = (subjects as any[]).map((sub) => {
        const stats = subjectMap[sub._id.toString()] || { total: 0, correct: 0 };
        const percent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
        const name = user.language === "english" ? (sub.nameInEnglish || sub.name) : (sub.nameInAlbanian || sub.name);
        return {
            subjectId: sub._id.toString(),
            name,
            percent,
        };
    });

    // 5. Recent progress (last 7 days)
    const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
    const recentProgress = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayLabel = dayLabels[d.getDay()];

        const daySessions = (completedSessions as any[]).filter((s) => {
            if (!s.completedAt) return false;
            return new Date(s.completedAt).toISOString().split("T")[0] === dateStr;
        });

        const dayQuestions = daySessions.reduce((sum, s) => sum + (s.totalQuestions || 0), 0);
        const dayCorrect = daySessions.reduce((sum, s) => sum + (s.correctCount || 0), 0);
        const scorePercent = dayQuestions > 0 ? Math.round((dayCorrect / dayQuestions) * 100) : 0;

        recentProgress.push({
            day: dayLabel,
            date: dateStr,
            scorePercent,
            questionsCount: dayQuestions,
        });
    }

    return {
        readinessPercent,
        feedbackMessage,
        stats: {
            questionsPracticed,
            correctAnswers,
            studyTimeSeconds,
            studyTimeFormatted,
            mockTestsCompleted,
        },
        subjectPerformance,
        recentProgress,
        isCalculated: questionsPracticed > 0,
        totalQuizzes: recentSessions.length,
        basedOn: "last 7 days",
    };
};


const getSubscription = async (user: IUser) => {
    //   const now          = new Date();
    //   const subscription = await Subscription.findOne({
    //     user:    user._id,
    //     status:  "active",
    //     endDate: { $gt: now },
    //   }).select("plan startDate endDate status");

    //   if (!subscription) {
    //     return {
    //       isActive:  false,
    //       plan:      null,
    //       daysLeft:  0,
    //       startDate: null,
    //       endDate:   null,
    //     };
    //   }
    //   let daysLeft = 0
    //   if(subscription.expiryDate) {
    //   daysLeft = Math.ceil(
    //     (subscription.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    //   );
    // }

    return {
        plan: user.plan,
        faculty: user.faculty ? user.faculty : null,
        // daysLeft,
        // startDate: subscription.activatedAt,
        // endDate:   subscription.expiryDate,
    };
};


const getWeakTopics = async (user: IUser) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await QuizSession.aggregate([
        {
            $match: {
                user: user._id,
                examType: user.plan,
                status: QUIZ_STATUS.COMPLETED,
                completedAt: { $gte: sevenDaysAgo },
            },
        },
        { $unwind: "$attempts" },
        {
            $group: {
                _id: "$attempts.subjectId",
                total: { $sum: 1 },
                incorrect: {
                    $sum: { $cond: [{ $eq: ["$attempts.isCorrect", false] }, 1, 0] },
                },
            },
        },
        {
            $project: {
                _id: 0,
                subjectId: "$_id",
                total: 1,
                incorrect: 1,
                incorrectRate: {
                    $round: [
                        { $multiply: [{ $divide: ["$incorrect", "$total"] }, 100] },
                        0,
                    ],
                },
            },
        },

        // ৫০% বা তার বেশি incorrect হলেই weak topic
        { $match: { incorrectRate: { $gte: 50 } } },

        {
            $lookup: {
                from: "subjects",
                localField: "subjectId",
                foreignField: "_id",
                as: "subjectDetails",
            },
        },
        { $unwind: { path: "$subjectDetails", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                subjectId: 1,
                name: "$subjectDetails.name",
                total: 1,
                incorrect: 1,
                incorrectRate: 1,
            },
        },

        // সবচেয়ে weak আগে
        { $sort: { incorrectRate: -1 } },
    ]);

    return { weakTopics: result };
};


const getInProgressSessions = async (user: IUser) => {
    const now = new Date();
    const sessions = await QuizSession.find({
        user: user._id,
        examType: user.plan as TExamTypes,
        status: { $in: [QUIZ_STATUS.IN_PROGRESS] },
    })
        .select("title testId examType subjectIds mode durationSeconds startedAt currentIndex totalQuestions attempts status questionIds updatedAt")
        .populate({
            path: "testId",
            select: "title year mandatorySubjects electiveSubjects",
            populate: [
                { path: "mandatorySubjects", select: "name nameInEnglish nameInAlbanian" },
                { path: "electiveSubjects", select: "name nameInEnglish nameInAlbanian" },
            ],
        })
        .populate("subjectIds", "name nameInEnglish nameInAlbanian")
        .sort({ updatedAt: -1 })
        .lean();

    // Group by testId + elective subject combination to only display the latest attempt
    const seenCombinations = new Set<string>();
    const uniqueSessions: any[] = [];

    for (const s of sessions as any[]) {
        const isUntimed = s.mode === "untimed" || s.durationSeconds >= 86400;
        const expireAt = new Date(s.startedAt).getTime() + s.durationSeconds * 1000;
        const remainingSeconds = isUntimed ? 0 : Math.max(0, (expireAt - now.getTime()) / 1000);

        const isExpired = !isUntimed && (s.status === QUIZ_STATUS.EXPIRED || remainingSeconds <= 0);
        if (isExpired) {
            continue; // Skip expired sessions
        }

        // Generate combination key
        let comboKey = s._id.toString();
        if (s.testId?._id) {
            const sortedSubjects = (s.subjectIds || [])
                .map((sub: any) => (sub._id ? sub._id.toString() : sub.toString()))
                .sort()
                .join("_");
            comboKey = `${s.testId._id}_${sortedSubjects}`;
        }

        if (seenCombinations.has(comboKey)) {
            continue; // Keep only latest attempt for this combination
        }
        seenCombinations.add(comboKey);
        uniqueSessions.push({ ...s, remainingSeconds, isUntimed, isExpired });

        if (uniqueSessions.length >= 5) break;
    }

    const result = uniqueSessions.map((s) => {
        const testDoc = s.testId as any;
        const subjectsList = (s.subjectIds as any[]) || [];

        // Check if elective subject exists in this test
        let electiveSubjectName = "";
        if (testDoc && testDoc.electiveSubjects && Array.isArray(testDoc.electiveSubjects)) {
            const electiveDocs = testDoc.electiveSubjects as any[];
            const electiveSubjectIds = electiveDocs.map((es) => es._id?.toString() || es.toString());
            const matchedElective = subjectsList.find((sub: any) =>
                electiveSubjectIds.includes(sub._id ? sub._id.toString() : sub.toString())
            );
            if (matchedElective) {
                electiveSubjectName = user.language === "albanian"
                    ? (matchedElective.nameInAlbanian || matchedElective.name)
                    : (matchedElective.nameInEnglish || matchedElective.name);
            }
        }

        let title = s.title;
        if (testDoc?.title) {
            title = electiveSubjectName ? `${testDoc.title} – ${electiveSubjectName}` : testDoc.title;
        } else if (!title) {
            const subjectNames = subjectsList
                .map((sub: any) => (user.language === "albanian" ? sub.nameInAlbanian : sub.nameInEnglish) || sub.name)
                .filter(Boolean)
                .join(", ");
            title = subjectNames ? subjectNames : `${s.examType}`;
        }

        // Find the first unanswered question index
        const answeredQuestionSet = new Set((s.attempts || []).map((a: any) => a.questionId.toString()));
        let nextUnansweredIndex = 0;
        if (s.questionIds && s.questionIds.length > 0) {
            for (let i = 0; i < s.questionIds.length; i++) {
                if (!answeredQuestionSet.has(s.questionIds[i].toString())) {
                    nextUnansweredIndex = i;
                    break;
                }
            }
        }

        return {
            sessionId: s._id,
            title,
            examType: s.examType,
            status: s.isExpired ? "expired" : "in_progress",
            currentIndex: s.currentIndex,
            nextUnansweredIndex,
            answeredCount: (s.attempts || []).length,
            totalQuestions: s.totalQuestions,
            remainingSeconds: s.isUntimed ? 0 : Math.floor(s.remainingSeconds),
            isUntimed: s.isUntimed,
            mode: s.mode || (s.isUntimed ? "untimed" : "timed"),
            startedAt: s.startedAt,
        };
    });

    return { sessions: result };
};


const getRecentActivity = async (user: IUser) => {
  const sessions = await QuizSession.find({
    user:     user._id,
    examType: user.plan as TExamTypes,
    status:   QUIZ_STATUS.COMPLETED,
  })
    .select("title testId examType subjectIds correctCount totalQuestions completedAt")
    .populate("testId", "title year")
    .populate("subjectIds", "name nameInEnglish nameInAlbanian")
    .sort({ completedAt: -1 })
    .limit(10)
    .lean();
 
  const now    = new Date();
  const result = (sessions as any[]).map((s) => {
    const scorePercent = Math.round(
      (s.correctCount / s.totalQuestions) * 100
    );
 
    // time ago
    const diffMs      = now.getTime() - new Date(s.completedAt!).getTime();
    const diffMins    = Math.floor(diffMs / 60000);
    const diffHours   = Math.floor(diffMins / 60);
    const diffDays    = Math.floor(diffHours / 24);
 
    let timeAgo: string;
    if (diffMins < 60)        timeAgo = `${diffMins} min ago`;
    else if (diffHours < 24)  timeAgo = `${diffHours} hour ago`;
    else                      timeAgo = `${diffDays} day ago`;
 
    // subject names
    const subjectNames = (s.subjectIds as any[])
      ? (s.subjectIds as any[])
          .map((sub: any) => (user.language === 'english' ? sub.nameInEnglish : sub.nameInAlbanian) || sub.name)
          .filter(Boolean)
          .join(", ")
      : "";

    const title = (s.testId as any)?.title || s.title || (subjectNames ? subjectNames : s.examType);
 
    return {
      sessionId:     s._id,
      title,
      subjectNames:  subjectNames || title,
      scorePercent,
      score:         `${s.correctCount}/${s.totalQuestions}`,
      completedAt:   s.completedAt,
      timeAgo,
    };
  });
 
  return { activities: result };
};

export const userDashboardService = {
    getExamReadiness,
    getWeakTopics,
    getInProgressSessions,
    getRecentActivity,
    getSubscription,
    getPlatformStats
}


/**
 * Public-facing platform statistics for landing/home page.
 * Returns: total questions, total tests, total subjects, practice modes count.
 */
async function getPlatformStats() {
  const [totalQuestions, totalTests, totalSubjects] = await Promise.all([
    Question.countDocuments({ isActive: true }),
    Test.countDocuments({ isActive: true }),
    Subject.countDocuments({ isActive: true }),
  ]);

  // Practice modes = number of distinct exam types (semi_matura, matura, provime)
  const practiceModes = Object.values(EXAM_TYPES).length;

  return {
    practiceQuestions: totalQuestions,
    fullExamTests: totalTests,
    subjectsCovered: totalSubjects,
    practiceModes,
  };
}
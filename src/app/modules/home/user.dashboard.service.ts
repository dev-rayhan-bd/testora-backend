import { QUIZ_STATUS } from "../quiz-session/quiz.session.constant";
import { QuizSession } from "../quiz-session/quiz.session.model";
import { IUser } from "../user/user.interface";
import Question from "../question/question.model";
import Test from "../test/test.model";
import Subject from "../subject/subject.model";
import { EXAM_TYPES } from "../../../interfaces";

const getExamReadiness = async (user: IUser) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const sessions = await QuizSession.find({
        user: user._id,
        examType: user.plan,
        status: QUIZ_STATUS.COMPLETED,
        completedAt: { $gte: sevenDaysAgo },
    }).select("correctCount totalQuestions completedAt");

    if (sessions.length === 0) {
        return {
            readinessPercent: 0,
            totalQuizzes: 0,
            basedOn: "last 7 days",
        };
    }

    const totalCorrect = sessions.reduce((sum, s) => sum + s.correctCount, 0);
    const totalQuestions = sessions.reduce((sum, s) => sum + s.totalQuestions, 0);
    const readinessPercent = Math.round((totalCorrect / totalQuestions) * 100);

    return {
        readinessPercent,
        totalQuizzes: sessions.length,
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
        examType: user.plan,
        status: { $in: [QUIZ_STATUS.IN_PROGRESS] },
    })
        .select("examType subjectIds durationSeconds startedAt currentIndex totalQuestions status")
        .populate("subjectIds", "name")
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean();

        console.log({sessions});

    const result = sessions.map((s) => {
        // wall clock remaining
        const expireAt = new Date(s.startedAt).getTime() + s.durationSeconds * 1000;
        const remainingSeconds = Math.max(0, (expireAt - now.getTime()) / 1000);

        // expired check — wall clock দিয়ে
        const isExpired =
            s.status === QUIZ_STATUS.EXPIRED || remainingSeconds <= 0;

        // title — "2026 Semi-Matura · Math, Physics"
        const subjectNames = (s.subjectIds as any[])
            .map((sub) => sub.name)
            .join(", ");
        console.log(`Session ${s._id} subjects: ${subjectNames}`);
        const title = `${s.examType}`;

        return {
            sessionId: s._id,
            title,
            examType: s.examType,
            status: isExpired ? "expired" : "in_progress",
            currentIndex: s.currentIndex,
            totalQuestions: s.totalQuestions,
            remainingSeconds: isExpired ? 0 : Math.floor(remainingSeconds),
            startedAt: s.startedAt,
        };
    });

    return { sessions: result };
};


const getRecentActivity = async (user: IUser) => {
  const sessions = await QuizSession.find({
    user:     user._id,
    examType: user.plan,
    status:   QUIZ_STATUS.COMPLETED,
  })
    .select("subjectIds correctCount totalQuestions completedAt")
    .populate("subjectIds", "name")
    .sort({ completedAt: -1 })
    .limit(10)
    .lean();
 
  const now    = new Date();
  const result = sessions.map((s) => {
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
      .map((sub) => sub.name)
      .join(", ");
 
    return {
      sessionId:     s._id,
      subjectNames,
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
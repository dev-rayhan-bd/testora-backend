import { Types } from "mongoose";
import { QuizSession } from "../../app/modules/quiz-session/quiz.session.model";
import { BadRequestError, NotFoundError } from "../../app/errors/request/apiError";
import { getRemaining } from "../../app/modules/quiz-session/quiz.session.utils";
import { QUIZ_STATUS } from "../../app/modules/quiz-session/quiz.session.constant";


const joinQuiz = async (sessionId: string, userId: Types.ObjectId) => {
    const session = await QuizSession.findOne({
      _id:  new Types.ObjectId(sessionId),
      user: userId,
    });
 
    if (!session)                       throw new NotFoundError("Session not found.");
    if (session.status === QUIZ_STATUS.COMPLETED) throw new BadRequestError("Quiz already completed.");
    if (session.status === QUIZ_STATUS.EXPIRED)   throw new BadRequestError("Quiz has expired.");
 
    const isUntimed = session.mode === "untimed" || session.durationSeconds >= 86400;
    const remaining = isUntimed ? 0 : getRemaining(session);
    if (!isUntimed && remaining <= 0) {
      await QuizSession.updateOne(
        { _id: session._id },
        { $set: { status: QUIZ_STATUS.EXPIRED, completedAt: new Date() } }
      );
      throw new BadRequestError("quiz already expired");
    }
 
    return {
      sessionId:         session._id,
      totalQuestions:    session.totalQuestions,
      durationSeconds:   session.durationSeconds,
      remainingSeconds:  isUntimed ? 0 : Math.floor(remaining),
      isUntimed,
      mode:              session.mode || (isUntimed ? "untimed" : "timed"),
      currentIndex:      session.currentIndex,
      currentQuestionId: session.questionIds[session.currentIndex],
      correctCount:      session.correctCount,
      incorrectCount:    session.incorrectCount,
    };
  }

  export default joinQuiz;
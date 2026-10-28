import { Types } from "mongoose";
import { QuizSession } from "../../app/modules/quiz-session/quiz.session.model";
import { getRemaining } from "../../app/modules/quiz-session/quiz.session.utils";
import { BadRequestError, NotFoundError } from "../../app/errors/request/apiError";
import Question from "../../app/modules/question/question.model";

export interface SubmitAnswerPayload {
  sessionId:           string;
  questionId:          string;
  selectedOptionIndex: number;
}

 const submitAnswer = async (user: { _id: Types.ObjectId }, payload: SubmitAnswerPayload) => {
    const { sessionId, questionId, selectedOptionIndex } = payload;
 
    const session = await QuizSession.findOne({
      _id:  new Types.ObjectId(sessionId),
      user: user._id,
    });
 
    if (!session)                         throw new NotFoundError("Session not found.");
    if (session.status !== "in_progress") throw new BadRequestError("Quiz is not in progress.");
 
    const isUntimed = session.mode === "untimed" || session.durationSeconds >= 86400;
    const remaining = isUntimed ? 0 : getRemaining(session);
    if (!isUntimed && remaining <= 0) {
      await QuizSession.updateOne(
        { _id: session._id },
        { $set: { status: "expired", completedAt: new Date() } }
      );
      throw new BadRequestError("QUIZ_EXPIRED");
    }
 
    const question = await Question.findById(questionId)
      .select("correctOptionIndex subject");
    if (!question) throw new NotFoundError("Question not found.");
 
    const isCorrect = question.correctOptionIndex === selectedOptionIndex;
    const now       = new Date();
 
    // আগে answer দিয়েছে কিনা check
    const existingAttemptIndex = session.attempts.findIndex(
      (a) => a.questionId.toString() === questionId
    );
 
    if (existingAttemptIndex === -1) {
      // নতুন answer — push
      await QuizSession.updateOne(
        { _id: session._id },
        {
          $push: {
            attempts: {
              questionId:          new Types.ObjectId(questionId),
              subjectId:           question.subject,
              selectedOptionIndex,
              isCorrect,
              answeredAt:          now,
            },
          },
          $inc: {
            correctCount:   isCorrect ? 1 : 0,
            incorrectCount: isCorrect ? 0 : 1,
          },
        }
      );
    } else {
      // আগের answer ছিল — update করো, counter adjust করো
      const prevAttempt  = session.attempts[existingAttemptIndex];
      const wasCorrect   = prevAttempt.isCorrect;
 
      // counter delta: আগেরটা সরিয়ে নতুনটা যোগ
      const correctDelta   = (isCorrect ? 1 : 0) - (wasCorrect ? 1 : 0);
      const incorrectDelta = (isCorrect ? 0 : 1) - (wasCorrect ? 0 : 1);
 
      await QuizSession.updateOne(
        {
          _id: session._id,
          "attempts.questionId": new Types.ObjectId(questionId),
        },
        {
          $set: {
            [`attempts.${existingAttemptIndex}.selectedOptionIndex`]: selectedOptionIndex,
            [`attempts.${existingAttemptIndex}.isCorrect`]:           isCorrect,
            [`attempts.${existingAttemptIndex}.answeredAt`]:          now,
          },
          $inc: {
            correctCount:   correctDelta,
            incorrectCount: incorrectDelta,
          },
        }
      );
    }
 
    return {
      isCorrect,
      correctOptionIndex: question.correctOptionIndex,
      remainingSeconds:   isUntimed ? 0 : Math.floor(remaining),
      isUpdated:          existingAttemptIndex !== -1, // update ছিল কিনা frontend জানবে
    };
  }

  export default submitAnswer;
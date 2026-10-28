
import { Types } from 'mongoose';
import { Server as IOServer, Socket } from 'socket.io';
import getQuestion from './quiz/getQuestion';
import joinQuiz from './quiz/joinQuiz';
import leaveReviewPage from './quiz/leaveReviewPage';
import navigateQuestion from './quiz/navigateQuestion';
import submitAnswer from './quiz/submitAnswer';
import toggleMarkQuestion from './quiz/toggleMarkQuestion';
import { SOCKET_EVENTS } from './socket.constant';
import expireSession from './quiz/expireQuizSession';


//
export const handleQuizEvents = (
  _io: IOServer,
  socket: Socket,
  userId: string,
): void => {

  // ── join_quiz ─────────────────────────────
  socket.on(
    SOCKET_EVENTS.JOIN_QUIZ,
    async ({ sessionId }: { sessionId: string }) => {
      try {
        const data = await joinQuiz(sessionId, new Types.ObjectId(userId));

        socket.emit(SOCKET_EVENTS.QUIZ_JOINED, {
          remainingSeconds: data.remainingSeconds,
          isUntimed: data.isUntimed,
          mode: data.mode,
          currentIndex: data.currentIndex,
          totalQuestions: data.totalQuestions,
          correctCount: data.correctCount,
          incorrectCount: data.incorrectCount,
        });

        const question = await getQuestion(
          sessionId,
          new Types.ObjectId(userId),
          data.currentIndex
        );
        socket.emit(SOCKET_EVENTS.QUESTION, question);

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (msg.includes("expired") || msg.includes("QUIZ_EXPIRED")) {
          socket.emit(SOCKET_EVENTS.QUIZ_EXPIRED, { message: "Time is up." });
        } else if (msg.includes("completed")) {
          socket.emit(SOCKET_EVENTS.QUIZ_COMPLETED, { message: "Quiz already completed." });
        } else {
          socket.emit(SOCKET_EVENTS.ERROR, { message: msg });
        }
      }
    }
  );

  // ── submit_answer ─────────────────────────
  // answer নেই → insert, আগে থাকলে → update
  // Submit বাটন চাপার আগ পর্যন্ত যেকোনো সময় change করা যাবে
  socket.on(
    SOCKET_EVENTS.SUBMIT_ANSWER,
    async ({
      sessionId,
      questionId,
      selectedOptionIndex,
    }: {
      sessionId: string;
      questionId: string;
      selectedOptionIndex: number;
    }) => {
      try {
        const result = await submitAnswer(
          { _id: new Types.ObjectId(userId) },
          { sessionId, questionId, selectedOptionIndex }
        );

        socket.emit(SOCKET_EVENTS.ANSWER_RESULT, {
          questionId,
          remainingSeconds: result.remainingSeconds,
          isUpdated: result.isUpdated,
        });

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (msg.includes("QUIZ_EXPIRED") || msg.includes("expired")) {
          socket.emit(SOCKET_EVENTS.QUIZ_EXPIRED, { message: "Time is up." });
        } else {
          socket.emit(SOCKET_EVENTS.ERROR, { message: msg });
        }
      }
    }
  );


  socket.on(
    SOCKET_EVENTS.GET_QUESTION,
    async ({ sessionId, index }: { sessionId: string; index: number }) => {
      try {
        const question = await getQuestion(
          sessionId,
          new Types.ObjectId(userId),
          index
        );
        socket.emit(SOCKET_EVENTS.QUESTION, question);
      } catch (err: unknown) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  );


  // ── navigate_question ─────────────────────
  // user Navigate modal থেকে যেকোনো question-এ jump করলে
  socket.on(
    SOCKET_EVENTS.NAVIGATE_QUESTION,
    async ({ sessionId, index }: { sessionId: string; index: number }) => {
      try {
        const question = await navigateQuestion(
          sessionId,
          new Types.ObjectId(userId),
          index
        );
        socket.emit(SOCKET_EVENTS.QUESTION, question);
      } catch (err: unknown) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  );

  // ── mark_question ─────────────────────────
  // question mark/unmark toggle
  socket.on(
    SOCKET_EVENTS.MARK_QUESTION,
    async ({ sessionId, questionId }: { sessionId: string; questionId: string }) => {
      try {
        const result = await toggleMarkQuestion(
          sessionId,
          new Types.ObjectId(userId),
          questionId
        );
        socket.emit(SOCKET_EVENTS.MARK_UPDATED, result);
      } catch (err: unknown) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  );

  // ── get_quiz_map ──────────────────────────
  // Navigate modal খুললে — সব question-এর status

  socket.on(
    SOCKET_EVENTS.EXPIRE_QUIZ,
    async ({ sessionId }: { sessionId: string }) => {
      try {
        await expireSession(sessionId, new Types.ObjectId(userId));
        socket.emit(SOCKET_EVENTS.QUIZ_EXPIRED, { message: "Time is up." });
      } catch {
        // silent
      }
    }
  );

  // ── leave_review ──────────────────────────
  // review page থেকে বেরিয়ে গেলে — reviewSeenAt lock
  socket.on(
    SOCKET_EVENTS.LEAVE_REVIEW,
    async ({ sessionId }: { sessionId: string }) => {
      try {
        await leaveReviewPage(sessionId, new Types.ObjectId(userId));
      } catch {
        // silent
      }
    }
  );
};

export default handleQuizEvents;

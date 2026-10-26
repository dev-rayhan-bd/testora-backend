import { Types } from "mongoose";
import { BadRequestError, NotFoundError } from "../../app/errors/request/apiError";
import Question from "../../app/modules/question/question.model";
import { QuizSession } from "../../app/modules/quiz-session/quiz.session.model";



const getQuestion = async (sessionId: string, userId: Types.ObjectId, index: number) => {
  const session = await QuizSession.findOne({
    _id: new Types.ObjectId(sessionId),
    user: userId,
  }).select("status questionIds totalQuestions attempts markedQuestionIds passageQuestionMap");

  if (!session) throw new NotFoundError("Session not found.");
  if (session.status !== "in_progress") throw new BadRequestError("Quiz is not in progress.");
  if (index >= session.totalQuestions) throw new BadRequestError("No more questions.");

  const questionId = session.questionIds[index];

  const question = await Question.findById(questionId)
    .select("-correctOptionIndex -explanation -status -isActive -createdAt -updatedAt")
    .populate("passage", "title content passageImageUrl passageCode")
    .populate("subject", "name nameInEnglish nameInAlbanian slug");
  if (!question) throw new NotFoundError("Question not found.");

  const existingAttempt = session.attempts.find(
    (a) => a.questionId.toString() === questionId.toString()
  );

  const isMarked = session.markedQuestionIds.some(
    (id) => id.toString() === questionId.toString()
  );

  // ── Previous question ──
  let previousQuestion = null;
  if (index > 0) {
    const prevQuestionId = session.questionIds[index - 1];
    const prevAttempt = session.attempts.find(
      (a) => a.questionId.toString() === prevQuestionId.toString()
    );
    previousQuestion = {
      index: index - 1,
      questionId: prevQuestionId,
      selectedOptionIndex: prevAttempt?.selectedOptionIndex ?? null,
    };
  }

  // ── Passage ──
  // passageQuestionMap থেকে range নাও — DB query নেই
  let passageData = null;
  if (question.passage) {
    const passageObj = question.passage as any;
    const passageId = passageObj._id.toString();

    const passageMapEntry = session.passageQuestionMap?.find(
      (p) => p.passageId.toString() === passageId
    );

    // এই passage-এর প্রথম question কিনা
    const isFirstOfPassage = passageMapEntry
      ? index + 1 === passageMapEntry.start   // start 1-based
      : false;

    passageData = {
      _id: passageObj._id,
      passageCode: passageObj.passageCode ?? null,
      title: isFirstOfPassage ? (passageObj.title ?? null) : null,
      content: isFirstOfPassage ? (passageObj.content ?? null) : null,
      passageImageUrl: isFirstOfPassage ? (passageObj.passageImageUrl ?? null) : null,
      questionRange: passageMapEntry
        ? { from: passageMapEntry.start, to: passageMapEntry.end }
        : null,
    };
  }

  return {
    index,
    totalQuestions: session.totalQuestions,
    questionId: question._id,
    questionText: question.questionText,
    questionImage: question.questionImageUrl ?? null,
    subject: question.subject ? {
      _id: (question.subject as any)._id,
      name: (question.subject as any).name,
      nameInEnglish: (question.subject as any).nameInEnglish,
      nameInAlbanian: (question.subject as any).nameInAlbanian,
      slug: (question.subject as any).slug,
    } : null,
    options: question.options,
    passage: passageData,
    selectedOptionIndex: existingAttempt?.selectedOptionIndex ?? null,
    isMarked,
    previousQuestion,
  };
};


export default getQuestion;
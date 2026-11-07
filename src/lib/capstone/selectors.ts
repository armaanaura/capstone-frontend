import type { Prerequisite, Progress, Question, QuestionEdge, QuestionStatus } from "./types";

export function unmetPrerequisites(id: string, rules: Prerequisite[], progress: Progress): string[] {
  return (rules.find((rule) => rule.questionId === id)?.requires ?? [])
    .filter((requiredId) => !progress.completedIds.includes(requiredId));
}

export function questionStatus(id: string, rules: Prerequisite[], progress: Progress): QuestionStatus {
  if (progress.completedIds.includes(id)) return "completed";
  if (unmetPrerequisites(id, rules, progress).length) return "locked";
  return progress.currentQuestionId === id ? "current" : "available";
}

export function questionEdges(questions: Question[], rules: Prerequisite[]): QuestionEdge[] {
  const ids = new Set(questions.map((question) => question.id));
  return rules.filter((rule) => ids.has(rule.questionId)).flatMap((rule) =>
    rule.requires.map((source) => {
      if (!ids.has(source)) throw new Error(`Missing prerequisite: ${source}`);
      return { id: `${source}--${rule.questionId}`, source, target: rule.questionId };
    }),
  );
}

export function progressSummary(questions: Question[], progress: Progress) {
  const completed = questions.filter((question) => progress.completedIds.includes(question.id)).length;
  return { completed, total: questions.length, percent: questions.length ? Math.round(completed / questions.length * 100) : 0 };
}

export function currentQuestion(questions: Question[], rules: Prerequisite[], progress: Progress) {
  return questions.find((question) => questionStatus(question.id, rules, progress) === "current")
    ?? questions.find((question) => questionStatus(question.id, rules, progress) === "available")
    ?? questions.at(-1);
}

export const statusLabels: Record<QuestionStatus, string> = {
  completed: "Completed",
  current: "Continue",
  available: "Available",
  locked: "Locked",
};

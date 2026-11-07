export type QuestionStatus = "completed" | "current" | "available" | "locked";
export type Difficulty = "Easy" | "Medium" | "Hard";

export interface Topic {
  id: string;
  title: string;
  abbreviation: string;
  capstoneId: string;
}

export interface Capstone {
  id: string;
  topicId: string;
  title: string;
  description: string;
  questionIds: string[];
}

export interface Question {
  id: string;
  capstoneId: string;
  number: number;
  title: string;
  story: string;
  difficulty: Difficulty;
  concept: string;
}

export interface Prerequisite {
  questionId: string;
  requires: string[];
}

export interface Progress {
  capstoneId: string;
  completedIds: string[];
  currentQuestionId: string | null;
}

export interface QuestionEdge {
  id: string;
  source: string;
  target: string;
}

export interface OpenQuestionPayload {
  topicId: string;
  capstoneId: string;
  questionId: string;
}

export interface CapstoneData {
  topics: Topic[];
  capstones: Capstone[];
  questions: Question[];
  prerequisites: Prerequisite[];
  progress: Progress[];
}

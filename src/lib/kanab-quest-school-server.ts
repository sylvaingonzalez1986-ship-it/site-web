import "server-only";
import { randomInt } from "node:crypto";
import { getKqSchoolModule } from "./kanab-quest-school-content";
import { getKqSchoolAnswer } from "./kanab-quest-school-answers";
import { isKqSchoolQuizId, type KqSchoolCorrection, type KqSchoolQuiz, type KqSchoolSubmission } from "./kanab-quest-school";
import { VERSION as HISTORY_VERSION } from "./kanab-quest-school-history";
import { createKqSchoolHistorySelection, selectKqSchoolHistoryQuestions } from "./kanab-quest-school-history-selection";
import { VERSION as BOTANY_VERSION } from "./kanab-quest-school-botany";
import { createKqSchoolBotanySelection, selectKqSchoolBotanyQuestions } from "./kanab-quest-school-botany-selection";
import { VERSION as TERPENES_VERSION } from "./kanab-quest-school-terpenes";
import { createKqSchoolTerpenesSelection, selectKqSchoolTerpenesQuestions } from "./kanab-quest-school-terpenes-selection";
import { CANNABINOID_VERSION } from "./kanab-quest-school-cannabinoids";
import { createKqSchoolCannabinoidsSelection, selectKqSchoolCannabinoidsQuestions } from "./kanab-quest-school-cannabinoids-selection";
import { VERSION as CULTIVATION_VERSION } from "./kanab-quest-school-cultivation";
import { createKqSchoolCultivationSelection, selectKqSchoolCultivationQuestions } from "./kanab-quest-school-cultivation-selection";

import { VERSION as HEALTH_VERSION } from "./kanab-quest-school-health";
import { createKqSchoolHealthSelection, selectKqSchoolHealthQuestions } from "./kanab-quest-school-health-selection";

import { VERSION as SOIL_VERSION } from "./kanab-quest-school-soil";
import { createKqSchoolSoilSelection, selectKqSchoolSoilQuestions } from "./kanab-quest-school-soil-selection";

import { VERSION as PRODUCTS_VERSION } from "./kanab-quest-school-products";
import { createKqSchoolProductsSelection, selectKqSchoolProductsQuestions } from "./kanab-quest-school-products-selection";

import { VERSION as HARVEST_VERSION } from "./kanab-quest-school-harvest";
import { createKqSchoolHarvestSelection, selectKqSchoolHarvestQuestions } from "./kanab-quest-school-harvest-selection";

import { createKqSchoolLawSelection, selectKqSchoolLawQuestions } from "./kanab-quest-school-law-selection";
import type { KqSchoolCheckSubmission } from "./kanab-quest-school-feedback";

export class KqSchoolError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export function getKqSchoolQuiz(quizId: unknown, ownerId?: string): KqSchoolQuiz {
  if (!isKqSchoolQuizId(quizId)) throw new KqSchoolError("Quiz inconnu.", 400);
  const quizModule = getKqSchoolModule(quizId);
  if (!quizModule) throw new KqSchoolError("Quiz indisponible.", 503);
  const selectionId = quizId === "history" ? createKqSchoolHistorySelection(ownerId ?? "")
    : quizId === "plant" ? createKqSchoolBotanySelection(ownerId ?? "")
    : quizId === "molecules" ? createKqSchoolTerpenesSelection(ownerId ?? "")
    : quizId === "evidence" ? createKqSchoolCannabinoidsSelection(ownerId ?? "")
    : quizId === "genetics" ? createKqSchoolCultivationSelection(ownerId ?? "")
    : quizId === "biodiversity" ? createKqSchoolHealthSelection(ownerId ?? "")
    : quizId === "uses" ? createKqSchoolSoilSelection(ownerId ?? "")
    : quizId === "profiles" ? createKqSchoolProductsSelection(ownerId ?? "")
    : quizId === "prevention" ? createKqSchoolHarvestSelection(ownerId ?? "")
    : quizId === "law" && ownerId ? createKqSchoolLawSelection(ownerId) : undefined;
  const selected = quizId === "history" ? selectKqSchoolHistoryQuestions(ownerId, selectionId)
    : quizId === "plant" ? selectKqSchoolBotanyQuestions(ownerId, selectionId)
    : quizId === "molecules" ? selectKqSchoolTerpenesQuestions(ownerId, selectionId)
    : quizId === "evidence" ? selectKqSchoolCannabinoidsQuestions(ownerId, selectionId)
    : quizId === "genetics" ? selectKqSchoolCultivationQuestions(ownerId, selectionId)
    : quizId === "biodiversity" ? selectKqSchoolHealthQuestions(ownerId, selectionId)
    : quizId === "uses" ? selectKqSchoolSoilQuestions(ownerId, selectionId)
    : quizId === "profiles" ? selectKqSchoolProductsQuestions(ownerId, selectionId)
    : quizId === "prevention" ? selectKqSchoolHarvestQuestions(ownerId, selectionId) : quizModule.questions;
  if (!selected) throw new Error("[school] selection unavailable");
  const questions = selected.map(question => {
    const options = [...question.options];
    for (let index = options.length - 1; index > 0; index--) {
      const other = randomInt(index + 1);
      [options[index], options[other]] = [options[other], options[index]];
    }
    // Explicit public projection: an accidental author-only field must never
    // become part of the transport contract through a future object spread.
    return { id: question.id, prompt: question.prompt, options, difficulty: question.difficulty,
      lessonId: question.lessonId, sectionId: question.sectionId, sources: question.sources,
      ...(question.buddyCodes ? { buddyCodes: question.buddyCodes } : {}) };
  });
  return { quizId, contentVersion: quizId === "history" ? HISTORY_VERSION : quizId === "plant" ? BOTANY_VERSION : quizId === "molecules" ? TERPENES_VERSION : quizId === "evidence" ? CANNABINOID_VERSION : quizId === "genetics" ? CULTIVATION_VERSION : quizId === "biodiversity" ? HEALTH_VERSION : quizId === "uses" ? SOIL_VERSION : quizId === "profiles" ? PRODUCTS_VERSION : quizId === "prevention" ? HARVEST_VERSION : quizModule.version, questions,
    ...(selectionId ? { selectionId } : {}) };
}

/** null only permits retrieval of an already-finalized receipt after an editorial update. */
export function gradeKqSchoolSubmission(submission: KqSchoolSubmission, ownerId?: string): { score: number; corrections: KqSchoolCorrection[] } | null {
  const quizModule = getKqSchoolModule(submission.quizId);
  if (!quizModule) throw new KqSchoolError("Quiz inconnu.", 400);
  const questions = selectedQuestions(submission.quizId, submission.contentVersion, ownerId, submission.selectionId);
  // Invalidated signatures (e.g. secret rotation) may recover a finalized receipt
  // but can never grade a new attempt. The existing RPC rejects missing receipts.
  if (!questions) return null;
  if (questions.length !== 10 || new Set(questions.map(question => question.id)).size !== 10) throw new Error("[school] invalid authoring bank");
  const answers = new Map(submission.answers.map(answer => [answer.questionId, answer.optionId]));
  const corrections = questions.map(question => {
    const optionId = answers.get(question.id);
    if (!optionId || !question.options.some(option => option.id === optionId)) throw new KqSchoolError("Une question ou une réponse ne correspond pas à ce quiz. Recharge le quiz.", 400);
    const reference = getKqSchoolAnswer(question.id);
    if (!reference || !question.options.some(option => option.id === reference.correctOptionId)) throw new Error("[school] missing answer reference");
    return { questionId: question.id, optionId, correctOptionId: reference.correctOptionId,
      isCorrect: optionId === reference.correctOptionId, explanation: reference.explanation,
      lessonId: question.lessonId, sectionId: question.sectionId, sources: question.sources,
      ...(reference.optionExplanations ? { optionExplanations: reference.optionExplanations } : {}),
      ...(question.buddyCodes ? { buddyCodes: question.buddyCodes } : {}) };
  });
  return { score: corrections.filter(correction => correction.isCorrect).length, corrections };
}

function selectedQuestions(quizId: string, contentVersion: string, ownerId?: string, selectionId?: string) {
  const quizModule = getKqSchoolModule(quizId);
  if (!quizModule) return null;
  const currentVersion = quizId === "history" ? HISTORY_VERSION : quizId === "plant" ? BOTANY_VERSION : quizId === "molecules" ? TERPENES_VERSION : quizId === "evidence" ? CANNABINOID_VERSION : quizId === "genetics" ? CULTIVATION_VERSION : quizId === "biodiversity" ? HEALTH_VERSION : quizId === "uses" ? SOIL_VERSION : quizId === "profiles" ? PRODUCTS_VERSION : quizId === "prevention" ? HARVEST_VERSION : quizModule.version;
  if (contentVersion !== currentVersion) return null;
  return  quizId === "history" ? selectKqSchoolHistoryQuestions(ownerId, selectionId)
    : quizId === "plant" ? selectKqSchoolBotanyQuestions(ownerId, selectionId)
    : quizId === "molecules" ? selectKqSchoolTerpenesQuestions(ownerId, selectionId)
    : quizId === "evidence" ? selectKqSchoolCannabinoidsQuestions(ownerId, selectionId)
    : quizId === "genetics" ? selectKqSchoolCultivationQuestions(ownerId, selectionId)
    : quizId === "biodiversity" ? selectKqSchoolHealthQuestions(ownerId, selectionId)
    : quizId === "uses" ? selectKqSchoolSoilQuestions(ownerId, selectionId)
    : quizId === "profiles" ? selectKqSchoolProductsQuestions(ownerId, selectionId)
    : quizId === "prevention" ? selectKqSchoolHarvestQuestions(ownerId, selectionId) : quizId === "law" ? selectKqSchoolLawQuestions(ownerId, selectionId) : quizModule.questions;
}

export function gradeKqSchoolQuestion(input: KqSchoolCheckSubmission, ownerId: string): KqSchoolCorrection {
  const questions = selectedQuestions(input.quizId, input.contentVersion, ownerId, input.selectionId);
  if (!questions || !input.selectionId) throw new KqSchoolError("Ce quiz a chang\u00e9. Recharge-le pour continuer.", 409, "CONTENT_VERSION_CHANGED");
  const question = questions.find(item => item.id === input.questionId);
  if (!question || !question.options.some(option => option.id === input.optionId)) throw new KqSchoolError("Question ou r\u00e9ponse invalide.", 400);
  const answer = getKqSchoolAnswer(question.id);
  if (!answer) throw new Error("[school] missing answer reference");
  return { questionId: question.id, optionId: input.optionId, correctOptionId: answer.correctOptionId, isCorrect: input.optionId === answer.correctOptionId, explanation: answer.explanation, lessonId: question.lessonId, sectionId: question.sectionId, sources: question.sources, ...(answer.optionExplanations ? { optionExplanations: answer.optionExplanations } : {}), ...(question.buddyCodes ? { buddyCodes: question.buddyCodes } : {}) };
}

import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { HEMP_QUIZ_BANK, HEMP_QUIZ_SOURCES } from './kanab-quest-hemp-quiz-bank';
import { HEMP_QUIZ_BANK_SIZE, HEMP_QUIZ_TOPICS } from './kanab-quest-hemp-quiz-meta';
import type { KqSchoolAnswer } from './kanab-quest-school-answers';
import type { HempQuizDomain, HempQuizEntry } from './kanab-quest-hemp-quiz-types';
import type { KqSchoolSource } from './kanab-quest-school-content';
import { KQ_SCHOOL_CHALLENGE_VERSION, type KqSchoolChallengeQuestion, type KqSchoolChallengeLevel } from './kanab-quest-school-challenge';

export type KqSchoolChallengePlan = { contentVersion: string; questions: { question: KqSchoolChallengeQuestion; answer: KqSchoolAnswer }[] };

/** Enumerate at most 12 allocations, then solve subject/cell matching exactly.
 * A cell is one (level, domain) pair. Matching all its slots jointly avoids
 * independent reservations which could promise incompatible constraints.
 */
function selectDomainQuestions(pool: readonly HempQuizEntry[], questionsPerLevel: 3 | 5, rank: (id: string) => string): HempQuizEntry[] {
  const domains: readonly HempQuizDomain[] = ['active', 'food', 'materials'];
  if (pool.some(item => !domains.includes(item.domain!) || ![1, 2, 3, 4].includes(item.level))) {
    throw new Error('[challenge] incomplete hemp domain classification');
  }
  // Five equally likely deterministic rotations average exactly 80/10/10.
  const rotation = Number.parseInt(rank('domain-quota').slice(0, 8), 16) % 5;
  const food = questionsPerLevel === 5 ? 2 : rotation === 3 ? 2 : 1;
  const materials = questionsPerLevel === 5 ? 2 : rotation === 4 ? 2 : 1;
  const allocations: number[][] = [];
  const allocate = (level: number, foodLeft: number, materialsLeft: number, cells: number[]) => {
    if (level === 4) {
      if (!foodLeft && !materialsLeft) allocations.push(cells);
      return;
    }
    for (let f = 0; f <= Math.min(foodLeft, 1); f++) {
      for (let m = 0; m <= Math.min(materialsLeft, 1 - f); m++) {
        allocate(level + 1, foodLeft - f, materialsLeft - m, [...cells, questionsPerLevel - f - m, f, m]);
      }
    }
  };
  allocate(0, food, materials, []);
  allocations.sort((a, b) => rank('allocation:' + a.join(',')).localeCompare(rank('allocation:' + b.join(','))));
  const cellPools = Array.from({ length: 12 }, (_, cell) => pool
    .filter(item => (item.level - 1) * 3 + domains.indexOf(item.domain!) === cell)
    .sort((a, b) => rank(a.id).localeCompare(rank(b.id))));
  let quotasPossible = false;
  for (const allocation of allocations) {
    if (allocation.some((count, cell) => cellPools[cell].length < count)) continue;
    quotasPossible = true;
    const slots = allocation.flatMap((count, cell) => Array<number>(count).fill(cell));
    const owners = new Map<string, number>();
    const selected: HempQuizEntry[] = [];
    const match = (slot: number, visited: Set<string>): boolean => {
      for (const item of cellPools[slots[slot]]) {
        const subject = item.subjectKey || item.id;
        if (visited.has(subject)) continue;
        visited.add(subject);
        const previous = owners.get(subject);
        if (previous === undefined || match(previous, visited)) {
          owners.set(subject, slot);
          selected[slot] = item;
          return true;
        }
      }
      return false;
    };
    if (slots.every((_, slot) => match(slot, new Set()))) {
      return selected.sort((a, b) => a.level - b.level
        || Number(a.domain !== 'active') - Number(b.domain !== 'active')
        || rank(a.id).localeCompare(rank(b.id)));
    }
  }
  // Never silently relax domains, levels or subject uniqueness on classified banks.
  throw new Error(quotasPossible
    ? '[challenge] domain quotas cannot provide distinct subjects'
    : '[challenge] impossible hemp domain quotas');
}

function publicQuestion(item: HempQuizEntry, rank: (id: string) => string, sourceRegistry: ReadonlyMap<string, KqSchoolSource>): KqSchoolChallengePlan['questions'][number] {
  if (item.options.length !== 4 || !item.options[item.answer]) throw new Error('[challenge] incomplete hemp options');
  const sources = item.sourceIds.map(id => {
    const source = sourceRegistry.get(id);
    if (!source) throw new Error('[challenge] unknown source ' + id);
    // The bibliography also contains factual excerpts. A question only sends citations.
    const { title, organization, url, verifiedAt } = source;
    return { id, title, organization, url, verifiedAt };
  });
  if (!sources.length) throw new Error('[challenge] missing hemp source');
  // Explicit projection keeps domain, subject identity and answer off the public DTO.
  const question: KqSchoolChallengeQuestion = {
    id: item.id, prompt: item.prompt,
    options: item.options.map((text, option) => ({ id: String.fromCharCode(97 + option), text })).sort((a, b) => rank(item.id + ':' + a.id).localeCompare(rank(item.id + ':' + b.id))),
    difficulty: item.level === 1 ? 'easy' : 'medium', lessonId: 'reference', sectionId: item.articleId,
    sources, themeId: item.topicId, level: item.level,
  };
  return { question, answer: { correctOptionId: String.fromCharCode(97 + item.answer), explanation: item.explanation } };
}
/** Only the server can turn authoring data into a private round plan. */
export function createKqSchoolChallengePlan(seed: string = randomUUID()): KqSchoolChallengePlan {
  return createKqSchoolQuestionPlan(seed, 5);
}

/** Balance the questions actually played, without discarding part of a larger draw.
 * Explicit pools are for local editorial fixtures; no client input reaches this helper.
 */
export function createKqSchoolQuestionPlan(
  seed: string,
  questionsPerLevel: 3 | 5,
  pool: readonly HempQuizEntry[] = HEMP_QUIZ_BANK,
  sourceRegistry: ReadonlyMap<string, KqSchoolSource> = HEMP_QUIZ_SOURCES,
): KqSchoolChallengePlan {
  if ((pool === HEMP_QUIZ_BANK && pool.length !== HEMP_QUIZ_BANK_SIZE) || new Set(pool.map(item => item.id)).size !== pool.length
    || pool.some(item => !HEMP_QUIZ_TOPICS.some(topic => topic.id === item.topicId))) throw new Error('[challenge] invalid hemp bank');
  const ranks = new Map<string, string>();
  const rank = (id: string) => {
    let value = ranks.get(id);
    if (value === undefined) { value = createHash('sha256').update(seed + '\n' + id).digest('hex'); ranks.set(id, value); }
    return value;
  };
  if (pool.some(item => item.domain !== undefined)) {
    return {
      contentVersion: KQ_SCHOOL_CHALLENGE_VERSION,
      questions: selectDomainQuestions(pool, questionsPerLevel, rank).map(item => publicQuestion(item, rank, sourceRegistry)),
    };
  }
  // Legacy authoring fixtures without domains retain their prior selection rules.
  const used = new Set<string>(), counts = new Map<string, number>(), subjects = new Map<string, number>();
  const subject = (item: HempQuizEntry) => item.subjectKey || item.id;
  // Four levels form only 15 possible subsets. Hall's condition lets us reserve
  // scarce subjects for later levels without a large matching/backtracking engine.
  const subjectLevels = new Map<string, number>();
  for (const item of pool) subjectLevels.set(subject(item), (subjectLevels.get(subject(item)) ?? 0) | (1 << (item.level - 1)));
  const available = Array<number>(16).fill(0);
  for (const mask of subjectLevels.values()) available[mask]++;
  const remaining = [questionsPerLevel, questionsPerLevel, questionsPerLevel, questionsPerLevel];
  const canFillWithDistinctSubjects = () => {
    for (let subset = 1; subset < 16; subset++) {
      let needed = 0, eligible = 0;
      for (let level = 0; level < 4; level++) if (subset & (1 << level)) needed += remaining[level];
      for (let mask = 1; mask < 16; mask++) if (mask & subset) eligible += available[mask];
      if (eligible < needed) return false;
    }
    return true;
  };
  const distinctSubjectsPossible = canFillWithDistinctSubjects();
  const topicPools = HEMP_QUIZ_TOPICS.map(topic => ({
    id: topic.id,
    levels: [1, 2, 3, 4].map(level => pool.filter(item => item.topicId === topic.id && item.level === level)),
  })).filter(topic => topic.levels.some(entries => entries.length));
  // Reserve room for unseen themes, including those available only in early levels.
  // Theme coverage is a heuristic: these checks are independent of the subject
  // checks and an earlier choice can prevent a better global combination.
  // Keeping distinct subjects takes priority when the remaining constraints clash.
  const canCoverUnseenTopics = (candidate?: HempQuizEntry) => {
    const masks = Array<number>(16).fill(0);
    for (const topic of topicPools) {
      if (counts.has(topic.id) || topic.id === candidate?.topicId) continue;
      let mask = 0;
      for (let level = 0; level < 4; level++) {
        if (remaining[level] && topic.levels[level].some(item => item.id !== candidate?.id && !used.has(item.id)
          && (!distinctSubjectsPossible || (!subjects.has(subject(item)) && subject(item) !== (candidate && subject(candidate)))))) {
          mask |= 1 << level;
        }
      }
      if (!mask) return false;
      masks[mask]++;
    }
    for (let subset = 1; subset < 16; subset++) {
      let slots = 0, constrainedTopics = 0;
      for (let level = 0; level < 4; level++) if (subset & (1 << level)) slots += remaining[level];
      for (let mask = 1; mask < 16; mask++) if ((mask & subset) === mask) constrainedTopics += masks[mask];
      if (constrainedTopics > slots) return false;
    }
    return true;
  };
  const topicCoveragePossible = canCoverUnseenTopics();
  const questions: KqSchoolChallengePlan['questions'] = [];
  for (const level of [1, 2, 3, 4] as KqSchoolChallengeLevel[]) {
    const levelPool = pool.filter(item => item.level === level);
    for (let index = 0; index < questionsPerLevel; index++) {
      const previous = questions.at(-1)?.question.themeId;
      const candidates = levelPool.filter(item => !used.has(item.id)).sort((left, right) =>
        // Prefer an unseen cultivar/object. If a narrow pool makes that impossible,
        // use the least repeated subject instead of failing an otherwise valid round.
        (subjects.get(subject(left)) ?? 0) - (subjects.get(subject(right)) ?? 0)
        || (counts.get(left.topicId) ?? 0) - (counts.get(right.topicId) ?? 0)
        || Number(left.topicId === previous) - Number(right.topicId === previous)
        || rank(left.id).localeCompare(rank(right.id)));
      remaining[level - 1]--;
      const preservesSubjects = (candidate: HempQuizEntry) => {
        if (!distinctSubjectsPossible) return true;
        if (subjects.has(subject(candidate))) return false;
        const mask = subjectLevels.get(subject(candidate))!;
        available[mask]--;
        const possible = canFillWithDistinctSubjects();
        available[mask]++;
        return possible;
      };
      const item = (topicCoveragePossible ? candidates.find(candidate => preservesSubjects(candidate) && canCoverUnseenTopics(candidate)) : undefined)
        ?? candidates.find(preservesSubjects);
      if (!item || !item.options[item.answer]) throw new Error('[challenge] incomplete hemp level');
      if (distinctSubjectsPossible) available[subjectLevels.get(subject(item))!]--;
      used.add(item.id); counts.set(item.topicId, (counts.get(item.topicId) ?? 0) + 1);
      subjects.set(subject(item), (subjects.get(subject(item)) ?? 0) + 1);
      questions.push(publicQuestion(item, rank, sourceRegistry));
    }
  }
  return { contentVersion: KQ_SCHOOL_CHALLENGE_VERSION, questions };
}

import { describe, expect, it } from "vitest";
import { getKqSchoolChallengePoints, parseKqSchoolChallengeCommand } from "./kanab-quest-school-challenge";
const key = "12345678-1234-4123-8123-123456789abc";
describe("challenge points and input contract", () => {
  it.each([[0, 50], [1, 49], [400, 49], [10000, 25], [19999, 0], [20000, 0], [600000, 0]])("correct answer at %sms has bonus%s", (elapsed, bonus) => {
    expect(getKqSchoolChallengePoints(true, elapsed)).toEqual({ basePoints: 100, bonusPoints: bonus, awardedPoints: 100 + bonus });
    expect(getKqSchoolChallengePoints(false, elapsed)).toEqual({ basePoints: 0, bonusPoints: 0, awardedPoints: 0 });
  });
  it.each([-1, NaN, Infinity])("rejects invalid time%s", elapsed => expect(() => getKqSchoolChallengePoints(true, elapsed)).toThrow());
  it("accepts only the three explicit actions", () => {
    for (const value of [{ action: "start", requestKey: key }, { action: "start", requestKey: key, replaceRoundId: key }, { action: "answer", requestKey: key, roundId: key, questionId: "history-evidence-q01", optionId: "b" }, { action: "next", requestKey: key, roundId: key, questionId: "history-evidence-q01" }]) expect(parseKqSchoolChallengeCommand(value)).toEqual(value);
  });
  it.each(["score", "elapsedMs", "openedAt", "ownerId", "plan", "correctOptionId"])("rejects injected%s", field => {
    expect(parseKqSchoolChallengeCommand({ action: "start", requestKey: key, [field]: 0 })).toBeNull();
  });
  it("rejects malformed identities, omitted keys and unknown actions", () => {
    for (const value of [null, {}, { action: "start", requestKey: "bad" }, { action: "start", requestKey: key, replaceRoundId: null }, { action: "answer", requestKey: key, roundId: key, questionId: "a" }, { action: "answer", requestKey: key, roundId: key, questionId: "a", optionId: "" }, { action: "finish", requestKey: key }]) expect(parseKqSchoolChallengeCommand(value)).toBeNull();
  });
});

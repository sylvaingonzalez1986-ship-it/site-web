import type { KqSocialCultureContext } from "./kanab-quest-social-culture";
import type { KqSocialSubject } from "./kanab-quest-social-producer-types";
export type KqSocialPlatform = "instagram" | "x";
export type KqSocialIntent = "reach" | "craft" | "care";
export type KqSocialTag = "visual" | "craft" | "dialogue" | "community";
export type KqSocialEffects = { followersMin: number; followersMax: number; haters: number; trust: number; moderation: number; energy: number };
export type KqSocialChoice = { id: string; label: string; description: string; upside: string; downside: string; outcome: string; intent: KqSocialIntent; tag: KqSocialTag; effects: KqSocialEffects };
export type KqSocialScenario = { id: string; platform: KqSocialPlatform; arc: string; episode: 1 | 2 | 3; title: string; body: string; audience: string; character: string; choices: KqSocialChoice[];
  narrativeVersion?: 2 | 3; subject?: KqSocialSubject; previousChoice?: string;
  followups?: Array<{ fromScenarioId: string; fromChoiceId: string; body: string; choiceModifiers?: Record<string, Partial<KqSocialEffects>> }> };
export type KqSocialAccount = { followers: number; haters: number; moderation: number; chapter: number; nextPostAt: string | null; trust: number;
  story?: { startId: string; subject: KqSocialSubject };
  lastIntent: KqSocialIntent | null; intentStreak: number; memory: Record<string, string>; pressureUpdatedAt: string };
export type KqSocialHistoryEntry = { id: string; narrativeVersion?: 2 | 3; subject?: KqSocialSubject; previousChoice?: string; platform: KqSocialPlatform | null; scenarioId: string; choiceId: string; createdAt: string; outcome: string; followersDelta: number; hatersDelta: number; moderationDelta: number; energyDelta: number; trustDelta?: number; rewardCents?: number; reasons?: string[] };
export type KqSocialSponsorDefinition = { id: string; name: string; contact: string; platform: KqSocialPlatform; minimumFollowers: number; minimumTrust: number; maxHaters: number; maxModeration: number; rewardCents: number; brief: string; requiredTags: [KqSocialTag, KqSocialTag]; publicationBudget: 4; tradeoff: string; completionText: string };
export type KqSocialPartnership = { sponsorId: string; platform: KqSocialPlatform; progressTags: KqSocialTag[]; publicationsLeft: number; rewardCents: number; startedAt: string };
export type KqSocialSnapshot = { version: 2; storyCatalogVersion?: 2; narrativeVersion?: 2 | 3; serverNow: string; revision: number; energy: number; energyUpdatedAt: string; recoverReadyAt: string | null;
  culture?: KqSocialCultureContext;
  audienceFollowers: number; socialFollowers: number; additionalVisitsPerDay: number; siteActive: boolean;
  platforms: Record<KqSocialPlatform, KqSocialAccount>; history: KqSocialHistoryEntry[]; replayed?: boolean;
  sponsors: { active: KqSocialPartnership | null; completedIds: string[]; declinedIds: string[]; earnedCents: number };
};
type CommandBase = { modelVersion: 2; requestKey: string; expectedRevision: number };
export type KqSocialCommand = CommandBase & (
  { action: "choose"; platform: KqSocialPlatform; scenarioId: string; choiceId: string; narrativeVersion?: 3; subjectId?: string; contextKey?: string }
  | { action: "recover" }
  | { action: "sponsor-accept" | "sponsor-decline"; sponsorId: string }
  | { action: "sponsor-post"; tag: KqSocialTag }
  | { action: "sponsor-claim" | "sponsor-cancel" }
);
export type KqSocialChoicePreview = KqSocialEffects & { reasons: string[] };
export type KqSocialSponsorOffer = { sponsor: KqSocialSponsorDefinition; eligible: boolean; blockers: string[]; status: "available" | "locked" | "active" | "completed" | "declined" };

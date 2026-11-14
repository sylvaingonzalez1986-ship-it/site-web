import { parseKqSchoolHistoryProgress, type KqSchoolHistoryProgressCommand as Command, type KqSchoolHistorySnapshot as Snapshot } from "./kanab-quest-school-history-progress";
import { parseKqSchoolBotanyProgress } from "./kanab-quest-school-botany-progress";

import { parseKqSchoolTerpenesProgress } from "./kanab-quest-school-terpenes-progress";

import { parseKqSchoolCannabinoidsProgress } from "./kanab-quest-school-cannabinoids-progress";

import { parseKqSchoolHarvestProgress } from "./kanab-quest-school-harvest-progress";
import { parseKqSchoolProductsProgress } from "./kanab-quest-school-products-progress";
import { parseKqSchoolSoilProgress } from "./kanab-quest-school-soil-progress";
import { parseKqSchoolHealthProgress } from "./kanab-quest-school-health-progress";
import { parseKqSchoolCultivationProgress } from "./kanab-quest-school-cultivation-progress";

type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Entry = { command: Command | null; resumeSerial: number; uncertain: boolean; refreshResume: boolean };
export type KqHistoryProgressState = { snapshot: Snapshot | null; busy: boolean; waiting: boolean; error: string; notice: string };
export type KqHistoryTransport = (method: "GET" | "POST", command: Command | null, signal: AbortSignal) => Promise<Snapshot>;
export const emptyKqHistoryProgressState = (): KqHistoryProgressState => ({ snapshot: null, busy: false, waiting: false, error: "", notice: "" });
const memory = new Map<string, Entry>();
const nonempty = (command: Command) => command.lessonIds.length + command.checkpointIds.length + command.activityIds.length > 0 || Object.hasOwn(command, "resumeLessonId");
const merge = (left: string[] = [], right: string[] = []) => [...new Set([...left, ...right])].sort();

/** Owner-scoped tab memory survives navigation even when storage is blocked. */
export class KqHistoryProgressController {
  private state = emptyKqHistoryProgressState();
  private entry: Entry;
  private disposed = false;
  private flushing = false;
  private post: AbortController | null = null;
  private loading: AbortController | null = null;
  private timeoutMs: number;
  private storage: StoragePort | undefined;
  private storageUnavailable: boolean;
  private storageKey: string;
  private parse: (value: unknown) => Command | null;
  constructor(readonly ownerId: string, private transport: KqHistoryTransport, private publish: (state: KqHistoryProgressState) => void,
    options: { storage?: StoragePort; memory?: Map<string, Entry>; timeoutMs?: number; course?: "history" | "botany" | "terpenes" | "cannabinoids" | "cultivation" | "health" | "soil" | "products" | "harvest" } = {}) {
    this.storage = options.storage;
    this.storageUnavailable = !options.storage;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.storageKey = `kq-${options.course ?? "history"}-pending:v1:${ownerId}`;
    this.parse = options.course === "botany" ? parseKqSchoolBotanyProgress : options.course === "terpenes" ? parseKqSchoolTerpenesProgress : options.course === "cannabinoids" ? parseKqSchoolCannabinoidsProgress : options.course === "cultivation" ? parseKqSchoolCultivationProgress : options.course === "health" ? parseKqSchoolHealthProgress : options.course === "soil" ? parseKqSchoolSoilProgress : options.course === "products" ? parseKqSchoolProductsProgress : options.course === "harvest" ? parseKqSchoolHarvestProgress : parseKqSchoolHistoryProgress;
    const entries = options.memory ?? memory;
    const existing = entries.get(this.storageKey);
    if (existing) this.entry = existing;
    else {
      let saved: Command | null = null;
      try { saved = this.parse(JSON.parse(this.storage?.getItem(this.storageKey) || "null")); } catch { /* Memory remains available. */ }
      this.entry = { command: saved && nonempty(saved) ? saved : null, resumeSerial: 0, uncertain: Boolean(saved), refreshResume: false };
      entries.set(this.storageKey, this.entry);
    }
    this.state.waiting = Boolean(this.entry.command);
  }
  private emit(patch: Partial<KqHistoryProgressState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch, waiting: Boolean(this.entry.command) };
    if (this.entry.command && this.storageUnavailable) this.state.notice = "Garde cet onglet ouvert : les étapes restent en mémoire, mais la sauvegarde locale est indisponible.";
    this.publish(this.state);
  }
  private persist() {
    if (!this.storage) {
      if (this.entry.command) this.emit({ notice: "Garde cet onglet ouvert : les étapes restent en mémoire, mais la sauvegarde locale est indisponible." });
      return;
    }
    try {
      if (this.entry.command) this.storage.setItem(this.storageKey, JSON.stringify(this.entry.command));
      else this.storage.removeItem(this.storageKey);
    } catch { this.storageUnavailable = true; this.emit({}); }
  }
  private checkOwner(snapshot: Snapshot) {
    if (snapshot.ownerId !== this.ownerId) throw new Error("Le compte a changé. Recharge l’école avant d’enregistrer.");
  }
  async load(): Promise<boolean> {
    if (this.disposed) return false;
    this.loading?.abort();
    const controller = new AbortController(); this.loading = controller;
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    this.emit({});
    try {
      const snapshot = await this.transport("GET", null, controller.signal);
      this.checkOwner(snapshot);
      if (controller.signal.aborted || this.disposed) return false;
      if (!this.state.snapshot || snapshot.revision >= this.state.snapshot.revision) this.emit({ snapshot, error: "" });
      else this.emit({ error: "" });
      return true;
    } catch (cause) {
      if (!this.disposed && this.loading === controller) this.emit({ error: controller.signal.aborted
        ? "La connexion prend trop de temps. Les étapes en attente sont conservées." : (cause as Error).message });
      return false;
    } finally { clearTimeout(timer); if (this.loading === controller) this.loading = null; }
  }
  async save(delta: Partial<Command>): Promise<void> {
    if (this.disposed || !this.state.snapshot) return;
    const previous = this.entry.command;
    const hasResume = Object.hasOwn(delta, "resumeLessonId");
    const command = this.parse({
      lessonIds: merge(previous?.lessonIds, delta.lessonIds), checkpointIds: merge(previous?.checkpointIds, delta.checkpointIds), activityIds: merge(previous?.activityIds, delta.activityIds),
      ...(hasResume ? { resumeLessonId: delta.resumeLessonId, expectedRevision: this.state.snapshot.revision }
        : previous && Object.hasOwn(previous, "resumeLessonId") ? { resumeLessonId: previous.resumeLessonId, expectedRevision: previous.expectedRevision } : {}),
    });
    if (!command) { this.emit({ error: "Cette étape de progression est invalide." }); return; }
    if (hasResume) { this.entry.resumeSerial++; if (this.entry.uncertain) this.entry.refreshResume = true; }
    this.entry.command = nonempty(command) ? command : null;
    this.persist(); this.emit({});
    if (!this.flushing) await this.flush();
  }
  private async flush() {
    if (this.disposed || this.flushing || !this.entry.command) return;
    this.flushing = true; this.emit({ busy: true, error: "" });
    try {
      while (!this.disposed && this.entry.command) {
        // A new intent after an uncertain response refreshes its base revision;
        // retrying the same old intent preserves its original CAS.
        if (this.entry.refreshResume) {
          if (!await this.load()) break;
          if (!this.entry.command || !this.state.snapshot) break;
          this.entry.command = { ...this.entry.command, expectedRevision: this.state.snapshot.revision };
          this.entry.refreshResume = false; this.persist();
        }
        const batch = { command: this.entry.command, resumeSerial: this.entry.resumeSerial };
        const controller = new AbortController(); this.post = controller;
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const snapshot = await this.transport("POST", batch.command, controller.signal);
          this.checkOwner(snapshot);
          if (controller.signal.aborted || this.disposed) { this.entry.uncertain = true; break; }
          const pending = this.entry.command!;
          const remaining: Command = {
            lessonIds: pending.lessonIds.filter(id => !batch.command.lessonIds.includes(id)),
            checkpointIds: pending.checkpointIds.filter(id => !batch.command.checkpointIds.includes(id)),
            activityIds: pending.activityIds.filter(id => !batch.command.activityIds.includes(id)),
            ...(Object.hasOwn(pending, "resumeLessonId") && this.entry.resumeSerial !== batch.resumeSerial
              ? { resumeLessonId: pending.resumeLessonId, expectedRevision: snapshot.resumeConflict ? pending.expectedRevision : Math.max(snapshot.revision, pending.expectedRevision ?? 0) } : {}),
          };
          this.entry.command = nonempty(remaining) ? remaining : null;
          this.entry.uncertain = false; this.entry.refreshResume = false;
          this.persist();
          const latest = this.state.snapshot && this.state.snapshot.revision > snapshot.revision ? this.state.snapshot : snapshot;
          this.emit({ snapshot: latest, error: "", notice: snapshot.resumeConflict
            ? "Étapes enregistrées. Une position plus récente a été conservée." : "Progression enregistrée." });
        } catch (cause) {
          this.entry.uncertain = true; this.persist();
          this.emit({ error: controller.signal.aborted ? "Connexion interrompue. Réessaie l’enregistrement de tes étapes." : (cause as Error).message });
          break;
        } finally { clearTimeout(timer); if (this.post === controller) this.post = null; }
      }
    } finally { this.flushing = false; this.emit({ busy: false }); }
  }
  dispose() {
    this.disposed = true;
    if (this.post) this.entry.uncertain = true;
    this.loading?.abort(); this.post?.abort(); this.persist();
  }
}

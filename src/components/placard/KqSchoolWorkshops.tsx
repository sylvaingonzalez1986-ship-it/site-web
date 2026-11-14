"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { KQ_SCHOOL_CROSSWORDS, KQ_SCHOOL_TIMELINE, KQ_SCHOOL_MATCHING_SETS, getKqSchoolSource as findSource, getKqSchoolCourse, type KqSchoolSource } from "@/lib/kanab-quest-school-content";
import { SchoolSources } from "./KqSchool";
import styles from "./KqSchool.module.css";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
const point = (row: number, col: number) => `${row}:${col}`;
function getKqSchoolSource(id: string): KqSchoolSource {
  const source = findSource(id);
  if (!source) throw new Error(`Unknown workshop source: ${id}`);
  return source;
}
function readLocal<T>(key: string | undefined, fallback: T): T {
  if (!key) return fallback;
  try { return JSON.parse(sessionStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function saveLocal(key: string | undefined, value: unknown) { if (key) try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Completed progress is still stored on the server. */ } }
type CrosswordData = typeof KQ_SCHOOL_CROSSWORDS[number];
type MatchingData = typeof KQ_SCHOOL_MATCHING_SETS[number];
type ActivityProps = { storageKey?: string; onComplete: () => void; busy: boolean };

export function Crossword({ data, storageKey, onComplete, busy }: ActivityProps & { data: CrosswordData }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const saved = readLocal<unknown>(storageKey, {});
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved as Record<string, string> : {};
  });
  const [selected, setSelected] = useState(0);
  const [checked, setChecked] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [hint, setHint] = useState("");
  const cells = new Map<string, { answer: string; number?: number; entries: number[] }>();
  data.entries.forEach((entry, entryIndex) => {
    normalize(entry.answer).split("").forEach((answer, offset) => {
      const key = point(entry.row + (entry.direction === "down" ? offset : 0), entry.col + (entry.direction === "across" ? offset : 0));
      const prior = cells.get(key);
      cells.set(key, { answer, number: offset === 0 ? entry.number : prior?.number, entries: [...(prior?.entries ?? []), entryIndex] });
    });
  });
  const entry = data.entries[selected];
  const entryKeys = normalize(entry.answer).split("").map((_, offset) => point(entry.row + (entry.direction === "down" ? offset : 0), entry.col + (entry.direction === "across" ? offset : 0)));
  const [focusKey, setFocusKey] = useState(point(data.entries[0].row, data.entries[0].col));
  const correctCount = [...cells.entries()].filter(([key, cell]) => normalize(String(values[key] || "")) === cell.answer).length;
  const update = (next: Record<string, string>) => { setValues(next); setChecked(false); setShowSolution(false); setHint(""); saveLocal(storageKey, next); };
  const focus = (key: string) => { setFocusKey(key); document.getElementById(`${data.id}-${key}`)?.focus(); };
  const enterCell = (key: string, raw: string) => {
    const letter = normalize(raw).slice(-1);
    update({ ...values, [key]: letter });
    const index = entryKeys.indexOf(key);
    if (letter && index >= 0 && index + 1 < entryKeys.length) focus(entryKeys[index + 1]);
  };
  const keydown = (event: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    const key = point(row, col);
    const moves: Record<string, [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    if (moves[event.key]) {
      event.preventDefault(); const [dy, dx] = moves[event.key]; let r = row + dy, c = col + dx;
      while (r >= 0 && c >= 0 && r < data.height && c < data.width) { if (cells.has(point(r, c))) { focus(point(r, c)); break; } r += dy; c += dx; }
    } else if (event.key === "Backspace" && !values[key]) {
      const index = entryKeys.indexOf(key); if (index > 0) { event.preventDefault(); focus(entryKeys[index - 1]); }
    }
  };
  return <div className={styles.heroCopy}>
    <p>Choisissez une définition, puis écrivez dans les cases ou saisissez le mot entier. Les accents sont acceptés. Les flèches déplacent le curseur.</p>
    <div className={styles.workshopLayout}><div className={styles.crosswordWrap}><div className={styles.crossword} role="group" aria-label={`Grille ${data.title}`} style={{ gridTemplateColumns: `repeat(${data.width}, minmax(0, 1fr))`, "--crossword-ratio": `${data.width} / ${data.height}` } as CSSProperties}>
      {Array.from({ length: data.height * data.width }, (_, index) => {
        const row = Math.floor(index / data.width), col = index % data.width, key = point(row, col), cell = cells.get(key);
        return cell ? <div key={key} className={styles.cell} data-active={entryKeys.includes(key) || undefined} data-wrong={checked && normalize(String(values[key] || "")) !== cell.answer || undefined}><span aria-hidden>{cell.number}</span><input id={`${data.id}-${key}`} aria-label={`Ligne ${row + 1}, colonne ${col + 1}${cell.number ? `, départ ${cell.number}` : ""}`} aria-describedby={`${data.id}-active-clue`} autoComplete="off" autoCapitalize="characters" spellCheck={false} tabIndex={key === focusKey ? 0 : -1} value={values[key] || ""} onFocus={() => { setFocusKey(key); if (!cell.entries.includes(selected)) setSelected(cell.entries[0]); }} onClick={() => { if (cell.entries.length > 1 && focusKey === key) setSelected(cell.entries.find(item => item !== selected) ?? selected); }} onChange={event => enterCell(key, event.target.value)} onKeyDown={event => keydown(event, row, col)}/></div> : <div className={styles.block} key={key} aria-hidden/>;
      })}
    </div></div><div className={styles.entryBox}><label id={`${data.id}-active-clue`}>{entry.number}. {entry.direction === "across" ? "Horizontal" : "Vertical"} · {entry.clue}<input className={styles.wordInput} onFocus={event => event.currentTarget.select()} aria-label={`Mot ${entry.number} ${entry.direction === "across" ? "horizontal" : "vertical"}`} value={entryKeys.map(key => values[key] || " ").join("").trimEnd()} onChange={event => { const word = normalize(event.target.value).slice(0, entryKeys.length); const next = { ...values }; entryKeys.forEach((key, index) => { next[key] = word[index] || ""; }); update(next); }} autoComplete="off" spellCheck={false}/></label><p className={styles.muted}>{entryKeys.length} lettres</p><button type="button" onClick={() => { const missing = entryKeys.find(key => values[key] !== cells.get(key)?.answer) ?? entryKeys[0]; const letter = cells.get(missing)!.answer; update({ ...values, [missing]: letter }); setHint(`Indice : une lettre du mot ${entry.number} a été ajoutée.`); }}>Une lettre d’aide</button><ul className={styles.clues}>{data.entries.map((item, index) => <li key={`${item.number}-${item.direction}`}><button type="button" aria-pressed={selected === index} onClick={() => { setSelected(index); setFocusKey(point(item.row, item.col)); }}>{item.number}. {item.direction === "across" ? "→" : "↓"} {item.clue}</button></li>)}</ul></div></div>
    {hint && <p role="status">{hint}</p>}
    <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy} onClick={() => { setChecked(true); if (correctCount === cells.size) onComplete(); }}>Vérifier la grille</button><button type="button" onClick={() => setShowSolution(true)}>Voir la correction</button><button type="button" onClick={() => update({})}>Recommencer</button></div>
    {checked && <p role="status">{correctCount === cells.size ? "✓ Tous les mots se croisent correctement. Grille terminée !" : `${correctCount} / ${cells.size} lettres correctes. Les cases encadrées restent à revoir ; aidez-vous des définitions.`}</p>}
    {showSolution && <div className={styles.observation}><h4>Les mots de la grille</h4><ul>{data.entries.map(item => <li key={`${item.number}-${item.direction}`}>{item.number} {item.direction === "across" ? "horizontal" : "vertical"} : <strong>{item.displayAnswer}</strong> — {item.clue}</li>)}</ul><button type="button" onClick={() => { update(Object.fromEntries([...cells].map(([key, cell]) => [key, cell.answer]))); setShowSolution(true); }}>Reporter les mots dans la grille</button></div>}
  </div>;
}

function Timeline({ storageKey, onComplete, busy }: ActivityProps) {
  const events = KQ_SCHOOL_TIMELINE;
  const initial = [...events.filter((_, index) => index % 2 === 1), ...events.filter((_, index) => index % 2 === 0)].map(event => event.id);
  const [order, setOrder] = useState<string[]>(() => {
    const saved = readLocal<unknown>(storageKey, initial);
    return Array.isArray(saved) && saved.length === events.length && new Set(saved).size === events.length && saved.every(id => events.some(event => event.id === id)) ? saved : initial;
  });
  const [checked, setChecked] = useState(false);
  const [correction, setCorrection] = useState(false);
  const score = order.filter((id, index) => id === events[index].id).length;
  const move = (index: number, shift: number) => {
    const next = [...order]; [next[index], next[index + shift]] = [next[index + shift], next[index]]; setOrder(next); setChecked(false); setCorrection(false); saveLocal(storageKey, next);
  };
  return <div className={styles.heroCopy}><p>Classez ces repères du plus ancien au plus récent avec les flèches. C’est un classement chronologique : les distances ne représentent pas le temps écoulé.</p><ol className={styles.timeline}>{order.map((id, index) => { const event = events.find(item => item.id === id)!; return <li key={id}><div><strong>{event.title}</strong>{checked && <p>{event.dateLabel} · {event.summary}</p>}</div><div className={styles.actions}><button type="button" aria-label={`Avancer ${event.title}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={18}/></button><button type="button" aria-label={`Reculer ${event.title}`} disabled={index === order.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18}/></button></div></li>; })}</ol><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy} onClick={() => { setChecked(true); if (score === events.length) onComplete(); }}>Valider l’ordre</button><button type="button" onClick={() => setCorrection(true)}>Voir la chronologie</button></div>{checked && <p role="status">{score === events.length ? "✓ Tous les repères sont dans l’ordre." : `${score} / ${events.length} repères à la bonne place. Les dates et les explications vous aident à réessayer.`}</p>}{correction && <ol>{events.map(event => <li key={event.id}><strong>{event.dateLabel} — {event.title}</strong><p>{event.summary}</p></li>)}</ol>}<SchoolSources sources={[...new Set(events.flatMap(event => event.sourceIds))].map(getKqSchoolSource)}/></div>;
}

function Matching({ data, storageKey, onComplete, busy }: ActivityProps & { data: MatchingData }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const saved = readLocal<unknown>(storageKey, {}); return saved && typeof saved === "object" && !Array.isArray(saved) ? saved as Record<string, string> : {};
  });
  const [checked, setChecked] = useState(false);
  const options = [...data.pairs.slice(2), ...data.pairs.slice(0, 2)];
  const score = data.pairs.filter(pair => answers[pair.id] === pair.id).length;
  return <div className={styles.heroCopy}><p>Choisissez la correspondance de chaque élément, puis vérifiez vos associations.</p><div className={styles.matching}>{data.pairs.map(pair => <label key={pair.id}><span>{pair.left}</span><select value={answers[pair.id] || ""} onChange={event => { const next = { ...answers, [pair.id]: event.target.value }; setAnswers(next); setChecked(false); saveLocal(storageKey, next); }}><option value="">Choisir une correspondance</option>{options.map(option => <option key={option.id} value={option.id}>{option.right}</option>)}</select>{checked && <p><strong>{answers[pair.id] === pair.id ? "✓ Correct." : `À revoir : ${pair.right}.`}</strong> {pair.explanation}</p>}</label>)}</div><button className={styles.primary} type="button" disabled={busy || data.pairs.some(pair => !answers[pair.id])} onClick={() => { setChecked(true); if (score === data.pairs.length) onComplete(); }}>Vérifier les associations</button>{checked && <p role="status">{score} / {data.pairs.length} associations correctes.{score === data.pairs.length ? " Atelier terminé !" : " Relisez les explications, puis réessayez."}</p>}</div>;
}

export function KqSchoolWorkshops({ lessonId, ownerId, completedIds, busy, onComplete, onOpenCourse }: { lessonId?: string; ownerId?: string; completedIds: readonly string[]; busy: boolean; onComplete: (id: string) => void; onOpenCourse: (id: string) => void }) {
  const choices = [
    ...KQ_SCHOOL_CROSSWORDS.map(item => ({ id: item.id, title: item.title, lessonId: item.lessonId, kind: "crossword" })),
    { id: "timeline-history", title: "L’histoire en six repères", lessonId: "history", kind: "timeline" },
    ...KQ_SCHOOL_MATCHING_SETS.map(item => ({ id: item.id, title: item.title, lessonId: item.lessonId, kind: "matching" })),
  ];
  const workshopIds = lessonId ? getKqSchoolCourse(lessonId)?.workshopIds : undefined;
  const relevant = workshopIds ? choices.filter(item => workshopIds.includes(item.id)) : choices;
  const [selected, setSelected] = useState(relevant[0]?.id || choices[0].id);
  const choice = choices.find(item => item.id === selected)!;
  const crossword = KQ_SCHOOL_CROSSWORDS.find(item => item.id === selected);
  const matching = KQ_SCHOOL_MATCHING_SETS.find(item => item.id === selected);
  const storage = ownerId ? `kq-school-workshop:v1:${ownerId}:${selected}` : undefined;
  const activity = { storageKey: storage, onComplete: () => { if (ownerId) onComplete(selected); }, busy };
  return <div className={styles.heroCopy}><p>Deux mots croisés, une chronologie et trois jeux d’association. Les ateliers enrichissent votre parcours ; les quiz portent les récompenses.</p><nav className={styles.actions} aria-label="Choisir un atelier">{choices.map(item => <button type="button" key={item.id} aria-pressed={item.id === selected} onClick={() => setSelected(item.id)}>{completedIds.includes(item.id) && <Check size={16} aria-label="Terminé"/>}{item.title}</button>)}</nav><section className={styles.panel}><h3>{choice.title}</h3>{!ownerId && <p className={styles.notice}>Vous pouvez jouer. Reconnectez-vous pour enregistrer l’atelier terminé.</p>}{crossword && <Crossword key={`${selected}:${ownerId}`} data={crossword} {...activity}/>} {choice.kind === "timeline" && <Timeline key={`${selected}:${ownerId}`} {...activity}/>} {matching && <Matching key={`${selected}:${ownerId}`} data={matching} {...activity}/>}<button type="button" onClick={() => onOpenCourse(choice.lessonId)}>Revoir le cours associé</button>{completedIds.includes(selected) && <p className={styles.notice}>✓ Atelier enregistré dans votre parcours.</p>}</section></div>;
}

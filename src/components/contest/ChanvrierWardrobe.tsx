"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { Check, RotateCcw, Shuffle, Undo2 } from "lucide-react";
import {
  CHANVRIER_APPEARANCE_OPTIONS as OPTIONS, CHANVRIER_CLOTHES, CHANVRIER_DYE_ZONES, CHANVRIER_FABRICS, CHANVRIER_SKINS,
  getChanvrierAppearance, getChanvrierColors, type ChanvrierAppearance, type ChanvrierAvatarProfile, type ChanvrierChoiceKey, type ChanvrierDyeZone,
} from "@/lib/arena-chanvrier";
import { CHANVRIER_BRETON_OUTFITS } from "@/lib/chanvrier-wardrobe-catalog";
import { ChanvrierAvatar } from "./ChanvrierAvatar";
import type { ChanvrierWorkshopView } from "./chanvrier-workshop-renderer";
import styles from "./ChanvrierProfileEditor.module.css";

const CATEGORIES = [
  { id: "body", label: "Corps", view: "full", fields: ["body", "gender", "skin"] },
  { id: "face", label: "Visage", view: "portrait", fields: ["face", "eyes", "eyeColor", "eyebrows", "nose", "mouth"] },
  { id: "hair", label: "Cheveux", view: "portrait", fields: ["hair", "hairColor", "facialHair"] },
  { id: "outfit", label: "Tenue", view: "full", fields: ["outfits", "top", "clothing", "bottom", "bottomColor", "shoes", "shoeColor", "jacket", "jacketColor"] },
  { id: "details", label: "Accessoires", view: "full", fields: ["accessory", "headwear", "headwearColor", "accentColor"] },
] as const;
type Category = typeof CATEGORIES[number];
type WardrobeField = Category["fields"][number];

const LABELS: Record<WardrobeField, string> = {
  gender: "Base de silhouette", body: "Morphologie", skin: "Couleur de peau",
  face: "Forme du visage", eyes: "Forme des yeux", eyeColor: "Couleur des yeux", eyebrows: "Sourcils", nose: "Nez", mouth: "Expression",
  hair: "Coupe de cheveux", hairColor: "Couleur des cheveux et de la barbe", facialHair: "Barbe et moustache",
  outfits: "Tenues bretonnes", top: "Haut", clothing: "Couleur du haut", bottom: "Bas", bottomColor: "Couleur du bas",
  shoes: "Chaussures", shoeColor: "Couleur des chaussures", jacket: "Veste", jacketColor: "Couleur de la veste",
  accessory: "Accessoire", headwear: "Coiffe et chapeau", headwearColor: "Couleur du couvre-chef", accentColor: "Couleur des détails",
};
const ZONES = {
  skin: "skin", eyeColor: "eyes", hairColor: "hair", clothing: "top", bottomColor: "bottom", shoeColor: "shoes", jacketColor: "jacket", headwearColor: "headwear", accentColor: "accent",
} as const satisfies Partial<Record<WardrobeField, ChanvrierDyeZone>>;
const OUTFIT_ZONES = ["top", "bottom", "shoes", "jacket", "headwear", "accent"] as const;
const GENDERS = [{ code: "male", name: "Masculine" }, { code: "female", name: "Féminine" }] as const;
const OUTFIT_FAMILIES = ["Maritime", "Tradition"] as const;
const CHOICE_KEYS = Object.keys(OPTIONS) as ChanvrierChoiceKey[];
const HEAD_ACCESSORIES = new Set<string>(["none", "glasses", "round-glasses", "earrings", "scarf", "neckerchief"]);

function isDyeField(field: WardrobeField): field is keyof typeof ZONES {
  return field in ZONES;
}

function sameAppearance(left: ChanvrierAvatarProfile, right: ChanvrierAvatarProfile) {
  if (left.gender !== right.gender || left.skin !== right.skin || left.clothing !== right.clothing) return false;
  const before = getChanvrierAppearance(left);
  const after = getChanvrierAppearance(right);
  return CHOICE_KEYS.every(key => before[key] === after[key]) && CHANVRIER_DYE_ZONES.every(zone => before.dyes?.[zone] === after.dyes?.[zone]);
}

function withOption<Key extends ChanvrierChoiceKey>(profile: ChanvrierAvatarProfile, key: Key, value: ChanvrierAppearance[Key]): ChanvrierAvatarProfile {
  return { ...profile, appearance: { ...getChanvrierAppearance(profile), [key]: value } };
}

function withDye(profile: ChanvrierAvatarProfile, zone: ChanvrierDyeZone, color?: string): ChanvrierAvatarProfile {
  const appearance = getChanvrierAppearance(profile);
  const dyes = { ...appearance.dyes };
  if (color) dyes[zone] = color;
  else delete dyes[zone];
  return { ...profile, appearance: { ...appearance, dyes: Object.keys(dyes).length ? dyes : undefined } };
}

function withOutfit(profile: ChanvrierAvatarProfile, outfit: typeof CHANVRIER_BRETON_OUTFITS[number]): ChanvrierAvatarProfile {
  const appearance = getChanvrierAppearance(profile);
  const dyes = { ...appearance.dyes };
  for (const zone of OUTFIT_ZONES) delete dyes[zone];
  return { ...profile, clothing: outfit.clothing, appearance: { ...appearance, ...outfit.appearance, dyes: { ...dyes, ...outfit.appearance.dyes } } };
}

function resetCategory(profile: ChanvrierAvatarProfile, initial: ChanvrierAvatarProfile, category: Category) {
  let reset = { ...profile };
  const baseline = getChanvrierAppearance(initial);
  for (const field of category.fields) {
    if (field === "outfits") continue;
    reset = field === "gender" || field === "skin" || field === "clothing" ? { ...reset, [field]: initial[field] } : withOption(reset, field, baseline[field]);
    if (isDyeField(field)) {
      const zone = ZONES[field];
      reset = withDye(reset, zone, baseline.dyes?.[zone]);
    }
  }
  return reset;
}

function choose<T>(options: readonly T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

function randomAppearance(profile: ChanvrierAvatarProfile, category: Category): ChanvrierAvatarProfile {
  let next = { ...profile, appearance: getChanvrierAppearance(profile) };
  for (const field of category.fields) {
    if (field === "outfits") continue;
    if (field === "gender") next.gender = choose(GENDERS).code;
    else if (field === "skin") next.skin = choose(CHANVRIER_SKINS).code;
    else if (field === "clothing") next.clothing = choose(CHANVRIER_CLOTHES).code;
    else Object.assign(next.appearance, { [field]: choose<{ code: string }>(OPTIONS[field]).code });
    if (isDyeField(field)) next = { ...next, appearance: getChanvrierAppearance(withDye(next, ZONES[field])) };
  }
  return next;
}

export function useChanvrierWardrobe(profile: ChanvrierAvatarProfile, initial: ChanvrierAvatarProfile, onChange: (profile: ChanvrierAvatarProfile) => void) {
  const [selection, setSelection] = useState<{ category: Category; field: WardrobeField }>({ category: CATEGORIES[1], field: "face" });
  const [history, setHistory] = useState<ChanvrierAvatarProfile[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const { category, field } = selection;
  const reset = resetCategory(profile, initial, category);

  function apply(next: ChanvrierAvatarProfile) {
    if (sameAppearance(profile, next)) return;
    setHistory(previous => [...previous.slice(-39), profile]);
    onChange(next);
  }

  return {
    category, field, recent, apply, preview: onChange,
    chooseCategory: (next: Category) => setSelection({ category: next, field: next.fields[0] }),
    chooseField: (field: WardrobeField) => setSelection({ category, field }),
    canUndo: history.length > 0,
    undo() {
      const previous = history.at(-1);
      if (!previous) return;
      onChange(previous);
      setHistory(history.slice(0, -1));
    },
    canReset: !sameAppearance(profile, reset),
    reset: () => apply(reset),
    randomize: () => apply(randomAppearance(profile, category)),
    remember: (hex: string) => setRecent(previous => [hex, ...previous.filter(color => color !== hex)].slice(0, 8)),
  };
}

function WardrobeChoice({ profile, label, caption, selected, view, onClick }: {
  profile: ChanvrierAvatarProfile; label: string; caption?: string; selected: boolean; view: "portrait" | "full"; onClick: () => void;
}) {
  return <button type="button" className={styles.option} aria-label={caption ? `${caption} : ${label}` : label} aria-pressed={selected} onClick={onClick}>
    <span className={styles.choicePortrait} aria-hidden="true"><ChanvrierAvatar profile={profile} view={view} /></span>
    <span>{label}</span>
    {selected && <Check className={styles.optionCheck} size={15} aria-hidden="true" />}
  </button>;
}

type Swatch = { code: string; name: string; color: string };

function Palette({ field, profile, wardrobe }: {
  field: keyof typeof ZONES; profile: ChanvrierAvatarProfile; wardrobe: ReturnType<typeof useChanvrierWardrobe>;
}) {
  const picker = useId();
  const input = useRef<HTMLInputElement>(null);
  const editing = useRef<string | null>(null);
  const { apply, preview, recent, remember } = wardrobe;
  const label = LABELS[field];
  const zone = ZONES[field];
  const colors = field === "skin" ? CHANVRIER_SKINS : field === "hairColor" ? OPTIONS.hairColor : field === "eyeColor" ? OPTIONS.eyeColor : CHANVRIER_FABRICS;
  const value = getChanvrierColors(profile)[zone];
  const selected = colors.find(item => item.color === value);

  function withPreset(choice: Swatch): ChanvrierAvatarProfile {
    const next = withDye(profile, zone);
    if (field === "skin") {
      const skin = CHANVRIER_SKINS.find(item => item.code === choice.code);
      if (skin) return { ...next, skin: skin.code };
    }
    if (field === "clothing") {
      const fabric = CHANVRIER_CLOTHES.find(item => item.code === choice.code);
      return fabric ? { ...next, clothing: fabric.code } : withDye(next, zone, choice.color);
    }
    return { ...next, appearance: { ...getChanvrierAppearance(next), [field]: choice.code } };
  }

  function chooseColor(hex: string) {
    const named = colors.find(item => item.color === hex);
    apply(named ? withPreset(named) : withDye(profile, zone, hex));
    remember(hex);
  }

  function previewColor(hex: string) {
    if (editing.current === hex || hex === value) return;
    const update = editing.current === null ? apply : preview;
    editing.current = hex;
    update(withDye(profile, zone, hex));
  }

  const finishPicker = useEffectEvent((hex: string) => {
    if (hex !== value) previewColor(hex);
    if (editing.current !== null) remember(hex);
    editing.current = null;
  });
  useEffect(() => {
    const node = input.current;
    if (!node) return;
    const finish = () => finishPicker(node.value);
    node.addEventListener("change", finish);
    node.addEventListener("blur", finish);
    return () => {
      node.removeEventListener("change", finish);
      node.removeEventListener("blur", finish);
    };
  }, []);

  return <fieldset className={styles.palette}>
    <legend className={styles.srOnly}>{label}</legend>
    <div className={styles.swatches}>
      {colors.map(item => <button key={item.code} type="button" aria-label={`${label} : ${item.name}`} aria-pressed={selected?.code === item.code} onClick={() => chooseColor(item.color)}>
        <span className={styles.inkSample} style={{ backgroundColor: item.color }} aria-hidden="true">{selected?.code === item.code && <Check size={14} />}</span>
        <span>{item.name}</span>
      </button>)}
    </div>
    <div className={styles.customColor}>
      <label htmlFor={picker}>Teinte personnalisée<span>{value.toUpperCase()}</span></label>
      <input id={picker} ref={input} type="color" value={value} onInput={event => previewColor(event.currentTarget.value)} onChange={event => previewColor(event.currentTarget.value)} />
    </div>
    {recent.length > 0 && <div className={styles.recentColors} role="group" aria-label="Couleurs récentes">
      <span>Récentes</span>
      {recent.map(hex => <button key={hex} type="button" title={hex.toUpperCase()} aria-label={`Reprendre la couleur ${hex.toUpperCase()}`} aria-pressed={value === hex} onClick={() => chooseColor(hex)}>
        <span className={styles.inkSample} style={{ backgroundColor: hex }} aria-hidden="true">{value === hex && <Check size={14} />}</span>
      </button>)}
    </div>}
  </fieldset>;
}

export function ChanvrierWardrobe({ wardrobe, profile, onViewChange }: {
  wardrobe: ReturnType<typeof useChanvrierWardrobe>; profile: ChanvrierAvatarProfile; onViewChange: (view: ChanvrierWorkshopView) => void;
}) {
  const fieldSelectId = useId();
  const { category, field, apply } = wardrobe;
  const view = category.view;
  const appearance = getChanvrierAppearance(profile);

  return <div className={styles.wardrobe}>
    <nav className={styles.lookTabs} aria-label="Personnaliser l’apparence">
      {CATEGORIES.map(item => <button key={item.id} type="button" aria-pressed={category.id === item.id} onClick={() => {
        wardrobe.chooseCategory(item);
        onViewChange(item.view);
      }}>{item.label}</button>)}
    </nav>
    <div className={styles.wardrobeControls}>
      <div className={styles.fieldSelect}>
        <label htmlFor={fieldSelectId}>Élément à modifier</label>
        <select id={fieldSelectId} value={field} onChange={event => {
          const next = event.target.value as WardrobeField;
          wardrobe.chooseField(next);
          onViewChange(next === "headwear" || next === "headwearColor" ? "portrait" : view);
        }}>{category.fields.map(item => <option key={item} value={item}>{LABELS[item]}</option>)}</select>
      </div>
      <div className={styles.lookTools} role="group" aria-label="Modifications de l’apparence">
        <button type="button" disabled={!wardrobe.canUndo} onClick={wardrobe.undo}><Undo2 size={15} aria-hidden="true" />Annuler</button>
        <button type="button" aria-label={`Modifier au hasard la catégorie ${category.label}`} onClick={wardrobe.randomize}><Shuffle size={15} aria-hidden="true" />Au hasard</button>
        <button type="button" aria-label={`Réinitialiser la catégorie ${category.label}`} disabled={!wardrobe.canReset} onClick={wardrobe.reset}><RotateCcw size={15} aria-hidden="true" />Réinitialiser</button>
      </div>
    </div>
    {isDyeField(field) ? <Palette key={field} field={field} profile={profile} wardrobe={wardrobe} /> : field === "outfits" ?
      OUTFIT_FAMILIES.map(family => <section key={family} className={styles.outfitGroup} aria-label={`Tenues · ${family}`}>
        <h3>{family}</h3>
        <div className={styles.choices}>{CHANVRIER_BRETON_OUTFITS.filter(outfit => outfit.family === family).map(outfit => {
          const next = withOutfit(profile, outfit);
          return <WardrobeChoice key={outfit.code} label={outfit.name} profile={next} selected={sameAppearance(profile, next)} view="full" onClick={() => apply(next)} />;
        })}</div>
      </section>) : <fieldset className={styles.optionGroup} key={field}>
        <legend className={styles.srOnly}>{LABELS[field]}</legend>
        <div className={styles.choices}>{field === "gender" ? GENDERS.map(item => {
          const next = { ...profile, gender: item.code, appearance };
          return <WardrobeChoice key={item.code} label={item.name} profile={next} selected={profile.gender === item.code} view="full" onClick={() => apply(next)} />;
        }) : OPTIONS[field].map(item => {
          const next = withOption(profile, field, item.code);
          const thumbnailView = field === "headwear" || (field === "accessory" && HEAD_ACCESSORIES.has(item.code)) ? "portrait" : view;
          return <WardrobeChoice key={item.code} label={item.name} caption={LABELS[field]} profile={next} selected={appearance[field] === item.code} view={thumbnailView} onClick={() => apply(next)} />;
        })}</div>
      </fieldset>}
  </div>;
}

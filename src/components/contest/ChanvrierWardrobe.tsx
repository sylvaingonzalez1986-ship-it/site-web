"use client";

import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Dices, Eye, Glasses, RotateCcw, Scissors, Shirt, Smile, Undo2, UserRound } from "lucide-react";
import {
  CHANVRIER_APPEARANCE_OPTIONS as OPTIONS, CHANVRIER_CLOTHES, CHANVRIER_DYE_ZONES, CHANVRIER_FABRICS, CHANVRIER_FABRIC_DYES, CHANVRIER_SKINS,
  defaultChanvrierStripe, getChanvrierAppearance, getChanvrierColors, type ChanvrierAppearance, type ChanvrierAvatarProfile, type ChanvrierChoiceKey, type ChanvrierDyeZone,
} from "@/lib/arena-chanvrier";
import { CHANVRIER_BRETON_OUTFITS, CHANVRIER_FEATURED_OUTFITS } from "@/lib/chanvrier-wardrobe-catalog";
import type { ChanvrierExpression } from "../placard/kq-grow-worker-model";
import { ChanvrierAvatar } from "./ChanvrierAvatar";
import type { ChanvrierDetail } from "./chanvrier-snapshot";
import type { ChanvrierWorkshopView } from "./chanvrier-workshop-renderer";
import styles from "./ChanvrierProfileEditor.module.css";

const ACCESSORY_FIELDS = ["accessory", "headwear", "headwearColor", "accentColor"] as const;
const CATEGORIES = [
  { id: "body", label: "Corps", Icon: UserRound, view: "full", fields: ["body", "gender", "skin"] },
  { id: "face", label: "Visage", Icon: Smile, view: "portrait", fields: ["face", "eyebrows", "nose", "mouth"] },
  { id: "eyes", label: "Yeux", Icon: Eye, view: "portrait", fields: ["eyes", "eyeColor"] },
  { id: "hair", label: "Cheveux", Icon: Scissors, view: "portrait", fields: ["hair", "facialHair", "hairColor"] },
  { id: "outfit", label: "Tenue", Icon: Shirt, view: "full", fields: ["outfits", "top", "clothing", "stripeColor", "bottom", "bottomColor", "shoes", "shoeColor", "jacket", "jacketColor"] },
  { id: "details", label: "Accessoires", Icon: Glasses, view: "full", fields: ACCESSORY_FIELDS },
] as const;
type Category = typeof CATEGORIES[number];
type WardrobeField = Category["fields"][number];

const LABELS: Record<WardrobeField, string> = {
  gender: "Base de silhouette", body: "Morphologie", skin: "Couleur de peau",
  face: "Forme du visage", eyes: "Forme des yeux", eyeColor: "Couleur des yeux", eyebrows: "Sourcils", nose: "Nez", mouth: "Expression",
  hair: "Coupe de cheveux", hairColor: "Couleur des cheveux et de la barbe", facialHair: "Barbe et moustache",
  outfits: "Tenues bretonnes", top: "Haut", clothing: "Couleur du haut", bottom: "Bas", bottomColor: "Couleur du bas",
  shoes: "Chaussures", shoeColor: "Couleur des chaussures", jacket: "Veste", jacketColor: "Couleur de la veste",
  stripeColor: "Rayures",
  accessory: "Accessoire", headwear: "Coiffe et chapeau", headwearColor: "Couleur du couvre-chef", accentColor: "Couleur des détails",
};
const ZONES = {
  skin: "skin", eyeColor: "eyes", hairColor: "hair", clothing: "top", stripeColor: "stripe", bottomColor: "bottom", shoeColor: "shoes", jacketColor: "jacket", headwearColor: "headwear", accentColor: "accent",
} as const satisfies Partial<Record<WardrobeField, ChanvrierDyeZone>>;
const PAIRED_PALETTES: Partial<Record<WardrobeField, keyof typeof ZONES>> = {
  eyes: "eyeColor", hair: "hairColor", facialHair: "hairColor", top: "clothing", bottom: "bottomColor", shoes: "shoeColor", jacket: "jacketColor", headwear: "headwearColor",
};
const PAIRED_COLORS = new Set<WardrobeField>([...Object.values(PAIRED_PALETTES), "stripeColor"]);
const OUTFIT_ZONES = ["top", "stripe", "bottom", "shoes", "jacket", "headwear", "accent"] as const;
const GENDERS = [{ code: "male", name: "Masculine" }, { code: "female", name: "Féminine" }] as const;
const MARINIERE_PALETTES = ["clothing", "stripeColor", "bottomColor"] as const;
const LAYERED_PALETTES = ["jacketColor", "bottomColor", "accentColor"] as const;
const OUTFIT_PALETTES = ["clothing", "bottomColor", "accentColor"] as const;
type OutfitPalette = (typeof MARINIERE_PALETTES | typeof LAYERED_PALETTES | typeof OUTFIT_PALETTES)[number];
const FEATURED_OUTFITS = CHANVRIER_FEATURED_OUTFITS.map(code => CHANVRIER_BRETON_OUTFITS.find(outfit => outfit.code === code)!);
const OTHER_OUTFITS = CHANVRIER_BRETON_OUTFITS.filter(outfit => !FEATURED_OUTFITS.includes(outfit));
const CLOTHING_FIELDS = ["top", "bottom", "shoes", "jacket", "headwear", "accessory"] as const;
type ClothingField = typeof CLOTHING_FIELDS[number];
const CHOICE_KEYS = Object.keys(OPTIONS) as ChanvrierChoiceKey[];
const HEAD_ACCESSORIES = new Set<string>(["none", "glasses", "round-glasses", "earrings", "scarf", "neckerchief"]);
const PREVIEW_EXPRESSIONS: Record<ChanvrierExpression, string> = {
  neutral: "Neutre", smile: "Sourire", surprise: "Surprise", focus: "Concentration",
};

function isDyeField(field: WardrobeField): field is keyof typeof ZONES {
  return field in ZONES;
}

function isClothingField(field: WardrobeField): field is ClothingField {
  return CLOTHING_FIELDS.some(piece => piece === field);
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

function resetFields(profile: ChanvrierAvatarProfile, initial: ChanvrierAvatarProfile, fields: readonly WardrobeField[]) {
  let reset = { ...profile };
  const baseline = getChanvrierAppearance(initial);
  for (const field of fields) {
    if (field === "outfits") continue;
    if (field === "gender" || field === "skin" || field === "clothing") reset = { ...reset, [field]: initial[field] };
    else if (field !== "stripeColor") reset = withOption(reset, field, baseline[field]);
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
    else if (field !== "stripeColor") Object.assign(next.appearance, { [field]: choose<{ code: string }>(OPTIONS[field]).code });
    if (isDyeField(field)) next = { ...next, appearance: getChanvrierAppearance(withDye(next, ZONES[field])) };
  }
  return next;
}

export function useChanvrierWardrobe(profile: ChanvrierAvatarProfile, initial: ChanvrierAvatarProfile, onChange: (profile: ChanvrierAvatarProfile) => void) {
  const [category, setCategory] = useState<Category>(CATEGORIES[1]);
  const [lastFields, setLastFields] = useState<Partial<Record<Category["id"], WardrobeField>>>({});
  const [history, setHistory] = useState<ChanvrierAvatarProfile[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const field = lastFields[category.id] ?? category.fields[0];
  const fullOutfit = field === "outfits";
  const reset = resetFields(profile, initial, fullOutfit ? [...category.fields, ...ACCESSORY_FIELDS] : category.fields);

  function apply(next: ChanvrierAvatarProfile) {
    if (sameAppearance(profile, next)) return;
    setHistory(previous => [...previous.slice(-39), profile]);
    onChange(next);
  }

  return {
    category, field, recent, apply, preview: onChange,
    chooseCategory(next: Category) {
      setCategory(next);
      return lastFields[next.id] ?? next.fields[0];
    },
    chooseField: (field: WardrobeField) => setLastFields(previous => ({ ...previous, [category.id]: field })),
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

function WardrobeChoice({ profile, label, caption, selected, view, feature, onClick }: {
  profile: ChanvrierAvatarProfile; label: string; caption?: string; selected: boolean; view: "portrait" | "full"; feature?: WardrobeField; onClick: () => void;
}) {
  const detail: ChanvrierDetail | undefined = feature === "eyes" || feature === "eyebrows" || feature === "nose" || feature === "mouth" || feature === "facialHair" ? feature : undefined;
  return <button type="button" className={styles.option} aria-label={caption ? `${caption} : ${label}` : label} aria-pressed={selected} onClick={onClick}>
    <span className={styles.choicePortrait} data-detail={detail} data-frame={view} aria-hidden="true"><ChanvrierAvatar profile={profile} view={view} detail={detail} /></span>
    <span>{label}</span>
    {selected && <span className={styles.optionCheck} aria-hidden="true"><Check size={14} strokeWidth={3} /></span>}
  </button>;
}

type Swatch = { code: string; name: string; color: string };

function WardrobeArchive({ label, expanded, onToggle, children }: {
  label: string; expanded: boolean; onToggle: (expanded: boolean) => void; children: () => ReactNode;
}) {
  return <details className={styles.outfitGroup} open={expanded} onToggle={event => onToggle(event.currentTarget.open)}>
    <summary>{label}</summary>
    {expanded && <div className={styles.choices}>{children()}</div>}
  </details>;
}

function Palette({ field, profile, wardrobe, title }: {
  field: keyof typeof ZONES; profile: ChanvrierAvatarProfile; wardrobe: ReturnType<typeof useChanvrierWardrobe>;
  title?: string;
}) {
  const picker = useId();
  const input = useRef<HTMLInputElement>(null);
  const editing = useRef<string | null>(null);
  const { apply, preview, recent, remember } = wardrobe;
  const label = title ?? LABELS[field];
  const zone = ZONES[field];
  const colors = field === "skin" ? CHANVRIER_SKINS : field === "hairColor" ? OPTIONS.hairColor : field === "eyeColor" ? OPTIONS.eyeColor : CHANVRIER_FABRIC_DYES;
  const look = getChanvrierAppearance(profile), dyes = getChanvrierColors(profile);
  const autoStripe = field === "stripeColor" && !look.dyes?.stripe;
  const value = dyes[zone];
  const selected = autoStripe ? undefined : colors.find(item => item.color === value);

  function withPreset(choice: Swatch): ChanvrierAvatarProfile {
    if (field === "stripeColor" || colors === CHANVRIER_FABRIC_DYES && !CHANVRIER_FABRICS.some(fabric => fabric.code === choice.code)) {
      return withDye(profile, zone, choice.color);
    }
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

  return <fieldset className={styles.palette} data-palette={zone}>
    <legend className={styles.fieldHeading}>{label}</legend>
    <div className={styles.swatches}>
      {field === "stripeColor" && <button type="button" aria-pressed={autoStripe} onClick={() => apply(withDye(profile, "stripe"))}>
        <span className={styles.inkSample} style={{ backgroundColor: defaultChanvrierStripe(dyes.top) }} aria-hidden="true" />
        <span>Auto</span>
      </button>}
      {colors.map(item => <button key={item.code} type="button" aria-label={`${label} : ${item.name}`} aria-pressed={selected?.code === item.code} onClick={() => chooseColor(item.color)}>
        <span className={styles.inkSample} style={{ backgroundColor: item.color }} aria-hidden="true">{selected?.code === item.code && <span className={styles.swatchCheck}><Check size={11} strokeWidth={3} /></span>}</span>
        <span>{item.name}</span>
      </button>)}
    </div>
    <details className={styles.customColorMenu}>
      <summary>Teinte personnalisée{!selected && !autoStripe && <span> · {value.toUpperCase()}</span>}</summary>
      <div className={styles.customColor}>
        <label htmlFor={picker}>Choisir une teinte<span>{value.toUpperCase()}</span></label>
        <input id={picker} ref={input} type="color" value={value} onInput={event => previewColor(event.currentTarget.value)} onChange={event => previewColor(event.currentTarget.value)} />
      </div>
      {recent.length > 0 && <div className={styles.recentColors} role="group" aria-label="Couleurs récentes">
        <span>Récentes</span>
        {recent.map(hex => <button key={hex} type="button" title={hex.toUpperCase()} aria-label={`Reprendre la couleur ${hex.toUpperCase()}`} aria-pressed={value === hex} onClick={() => chooseColor(hex)}>
          <span className={styles.inkSample} style={{ backgroundColor: hex }} aria-hidden="true">{value === hex && <span className={styles.swatchCheck}><Check size={11} strokeWidth={3} /></span>}</span>
        </button>)}
      </div>}
    </details>
  </fieldset>;
}

export function ChanvrierWardrobe({ wardrobe, profile, onViewChange, onCategoryChange, expression, onExpressionChange }: {
  wardrobe: ReturnType<typeof useChanvrierWardrobe>; profile: ChanvrierAvatarProfile; onViewChange: (view: ChanvrierWorkshopView) => void;
  onCategoryChange: () => void;
  expression: ChanvrierExpression;
  onExpressionChange: (expression: ChanvrierExpression) => void;
}) {
  const { category, field, apply } = wardrobe;
  const view = category.view;
  const appearance = getChanvrierAppearance(profile);
  const fields = category.fields.filter(item => !PAIRED_COLORS.has(item));
  const palette = PAIRED_PALETTES[field];
  const [outfitPalette, setOutfitPalette] = useState<OutfitPalette>();
  const [openedArchives, setOpenedArchives] = useState<Partial<Record<WardrobeField, boolean>>>({});
  const outfitPalettes = appearance.top === "mariniere" ? MARINIERE_PALETTES : appearance.jacket !== "none" ? LAYERED_PALETTES : OUTFIT_PALETTES;
  const activePalette = outfitPalettes.find(palette => palette === outfitPalette);
  const zoneLabels = {
    clothing: appearance.top === "mariniere" ? "Maille" : "Haut",
    bottomColor: "Bas",
    stripeColor: "Rayures",
    accentColor: "Détails",
    jacketColor: appearance.jacket === "raincoat" ? "Ciré" : "Veste",
  };
  const outfit = field === "outfits"
    ? CHANVRIER_BRETON_OUTFITS.find(item => sameAppearance(profile, withOutfit(profile, item)))
    : undefined;
  const archiveOpen = Boolean(openedArchives[field]);
  const changeArchive = (expanded: boolean) => setOpenedArchives(previous => ({ ...previous, [field]: expanded }));
  const resetLabel = field === "outfits" ? "Réinitialiser la tenue et les accessoires" : `Réinitialiser la catégorie ${category.label}`;
  const hairStrip = useRef<HTMLDivElement>(null);
  const hairIndex = OPTIONS.hair.findIndex(item => item.code === appearance.hair);
  const changeHair = (offset: number) => {
    const index = (hairIndex + offset + OPTIONS.hair.length) % OPTIONS.hair.length;
    apply(withOption(profile, "hair", OPTIONS.hair[index].code));
  };
  useLayoutEffect(() => {
    const strip = hairStrip.current;
    if (field !== "hair" || !strip) return;
    // Only move the horizontal strip. Keep focus and the editor's vertical scroll.
    const revealSelection = () => {
      const choice = strip.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
      if (!choice) return;
      const bounds = strip.getBoundingClientRect();
      const item = choice.getBoundingClientRect();
      if (item.left < bounds.left) strip.scrollLeft += item.left - bounds.left - 5;
      else if (item.right > bounds.right) strip.scrollLeft += item.right - bounds.right + 5;
    };
    revealSelection();
    const observer = new ResizeObserver(revealSelection);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [field, appearance.hair]);
  const accessoryNote = field === "hair" && appearance.headwear !== "none" ? "Les vignettes montrent les coiffures sans couvre-chef."
    : (field === "eyes" || field === "eyebrows") && (appearance.accessory === "glasses" || appearance.accessory === "round-glasses") ? "Les vignettes montrent le regard sans lunettes." : null;
  const outfitChoices = (outfits: readonly typeof CHANVRIER_BRETON_OUTFITS[number][]) => outfits.map(outfit => {
    const next = withOutfit(profile, outfit);
    return <WardrobeChoice key={outfit.code} label={outfit.name} profile={next} selected={sameAppearance(profile, next)} view="full" onClick={() => apply(next)} />;
  });
  const renderChoice = <Key extends ChanvrierChoiceKey,>(key: Key, item: { code: ChanvrierAppearance[Key]; name: string }) => {
    const next = withOption(profile, key, item.code);
    const thumbnailView = key === "headwear" || (key === "accessory" && HEAD_ACCESSORIES.has(item.code)) ? "portrait" : view;
    const visibleTrait = key === "hair" ? withOption(next, "headwear", "none")
      : key === "eyes" || key === "eyebrows" ? withOption(next, "accessory", "none") : next;
    return <WardrobeChoice key={item.code} label={item.name} caption={LABELS[key]} profile={visibleTrait} selected={appearance[key] === item.code} view={thumbnailView} feature={key} onClick={() => apply(next)} />;
  };

  const clothingChoices = isClothingField(field) ? (() => {
    const mainCodes = new Set<string>(["none", ...FEATURED_OUTFITS.map(outfit => outfit.appearance[field])]);
    const items = OPTIONS[field];
    return {
      visible: items.filter(item => mainCodes.has(item.code) || (!archiveOpen && appearance[field] === item.code)),
      historic: items.filter(item => !mainCodes.has(item.code)),
    };
  })() : null;

  return <div className={styles.wardrobe}>
    <div className={styles.lookControls}>
      <div className={styles.lookNavigation}>
        <nav className={styles.lookTabs} aria-label="Personnaliser l’apparence">
          {CATEGORIES.map(item => <button key={item.id} type="button" aria-pressed={category.id === item.id} onClick={() => {
            const nextField = wardrobe.chooseCategory(item);
            if (item.id !== "face") onExpressionChange("neutral");
            onCategoryChange();
            onViewChange(nextField === "headwear" ? "portrait" : item.view);
          }}><item.Icon size={22} aria-hidden="true" /><span>{item.label}</span></button>)}
        </nav>
        {fields.length > 1 && <div className={styles.fieldTabs} role="group" aria-label="Élément à modifier">
          {fields.map(item => <button key={item} type="button" aria-pressed={field === item} onClick={() => {
            wardrobe.chooseField(item);
            onCategoryChange();
            onViewChange(item === "headwear" ? "portrait" : view);
          }}>{LABELS[item]}</button>)}
        </div>}
      </div>
      <div className={styles.lookTools} role="group" aria-label={`Modifier la catégorie ${category.label}`}>
        <button type="button" disabled={!wardrobe.canUndo} onClick={wardrobe.undo}><Undo2 size={16} aria-hidden="true" />Annuler</button>
        <button type="button" aria-label={`Modifier au hasard la catégorie ${category.label}`} onClick={wardrobe.randomize}><Dices size={16} aria-hidden="true" />Au hasard</button>
        <button type="button" aria-label={resetLabel} title={resetLabel} disabled={!wardrobe.canReset} onClick={wardrobe.reset}><RotateCcw size={16} aria-hidden="true" />Réinitialiser</button>
      </div>
    </div>
    {category.id === "face" && <label className={styles.expressionPreview}>Essayer une expression
      <select value={expression} onChange={event => {
        onExpressionChange(event.currentTarget.value as ChanvrierExpression);
        onViewChange("portrait");
      }}>
        {Object.entries(PREVIEW_EXPRESSIONS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
    </label>}
    {field === "outfits" && <p className={styles.currentOutfit} role="status"><strong>Tenue portée</strong> <span>{outfit?.name ?? "Tenue personnalisée"}</span></p>}
    {isDyeField(field) ? <Palette key={field} field={field} profile={profile} wardrobe={wardrobe} /> : field === "outfits" ? <>
      <div className={styles.fieldTabs} role="group" aria-label="Couleurs de la tenue">
        {outfitPalettes.map(zone => <button key={zone} type="button" aria-pressed={activePalette === zone} onClick={() => setOutfitPalette(current => current === zone ? undefined : zone)}>{zoneLabels[zone]}</button>)}
      </div>
      {activePalette && <Palette key={activePalette} field={activePalette} profile={profile} wardrobe={wardrobe} title={zoneLabels[activePalette]} />}
      <section className={styles.outfitGroup} aria-label="Tenues bretonnes">
        <div className={styles.choices}>{outfitChoices(!archiveOpen && outfit && OTHER_OUTFITS.includes(outfit) ? [...FEATURED_OUTFITS, outfit] : FEATURED_OUTFITS)}</div>
      </section>
      <WardrobeArchive key={field} label="Autres tenues bretonnes" expanded={archiveOpen} onToggle={changeArchive}>{() => outfitChoices(OTHER_OUTFITS)}</WardrobeArchive>
    </> : <fieldset className={styles.optionGroup} key={field} aria-label={field === "hair" ? LABELS.hair : undefined}>
        {field === "hair" ? <div className={styles.hairStepper}>
          <button type="button" aria-label="Coupe précédente" title="Coupe précédente" onClick={() => changeHair(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
          <span role="status" aria-atomic="true"><strong>{OPTIONS.hair[hairIndex].name}</strong> <small>{hairIndex + 1} sur {OPTIONS.hair.length}</small></span>
          <button type="button" aria-label="Coupe suivante" title="Coupe suivante" onClick={() => changeHair(1)}><ChevronRight size={20} aria-hidden="true" /></button>
        </div> : <legend className={styles.fieldHeading}>{LABELS[field]}</legend>}
        <div className={styles.choices} ref={field === "hair" ? hairStrip : undefined} data-feature-choices={field}>{field === "gender" ? GENDERS.map(item => {
          const next = { ...profile, gender: item.code, appearance };
          return <WardrobeChoice key={item.code} label={item.name} profile={next} selected={profile.gender === item.code} view="full" onClick={() => apply(next)} />;
        }) : (clothingChoices?.visible ?? OPTIONS[field]).map(item => renderChoice(field, item))}</div>
        {field !== "gender" && clothingChoices && clothingChoices.historic.length > 0 && <WardrobeArchive key={field} label="Autres pièces" expanded={archiveOpen} onToggle={changeArchive}>
          {() => clothingChoices.historic.map(item => renderChoice(field, item))}
        </WardrobeArchive>}
      </fieldset>}
    {accessoryNote && <p className={styles.traitNote}>{accessoryNote}</p>}
    {palette && <Palette key={palette} field={palette} profile={profile} wardrobe={wardrobe} />}
  </div>;
}

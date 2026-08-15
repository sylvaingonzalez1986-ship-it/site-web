"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import styles from "./KanabQuestDicePrototype.module.css";

export type KqPhysicsDiceHandle = {
  roll: (values: number[], onPhase?: (phase: KqDiceMotionPhase) => void) => Promise<boolean>;
  sync: (values: number[]) => Promise<boolean>;
  reveal: (values: number[]) => boolean;
};

export type KqDiceMotionPhase = "idle" | "preparing" | "rolling" | "settling" | "summarizing";

type DiceBoxInstance = {
  initialize: () => Promise<void>;
  roll: (notation: string) => Promise<unknown>;
  clearDice: () => void;
  resizeWorld: () => void;
  setDimensions: (size: { x: number; y: number }) => void;
  running: number | boolean;
  renderer?: { dispose: () => void; domElement: HTMLCanvasElement };
  diceList?: PhysicsDie[];
  swapDiceFace: (die: PhysicsDie, value: number) => void;
  display?: { containerWidth: number };
  baseScale?: number;
  scene?: unknown;
  camera?: unknown;
};

type PhysicsTexture = { image?: HTMLCanvasElement; needsUpdate?: boolean };
type PhysicsMaterial = {
  map?: PhysicsTexture;
  bumpMap?: PhysicsTexture | null;
  color?: { set: (color: string) => void };
  clone?: () => PhysicsMaterial;
  needsUpdate?: boolean;
};
type PhysicsDie = {
  position: { x: number; y: number; z: number };
  material: PhysicsMaterial | PhysicsMaterial[];
  getLastValue?: () => { value?: number };
  storeRolledValue?: (reason?: string) => void;
};

const FACE_PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0.5, 0.5]],
  2: [[0.29, 0.29], [0.71, 0.71]],
  3: [[0.29, 0.29], [0.5, 0.5], [0.71, 0.71]],
  4: [[0.29, 0.29], [0.71, 0.29], [0.29, 0.71], [0.71, 0.71]],
  5: [[0.29, 0.29], [0.71, 0.29], [0.5, 0.5], [0.29, 0.71], [0.71, 0.71]],
  6: [[0.29, 0.25], [0.71, 0.25], [0.29, 0.5], [0.71, 0.5], [0.29, 0.75], [0.71, 0.75]],
};

type DiePalette = {
  face: readonly [string, string, string];
  pip: readonly [string, string, string];
  pattern: string;
  edge: string;
};

const IVORY_DIE_PALETTE: DiePalette = {
  face: ["#fffdf6", "#fff5df", "#dfccb0"],
  pip: ["#4a463f", "#171512", "#050605"],
  pattern: "rgba(6,107,102,.11)",
  edge: "#ead8bc",
};

type ValidatedDieColors = { face: string; edge: string };

const getValidatedDieColors = (value: number, index: number): ValidatedDieColors => {
  if (index === 3) return { face: "#9a9388", edge: "#655f57" };
  if (value === 1) return { face: "#e45a2a", edge: "#8e281c" };
  if (value === 4 || value === 5) return { face: "#68b97a", edge: "#32714c" };
  if (value === 6) return { face: "#f4bc3c", edge: "#a76808" };
  return { face: "#fff7e4", edge: "#ead8bc" };
};

const paintKanabQuestFace = (material: PhysicsMaterial, value: number, palette = IVORY_DIE_PALETTE) => {
  const canvas = material.map?.image;
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  const size = Math.min(width, height);
  const inset = size * 0.045;
  const radius = size * 0.16;

  context.clearRect(0, 0, width, height);
  context.save();
  context.beginPath();
  context.roundRect(inset, inset, width - inset * 2, height - inset * 2, radius);
  context.clip();

  const faceGradient = context.createLinearGradient(0, 0, width, height);
  faceGradient.addColorStop(0, palette.face[0]);
  faceGradient.addColorStop(0.58, palette.face[1]);
  faceGradient.addColorStop(1, palette.face[2]);
  context.fillStyle = faceGradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = palette.pattern;
  const dotStep = Math.max(8, Math.round(size * 0.055));
  const dotRadius = Math.max(1.2, size * 0.006);
  for (let x = dotStep; x < width; x += dotStep) {
    for (let y = dotStep; y < height; y += dotStep) {
      if (x + y > size * 1.38 || x + y < size * 0.32) {
        context.beginPath();
        context.arc(x, y, dotRadius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  const pipRadius = size * 0.082;
  FACE_PIPS[value].forEach(([x, y]) => {
    const centerX = width * x;
    const centerY = height * y;
    const pipGradient = context.createRadialGradient(
      centerX - pipRadius * 0.24,
      centerY - pipRadius * 0.24,
      pipRadius * 0.12,
      centerX,
      centerY,
      pipRadius,
    );
    pipGradient.addColorStop(0, palette.pip[0]);
    pipGradient.addColorStop(0.52, palette.pip[1]);
    pipGradient.addColorStop(1, palette.pip[2]);
    context.beginPath();
    context.arc(centerX, centerY, pipRadius, 0, Math.PI * 2);
    context.fillStyle = pipGradient;
    context.shadowColor = "rgba(255,255,255,.48)";
    context.shadowOffsetX = -pipRadius * 0.16;
    context.shadowOffsetY = -pipRadius * 0.16;
    context.shadowBlur = pipRadius * 0.12;
    context.fill();
  });
  context.restore();

  context.beginPath();
  context.roundRect(inset, inset, width - inset * 2, height - inset * 2, radius);
  context.lineWidth = Math.max(2, size * 0.025);
  context.strokeStyle = "#171512";
  context.stroke();

  if (material.map) material.map.needsUpdate = true;
  material.bumpMap = null;
  material.needsUpdate = true;
};

const applyKanabQuestFaces = (dice: PhysicsDie[]) => {
  dice.forEach((die) => {
    const materials = Array.isArray(die.material) ? die.material : [die.material];
    materials.slice(0, 2).forEach((material) => {
      material.color?.set(IVORY_DIE_PALETTE.edge);
      material.needsUpdate = true;
    });
    // Dice Box réserve les deux premiers matériaux aux arêtes du cube.
    for (let value = 1; value <= 6; value += 1) {
      const material = materials[value + 1];
      if (material) {
        material.color?.set("#ffffff");
        paintKanabQuestFace(material, value);
      }
    }
  });
};

const applyValidatedDieColors = (dice: PhysicsDie[], values: number[]) => {
  dice.forEach((die, index) => {
    const usesMaterialArray = Array.isArray(die.material);
    const sourceMaterials: PhysicsMaterial[] = Array.isArray(die.material) ? die.material : [die.material];
    const materials = sourceMaterials.map((material) => material.clone?.() ?? material);
    die.material = usesMaterialArray ? materials : materials[0];
    const meshValue = die.getLastValue?.().value;
    const value = meshValue && meshValue >= 1 && meshValue <= 6 ? meshValue : values[index];
    const colors = getValidatedDieColors(value, index);
    materials.slice(0, 2).forEach((material) => {
      material.color?.set(colors.edge);
      material.needsUpdate = true;
    });
    materials.slice(2).forEach((material) => {
      // Les matériaux sont propres à chaque mesh, contrairement aux textures mises en cache.
      material.color?.set(colors.face);
      material.needsUpdate = true;
    });
  });
};

const PHYSICS_DICE_STAGE_ID = "kq-physics-dice-stage";

export const KqPhysicsDice = forwardRef<KqPhysicsDiceHandle>(function KqPhysicsDice(_, ref) {
  const instanceRef = useRef<DiceBoxInstance | null>(null);
  const summaryFrameRef = useRef<number | null>(null);
  const syncFrameRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const initialize = async () => {
      try {
        const { default: DiceBox } = await import("@3d-dice/dice-box-threejs");
        if (cancelled) return;

        const stage = document.getElementById(PHYSICS_DICE_STAGE_ID);
        if (!stage) throw new Error("Zone de lancer introuvable");
        const responsiveDieScale = Math.max(72, Math.min(112, stage.clientWidth * 0.3));

        const diceBox = new DiceBox(`#${PHYSICS_DICE_STAGE_ID}`, {
          sounds: false,
          shadows: true,
          theme_surface: "green-felt",
          theme_customColorset: {
            name: "kanab-quest-ivory",
            foreground: "#171512",
            background: "#fff7e4",
            outline: "#ead8bc",
            texture: "none",
            material: "plastic",
          },
          gravity_multiplier: 520,
          light_intensity: 0.9,
          baseScale: responsiveDieScale,
          strength: 1.15,
          iterationLimit: 900,
        }) as DiceBoxInstance;

        // La bibliothèque attache sinon un écouteur global impossible à retirer.
        // Le ResizeObserver local garde le canvas ajusté sans fuite entre les pages.
        diceBox.resizeWorld = () => {};
        await diceBox.initialize();
        if (cancelled) {
          diceBox.running = false;
          diceBox.renderer?.dispose();
          return;
        }

        instanceRef.current = diceBox;
        resizeObserver = new ResizeObserver(([entry]) => {
          const width = Math.max(1, Math.round(entry.contentRect.width));
          const height = Math.max(1, Math.round(entry.contentRect.height));
          diceBox.setDimensions({ x: width, y: height });
        });
        resizeObserver.observe(stage);
        setStatus("ready");
      } catch (error) {
        console.warn("Le moteur physique des dés est indisponible, utilisation du rendu de secours.", error);
        if (!cancelled) setStatus("error");
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (summaryFrameRef.current !== null) window.cancelAnimationFrame(summaryFrameRef.current);
      if (syncFrameRef.current !== null) window.cancelAnimationFrame(syncFrameRef.current);
      const diceBox = instanceRef.current;
      instanceRef.current = null;
      if (!diceBox) return;
      diceBox.running = false;
      diceBox.clearDice();
      diceBox.renderer?.dispose();
      diceBox.renderer?.domElement.remove();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    roll: async (values, onPhase) => {
      const diceBox = instanceRef.current;
      const validValues = values.filter((value) => Number.isInteger(value) && value >= 1 && value <= 6);
      if (status !== "ready" || !diceBox || validValues.length === 0) return false;
      try {
        if (summaryFrameRef.current !== null) window.cancelAnimationFrame(summaryFrameRef.current);
        onPhase?.("rolling");
        const rollPromise = diceBox.roll(`${validValues.length}d6@${validValues.join(",")}`);
        applyKanabQuestFaces(diceBox.diceList ?? []);
        await rollPromise;
        onPhase?.("settling");
        await new Promise<void>((resolve) => window.setTimeout(resolve, 140));
        const dice = diceBox.diceList ?? [];
        if (dice.length === validValues.length) {
          onPhase?.("summarizing");
          await new Promise<void>((resolve) => {
            const duration = 680;
            const startedAt = window.performance.now();
            const stageWidth = Math.max(280, diceBox.display?.containerWidth ?? 420);
            const spacing = Math.min((diceBox.baseScale ?? 100) * 1.32, stageWidth / (dice.length + 0.1));
            const positions = dice.map((die, index) => ({
              fromX: die.position.x,
              fromY: die.position.y,
              toX: (index - (dice.length - 1) / 2) * spacing,
              toY: 0,
            }));
            const animateSummary = (now: number) => {
              const progress = Math.min(1, (now - startedAt) / duration);
              const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
              dice.forEach((die, index) => {
                const position = positions[index];
                die.position.x = position.fromX + (position.toX - position.fromX) * eased;
                die.position.y = position.fromY + (position.toY - position.fromY) * eased;
              });
              if (diceBox.renderer && diceBox.scene && diceBox.camera) {
                (diceBox.renderer as unknown as { render: (scene: unknown, camera: unknown) => void }).render(diceBox.scene, diceBox.camera);
              }
              if (progress < 1) {
                summaryFrameRef.current = window.requestAnimationFrame(animateSummary);
              } else {
                summaryFrameRef.current = null;
                resolve();
              }
            };
            summaryFrameRef.current = window.requestAnimationFrame(animateSummary);
          });
        }
        return true;
      } catch (error) {
        console.warn("Le lancer physique a échoué, utilisation du rendu de secours.", error);
        setStatus("error");
        return false;
      }
    },
    sync: async (values) => {
      const diceBox = instanceRef.current;
      const validValues = values.filter((value) => Number.isInteger(value) && value >= 1 && value <= 6);
      const dice = diceBox?.diceList ?? [];
      if (status !== "ready" || !diceBox || dice.length !== validValues.length) return false;
      const changes = dice.flatMap((die, index) => {
        const currentValue = die.getLastValue?.().value;
        return currentValue === validValues[index]
          ? []
          : [{ die, value: validValues[index], fromX: die.position.x, fromZ: die.position.z }];
      });
      if (changes.length === 0) return true;
      if (syncFrameRef.current !== null) window.cancelAnimationFrame(syncFrameRef.current);
      return new Promise<boolean>((resolve) => {
        const duration = 440;
        const startedAt = window.performance.now();
        const lift = (diceBox.baseScale ?? 100) * 0.58;
        let facesSwapped = false;
        const animateChange = (now: number) => {
          const progress = Math.min(1, (now - startedAt) / duration);
          const bounce = Math.sin(progress * Math.PI);
          changes.forEach(({ die, fromX, fromZ }, index) => {
            die.position.x = fromX + Math.sin(progress * Math.PI * 2) * (index % 2 === 0 ? -4 : 4);
            die.position.z = fromZ + lift * bounce;
          });
          if (!facesSwapped && progress >= 0.48) {
            facesSwapped = true;
            changes.forEach(({ die, value }) => {
              diceBox.swapDiceFace(die, value);
              die.storeRolledValue?.("forced");
            });
          }
          if (diceBox.renderer && diceBox.scene && diceBox.camera) {
            (diceBox.renderer as unknown as { render: (scene: unknown, camera: unknown) => void }).render(diceBox.scene, diceBox.camera);
          }
          if (progress < 1) {
            syncFrameRef.current = window.requestAnimationFrame(animateChange);
          } else {
            changes.forEach(({ die, fromX, fromZ }) => {
              die.position.x = fromX;
              die.position.z = fromZ;
            });
            syncFrameRef.current = null;
            if (diceBox.renderer && diceBox.scene && diceBox.camera) {
              (diceBox.renderer as unknown as { render: (scene: unknown, camera: unknown) => void }).render(diceBox.scene, diceBox.camera);
            }
            resolve(true);
          }
        };
        syncFrameRef.current = window.requestAnimationFrame(animateChange);
      });
    },
    reveal: (values) => {
      const diceBox = instanceRef.current;
      const validValues = values.filter((value) => Number.isInteger(value) && value >= 1 && value <= 6);
      const dice = diceBox?.diceList ?? [];
      if (status !== "ready" || !diceBox || dice.length !== validValues.length) return false;
      applyValidatedDieColors(dice, validValues);
      if (diceBox.renderer && diceBox.scene && diceBox.camera) {
        (diceBox.renderer as unknown as { render: (scene: unknown, camera: unknown) => void }).render(diceBox.scene, diceBox.camera);
      }
      return true;
    },
  }), [status]);

  return <div id={PHYSICS_DICE_STAGE_ID} className={styles.physicsDiceStage} data-status={status} aria-hidden="true" />;
});

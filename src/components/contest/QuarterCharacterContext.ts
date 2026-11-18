"use client";

import { createContext } from "react";
import type { ChanvrierProfile } from "@/lib/arena-chanvrier";

/** The appearance already verified on entry to this player's quarter. */
export const QuarterCharacterContext = createContext<ChanvrierProfile | null>(null);
export const QuarterAppearanceEditorContext = createContext<{ open: () => void; editing: boolean } | null>(null);

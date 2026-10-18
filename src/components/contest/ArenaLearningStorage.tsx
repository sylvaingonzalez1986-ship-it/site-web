'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ArenaLearningStorage } from '@/lib/arena-introduction';

const LearningStorage = createContext<ArenaLearningStorage | undefined>(undefined);

export function ArenaLearningStorageProvider({ storage, children }: { storage: ArenaLearningStorage; children: ReactNode }) {
  return <LearningStorage value={storage}>{children}</LearningStorage>;
}

export const useArenaLearningStorage = () => useContext(LearningStorage);

import type { ReactNode } from "react";

export default function ArenaLayout({ children }: { children: ReactNode }) {
  // The game owns its tutorial in PlacardPlayerShell; arena pages stay independent.
  return children;
}

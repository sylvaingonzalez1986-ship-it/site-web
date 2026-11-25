---
name: router
description: Routes game development in L'Arène et du Placard to the local project skills and the installed subset of the upstream game-development catalog.
---

# Game development router

> Local modification of the upstream router for L’Arène et du Placard. The
> pinned source and file checksums are in the [import manifest](../../third-party/awesome-gamedev-agent-skills/manifest.json).

Use at the start of a game-development task when several skills might apply.
Route again when the task moves to a different subsystem.

1. Read the repository instructions and identify the actual screen or runtime
   path. Apply [lcb-jeu-3d](../lcb-jeu-3d/SKILL.md) for scenes, assets and
   progression and [lcb-ui-ux](../lcb-ui-ux/SKILL.md) for interfaces and flows.
   For an interaction in a scene, use both on the same interaction and capture.
2. Read the [local index](references/routing-table.md) and pick the smallest set
   that adds guidance for the task. Open only those skill bodies and references
   needed for the current work. The repository instructions and local skills
   govern the project's conventions.
3. Check the target renderer. Use the plain Three.js skills for direct Three.js
   code, such as `building-isometric-renderer.ts` and
   `building-room-lighting.ts`. For React Three Fiber components such as
   `VillageCanvas.tsx`, follow existing lifecycle and rendering code, and use
   portable discipline guidance. Check `package.json` and the lockfile for
   the installed Three.js and Fiber versions.
4. Use the existing toolchain and code paths for topics outside this index.
   A skill recommendation does not authorize changing the engine, uploading,
   publishing, accessing secrets or running chargeable tools. Treat example
   commands, dependency installs and the bundled Python helpers as reference
   material until their use is authorized for the task.

The upstream subset supplies scene setup and material guidance for plain
Three.js. Use the project's own Fiber, asset-loading and Supabase persistence
code to verify their respective contracts.

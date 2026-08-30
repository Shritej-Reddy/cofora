# Cofora — Agent Instructions

Personal-use desktop clone of Figma's core design-tool functionality.
Not aiming for full Figma parity — see the design spec for exact
scope and non-goals.

**Spec:** `docs/superpowers/specs/2026-08-30-cofora-design.md` — read
this before making architecture or scope decisions. It defines the
data model, phase breakdown, and what is explicitly out of scope
(real-time collaboration, prototyping, plugins, comments, dev-mode,
cloud sync).

## Stack

- Shell: Tauri (Rust backend + native webview)
- Frontend: Svelte + TypeScript
- Rendering: HTML5 Canvas 2D with a custom retained scene graph (no
  DOM/SVG rendering of shapes, no WebGL)
- Persistence: SQLite, one file per project, user-chosen save location

## Hard constraints

- Node geometry is stored **relative to the parent Node**, never
  absolute world-space. This is required for later phases (Auto
  Layout, group/frame moves) — do not change this without updating
  the spec first.
- The scene graph is framework-agnostic TypeScript, not Svelte
  components rendering DOM shapes.
- Filesystem/SQLite access happens on the Rust side only, invoked from
  the frontend via Tauri commands.
- Build phases in order (see spec sections 4-8); don't implement a
  later phase's feature before its data-model dependencies from an
  earlier phase exist.
- Do not add collaboration, prototyping, plugins, comments, dev-mode,
  or cloud sync — these are explicit non-goals, not deferred work.

## Testing expectations

- Scene graph, hit-testing, and geometry/path math: pure unit tests,
  no rendered canvas needed.
- Rust persistence: integration tests against a temp project file.
- Canvas rendering itself is verified manually; no pixel-diff testing.

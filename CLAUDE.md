# Cofora

Personal-use desktop clone of Figma's core design-tool functionality.
Not aiming for full Figma parity — see the design spec for exact
scope and non-goals.

**Spec:** `docs/superpowers/specs/2026-08-30-cofora-design.md` — read
this before making architecture or scope decisions. It defines the
data model, phase breakdown, and what is explicitly out of scope
(real-time collaboration, prototyping, plugins, comments, dev-mode,
cloud sync).

## Stack

- **Shell:** Tauri (Rust backend + native webview)
- **Frontend:** Svelte + TypeScript
- **Rendering:** HTML5 Canvas 2D with a custom retained scene graph
  (no DOM/SVG rendering of shapes, no WebGL)
- **Persistence:** SQLite, one file per project, user-chosen save
  location (like Figma Desktop's local drafts) — not a central
  app-data store

## Architecture notes

- The scene graph (Node tree: Project → Page → Node) is plain,
  framework-agnostic TypeScript and is the single source of truth for
  geometry/style. Svelte components read/write it through a store and
  never render shapes as DOM elements.
- Node geometry (`x`, `y`, `width`, `height`, `rotation`) is stored
  **relative to the parent Node**, not world-space. This is
  load-bearing for later phases (Auto Layout, groups/frames moving as
  a unit) — do not switch to absolute world-space storage.
- Hit-testing/selection is a separate pass from rendering (bounding-box
  + precise path test), not derived from DOM event targets.
- File I/O and SQLite access happen on the Rust side, invoked from the
  frontend via Tauri commands — the webview does not touch the
  filesystem directly.

## Phase order (do not reorder without re-running the brainstorming/spec process)

1. Canvas engine + shapes (rect/ellipse/line/polygon/frame) + text +
   layers + multi-select/align + fill/stroke/gradient + undo/redo +
   local persistence + PNG/JPG/SVG export
2. Pen tool (vector paths) + boolean operations
3. Auto Layout
4. Reusable styles + Components/Instances
5. Persistent version history + PDF export + copy-as-CSS

Each phase builds on data-model assumptions from earlier phases
(see spec section 3). Don't build Phase 3+ features before their
dependencies from earlier phases exist.

## Testing

- Scene graph, hit-testing, and geometry/path math are pure
  TypeScript — unit test these without a rendered canvas or Tauri
  runtime.
- Rust-side persistence gets Rust integration tests against a temp
  project file.
- No pixel-diff/visual regression testing; canvas rendering is
  verified manually during development.

## Workflow

- Follow the repo's standard skill-driven workflow: brainstorm design
  changes before implementing, write plans for multi-step work, use
  TDD for new functionality.
- Scope creep back toward full Figma parity (multiplayer, plugins,
  prototyping, dev-mode) is explicitly out — push back and re-scope
  through a new brainstorming pass rather than adding it ad hoc.

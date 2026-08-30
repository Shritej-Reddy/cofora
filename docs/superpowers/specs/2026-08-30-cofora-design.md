# Cofora — Product Design Spec

Status: approved (Phase 1 architecture), phases 2-5 outlined at lower fidelity
Date: 2026-08-30

## 1. Purpose

Cofora is a personal-use desktop clone of Figma's core design-tool
functionality: a vector/shape editor with layers, styling, and export.
It intentionally excludes real-time collaboration, prototyping,
plugins, comments, and dev-mode inspection — those are out of scope
for all phases below, not deferred.

## 2. Platform & Stack

- **Shell:** Tauri (Rust backend + native webview). Chosen over
  Electron for smaller binaries and lower idle memory; file I/O and
  SQLite access happen in the Rust side, invoked from the frontend via
  Tauri commands.
- **Frontend:** Svelte + TypeScript.
- **Rendering:** HTML5 Canvas 2D with a custom retained scene graph
  (not DOM/SVG, not WebGL). The scene graph is plain TypeScript,
  framework-agnostic, and is the single source of truth for object
  geometry/style; Svelte components read/write it through a store and
  never render shapes as DOM elements. A separate hit-testing pass
  (bounding-box + precise path test) drives selection and pointer
  interaction — it does not rely on the browser's DOM event targets.
- **Persistence:** Embedded SQLite database, one file per project,
  saved to a user-chosen folder (like Figma Desktop's local drafts).
  The user picks the location via a native save dialog on project
  creation; Cofora does not impose a central app-data store.
- **UI style:** Figma-inspired layout conventions (left layers panel,
  right property inspector, top toolbar, dark theme) but with Cofora's
  own visual identity — not a pixel clone of Figma's chrome.

## 3. Data Model (all phases)

Core entities, stored in SQLite per project:

- **Project** — top-level container; holds one or more Pages.
- **Page** — a canvas namespace (like Figma pages); holds a tree of
  Nodes.
- **Node** — the base unit for every object on canvas (Frame, Shape,
  Text, Group, Component, Instance are all Node subtypes distinguished
  by a `kind` field). Every Node has:
  - `id`, `kind`, `name`, `parentId`, `childOrder`
  - **Geometry relative to parent**: `x`, `y`, `width`, `height`,
    `rotation` are stored relative to the parent Node's local space
    (parent Frame/Group/Page), not world-space. World-space is derived
    by walking the ancestor chain. This is required so Phase 3's Auto
    Layout can reposition children by only touching parent-relative
    values, and so groups/frames can be moved as a unit without
    rewriting every descendant.
  - `visible`, `locked`
  - `fills[]`, `strokes[]` (solid color or gradient stops, opacity,
    blend mode)
  - `effects[]` (shadow, blur — Phase 1 stores the field, Phase 1 UI
    ships fill/stroke first; effects UI is in-scope for Phase 1 per
    section 4)
  - type-specific fields (e.g. Text: font/size/weight/lineHeight/
    alignment; Shape: corner radius / polygon point count; Frame:
    clip-content flag)
- **Style** (Phase 4) — named, reusable fill/stroke/text style,
  referenced by Nodes instead of inlining values.
- **Component / Instance** (Phase 4) — a Component is a Node subtree
  marked as a reusable definition; an Instance references a Component
  and stores only its property overrides.
- **VersionSnapshot** (Phase 5) — a serialized snapshot of a
  Project/Page's Node tree at a point in time, with a label and
  timestamp, for persistent version history.

## 4. Phase 1 — Core Editor (full detail)

**Goal:** a usable single-user design tool: draw shapes and text on a
canvas, organize them in layers, style them, undo mistakes, save/load
a project from a local file, export artwork.

**Tools:**
- Rectangle, Ellipse, Line, Polygon (parametric shapes with adjustable
  properties, e.g. corner radius, point count)
- Frame/Artboard (fixed-size container, clips children, acts as a
  page/canvas root for layout)
- Text (editable text box: font, size, weight, line height, alignment)

**Object editing:**
- Layers panel: tree view of the Page's Node hierarchy, drag-to-reorder,
  rename, show/hide, lock/unlock, multi-level nesting via Frames/Groups
- Multi-select (click+shift, drag-marquee)
- Align/distribute: left/center/right/top/middle/bottom align;
  horizontal/vertical even distribution across a multi-selection
- Group/ungroup

**Styling:**
- Fill & stroke: solid color, linear gradient, radial gradient;
  per-fill opacity; stroke width/position (inside/center/outside)
- Effects: drop shadow, inner shadow, layer blur, background blur
- Property inspector: right-side panel reflecting the current
  selection's geometry + style fields, editable inline

**History & persistence:**
- Undo/redo: linear stack, in-memory, scoped to the current editing
  session (cleared on app close — Phase 5 adds durable history)
- Save/load: SQLite file in a user-chosen folder; autosave on a timer
  and on window blur; explicit "Save As" to relocate/duplicate

**Export:**
- Selected Node(s) exportable to PNG, JPG, or SVG at 1x/2x/3x scale

**Out of scope for Phase 1** (later phases): pen tool, boolean
operations, Auto Layout, reusable styles, components/instances, PDF
export, copy-as-CSS, persistent version history.

## 5. Phase 2 — Vector Path Engine

**Goal:** true vector editing.

- Pen tool: click to place anchor points, drag for bezier handles,
  close path to finish; edit existing paths (move/add/delete anchors,
  adjust handles) via a dedicated node-edit mode
- Boolean operations (union, subtract, intersect, exclude) on two or
  more selected vector paths/shapes, producing a new compound path
  Node
- Internally: shapes drawn with the Phase 1 parametric tools (rect,
  ellipse, etc.) become convertible to vector paths ("flatten to
  path") so they can participate in boolean ops

## 6. Phase 3 — Auto Layout

**Goal:** flex-like auto-arranging/resizing Frames.

- A Frame can be switched into Auto Layout mode: direction
  (horizontal/vertical), gap, padding, alignment (start/center/end/
  space-between), and per-child grow/hug/fixed sizing
- Children's parent-relative geometry (section 3) is recomputed by the
  layout engine whenever the Frame or its children change, rather than
  being manually positioned
- Depends on: Phase 1's Node tree and parent-relative geometry model

## 7. Phase 4 — Styles & Components

**Goal:** reusable design-system building blocks.

- Reusable styles: named color styles and text styles; Nodes reference
  a style by id instead of inlining fill/stroke/text values; editing
  the style updates every Node that references it
- Components: mark a Node subtree as a Component definition; create
  Instances that reference it; Instances allow per-instance property
  overrides (text content, fill swaps) without detaching from the
  Component; a detach action converts an Instance into a plain,
  independent Node subtree

## 8. Phase 5 — Version History & Output Polish

**Goal:** durable history and richer export.

- Persistent version history: named/auto-saved VersionSnapshots stored
  in the project's SQLite file; a history panel to browse and restore
  a prior snapshot (restoring replaces the current Page tree, itself
  captured as a new snapshot first so it's reversible)
- PDF export for selections
- Copy-as-CSS: generate a CSS snippet (dimensions, fill, border,
  border-radius, box-shadow) for a single selected Node

## 9. Non-Goals (all phases)

Real-time multiplayer/collaboration, prototyping/interactive preview
mode, plugin system, comments, dev-mode code inspection, cloud sync.
If any of these are wanted later, they require their own
brainstorming/spec cycle — they are not implicitly deferred phases of
this spec.

## 10. Testing Approach

- Scene graph, hit-testing, geometry math (parent-relative ↔
  world-space conversion), and boolean-op/path math are pure
  TypeScript modules — unit-testable without a rendered canvas or
  Tauri runtime.
- Svelte components covered by component tests for interaction logic
  (tool selection, property inspector edits) where feasible.
- Rust-side file I/O / SQLite persistence covered by Rust integration
  tests against a temp project file.
- No automated visual/pixel-diff testing in Phase 1; manual
  verification of canvas rendering during development.

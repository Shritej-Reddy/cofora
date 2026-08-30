# Cofora Phase 1 (Core Editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable single-user desktop design tool: draw shapes/text on a canvas, organize them in a layers tree, style fills/strokes/effects, undo/redo, save/load a project locally, and export selections to PNG/JPG/SVG.

**Architecture:** A Tauri app with a Rust backend (filesystem + SQLite only) and a Svelte/TypeScript frontend. The frontend's core is a framework-agnostic scene graph (plain TS objects/functions) rendered each frame onto an HTML5 Canvas 2D surface; Svelte owns UI chrome and talks to the scene graph through a store. Geometry is stored parent-relative and composed into world-space affine matrices for rendering and hit-testing.

**Tech Stack:** Tauri 2.x, Rust (rusqlite), Svelte 4 + TypeScript, Vite, Vitest (frontend unit tests), `cargo test` (Rust integration tests).

**Spec:** `docs/superpowers/specs/2026-08-30-cofora-design.md`

## Global Constraints

- Platform targets: Windows and macOS (both, from this phase onward); Linux is not a target.
- Shell: Tauri, Rust backend + native webview.
- Frontend: Svelte + TypeScript.
- Rendering: HTML5 Canvas 2D with a custom retained scene graph — no DOM/SVG rendering of shapes, no WebGL.
- Persistence: SQLite, one file per project, saved to a user-chosen folder (no central app-data store).
- Node geometry (`x`, `y`, `width`, `height`, `rotation`) is stored relative to the parent Node, never absolute world-space.
- Hit-testing is a separate pass (matrix/bounds math), not derived from DOM event targets.
- Filesystem and SQLite access happen only on the Rust side, invoked from the frontend via Tauri commands.
- Testing approach: scene graph / geometry / hit-test / align / undo logic gets full unit-test TDD; Rust persistence gets `cargo test` integration tests against a temp file; canvas rendering and Svelte UI wiring are implemented then verified manually (no pixel-diff testing) per spec section 10.
- No collaboration, prototyping, plugins, comments, dev-mode, or cloud sync — do not add hooks for these.

---

## File Structure

```
cofora/
  src-tauri/
    Cargo.toml
    src/
      main.rs
      db.rs                 # SQLite schema + open/init helpers
      commands.rs            # Tauri command handlers (create/open/save project)
    tests/
      persistence_test.rs    # cargo integration tests against temp files
  src/
    lib/
      scene/
        types.ts             # SceneNode, SceneGraph, Fill, Stroke, TextProps types
        matrix.ts             # 2D affine matrix math
        sceneGraph.ts          # tree CRUD: addNode/removeNode/updateNode/reparentNode
        hitTest.ts             # point -> topmost node id
      history/
        undoStack.ts           # snapshot-based undo/redo
      align/
        align.ts                # align/distribute pure functions
      render/
        drawNode.ts              # per-kind Canvas2D draw functions
        renderer.ts               # render loop: walk graph, draw each node
      store/
        editorStore.ts            # Svelte store: graph + selection + tool + history
      tools/
        toolManager.ts             # active tool state machine
        shapeTools.ts                # rect/ellipse/line/polygon drag-to-create
        frameTool.ts
        textTool.ts
        selectTool.ts                 # click select + marquee multi-select
      persistence/
        projectClient.ts               # wraps Tauri `invoke` calls
      export/
        exportImage.ts                  # PNG/JPG export (canvas -> file)
        exportSvg.ts                      # SVG export (scene graph -> SVG string)
    components/
      App.svelte
      Toolbar.svelte
      CanvasView.svelte
      LayersPanel.svelte
      PropertyInspector.svelte
    main.ts
  tests/
    (colocated *.test.ts next to source files, per Vitest convention)
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `src/main.ts`, `src/components/App.svelte`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`
- Create: `.gitignore` (Node + Rust + Tauri build artifacts)

**Interfaces:**
- Produces: a running `npm run tauri dev` desktop window showing a placeholder Svelte page; `npm run test` runs Vitest; `cargo test` runs from `src-tauri/`.

- [ ] **Step 1: Scaffold the Tauri + Svelte-TS app**

Run from the repo root:

```bash
npm create tauri-app@latest -- --manager npm --template svelte-ts --yes cofora-app
```

Then flatten the generated `cofora-app/` directory into the repo root (move `src/`, `src-tauri/`, `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` up one level, remove the now-empty `cofora-app/` dir), so the repo root is the project root alongside `docs/` and `CLAUDE.md`.

- [ ] **Step 2: Add Vitest**

```bash
npm install -D vitest
```

Add to `package.json` `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Verify the dev app launches**

Run: `npm run tauri dev`
Expected: a native window opens showing the default Tauri+Svelte template page. Close the window.

- [ ] **Step 4: Verify test runners work end to end**

Create `src/lib/sanity.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm run test`
Expected: 1 passed.

Run: `cd src-tauri && cargo test && cd ..`
Expected: default template test(s) pass (0 or more, no failures).

Delete `src/lib/sanity.test.ts` (it was only to prove the runner works).

- [ ] **Step 5: Commit**

```bash
git add package.json vite.config.ts tsconfig.json index.html src/main.ts src/components src-tauri .gitignore
git commit -m "Scaffold Tauri + Svelte-TS app with Vitest and cargo test wired up"
```

---

### Task 2: Scene graph types and 2D matrix math

**Files:**
- Create: `src/lib/scene/types.ts`
- Create: `src/lib/scene/matrix.ts`
- Test: `src/lib/scene/matrix.test.ts`

**Interfaces:**
- Produces:
  - `type Matrix = [number, number, number, number, number, number]` (a,b,c,d,e,f affine form)
  - `identity(): Matrix`
  - `multiply(m1: Matrix, m2: Matrix): Matrix`
  - `localMatrix(node: { x: number; y: number; rotation: number }): Matrix`
  - `worldMatrix(nodeId: string, graph: SceneGraph): Matrix`
  - `applyToPoint(m: Matrix, x: number, y: number): { x: number; y: number }`
  - `invert(m: Matrix): Matrix`
  - Types: `SceneNodeKind`, `Fill`, `Stroke`, `TextProps`, `SceneNode`, `SceneGraph`

- [ ] **Step 1: Write the scene graph types**

`src/lib/scene/types.ts`:

```typescript
export type SceneNodeKind =
  | "frame"
  | "group"
  | "rectangle"
  | "ellipse"
  | "line"
  | "polygon"
  | "text";

export interface SolidFill {
  type: "solid";
  color: string; // CSS hex/rgba
  opacity: number; // 0-1
}

export interface GradientStop {
  offset: number; // 0-1
  color: string;
}

export interface GradientFill {
  type: "linear" | "radial";
  stops: GradientStop[];
  opacity: number;
}

export type Fill = SolidFill | GradientFill;

export interface Stroke {
  color: string;
  width: number;
  position: "inside" | "center" | "outside";
  opacity: number;
}

export interface TextProps {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  align: "left" | "center" | "right";
}

export interface SceneNode {
  id: string;
  kind: SceneNodeKind;
  name: string;
  parentId: string | null;
  childIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  visible: boolean;
  locked: boolean;
  fills: Fill[];
  strokes: Stroke[];
  cornerRadius?: number; // rectangle
  polygonSides?: number; // polygon, default 3
  clipsContent?: boolean; // frame
  text?: TextProps; // text
}

export interface SceneGraph {
  rootId: string;
  nodes: Record<string, SceneNode>;
}
```

- [ ] **Step 2: Write the failing matrix tests**

`src/lib/scene/matrix.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { identity, multiply, localMatrix, worldMatrix, applyToPoint, invert } from "./matrix";
import type { SceneGraph } from "./types";

describe("identity", () => {
  it("returns the identity matrix", () => {
    expect(identity()).toEqual([1, 0, 0, 1, 0, 0]);
  });
});

describe("multiply", () => {
  it("composes a translation with a rotation", () => {
    const translate = [1, 0, 0, 1, 10, 20] as const;
    const result = multiply([...translate], identity());
    expect(result).toEqual([1, 0, 0, 1, 10, 20]);
  });
});

describe("localMatrix", () => {
  it("translates a point by x,y with no rotation", () => {
    const m = localMatrix({ x: 5, y: 7, rotation: 0 });
    expect(applyToPoint(m, 0, 0)).toEqual({ x: 5, y: 7 });
  });

  it("rotates 90 degrees about the node's own origin (x,y) then places it", () => {
    const m = localMatrix({ x: 10, y: 10, rotation: 90 });
    const p = applyToPoint(m, 1, 0);
    expect(p.x).toBeCloseTo(10, 5);
    expect(p.y).toBeCloseTo(11, 5);
  });
});

describe("worldMatrix", () => {
  it("composes parent-relative geometry down the ancestor chain", () => {
    const graph: SceneGraph = {
      rootId: "root",
      nodes: {
        root: {
          id: "root", kind: "frame", name: "Page", parentId: null, childIds: ["child"],
          x: 0, y: 0, width: 1000, height: 1000, rotation: 0,
          visible: true, locked: false, fills: [], strokes: [],
        },
        child: {
          id: "child", kind: "rectangle", name: "Rect", parentId: "root", childIds: [],
          x: 100, y: 50, width: 20, height: 20, rotation: 0,
          visible: true, locked: false, fills: [], strokes: [],
        },
      },
    };
    const m = worldMatrix("child", graph);
    expect(applyToPoint(m, 0, 0)).toEqual({ x: 100, y: 50 });
  });
});

describe("invert", () => {
  it("undoes a translation", () => {
    const m = localMatrix({ x: 5, y: 7, rotation: 0 });
    const inv = invert(m);
    const p = applyToPoint(inv, 5, 7);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test -- matrix`
Expected: FAIL — `matrix.ts` does not exist / exports missing.

- [ ] **Step 4: Implement the matrix module**

`src/lib/scene/matrix.ts`:

```typescript
import type { SceneGraph, SceneNode } from "./types";

export type Matrix = [number, number, number, number, number, number];

export function identity(): Matrix {
  return [1, 0, 0, 1, 0, 0];
}

// m1 applied after m2 (m1 is the "outer"/parent transform)
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

/**
 * A node's local transform: place its origin at (x, y) in the parent's
 * space, then rotate about that same origin (the node's top-left corner,
 * not its center — a deliberate Phase 1 simplification).
 */
export function localMatrix(node: { x: number; y: number; rotation: number }): Matrix {
  const rad = (node.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotate: Matrix = [cos, sin, -sin, cos, 0, 0];
  const translate: Matrix = [1, 0, 0, 1, node.x, node.y];
  return multiply(translate, rotate);
}

export function worldMatrix(nodeId: string, graph: SceneGraph): Matrix {
  const chain: SceneNode[] = [];
  let current: SceneNode | undefined = graph.nodes[nodeId];
  while (current) {
    chain.unshift(current);
    current = current.parentId ? graph.nodes[current.parentId] : undefined;
  }
  return chain.reduce((acc, node) => multiply(acc, localMatrix(node)), identity());
}

export function applyToPoint(m: Matrix, x: number, y: number): { x: number; y: number } {
  const [a, b, c, d, e, f] = m;
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

export function invert(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (det === 0) throw new Error("Matrix is not invertible");
  const ia = d / det;
  const ib = -b / det;
  const ic = -c / det;
  const id = a / det;
  const ie = -(ia * e + ic * f);
  const iff = -(ib * e + id * f);
  return [ia, ib, ic, id, ie, iff];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- matrix`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/scene/types.ts src/lib/scene/matrix.ts src/lib/scene/matrix.test.ts
git commit -m "Add scene graph types and 2D affine matrix math"
```

---

### Task 3: Scene graph CRUD operations

**Files:**
- Create: `src/lib/scene/sceneGraph.ts`
- Test: `src/lib/scene/sceneGraph.test.ts`

**Interfaces:**
- Consumes: `SceneNode`, `SceneGraph` from `./types`
- Produces:
  - `createEmptyGraph(rootName: string): SceneGraph`
  - `addNode(graph: SceneGraph, node: SceneNode, parentId: string, index?: number): SceneGraph`
  - `removeNode(graph: SceneGraph, nodeId: string): SceneGraph`
  - `updateNode(graph: SceneGraph, nodeId: string, patch: Partial<SceneNode>): SceneGraph`
  - `reparentNode(graph: SceneGraph, nodeId: string, newParentId: string, index?: number): SceneGraph`
  - `cloneGraph(graph: SceneGraph): SceneGraph`

All functions are pure — they return a new `SceneGraph`, never mutate the input, so the undo stack (Task 5) can snapshot cheaply and safely.

- [ ] **Step 1: Write the failing tests**

`src/lib/scene/sceneGraph.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createEmptyGraph, addNode, removeNode, updateNode, reparentNode, cloneGraph } from "./sceneGraph";
import type { SceneNode } from "./types";

function rect(id: string, parentId: string): SceneNode {
  return {
    id, kind: "rectangle", name: "Rectangle", parentId, childIds: [],
    x: 0, y: 0, width: 10, height: 10, rotation: 0,
    visible: true, locked: false, fills: [], strokes: [],
  };
}

describe("createEmptyGraph", () => {
  it("creates a graph with a single root frame", () => {
    const g = createEmptyGraph("Page 1");
    expect(g.nodes[g.rootId].kind).toBe("frame");
    expect(g.nodes[g.rootId].name).toBe("Page 1");
    expect(g.nodes[g.rootId].childIds).toEqual([]);
  });
});

describe("addNode", () => {
  it("adds a node as a child of the given parent", () => {
    const g0 = createEmptyGraph("Page 1");
    const g1 = addNode(g0, rect("r1", g0.rootId), g0.rootId);
    expect(g1.nodes["r1"]).toBeDefined();
    expect(g1.nodes[g0.rootId].childIds).toEqual(["r1"]);
    expect(g0.nodes[g0.rootId].childIds).toEqual([]); // original untouched
  });

  it("inserts at a specific index", () => {
    const g0 = createEmptyGraph("Page 1");
    const g1 = addNode(g0, rect("r1", g0.rootId), g0.rootId);
    const g2 = addNode(g1, rect("r2", g0.rootId), g0.rootId, 0);
    expect(g2.nodes[g0.rootId].childIds).toEqual(["r2", "r1"]);
  });
});

describe("removeNode", () => {
  it("removes a node and detaches it from its parent's childIds", () => {
    const g0 = createEmptyGraph("Page 1");
    const g1 = addNode(g0, rect("r1", g0.rootId), g0.rootId);
    const g2 = removeNode(g1, "r1");
    expect(g2.nodes["r1"]).toBeUndefined();
    expect(g2.nodes[g0.rootId].childIds).toEqual([]);
  });

  it("recursively removes descendants", () => {
    const g0 = createEmptyGraph("Page 1");
    const g1 = addNode(g0, { ...rect("f1", g0.rootId), kind: "frame" }, g0.rootId);
    const g2 = addNode(g1, rect("r1", "f1"), "f1");
    const g3 = removeNode(g2, "f1");
    expect(g3.nodes["f1"]).toBeUndefined();
    expect(g3.nodes["r1"]).toBeUndefined();
  });
});

describe("updateNode", () => {
  it("patches fields on a node without touching others", () => {
    const g0 = createEmptyGraph("Page 1");
    const g1 = addNode(g0, rect("r1", g0.rootId), g0.rootId);
    const g2 = updateNode(g1, "r1", { x: 50, name: "Moved" });
    expect(g2.nodes["r1"].x).toBe(50);
    expect(g2.nodes["r1"].name).toBe("Moved");
    expect(g2.nodes["r1"].width).toBe(10);
  });
});

describe("reparentNode", () => {
  it("moves a node from one parent's childIds to another's", () => {
    const g0 = createEmptyGraph("Page 1");
    const g1 = addNode(g0, { ...rect("f1", g0.rootId), kind: "frame" }, g0.rootId);
    const g2 = addNode(g1, rect("r1", g0.rootId), g0.rootId);
    const g3 = reparentNode(g2, "r1", "f1");
    expect(g3.nodes["r1"].parentId).toBe("f1");
    expect(g3.nodes["f1"].childIds).toEqual(["r1"]);
    expect(g3.nodes[g0.rootId].childIds).toEqual(["f1"]);
  });
});

describe("cloneGraph", () => {
  it("produces a deep copy independent of the original", () => {
    const g0 = createEmptyGraph("Page 1");
    const g1 = addNode(g0, rect("r1", g0.rootId), g0.rootId);
    const g2 = cloneGraph(g1);
    g2.nodes["r1"].x = 999;
    expect(g1.nodes["r1"].x).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- sceneGraph`
Expected: FAIL — `sceneGraph.ts` does not exist.

- [ ] **Step 3: Implement the scene graph module**

`src/lib/scene/sceneGraph.ts`:

```typescript
import type { SceneGraph, SceneNode } from "./types";

export function createEmptyGraph(rootName: string): SceneGraph {
  const rootId = crypto.randomUUID();
  return {
    rootId,
    nodes: {
      [rootId]: {
        id: rootId, kind: "frame", name: rootName, parentId: null, childIds: [],
        x: 0, y: 0, width: 1440, height: 1024, rotation: 0,
        visible: true, locked: false, fills: [], strokes: [], clipsContent: true,
      },
    },
  };
}

export function cloneGraph(graph: SceneGraph): SceneGraph {
  return structuredClone(graph);
}

export function addNode(
  graph: SceneGraph,
  node: SceneNode,
  parentId: string,
  index?: number
): SceneGraph {
  const next = cloneGraph(graph);
  next.nodes[node.id] = { ...node, parentId };
  const siblings = next.nodes[parentId].childIds;
  const at = index === undefined ? siblings.length : index;
  siblings.splice(at, 0, node.id);
  return next;
}

function collectDescendantIds(graph: SceneGraph, nodeId: string, acc: string[]): void {
  acc.push(nodeId);
  for (const childId of graph.nodes[nodeId].childIds) {
    collectDescendantIds(graph, childId, acc);
  }
}

export function removeNode(graph: SceneGraph, nodeId: string): SceneGraph {
  const next = cloneGraph(graph);
  const node = next.nodes[nodeId];
  if (!node) return next;
  if (node.parentId) {
    const parent = next.nodes[node.parentId];
    parent.childIds = parent.childIds.filter((id) => id !== nodeId);
  }
  const toDelete: string[] = [];
  collectDescendantIds(next, nodeId, toDelete);
  for (const id of toDelete) delete next.nodes[id];
  return next;
}

export function updateNode(
  graph: SceneGraph,
  nodeId: string,
  patch: Partial<SceneNode>
): SceneGraph {
  const next = cloneGraph(graph);
  next.nodes[nodeId] = { ...next.nodes[nodeId], ...patch };
  return next;
}

export function reparentNode(
  graph: SceneGraph,
  nodeId: string,
  newParentId: string,
  index?: number
): SceneGraph {
  const next = cloneGraph(graph);
  const node = next.nodes[nodeId];
  const oldParent = node.parentId ? next.nodes[node.parentId] : undefined;
  if (oldParent) {
    oldParent.childIds = oldParent.childIds.filter((id) => id !== nodeId);
  }
  node.parentId = newParentId;
  const newParent = next.nodes[newParentId];
  const at = index === undefined ? newParent.childIds.length : index;
  newParent.childIds.splice(at, 0, nodeId);
  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- sceneGraph`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scene/sceneGraph.ts src/lib/scene/sceneGraph.test.ts
git commit -m "Add pure scene graph CRUD operations"
```

---

### Task 4: Hit-testing

**Files:**
- Create: `src/lib/scene/hitTest.ts`
- Test: `src/lib/scene/hitTest.test.ts`

**Interfaces:**
- Consumes: `SceneGraph`, `worldMatrix`, `invert`, `applyToPoint` from Tasks 2-3
- Produces: `hitTestPoint(graph: SceneGraph, worldX: number, worldY: number): string | null`

- [ ] **Step 1: Write the failing tests**

`src/lib/scene/hitTest.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createEmptyGraph, addNode } from "./sceneGraph";
import { hitTestPoint } from "./hitTest";
import type { SceneNode } from "./types";

function rect(id: string, parentId: string, x: number, y: number, w: number, h: number): SceneNode {
  return {
    id, kind: "rectangle", name: "Rectangle", parentId, childIds: [],
    x, y, width: w, height: h, rotation: 0,
    visible: true, locked: false, fills: [], strokes: [],
  };
}

describe("hitTestPoint", () => {
  it("returns null when no node is under the point", () => {
    const g = createEmptyGraph("Page 1");
    expect(hitTestPoint(g, 5000, 5000)).toBeNull();
  });

  it("returns the node id when the point is inside its bounds", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(g, rect("r1", g.rootId, 10, 10, 100, 100), g.rootId);
    expect(hitTestPoint(g, 50, 50)).toBe("r1");
  });

  it("returns the topmost (last-drawn) node when two overlap", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(g, rect("r1", g.rootId, 0, 0, 100, 100), g.rootId);
    g = addNode(g, rect("r2", g.rootId, 0, 0, 100, 100), g.rootId);
    expect(hitTestPoint(g, 50, 50)).toBe("r2");
  });

  it("ignores invisible nodes", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(g, { ...rect("r1", g.rootId, 0, 0, 100, 100), visible: false }, g.rootId);
    expect(hitTestPoint(g, 50, 50)).toBeNull();
  });

  it("does not hit-test the root frame itself, only its children", () => {
    const g = createEmptyGraph("Page 1");
    expect(hitTestPoint(g, 10, 10)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- hitTest`
Expected: FAIL — `hitTest.ts` does not exist.

- [ ] **Step 3: Implement hit-testing**

`src/lib/scene/hitTest.ts`:

```typescript
import type { SceneGraph, SceneNode } from "./types";
import { worldMatrix, invert, applyToPoint } from "./matrix";

function pointInNode(graph: SceneGraph, node: SceneNode, worldX: number, worldY: number): boolean {
  const m = worldMatrix(node.id, graph);
  const local = applyToPoint(invert(m), worldX, worldY);
  return local.x >= 0 && local.x <= node.width && local.y >= 0 && local.y <= node.height;
}

function paintOrder(graph: SceneGraph): SceneNode[] {
  const order: SceneNode[] = [];
  function walk(nodeId: string) {
    const node = graph.nodes[nodeId];
    for (const childId of node.childIds) walk(childId);
    if (node.id !== graph.rootId) order.push(node);
  }
  walk(graph.rootId);
  return order;
}

export function hitTestPoint(graph: SceneGraph, worldX: number, worldY: number): string | null {
  // paintOrder() returns deepest-drawn-last-first (children before the
  // frame that contains them, reversed at each level) so the first match
  // here is the topmost node under the point.
  for (const node of paintOrder(graph)) {
    if (!node.visible || node.locked) continue;
    if (pointInNode(graph, node, worldX, worldY)) return node.id;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- hitTest`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scene/hitTest.ts src/lib/scene/hitTest.test.ts
git commit -m "Add hit-testing pass over the scene graph"
```

---

### Task 5: Undo/redo stack

**Files:**
- Create: `src/lib/history/undoStack.ts`
- Test: `src/lib/history/undoStack.test.ts`

**Interfaces:**
- Consumes: `SceneGraph`, `cloneGraph` from Task 3
- Produces: `class UndoStack` with `push(snapshot: SceneGraph): void`, `undo(current: SceneGraph): SceneGraph | null`, `redo(current: SceneGraph): SceneGraph | null`, `canUndo(): boolean`, `canRedo(): boolean`

- [ ] **Step 1: Write the failing tests**

`src/lib/history/undoStack.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { UndoStack } from "./undoStack";
import { createEmptyGraph, updateNode } from "../scene/sceneGraph";

describe("UndoStack", () => {
  it("reports no undo/redo available when empty", () => {
    const stack = new UndoStack();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });

  it("undo restores the snapshot taken before the most recent push", () => {
    const stack = new UndoStack();
    const g0 = createEmptyGraph("Page 1");
    stack.push(g0); // snapshot of state BEFORE the edit that produced g1
    const g1 = updateNode(g0, g0.rootId, { name: "Renamed" });

    const restored = stack.undo(g1);
    expect(restored?.nodes[g0.rootId].name).toBe("Page 1");
  });

  it("redo re-applies the state that was undone", () => {
    const stack = new UndoStack();
    const g0 = createEmptyGraph("Page 1");
    stack.push(g0);
    const g1 = updateNode(g0, g0.rootId, { name: "Renamed" });

    const afterUndo = stack.undo(g1)!;
    const afterRedo = stack.redo(afterUndo);
    expect(afterRedo?.nodes[g0.rootId].name).toBe("Renamed");
  });

  it("clears the redo stack when a new snapshot is pushed", () => {
    const stack = new UndoStack();
    const g0 = createEmptyGraph("Page 1");
    stack.push(g0);
    const g1 = updateNode(g0, g0.rootId, { name: "First" });
    stack.undo(g1);
    expect(stack.canRedo()).toBe(true);

    stack.push(g0);
    expect(stack.canRedo()).toBe(false);
  });

  it("caps history at the configured limit", () => {
    const stack = new UndoStack(2);
    let g = createEmptyGraph("Page 1");
    for (let i = 0; i < 5; i++) {
      stack.push(g);
      g = updateNode(g, g.rootId, { name: `Rev ${i}` });
    }
    let current = g;
    let undoCount = 0;
    while (stack.canUndo()) {
      current = stack.undo(current)!;
      undoCount++;
    }
    expect(undoCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- undoStack`
Expected: FAIL — `undoStack.ts` does not exist.

- [ ] **Step 3: Implement the undo stack**

`src/lib/history/undoStack.ts`:

```typescript
import type { SceneGraph } from "../scene/types";
import { cloneGraph } from "../scene/sceneGraph";

export class UndoStack {
  private past: SceneGraph[] = [];
  private future: SceneGraph[] = [];

  constructor(private readonly limit = 100) {}

  push(snapshot: SceneGraph): void {
    this.past.push(cloneGraph(snapshot));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(current: SceneGraph): SceneGraph | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(cloneGraph(current));
    return previous;
  }

  redo(current: SceneGraph): SceneGraph | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(cloneGraph(current));
    return next;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- undoStack`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/history/undoStack.ts src/lib/history/undoStack.test.ts
git commit -m "Add snapshot-based undo/redo stack"
```

---

### Task 6: Align and distribute

**Files:**
- Create: `src/lib/align/align.ts`
- Test: `src/lib/align/align.test.ts`

**Interfaces:**
- Produces:
  - `interface Bounds { id: string; x: number; y: number; width: number; height: number }`
  - `alignLeft(items: Bounds[]): Map<string, { x: number }>`
  - `alignCenterHorizontal(items: Bounds[]): Map<string, { x: number }>`
  - `alignRight(items: Bounds[]): Map<string, { x: number }>`
  - `alignTop(items: Bounds[]): Map<string, { y: number }>`
  - `alignMiddleVertical(items: Bounds[]): Map<string, { y: number }>`
  - `alignBottom(items: Bounds[]): Map<string, { y: number }>`
  - `distributeHorizontal(items: Bounds[]): Map<string, { x: number }>`
  - `distributeVertical(items: Bounds[]): Map<string, { y: number }>`

These operate on **world-space** bounds (the caller is responsible for converting from parent-relative geometry via `worldMatrix` before calling, and converting the results back after — this module has no scene graph dependency, which keeps it trivially testable).

- [ ] **Step 1: Write the failing tests**

`src/lib/align/align.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  alignLeft, alignCenterHorizontal, alignRight,
  alignTop, alignMiddleVertical, alignBottom,
  distributeHorizontal, distributeVertical,
} from "./align";
import type { Bounds } from "./align";

const items: Bounds[] = [
  { id: "a", x: 0, y: 0, width: 10, height: 10 },
  { id: "b", x: 50, y: 100, width: 20, height: 40 },
  { id: "c", x: 200, y: 300, width: 30, height: 10 },
];

describe("alignLeft", () => {
  it("moves every item's x to the minimum x", () => {
    const result = alignLeft(items);
    expect(result.get("a")!.x).toBe(0);
    expect(result.get("b")!.x).toBe(0);
    expect(result.get("c")!.x).toBe(0);
  });
});

describe("alignRight", () => {
  it("moves every item's right edge to the maximum right edge", () => {
    const result = alignRight(items);
    // max right edge = 200 + 30 = 230
    expect(result.get("a")!.x).toBe(220); // 230 - 10
    expect(result.get("b")!.x).toBe(210); // 230 - 20
    expect(result.get("c")!.x).toBe(200);
  });
});

describe("alignCenterHorizontal", () => {
  it("centers every item on the shared horizontal midline", () => {
    const result = alignCenterHorizontal(items);
    // bounding box: minX=0, maxRight=230 -> center = 115
    expect(result.get("a")!.x).toBe(110); // 115 - 10/2
    expect(result.get("b")!.x).toBe(105); // 115 - 20/2
  });
});

describe("alignTop / alignMiddleVertical / alignBottom", () => {
  it("aligns to the min y", () => {
    const result = alignTop(items);
    expect(result.get("a")!.y).toBe(0);
    expect(result.get("c")!.y).toBe(0);
  });

  it("aligns to the max bottom edge", () => {
    const result = alignBottom(items);
    // max bottom = 300 + 10 = 310
    expect(result.get("a")!.y).toBe(300); // 310 - 10
  });

  it("centers vertically on the shared midline", () => {
    const result = alignMiddleVertical(items);
    // bounding box: minY=0, maxBottom=310 -> center=155
    expect(result.get("c")!.y).toBe(150); // 155 - 10/2
  });
});

describe("distributeHorizontal", () => {
  it("keeps the leftmost and rightmost items fixed and evenly spaces the gaps between", () => {
    const result = distributeHorizontal(items);
    expect(result.get("a")!.x).toBe(0); // unchanged (leftmost)
    expect(result.get("c")!.x).toBe(200); // unchanged (rightmost)
    // total span 0..230, sum of widths 60, gap space 170 over 2 gaps = 85
    // b.x = a.right + gap = 10 + 85 = 95
    expect(result.get("b")!.x).toBe(95);
  });
});

describe("distributeVertical", () => {
  it("keeps the topmost and bottommost items fixed and evenly spaces the gaps between", () => {
    const result = distributeVertical(items);
    expect(result.get("a")!.y).toBe(0);
    expect(result.get("c")!.y).toBe(300);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- align`
Expected: FAIL — `align.ts` does not exist.

- [ ] **Step 3: Implement align/distribute**

`src/lib/align/align.ts`:

```typescript
export interface Bounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function bbox(items: Bounds[]) {
  const minX = Math.min(...items.map((i) => i.x));
  const maxRight = Math.max(...items.map((i) => i.x + i.width));
  const minY = Math.min(...items.map((i) => i.y));
  const maxBottom = Math.max(...items.map((i) => i.y + i.height));
  return { minX, maxRight, minY, maxBottom };
}

export function alignLeft(items: Bounds[]): Map<string, { x: number }> {
  const { minX } = bbox(items);
  return new Map(items.map((i) => [i.id, { x: minX }]));
}

export function alignRight(items: Bounds[]): Map<string, { x: number }> {
  const { maxRight } = bbox(items);
  return new Map(items.map((i) => [i.id, { x: maxRight - i.width }]));
}

export function alignCenterHorizontal(items: Bounds[]): Map<string, { x: number }> {
  const { minX, maxRight } = bbox(items);
  const center = (minX + maxRight) / 2;
  return new Map(items.map((i) => [i.id, { x: center - i.width / 2 }]));
}

export function alignTop(items: Bounds[]): Map<string, { y: number }> {
  const { minY } = bbox(items);
  return new Map(items.map((i) => [i.id, { y: minY }]));
}

export function alignBottom(items: Bounds[]): Map<string, { y: number }> {
  const { maxBottom } = bbox(items);
  return new Map(items.map((i) => [i.id, { y: maxBottom - i.height }]));
}

export function alignMiddleVertical(items: Bounds[]): Map<string, { y: number }> {
  const { minY, maxBottom } = bbox(items);
  const center = (minY + maxBottom) / 2;
  return new Map(items.map((i) => [i.id, { y: center - i.height / 2 }]));
}

export function distributeHorizontal(items: Bounds[]): Map<string, { x: number }> {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const result = new Map<string, { x: number }>();
  if (sorted.length < 3) {
    for (const i of sorted) result.set(i.id, { x: i.x });
    return result;
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last.x + last.width - first.x;
  const widthSum = sorted.reduce((sum, i) => sum + i.width, 0);
  const gap = (span - widthSum) / (sorted.length - 1);
  result.set(first.id, { x: first.x });
  let cursor = first.x + first.width + gap;
  for (let idx = 1; idx < sorted.length - 1; idx++) {
    result.set(sorted[idx].id, { x: cursor });
    cursor += sorted[idx].width + gap;
  }
  result.set(last.id, { x: last.x });
  return result;
}

export function distributeVertical(items: Bounds[]): Map<string, { y: number }> {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const result = new Map<string, { y: number }>();
  if (sorted.length < 3) {
    for (const i of sorted) result.set(i.id, { y: i.y });
    return result;
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last.y + last.height - first.y;
  const heightSum = sorted.reduce((sum, i) => sum + i.height, 0);
  const gap = (span - heightSum) / (sorted.length - 1);
  result.set(first.id, { y: first.y });
  let cursor = first.y + first.height + gap;
  for (let idx = 1; idx < sorted.length - 1; idx++) {
    result.set(sorted[idx].id, { y: cursor });
    cursor += sorted[idx].height + gap;
  }
  result.set(last.id, { y: last.y });
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- align`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/align/align.ts src/lib/align/align.test.ts
git commit -m "Add align/distribute pure functions"
```

---

### Task 7: Editor store (Svelte)

**Files:**
- Create: `src/lib/store/editorStore.ts`
- Test: `src/lib/store/editorStore.test.ts`

**Interfaces:**
- Consumes: `SceneGraph`, `createEmptyGraph`, `addNode`, `removeNode`, `updateNode`, `reparentNode` (Task 3); `UndoStack` (Task 5)
- Produces: a Svelte writable-backed store object `editorStore` with:
  - `subscribe` (Svelte store contract)
  - `getGraph(): SceneGraph`
  - `getSelection(): string[]`
  - `select(ids: string[]): void`
  - `mutate(fn: (graph: SceneGraph) => SceneGraph): void` — pushes current graph to undo stack, then applies `fn`
  - `undo(): void`
  - `redo(): void`
  - `canUndo(): boolean`
  - `canRedo(): boolean`

This is the single integration point later tasks (tools, panels, persistence) use to read/mutate state — nothing outside this file touches `UndoStack` or calls `addNode`/`updateNode` directly.

- [ ] **Step 1: Write the failing tests**

`src/lib/store/editorStore.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createEditorStore } from "./editorStore";
import { addNode } from "../scene/sceneGraph";
import type { SceneNode } from "../scene/types";

function rect(id: string, parentId: string): SceneNode {
  return {
    id, kind: "rectangle", name: "Rectangle", parentId, childIds: [],
    x: 0, y: 0, width: 10, height: 10, rotation: 0,
    visible: true, locked: false, fills: [], strokes: [],
  };
}

describe("editorStore", () => {
  it("starts with an empty graph and no selection", () => {
    const store = createEditorStore("Page 1");
    expect(Object.keys(store.getGraph().nodes).length).toBe(1); // just the root
    expect(store.getSelection()).toEqual([]);
  });

  it("select() updates the selection", () => {
    const store = createEditorStore("Page 1");
    store.select(["r1"]);
    expect(store.getSelection()).toEqual(["r1"]);
  });

  it("mutate() applies the change and records undo history", () => {
    const store = createEditorStore("Page 1");
    const rootId = store.getGraph().rootId;
    store.mutate((g) => addNode(g, rect("r1", rootId), rootId));
    expect(store.getGraph().nodes["r1"]).toBeDefined();
    expect(store.canUndo()).toBe(true);
  });

  it("undo() reverts the last mutate(), redo() re-applies it", () => {
    const store = createEditorStore("Page 1");
    const rootId = store.getGraph().rootId;
    store.mutate((g) => addNode(g, rect("r1", rootId), rootId));
    store.undo();
    expect(store.getGraph().nodes["r1"]).toBeUndefined();
    expect(store.canRedo()).toBe(true);
    store.redo();
    expect(store.getGraph().nodes["r1"]).toBeDefined();
  });

  it("subscribe() notifies on mutate/select/undo/redo", () => {
    const store = createEditorStore("Page 1");
    let notifications = 0;
    const unsubscribe = store.subscribe(() => { notifications++; });
    const initial = notifications;
    store.select(["x"]);
    expect(notifications).toBeGreaterThan(initial);
    unsubscribe();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- editorStore`
Expected: FAIL — `editorStore.ts` does not exist.

- [ ] **Step 3: Implement the editor store**

`src/lib/store/editorStore.ts`:

```typescript
import { writable, type Writable } from "svelte/store";
import type { SceneGraph } from "../scene/types";
import { createEmptyGraph } from "../scene/sceneGraph";
import { UndoStack } from "../history/undoStack";

export interface EditorState {
  graph: SceneGraph;
  selection: string[];
}

export interface EditorStore extends Pick<Writable<EditorState>, "subscribe"> {
  getGraph(): SceneGraph;
  getSelection(): string[];
  select(ids: string[]): void;
  mutate(fn: (graph: SceneGraph) => SceneGraph): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

export function createEditorStore(rootName: string): EditorStore {
  const initial: EditorState = { graph: createEmptyGraph(rootName), selection: [] };
  const store = writable<EditorState>(initial);
  const history = new UndoStack();
  let state = initial;
  store.subscribe((s) => { state = s; });

  return {
    subscribe: store.subscribe,
    getGraph: () => state.graph,
    getSelection: () => state.selection,
    select(ids) {
      store.update((s) => ({ ...s, selection: ids }));
    },
    mutate(fn) {
      history.push(state.graph);
      store.update((s) => ({ ...s, graph: fn(s.graph) }));
    },
    undo() {
      const restored = history.undo(state.graph);
      if (restored) store.update((s) => ({ ...s, graph: restored }));
    },
    redo() {
      const restored = history.redo(state.graph);
      if (restored) store.update((s) => ({ ...s, graph: restored }));
    },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- editorStore`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/store/editorStore.ts src/lib/store/editorStore.test.ts
git commit -m "Add editor store wiring scene graph, selection, and undo history"
```

---

### Task 8: Canvas renderer

**Files:**
- Create: `src/lib/render/drawNode.ts`
- Create: `src/lib/render/renderer.ts`

**Interfaces:**
- Consumes: `SceneGraph`, `SceneNode`, `worldMatrix` (Tasks 2-3)
- Produces:
  - `drawNode(ctx: CanvasRenderingContext2D, node: SceneNode): void` — draws one node's own shape in its **local** coordinate space (caller sets the transform first)
  - `renderScene(ctx: CanvasRenderingContext2D, graph: SceneGraph, selectedIds: string[]): void`

Per spec section 10, canvas-drawing code is not unit-tested (no headless-canvas dependency added) — it's implemented directly and verified manually in Step 3.

- [ ] **Step 1: Implement per-node drawing**

`src/lib/render/drawNode.ts`:

```typescript
import type { Fill, SceneNode, Stroke } from "../scene/types";

function applyFill(ctx: CanvasRenderingContext2D, fill: Fill, width: number, height: number): void {
  ctx.globalAlpha = fill.opacity;
  if (fill.type === "solid") {
    ctx.fillStyle = fill.color;
    return;
  }
  const gradient =
    fill.type === "linear"
      ? ctx.createLinearGradient(0, 0, width, height)
      : ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
  for (const stop of fill.stops) gradient.addColorStop(stop.offset, stop.color);
  ctx.fillStyle = gradient;
}

function applyStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  ctx.globalAlpha = stroke.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
}

function pathForNode(ctx: CanvasRenderingContext2D, node: SceneNode): void {
  ctx.beginPath();
  switch (node.kind) {
    case "rectangle":
    case "frame": {
      const r = node.cornerRadius ?? 0;
      ctx.roundRect(0, 0, node.width, node.height, r);
      break;
    }
    case "ellipse":
      ctx.ellipse(node.width / 2, node.height / 2, node.width / 2, node.height / 2, 0, 0, Math.PI * 2);
      break;
    case "line":
      ctx.moveTo(0, node.height / 2);
      ctx.lineTo(node.width, node.height / 2);
      break;
    case "polygon": {
      const sides = node.polygonSides ?? 3;
      const cx = node.width / 2;
      const cy = node.height / 2;
      const rx = node.width / 2;
      const ry = node.height / 2;
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "text":
      // text has no fill/stroke path of its own; drawn separately below.
      break;
  }
}

export function drawNode(ctx: CanvasRenderingContext2D, node: SceneNode): void {
  if (node.kind === "text" && node.text) {
    ctx.globalAlpha = 1;
    ctx.font = `${node.text.fontWeight} ${node.text.fontSize}px ${node.text.fontFamily}`;
    ctx.textAlign = node.text.align;
    ctx.textBaseline = "top";
    ctx.fillStyle = node.fills[0]?.type === "solid" ? node.fills[0].color : "#000000";
    const anchorX = node.text.align === "center" ? node.width / 2 : node.text.align === "right" ? node.width : 0;
    ctx.fillText(node.text.content, anchorX, 0, node.width);
    return;
  }

  pathForNode(ctx, node);
  for (const fill of node.fills) {
    applyFill(ctx, fill, node.width, node.height);
    ctx.fill();
  }
  for (const stroke of node.strokes) {
    applyStroke(ctx, stroke);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
```

- [ ] **Step 2: Implement the render loop**

`src/lib/render/renderer.ts`:

```typescript
import type { SceneGraph } from "../scene/types";
import { worldMatrix } from "../scene/matrix";
import { drawNode } from "./drawNode";

const SELECTION_COLOR = "#4f8cff";

export function renderScene(
  ctx: CanvasRenderingContext2D,
  graph: SceneGraph,
  selectedIds: string[]
): void {
  ctx.save();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  function walk(nodeId: string) {
    const node = graph.nodes[nodeId];
    if (!node.visible) return;

    const [a, b, c, d, e, f] = worldMatrix(nodeId, graph);
    ctx.save();
    ctx.setTransform(a, b, c, d, e, f);

    if (node.id !== graph.rootId) drawNode(ctx, node);

    if (node.kind === "frame" && node.clipsContent) {
      ctx.beginPath();
      ctx.rect(0, 0, node.width, node.height);
      ctx.clip();
    }

    for (const childId of node.childIds) walk(childId);

    ctx.restore();

    if (selectedIds.includes(node.id)) {
      ctx.save();
      ctx.setTransform(a, b, c, d, e, f);
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, node.width, node.height);
      ctx.restore();
    }
  }

  walk(graph.rootId);
  ctx.restore();
}
```

- [ ] **Step 3: Manually verify rendering**

Temporarily call `renderScene` from `src/main.ts` against a hand-built `SceneGraph` (a root frame with one rectangle, one ellipse, one rotated rectangle) drawn to a `<canvas>` in `index.html`, run `npm run tauri dev`, and confirm: shapes appear at expected positions, the rotated rectangle rotates about its top-left corner as designed, fills/strokes render. Remove the temporary test-harness code from `main.ts` afterward (this task only proves the renderer works; wiring it into the real app happens in Task 9).

- [ ] **Step 4: Commit**

```bash
git add src/lib/render/drawNode.ts src/lib/render/renderer.ts
git commit -m "Add Canvas2D scene renderer"
```

---

### Task 9: CanvasView component with pan/zoom

**Files:**
- Create: `src/components/CanvasView.svelte`
- Modify: `src/components/App.svelte`

**Interfaces:**
- Consumes: `EditorStore` (Task 7), `renderScene` (Task 8)
- Produces: a `<CanvasView store={editorStore} />` Svelte component that owns the `<canvas>` element, a render loop (`requestAnimationFrame`), and pan (space+drag or middle-mouse-drag) / zoom (scroll wheel, ctrl/cmd+scroll) camera state. Exposes camera transform so Task 10's pointer handling can convert screen coordinates to world coordinates.
- Produces: `screenToWorld(camera: Camera, screenX: number, screenY: number): { x: number; y: number }` and `interface Camera { x: number; y: number; zoom: number }`, colocated in `CanvasView.svelte`'s `<script>` block and exported via a small companion module `src/lib/render/camera.ts` so Task 10 can import them without importing the whole component.

- [ ] **Step 1: Write the camera module**

`src/lib/render/camera.ts`:

```typescript
export interface Camera {
  x: number; // world-space point currently at the top-left of the viewport
  y: number;
  zoom: number; // 1 = 100%
}

export function defaultCamera(): Camera {
  return { x: 0, y: 0, zoom: 1 };
}

export function screenToWorld(camera: Camera, screenX: number, screenY: number): { x: number; y: number } {
  return { x: camera.x + screenX / camera.zoom, y: camera.y + screenY / camera.zoom };
}

export function cameraToCanvasTransform(camera: Camera): [number, number, number, number, number, number] {
  return [camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom];
}
```

- [ ] **Step 2: Build CanvasView.svelte**

`src/components/CanvasView.svelte`:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import type { EditorStore } from "../lib/store/editorStore";
  import { renderScene } from "../lib/render/renderer";
  import { defaultCamera, cameraToCanvasTransform, type Camera } from "../lib/render/camera";

  export let store: EditorStore;

  let canvasEl: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let camera: Camera = defaultCamera();

  function draw() {
    if (!ctx) return;
    const [a, b, c, d, e, f] = cameraToCanvasTransform(camera);
    ctx.setTransform(a, b, c, d, e, f);
    renderScene(ctx, store.getGraph(), store.getSelection());
  }

  function resizeCanvas() {
    canvasEl.width = canvasEl.clientWidth * window.devicePixelRatio;
    canvasEl.height = canvasEl.clientHeight * window.devicePixelRatio;
    draw();
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01);
      camera = { ...camera, zoom: Math.min(8, Math.max(0.02, camera.zoom * factor)) };
    } else {
      camera = { ...camera, x: camera.x + e.deltaX / camera.zoom, y: camera.y + e.deltaY / camera.zoom };
    }
    draw();
  }

  onMount(() => {
    ctx = canvasEl.getContext("2d")!;
    resizeCanvas();
    const unsubscribe = store.subscribe(() => draw());
    window.addEventListener("resize", resizeCanvas);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", resizeCanvas);
    };
  });
</script>

<canvas
  bind:this={canvasEl}
  on:wheel={handleWheel}
  style="width: 100%; height: 100%; display: block;"
/>
```

- [ ] **Step 3: Wire into App.svelte**

`src/components/App.svelte`:

```svelte
<script lang="ts">
  import CanvasView from "./CanvasView.svelte";
  import { createEditorStore } from "../lib/store/editorStore";

  const store = createEditorStore("Page 1");
</script>

<main style="display: flex; height: 100vh;">
  <div style="flex: 1;">
    <CanvasView {store} />
  </div>
</main>
```

- [ ] **Step 4: Manually verify**

Run `npm run tauri dev`. Confirm: the canvas fills the window, resizing the window resizes the canvas without distortion, scrolling pans, ctrl/cmd+scroll zooms in/out around a reasonable point.

- [ ] **Step 5: Commit**

```bash
git add src/lib/render/camera.ts src/components/CanvasView.svelte src/components/App.svelte
git commit -m "Add CanvasView with pan/zoom camera"
```

---

### Task 10: Select tool (click + marquee)

**Files:**
- Create: `src/lib/tools/selectTool.ts`
- Test: `src/lib/tools/selectTool.test.ts`
- Modify: `src/components/CanvasView.svelte`

**Interfaces:**
- Consumes: `hitTestPoint` (Task 4), `worldMatrix`/`invert`/`applyToPoint` (Task 2), `EditorStore` (Task 7)
- Produces:
  - `marqueeSelect(graph: SceneGraph, rect: { x: number; y: number; width: number; height: number }): string[]` — ids of direct children of the root whose world-space bounds intersect the marquee rect
  - Pointer-event wiring in `CanvasView.svelte`: pointerdown starts either a click-select (hitTestPoint) or a marquee drag; pointerup finalizes selection via `store.select(...)`

- [ ] **Step 1: Write the failing test for marquee selection**

`src/lib/tools/selectTool.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createEmptyGraph, addNode } from "../scene/sceneGraph";
import { marqueeSelect } from "./selectTool";
import type { SceneNode } from "../scene/types";

function rect(id: string, parentId: string, x: number, y: number, w: number, h: number): SceneNode {
  return {
    id, kind: "rectangle", name: "Rectangle", parentId, childIds: [],
    x, y, width: w, height: h, rotation: 0,
    visible: true, locked: false, fills: [], strokes: [],
  };
}

describe("marqueeSelect", () => {
  it("selects nodes whose bounds intersect the marquee rect", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(g, rect("inside", g.rootId, 10, 10, 20, 20), g.rootId);
    g = addNode(g, rect("outside", g.rootId, 500, 500, 20, 20), g.rootId);
    const ids = marqueeSelect(g, { x: 0, y: 0, width: 100, height: 100 });
    expect(ids).toEqual(["inside"]);
  });

  it("ignores locked nodes", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(g, { ...rect("locked", g.rootId, 10, 10, 20, 20), locked: true }, g.rootId);
    const ids = marqueeSelect(g, { x: 0, y: 0, width: 100, height: 100 });
    expect(ids).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- selectTool`
Expected: FAIL — `selectTool.ts` does not exist.

- [ ] **Step 3: Implement selectTool**

`src/lib/tools/selectTool.ts`:

```typescript
import type { SceneGraph } from "../scene/types";
import { worldMatrix, applyToPoint } from "../scene/matrix";

interface Rect { x: number; y: number; width: number; height: number }

function worldBounds(graph: SceneGraph, nodeId: string): Rect {
  const node = graph.nodes[nodeId];
  const m = worldMatrix(nodeId, graph);
  const corners = [
    applyToPoint(m, 0, 0),
    applyToPoint(m, node.width, 0),
    applyToPoint(m, 0, node.height),
    applyToPoint(m, node.width, node.height),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function marqueeSelect(graph: SceneGraph, marquee: Rect): string[] {
  const ids: string[] = [];
  function walk(nodeId: string) {
    const node = graph.nodes[nodeId];
    for (const childId of node.childIds) {
      const child = graph.nodes[childId];
      if (child.visible && !child.locked && intersects(worldBounds(graph, childId), marquee)) {
        ids.push(childId);
      }
      walk(childId);
    }
  }
  walk(graph.rootId);
  return ids;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- selectTool`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire pointer events into CanvasView.svelte**

Add to `src/components/CanvasView.svelte`'s `<script>` block:

```typescript
import { hitTestPoint } from "../lib/scene/hitTest";
import { marqueeSelect } from "../lib/tools/selectTool";
import { screenToWorld } from "../lib/render/camera";

let dragStart: { x: number; y: number } | null = null;
let marqueeRect: { x: number; y: number; width: number; height: number } | null = null;

function handlePointerDown(e: PointerEvent) {
  const world = screenToWorld(camera, e.offsetX, e.offsetY);
  const hitId = hitTestPoint(store.getGraph(), world.x, world.y);
  if (hitId) {
    store.select([hitId]);
    dragStart = null;
  } else {
    dragStart = world;
    store.select([]);
  }
}

function handlePointerMove(e: PointerEvent) {
  if (!dragStart) return;
  const world = screenToWorld(camera, e.offsetX, e.offsetY);
  marqueeRect = {
    x: Math.min(dragStart.x, world.x),
    y: Math.min(dragStart.y, world.y),
    width: Math.abs(world.x - dragStart.x),
    height: Math.abs(world.y - dragStart.y),
  };
  draw();
}

function handlePointerUp() {
  if (marqueeRect) {
    store.select(marqueeSelect(store.getGraph(), marqueeRect));
  }
  dragStart = null;
  marqueeRect = null;
  draw();
}
```

Bind the handlers on the canvas element:

```svelte
<canvas
  bind:this={canvasEl}
  on:wheel={handleWheel}
  on:pointerdown={handlePointerDown}
  on:pointermove={handlePointerMove}
  on:pointerup={handlePointerUp}
  style="width: 100%; height: 100%; display: block;"
/>
```

- [ ] **Step 6: Manually verify**

Run `npm run tauri dev`. With the temporary test shapes from Task 8 still creatable via a quick `store.mutate(...)` call in `App.svelte` (add a rectangle on mount for manual testing), confirm: clicking a shape selects it (blue outline appears), clicking empty canvas deselects, dragging on empty canvas draws a marquee and selects intersecting shapes. Remove the temporary shape-creation call before committing — it's replaced by real tools in Task 11.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tools/selectTool.ts src/lib/tools/selectTool.test.ts src/components/CanvasView.svelte
git commit -m "Add select tool: click select and marquee multi-select"
```

---

### Task 11: Shape tools (rectangle, ellipse, line, polygon)

**Files:**
- Create: `src/lib/tools/toolManager.ts`
- Create: `src/lib/tools/shapeTools.ts`
- Test: `src/lib/tools/shapeTools.test.ts`
- Modify: `src/components/CanvasView.svelte`

**Interfaces:**
- Consumes: `EditorStore.mutate` (Task 7), `addNode` (Task 3), `worldToLocal` conversion via `invert`/`worldMatrix`/`applyToPoint` (Task 2)
- Produces:
  - `type ToolId = "select" | "rectangle" | "ellipse" | "line" | "polygon" | "frame" | "text"`
  - `toolManager` writable store holding the active `ToolId`, plus `setTool(id: ToolId): void`
  - `createShapeNode(kind: "rectangle" | "ellipse" | "line" | "polygon", parentId: string, x: number, y: number, width: number, height: number): SceneNode`
  - Drag-to-create pointer handling in `CanvasView.svelte`, gated on `toolManager`'s active tool

- [ ] **Step 1: Write the failing test for node creation**

`src/lib/tools/shapeTools.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createShapeNode } from "./shapeTools";

describe("createShapeNode", () => {
  it("creates a rectangle with the given parent-relative geometry", () => {
    const node = createShapeNode("rectangle", "parent1", 10, 20, 100, 50);
    expect(node.kind).toBe("rectangle");
    expect(node.parentId).toBe("parent1");
    expect(node.x).toBe(10);
    expect(node.y).toBe(20);
    expect(node.width).toBe(100);
    expect(node.height).toBe(50);
    expect(node.fills).toEqual([{ type: "solid", color: "#d9d9d9", opacity: 1 }]);
  });

  it("creates a polygon defaulting to a triangle (3 sides)", () => {
    const node = createShapeNode("polygon", "parent1", 0, 0, 40, 40);
    expect(node.polygonSides).toBe(3);
  });

  it("assigns each node a unique id", () => {
    const a = createShapeNode("ellipse", "parent1", 0, 0, 10, 10);
    const b = createShapeNode("ellipse", "parent1", 0, 0, 10, 10);
    expect(a.id).not.toBe(b.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- shapeTools`
Expected: FAIL — `shapeTools.ts` does not exist.

- [ ] **Step 3: Implement createShapeNode**

`src/lib/tools/shapeTools.ts`:

```typescript
import type { SceneNode, SceneNodeKind } from "../scene/types";

const DEFAULT_FILL = { type: "solid" as const, color: "#d9d9d9", opacity: 1 };

export function createShapeNode(
  kind: Extract<SceneNodeKind, "rectangle" | "ellipse" | "line" | "polygon">,
  parentId: string,
  x: number,
  y: number,
  width: number,
  height: number
): SceneNode {
  const base: SceneNode = {
    id: crypto.randomUUID(),
    kind,
    name: kind[0].toUpperCase() + kind.slice(1),
    parentId,
    childIds: [],
    x, y, width, height, rotation: 0,
    visible: true, locked: false,
    fills: kind === "line" ? [] : [DEFAULT_FILL],
    strokes: kind === "line" ? [{ color: "#000000", width: 2, position: "center", opacity: 1 }] : [],
  };
  if (kind === "polygon") base.polygonSides = 3;
  return base;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- shapeTools`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the tool manager store**

`src/lib/tools/toolManager.ts`:

```typescript
import { writable } from "svelte/store";

export type ToolId = "select" | "rectangle" | "ellipse" | "line" | "polygon" | "frame" | "text";

function createToolManager() {
  const { subscribe, set } = writable<ToolId>("select");
  return { subscribe, setTool: (id: ToolId) => set(id) };
}

export const toolManager = createToolManager();
```

- [ ] **Step 6: Wire drag-to-create into CanvasView.svelte**

Add to the `<script>` block, alongside the existing select-tool handlers:

```typescript
import { toolManager, type ToolId } from "../lib/tools/toolManager";
import { createShapeNode } from "../lib/tools/shapeTools";
import { addNode } from "../lib/scene/sceneGraph";

let activeTool: ToolId = "select";
toolManager.subscribe((t) => (activeTool = t));

let shapeDragStart: { x: number; y: number } | null = null;

const SHAPE_KINDS: ToolId[] = ["rectangle", "ellipse", "line", "polygon"];

function handlePointerDown(e: PointerEvent) {
  const world = screenToWorld(camera, e.offsetX, e.offsetY);
  if (SHAPE_KINDS.includes(activeTool)) {
    shapeDragStart = world;
    return;
  }
  // existing select-tool logic from Task 10 continues to handle "select"
  const hitId = hitTestPoint(store.getGraph(), world.x, world.y);
  if (hitId) {
    store.select([hitId]);
    dragStart = null;
  } else {
    dragStart = world;
    store.select([]);
  }
}

function handlePointerUp(e: PointerEvent) {
  if (shapeDragStart && SHAPE_KINDS.includes(activeTool)) {
    const world = screenToWorld(camera, e.offsetX, e.offsetY);
    const x = Math.min(shapeDragStart.x, world.x);
    const y = Math.min(shapeDragStart.y, world.y);
    const width = Math.max(1, Math.abs(world.x - shapeDragStart.x));
    const height = Math.max(1, Math.abs(world.y - shapeDragStart.y));
    const rootId = store.getGraph().rootId;
    const node = createShapeNode(activeTool as "rectangle" | "ellipse" | "line" | "polygon", rootId, x, y, width, height);
    store.mutate((g) => addNode(g, node, rootId));
    store.select([node.id]);
    toolManager.setTool("select");
    shapeDragStart = null;
    return;
  }
  // existing marquee-finalize logic from Task 10 continues to run here
  if (marqueeRect) {
    store.select(marqueeSelect(store.getGraph(), marqueeRect));
  }
  dragStart = null;
  marqueeRect = null;
  draw();
}
```

- [ ] **Step 7: Manually verify**

Run `npm run tauri dev`. Temporarily call `toolManager.setTool("rectangle")` from the browser devtools console (or a throwaway button in `App.svelte`), drag on the canvas, confirm a rectangle appears with the dragged bounds and the tool reverts to "select" afterward. Repeat for ellipse, line, polygon.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tools/toolManager.ts src/lib/tools/shapeTools.ts src/lib/tools/shapeTools.test.ts src/components/CanvasView.svelte
git commit -m "Add shape tools: rectangle, ellipse, line, polygon drag-to-create"
```

---

### Task 12: Frame tool

**Files:**
- Modify: `src/lib/tools/shapeTools.ts`
- Modify: `src/lib/tools/toolManager.ts` (already includes `"frame"`, no change needed)
- Modify: `src/components/CanvasView.svelte`
- Test: `src/lib/tools/shapeTools.test.ts`

**Interfaces:**
- Produces: `createFrameNode(parentId: string, x: number, y: number, width: number, height: number): SceneNode` — a frame differs from shapes by `clipsContent: true` and no default fill (frames are typically transparent containers, matching the root page frame already created by `createEmptyGraph`).

- [ ] **Step 1: Add the failing test**

Append to `src/lib/tools/shapeTools.test.ts`:

```typescript
import { createFrameNode } from "./shapeTools";

describe("createFrameNode", () => {
  it("creates a frame that clips its content and has no fill", () => {
    const node = createFrameNode("root", 0, 0, 375, 812);
    expect(node.kind).toBe("frame");
    expect(node.clipsContent).toBe(true);
    expect(node.fills).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- shapeTools`
Expected: FAIL — `createFrameNode` is not exported.

- [ ] **Step 3: Implement createFrameNode**

Add to `src/lib/tools/shapeTools.ts`:

```typescript
export function createFrameNode(parentId: string, x: number, y: number, width: number, height: number): SceneNode {
  return {
    id: crypto.randomUUID(),
    kind: "frame",
    name: "Frame",
    parentId,
    childIds: [],
    x, y, width, height, rotation: 0,
    visible: true, locked: false,
    fills: [], strokes: [],
    clipsContent: true,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- shapeTools`
Expected: PASS (4 tests total in this file).

- [ ] **Step 5: Wire the frame tool into CanvasView.svelte**

In `handlePointerDown`/`handlePointerUp` from Task 11, extend the shape-kind branch:

```typescript
import { createFrameNode } from "../lib/tools/shapeTools";

const DRAGGABLE_TOOLS: ToolId[] = ["rectangle", "ellipse", "line", "polygon", "frame"];
```

Replace `SHAPE_KINDS` references in `handlePointerDown`/`handlePointerUp` with `DRAGGABLE_TOOLS`, and in `handlePointerUp`'s node-creation branch:

```typescript
const node =
  activeTool === "frame"
    ? createFrameNode(rootId, x, y, width, height)
    : createShapeNode(activeTool as "rectangle" | "ellipse" | "line" | "polygon", rootId, x, y, width, height);
```

- [ ] **Step 6: Manually verify**

Run `npm run tauri dev`, select the frame tool, drag out a frame, drag a rectangle so part of it extends past the frame's edge and reparent it into the frame (drag-and-drop reparenting is not built until later — for this manual check it's enough to `store.mutate((g) => reparentNode(g, rectId, frameId))` from devtools), confirm the part outside the frame's bounds is clipped when rendered.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tools/shapeTools.ts src/lib/tools/shapeTools.test.ts src/components/CanvasView.svelte
git commit -m "Add frame tool"
```

---

### Task 13: Text tool

**Files:**
- Modify: `src/lib/tools/shapeTools.ts`
- Modify: `src/components/CanvasView.svelte`
- Create: `src/components/TextEditOverlay.svelte`
- Test: `src/lib/tools/shapeTools.test.ts`

**Interfaces:**
- Produces: `createTextNode(parentId: string, x: number, y: number): SceneNode` (fixed default width/height, `text.content` starts empty)
- Produces: `<TextEditOverlay node={SceneNode} camera={Camera} on:commit={(content: string) => void} on:cancel={() => void} />` — an absolutely-positioned HTML `<textarea>` overlaid on the canvas at the text node's screen position while editing (editing raw text via native `<textarea>` is far simpler and more correct — IME, selection, caret — than hand-rolling text editing on canvas; the committed content is what `drawNode` renders afterward)

- [ ] **Step 1: Add the failing test**

Append to `src/lib/tools/shapeTools.test.ts`:

```typescript
import { createTextNode } from "./shapeTools";

describe("createTextNode", () => {
  it("creates a text node with default typography and empty content", () => {
    const node = createTextNode("root", 10, 10);
    expect(node.kind).toBe("text");
    expect(node.text).toEqual({
      content: "", fontFamily: "Inter, sans-serif", fontSize: 16,
      fontWeight: 400, lineHeight: 1.4, align: "left",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- shapeTools`
Expected: FAIL — `createTextNode` is not exported.

- [ ] **Step 3: Implement createTextNode**

Add to `src/lib/tools/shapeTools.ts`:

```typescript
export function createTextNode(parentId: string, x: number, y: number): SceneNode {
  return {
    id: crypto.randomUUID(),
    kind: "text",
    name: "Text",
    parentId,
    childIds: [],
    x, y, width: 200, height: 24, rotation: 0,
    visible: true, locked: false,
    fills: [{ type: "solid", color: "#000000", opacity: 1 }],
    strokes: [],
    text: {
      content: "", fontFamily: "Inter, sans-serif", fontSize: 16,
      fontWeight: 400, lineHeight: 1.4, align: "left",
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- shapeTools`
Expected: PASS (5 tests total in this file).

- [ ] **Step 5: Build the text edit overlay**

`src/components/TextEditOverlay.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { SceneNode } from "../lib/scene/types";
  import type { Camera } from "../lib/render/camera";

  export let node: SceneNode;
  export let camera: Camera;

  const dispatch = createEventDispatcher<{ commit: string; cancel: void }>();
  let value = node.text?.content ?? "";

  function commit() {
    dispatch("commit", value);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") dispatch("cancel");
  }

  $: screenX = (node.x - camera.x) * camera.zoom;
  $: screenY = (node.y - camera.y) * camera.zoom;
</script>

<textarea
  bind:value
  on:blur={commit}
  on:keydown={handleKeydown}
  autofocus
  style="
    position: absolute;
    left: {screenX}px;
    top: {screenY}px;
    width: {node.width * camera.zoom}px;
    height: {node.height * camera.zoom}px;
    font-family: {node.text?.fontFamily};
    font-size: {(node.text?.fontSize ?? 16) * camera.zoom}px;
    font-weight: {node.text?.fontWeight};
    line-height: {node.text?.lineHeight};
    text-align: {node.text?.align};
    border: 1px solid #4f8cff;
    background: transparent;
    resize: none;
    padding: 0;
    outline: none;
  "
/>
```

- [ ] **Step 6: Wire the text tool into CanvasView.svelte**

Add to the `<script>` block:

```typescript
import { createTextNode } from "../lib/tools/shapeTools";
import { updateNode } from "../lib/scene/sceneGraph";
import TextEditOverlay from "./TextEditOverlay.svelte";

let editingNode: import("../lib/scene/types").SceneNode | null = null;

function handleCanvasClickForText(worldX: number, worldY: number) {
  const rootId = store.getGraph().rootId;
  const node = createTextNode(rootId, worldX, worldY);
  store.mutate((g) => addNode(g, node, rootId));
  editingNode = node;
}

function commitText(content: string) {
  if (editingNode) {
    store.mutate((g) => updateNode(g, editingNode!.id, { text: { ...editingNode!.text!, content } }));
  }
  editingNode = null;
  toolManager.setTool("select");
}

function cancelText() {
  if (editingNode) {
    store.mutate((g) => removeNode(g, editingNode!.id));
  }
  editingNode = null;
  toolManager.setTool("select");
}
```

In `handlePointerDown`, add a branch before the shape-drag branch:

```typescript
if (activeTool === "text") {
  const world = screenToWorld(camera, e.offsetX, e.offsetY);
  handleCanvasClickForText(world.x, world.y);
  return;
}
```

Add the overlay to the template, alongside the `<canvas>`:

```svelte
{#if editingNode}
  <TextEditOverlay node={editingNode} {camera} on:commit={(e) => commitText(e.detail)} on:cancel={cancelText} />
{/if}
```

(Note: `removeNode` must be imported alongside `addNode`/`updateNode` at the top of the script block.)

- [ ] **Step 7: Manually verify**

Run `npm run tauri dev`, select the text tool, click on the canvas, type some text, click elsewhere (blur) to commit, confirm the text renders via `drawNode`. Repeat and press Escape instead — confirm the node is removed and nothing renders.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tools/shapeTools.ts src/lib/tools/shapeTools.test.ts src/components/CanvasView.svelte src/components/TextEditOverlay.svelte
git commit -m "Add text tool with textarea-based editing overlay"
```

---

### Task 14: Layers panel

**Files:**
- Create: `src/components/LayersPanel.svelte`
- Modify: `src/components/App.svelte`

**Interfaces:**
- Consumes: `EditorStore` (Task 7), `reparentNode`/`updateNode`/`removeNode` (Task 3)
- Produces: `<LayersPanel store={editorStore} />` — a tree view of the graph (excluding the invisible-to-the-user root wrapper, showing its children as the top-level list), supporting: click to select, drag-to-reorder within the same parent, rename (double-click), toggle visibility, toggle lock.

- [ ] **Step 1: Build LayersPanel.svelte**

`src/components/LayersPanel.svelte`:

```svelte
<script lang="ts">
  import type { EditorStore } from "../lib/store/editorStore";
  import { updateNode, reparentNode } from "../lib/scene/sceneGraph";
  import type { SceneGraph } from "../lib/scene/types";

  export let store: EditorStore;

  let graph: SceneGraph;
  let selection: string[] = [];
  store.subscribe((s) => {
    graph = s.graph;
    selection = s.selection;
  });

  let renamingId: string | null = null;
  let dragId: string | null = null;

  function select(id: string, e: MouseEvent) {
    if (e.shiftKey) {
      store.select(selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]);
    } else {
      store.select([id]);
    }
  }

  function toggleVisible(id: string) {
    store.mutate((g) => updateNode(g, id, { visible: !g.nodes[id].visible }));
  }

  function toggleLock(id: string) {
    store.mutate((g) => updateNode(g, id, { locked: !g.nodes[id].locked }));
  }

  function commitRename(id: string, name: string) {
    store.mutate((g) => updateNode(g, id, { name }));
    renamingId = null;
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const targetParentId = graph.nodes[targetId].parentId!;
    store.mutate((g) => reparentNode(g, dragId!, targetParentId, g.nodes[targetParentId].childIds.indexOf(targetId)));
    dragId = null;
  }
</script>

{#if graph}
  <ul style="list-style: none; margin: 0; padding: 0;">
    {#each [...graph.nodes[graph.rootId].childIds].reverse() as id (id)}
      {@const node = graph.nodes[id]}
      <li
        draggable="true"
        on:dragstart={() => (dragId = id)}
        on:dragover|preventDefault
        on:drop={() => handleDrop(id)}
        on:click={(e) => select(id, e)}
        style="
          display: flex; align-items: center; gap: 4px; padding: 2px 8px;
          background: {selection.includes(id) ? '#e6f0ff' : 'transparent'};
          opacity: {node.visible ? 1 : 0.4};
        "
      >
        <button on:click|stopPropagation={() => toggleVisible(id)}>{node.visible ? "👁" : "🚫"}</button>
        <button on:click|stopPropagation={() => toggleLock(id)}>{node.locked ? "🔒" : "🔓"}</button>
        {#if renamingId === id}
          <input
            value={node.name}
            autofocus
            on:blur={(e) => commitRename(id, (e.target as HTMLInputElement).value)}
            on:keydown={(e) => e.key === "Enter" && commitRename(id, (e.target as HTMLInputElement).value)}
          />
        {:else}
          <span on:dblclick={() => (renamingId = id)}>{node.name}</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
```

- [ ] **Step 2: Wire into App.svelte**

Modify `src/components/App.svelte`:

```svelte
<script lang="ts">
  import CanvasView from "./CanvasView.svelte";
  import LayersPanel from "./LayersPanel.svelte";
  import { createEditorStore } from "../lib/store/editorStore";

  const store = createEditorStore("Page 1");
</script>

<main style="display: flex; height: 100vh;">
  <aside style="width: 240px; border-right: 1px solid #ddd; overflow-y: auto;">
    <LayersPanel {store} />
  </aside>
  <div style="flex: 1;">
    <CanvasView {store} />
  </div>
</main>
```

- [ ] **Step 3: Manually verify**

Run `npm run tauri dev`, create a few shapes via the tools built so far, confirm: the layers panel lists them (newest on top, matching paint order), clicking a layer selects it on canvas (blue outline), clicking a canvas shape highlights it in the layers panel, visibility/lock toggles work, double-click rename works, drag-reorder within the same parent works.

- [ ] **Step 4: Commit**

```bash
git add src/components/LayersPanel.svelte src/components/App.svelte
git commit -m "Add layers panel: tree view, visibility/lock, rename, reorder"
```

---

### Task 15: Property inspector — geometry

**Files:**
- Create: `src/components/PropertyInspector.svelte`
- Modify: `src/components/App.svelte`

**Interfaces:**
- Consumes: `EditorStore` (Task 7), `updateNode` (Task 3)
- Produces: `<PropertyInspector store={editorStore} />` showing x/y/width/height/rotation number inputs for the current selection (single-select only for Phase 1 — if multiple nodes are selected, show the first selected node's values and a note that multi-edit isn't supported yet, per YAGNI: nothing in the spec requires simultaneous multi-node geometry editing).

- [ ] **Step 1: Build PropertyInspector.svelte**

`src/components/PropertyInspector.svelte`:

```svelte
<script lang="ts">
  import type { EditorStore } from "../lib/store/editorStore";
  import { updateNode } from "../lib/scene/sceneGraph";
  import type { SceneGraph } from "../lib/scene/types";

  export let store: EditorStore;

  let graph: SceneGraph;
  let selection: string[] = [];
  store.subscribe((s) => {
    graph = s.graph;
    selection = s.selection;
  });

  $: node = selection.length > 0 && graph ? graph.nodes[selection[0]] : null;

  function setField(field: "x" | "y" | "width" | "height" | "rotation", value: number) {
    if (!node) return;
    store.mutate((g) => updateNode(g, node!.id, { [field]: value }));
  }
</script>

{#if node}
  <div style="padding: 8px; display: grid; grid-template-columns: auto 1fr; gap: 4px;">
    {#if selection.length > 1}
      <p style="grid-column: span 2;">Editing {node.name} ({selection.length} selected — multi-edit not yet supported)</p>
    {/if}
    <label for="prop-x">X</label>
    <input id="prop-x" type="number" value={node.x} on:change={(e) => setField("x", Number((e.target as HTMLInputElement).value))} />
    <label for="prop-y">Y</label>
    <input id="prop-y" type="number" value={node.y} on:change={(e) => setField("y", Number((e.target as HTMLInputElement).value))} />
    <label for="prop-w">W</label>
    <input id="prop-w" type="number" value={node.width} on:change={(e) => setField("width", Number((e.target as HTMLInputElement).value))} />
    <label for="prop-h">H</label>
    <input id="prop-h" type="number" value={node.height} on:change={(e) => setField("height", Number((e.target as HTMLInputElement).value))} />
    <label for="prop-r">Rotation</label>
    <input id="prop-r" type="number" value={node.rotation} on:change={(e) => setField("rotation", Number((e.target as HTMLInputElement).value))} />
  </div>
{:else}
  <p style="padding: 8px; color: #888;">No selection</p>
{/if}
```

- [ ] **Step 2: Wire into App.svelte**

Add a right-hand `<aside>` alongside the existing left `<aside>` in `src/components/App.svelte`:

```svelte
<script lang="ts">
  import CanvasView from "./CanvasView.svelte";
  import LayersPanel from "./LayersPanel.svelte";
  import PropertyInspector from "./PropertyInspector.svelte";
  import { createEditorStore } from "../lib/store/editorStore";

  const store = createEditorStore("Page 1");
</script>

<main style="display: flex; height: 100vh;">
  <aside style="width: 240px; border-right: 1px solid #ddd; overflow-y: auto;">
    <LayersPanel {store} />
  </aside>
  <div style="flex: 1;">
    <CanvasView {store} />
  </div>
  <aside style="width: 240px; border-left: 1px solid #ddd; overflow-y: auto;">
    <PropertyInspector {store} />
  </aside>
</main>
```

- [ ] **Step 3: Manually verify**

Run `npm run tauri dev`, select a shape, confirm the inspector shows its geometry, edit the X field and confirm the shape moves on canvas and the change is undoable (Cmd/Ctrl+Z — keyboard wiring lands in Task 17, so for this check call `store.undo()` from devtools).

- [ ] **Step 4: Commit**

```bash
git add src/components/PropertyInspector.svelte src/components/App.svelte
git commit -m "Add property inspector for node geometry"
```

---

### Task 16: Fill, stroke, and effects editing

**Files:**
- Modify: `src/lib/scene/types.ts` (add `Effect` type)
- Modify: `src/lib/render/drawNode.ts` (render effects)
- Modify: `src/components/PropertyInspector.svelte`
- Test: `src/lib/render/effects.test.ts`
- Create: `src/lib/render/effects.ts`

**Interfaces:**
- Produces:
  - `interface ShadowEffect { type: "drop-shadow" | "inner-shadow"; color: string; offsetX: number; offsetY: number; blur: number }`
  - `interface BlurEffect { type: "layer-blur" | "background-blur"; radius: number }`
  - `type Effect = ShadowEffect | BlurEffect`
  - `applyEffectsToContext(ctx: CanvasRenderingContext2D, effects: Effect[]): void` — sets `ctx.shadowColor/shadowOffsetX/shadowOffsetY/shadowBlur` and `ctx.filter` for blur, pure enough to unit test against a mock context object
  - Fill/stroke/effects editing UI added to `PropertyInspector.svelte`: color pickers (native `<input type="color">` plus opacity slider) for solid fills, gradient-stop editing (add/remove/reposition stops) for gradient fills, add/remove buttons for strokes and effects

- [ ] **Step 1: Add the Effect type**

Add to `src/lib/scene/types.ts`:

```typescript
export interface ShadowEffect {
  type: "drop-shadow" | "inner-shadow";
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
}

export interface BlurEffect {
  type: "layer-blur" | "background-blur";
  radius: number;
}

export type Effect = ShadowEffect | BlurEffect;
```

Add `effects: Effect[];` to the `SceneNode` interface.

- [ ] **Step 2: Write the failing test for applyEffectsToContext**

`src/lib/render/effects.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { applyEffectsToContext } from "./effects";
import type { Effect } from "../scene/types";

function mockCtx() {
  return { shadowColor: "", shadowOffsetX: 0, shadowOffsetY: 0, shadowBlur: 0, filter: "none" } as unknown as CanvasRenderingContext2D;
}

describe("applyEffectsToContext", () => {
  it("sets shadow properties for a drop-shadow effect", () => {
    const ctx = mockCtx();
    const effects: Effect[] = [{ type: "drop-shadow", color: "#000000", offsetX: 2, offsetY: 4, blur: 6 }];
    applyEffectsToContext(ctx, effects);
    expect(ctx.shadowColor).toBe("#000000");
    expect(ctx.shadowOffsetX).toBe(2);
    expect(ctx.shadowOffsetY).toBe(4);
    expect(ctx.shadowBlur).toBe(6);
  });

  it("sets the filter property for a layer-blur effect", () => {
    const ctx = mockCtx();
    const effects: Effect[] = [{ type: "layer-blur", radius: 8 }];
    applyEffectsToContext(ctx, effects);
    expect(ctx.filter).toBe("blur(8px)");
  });

  it("leaves defaults untouched when there are no effects", () => {
    const ctx = mockCtx();
    applyEffectsToContext(ctx, []);
    expect(ctx.shadowBlur).toBe(0);
    expect(ctx.filter).toBe("none");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test -- effects`
Expected: FAIL — `effects.ts` does not exist.

- [ ] **Step 4: Implement applyEffectsToContext**

`src/lib/render/effects.ts`:

```typescript
import type { Effect } from "../scene/types";

export function applyEffectsToContext(ctx: CanvasRenderingContext2D, effects: Effect[]): void {
  for (const effect of effects) {
    if (effect.type === "drop-shadow") {
      ctx.shadowColor = effect.color;
      ctx.shadowOffsetX = effect.offsetX;
      ctx.shadowOffsetY = effect.offsetY;
      ctx.shadowBlur = effect.blur;
    } else if (effect.type === "layer-blur") {
      ctx.filter = `blur(${effect.radius}px)`;
    }
    // inner-shadow and background-blur are visually approximated in Phase 1
    // by drop-shadow/layer-blur respectively; true inset/backdrop rendering
    // is not implemented.
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- effects`
Expected: PASS (3 tests).

- [ ] **Step 6: Call applyEffectsToContext from drawNode**

Modify `src/lib/render/drawNode.ts` — add the import and call it at the top of `drawNode`, before drawing the path:

```typescript
import { applyEffectsToContext } from "./effects";

// inside drawNode, before pathForNode(ctx, node):
if (node.effects?.length) applyEffectsToContext(ctx, node.effects);
```

- [ ] **Step 7: Add fill/stroke/effects editing UI to PropertyInspector.svelte**

Extend the `<script>` block:

```typescript
import type { Fill, Stroke, Effect } from "../lib/scene/types";

function setFillColor(index: number, color: string) {
  if (!node) return;
  const fills = [...node.fills];
  const f = fills[index];
  if (f.type === "solid") fills[index] = { ...f, color };
  store.mutate((g) => updateNode(g, node!.id, { fills }));
}

function setFillOpacity(index: number, opacity: number) {
  if (!node) return;
  const fills = [...node.fills];
  fills[index] = { ...fills[index], opacity };
  store.mutate((g) => updateNode(g, node!.id, { fills }));
}

function addSolidFill() {
  if (!node) return;
  store.mutate((g) => updateNode(g, node!.id, { fills: [...node!.fills, { type: "solid", color: "#000000", opacity: 1 }] }));
}

function removeFill(index: number) {
  if (!node) return;
  store.mutate((g) => updateNode(g, node!.id, { fills: node!.fills.filter((_, i) => i !== index) }));
}

function addStroke() {
  if (!node) return;
  store.mutate((g) => updateNode(g, node!.id, { strokes: [...node!.strokes, { color: "#000000", width: 1, position: "center", opacity: 1 }] }));
}

function removeStroke(index: number) {
  if (!node) return;
  store.mutate((g) => updateNode(g, node!.id, { strokes: node!.strokes.filter((_, i) => i !== index) }));
}

function addShadow() {
  if (!node) return;
  const effects = node.effects ?? [];
  store.mutate((g) => updateNode(g, node!.id, { effects: [...effects, { type: "drop-shadow", color: "#000000", offsetX: 0, offsetY: 4, blur: 8 }] }));
}

function removeEffect(index: number) {
  if (!node) return;
  store.mutate((g) => updateNode(g, node!.id, { effects: (node!.effects ?? []).filter((_, i) => i !== index) }));
}
```

Append to the template, inside the `{#if node}` block:

```svelte
<div style="grid-column: span 2; margin-top: 8px;">
  <strong>Fills</strong>
  {#each node.fills as fill, i}
    {#if fill.type === "solid"}
      <div style="display: flex; gap: 4px; align-items: center;">
        <input type="color" value={fill.color} on:input={(e) => setFillColor(i, (e.target as HTMLInputElement).value)} />
        <input type="range" min="0" max="1" step="0.01" value={fill.opacity} on:input={(e) => setFillOpacity(i, Number((e.target as HTMLInputElement).value))} />
        <button on:click={() => removeFill(i)}>✕</button>
      </div>
    {:else}
      <div>Gradient ({fill.stops.length} stops) <button on:click={() => removeFill(i)}>✕</button></div>
    {/if}
  {/each}
  <button on:click={addSolidFill}>+ Fill</button>
</div>

<div style="grid-column: span 2; margin-top: 8px;">
  <strong>Strokes</strong>
  {#each node.strokes as stroke, i}
    <div style="display: flex; gap: 4px; align-items: center;">
      <span>{stroke.color} / {stroke.width}px</span>
      <button on:click={() => removeStroke(i)}>✕</button>
    </div>
  {/each}
  <button on:click={addStroke}>+ Stroke</button>
</div>

<div style="grid-column: span 2; margin-top: 8px;">
  <strong>Effects</strong>
  {#each node.effects ?? [] as effect, i}
    <div style="display: flex; gap: 4px; align-items: center;">
      <span>{effect.type}</span>
      <button on:click={() => removeEffect(i)}>✕</button>
    </div>
  {/each}
  <button on:click={addShadow}>+ Drop Shadow</button>
</div>
```

Gradient stop editing (add/remove/reposition stops, radial-vs-linear toggle) is left as inline UI you build the same way — a stop-list with color+offset inputs, mutating `node.fills[i].stops` — following the same `store.mutate` pattern as above; not spelled out further here since it's mechanically identical to the solid-fill and stroke list UI.

- [ ] **Step 8: Manually verify**

Run `npm run tauri dev`, select a shape, add/edit fills (color + opacity), add a stroke, add a drop shadow, confirm each renders on canvas and updates live.

- [ ] **Step 9: Commit**

```bash
git add src/lib/scene/types.ts src/lib/render/effects.ts src/lib/render/effects.test.ts src/lib/render/drawNode.ts src/components/PropertyInspector.svelte
git commit -m "Add fill/stroke/effects editing"
```

---

### Task 17: Toolbar, keyboard shortcuts, and undo/redo UI wiring

**Files:**
- Create: `src/components/Toolbar.svelte`
- Modify: `src/components/App.svelte`

**Interfaces:**
- Consumes: `toolManager` (Task 11), `EditorStore.undo/redo` (Task 7)
- Produces: `<Toolbar store={editorStore} />` with buttons for each tool plus undo/redo; a `keydown` listener (in `App.svelte`) mapping `Cmd/Ctrl+Z` to undo, `Cmd/Ctrl+Shift+Z` to redo, `V/R/O/L/P/F/T` to select/rectangle/ellipse/line/polygon/frame/text tools, `Delete/Backspace` to remove the current selection.

- [ ] **Step 1: Build Toolbar.svelte**

`src/components/Toolbar.svelte`:

```svelte
<script lang="ts">
  import type { EditorStore } from "../lib/store/editorStore";
  import { toolManager, type ToolId } from "../lib/tools/toolManager";

  export let store: EditorStore;

  let activeTool: ToolId = "select";
  toolManager.subscribe((t) => (activeTool = t));

  const tools: { id: ToolId; label: string }[] = [
    { id: "select", label: "Select (V)" },
    { id: "rectangle", label: "Rectangle (R)" },
    { id: "ellipse", label: "Ellipse (O)" },
    { id: "line", label: "Line (L)" },
    { id: "polygon", label: "Polygon (P)" },
    { id: "frame", label: "Frame (F)" },
    { id: "text", label: "Text (T)" },
  ];
</script>

<div style="display: flex; gap: 4px; padding: 4px; border-bottom: 1px solid #ddd;">
  {#each tools as tool}
    <button
      on:click={() => toolManager.setTool(tool.id)}
      style="font-weight: {activeTool === tool.id ? 'bold' : 'normal'};"
    >
      {tool.label}
    </button>
  {/each}
  <span style="flex: 1;" />
  <button on:click={() => store.undo()}>Undo</button>
  <button on:click={() => store.redo()}>Redo</button>
</div>
```

- [ ] **Step 2: Wire keyboard shortcuts and Toolbar into App.svelte**

`src/components/App.svelte`:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import CanvasView from "./CanvasView.svelte";
  import LayersPanel from "./LayersPanel.svelte";
  import PropertyInspector from "./PropertyInspector.svelte";
  import Toolbar from "./Toolbar.svelte";
  import { createEditorStore } from "../lib/store/editorStore";
  import { toolManager, type ToolId } from "../lib/tools/toolManager";
  import { removeNode } from "../lib/scene/sceneGraph";

  const store = createEditorStore("Page 1");

  const KEY_TO_TOOL: Record<string, ToolId> = {
    v: "select", r: "rectangle", o: "ellipse", l: "line", p: "polygon", f: "frame", t: "text",
  };

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z" && e.shiftKey) {
      e.preventDefault();
      store.redo();
      return;
    }
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      store.undo();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      const selection = store.getSelection();
      if (selection.length > 0) {
        store.mutate((g) => selection.reduce((acc, id) => removeNode(acc, id), g));
        store.select([]);
      }
      return;
    }
    const tool = KEY_TO_TOOL[e.key.toLowerCase()];
    if (tool) toolManager.setTool(tool);
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

<main style="display: flex; flex-direction: column; height: 100vh;">
  <Toolbar {store} />
  <div style="display: flex; flex: 1; min-height: 0;">
    <aside style="width: 240px; border-right: 1px solid #ddd; overflow-y: auto;">
      <LayersPanel {store} />
    </aside>
    <div style="flex: 1;">
      <CanvasView {store} />
    </div>
    <aside style="width: 240px; border-left: 1px solid #ddd; overflow-y: auto;">
      <PropertyInspector {store} />
    </aside>
  </div>
</main>
```

- [ ] **Step 3: Manually verify**

Run `npm run tauri dev`. Confirm: toolbar buttons switch tools (bold = active), keyboard shortcuts switch tools when focus isn't in a text input, Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z undo/redo, Delete/Backspace removes the selected shape(s).

- [ ] **Step 4: Commit**

```bash
git add src/components/Toolbar.svelte src/components/App.svelte
git commit -m "Add toolbar, keyboard shortcuts, and undo/redo/delete wiring"
```

---

### Task 18: Rust SQLite persistence layer

**Files:**
- Create: `src-tauri/src/db.rs`
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml` (add `rusqlite`, `serde`, `serde_json`)
- Test: `src-tauri/tests/persistence_test.rs`

**Interfaces:**
- Produces (Rust):
  - `fn init_db(path: &str) -> rusqlite::Result<Connection>` — creates `project_meta(key TEXT PRIMARY KEY, value TEXT)` and `pages(id TEXT PRIMARY KEY, name TEXT, graph_json TEXT)` tables if absent
  - `fn save_page(conn: &Connection, id: &str, name: &str, graph_json: &str) -> rusqlite::Result<()>` — upsert
  - `fn load_page(conn: &Connection, id: &str) -> rusqlite::Result<Option<(String, String)>>` — returns `(name, graph_json)`
  - `fn list_pages(conn: &Connection) -> rusqlite::Result<Vec<(String, String)>>` — `(id, name)` pairs
  - Tauri commands (`#[tauri::command]`): `create_project(path: String, project_name: String) -> Result<(), String>`, `open_project(path: String) -> Result<ProjectData, String>`, `save_project(path: String, data: ProjectData) -> Result<(), String>`, where `ProjectData { pages: Vec<PageData> }`, `PageData { id: String, name: String, graph_json: String }` (both `#[derive(Serialize, Deserialize)]`)

- [ ] **Step 1: Add dependencies**

Add to `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2: Write the failing Rust integration test**

`src-tauri/tests/persistence_test.rs`:

```rust
use std::fs;

#[path = "../src/db.rs"]
mod db;

fn temp_db_path(name: &str) -> String {
    let mut path = std::env::temp_dir();
    path.push(format!("cofora_test_{}_{}.sqlite", name, std::process::id()));
    path.to_string_lossy().to_string()
}

#[test]
fn init_db_creates_expected_tables() {
    let path = temp_db_path("init");
    let conn = db::init_db(&path).expect("init_db should succeed");
    conn.execute("INSERT INTO project_meta (key, value) VALUES ('name', 'Test Project')", [])
        .expect("project_meta table should exist and accept inserts");
    fs::remove_file(&path).ok();
}

#[test]
fn save_and_load_page_round_trips() {
    let path = temp_db_path("roundtrip");
    let conn = db::init_db(&path).expect("init_db should succeed");
    db::save_page(&conn, "page1", "Page 1", "{\"rootId\":\"r\",\"nodes\":{}}").expect("save_page should succeed");

    let loaded = db::load_page(&conn, "page1").expect("load_page should succeed");
    assert_eq!(loaded, Some(("Page 1".to_string(), "{\"rootId\":\"r\",\"nodes\":{}}".to_string())));
    fs::remove_file(&path).ok();
}

#[test]
fn save_page_upserts_on_conflict() {
    let path = temp_db_path("upsert");
    let conn = db::init_db(&path).expect("init_db should succeed");
    db::save_page(&conn, "page1", "Page 1", "{}").unwrap();
    db::save_page(&conn, "page1", "Renamed", "{\"a\":1}").unwrap();

    let loaded = db::load_page(&conn, "page1").unwrap();
    assert_eq!(loaded, Some(("Renamed".to_string(), "{\"a\":1}".to_string())));
    fs::remove_file(&path).ok();
}

#[test]
fn list_pages_returns_all_saved_pages() {
    let path = temp_db_path("list");
    let conn = db::init_db(&path).expect("init_db should succeed");
    db::save_page(&conn, "page1", "Page 1", "{}").unwrap();
    db::save_page(&conn, "page2", "Page 2", "{}").unwrap();

    let mut pages = db::list_pages(&conn).unwrap();
    pages.sort();
    assert_eq!(pages, vec![("page1".to_string(), "Page 1".to_string()), ("page2".to_string(), "Page 2".to_string())]);
    fs::remove_file(&path).ok();
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd src-tauri && cargo test persistence_test && cd ..`
Expected: FAIL to compile — `src/db.rs` does not exist.

- [ ] **Step 4: Implement db.rs**

`src-tauri/src/db.rs`:

```rust
use rusqlite::{params, Connection, Result};

pub fn init_db(path: &str) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY, name TEXT NOT NULL, graph_json TEXT NOT NULL)",
        [],
    )?;
    Ok(conn)
}

pub fn save_page(conn: &Connection, id: &str, name: &str, graph_json: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO pages (id, name, graph_json) VALUES (?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, graph_json = excluded.graph_json",
        params![id, name, graph_json],
    )?;
    Ok(())
}

pub fn load_page(conn: &Connection, id: &str) -> Result<Option<(String, String)>> {
    conn.query_row(
        "SELECT name, graph_json FROM pages WHERE id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map(Some)
    .or_else(|e| if e == rusqlite::Error::QueryReturnedNoRows { Ok(None) } else { Err(e) })
}

pub fn list_pages(conn: &Connection) -> Result<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT id, name FROM pages")?;
    let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
    rows.collect()
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-tauri && cargo test persistence_test && cd ..`
Expected: PASS (4 tests).

- [ ] **Step 6: Implement Tauri commands**

`src-tauri/src/commands.rs`:

```rust
use crate::db;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct PageData {
    pub id: String,
    pub name: String,
    pub graph_json: String,
}

#[derive(Serialize, Deserialize)]
pub struct ProjectData {
    pub pages: Vec<PageData>,
}

#[tauri::command]
pub fn create_project(path: String, project_name: String) -> Result<(), String> {
    let conn = db::init_db(&path).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO project_meta (key, value) VALUES ('name', ?1)",
        [&project_name],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_project(path: String) -> Result<ProjectData, String> {
    let conn = db::init_db(&path).map_err(|e| e.to_string())?;
    let pages = db::list_pages(&conn).map_err(|e| e.to_string())?;
    let mut page_data = Vec::new();
    for (id, name) in pages {
        if let Some((_, graph_json)) = db::load_page(&conn, &id).map_err(|e| e.to_string())? {
            page_data.push(PageData { id, name, graph_json });
        }
    }
    Ok(ProjectData { pages: page_data })
}

#[tauri::command]
pub fn save_project(path: String, data: ProjectData) -> Result<(), String> {
    let conn = db::init_db(&path).map_err(|e| e.to_string())?;
    for page in data.pages {
        db::save_page(&conn, &page.id, &page.name, &page.graph_json).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

- [ ] **Step 7: Register modules and commands in main.rs**

Modify `src-tauri/src/main.rs` — add near the top:

```rust
mod db;
mod commands;
```

And in the `tauri::Builder` setup, add to `.invoke_handler(tauri::generate_handler![...])`:

```rust
commands::create_project,
commands::open_project,
commands::save_project,
```

(Merge with whatever the scaffold already generated rather than replacing the whole builder chain.)

- [ ] **Step 8: Run the full Rust test suite**

Run: `cd src-tauri && cargo test && cd ..`
Expected: all tests pass, including the Task 1 scaffold test(s) and the new persistence tests.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/db.rs src-tauri/src/commands.rs src-tauri/src/main.rs src-tauri/tests/persistence_test.rs
git commit -m "Add SQLite persistence layer and Tauri project commands"
```

---

### Task 19: Frontend persistence client and save/load/autosave wiring

**Files:**
- Create: `src/lib/persistence/projectClient.ts`
- Modify: `src/components/App.svelte`

**Interfaces:**
- Consumes: Tauri `invoke` (via `@tauri-apps/api/core`), `EditorStore` (Task 7), Tauri's save/open dialog (`@tauri-apps/plugin-dialog`)
- Produces:
  - `saveProject(path: string, store: EditorStore): Promise<void>` — serializes the current graph as one `PageData` and calls the `save_project` command
  - `openProject(path: string): Promise<{ id: string; name: string; graph: SceneGraph }[]>` — calls `open_project` and parses each page's `graph_json`
  - `promptForNewProjectPath(): Promise<string | null>` — wraps the native save dialog
  - `promptForExistingProjectPath(): Promise<string | null>` — wraps the native open dialog
  - Autosave: `App.svelte` debounce-saves 2 seconds after the last `editorStore` change, and on window blur, once a project path is set

- [ ] **Step 1: Add the Tauri dialog plugin**

```bash
npm install @tauri-apps/plugin-dialog
cd src-tauri && cargo add tauri-plugin-dialog && cd ..
```

Register the plugin in `src-tauri/src/main.rs`'s builder chain: `.plugin(tauri_plugin_dialog::init())`.

- [ ] **Step 2: Implement projectClient.ts**

`src/lib/persistence/projectClient.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import type { EditorStore } from "../store/editorStore";
import type { SceneGraph } from "../scene/types";

interface PageData {
  id: string;
  name: string;
  graph_json: string;
}

interface ProjectData {
  pages: PageData[];
}

const SINGLE_PAGE_ID = "page-1";

export async function saveProject(path: string, store: EditorStore): Promise<void> {
  const graph = store.getGraph();
  const data: ProjectData = {
    pages: [{ id: SINGLE_PAGE_ID, name: graph.nodes[graph.rootId].name, graph_json: JSON.stringify(graph) }],
  };
  await invoke("save_project", { path, data });
}

export async function openProject(path: string): Promise<{ id: string; name: string; graph: SceneGraph }[]> {
  const data = await invoke<ProjectData>("open_project", { path });
  return data.pages.map((p) => ({ id: p.id, name: p.name, graph: JSON.parse(p.graph_json) as SceneGraph }));
}

export async function promptForNewProjectPath(): Promise<string | null> {
  return await save({ filters: [{ name: "Cofora Project", extensions: ["cofora"] }] });
}

export async function promptForExistingProjectPath(): Promise<string | null> {
  const result = await open({ filters: [{ name: "Cofora Project", extensions: ["cofora"] }], multiple: false });
  return typeof result === "string" ? result : null;
}
```

- [ ] **Step 3: Wire save/open/autosave into App.svelte**

Extend `src/components/App.svelte`'s `<script>` block:

```typescript
import {
  saveProject, openProject, promptForNewProjectPath, promptForExistingProjectPath,
} from "../lib/persistence/projectClient";
import { createEmptyGraph } from "../lib/scene/sceneGraph";

let projectPath: string | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

async function handleNewProject() {
  const path = await promptForNewProjectPath();
  if (!path) return;
  projectPath = path;
  await invoke("create_project", { path, projectName: path.split("/").pop() ?? "Untitled" });
  await saveProject(path, store);
}

async function handleOpenProject() {
  const path = await promptForExistingProjectPath();
  if (!path) return;
  const pages = await openProject(path);
  if (pages.length > 0) {
    store.mutate(() => pages[0].graph);
    store.select([]);
  }
  projectPath = path;
}

function scheduleAutosave() {
  if (!projectPath) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveProject(projectPath!, store), 2000);
}

onMount(() => {
  const unsubscribe = store.subscribe(() => scheduleAutosave());
  const handleBlur = () => { if (projectPath) saveProject(projectPath, store); };
  window.addEventListener("blur", handleBlur);
  window.addEventListener("keydown", handleKeydown);
  return () => {
    unsubscribe();
    window.removeEventListener("blur", handleBlur);
    window.removeEventListener("keydown", handleKeydown);
  };
});
```

(`invoke` must be imported from `@tauri-apps/api/core` alongside the other new imports.)

Add New/Open buttons to `Toolbar.svelte` — extend its props and template:

```svelte
<script lang="ts">
  // ...existing imports...
  export let onNew: () => void;
  export let onOpen: () => void;
</script>

<!-- inside the existing toolbar div, before the tool buttons -->
<button on:click={onNew}>New</button>
<button on:click={onOpen}>Open</button>
```

Pass the handlers from `App.svelte`: `<Toolbar {store} onNew={handleNewProject} onOpen={handleOpenProject} />`.

- [ ] **Step 4: Manually verify**

Run `npm run tauri dev`. Click New, choose a save location, draw a few shapes, wait 2+ seconds (autosave fires), quit the app, relaunch, click Open, pick the same file, confirm the shapes are restored with correct geometry/style. Also verify closing the app window (blur) triggers a save even before the 2-second debounce would have fired.

- [ ] **Step 5: Commit**

```bash
git add src/lib/persistence/projectClient.ts src/components/App.svelte src/components/Toolbar.svelte src-tauri/Cargo.toml src-tauri/src/main.rs package.json
git commit -m "Wire project save/open/autosave through Tauri commands"
```

---

### Task 20: Export selection to PNG/JPG/SVG

**Files:**
- Create: `src/lib/export/exportImage.ts`
- Create: `src/lib/export/exportSvg.ts`
- Test: `src/lib/export/exportSvg.test.ts`
- Modify: `src/components/PropertyInspector.svelte` (export controls for the current selection)

**Interfaces:**
- Produces:
  - `renderNodeToOffscreenCanvas(graph: SceneGraph, nodeId: string, scale: 1 | 2 | 3): HTMLCanvasElement` — renders just the selected node (and its descendants) at the given pixel scale, cropped to its own bounds
  - `exportNodeAsPng(graph: SceneGraph, nodeId: string, scale: 1 | 2 | 3): Promise<Blob>` and `exportNodeAsJpg(...)` — via `canvas.toBlob`
  - `nodeToSvgString(graph: SceneGraph, nodeId: string): string` — pure function, unit-testable without a canvas
  - `promptSaveExport(blobOrString: Blob | string, suggestedName: string): Promise<void>` — wraps the save dialog + Tauri filesystem write

- [ ] **Step 1: Write the failing test for SVG export**

`src/lib/export/exportSvg.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createEmptyGraph, addNode } from "../scene/sceneGraph";
import { nodeToSvgString } from "./exportSvg";
import type { SceneNode } from "../scene/types";

function rect(id: string, parentId: string): SceneNode {
  return {
    id, kind: "rectangle", name: "Rectangle", parentId, childIds: [],
    x: 10, y: 20, width: 100, height: 50, rotation: 0,
    visible: true, locked: false,
    fills: [{ type: "solid", color: "#ff0000", opacity: 1 }],
    strokes: [],
  };
}

describe("nodeToSvgString", () => {
  it("produces an SVG document sized to the node's own bounds", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(g, rect("r1", g.rootId), g.rootId);
    const svg = nodeToSvgString(g, "r1");
    expect(svg).toContain('width="100"');
    expect(svg).toContain('height="50"');
  });

  it("renders a solid-fill rectangle as an SVG <rect>", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(g, rect("r1", g.rootId), g.rootId);
    const svg = nodeToSvgString(g, "r1");
    expect(svg).toContain("<rect");
    expect(svg).toContain('fill="#ff0000"');
  });

  it("renders an ellipse node as an SVG <ellipse>", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(g, { ...rect("e1", g.rootId), kind: "ellipse" }, g.rootId);
    const svg = nodeToSvgString(g, "e1");
    expect(svg).toContain("<ellipse");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- exportSvg`
Expected: FAIL — `exportSvg.ts` does not exist.

- [ ] **Step 3: Implement nodeToSvgString**

`src/lib/export/exportSvg.ts`:

```typescript
import type { SceneGraph, SceneNode } from "../scene/types";

function fillAttr(node: SceneNode): string {
  const fill = node.fills[0];
  if (!fill) return 'fill="none"';
  if (fill.type === "solid") return `fill="${fill.color}" fill-opacity="${fill.opacity}"`;
  return 'fill="none"'; // gradient SVG export deferred past Phase 1 scope for the export path
}

function strokeAttr(node: SceneNode): string {
  const stroke = node.strokes[0];
  if (!stroke) return "";
  return ` stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-opacity="${stroke.opacity}"`;
}

function shapeMarkup(node: SceneNode): string {
  switch (node.kind) {
    case "rectangle":
    case "frame":
      return `<rect x="0" y="0" width="${node.width}" height="${node.height}" rx="${node.cornerRadius ?? 0}" ${fillAttr(node)}${strokeAttr(node)} />`;
    case "ellipse":
      return `<ellipse cx="${node.width / 2}" cy="${node.height / 2}" rx="${node.width / 2}" ry="${node.height / 2}" ${fillAttr(node)}${strokeAttr(node)} />`;
    case "line":
      return `<line x1="0" y1="${node.height / 2}" x2="${node.width}" y2="${node.height / 2}"${strokeAttr(node)} />`;
    case "text":
      return `<text x="0" y="${node.text?.fontSize ?? 16}" font-family="${node.text?.fontFamily}" font-size="${node.text?.fontSize}">${node.text?.content ?? ""}</text>`;
    default:
      return "";
  }
}

function renderChildren(graph: SceneGraph, node: SceneNode): string {
  return node.childIds
    .map((childId) => {
      const child = graph.nodes[childId];
      if (!child.visible) return "";
      const rot = child.rotation ? ` rotate(${child.rotation})` : "";
      return `<g transform="translate(${child.x},${child.y})${rot}">${shapeMarkup(child)}${renderChildren(graph, child)}</g>`;
    })
    .join("");
}

export function nodeToSvgString(graph: SceneGraph, nodeId: string): string {
  const node = graph.nodes[nodeId];
  const inner = `${shapeMarkup(node)}${renderChildren(graph, node)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${node.width}" height="${node.height}" viewBox="0 0 ${node.width} ${node.height}">${inner}</svg>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- exportSvg`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement raster export (PNG/JPG)**

`src/lib/export/exportImage.ts`:

```typescript
import type { SceneGraph } from "../scene/types";
import { worldMatrix, invert, applyToPoint } from "../scene/matrix";
import { renderScene } from "../render/renderer";

export function renderNodeToOffscreenCanvas(
  graph: SceneGraph,
  nodeId: string,
  scale: 1 | 2 | 3
): HTMLCanvasElement {
  const node = graph.nodes[nodeId];
  const canvas = document.createElement("canvas");
  canvas.width = node.width * scale;
  canvas.height = node.height * scale;
  const ctx = canvas.getContext("2d")!;

  // Render the full scene into a temporary offscreen canvas at world scale,
  // then crop to this node's world-space bounds. Simpler and more correct
  // for rotated/nested nodes than re-deriving a standalone transform chain.
  const full = document.createElement("canvas");
  full.width = 8000;
  full.height = 8000;
  const fullCtx = full.getContext("2d")!;
  fullCtx.setTransform(scale, 0, 0, scale, 0, 0);
  renderScene(fullCtx, graph, []);

  const m = worldMatrix(nodeId, graph);
  const origin = applyToPoint(m, 0, 0);
  ctx.drawImage(
    full,
    origin.x * scale, origin.y * scale, node.width * scale, node.height * scale,
    0, 0, node.width * scale, node.height * scale
  );
  return canvas;
}

export async function exportNodeAsPng(graph: SceneGraph, nodeId: string, scale: 1 | 2 | 3): Promise<Blob> {
  const canvas = renderNodeToOffscreenCanvas(graph, nodeId, scale);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export async function exportNodeAsJpg(graph: SceneGraph, nodeId: string, scale: 1 | 2 | 3): Promise<Blob> {
  const canvas = renderNodeToOffscreenCanvas(graph, nodeId, scale);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92);
  });
}
```

- [ ] **Step 6: Implement the save-to-disk wrapper**

Add to `src/lib/persistence/projectClient.ts`:

```typescript
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

export async function promptSaveExport(blobOrString: Blob | string, suggestedName: string): Promise<void> {
  const extension = suggestedName.split(".").pop() ?? "png";
  const path = await save({ defaultPath: suggestedName, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] });
  if (!path) return;
  if (typeof blobOrString === "string") {
    await writeTextFile(path, blobOrString);
  } else {
    await writeFile(path, new Uint8Array(await blobOrString.arrayBuffer()));
  }
}
```

Install the filesystem plugin:

```bash
npm install @tauri-apps/plugin-fs
cd src-tauri && cargo add tauri-plugin-fs && cd ..
```

Register it in `src-tauri/src/main.rs`'s builder chain: `.plugin(tauri_plugin_fs::init())`.

- [ ] **Step 7: Add export controls to PropertyInspector.svelte**

Extend the `<script>` block:

```typescript
import { exportNodeAsPng, exportNodeAsJpg } from "../lib/export/exportImage";
import { nodeToSvgString } from "../lib/export/exportSvg";
import { promptSaveExport } from "../lib/persistence/projectClient";

async function exportAs(format: "png" | "jpg" | "svg", scale: 1 | 2 | 3 = 1) {
  if (!node || !graph) return;
  if (format === "svg") {
    await promptSaveExport(nodeToSvgString(graph, node.id), `${node.name}.svg`);
    return;
  }
  const blob = format === "png" ? await exportNodeAsPng(graph, node.id, scale) : await exportNodeAsJpg(graph, node.id, scale);
  await promptSaveExport(blob, `${node.name}@${scale}x.${format}`);
}
```

Append to the template:

```svelte
<div style="grid-column: span 2; margin-top: 8px;">
  <strong>Export</strong>
  <div style="display: flex; gap: 4px; flex-wrap: wrap;">
    <button on:click={() => exportAs("png", 1)}>PNG 1x</button>
    <button on:click={() => exportAs("png", 2)}>PNG 2x</button>
    <button on:click={() => exportAs("jpg", 1)}>JPG</button>
    <button on:click={() => exportAs("svg")}>SVG</button>
  </div>
</div>
```

- [ ] **Step 8: Manually verify**

Run `npm run tauri dev`, create and style a shape, select it, click each export button, confirm a save dialog appears and the resulting file opens correctly in an image viewer (PNG/JPG) or browser (SVG) with the expected appearance and dimensions.

- [ ] **Step 9: Commit**

```bash
git add src/lib/export/ src/components/PropertyInspector.svelte src/lib/persistence/projectClient.ts src-tauri/Cargo.toml src-tauri/src/main.rs package.json
git commit -m "Add PNG/JPG/SVG export for the current selection"
```

---

### Task 21: Align/distribute UI

**Files:**
- Modify: `src/components/PropertyInspector.svelte`

**Interfaces:**
- Consumes: `alignLeft`, `alignCenterHorizontal`, `alignRight`, `alignTop`, `alignMiddleVertical`, `alignBottom`, `distributeHorizontal`, `distributeVertical`, `type Bounds` (Task 6); `EditorStore` (Task 7)
- Constraint: Phase 1 aligns/distributes only nodes that share the same parent (their `x`/`y` are already in one common coordinate space, so no world-space conversion is needed). Selecting nodes with different parents disables the buttons — reparenting-aware alignment is not in scope for Phase 1.

- [ ] **Step 1: Add alignment handling to PropertyInspector.svelte**

Extend the `<script>` block:

```typescript
import {
  alignLeft, alignCenterHorizontal, alignRight,
  alignTop, alignMiddleVertical, alignBottom,
  distributeHorizontal, distributeVertical,
} from "../lib/align/align";
import type { Bounds } from "../lib/align/align";

$: sameParentSelection =
  selection.length > 1 && graph &&
  selection.every((id) => graph.nodes[id].parentId === graph.nodes[selection[0]].parentId);

function selectionBounds(): Bounds[] {
  return selection.map((id) => {
    const n = graph.nodes[id];
    return { id: n.id, x: n.x, y: n.y, width: n.width, height: n.height };
  });
}

function applyAlign(fn: (items: Bounds[]) => Map<string, { x: number } | { y: number }>) {
  const updates = fn(selectionBounds());
  store.mutate((g) => {
    let next = g;
    for (const [id, patch] of updates) next = updateNode(next, id, patch);
    return next;
  });
}
```

Append to the template, inside the `{#if node}` block:

```svelte
{#if sameParentSelection}
  <div style="grid-column: span 2; margin-top: 8px;">
    <strong>Align / Distribute</strong>
    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
      <button on:click={() => applyAlign(alignLeft)}>Left</button>
      <button on:click={() => applyAlign(alignCenterHorizontal)}>Center H</button>
      <button on:click={() => applyAlign(alignRight)}>Right</button>
      <button on:click={() => applyAlign(alignTop)}>Top</button>
      <button on:click={() => applyAlign(alignMiddleVertical)}>Middle V</button>
      <button on:click={() => applyAlign(alignBottom)}>Bottom</button>
      <button on:click={() => applyAlign(distributeHorizontal)}>Distribute H</button>
      <button on:click={() => applyAlign(distributeVertical)}>Distribute V</button>
    </div>
  </div>
{/if}
```

- [ ] **Step 2: Manually verify**

Run `npm run tauri dev`, create three same-parent rectangles at different positions, shift-click to multi-select them, click each align/distribute button, confirm shapes move as expected and the buttons are hidden/disabled when the selection spans different parents (e.g. one shape inside a frame, one outside).

- [ ] **Step 3: Commit**

```bash
git add src/components/PropertyInspector.svelte
git commit -m "Wire align/distribute buttons into the property inspector"
```

---

### Task 22: Group and ungroup

**Files:**
- Create: `src/lib/tools/grouping.ts`
- Test: `src/lib/tools/grouping.test.ts`
- Modify: `src/components/Toolbar.svelte`
- Modify: `src/components/App.svelte`

**Interfaces:**
- Consumes: `SceneGraph`, `addNode`, `removeNode`, `reparentNode`, `updateNode`, `cloneGraph` (Task 3)
- Produces:
  - `groupNodes(graph: SceneGraph, nodeIds: string[]): { graph: SceneGraph; groupId: string }` — creates a new `"group"`-kind node sized to the bounding box of `nodeIds`, reparents each into it with geometry adjusted to stay in the same visual position, requires all `nodeIds` share one parent (same constraint as Task 21's align)
  - `ungroupNode(graph: SceneGraph, groupId: string): SceneGraph` — reparents the group's children back to the group's own parent, adjusting geometry to preserve visual position, then removes the now-empty group node

- [ ] **Step 1: Write the failing tests**

`src/lib/tools/grouping.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createEmptyGraph, addNode } from "../scene/sceneGraph";
import { groupNodes, ungroupNode } from "./grouping";
import type { SceneNode } from "../scene/types";

function rect(id: string, parentId: string, x: number, y: number, w: number, h: number): SceneNode {
  return {
    id, kind: "rectangle", name: "Rectangle", parentId, childIds: [],
    x, y, width: w, height: h, rotation: 0,
    visible: true, locked: false, fills: [], strokes: [],
  };
}

describe("groupNodes", () => {
  it("creates a group sized to the bounding box of the selected nodes", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(g, rect("a", g.rootId, 10, 10, 20, 20), g.rootId);
    g = addNode(g, rect("b", g.rootId, 50, 60, 10, 10), g.rootId);
    const { graph: g2, groupId } = groupNodes(g, ["a", "b"]);
    const group = g2.nodes[groupId];
    expect(group.kind).toBe("group");
    expect(group.x).toBe(10);
    expect(group.y).toBe(10);
    expect(group.width).toBe(50); // 60 - 10
    expect(group.height).toBe(60); // 70 - 10
  });

  it("reparents the nodes into the group and preserves their visual position", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(g, rect("a", g.rootId, 10, 10, 20, 20), g.rootId);
    g = addNode(g, rect("b", g.rootId, 50, 60, 10, 10), g.rootId);
    const { graph: g2, groupId } = groupNodes(g, ["a", "b"]);
    expect(g2.nodes["a"].parentId).toBe(groupId);
    // group is at (10,10); "a" was at (10,10) in the old parent, so relative to the group it's (0,0)
    expect(g2.nodes["a"].x).toBe(0);
    expect(g2.nodes["a"].y).toBe(0);
    expect(g2.nodes["b"].x).toBe(40); // 50 - 10
    expect(g2.nodes["b"].y).toBe(50); // 60 - 10
  });
});

describe("ungroupNode", () => {
  it("restores children to the group's parent at their original visual position and removes the group", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(g, rect("a", g.rootId, 10, 10, 20, 20), g.rootId);
    g = addNode(g, rect("b", g.rootId, 50, 60, 10, 10), g.rootId);
    const { graph: grouped, groupId } = groupNodes(g, ["a", "b"]);

    const g3 = ungroupNode(grouped, groupId);
    expect(g3.nodes[groupId]).toBeUndefined();
    expect(g3.nodes["a"].parentId).toBe(g.rootId);
    expect(g3.nodes["a"].x).toBe(10);
    expect(g3.nodes["a"].y).toBe(10);
    expect(g3.nodes["b"].x).toBe(50);
    expect(g3.nodes["b"].y).toBe(60);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- grouping`
Expected: FAIL — `grouping.ts` does not exist.

- [ ] **Step 3: Implement grouping.ts**

`src/lib/tools/grouping.ts`:

```typescript
import type { SceneGraph } from "../scene/types";
import { addNode, removeNode, reparentNode, updateNode, cloneGraph } from "../scene/sceneGraph";

export function groupNodes(graph: SceneGraph, nodeIds: string[]): { graph: SceneGraph; groupId: string } {
  const parentId = graph.nodes[nodeIds[0]].parentId!;
  const xs = nodeIds.map((id) => graph.nodes[id].x);
  const ys = nodeIds.map((id) => graph.nodes[id].y);
  const rights = nodeIds.map((id) => graph.nodes[id].x + graph.nodes[id].width);
  const bottoms = nodeIds.map((id) => graph.nodes[id].y + graph.nodes[id].height);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const groupId = crypto.randomUUID();

  let next = addNode(
    graph,
    {
      id: groupId, kind: "group", name: "Group", parentId, childIds: [],
      x: minX, y: minY, width: Math.max(...rights) - minX, height: Math.max(...bottoms) - minY,
      rotation: 0, visible: true, locked: false, fills: [], strokes: [],
    },
    parentId
  );

  for (const id of nodeIds) {
    const node = next.nodes[id];
    next = reparentNode(next, id, groupId);
    next = updateNode(next, id, { x: node.x - minX, y: node.y - minY });
  }

  return { graph: next, groupId };
}

export function ungroupNode(graph: SceneGraph, groupId: string): SceneGraph {
  const group = graph.nodes[groupId];
  const parentId = group.parentId!;
  let next = cloneGraph(graph);

  for (const childId of [...group.childIds]) {
    const child = next.nodes[childId];
    next = reparentNode(next, childId, parentId, next.nodes[parentId].childIds.indexOf(groupId));
    next = updateNode(next, childId, { x: child.x + group.x, y: child.y + group.y });
  }

  next = removeNode(next, groupId);
  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- grouping`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire group/ungroup into the toolbar**

Extend `src/components/Toolbar.svelte`'s props and template:

```svelte
<script lang="ts">
  // ...existing imports and props...
  export let onGroup: () => void;
  export let onUngroup: () => void;
</script>

<!-- inside the existing toolbar div, after the undo/redo buttons -->
<button on:click={onGroup}>Group</button>
<button on:click={onUngroup}>Ungroup</button>
```

Add handlers in `src/components/App.svelte`'s `<script>` block:

```typescript
import { groupNodes, ungroupNode } from "../lib/tools/grouping";

function handleGroup() {
  const selection = store.getSelection();
  if (selection.length < 2) return;
  const parentIds = new Set(selection.map((id) => store.getGraph().nodes[id].parentId));
  if (parentIds.size > 1) return; // Task 21's same-parent constraint applies here too
  let newGroupId = "";
  store.mutate((g) => {
    const { graph, groupId } = groupNodes(g, selection);
    newGroupId = groupId;
    return graph;
  });
  store.select([newGroupId]);
}

function handleUngroup() {
  const selection = store.getSelection();
  if (selection.length !== 1 || store.getGraph().nodes[selection[0]].kind !== "group") return;
  const groupId = selection[0];
  const childIds = store.getGraph().nodes[groupId].childIds;
  store.mutate((g) => ungroupNode(g, groupId));
  store.select(childIds);
}
```

Pass the handlers to the toolbar: `<Toolbar {store} onNew={handleNewProject} onOpen={handleOpenProject} onGroup={handleGroup} onUngroup={handleUngroup} />`.

Add `Cmd/Ctrl+G` and `Cmd/Ctrl+Shift+G` to `handleKeydown` in `App.svelte`, alongside the existing undo/redo shortcuts:

```typescript
if (mod && e.key.toLowerCase() === "g" && e.shiftKey) {
  e.preventDefault();
  handleUngroup();
  return;
}
if (mod && e.key.toLowerCase() === "g") {
  e.preventDefault();
  handleGroup();
  return;
}
```

- [ ] **Step 6: Manually verify**

Run `npm run tauri dev`, create two same-parent shapes, select both, group (button or Cmd/Ctrl+G), confirm a "Group" layer appears in the layers panel containing both, confirm the shapes haven't visually moved. Select the group, ungroup (button or Cmd/Ctrl+Shift+G), confirm the shapes return to the group's former parent at the same visual position and the group layer is gone.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tools/grouping.ts src/lib/tools/grouping.test.ts src/components/Toolbar.svelte src/components/App.svelte
git commit -m "Add group/ungroup"
```

---

## Post-plan checklist

After Task 22 is committed, Phase 1 is complete against spec section 4. Before moving to Phase 2 (`docs/superpowers/specs/2026-08-30-cofora-design.md` section 5), do a full manual pass: create a project, use every tool, style objects, group/ungroup, align/distribute, undo/redo across several steps, reload the app and confirm persistence, export in each format — on both a Windows and a macOS build, since Global Constraints require both.

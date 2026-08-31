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

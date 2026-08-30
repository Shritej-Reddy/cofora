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

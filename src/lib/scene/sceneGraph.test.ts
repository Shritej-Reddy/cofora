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

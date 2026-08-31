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

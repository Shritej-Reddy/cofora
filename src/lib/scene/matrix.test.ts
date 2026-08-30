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

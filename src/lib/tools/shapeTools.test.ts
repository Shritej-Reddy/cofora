import { describe, it, expect } from "vitest";
import { createShapeNode, createFrameNode, createTextNode } from "./shapeTools";

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

describe("createFrameNode", () => {
  it("creates a frame that clips its content and has no fill", () => {
    const node = createFrameNode("root", 0, 0, 375, 812);
    expect(node.kind).toBe("frame");
    expect(node.clipsContent).toBe(true);
    expect(node.fills).toEqual([]);
  });
});

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

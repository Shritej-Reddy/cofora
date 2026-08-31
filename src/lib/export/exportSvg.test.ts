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

  it("escapes XML-sensitive characters in text node content", () => {
    let g = createEmptyGraph("Page 1");
    g = addNode(
      g,
      {
        ...rect("t1", g.rootId),
        kind: "text",
        text: { content: "A & B < C", fontFamily: "Inter", fontSize: 16, fontWeight: 400, lineHeight: 1.2, align: "left" },
      },
      g.rootId
    );
    const svg = nodeToSvgString(g, "t1");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;");
    expect(svg).not.toContain("A & B");
    expect(svg).not.toContain("B < C");
  });
});

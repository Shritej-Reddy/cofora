import type { SceneGraph, SceneNode } from "../scene/types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
      return `<text x="0" y="${node.text?.fontSize ?? 16}" font-family="${escapeXml(node.text?.fontFamily ?? "")}" font-size="${node.text?.fontSize}">${escapeXml(node.text?.content ?? "")}</text>`;
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

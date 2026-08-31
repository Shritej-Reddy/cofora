import type { SceneGraph } from "../scene/types";
import { worldMatrix, applyToPoint } from "../scene/matrix";
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

  // Render directly into a canvas sized to this node's own bounds, using a
  // base transform that scales by `scale` and translates the node's
  // world-space origin to (0, 0). This avoids allocating an oversized
  // scratch canvas and correctly handles nodes at any world position
  // (including negative coordinates reachable after panning).
  const m = worldMatrix(nodeId, graph);
  const origin = applyToPoint(m, 0, 0);
  renderScene(ctx, graph, [], [scale, 0, 0, scale, -origin.x * scale, -origin.y * scale]);

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

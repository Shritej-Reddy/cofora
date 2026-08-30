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

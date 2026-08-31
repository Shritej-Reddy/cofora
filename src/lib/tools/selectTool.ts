import type { SceneGraph } from "../scene/types";
import { worldMatrix, applyToPoint } from "../scene/matrix";

interface Rect { x: number; y: number; width: number; height: number }

function worldBounds(graph: SceneGraph, nodeId: string): Rect {
  const node = graph.nodes[nodeId];
  const m = worldMatrix(nodeId, graph);
  const corners = [
    applyToPoint(m, 0, 0),
    applyToPoint(m, node.width, 0),
    applyToPoint(m, 0, node.height),
    applyToPoint(m, node.width, node.height),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function marqueeSelect(graph: SceneGraph, marquee: Rect): string[] {
  const ids: string[] = [];
  function walk(nodeId: string) {
    const node = graph.nodes[nodeId];
    for (const childId of node.childIds) {
      const child = graph.nodes[childId];
      if (child.visible && !child.locked && intersects(worldBounds(graph, childId), marquee)) {
        ids.push(childId);
      }
      walk(childId);
    }
  }
  walk(graph.rootId);
  return ids;
}

import type { SceneGraph, SceneNode } from "./types";
import { worldMatrix, invert, applyToPoint } from "./matrix";

function pointInNode(graph: SceneGraph, node: SceneNode, worldX: number, worldY: number): boolean {
  const m = worldMatrix(node.id, graph);
  const local = applyToPoint(invert(m), worldX, worldY);
  return local.x >= 0 && local.x <= node.width && local.y >= 0 && local.y <= node.height;
}

function paintOrder(graph: SceneGraph): SceneNode[] {
  const order: SceneNode[] = [];
  function walk(nodeId: string) {
    const node = graph.nodes[nodeId];
    // Reverse childIds: the last child in render order is drawn on top,
    // so it must be tested first among siblings.
    for (const childId of [...node.childIds].reverse()) walk(childId);
    if (node.id !== graph.rootId) order.push(node);
  }
  walk(graph.rootId);
  return order;
}

export function hitTestPoint(graph: SceneGraph, worldX: number, worldY: number): string | null {
  // paintOrder() returns topmost-first: each node's children (reversed,
  // so the last-drawn/topmost sibling comes first) are tested before the
  // node itself, since children render on top of their parent.
  for (const node of paintOrder(graph)) {
    if (!node.visible || node.locked) continue;
    if (pointInNode(graph, node, worldX, worldY)) return node.id;
  }
  return null;
}

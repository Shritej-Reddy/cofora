import type { SceneGraph } from "../scene/types";
import { identity, multiply, worldMatrix, type Matrix } from "../scene/matrix";
import { drawNode } from "./drawNode";

const SELECTION_COLOR = "#4f8cff";

export function renderScene(
  ctx: CanvasRenderingContext2D,
  graph: SceneGraph,
  selectedIds: string[],
  baseMatrix: Matrix = identity()
): void {
  ctx.save();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  function walk(nodeId: string) {
    const node = graph.nodes[nodeId];
    if (!node.visible) return;

    const [a, b, c, d, e, f] = multiply(baseMatrix, worldMatrix(nodeId, graph));
    ctx.save();
    ctx.setTransform(a, b, c, d, e, f);

    if (node.id !== graph.rootId) drawNode(ctx, node);

    if (node.kind === "frame" && node.clipsContent) {
      ctx.beginPath();
      ctx.rect(0, 0, node.width, node.height);
      ctx.clip();
    }

    for (const childId of node.childIds) walk(childId);

    ctx.restore();

    if (selectedIds.includes(node.id)) {
      ctx.save();
      ctx.setTransform(a, b, c, d, e, f);
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, node.width, node.height);
      ctx.restore();
    }
  }

  walk(graph.rootId);
  ctx.restore();
}

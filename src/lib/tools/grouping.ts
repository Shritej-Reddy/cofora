import type { SceneGraph } from "../scene/types";
import { addNode, removeNode, reparentNode, updateNode, cloneGraph } from "../scene/sceneGraph";

export function groupNodes(graph: SceneGraph, nodeIds: string[]): { graph: SceneGraph; groupId: string } {
  const parentId = graph.nodes[nodeIds[0]].parentId!;
  const xs = nodeIds.map((id) => graph.nodes[id].x);
  const ys = nodeIds.map((id) => graph.nodes[id].y);
  const rights = nodeIds.map((id) => graph.nodes[id].x + graph.nodes[id].width);
  const bottoms = nodeIds.map((id) => graph.nodes[id].y + graph.nodes[id].height);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const groupId = crypto.randomUUID();

  let next = addNode(
    graph,
    {
      id: groupId, kind: "group", name: "Group", parentId, childIds: [],
      x: minX, y: minY, width: Math.max(...rights) - minX, height: Math.max(...bottoms) - minY,
      rotation: 0, visible: true, locked: false, fills: [], strokes: [],
    },
    parentId
  );

  for (const id of nodeIds) {
    const node = next.nodes[id];
    next = reparentNode(next, id, groupId);
    next = updateNode(next, id, { x: node.x - minX, y: node.y - minY });
  }

  return { graph: next, groupId };
}

export function ungroupNode(graph: SceneGraph, groupId: string): SceneGraph {
  const group = graph.nodes[groupId];
  const parentId = group.parentId!;
  let next = cloneGraph(graph);

  for (const childId of [...group.childIds]) {
    const child = next.nodes[childId];
    next = reparentNode(next, childId, parentId, next.nodes[parentId].childIds.indexOf(groupId));
    next = updateNode(next, childId, { x: child.x + group.x, y: child.y + group.y });
  }

  next = removeNode(next, groupId);
  return next;
}

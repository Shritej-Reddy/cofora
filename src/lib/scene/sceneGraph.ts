import type { SceneGraph, SceneNode } from "./types";

export function createEmptyGraph(rootName: string): SceneGraph {
  const rootId = crypto.randomUUID();
  return {
    rootId,
    nodes: {
      [rootId]: {
        id: rootId, kind: "frame", name: rootName, parentId: null, childIds: [],
        x: 0, y: 0, width: 1440, height: 1024, rotation: 0,
        visible: true, locked: false, fills: [], strokes: [], clipsContent: true,
      },
    },
  };
}

export function cloneGraph(graph: SceneGraph): SceneGraph {
  return structuredClone(graph);
}

export function addNode(
  graph: SceneGraph,
  node: SceneNode,
  parentId: string,
  index?: number
): SceneGraph {
  const next = cloneGraph(graph);
  next.nodes[node.id] = { ...node, parentId };
  const siblings = next.nodes[parentId].childIds;
  const at = index === undefined ? siblings.length : index;
  siblings.splice(at, 0, node.id);
  return next;
}

function collectDescendantIds(graph: SceneGraph, nodeId: string, acc: string[]): void {
  acc.push(nodeId);
  for (const childId of graph.nodes[nodeId].childIds) {
    collectDescendantIds(graph, childId, acc);
  }
}

export function removeNode(graph: SceneGraph, nodeId: string): SceneGraph {
  const next = cloneGraph(graph);
  const node = next.nodes[nodeId];
  if (!node) return next;
  if (node.parentId) {
    const parent = next.nodes[node.parentId];
    parent.childIds = parent.childIds.filter((id) => id !== nodeId);
  }
  const toDelete: string[] = [];
  collectDescendantIds(next, nodeId, toDelete);
  for (const id of toDelete) delete next.nodes[id];
  return next;
}

export function updateNode(
  graph: SceneGraph,
  nodeId: string,
  patch: Partial<SceneNode>
): SceneGraph {
  const next = cloneGraph(graph);
  next.nodes[nodeId] = { ...next.nodes[nodeId], ...patch };
  return next;
}

export function reparentNode(
  graph: SceneGraph,
  nodeId: string,
  newParentId: string,
  index?: number
): SceneGraph {
  const next = cloneGraph(graph);
  const node = next.nodes[nodeId];
  const oldParent = node.parentId ? next.nodes[node.parentId] : undefined;
  if (oldParent) {
    oldParent.childIds = oldParent.childIds.filter((id) => id !== nodeId);
  }
  node.parentId = newParentId;
  const newParent = next.nodes[newParentId];
  const at = index === undefined ? newParent.childIds.length : index;
  newParent.childIds.splice(at, 0, nodeId);
  return next;
}

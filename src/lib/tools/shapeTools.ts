import type { SceneNode, SceneNodeKind } from "../scene/types";

const DEFAULT_FILL = { type: "solid" as const, color: "#d9d9d9", opacity: 1 };

export function createShapeNode(
  kind: Extract<SceneNodeKind, "rectangle" | "ellipse" | "line" | "polygon">,
  parentId: string,
  x: number,
  y: number,
  width: number,
  height: number
): SceneNode {
  const base: SceneNode = {
    id: crypto.randomUUID(),
    kind,
    name: kind[0].toUpperCase() + kind.slice(1),
    parentId,
    childIds: [],
    x, y, width, height, rotation: 0,
    visible: true, locked: false,
    fills: kind === "line" ? [] : [DEFAULT_FILL],
    strokes: kind === "line" ? [{ color: "#000000", width: 2, position: "center", opacity: 1 }] : [],
  };
  if (kind === "polygon") base.polygonSides = 3;
  return base;
}

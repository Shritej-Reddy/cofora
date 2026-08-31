import type { SceneGraph, SceneNode } from "./types";

export type Matrix = [number, number, number, number, number, number];

export function identity(): Matrix {
  return [1, 0, 0, 1, 0, 0];
}

// m1 applied after m2 (m1 is the "outer"/parent transform)
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

/**
 * A node's local transform: place its origin at (x, y) in the parent's
 * space, then rotate about that same origin (the node's top-left corner,
 * not its center — a deliberate Phase 1 simplification).
 */
export function localMatrix(node: { x: number; y: number; rotation: number }): Matrix {
  const rad = (node.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotate: Matrix = [cos, sin, -sin, cos, 0, 0];
  const translate: Matrix = [1, 0, 0, 1, node.x, node.y];
  return multiply(translate, rotate);
}

export function worldMatrix(nodeId: string, graph: SceneGraph): Matrix {
  const chain: SceneNode[] = [];
  let current: SceneNode | undefined = graph.nodes[nodeId];
  while (current) {
    chain.unshift(current);
    current = current.parentId ? graph.nodes[current.parentId] : undefined;
  }
  return chain.reduce((acc, node) => multiply(acc, localMatrix(node)), identity());
}

export function applyToPoint(m: Matrix, x: number, y: number): { x: number; y: number } {
  const [a, b, c, d, e, f] = m;
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

export function invert(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (det === 0) throw new Error("Matrix is not invertible");
  const ia = d / det;
  const ib = -b / det;
  const ic = -c / det;
  const id = a / det;
  const ie = -(ia * e + ic * f);
  const iff = -(ib * e + id * f);
  return [ia, ib, ic, id, ie, iff];
}

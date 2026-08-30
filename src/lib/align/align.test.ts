import { describe, it, expect } from "vitest";
import {
  alignLeft, alignCenterHorizontal, alignRight,
  alignTop, alignMiddleVertical, alignBottom,
  distributeHorizontal, distributeVertical,
} from "./align";
import type { Bounds } from "./align";

const items: Bounds[] = [
  { id: "a", x: 0, y: 0, width: 10, height: 10 },
  { id: "b", x: 50, y: 100, width: 20, height: 40 },
  { id: "c", x: 200, y: 300, width: 30, height: 10 },
];

describe("alignLeft", () => {
  it("moves every item's x to the minimum x", () => {
    const result = alignLeft(items);
    expect(result.get("a")!.x).toBe(0);
    expect(result.get("b")!.x).toBe(0);
    expect(result.get("c")!.x).toBe(0);
  });
});

describe("alignRight", () => {
  it("moves every item's right edge to the maximum right edge", () => {
    const result = alignRight(items);
    // max right edge = 200 + 30 = 230
    expect(result.get("a")!.x).toBe(220); // 230 - 10
    expect(result.get("b")!.x).toBe(210); // 230 - 20
    expect(result.get("c")!.x).toBe(200);
  });
});

describe("alignCenterHorizontal", () => {
  it("centers every item on the shared horizontal midline", () => {
    const result = alignCenterHorizontal(items);
    // bounding box: minX=0, maxRight=230 -> center = 115
    expect(result.get("a")!.x).toBe(110); // 115 - 10/2
    expect(result.get("b")!.x).toBe(105); // 115 - 20/2
  });
});

describe("alignTop / alignMiddleVertical / alignBottom", () => {
  it("aligns to the min y", () => {
    const result = alignTop(items);
    expect(result.get("a")!.y).toBe(0);
    expect(result.get("c")!.y).toBe(0);
  });

  it("aligns to the max bottom edge", () => {
    const result = alignBottom(items);
    // max bottom = 300 + 10 = 310
    expect(result.get("a")!.y).toBe(300); // 310 - 10
  });

  it("centers vertically on the shared midline", () => {
    const result = alignMiddleVertical(items);
    // bounding box: minY=0, maxBottom=310 -> center=155
    expect(result.get("c")!.y).toBe(150); // 155 - 10/2
  });
});

describe("distributeHorizontal", () => {
  it("keeps the leftmost and rightmost items fixed and evenly spaces the gaps between", () => {
    const result = distributeHorizontal(items);
    expect(result.get("a")!.x).toBe(0); // unchanged (leftmost)
    expect(result.get("c")!.x).toBe(200); // unchanged (rightmost)
    // total span 0..230, sum of widths 60, gap space 170 over 2 gaps = 85
    // b.x = a.right + gap = 10 + 85 = 95
    expect(result.get("b")!.x).toBe(95);
  });
});

describe("distributeVertical", () => {
  it("keeps the topmost and bottommost items fixed and evenly spaces the gaps between", () => {
    const result = distributeVertical(items);
    expect(result.get("a")!.y).toBe(0);
    expect(result.get("c")!.y).toBe(300);
  });
});

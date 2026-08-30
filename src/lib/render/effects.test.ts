import { describe, it, expect, vi } from "vitest";
import { applyEffectsToContext } from "./effects";
import type { Effect } from "../scene/types";

function mockCtx() {
  return { shadowColor: "", shadowOffsetX: 0, shadowOffsetY: 0, shadowBlur: 0, filter: "none" } as unknown as CanvasRenderingContext2D;
}

describe("applyEffectsToContext", () => {
  it("sets shadow properties for a drop-shadow effect", () => {
    const ctx = mockCtx();
    const effects: Effect[] = [{ type: "drop-shadow", color: "#000000", offsetX: 2, offsetY: 4, blur: 6 }];
    applyEffectsToContext(ctx, effects);
    expect(ctx.shadowColor).toBe("#000000");
    expect(ctx.shadowOffsetX).toBe(2);
    expect(ctx.shadowOffsetY).toBe(4);
    expect(ctx.shadowBlur).toBe(6);
  });

  it("sets the filter property for a layer-blur effect", () => {
    const ctx = mockCtx();
    const effects: Effect[] = [{ type: "layer-blur", radius: 8 }];
    applyEffectsToContext(ctx, effects);
    expect(ctx.filter).toBe("blur(8px)");
  });

  it("leaves defaults untouched when there are no effects", () => {
    const ctx = mockCtx();
    applyEffectsToContext(ctx, []);
    expect(ctx.shadowBlur).toBe(0);
    expect(ctx.filter).toBe("none");
  });
});

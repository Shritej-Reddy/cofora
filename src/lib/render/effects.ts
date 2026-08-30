import type { Effect } from "../scene/types";

export function applyEffectsToContext(ctx: CanvasRenderingContext2D, effects: Effect[]): void {
  for (const effect of effects) {
    if (effect.type === "drop-shadow") {
      ctx.shadowColor = effect.color;
      ctx.shadowOffsetX = effect.offsetX;
      ctx.shadowOffsetY = effect.offsetY;
      ctx.shadowBlur = effect.blur;
    } else if (effect.type === "layer-blur") {
      ctx.filter = `blur(${effect.radius}px)`;
    }
    // inner-shadow and background-blur are visually approximated in Phase 1
    // by drop-shadow/layer-blur respectively; true inset/backdrop rendering
    // is not implemented.
  }
}

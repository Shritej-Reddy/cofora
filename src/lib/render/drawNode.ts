import type { Fill, SceneNode, Stroke } from "../scene/types";

function applyFill(ctx: CanvasRenderingContext2D, fill: Fill, width: number, height: number): void {
  ctx.globalAlpha = fill.opacity;
  if (fill.type === "solid") {
    ctx.fillStyle = fill.color;
    return;
  }
  const gradient =
    fill.type === "linear"
      ? ctx.createLinearGradient(0, 0, width, height)
      : ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
  for (const stop of fill.stops) gradient.addColorStop(stop.offset, stop.color);
  ctx.fillStyle = gradient;
}

function applyStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  ctx.globalAlpha = stroke.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
}

function pathForNode(ctx: CanvasRenderingContext2D, node: SceneNode): void {
  ctx.beginPath();
  switch (node.kind) {
    case "rectangle":
    case "frame": {
      const r = node.cornerRadius ?? 0;
      ctx.roundRect(0, 0, node.width, node.height, r);
      break;
    }
    case "ellipse":
      ctx.ellipse(node.width / 2, node.height / 2, node.width / 2, node.height / 2, 0, 0, Math.PI * 2);
      break;
    case "line":
      ctx.moveTo(0, node.height / 2);
      ctx.lineTo(node.width, node.height / 2);
      break;
    case "polygon": {
      const sides = node.polygonSides ?? 3;
      const cx = node.width / 2;
      const cy = node.height / 2;
      const rx = node.width / 2;
      const ry = node.height / 2;
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "text":
      // text has no fill/stroke path of its own; drawn separately below.
      break;
  }
}

export function drawNode(ctx: CanvasRenderingContext2D, node: SceneNode): void {
  if (node.kind === "text" && node.text) {
    ctx.globalAlpha = 1;
    ctx.font = `${node.text.fontWeight} ${node.text.fontSize}px ${node.text.fontFamily}`;
    ctx.textAlign = node.text.align;
    ctx.textBaseline = "top";
    ctx.fillStyle = node.fills[0]?.type === "solid" ? node.fills[0].color : "#000000";
    const anchorX = node.text.align === "center" ? node.width / 2 : node.text.align === "right" ? node.width : 0;
    ctx.fillText(node.text.content, anchorX, 0, node.width);
    return;
  }

  pathForNode(ctx, node);
  for (const fill of node.fills) {
    applyFill(ctx, fill, node.width, node.height);
    ctx.fill();
  }
  for (const stroke of node.strokes) {
    applyStroke(ctx, stroke);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

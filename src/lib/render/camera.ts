export interface Camera {
  x: number; // world-space point currently at the top-left of the viewport
  y: number;
  zoom: number; // 1 = 100%
}

export function defaultCamera(): Camera {
  return { x: 0, y: 0, zoom: 1 };
}

export function screenToWorld(camera: Camera, screenX: number, screenY: number): { x: number; y: number } {
  return { x: camera.x + screenX / camera.zoom, y: camera.y + screenY / camera.zoom };
}

// `pixelRatio` accounts for the canvas backing store being scaled up by
// devicePixelRatio relative to its CSS size (see CanvasView.svelte's
// resizeCanvas). The returned matrix maps world space directly to the
// canvas's raw drawing/backing-store pixel space, so world units keep a
// 1:1 correspondence with CSS pixels at zoom=1 regardless of DPR — which
// is what makes `screenToWorld` (which takes CSS-pixel screen coords)
// consistent with what's actually rendered on screen.
export function cameraToCanvasTransform(
  camera: Camera,
  pixelRatio = 1
): [number, number, number, number, number, number] {
  const scale = camera.zoom * pixelRatio;
  return [scale, 0, 0, scale, -camera.x * scale, -camera.y * scale];
}

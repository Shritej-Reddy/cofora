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

export function cameraToCanvasTransform(camera: Camera): [number, number, number, number, number, number] {
  return [camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom];
}

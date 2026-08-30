<script lang="ts">
  import { onMount } from "svelte";
  import type { EditorStore } from "../lib/store/editorStore";
  import { renderScene } from "../lib/render/renderer";
  import { defaultCamera, cameraToCanvasTransform, screenToWorld, type Camera } from "../lib/render/camera";
  import { hitTestPoint } from "../lib/scene/hitTest";
  import { marqueeSelect } from "../lib/tools/selectTool";

  export let store: EditorStore;

  let canvasEl: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let camera: Camera = defaultCamera();

  let dragStart: { x: number; y: number } | null = null;
  let marqueeRect: { x: number; y: number; width: number; height: number } | null = null;

  // The canvas backing store is scaled up by devicePixelRatio relative to
  // its CSS size (see resizeCanvas below). cameraToCanvasTransform bakes
  // devicePixelRatio into the world->backing-store-pixel matrix so that
  // world units keep a 1:1 correspondence with CSS pixels at zoom=1 — that
  // in turn is what makes screenToWorld (which takes CSS-pixel pointer
  // coordinates straight from e.offsetX/e.offsetY, unscaled) resolve to the
  // world point actually rendered under the pointer, on any DPR display.
  function draw() {
    if (!ctx) return;
    const cameraMatrix = cameraToCanvasTransform(camera, window.devicePixelRatio || 1);
    renderScene(ctx, store.getGraph(), store.getSelection(), cameraMatrix);
  }

  function handlePointerDown(e: PointerEvent) {
    const world = screenToWorld(camera, e.offsetX, e.offsetY);
    const hitId = hitTestPoint(store.getGraph(), world.x, world.y);
    if (hitId) {
      store.select([hitId]);
      dragStart = null;
    } else {
      dragStart = world;
      store.select([]);
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (!dragStart) return;
    const world = screenToWorld(camera, e.offsetX, e.offsetY);
    marqueeRect = {
      x: Math.min(dragStart.x, world.x),
      y: Math.min(dragStart.y, world.y),
      width: Math.abs(world.x - dragStart.x),
      height: Math.abs(world.y - dragStart.y),
    };
    draw();
  }

  function handlePointerUp() {
    if (marqueeRect) {
      store.select(marqueeSelect(store.getGraph(), marqueeRect));
    }
    dragStart = null;
    marqueeRect = null;
    draw();
  }

  function resizeCanvas() {
    canvasEl.width = canvasEl.clientWidth * window.devicePixelRatio;
    canvasEl.height = canvasEl.clientHeight * window.devicePixelRatio;
    draw();
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01);
      camera = { ...camera, zoom: Math.min(8, Math.max(0.02, camera.zoom * factor)) };
    } else {
      camera = { ...camera, x: camera.x + e.deltaX / camera.zoom, y: camera.y + e.deltaY / camera.zoom };
    }
    draw();
  }

  onMount(() => {
    ctx = canvasEl.getContext("2d")!;
    resizeCanvas();
    const unsubscribe = store.subscribe(() => draw());
    window.addEventListener("resize", resizeCanvas);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", resizeCanvas);
    };
  });
</script>

<canvas
  bind:this={canvasEl}
  on:wheel={handleWheel}
  on:pointerdown={handlePointerDown}
  on:pointermove={handlePointerMove}
  on:pointerup={handlePointerUp}
  style="width: 100%; height: 100%; display: block;"
/>

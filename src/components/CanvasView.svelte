<script lang="ts">
  import { onMount } from "svelte";
  import type { EditorStore } from "../lib/store/editorStore";
  import { renderScene } from "../lib/render/renderer";
  import { defaultCamera, cameraToCanvasTransform, screenToWorld, type Camera } from "../lib/render/camera";
  import { hitTestPoint } from "../lib/scene/hitTest";
  import { marqueeSelect } from "../lib/tools/selectTool";
  import { toolManager, type ToolId } from "../lib/tools/toolManager";
  import { createShapeNode } from "../lib/tools/shapeTools";
  import { addNode } from "../lib/scene/sceneGraph";

  export let store: EditorStore;

  let canvasEl: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let camera: Camera = defaultCamera();

  let dragStart: { x: number; y: number } | null = null;
  let marqueeRect: { x: number; y: number; width: number; height: number } | null = null;

  let activeTool: ToolId = "select";
  toolManager.subscribe((t) => (activeTool = t));

  let shapeDragStart: { x: number; y: number } | null = null;

  const SHAPE_KINDS: ToolId[] = ["rectangle", "ellipse", "line", "polygon"];

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
    if (SHAPE_KINDS.includes(activeTool)) {
      shapeDragStart = world;
      return;
    }
    // existing select-tool logic from Task 10 continues to handle "select"
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

  function handlePointerUp(e: PointerEvent) {
    if (shapeDragStart && SHAPE_KINDS.includes(activeTool)) {
      const world = screenToWorld(camera, e.offsetX, e.offsetY);
      const x = Math.min(shapeDragStart.x, world.x);
      const y = Math.min(shapeDragStart.y, world.y);
      const width = Math.max(1, Math.abs(world.x - shapeDragStart.x));
      const height = Math.max(1, Math.abs(world.y - shapeDragStart.y));
      const rootId = store.getGraph().rootId;
      const node = createShapeNode(activeTool as "rectangle" | "ellipse" | "line" | "polygon", rootId, x, y, width, height);
      store.mutate((g) => addNode(g, node, rootId));
      store.select([node.id]);
      toolManager.setTool("select");
      shapeDragStart = null;
      return;
    }
    // existing marquee-finalize logic from Task 10 continues to run here
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

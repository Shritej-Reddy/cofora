<script lang="ts">
  import { onMount } from "svelte";
  import type { EditorStore } from "../lib/store/editorStore";
  import { renderScene } from "../lib/render/renderer";
  import { defaultCamera, cameraToCanvasTransform, screenToWorld, type Camera } from "../lib/render/camera";
  import { hitTestPoint } from "../lib/scene/hitTest";
  import { marqueeSelect } from "../lib/tools/selectTool";
  import { toolManager, type ToolId } from "../lib/tools/toolManager";
  import { createShapeNode, createFrameNode, createTextNode } from "../lib/tools/shapeTools";
  import { addNode, updateNode, removeNode } from "../lib/scene/sceneGraph";
  import TextEditOverlay from "./TextEditOverlay.svelte";

  export let store: EditorStore;

  let canvasEl: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let camera: Camera = defaultCamera();

  let dragStart: { x: number; y: number } | null = null;
  let marqueeRect: { x: number; y: number; width: number; height: number } | null = null;

  let activeTool: ToolId = "select";
  toolManager.subscribe((t) => (activeTool = t));

  let shapeDragStart: { x: number; y: number } | null = null;

  const DRAGGABLE_TOOLS: ToolId[] = ["rectangle", "ellipse", "line", "polygon", "frame"];

  let editingNode: import("../lib/scene/types").SceneNode | null = null;

  function handleCanvasClickForText(worldX: number, worldY: number) {
    const rootId = store.getGraph().rootId;
    const node = createTextNode(rootId, worldX, worldY);
    store.mutate((g) => addNode(g, node, rootId));
    editingNode = node;
  }

  function commitText(content: string) {
    if (editingNode) {
      store.mutate((g) => updateNode(g, editingNode!.id, { text: { ...editingNode!.text!, content } }));
    }
    editingNode = null;
    toolManager.setTool("select");
  }

  function cancelText() {
    if (editingNode) {
      store.mutate((g) => removeNode(g, editingNode!.id));
    }
    editingNode = null;
    toolManager.setTool("select");
  }

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
    // A text edit is in progress: its own blur/Escape handler owns committing
    // or cancelling it. Ignore this canvas click rather than racing that
    // commit — pointerdown on the canvas fires before the textarea's blur
    // event, so without this guard a click meant to finish editing would
    // instead be read as "place a new text node" while activeTool is still
    // "text", creating a stray node and misdirecting the commit onto it.
    if (editingNode) return;
    const world = screenToWorld(camera, e.offsetX, e.offsetY);
    if (activeTool === "text") {
      handleCanvasClickForText(world.x, world.y);
      return;
    }
    if (DRAGGABLE_TOOLS.includes(activeTool)) {
      shapeDragStart = world;
      return;
    }
    // existing select-tool logic from Task 10 continues to handle "select"
    const hitId = hitTestPoint(store.getGraph(), world.x, world.y);
    if (hitId) {
      if (e.shiftKey) {
        const current = store.getSelection();
        store.select(current.includes(hitId) ? current.filter((id) => id !== hitId) : [...current, hitId]);
      } else {
        store.select([hitId]);
      }
      dragStart = null;
    } else {
      dragStart = world;
      if (!e.shiftKey) store.select([]);
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
    if (shapeDragStart && DRAGGABLE_TOOLS.includes(activeTool)) {
      const world = screenToWorld(camera, e.offsetX, e.offsetY);
      const x = Math.min(shapeDragStart.x, world.x);
      const y = Math.min(shapeDragStart.y, world.y);
      const width = Math.max(1, Math.abs(world.x - shapeDragStart.x));
      const height = Math.max(1, Math.abs(world.y - shapeDragStart.y));
      const rootId = store.getGraph().rootId;
      const node =
        activeTool === "frame"
          ? createFrameNode(rootId, x, y, width, height)
          : createShapeNode(activeTool as "rectangle" | "ellipse" | "line" | "polygon", rootId, x, y, width, height);
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

<div style="position: relative; width: 100%; height: 100%;">
  <canvas
    bind:this={canvasEl}
    on:wheel={handleWheel}
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
    style="width: 100%; height: 100%; display: block;"
  />
  {#if editingNode}
    <TextEditOverlay node={editingNode} {camera} on:commit={(e) => commitText(e.detail)} on:cancel={cancelText} />
  {/if}
</div>

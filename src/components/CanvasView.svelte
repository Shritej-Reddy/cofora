<script lang="ts">
  import { onMount } from "svelte";
  import type { EditorStore } from "../lib/store/editorStore";
  import { renderScene } from "../lib/render/renderer";
  import { defaultCamera, cameraToCanvasTransform, type Camera } from "../lib/render/camera";

  export let store: EditorStore;

  let canvasEl: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let camera: Camera = defaultCamera();

  function draw() {
    if (!ctx) return;
    const cameraMatrix = cameraToCanvasTransform(camera);
    renderScene(ctx, store.getGraph(), store.getSelection(), cameraMatrix);
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
  style="width: 100%; height: 100%; display: block;"
/>

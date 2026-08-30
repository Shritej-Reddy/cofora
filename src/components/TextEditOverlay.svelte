<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { SceneNode } from "../lib/scene/types";
  import type { Camera } from "../lib/render/camera";

  export let node: SceneNode;
  export let camera: Camera;

  const dispatch = createEventDispatcher<{ commit: string; cancel: void }>();
  let value = node.text?.content ?? "";

  function commit() {
    dispatch("commit", value);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") dispatch("cancel");
  }

  $: screenX = (node.x - camera.x) * camera.zoom;
  $: screenY = (node.y - camera.y) * camera.zoom;
</script>

<textarea
  bind:value
  on:blur={commit}
  on:keydown={handleKeydown}
  autofocus
  style="
    position: absolute;
    left: {screenX}px;
    top: {screenY}px;
    width: {node.width * camera.zoom}px;
    height: {node.height * camera.zoom}px;
    font-family: {node.text?.fontFamily};
    font-size: {(node.text?.fontSize ?? 16) * camera.zoom}px;
    font-weight: {node.text?.fontWeight};
    line-height: {node.text?.lineHeight};
    text-align: {node.text?.align};
    border: 1px solid #4f8cff;
    background: transparent;
    resize: none;
    padding: 0;
    outline: none;
  "
/>

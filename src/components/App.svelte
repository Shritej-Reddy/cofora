<script lang="ts">
  import CanvasView from "./CanvasView.svelte";
  import { createEditorStore } from "../lib/store/editorStore";

  const store = createEditorStore("Page 1");
</script>

<main style="display: flex; height: 100vh;">
  <div style="flex: 1;">
    <CanvasView {store} />
  </div>
</main>

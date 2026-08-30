<script lang="ts">
  import CanvasView from "./CanvasView.svelte";
  import LayersPanel from "./LayersPanel.svelte";
  import { createEditorStore } from "../lib/store/editorStore";

  const store = createEditorStore("Page 1");
</script>

<main style="display: flex; height: 100vh;">
  <aside style="width: 240px; border-right: 1px solid #ddd; overflow-y: auto;">
    <LayersPanel {store} />
  </aside>
  <div style="flex: 1;">
    <CanvasView {store} />
  </div>
</main>

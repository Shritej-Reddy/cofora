<script lang="ts">
  import { onMount } from "svelte";
  import CanvasView from "./CanvasView.svelte";
  import LayersPanel from "./LayersPanel.svelte";
  import PropertyInspector from "./PropertyInspector.svelte";
  import Toolbar from "./Toolbar.svelte";
  import { createEditorStore } from "../lib/store/editorStore";
  import { toolManager, type ToolId } from "../lib/tools/toolManager";
  import { removeNode } from "../lib/scene/sceneGraph";

  const store = createEditorStore("Page 1");

  const KEY_TO_TOOL: Record<string, ToolId> = {
    v: "select", r: "rectangle", o: "ellipse", l: "line", p: "polygon", f: "frame", t: "text",
  };

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return; // let text editing (Task 13 overlay, Task 14 rename input, inspector fields) handle its own keys
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z" && e.shiftKey) {
      e.preventDefault();
      store.redo();
      return;
    }
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      store.undo();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      const selection = store.getSelection();
      if (selection.length > 0) {
        store.mutate((g) => selection.reduce((acc, id) => removeNode(acc, id), g));
        store.select([]);
      }
      return;
    }
    const tool = KEY_TO_TOOL[e.key.toLowerCase()];
    if (tool) toolManager.setTool(tool);
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });
</script>

<main style="display: flex; flex-direction: column; height: 100vh;">
  <Toolbar {store} />
  <div style="display: flex; flex: 1; min-height: 0;">
    <aside style="width: 240px; border-right: 1px solid #ddd; overflow-y: auto;">
      <LayersPanel {store} />
    </aside>
    <div style="flex: 1;">
      <CanvasView {store} />
    </div>
    <aside style="width: 240px; border-left: 1px solid #ddd; overflow-y: auto;">
      <PropertyInspector {store} />
    </aside>
  </div>
</main>

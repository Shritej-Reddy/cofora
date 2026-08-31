<script lang="ts">
  import type { EditorStore } from "../lib/store/editorStore";
  import { toolManager, type ToolId } from "../lib/tools/toolManager";

  export let store: EditorStore;
  export let onNew: () => void;
  export let onOpen: () => void;
  export let onGroup: () => void;
  export let onUngroup: () => void;

  let activeTool: ToolId = "select";
  toolManager.subscribe((t) => (activeTool = t));

  const tools: { id: ToolId; label: string }[] = [
    { id: "select", label: "Select (V)" },
    { id: "rectangle", label: "Rectangle (R)" },
    { id: "ellipse", label: "Ellipse (O)" },
    { id: "line", label: "Line (L)" },
    { id: "polygon", label: "Polygon (P)" },
    { id: "frame", label: "Frame (F)" },
    { id: "text", label: "Text (T)" },
  ];
</script>

<div style="display: flex; gap: 4px; padding: 4px; border-bottom: 1px solid #ddd;">
  <button on:click={onNew}>New</button>
  <button on:click={onOpen}>Open</button>
  {#each tools as tool}
    <button
      on:click={() => toolManager.setTool(tool.id)}
      style="font-weight: {activeTool === tool.id ? 'bold' : 'normal'};"
    >
      {tool.label}
    </button>
  {/each}
  <span style="flex: 1;" />
  <button on:click={() => store.undo()}>Undo</button>
  <button on:click={() => store.redo()}>Redo</button>
  <button on:click={onGroup}>Group</button>
  <button on:click={onUngroup}>Ungroup</button>
</div>

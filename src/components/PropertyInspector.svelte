<script lang="ts">
  import type { EditorStore } from "../lib/store/editorStore";
  import { updateNode } from "../lib/scene/sceneGraph";
  import type { SceneGraph } from "../lib/scene/types";

  export let store: EditorStore;

  let graph: SceneGraph;
  let selection: string[] = [];
  store.subscribe((s) => {
    graph = s.graph;
    selection = s.selection;
  });

  $: node = selection.length > 0 && graph ? graph.nodes[selection[0]] : null;

  function setField(field: "x" | "y" | "width" | "height" | "rotation", value: number) {
    if (!node) return;
    store.mutate((g) => updateNode(g, node!.id, { [field]: value }));
  }
</script>

{#if node}
  <div style="padding: 8px; display: grid; grid-template-columns: auto 1fr; gap: 4px;">
    {#if selection.length > 1}
      <p style="grid-column: span 2;">Editing {node.name} ({selection.length} selected — multi-edit not yet supported)</p>
    {/if}
    <label for="prop-x">X</label>
    <input id="prop-x" type="number" value={node.x} on:change={(e) => setField("x", Number((e.target as HTMLInputElement).value))} />
    <label for="prop-y">Y</label>
    <input id="prop-y" type="number" value={node.y} on:change={(e) => setField("y", Number((e.target as HTMLInputElement).value))} />
    <label for="prop-w">W</label>
    <input id="prop-w" type="number" value={node.width} on:change={(e) => setField("width", Number((e.target as HTMLInputElement).value))} />
    <label for="prop-h">H</label>
    <input id="prop-h" type="number" value={node.height} on:change={(e) => setField("height", Number((e.target as HTMLInputElement).value))} />
    <label for="prop-r">Rotation</label>
    <input id="prop-r" type="number" value={node.rotation} on:change={(e) => setField("rotation", Number((e.target as HTMLInputElement).value))} />
  </div>
{:else}
  <p style="padding: 8px; color: #888;">No selection</p>
{/if}

<script lang="ts">
  import type { EditorStore } from "../lib/store/editorStore";
  import { updateNode, reparentNode } from "../lib/scene/sceneGraph";
  import type { SceneGraph } from "../lib/scene/types";

  export let store: EditorStore;

  let graph: SceneGraph;
  let selection: string[] = [];
  store.subscribe((s) => {
    graph = s.graph;
    selection = s.selection;
  });

  let renamingId: string | null = null;
  let dragId: string | null = null;

  function select(id: string, e: MouseEvent) {
    if (e.shiftKey) {
      store.select(selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]);
    } else {
      store.select([id]);
    }
  }

  function toggleVisible(id: string) {
    store.mutate((g) => updateNode(g, id, { visible: !g.nodes[id].visible }));
  }

  function toggleLock(id: string) {
    store.mutate((g) => updateNode(g, id, { locked: !g.nodes[id].locked }));
  }

  function commitRename(id: string, name: string) {
    store.mutate((g) => updateNode(g, id, { name }));
    renamingId = null;
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const targetParentId = graph.nodes[targetId].parentId!;
    const siblings = graph.nodes[targetParentId].childIds;
    let targetIndex = siblings.indexOf(targetId);
    const draggedNode = graph.nodes[dragId];
    if (draggedNode.parentId === targetParentId) {
      const dragIndex = siblings.indexOf(dragId);
      if (dragIndex !== -1 && dragIndex < targetIndex) {
        targetIndex -= 1;
      }
    }
    store.mutate((g) => reparentNode(g, dragId!, targetParentId, targetIndex));
    dragId = null;
  }
</script>

{#if graph}
  <ul style="list-style: none; margin: 0; padding: 0;">
    {#each [...graph.nodes[graph.rootId].childIds].reverse() as id (id)}
      {@const node = graph.nodes[id]}
      <li
        draggable="true"
        on:dragstart={() => (dragId = id)}
        on:dragover|preventDefault
        on:drop={() => handleDrop(id)}
        on:click={(e) => select(id, e)}
        style="
          display: flex; align-items: center; gap: 4px; padding: 2px 8px;
          background: {selection.includes(id) ? '#e6f0ff' : 'transparent'};
          opacity: {node.visible ? 1 : 0.4};
        "
      >
        <button on:click|stopPropagation={() => toggleVisible(id)}>{node.visible ? "👁" : "🚫"}</button>
        <button on:click|stopPropagation={() => toggleLock(id)}>{node.locked ? "🔒" : "🔓"}</button>
        {#if renamingId === id}
          <input
            value={node.name}
            autofocus
            on:blur={(e) => commitRename(id, (e.target as HTMLInputElement).value)}
            on:keydown={(e) => e.key === "Enter" && commitRename(id, (e.target as HTMLInputElement).value)}
          />
        {:else}
          <span on:dblclick={() => (renamingId = id)}>{node.name}</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

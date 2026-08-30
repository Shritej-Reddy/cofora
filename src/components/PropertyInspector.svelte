<script lang="ts">
  import type { EditorStore } from "../lib/store/editorStore";
  import { updateNode } from "../lib/scene/sceneGraph";
  import type { SceneGraph, Fill, Stroke, Effect } from "../lib/scene/types";
  import { exportNodeAsPng, exportNodeAsJpg } from "../lib/export/exportImage";
  import { nodeToSvgString } from "../lib/export/exportSvg";
  import { promptSaveExport } from "../lib/persistence/projectClient";
  import {
    alignLeft, alignCenterHorizontal, alignRight,
    alignTop, alignMiddleVertical, alignBottom,
    distributeHorizontal, distributeVertical,
  } from "../lib/align/align";
  import type { Bounds } from "../lib/align/align";

  export let store: EditorStore;

  let graph: SceneGraph;
  let selection: string[] = [];
  store.subscribe((s) => {
    graph = s.graph;
    selection = s.selection;
  });

  $: node = selection.length > 0 && graph ? graph.nodes[selection[0]] : null;

  $: sameParentSelection =
    selection.length > 1 && graph &&
    selection.every((id) => graph.nodes[id].parentId === graph.nodes[selection[0]].parentId);

  function selectionBounds(): Bounds[] {
    return selection.map((id) => {
      const n = graph.nodes[id];
      return { id: n.id, x: n.x, y: n.y, width: n.width, height: n.height };
    });
  }

  function applyAlign(fn: (items: Bounds[]) => Map<string, { x: number } | { y: number }>) {
    const updates = fn(selectionBounds());
    store.mutate((g) => {
      let next = g;
      for (const [id, patch] of updates) next = updateNode(next, id, patch);
      return next;
    });
  }

  function setField(field: "x" | "y" | "width" | "height" | "rotation", value: number) {
    if (!node) return;
    store.mutate((g) => updateNode(g, node!.id, { [field]: value }));
  }

  function setFillColor(index: number, color: string) {
    if (!node) return;
    const fills = [...node.fills];
    const f = fills[index];
    if (f.type === "solid") fills[index] = { ...f, color };
    store.mutate((g) => updateNode(g, node!.id, { fills }));
  }

  function setFillOpacity(index: number, opacity: number) {
    if (!node) return;
    const fills = [...node.fills];
    fills[index] = { ...fills[index], opacity };
    store.mutate((g) => updateNode(g, node!.id, { fills }));
  }

  function addSolidFill() {
    if (!node) return;
    store.mutate((g) => updateNode(g, node!.id, { fills: [...node!.fills, { type: "solid", color: "#000000", opacity: 1 }] }));
  }

  function removeFill(index: number) {
    if (!node) return;
    store.mutate((g) => updateNode(g, node!.id, { fills: node!.fills.filter((_, i) => i !== index) }));
  }

  function addStroke() {
    if (!node) return;
    store.mutate((g) => updateNode(g, node!.id, { strokes: [...node!.strokes, { color: "#000000", width: 1, position: "center", opacity: 1 }] }));
  }

  function removeStroke(index: number) {
    if (!node) return;
    store.mutate((g) => updateNode(g, node!.id, { strokes: node!.strokes.filter((_, i) => i !== index) }));
  }

  function addShadow() {
    if (!node) return;
    const effects = node.effects ?? [];
    store.mutate((g) => updateNode(g, node!.id, { effects: [...effects, { type: "drop-shadow", color: "#000000", offsetX: 0, offsetY: 4, blur: 8 }] }));
  }

  function removeEffect(index: number) {
    if (!node) return;
    store.mutate((g) => updateNode(g, node!.id, { effects: (node!.effects ?? []).filter((_, i) => i !== index) }));
  }

  async function exportAs(format: "png" | "jpg" | "svg", scale: 1 | 2 | 3 = 1) {
    if (!node || !graph) return;
    if (format === "svg") {
      await promptSaveExport(nodeToSvgString(graph, node.id), `${node.name}.svg`);
      return;
    }
    const blob = format === "png" ? await exportNodeAsPng(graph, node.id, scale) : await exportNodeAsJpg(graph, node.id, scale);
    await promptSaveExport(blob, `${node.name}@${scale}x.${format}`);
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

    <div style="grid-column: span 2; margin-top: 8px;">
      <strong>Fills</strong>
      {#each node.fills as fill, i}
        {#if fill.type === "solid"}
          <div style="display: flex; gap: 4px; align-items: center;">
            <input type="color" value={fill.color} on:input={(e) => setFillColor(i, (e.target as HTMLInputElement).value)} />
            <input type="range" min="0" max="1" step="0.01" value={fill.opacity} on:input={(e) => setFillOpacity(i, Number((e.target as HTMLInputElement).value))} />
            <button on:click={() => removeFill(i)}>✕</button>
          </div>
        {:else}
          <div>Gradient ({fill.stops.length} stops) <button on:click={() => removeFill(i)}>✕</button></div>
        {/if}
      {/each}
      <button on:click={addSolidFill}>+ Fill</button>
    </div>

    <div style="grid-column: span 2; margin-top: 8px;">
      <strong>Strokes</strong>
      {#each node.strokes as stroke, i}
        <div style="display: flex; gap: 4px; align-items: center;">
          <span>{stroke.color} / {stroke.width}px</span>
          <button on:click={() => removeStroke(i)}>✕</button>
        </div>
      {/each}
      <button on:click={addStroke}>+ Stroke</button>
    </div>

    <div style="grid-column: span 2; margin-top: 8px;">
      <strong>Effects</strong>
      {#each node.effects ?? [] as effect, i}
        <div style="display: flex; gap: 4px; align-items: center;">
          <span>{effect.type}</span>
          <button on:click={() => removeEffect(i)}>✕</button>
        </div>
      {/each}
      <button on:click={addShadow}>+ Drop Shadow</button>
    </div>

    <div style="grid-column: span 2; margin-top: 8px;">
      <strong>Export</strong>
      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
        <button on:click={() => exportAs("png", 1)}>PNG 1x</button>
        <button on:click={() => exportAs("png", 2)}>PNG 2x</button>
        <button on:click={() => exportAs("jpg", 1)}>JPG</button>
        <button on:click={() => exportAs("svg")}>SVG</button>
      </div>
    </div>

    {#if sameParentSelection}
      <div style="grid-column: span 2; margin-top: 8px;">
        <strong>Align / Distribute</strong>
        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
          <button on:click={() => applyAlign(alignLeft)}>Left</button>
          <button on:click={() => applyAlign(alignCenterHorizontal)}>Center H</button>
          <button on:click={() => applyAlign(alignRight)}>Right</button>
          <button on:click={() => applyAlign(alignTop)}>Top</button>
          <button on:click={() => applyAlign(alignMiddleVertical)}>Middle V</button>
          <button on:click={() => applyAlign(alignBottom)}>Bottom</button>
          <button on:click={() => applyAlign(distributeHorizontal)}>Distribute H</button>
          <button on:click={() => applyAlign(distributeVertical)}>Distribute V</button>
        </div>
      </div>
    {/if}
  </div>
{:else}
  <p style="padding: 8px; color: #888;">No selection</p>
{/if}

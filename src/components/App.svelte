<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import CanvasView from "./CanvasView.svelte";
  import LayersPanel from "./LayersPanel.svelte";
  import PropertyInspector from "./PropertyInspector.svelte";
  import Toolbar from "./Toolbar.svelte";
  import { createEditorStore } from "../lib/store/editorStore";
  import { toolManager, type ToolId } from "../lib/tools/toolManager";
  import { removeNode } from "../lib/scene/sceneGraph";
  import { groupNodes, ungroupNode } from "../lib/tools/grouping";
  import {
    saveProject, openProject, promptForNewProjectPath, promptForExistingProjectPath,
  } from "../lib/persistence/projectClient";

  const store = createEditorStore("Page 1");

  let projectPath: string | null = null;
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  async function handleNewProject() {
    const path = await promptForNewProjectPath();
    if (!path) return;
    projectPath = path;
    await invoke("create_project", { path, projectName: path.split("/").pop() ?? "Untitled" });
    await saveProject(path, store);
  }

  async function handleOpenProject() {
    const path = await promptForExistingProjectPath();
    if (!path) return;
    const pages = await openProject(path);
    if (pages.length > 0) {
      store.mutate(() => pages[0].graph);
      store.select([]);
    }
    projectPath = path;
  }

  function scheduleAutosave() {
    if (!projectPath) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => saveProject(projectPath!, store), 2000);
  }

  const KEY_TO_TOOL: Record<string, ToolId> = {
    v: "select", r: "rectangle", o: "ellipse", l: "line", p: "polygon", f: "frame", t: "text",
  };

  function handleGroup() {
    const selection = store.getSelection();
    if (selection.length < 2) return;
    const parentIds = new Set(selection.map((id) => store.getGraph().nodes[id].parentId));
    if (parentIds.size > 1) return; // Task 21's same-parent constraint applies here too
    let newGroupId = "";
    store.mutate((g) => {
      const { graph, groupId } = groupNodes(g, selection);
      newGroupId = groupId;
      return graph;
    });
    store.select([newGroupId]);
  }

  function handleUngroup() {
    const selection = store.getSelection();
    if (selection.length !== 1 || store.getGraph().nodes[selection[0]].kind !== "group") return;
    const groupId = selection[0];
    const childIds = store.getGraph().nodes[groupId].childIds;
    store.mutate((g) => ungroupNode(g, groupId));
    store.select(childIds);
  }

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
    if (mod && e.key.toLowerCase() === "g" && e.shiftKey) {
      e.preventDefault();
      handleUngroup();
      return;
    }
    if (mod && e.key.toLowerCase() === "g") {
      e.preventDefault();
      handleGroup();
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
    const unsubscribe = store.subscribe(() => scheduleAutosave());
    const handleBlur = () => { if (projectPath) saveProject(projectPath, store); };
    window.addEventListener("blur", handleBlur);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      unsubscribe();
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

<main style="display: flex; flex-direction: column; height: 100vh;">
  <Toolbar {store} onNew={handleNewProject} onOpen={handleOpenProject} onGroup={handleGroup} onUngroup={handleUngroup} />
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

import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { EditorStore } from "../store/editorStore";
import type { SceneGraph } from "../scene/types";

interface PageData {
  id: string;
  name: string;
  graph_json: string;
}

interface ProjectData {
  pages: PageData[];
}

const SINGLE_PAGE_ID = "page-1";

export async function saveProject(path: string, store: EditorStore): Promise<void> {
  const graph = store.getGraph();
  const data: ProjectData = {
    pages: [{ id: SINGLE_PAGE_ID, name: graph.nodes[graph.rootId].name, graph_json: JSON.stringify(graph) }],
  };
  await invoke("save_project", { path, data });
}

export async function openProject(path: string): Promise<{ id: string; name: string; graph: SceneGraph }[]> {
  const data = await invoke<ProjectData>("open_project", { path });
  return data.pages.map((p) => ({ id: p.id, name: p.name, graph: JSON.parse(p.graph_json) as SceneGraph }));
}

export async function promptForNewProjectPath(): Promise<string | null> {
  return await save({ filters: [{ name: "Cofora Project", extensions: ["cofora"] }] });
}

export async function promptForExistingProjectPath(): Promise<string | null> {
  const result = await open({ filters: [{ name: "Cofora Project", extensions: ["cofora"] }], multiple: false });
  return typeof result === "string" ? result : null;
}

export async function promptSaveExport(blobOrString: Blob | string, suggestedName: string): Promise<void> {
  const extension = suggestedName.split(".").pop() ?? "png";
  const path = await save({ defaultPath: suggestedName, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] });
  if (!path) return;
  if (typeof blobOrString === "string") {
    await writeTextFile(path, blobOrString);
  } else {
    await writeFile(path, new Uint8Array(await blobOrString.arrayBuffer()));
  }
}

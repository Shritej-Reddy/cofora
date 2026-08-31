import { writable } from "svelte/store";

export type ToolId = "select" | "rectangle" | "ellipse" | "line" | "polygon" | "frame" | "text";

function createToolManager() {
  const { subscribe, set } = writable<ToolId>("select");
  return { subscribe, setTool: (id: ToolId) => set(id) };
}

export const toolManager = createToolManager();

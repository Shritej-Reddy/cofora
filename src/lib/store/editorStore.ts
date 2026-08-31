import { writable, type Writable } from "svelte/store";
import type { SceneGraph } from "../scene/types";
import { createEmptyGraph } from "../scene/sceneGraph";
import { UndoStack } from "../history/undoStack";

export interface EditorState {
  graph: SceneGraph;
  selection: string[];
}

export interface EditorStore extends Pick<Writable<EditorState>, "subscribe"> {
  getGraph(): SceneGraph;
  getSelection(): string[];
  select(ids: string[]): void;
  mutate(fn: (graph: SceneGraph) => SceneGraph): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

export function createEditorStore(rootName: string): EditorStore {
  const initial: EditorState = { graph: createEmptyGraph(rootName), selection: [] };
  const store = writable<EditorState>(initial);
  const history = new UndoStack();
  let state = initial;
  store.subscribe((s) => { state = s; });

  return {
    subscribe: store.subscribe,
    getGraph: () => state.graph,
    getSelection: () => state.selection,
    select(ids) {
      store.update((s) => ({ ...s, selection: ids }));
    },
    mutate(fn) {
      history.push(state.graph);
      store.update((s) => ({ ...s, graph: fn(s.graph) }));
    },
    undo() {
      const restored = history.undo(state.graph);
      if (restored) {
        store.update((s) => ({
          ...s,
          graph: restored,
          selection: s.selection.filter((id) => id in restored.nodes),
        }));
      }
    },
    redo() {
      const restored = history.redo(state.graph);
      if (restored) {
        store.update((s) => ({
          ...s,
          graph: restored,
          selection: s.selection.filter((id) => id in restored.nodes),
        }));
      }
    },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
  };
}

import { describe, it, expect } from "vitest";
import { createEditorStore } from "./editorStore";
import { addNode } from "../scene/sceneGraph";
import type { SceneNode } from "../scene/types";

function rect(id: string, parentId: string): SceneNode {
  return {
    id, kind: "rectangle", name: "Rectangle", parentId, childIds: [],
    x: 0, y: 0, width: 10, height: 10, rotation: 0,
    visible: true, locked: false, fills: [], strokes: [],
  };
}

describe("editorStore", () => {
  it("starts with an empty graph and no selection", () => {
    const store = createEditorStore("Page 1");
    expect(Object.keys(store.getGraph().nodes).length).toBe(1); // just the root
    expect(store.getSelection()).toEqual([]);
  });

  it("select() updates the selection", () => {
    const store = createEditorStore("Page 1");
    store.select(["r1"]);
    expect(store.getSelection()).toEqual(["r1"]);
  });

  it("mutate() applies the change and records undo history", () => {
    const store = createEditorStore("Page 1");
    const rootId = store.getGraph().rootId;
    store.mutate((g) => addNode(g, rect("r1", rootId), rootId));
    expect(store.getGraph().nodes["r1"]).toBeDefined();
    expect(store.canUndo()).toBe(true);
  });

  it("undo() reverts the last mutate(), redo() re-applies it", () => {
    const store = createEditorStore("Page 1");
    const rootId = store.getGraph().rootId;
    store.mutate((g) => addNode(g, rect("r1", rootId), rootId));
    store.undo();
    expect(store.getGraph().nodes["r1"]).toBeUndefined();
    expect(store.canRedo()).toBe(true);
    store.redo();
    expect(store.getGraph().nodes["r1"]).toBeDefined();
  });

  it("subscribe() notifies on mutate/select/undo/redo", () => {
    const store = createEditorStore("Page 1");
    let notifications = 0;
    const unsubscribe = store.subscribe(() => { notifications++; });
    const initial = notifications;
    store.select(["x"]);
    expect(notifications).toBeGreaterThan(initial);
    unsubscribe();
  });
});

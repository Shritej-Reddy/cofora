import { describe, it, expect } from "vitest";
import { UndoStack } from "./undoStack";
import { createEmptyGraph, updateNode } from "../scene/sceneGraph";

describe("UndoStack", () => {
  it("reports no undo/redo available when empty", () => {
    const stack = new UndoStack();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });

  it("undo restores the snapshot taken before the most recent push", () => {
    const stack = new UndoStack();
    const g0 = createEmptyGraph("Page 1");
    stack.push(g0); // snapshot of state BEFORE the edit that produced g1
    const g1 = updateNode(g0, g0.rootId, { name: "Renamed" });

    const restored = stack.undo(g1);
    expect(restored?.nodes[g0.rootId].name).toBe("Page 1");
  });

  it("redo re-applies the state that was undone", () => {
    const stack = new UndoStack();
    const g0 = createEmptyGraph("Page 1");
    stack.push(g0);
    const g1 = updateNode(g0, g0.rootId, { name: "Renamed" });

    const afterUndo = stack.undo(g1)!;
    const afterRedo = stack.redo(afterUndo);
    expect(afterRedo?.nodes[g0.rootId].name).toBe("Renamed");
  });

  it("clears the redo stack when a new snapshot is pushed", () => {
    const stack = new UndoStack();
    const g0 = createEmptyGraph("Page 1");
    stack.push(g0);
    const g1 = updateNode(g0, g0.rootId, { name: "First" });
    stack.undo(g1);
    expect(stack.canRedo()).toBe(true);

    stack.push(g0);
    expect(stack.canRedo()).toBe(false);
  });

  it("caps history at the configured limit", () => {
    const stack = new UndoStack(2);
    let g = createEmptyGraph("Page 1");
    for (let i = 0; i < 5; i++) {
      stack.push(g);
      g = updateNode(g, g.rootId, { name: `Rev ${i}` });
    }
    let current = g;
    let undoCount = 0;
    while (stack.canUndo()) {
      current = stack.undo(current)!;
      undoCount++;
    }
    expect(undoCount).toBe(2);
  });
});

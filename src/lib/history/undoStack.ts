import type { SceneGraph } from "../scene/types";
import { cloneGraph } from "../scene/sceneGraph";

export class UndoStack {
  private past: SceneGraph[] = [];
  private future: SceneGraph[] = [];

  constructor(private readonly limit = 100) {}

  push(snapshot: SceneGraph): void {
    this.past.push(cloneGraph(snapshot));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(current: SceneGraph): SceneGraph | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(cloneGraph(current));
    return previous;
  }

  redo(current: SceneGraph): SceneGraph | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(cloneGraph(current));
    return next;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }
}

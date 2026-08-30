export interface Bounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function bbox(items: Bounds[]) {
  const minX = Math.min(...items.map((i) => i.x));
  const maxRight = Math.max(...items.map((i) => i.x + i.width));
  const minY = Math.min(...items.map((i) => i.y));
  const maxBottom = Math.max(...items.map((i) => i.y + i.height));
  return { minX, maxRight, minY, maxBottom };
}

export function alignLeft(items: Bounds[]): Map<string, { x: number }> {
  const { minX } = bbox(items);
  return new Map(items.map((i) => [i.id, { x: minX }]));
}

export function alignRight(items: Bounds[]): Map<string, { x: number }> {
  const { maxRight } = bbox(items);
  return new Map(items.map((i) => [i.id, { x: maxRight - i.width }]));
}

export function alignCenterHorizontal(items: Bounds[]): Map<string, { x: number }> {
  const { minX, maxRight } = bbox(items);
  const center = (minX + maxRight) / 2;
  return new Map(items.map((i) => [i.id, { x: center - i.width / 2 }]));
}

export function alignTop(items: Bounds[]): Map<string, { y: number }> {
  const { minY } = bbox(items);
  return new Map(items.map((i) => [i.id, { y: minY }]));
}

export function alignBottom(items: Bounds[]): Map<string, { y: number }> {
  const { maxBottom } = bbox(items);
  return new Map(items.map((i) => [i.id, { y: maxBottom - i.height }]));
}

export function alignMiddleVertical(items: Bounds[]): Map<string, { y: number }> {
  const { minY, maxBottom } = bbox(items);
  const center = (minY + maxBottom) / 2;
  return new Map(items.map((i) => [i.id, { y: center - i.height / 2 }]));
}

export function distributeHorizontal(items: Bounds[]): Map<string, { x: number }> {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const result = new Map<string, { x: number }>();
  if (sorted.length < 3) {
    for (const i of sorted) result.set(i.id, { x: i.x });
    return result;
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last.x + last.width - first.x;
  const widthSum = sorted.reduce((sum, i) => sum + i.width, 0);
  const gap = (span - widthSum) / (sorted.length - 1);
  result.set(first.id, { x: first.x });
  let cursor = first.x + first.width + gap;
  for (let idx = 1; idx < sorted.length - 1; idx++) {
    result.set(sorted[idx].id, { x: cursor });
    cursor += sorted[idx].width + gap;
  }
  result.set(last.id, { x: last.x });
  return result;
}

export function distributeVertical(items: Bounds[]): Map<string, { y: number }> {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const result = new Map<string, { y: number }>();
  if (sorted.length < 3) {
    for (const i of sorted) result.set(i.id, { y: i.y });
    return result;
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last.y + last.height - first.y;
  const heightSum = sorted.reduce((sum, i) => sum + i.height, 0);
  const gap = (span - heightSum) / (sorted.length - 1);
  result.set(first.id, { y: first.y });
  let cursor = first.y + first.height + gap;
  for (let idx = 1; idx < sorted.length - 1; idx++) {
    result.set(sorted[idx].id, { y: cursor });
    cursor += sorted[idx].height + gap;
  }
  result.set(last.id, { y: last.y });
  return result;
}

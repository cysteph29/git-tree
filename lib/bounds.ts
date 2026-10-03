export type Point = { x: number; y: number };
export type Bounds = { x: number; y: number; width: number; height: number };

export function boundsForPoints(points: Point[], padding = 0): Bounds {
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const x = Math.min(...xs) - padding, y = Math.min(...ys) - padding;
  return { x, y, width: Math.max(...xs) + padding - x, height: Math.max(...ys) + padding - y };
}

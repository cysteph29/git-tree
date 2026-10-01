export type Point = { x: number; y: number };
export type Bounds = { x: number; y: number; width: number; height: number };
export type HitBranch = { name: string; points: Point[]; filled: boolean; bounds?: Bounds };

export function boundsForPoints(points: Point[], padding = 0): Bounds {
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const x = Math.min(...xs) - padding, y = Math.min(...ys) - padding;
  return { x, y, width: Math.max(...xs) + padding - x, height: Math.max(...ys) + padding - y };
}

export function distanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

function inside(point: Point, polygon: Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

export function pickBranch(branches: HitBranch[], point: Point, pixelsPerUnit: number, pointer: "mouse" | "touch", current: string | null) {
  if (!(pixelsPerUnit > 0)) return null;
  const tolerance = pointer === "touch" ? 22 : 9;
  let best: { name: string; distance: number } | null = null;
  let currentDistance = Infinity;
  for (const branch of branches) {
    const reach = tolerance / pixelsPerUnit + (branch.filled ? 0 : 2);
    const bounds = branch.bounds;
    if (bounds && (point.x < bounds.x - reach || point.x > bounds.x + bounds.width + reach || point.y < bounds.y - reach || point.y > bounds.y + bounds.height + reach)) continue;
    let distance = branch.filled && inside(point, branch.points) ? 0 : Infinity;
    for (let i = 1; i < branch.points.length && distance > 0; i++) distance = Math.min(distance, distanceToSegment(point, branch.points[i - 1], branch.points[i]));
    // Include the ink's thickness in eligibility, but rank by the actual
    // centerline distance so nearby limbs don't all collapse into a zero tie.
    const screenDistance = distance * pixelsPerUnit;
    if (distance <= reach) {
      if (branch.name === current) currentDistance = screenDistance;
      if (!best || screenDistance < best.distance - 0.001 || (Math.abs(screenDistance - best.distance) <= 0.001 && branch.name < best.name)) best = { name: branch.name, distance: screenDistance };
    }
  }
  if (!best) return null;
  // Two screen pixels of hysteresis prevent flicker at intersections without
  // retaining a branch after the pointer leaves its targeting corridor.
  return current && currentDistance <= best.distance + 2 ? current : best.name;
}

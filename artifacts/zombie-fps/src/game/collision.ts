import { Obstacle } from "./World";

export interface AABB {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  minY: number; maxY: number;
}

export function obstacleAABB(o: Obstacle, pad = 0): AABB {
  const [x, y, z] = o.pos;
  const [sx, sy, sz] = o.size;
  return {
    minX: x - sx / 2 - pad,
    maxX: x + sx / 2 + pad,
    minY: y - sy / 2 - pad,
    maxY: y + sy / 2 + pad,
    minZ: z - sz / 2 - pad,
    maxZ: z + sz / 2 + pad,
  };
}

export function pointInAABB2D(px: number, pz: number, b: AABB) {
  return px > b.minX && px < b.maxX && pz > b.minZ && pz < b.maxZ;
}

// Slide collision: try X and Z separately so player slides along walls
export function resolveMove(
  curX: number, curZ: number,
  desX: number, desZ: number,
  radius: number,
  boxes: AABB[]
): { x: number; z: number } {
  let nx = desX;
  let nz = curZ;
  if (collidesXZ(nx, nz, radius, boxes)) nx = curX;
  let fz = desZ;
  if (collidesXZ(nx, fz, radius, boxes)) fz = curZ;
  return { x: nx, z: fz };
}

function collidesXZ(x: number, z: number, r: number, boxes: AABB[]) {
  for (const b of boxes) {
    if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) {
      return true;
    }
  }
  return false;
}

// Ray vs AABBs — returns t distance hit or Infinity
export function raycastAABBs(
  origin: [number, number, number],
  dir: [number, number, number],
  boxes: AABB[],
  maxDist: number
): number {
  let best = maxDist;
  for (const b of boxes) {
    const t = rayAABB(origin, dir, b, best);
    if (t < best) best = t;
  }
  return best;
}

function rayAABB(o: number[], d: number[], b: AABB, max: number): number {
  let tmin = -Infinity;
  let tmax = Infinity;
  const mins = [b.minX, b.minY, b.minZ];
  const maxs = [b.maxX, b.maxY, b.maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-6) {
      if (o[i] < mins[i] || o[i] > maxs[i]) return Infinity;
    } else {
      const inv = 1 / d[i];
      let t1 = (mins[i] - o[i]) * inv;
      let t2 = (maxs[i] - o[i]) * inv;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  if (tmin < 0) return Infinity;
  if (tmin > max) return Infinity;
  return tmin;
}

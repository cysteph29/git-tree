type StrokeTiming = { delay: number; duration: number };

export function drawingTiming(kind: "flowering" | "cactus", limbCount: number) {
  const trunk: StrokeTiming = { delay: 120, duration: kind === "cactus" ? 1000 : 900 };
  const trunkEnd = trunk.delay + trunk.duration;
  const detail: StrokeTiming = { delay: trunkEnd, duration: 400 };
  const crown: StrokeTiming = {
    delay: kind === "cactus" ? detail.delay + detail.duration : trunkEnd,
    duration: kind === "cactus" ? 250 : 220,
  };
  const spread = Math.min(2400, Math.max(0, limbCount - 1) * 180);
  const limbs = Array.from({ length: limbCount }, (_, index) => {
    const outline = {
      delay: crown.delay + crown.duration + (limbCount > 1 ? index / (limbCount - 1) * spread : 0),
      duration: 600,
    };
    return { outline, foliage: { delay: outline.delay + outline.duration, duration: 260 } };
  });
  return { trunk, detail, crown, ground: { delay: trunkEnd, duration: 260 }, limbs };
}

import { SpatialHash } from '@amk-utils/spatialhash';
import {
  CanvasParticle,
  clearCanvas,
  drawParticles,
  drawTargetBorder,
  particleColor,
  TargetRegion,
} from '../../../shared/canvas/canvas-drawing';

type Particle = CanvasParticle & {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  rngState: number;
  index: number;
  indexedMinCellX: number;
  indexedMaxCellX: number;
  indexedMinCellY: number;
  indexedMaxCellY: number;
};

type WorkerMessage =
  | { type: 'init'; canvas: OffscreenCanvas; seed: number; count: number }
  | { type: 'count'; count: number }
  | { type: 'run'; running: boolean };

type SimulationMode = 'brute-force' | 'spatial-hash';
type Stats = {
  type: 'stats';
  comparisons: number;
  inside: number;
  durationMs: number;
  particleCount: number;
};

const TARGET_CELL_SIZE = 100;
const PARTICLE_RADIUS = 5;
const CHUNK_SIZE = 2_000;
const TARGET_WIDTH_RATIO = 0.34;
const TARGET_HEIGHT_RATIO = 0.36;

export function startSimulation(mode: SimulationMode): void {
  let canvas: OffscreenCanvas | undefined;
  let context: OffscreenCanvasRenderingContext2D | null = null;
  let running = true;
  let busy = false;
  let random = Math.random;
  let workerSeed = 0;
  let pendingCount: number | undefined;
  const particles: Particle[] = [];
  const hash =
    mode === 'spatial-hash'
      ? new SpatialHash<Particle>({ cellSize: TARGET_CELL_SIZE, threshold: 0 })
      : undefined;

  function getCellBounds(particle: Particle) {
    return {
      minX: Math.floor(particle.x / TARGET_CELL_SIZE),
      maxX: Math.ceil((particle.x + particle.width) / TARGET_CELL_SIZE) - 1,
      minY: Math.floor(particle.y / TARGET_CELL_SIZE),
      maxY: Math.ceil((particle.y + particle.height) / TARGET_CELL_SIZE) - 1,
    };
  }

  function rememberCellBounds(particle: Particle): void {
    const bounds = getCellBounds(particle);
    particle.indexedMinCellX = bounds.minX;
    particle.indexedMaxCellX = bounds.maxX;
    particle.indexedMinCellY = bounds.minY;
    particle.indexedMaxCellY = bounds.maxY;
  }

  function nextParticleRandom(particle: Particle): number {
    particle.rngState = (particle.rngState * 1_664_525 + 1_013_904_223) >>> 0;
    return particle.rngState / 4_294_967_296;
  }

  function hasChangedCells(particle: Particle): boolean {
    const right = particle.x + particle.width;
    const bottom = particle.y + particle.height;
    const spansCellsX = particle.indexedMinCellX !== particle.indexedMaxCellX;
    const spansCellsY = particle.indexedMinCellY !== particle.indexedMaxCellY;
    const crossedX =
      particle.vx > 0
        ? spansCellsX
          ? particle.x >= (particle.indexedMinCellX + 1) * TARGET_CELL_SIZE
          : right > (particle.indexedMaxCellX + 1) * TARGET_CELL_SIZE
        : spansCellsX
          ? right <= particle.indexedMaxCellX * TARGET_CELL_SIZE
          : particle.x < particle.indexedMinCellX * TARGET_CELL_SIZE;
    const crossedY =
      particle.vy > 0
        ? spansCellsY
          ? particle.y >= (particle.indexedMinCellY + 1) * TARGET_CELL_SIZE
          : bottom > (particle.indexedMaxCellY + 1) * TARGET_CELL_SIZE
        : spansCellsY
          ? bottom <= particle.indexedMaxCellY * TARGET_CELL_SIZE
          : particle.y < particle.indexedMinCellY * TARGET_CELL_SIZE;
    const crossedCellBoundary = crossedX || crossedY;

    if (crossedCellBoundary) rememberCellBounds(particle);
    return crossedCellBoundary;
  }

  function setCount(count: number): void {
    if (!canvas) return;
    const target = Math.min(50_000, Math.max(100, Math.floor(count)));

    while (particles.length < target) {
      const index = particles.length;
      const maxX = Math.max(PARTICLE_RADIUS, canvas.width - PARTICLE_RADIUS);
      const maxY = Math.max(PARTICLE_RADIUS, canvas.height - PARTICLE_RADIUS);
      const cx = PARTICLE_RADIUS + random() * (maxX - PARTICLE_RADIUS);
      const cy = PARTICLE_RADIUS + random() * (maxY - PARTICLE_RADIUS);
      const particle: Particle = {
        x: cx - PARTICLE_RADIUS,
        y: cy - PARTICLE_RADIUS,
        cx,
        cy,
        width: PARTICLE_RADIUS * 2,
        height: PARTICLE_RADIUS * 2,
        radius: PARTICLE_RADIUS,
        color: particleColor(index),
        inTarget: false,
        vx: random() < 0.5 ? -1 : 1,
        vy: random() < 0.5 ? -1 : 1,
        rngState: (workerSeed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0,
        index,
        indexedMinCellX: 0,
        indexedMaxCellX: 0,
        indexedMinCellY: 0,
        indexedMaxCellY: 0,
      };
      rememberCellBounds(particle);
      particles.push(particle);
      hash?.add(particle.index, particle);
    }

    while (particles.length > target) {
      const particle = particles.pop();
      if (particle) hash?.remove(particle.index);
    }
  }

  function getTargetRegion(width: number, height: number): TargetRegion {
    const targetWidth = width * TARGET_WIDTH_RATIO;
    const targetHeight = height * TARGET_HEIGHT_RATIO;
    return {
      x: (width - targetWidth) / 2,
      y: (height - targetHeight) / 2,
      width: targetWidth,
      height: targetHeight,
    };
  }

  function intersectsTarget(particle: Particle, target: TargetRegion): boolean {
    return (
      particle.x < target.x + target.width &&
      particle.x + particle.width > target.x &&
      particle.y < target.y + target.height &&
      particle.y + particle.height > target.y
    );
  }

  async function yieldToWorkerMessages(): Promise<boolean> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return running;
  }

  async function tick(): Promise<void> {
    if (!canvas || !context || busy || !running) return;
    busy = true;

    const width = canvas.width;
    const height = canvas.height;
    const delta = 1;
    const frameParticles = particles.slice();
    const frameCount = frameParticles.length;

    for (const particle of frameParticles) {
      particle.cx += particle.vx * delta;
      particle.cy += particle.vy * delta;
      if (particle.cx < particle.radius || particle.cx > width - particle.radius) {
        particle.vx = nextParticleRandom(particle) < 0.5 ? -1 : 1;
        particle.cx = Math.max(particle.radius, Math.min(width - particle.radius, particle.cx));
      }
      if (particle.cy < particle.radius || particle.cy > height - particle.radius) {
        particle.vy = nextParticleRandom(particle) < 0.5 ? -1 : 1;
        particle.cy = Math.max(particle.radius, Math.min(height - particle.radius, particle.cy));
      }
      particle.x = particle.cx - particle.radius;
      particle.y = particle.cy - particle.radius;
      particle.inTarget = false;
      if (hash && hasChangedCells(particle)) hash.update(particle.index, particle);
    }

    const target = getTargetRegion(width, height);
    let comparisons = 0;
    let inside = 0;
    let durationMs = performance.now();
    if (mode === 'brute-force') {
      for (let index = 0; index < frameCount; index++) {
        const particle = frameParticles[index];
        comparisons++;
        if (intersectsTarget(particle, target)) {
          particle.inTarget = true;
          inside++;
        }

        if ((index + 1) % CHUNK_SIZE === 0) {
          if (!(await yieldToWorkerMessages())) {
            busy = false;
            applyPendingCount();
            return;
          }
        }
      }
    } else {
      if (!hash) {
        busy = false;
        return;
      }
      const query = hash.getItemsBetweenWithStats(target.x, target.y, target.width, target.height);
      comparisons = query.comparisons;
      inside = query.items.length;
      for (const particle of query.items) particle.inTarget = true;
    }
    durationMs = performance.now() - durationMs;
    clearCanvas(context, width, height);
    drawParticles(context, frameParticles);
    drawTargetBorder(context, target);

    const message: Stats = {
      type: 'stats',
      comparisons,
      inside,
      durationMs,
      particleCount: frameCount,
    };
    postMessage(message);
    busy = false;
    applyPendingCount();
    if (running) requestAnimationFrame(() => void tick());
  }

  function applyPendingCount(): void {
    if (pendingCount === undefined) return;
    setCount(pendingCount);
    pendingCount = undefined;
  }

  onmessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;
    if (message.type === 'init') {
      canvas = message.canvas;
      context = canvas.getContext('2d');
      workerSeed = message.seed >>> 0;
      let seed = workerSeed;
      random = () => {
        seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
        return seed / 4_294_967_296;
      };
      setCount(message.count);
      requestAnimationFrame(() => void tick());
    } else if (message.type === 'count') {
      if (busy) pendingCount = message.count;
      else setCount(message.count);
    } else if (message.type === 'run') {
      running = message.running;
      if (running && !busy) requestAnimationFrame(() => void tick());
    }
  };
}

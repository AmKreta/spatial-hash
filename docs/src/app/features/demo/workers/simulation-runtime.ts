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
  index: number;
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
  let lastTime = 0;
  let random = Math.random;
  const particles: Particle[] = [];

  function setCount(count: number): void {
    if (!canvas) return;
    const target = Math.min(50_000, Math.max(100, Math.floor(count)));

    while (particles.length < target) {
      const index = particles.length;
      const maxX = Math.max(PARTICLE_RADIUS, canvas.width - PARTICLE_RADIUS);
      const maxY = Math.max(PARTICLE_RADIUS, canvas.height - PARTICLE_RADIUS);
      const cx = PARTICLE_RADIUS + random() * (maxX - PARTICLE_RADIUS);
      const cy = PARTICLE_RADIUS + random() * (maxY - PARTICLE_RADIUS);
      particles.push({
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
        index,
      });
    }

    particles.length = target;
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

  async function tick(time: number): Promise<void> {
    if (!canvas || !context || busy || !running) return;
    busy = true;

    const width = canvas.width;
    const height = canvas.height;
    const elapsed = lastTime ? (time - lastTime) / 16.67 : 1;
    const delta = Math.min(2, elapsed);
    lastTime = time;
    const frameParticles = particles.slice();
    const frameCount = frameParticles.length;

    for (const particle of frameParticles) {
      particle.cx += particle.vx * delta;
      particle.cy += particle.vy * delta;
      if (particle.cx < particle.radius || particle.cx > width - particle.radius) {
        particle.vx = random() < 0.5 ? -1 : 1;
        particle.cx = Math.max(particle.radius, Math.min(width - particle.radius, particle.cx));
      }
      if (particle.cy < particle.radius || particle.cy > height - particle.radius) {
        particle.vy = random() < 0.5 ? -1 : 1;
        particle.cy = Math.max(particle.radius, Math.min(height - particle.radius, particle.cy));
      }
      particle.x = particle.cx - particle.radius;
      particle.y = particle.cy - particle.radius;
      particle.inTarget = false;
    }

    const target = getTargetRegion(width, height);
    let comparisons = 0;
    let inside = 0;
    let durationMs = 0;

    if (mode === 'brute-force') {
      let segmentStartedAt = performance.now();
      for (let index = 0; index < frameCount; index++) {
        const particle = frameParticles[index];
        comparisons++;
        if (intersectsTarget(particle, target)) {
          particle.inTarget = true;
          inside++;
        }

        if ((index + 1) % CHUNK_SIZE === 0) {
          durationMs += performance.now() - segmentStartedAt;
          if (!(await yieldToWorkerMessages())) {
            busy = false;
            return;
          }
          segmentStartedAt = performance.now();
        }
      }
      durationMs += performance.now() - segmentStartedAt;
    } else {
      let segmentStartedAt = performance.now();
      const hash = new SpatialHash<Particle>({ cellSize: TARGET_CELL_SIZE, threshold: 0 });
      for (let index = 0; index < frameCount; index++) {
        const particle = frameParticles[index];
        hash.add(particle.index, particle);

        if ((index + 1) % CHUNK_SIZE === 0) {
          durationMs += performance.now() - segmentStartedAt;
          if (!(await yieldToWorkerMessages())) {
            busy = false;
            return;
          }
          segmentStartedAt = performance.now();
        }
      }

      durationMs += performance.now() - segmentStartedAt;
      const queryStartedAt = performance.now();
      const query = hash.getItemsBetweenWithStats(target.x, target.y, target.width, target.height);
      durationMs += performance.now() - queryStartedAt;
      comparisons = query.comparisons;
      inside = query.items.length;
      for (const particle of query.items) particle.inTarget = true;
    }

    clearCanvas(context, width, height);
    drawParticles(context, frameParticles);
    drawTargetBorder(context, target);

    const message: Stats = { type: 'stats', comparisons, inside, durationMs };
    postMessage(message);
    busy = false;
    if (running) requestAnimationFrame((nextTime) => void tick(nextTime));
  }

  onmessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;
    if (message.type === 'init') {
      canvas = message.canvas;
      context = canvas.getContext('2d');
      let seed = message.seed >>> 0;
      random = () => {
        seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
        return seed / 4_294_967_296;
      };
      setCount(message.count);
      requestAnimationFrame((time) => void tick(time));
    } else if (message.type === 'count') {
      setCount(message.count);
    } else if (message.type === 'run') {
      running = message.running;
      if (running && !busy) requestAnimationFrame((time) => void tick(time));
    }
  };
}

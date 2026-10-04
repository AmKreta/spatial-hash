import { SpatialHash } from '@amk-utils/spatialhash';
import {
  CanvasParticle,
  clearCanvas,
  drawConnections,
  drawParticles,
  particleColor,
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
type Stats = { type: 'stats'; checks: number; hits: number; total: number };

const LINK_DISTANCE = 100;
const LINK_DISTANCE_SQUARED = LINK_DISTANCE * LINK_DISTANCE;
const COLLISION_RADIUS = 5;
const CHUNK_SIZE = 250_000;
const CONNECTION_BATCH_SIZE = 8_192;
const PROGRESS_INTERVAL = 10_000_000;

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
      const cx = random() * canvas.width;
      const cy = random() * canvas.height;
      particles.push({
        x: cx - COLLISION_RADIUS,
        y: cy - COLLISION_RADIUS,
        cx,
        cy,
        width: COLLISION_RADIUS * 2,
        height: COLLISION_RADIUS * 2,
        radius: COLLISION_RADIUS,
        color: particleColor(index),
        vx: random() < 0.5 ? -1 : 1,
        vy: random() < 0.5 ? -1 : 1,
        index,
      });
    }

    particles.length = target;
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
    }

    clearCanvas(context, width, height);
    let checks = 0;
    let hits = 0;
    let pendingConnections = 0;
    let workSinceYield = 0;
    let lastReportedChecks = 0;
    const connectionCoordinates = new Float32Array(CONNECTION_BATCH_SIZE * 4);

    const flushConnections = (): void => {
      drawConnections(context!, connectionCoordinates, pendingConnections);
      pendingConnections = 0;
    };

    const hash =
      mode === 'spatial-hash'
        ? new SpatialHash<Particle>({ cellSize: LINK_DISTANCE, threshold: 0 })
        : undefined;
    if (hash) {
      for (const particle of frameParticles) hash.add(particle.index, particle);
    }

    for (let firstIndex = 0; firstIndex < frameCount; firstIndex++) {
      const first = frameParticles[firstIndex];
      const candidates = hash
        ? hash
            .getItemsBetween(
              first.cx - LINK_DISTANCE,
              first.cy - LINK_DISTANCE,
              LINK_DISTANCE * 2,
              LINK_DISTANCE * 2,
            )
            .filter((candidate) => candidate.index > firstIndex)
            .sort((left, right) => left.index - right.index)
        : frameParticles.slice(firstIndex + 1);

      for (const second of candidates) {
        const dx = second.cx - first.cx;
        const dy = second.cy - first.cy;
        const distanceSquared = dx * dx + dy * dy;
        checks++;

        if (distanceSquared < LINK_DISTANCE_SQUARED) {
          const offset = pendingConnections * 4;
          connectionCoordinates[offset] = first.cx;
          connectionCoordinates[offset + 1] = first.cy;
          connectionCoordinates[offset + 2] = second.cx;
          connectionCoordinates[offset + 3] = second.cy;
          pendingConnections++;
          if (pendingConnections === CONNECTION_BATCH_SIZE) flushConnections();
        }

        const collisionDistance = first.radius + second.radius;
        if (distanceSquared < collisionDistance * collisionDistance) {
          hits++;
          first.vx = random() < 0.5 ? -1 : 1;
          first.vy = random() < 0.5 ? -1 : 1;
          second.vx = random() < 0.5 ? -1 : 1;
          second.vy = random() < 0.5 ? -1 : 1;
        }

        workSinceYield++;
        if (workSinceYield >= CHUNK_SIZE) {
          flushConnections();
          workSinceYield = 0;
          if (checks - lastReportedChecks >= PROGRESS_INTERVAL) {
            postMessage({ type: 'stats', checks, hits, total: frameCount });
            lastReportedChecks = checks;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          if (!running) {
            busy = false;
            return;
          }
        }
      }
    }

    flushConnections();
    drawParticles(context, frameParticles);
    const message: Stats = { type: 'stats', checks, hits, total: frameCount };
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

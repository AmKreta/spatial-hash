export type CanvasParticle = {
  cx: number;
  cy: number;
  radius: number;
  color: string;
};

const BACKGROUND = '#101212';
const LINK_COLOR = 'rgba(197, 243, 106, 0.2)';
const PARTICLE_COLORS = ['#c5f36a', '#78e3cb', '#ffa779', '#ae9bff', '#f6d36b'];

export function particleColor(index: number): string {
  return PARTICLE_COLORS[index % PARTICLE_COLORS.length];
}

export function clearCanvas(
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, width, height);
}

export function drawConnections(
  context: OffscreenCanvasRenderingContext2D,
  coordinates: Float32Array,
  count: number,
): void {
  if (count === 0) return;

  context.beginPath();
  for (let index = 0; index < count; index++) {
    const offset = index * 4;
    context.moveTo(coordinates[offset], coordinates[offset + 1]);
    context.lineTo(coordinates[offset + 2], coordinates[offset + 3]);
  }
  context.strokeStyle = LINK_COLOR;
  context.lineWidth = 0.6;
  context.stroke();
}

export function drawParticles(
  context: OffscreenCanvasRenderingContext2D,
  particles: readonly CanvasParticle[],
): void {
  for (const particle of particles) {
    context.beginPath();
    context.arc(particle.cx, particle.cy, particle.radius, 0, Math.PI * 2);
    context.fillStyle = particle.color;
    context.fill();
  }
}

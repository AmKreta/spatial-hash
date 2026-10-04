export type CanvasParticle = {
  cx: number;
  cy: number;
  radius: number;
  color: string;
  inTarget: boolean;
};

export type TargetRegion = { x: number; y: number; width: number; height: number };

const BACKGROUND = '#101212';
const TARGET_COLOR = '#fff36a';
const PARTICLE_COLORS = ['#667442', '#4a6961', '#795f4d', '#645a7c', '#786c46'];

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

export function drawTargetBorder(
  context: OffscreenCanvasRenderingContext2D,
  target: TargetRegion,
): void {
  context.save();
  context.beginPath();
  context.rect(target.x, target.y, target.width, target.height);
  context.setLineDash([2, 5]);
  context.lineCap = 'round';
  context.strokeStyle = TARGET_COLOR;
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
}

export function drawParticles(
  context: OffscreenCanvasRenderingContext2D,
  particles: readonly CanvasParticle[],
): void {
  for (const particle of particles) {
    context.beginPath();
    context.arc(particle.cx, particle.cy, particle.radius, 0, Math.PI * 2);
    context.globalAlpha = particle.inTarget ? 1 : 0.55;
    context.fillStyle = particle.inTarget ? TARGET_COLOR : particle.color;
    context.fill();
  }
  context.globalAlpha = 1;
}

export type CanvasParticle = {
  cx: number;
  cy: number;
  radius: number;
  color: string;
  inTarget: boolean;
};

export type TargetRegion = { x: number; y: number; width: number; height: number };

const BACKGROUND = '#101212';
const TARGET_BORDER_COLOR = '#6df7d2';
const PARTICLE_COLORS = ['#667442', '#4a6961', '#795f4d', '#645a7c', '#786c46'];
const BRIGHT_PARTICLE_COLORS = new Map<string, string>();

function brightenParticleColor(color: string): string {
  const cached = BRIGHT_PARTICLE_COLORS.get(color);
  if (cached) return cached;

  const red = Number.parseInt(color.slice(1, 3), 16) / 255;
  const green = Number.parseInt(color.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(color.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }

  const brightColor = `hsl(${Math.round(hue)} ${Math.round(saturation * 100)}% 70%)`;
  BRIGHT_PARTICLE_COLORS.set(color, brightColor);
  return brightColor;
}

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
  context.strokeStyle = TARGET_BORDER_COLOR;
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
    context.fillStyle = particle.inTarget ? brightenParticleColor(particle.color) : particle.color;
    context.fill();
  }
  context.globalAlpha = 1;
}

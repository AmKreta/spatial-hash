export function cantorPairing(x: number, y: number) {
  return x >= y ? x * x + x + y : x + y * y;
}

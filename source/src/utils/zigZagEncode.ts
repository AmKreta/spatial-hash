export function zigZagEncode(x: number) {
  return x >= 0 ? x * 2 : -x * 2 - 1;
}

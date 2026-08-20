export const RESERVED_SEGMENTS: readonly string[] = ["__proto__", "prototype", "constructor"];

export function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

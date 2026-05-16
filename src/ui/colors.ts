// Tiny ANSI helpers. Avoids pulling in chalk for ~10 codes.
// No-color via NO_COLOR env (https://no-color.org/) or non-TTY stdout.

const enabled =
  process.stdout.isTTY === true &&
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== "dumb";

function wrap(code: string, s: string): string {
  if (!enabled) return s;
  return `\x1b[${code}m${s}\x1b[0m`;
}

export const c = {
  bold: (s: string) => wrap("1", s),
  dim: (s: string) => wrap("2", s),
  red: (s: string) => wrap("31", s),
  green: (s: string) => wrap("32", s),
  yellow: (s: string) => wrap("33", s),
  blue: (s: string) => wrap("34", s),
  magenta: (s: string) => wrap("35", s),
  cyan: (s: string) => wrap("36", s),
  gray: (s: string) => wrap("90", s),
};

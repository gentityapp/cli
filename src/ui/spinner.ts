// Minimal progress indicator for long-running ops like `compute create`.
// Uses braille dots rotated on a 100ms tick. Auto-disables when not a TTY
// (CI logs stay clean) — prints plain "::" prefixed lines on each label
// change instead.

import { c } from "./colors";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private label: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private readonly tty: boolean;
  private lastPrinted = "";

  constructor(initialLabel = "") {
    this.label = initialLabel;
    this.tty = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
  }

  start(label?: string) {
    if (label !== undefined) this.label = label;
    if (!this.tty) {
      this.printLine();
      return;
    }
    this.render();
    this.timer = setInterval(() => this.render(), 100);
  }

  update(label: string) {
    if (label === this.label) return;
    this.label = label;
    if (!this.tty) this.printLine();
  }

  succeed(label: string) {
    this.stopAndPrint(c.green("✓"), label);
  }

  fail(label: string) {
    this.stopAndPrint(c.red("✗"), label);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.tty) {
      this.clearLine();
    }
  }

  private render() {
    if (!this.tty) return;
    this.frame = (this.frame + 1) % FRAMES.length;
    const line = `${c.cyan(FRAMES[this.frame] ?? "")} ${this.label}`;
    this.clearLine();
    process.stdout.write(line);
    this.lastPrinted = line;
  }

  private clearLine() {
    process.stdout.write("\r\x1b[2K");
  }

  private printLine() {
    // Non-TTY mode: print every label change on its own line, no animation.
    process.stdout.write(`:: ${this.label}\n`);
  }

  private stopAndPrint(symbol: string, label: string) {
    this.stop();
    process.stdout.write(`${symbol} ${label}\n`);
  }
}

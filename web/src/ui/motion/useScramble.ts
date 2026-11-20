import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!;

/** Deterministic base64url-looking noise, so a sealed secret always looks the same. */
export function noise(seed: string, length: number): string {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let out = "";
  for (let i = 0; i < length; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ i;
    out += GLYPHS[(h >>> 0) % GLYPHS.length];
  }
  return out;
}

/**
 * Morphs `from` into `to`, one character at a time, through random glyphs:
 * the visual of encrypting or decrypting. Runs whenever `run` changes to a
 * truthy value, then calls `onDone`. Instant under reduced motion.
 */
export function useScramble(from: string, to: string, run: unknown, onDone?: () => void, duration = 1100) {
  const [text, setText] = useState(from);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!run) {
      setText(from);
      return;
    }
    if (reducedMotion()) {
      setText(to);
      done.current?.();
      return;
    }
    // Each position settles at its own moment, sweeping left to right with jitter.
    const length = Math.max(from.length, to.length);
    const settle = Array.from({ length }, (_, i) => (i / length) * 0.75 + Math.random() * 0.25);
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      let out = "";
      for (let i = 0; i < length; i++) {
        const target = to[i] ?? "";
        const source = from[i] ?? "";
        const settled = p >= settle[i]!;
        if (settled) out += target;
        else if (p < settle[i]! * 0.35) out += source === "\n" ? "\n" : source || "";
        else out += target === "\n" || source === "\n" ? "\n" : randomGlyph();
      }
      setText(out);
      if (p < 1) frame = requestAnimationFrame(tick);
      else done.current?.();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `from` and `to` are read when a run starts; a new run needs a new `run` value.
  }, [run]);

  return text;
}

/** Bounded URI-safe LZ-string decoder, compatible with lz-string 1.5 (MIT,
 * Copyright (c) 2013 Pieroxy). Algorithm adapted with output/dictionary limits. */
export function boundedDecompress(input: string, limit: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  input = input.replace(/ /g, "+");
  let index = 0, position = 32, value = alphabet.indexOf(input[0]), steps = 0;
  const bits = (n: number) => { let out = 0; for (let i = 0; i < n; i++) { if (++steps > input.length * 6 + 32) throw new Error("Truncated share link."); out += (value & position ? 1 : 0) * 2 ** i; position >>= 1; if (!position) { position = 32; value = alphabet.indexOf(input[++index]); } } return out; };
  const first = bits(2); if (first === 2) return ""; if (first > 2) throw new Error("Invalid share link.");
  let w = String.fromCharCode(bits(first === 0 ? 8 : 16));
  const dict: string[] = ["", "", "", w], result = [w];
  let size = 4, enlarge = 4, width = 3, total = w.length, memory = w.length;
  const add = (s: string) => { memory += s.length; if (memory > limit * 24 || dict.length > limit) throw new Error("Share link exceeds safe complexity limits. Ask for JSON instead."); dict[size++] = s; };
  while (index <= input.length) {
    let code = bits(width);
    if (code === 2) return result.join("");
    if (code === 0 || code === 1) { add(String.fromCharCode(bits(code === 0 ? 8 : 16))); code = size - 1; enlarge--; }
    if (!enlarge) { enlarge = 2 ** width; width++; }
    const entry = dict[code] || (code === size ? w + w[0] : "");
    if (!entry) throw new Error("Invalid share link.");
    total += entry.length; if (total > limit) throw new Error("Share link expands beyond 750 KB. Ask for a smaller export.");
    result.push(entry); add(w + entry[0]); enlarge--; w = entry;
    if (!enlarge) { enlarge = 2 ** width; width++; }
  }
  throw new Error("Truncated share link.");
}

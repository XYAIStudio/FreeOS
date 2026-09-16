/** Map Unicode code points that CP1252 uses for bytes 0x80–0x9F back to those bytes. */
const CP1252_REVERSE: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function cp1252Byte(code: number): number | null {
  if (code <= 0xff) return code;
  return CP1252_REVERSE[code] ?? null;
}

/**
 * Repair UTF-8 text that a Windows bridge exposed as Latin-1 / CP1252.
 * Example: ``é¡¹ç®ç»æ.png`` → ``项目结构.png``.
 */
export function repairUtf8Mojibake(text: string): string {
  if (!text) return text;
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const mapped = cp1252Byte(text.charCodeAt(i));
    if (mapped === null) return text;
    bytes[i] = mapped;
  }
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded || text;
  } catch {
    return text;
  }
}

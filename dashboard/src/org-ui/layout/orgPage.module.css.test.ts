import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const pagesRoot = path.join(here, "..", "pages");

function walkCss(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkCss(full);
    return entry.name.endsWith(".module.css") ? [full] : [];
  });
}

describe("org-ui page layout", () => {
  it("keeps the shared page shell full-bleed", () => {
    const css = readFileSync(path.join(here, "orgPage.module.css"), "utf8");
    expect(css).toMatch(/width:\s*100%/);
    expect(css).toMatch(/max-width:\s*none/);
    expect(css).not.toMatch(/max-width:\s*\d+px/);
    expect(css).not.toMatch(/margin:\s*0\s+auto/);
  });

  it("does not re-impose a centered max-width column on page wrappers", () => {
    const files = walkCss(pagesRoot);
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const css = readFileSync(file, "utf8");
      const pageBlock = css.match(/\.page\s*\{[^}]*\}/);
      expect(pageBlock, file).toBeTruthy();
      const block = pageBlock?.[0] ?? "";
      expect(block, file).not.toMatch(/max-width:\s*\d+px/);
      expect(block, file).not.toMatch(/margin:\s*0\s+auto/);
    }
  });
});

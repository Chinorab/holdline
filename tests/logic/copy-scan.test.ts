import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allCopy } from '../../src/copy';

// Dash and hyphen like characters: hyphen minus, hyphen, non breaking hyphen, figure dash,
// en dash, em dash, horizontal bar, minus sign, small and full width hyphen minus.
const DASHES = /[-‐‑‒–—―−﹣－]/u;
const EMOJI = /\p{Extended_Pictographic}/u;
const AI_WORD = /\b(AI|A\.I\.|artificial intelligence|machine learning|LLM|GPT)\b/i;

describe('copy rules', () => {
  const strings = allCopy();

  it('has strings to check', () => {
    expect(strings.length).toBeGreaterThan(40);
  });

  it.each(strings)('$key has no dash, emoji or AI mention', ({ text }) => {
    expect(text).not.toMatch(DASHES);
    expect(text).not.toMatch(EMOJI);
    expect(text).not.toMatch(AI_WORD);
  });

  it('keeps instructions at 4 words or fewer', () => {
    for (const s of strings.filter((x) => x.instruction)) {
      expect(s.text.split(/\s+/u).length, s.key).toBeLessThanOrEqual(4);
    }
  });

  it('keeps the web pages clean', () => {
    const root = join(__dirname, '..', '..');
    for (const file of ['index.html', 'privacy.html']) {
      const source = readFileSync(join(root, file), 'utf8');
      const body = source.replace(/<style>[\s\S]*?<\/style>/gu, '').replace(/<script[\s\S]*?<\/script>/gu, '');
      const texts = [...body.matchAll(/>([^<>]+)</gu)].map((m) => m[1].trim()).filter(Boolean);
      const alts = [...body.matchAll(/(?:alt="|name="description" content=")([^"]+)"/gu)].map((m) => m[1]);
      for (const t of [...texts, ...alts]) {
        expect(t, `${file}: ${t}`).not.toMatch(DASHES);
        expect(t, `${file}: ${t}`).not.toMatch(EMOJI);
        expect(t, `${file}: ${t}`).not.toMatch(AI_WORD);
      }
    }
  });

  it('keeps UIKitML panel text clean', () => {
    const dir = join(__dirname, '..', '..', 'public', 'ui');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.uikitml'))) {
      const source = readFileSync(join(dir, file), 'utf8');
      // Visible text sits between tags; style blocks and attributes are not shown.
      const body = source.replace(/<style>[\s\S]*?<\/style>/gu, '').replace(/<!--[\s\S]*?-->/gu, '');
      const texts = [...body.matchAll(/>([^<>]+)</gu)].map((m) => m[1].trim()).filter(Boolean);
      for (const t of texts) {
        expect(t, `${file}: ${t}`).not.toMatch(DASHES);
        expect(t, `${file}: ${t}`).not.toMatch(EMOJI);
        expect(t, `${file}: ${t}`).not.toMatch(AI_WORD);
      }
    }
  });
});

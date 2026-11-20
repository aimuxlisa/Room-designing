import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrast, themeTokens } from '../../src/ui/themeTokens';

const css = readFileSync(new URL('../../src/ui/theme.css', import.meta.url), 'utf8');

describe('тема (D-13)', () => {
  const backgrounds = [themeTokens.bg, themeTokens.surface, themeTokens.surface2];
  const texts = [themeTokens.text, themeTokens.textMuted, themeTokens.accent, themeTokens.danger, themeTokens.success];

  for (const bg of backgrounds)
    for (const fg of texts)
      it(`контраст ${fg} на ${bg} не ниже 4,5:1`, () => {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });

  it('текст на акцентной кнопке не ниже 4,5:1', () => {
    expect(contrast(themeTokens.accentText, themeTokens.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('значения в theme.css совпадают с themeTokens', () => {
    for (const v of Object.values(themeTokens)) expect(css).toContain(v);
  });
});

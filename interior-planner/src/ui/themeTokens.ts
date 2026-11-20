/** Значения переменных темы для проверки контраста; должны совпадать с theme.css. */
export const themeTokens = {
  bg: '#0f1114',
  surface: '#171a1f',
  surface2: '#1f232a',
  text: '#e6e9ee',
  textMuted: '#9aa3af',
  accent: '#6aa8ff',
  accentText: '#0b0d10',
  danger: '#ff6b6b',
  success: '#4ade80',
} as const;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

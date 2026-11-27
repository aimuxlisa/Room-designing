/**
 * Отсутствие 3D (18.5, SPEC §12): без WebGL 2 или при ошибке создания контекста 3D-вид заменяется понятным
 * сообщением; план, каталог, отделка и проект продолжают работать.
 */
import { Component, type ReactNode } from 'react';

let cached: boolean | null = null;

/** Есть ли WebGL 2 (three 0.187 работает только на нём). Проверяется один раз. */
export function webglAvailable(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    cached = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

export function SceneUnavailable({ reason }: { reason?: string }) {
  return (
    <div className="scene-unavailable" role="alert" data-testid="scene-unavailable">
      <h2>3D-вид недоступен</h2>
      <p>
        Браузер не смог включить WebGL 2{reason ? ` (${reason})` : ''}. План, каталог, отделка и проект работают: расставляйте мебель на
        плане.
      </p>
      <p className="muted">
        Чтобы вернуть 3D: включите аппаратное ускорение в настройках Chrome или Edge («Система» → «Использовать графическое ускорение»),
        обновите драйвер видеокарты и перезапустите браузер.
      </p>
    </div>
  );
}

/** Ошибка создания контекста или рендера 3D не роняет приложение. */
export class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    return this.state.error ? <SceneUnavailable reason="ошибка создания 3D-контекста" /> : this.props.children;
  }
}

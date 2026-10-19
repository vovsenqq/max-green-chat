import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Never log objects which might contain credentials or request URLs.
  }
  reset = () => {
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith('max-green-chat:')) sessionStorage.removeItem(key);
      }
    } catch { /* Reload still allows the login screen to render. */ }
    window.location.reload();
  };
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="error-screen"><AlertCircle size={40} /><h1>Не удалось открыть чат</h1>
      <p>Обновите страницу. Если проблема связана с историей, начните новую сессию и разрешите хранение данных в браузере.</p>
      <button className="primary-button" onClick={() => window.location.reload()}>Обновить страницу</button>
      <button className="text-button" onClick={this.reset}>Очистить историю этой вкладки и начать заново</button>
    </main>;
  }
}

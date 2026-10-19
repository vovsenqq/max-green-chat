import { useState } from 'react';
import type { Session } from './types';
import { ChatWorkspace } from './components/ChatWorkspace';
import { LoginForm } from './components/LoginForm';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  return session ? <ChatWorkspace session={session} onLogout={() => setSession(null)} /> : <LoginForm onConnect={setSession} />;
}

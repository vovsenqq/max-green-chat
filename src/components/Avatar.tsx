import { initials } from '../lib/format';

export function Avatar({ name, id, small = false }: { name: string; id: string; small?: boolean }) {
  const color = [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 5;
  return <span className={`avatar avatar--${color} ${small ? 'avatar--small' : ''}`} aria-hidden="true">{initials(name)}</span>;
}

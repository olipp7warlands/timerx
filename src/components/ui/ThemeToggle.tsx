'use client';

import { IconTema } from './icons';

export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar tema"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-ink-secondary shadow-[var(--sombra)]"
    >
      <IconTema />
    </button>
  );
}

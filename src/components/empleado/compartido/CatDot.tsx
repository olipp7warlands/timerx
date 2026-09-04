import { colorCategoria } from '@/lib/horas/categorias';

export function CatDot({ categoria }: { categoria: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: colorCategoria(categoria) }}
      aria-hidden="true"
    />
  );
}

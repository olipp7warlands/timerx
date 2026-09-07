'use client';

import { useState } from 'react';
import { useCategorias } from '@/hooks/admin/useCategorias';
import { useToast } from '@/components/empleado/compartido/Toast';
import type { AdminInfo } from '../types';

const CAT_COLOR: Record<string, string> = {
  Desarrollo: 'var(--cat-desarrollo)',
  Diseño: 'var(--cat-diseno)',
  Abogados: 'var(--cat-abogados)',
  Gestión: 'var(--cat-gestion)',
};

export function CategoriasEscritorio({ info }: { info: AdminInfo }) {
  const { categorias, crearCategoria, crearSubcategoria } = useCategorias();
  const toast = useToast();
  const esAdminGrupo = info.rol === 'admin_grupo';

  const [nombreCat, setNombreCat] = useState('');
  const [catId, setCatId] = useState('');
  const [nombreSub, setNombreSub] = useState('');

  async function onCrearCategoria() {
    if (!nombreCat) return;
    const { error } = await crearCategoria(nombreCat);
    if (error) toast(error, 'error');
    else {
      toast(`Categoría "${nombreCat}" creada`);
      setNombreCat('');
    }
  }

  async function onCrearSubcategoria() {
    if (!catId || !nombreSub) return;
    const { error } = await crearSubcategoria(catId, nombreSub);
    if (error) toast(error, 'error');
    else {
      toast(`Subcategoría "${nombreSub}" creada`);
      setNombreSub('');
    }
  }

  return (
    <div className="split grid grid-cols-[300px_minmax(0,1fr)] items-start gap-4.5 max-[920px]:grid-cols-1">
      {esAdminGrupo && (
        <div className="stack space-y-4">
          <div className="card">
            <div className="card-head">
              <h2 className="text-sm font-extrabold">Crear categoría</h2>
            </div>
            <div className="card-body">
              <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Nombre</label>
              <input className="input" value={nombreCat} onChange={(e) => setNombreCat(e.target.value)} placeholder="Desarrollo" />
              <button type="button" className="btn full" onClick={onCrearCategoria}>
                Crear categoría
              </button>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2 className="text-sm font-extrabold">Crear subcategoría</h2>
            </div>
            <div className="card-body">
              <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Categoría</label>
              <select className="input" value={catId} onChange={(e) => setCatId(e.target.value)}>
                <option value="">Selecciona categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Nombre</label>
              <input className="input" value={nombreSub} onChange={(e) => setNombreSub(e.target.value)} placeholder="Contratos" />
              <button type="button" className="btn btn-primary full" onClick={onCrearSubcategoria}>
                Crear subcategoría
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Catálogo</h2>
        </div>
        <div className="card-body">
          {categorias.map((c) => (
            <div key={c.id} className="mb-3 rounded-2xl border border-border p-3.5 last:mb-0">
              <div className="flex items-center justify-between gap-2.5">
                <h3 className="flex items-center text-[14.5px] font-extrabold">
                  <span className="mr-2 inline-block h-[7px] w-[7px] rounded-full" style={{ background: CAT_COLOR[c.nombre] ?? 'var(--ink-disabled)' }} />
                  {c.nombre}
                </h3>
              </div>
              <div className="mt-1.5">
                {c.subcategorias.map((s) => (
                  <span key={s.id} className="mr-1.5 mt-1.5 inline-flex items-center rounded-full bg-subtle px-3.5 py-1.5 text-xs font-bold text-ink-secondary">
                    {s.nombre}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <p className="foot mt-3 text-xs text-ink-tertiary">Desactivar una subcategoría la oculta de los selectores sin tocar el histórico de imputaciones.</p>
        </div>
      </div>
      {!esAdminGrupo && <p className="text-xs text-ink-tertiary md:col-span-2">El alta de categorías es solo para admin de grupo.</p>}
    </div>
  );
}

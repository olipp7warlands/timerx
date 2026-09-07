'use client';

import { useState } from 'react';
import { useTarifas } from '@/hooks/admin/useTarifas';
import { useCategorias } from '@/hooks/admin/useCategorias';
import { useEmpresas } from '@/hooks/admin/useEmpresas';
import { useUsuarios } from '@/hooks/admin/useUsuarios';
import { useToast } from '@/components/empleado/compartido/Toast';
import type { AdminInfo } from '../types';

const CAT_COLOR: Record<string, string> = {
  Desarrollo: 'var(--cat-desarrollo)',
  Diseño: 'var(--cat-diseno)',
  Abogados: 'var(--cat-abogados)',
  Gestión: 'var(--cat-gestion)',
};

export function TarifasEscritorio({ info }: { info: AdminInfo }) {
  const { tarifas, crear } = useTarifas();
  const { categorias } = useCategorias();
  const { empresas } = useEmpresas();
  const { usuarios } = useUsuarios();
  const toast = useToast();
  const esAdminGrupo = info.rol === 'admin_grupo';

  const [aplicarA, setAplicarA] = useState<'categoria' | 'empleado'>('categoria');
  const [form, setForm] = useState({ categoriaId: '', empleadoId: '', empresaOrigenId: '', precio: '', desde: new Date().toISOString().slice(0, 10) });

  async function guardar() {
    if (!form.precio || !form.desde || (aplicarA === 'categoria' && !form.categoriaId) || (aplicarA === 'empleado' && !form.empleadoId)) {
      toast('Completa el ámbito, el precio y la fecha de vigencia', 'error');
      return;
    }
    const { error } = await crear({
      categoriaId: aplicarA === 'categoria' ? form.categoriaId : null,
      empleadoId: aplicarA === 'empleado' ? form.empleadoId : null,
      empresaOrigenId: form.empresaOrigenId || null,
      costeHora: Number(form.precio.replace(',', '.')),
      vigenteDesde: form.desde,
    });
    if (error) toast(error, 'error');
    else {
      toast('Tarifa guardada');
      setForm({ categoriaId: '', empleadoId: '', empresaOrigenId: '', precio: '', desde: new Date().toISOString().slice(0, 10) });
    }
  }

  return (
    <div className="split grid grid-cols-2 items-start gap-4.5 max-[920px]:grid-cols-1">
      {esAdminGrupo && (
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Nueva tarifa</h2>
          </div>
          <div className="card-body">
            <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Aplicar a</label>
            <select className="input" value={aplicarA} onChange={(e) => setAplicarA(e.target.value as 'categoria' | 'empleado')}>
              <option value="categoria">Categoría</option>
              <option value="empleado">Empleado concreto</option>
            </select>
            {aplicarA === 'categoria' ? (
              <select className="input mt-2" value={form.categoriaId} onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value }))}>
                <option value="">Selecciona categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <select className="input mt-2" value={form.empleadoId} onChange={(e) => setForm((f) => ({ ...f, empleadoId: e.target.value }))}>
                <option value="">Selecciona empleado</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            )}
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Empresa origen (opcional)</label>
            <select className="input" value={form.empresaOrigenId} onChange={(e) => setForm((f) => ({ ...f, empresaOrigenId: e.target.value }))}>
              <option value="">Todas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Euros por hora</label>
            <input className="input mono" value={form.precio} onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))} placeholder="60,00" />
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Vigente desde</label>
            <input className="input mono" type="date" value={form.desde} onChange={(e) => setForm((f) => ({ ...f, desde: e.target.value }))} />
            <button type="button" className="btn btn-primary full" onClick={guardar}>
              Guardar tarifa
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Tarifas vigentes</h2>
        </div>
        <div className="px-1.5 pb-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                <th className="border-b border-border px-2.5 py-2">Ámbito</th>
                <th className="border-b border-border px-2.5 py-2">Empresa origen</th>
                <th className="border-b border-border px-2.5 py-2 text-right">€/h</th>
                <th className="border-b border-border px-2.5 py-2">Vigencia</th>
              </tr>
            </thead>
            <tbody>
              {tarifas.map((t) => (
                <tr key={t.id} className="hover:bg-subtle">
                  <td className="border-b border-border px-2.5 py-2.5">
                    {t.empleadoNombre ? (
                      <>
                        <span className="font-extrabold">{t.empleadoNombre}</span>
                        <span className="block text-[11px] text-ink-tertiary">prioridad sobre su categoría</span>
                      </>
                    ) : (
                      <>
                        <span className="mr-2 inline-block h-[7px] w-[7px] rounded-full" style={{ background: CAT_COLOR[t.categoriaNombre ?? ''] ?? 'var(--ink-disabled)' }} />
                        {t.categoriaNombre}
                      </>
                    )}
                  </td>
                  <td className="border-b border-border px-2.5 py-2.5">{t.empresaOrigenNombre ?? 'Todas'}</td>
                  <td className="mono border-b border-border px-2.5 py-2.5 text-right">{t.costeHora.toFixed(2)}</td>
                  <td className="mono border-b border-border px-2.5 py-2.5">desde {t.vigenteDesde.split('-').reverse().join('/')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">Si un mes tiene horas sin tarifa aplicable, el informe de refacturación lo avisa antes de cerrar.</p>
        </div>
      </div>
    </div>
  );
}

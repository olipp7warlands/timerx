'use client';

import { useState } from 'react';
import { useMapa } from '@/hooks/useMapa';
import { useMapaAdmin, type AreaAdmin, type ItemAdmin } from '@/hooks/admin/useMapaAdmin';
import { useEmpresas } from '@/hooks/admin/useEmpresas';
import { useToast } from '@/components/empleado/compartido/Toast';
import { MapaGrid } from '@/components/mapa/MapaGrid';
import { confirmar } from '@/components/ui/confirmar';
import { PALETA_MAPA } from '@/lib/mapa/paleta';
import { IconMapa } from '@/components/ui/icons';
import type { AdminInfo } from '../types';

const AREA_VACIA = { nombre: '', color: PALETA_MAPA[0] };
const ITEM_VACIO = { areaId: '', nombre: '', etiqueta: '', descripcion: '', empresaId: '', url: '' };

export function MapaEscritorio({ info }: { info: AdminInfo }) {
  const { areas: areasPreview, loading: previewLoading } = useMapa();
  const {
    areas,
    items,
    loading,
    crearArea,
    actualizarArea,
    eliminarArea,
    moverArea,
    crearItem,
    actualizarItem,
    eliminarItem,
    moverItem,
  } = useMapaAdmin();
  const { empresas } = useEmpresas();
  const toast = useToast();
  const esAdminGrupo = info.rol === 'admin_grupo';

  const [areaForm, setAreaForm] = useState(AREA_VACIA);
  const [areaEditando, setAreaEditando] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(ITEM_VACIO);
  const [itemEditando, setItemEditando] = useState<string | null>(null);

  function iniciarEdicionArea(a: AreaAdmin) {
    setAreaEditando(a.id);
    setAreaForm({ nombre: a.nombre, color: a.color });
  }
  function cancelarEdicionArea() {
    setAreaEditando(null);
    setAreaForm(AREA_VACIA);
  }
  async function guardarArea() {
    if (!areaForm.nombre.trim()) {
      toast('El nombre del área es obligatorio', 'error');
      return;
    }
    const { error } = areaEditando
      ? await actualizarArea(areaEditando, areaForm.nombre, areaForm.color)
      : await crearArea(areaForm.nombre, areaForm.color);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(areaEditando ? 'Área actualizada' : `Área "${areaForm.nombre}" creada`);
    cancelarEdicionArea();
  }
  async function borrarArea(a: AreaAdmin) {
    if (!confirmar(`¿Eliminar el área "${a.nombre}"?`)) return;
    const { error } = await eliminarArea(a.id);
    if (error) toast(error, 'error');
    else toast(`Área "${a.nombre}" eliminada`);
  }

  function iniciarEdicionItem(i: ItemAdmin) {
    setItemEditando(i.id);
    setItemForm({ areaId: i.areaId, nombre: i.nombre, etiqueta: i.etiqueta ?? '', descripcion: i.descripcion, empresaId: i.empresaId ?? '', url: i.url ?? '' });
  }
  function cancelarEdicionItem() {
    setItemEditando(null);
    setItemForm(ITEM_VACIO);
  }
  async function guardarItem() {
    if (!itemForm.areaId || !itemForm.nombre.trim() || !itemForm.descripcion.trim()) {
      toast('Área, nombre y descripción son obligatorios', 'error');
      return;
    }
    const input = {
      areaId: itemForm.areaId,
      nombre: itemForm.nombre,
      etiqueta: itemForm.etiqueta.trim() || null,
      descripcion: itemForm.descripcion,
      empresaId: itemForm.empresaId || null,
      url: itemForm.url.trim() || null,
    };
    const { error } = itemEditando ? await actualizarItem(itemEditando, input) : await crearItem(input);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(itemEditando ? 'Elemento actualizado' : `Elemento "${itemForm.nombre}" creado`);
    cancelarEdicionItem();
  }
  async function borrarItem(i: ItemAdmin) {
    if (!confirmar(`¿Eliminar el elemento "${i.nombre}"?`)) return;
    const { error } = await eliminarItem(i.id);
    if (error) toast(error, 'error');
    else toast(`Elemento "${i.nombre}" eliminado`);
  }

  return (
    <div className="space-y-4.5">
      <div>
        <p className="sec-label mb-3 flex items-center gap-2 text-[15.5px] font-extrabold">
          <IconMapa size={17} />
          Mapa del grupo
        </p>
        <p className="mb-3 text-xs font-semibold text-ink-tertiary">
          Referencia viva de áreas y proyectos, visible para todo el mundo desde el botón de mapa. Se genera dinámicamente: lo que edites aquí es lo que ven.
        </p>
        {previewLoading ? <p className="text-sm text-ink-tertiary">Cargando…</p> : <MapaGrid areas={areasPreview} variante="grid" />}
      </div>

      {!esAdminGrupo ? (
        <p className="text-xs text-ink-tertiary">El mapa del grupo es solo editable por admin de grupo.</p>
      ) : (
        <div className="grid grid-cols-[1fr_1.4fr] items-start gap-3.5 max-[1000px]:grid-cols-1">
          <div className="card">
            <div className="card-head">
              <h2 className="text-sm font-extrabold">Áreas</h2>
            </div>
            <div className="card-body space-y-3">
              <div className="space-y-2 rounded-2xl border border-border bg-subtle p-3">
                <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Nombre</label>
                <input className="input" value={areaForm.nombre} onChange={(e) => setAreaForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Infraestructura" />
                <label className="mb-1 mt-2 block text-xs font-extrabold text-ink-tertiary">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PALETA_MAPA.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      onClick={() => setAreaForm((f) => ({ ...f, color: c }))}
                      className={`h-7 w-7 rounded-full ${areaForm.color === c ? 'ring-2 ring-[var(--ink-primary)] ring-offset-2 ring-offset-[var(--bg-surface)]' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" className="btn btn-primary btn-sm flex-1" onClick={guardarArea}>
                    {areaEditando ? 'Guardar cambios' : '＋ Añadir área'}
                  </button>
                  {areaEditando && (
                    <button type="button" className="btn btn-sm" onClick={cancelarEdicionArea}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                    <th className="border-b border-border px-2 py-2">Área</th>
                    <th className="border-b border-border px-2 py-2">Elementos</th>
                    <th className="border-b border-border px-2 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-2 py-3 text-sm text-ink-tertiary">
                        Cargando…
                      </td>
                    </tr>
                  ) : (
                    areas.map((a, i) => (
                      <tr key={a.id} className="hover:bg-subtle">
                        <td className="border-b border-border px-2 py-2.5">
                          <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: a.color }} />
                          <b className="font-extrabold">{a.nombre}</b>
                        </td>
                        <td className="mono border-b border-border px-2 py-2.5">{a.itemCount}</td>
                        <td className="whitespace-nowrap border-b border-border px-2 py-2.5 text-right">
                          <button type="button" className="btn btn-sm" disabled={i === 0} onClick={() => moverArea(a.id, 'up')} aria-label="Subir">
                            ↑
                          </button>
                          <button type="button" className="btn btn-sm ml-1" disabled={i === areas.length - 1} onClick={() => moverArea(a.id, 'down')} aria-label="Bajar">
                            ↓
                          </button>
                          <button type="button" className="btn btn-sm ml-1" onClick={() => iniciarEdicionArea(a)}>
                            Editar
                          </button>
                          <button type="button" className="btn btn-sm ml-1" onClick={() => borrarArea(a)}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2 className="text-sm font-extrabold">Elementos</h2>
            </div>
            <div className="card-body space-y-3">
              <div className="space-y-2 rounded-2xl border border-border bg-subtle p-3">
                <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Área</label>
                <select className="input" value={itemForm.areaId} onChange={(e) => setItemForm((f) => ({ ...f, areaId: e.target.value }))}>
                  <option value="">Selecciona área</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
                <label className="mb-1 mt-2 block text-xs font-extrabold text-ink-tertiary">Nombre</label>
                <input className="input" value={itemForm.nombre} onChange={(e) => setItemForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="3B3" />
                <label className="mb-1 mt-2 block text-xs font-extrabold text-ink-tertiary">Etiqueta (opcional)</label>
                <input className="input" value={itemForm.etiqueta} onChange={(e) => setItemForm((f) => ({ ...f, etiqueta: e.target.value }))} placeholder="FS" />
                <label className="mb-1 mt-2 block text-xs font-extrabold text-ink-tertiary">Descripción</label>
                <input className="input" value={itemForm.descripcion} onChange={(e) => setItemForm((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Qué es este elemento" />
                <label className="mb-1 mt-2 block text-xs font-extrabold text-ink-tertiary">Empresa (opcional)</label>
                <select className="input" value={itemForm.empresaId} onChange={(e) => setItemForm((f) => ({ ...f, empresaId: e.target.value }))}>
                  <option value="">Sin empresa</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
                <label className="mb-1 mt-2 block text-xs font-extrabold text-ink-tertiary">URL (opcional)</label>
                <input className="input" value={itemForm.url} onChange={(e) => setItemForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." />
                <div className="flex gap-2 pt-1">
                  <button type="button" className="btn btn-primary btn-sm flex-1" onClick={guardarItem}>
                    {itemEditando ? 'Guardar cambios' : '＋ Añadir elemento'}
                  </button>
                  {itemEditando && (
                    <button type="button" className="btn btn-sm" onClick={cancelarEdicionItem}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                    <th className="border-b border-border px-2 py-2">Área</th>
                    <th className="border-b border-border px-2 py-2">Nombre</th>
                    <th className="border-b border-border px-2 py-2">Empresa</th>
                    <th className="border-b border-border px-2 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-3 text-sm text-ink-tertiary">
                        Cargando…
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => {
                      const mismaArea = items.filter((x) => x.areaId === it.areaId);
                      const idxEnArea = mismaArea.findIndex((x) => x.id === it.id);
                      return (
                        <tr key={it.id} className="hover:bg-subtle">
                          <td className="border-b border-border px-2 py-2.5">
                            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: it.areaColor }} />
                            {it.areaNombre}
                          </td>
                          <td className="border-b border-border px-2 py-2.5 font-extrabold">
                            {it.nombre} {it.etiqueta && <span className="mapa-tag">{it.etiqueta}</span>}
                          </td>
                          <td className="border-b border-border px-2 py-2.5">{it.empresaNombre ?? '—'}</td>
                          <td className="whitespace-nowrap border-b border-border px-2 py-2.5 text-right">
                            <button type="button" className="btn btn-sm" disabled={idxEnArea === 0} onClick={() => moverItem(it.id, 'up')} aria-label="Subir">
                              ↑
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm ml-1"
                              disabled={idxEnArea === mismaArea.length - 1}
                              onClick={() => moverItem(it.id, 'down')}
                              aria-label="Bajar"
                            >
                              ↓
                            </button>
                            <button type="button" className="btn btn-sm ml-1" onClick={() => iniciarEdicionItem(it)}>
                              Editar
                            </button>
                            <button type="button" className="btn btn-sm ml-1" onClick={() => borrarItem(it)}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

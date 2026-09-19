-- =============================================================================
-- 020: Tipologías (Lote 4). La tipología de una empresa o proyecto ES un área del Mapa del
-- grupo (`mapa_area`): un solo catálogo, cero enums nuevos.
--
--   * empresa.area_id  -> tipología de la empresa (opcional).
--   * proyecto.area_id -> tipología del proyecto (opcional). Al crear un proyecto, la UI ofrece
--     "Heredar de la empresa" y GUARDA aquí el área de la empresa en ese momento: es una COPIA,
--     no una referencia viva. Cambiar después la tipología de la empresa NO recolorea ni
--     recoloca proyectos ya creados.
--
-- Solo columnas nuevas nullables: ninguna función, vista ni policy existente las lee, así que
-- fte_mes / balance_mes_empleado / estado_dias_mes / resumen_* / faltantes* no se tocan y su
-- salida no puede cambiar (se comprueba con la foto SHA-256 ampliada antes y después).
-- RLS: sin policies nuevas. Las columnas heredan las de su tabla: lectura abierta
-- (empresa_select / proyecto_select), escritura de empresa solo admin_grupo (empresa_admin) y de
-- proyecto admin_grupo o admin_empresa dentro de su empresa (proyecto_admin).
-- =============================================================================

alter table empresa  add column area_id uuid references mapa_area(id);
alter table proyecto add column area_id uuid references mapa_area(id);

create index idx_proyecto_area on proyecto(area_id);

-- SEED de demo (ids literales de supabase/seed.sql; en una base nueva las migraciones corren antes
-- que el seed y estos UPDATE no encuentran filas: el seed aplica lo mismo). Wowinx -> Tecnología,
-- Málaga -> Deportes, Legal Norte -> NULL a propósito (demuestra el fallback a grises).
update empresa set area_id = '00000000-0000-0000-0005-000000000002' where id = '00000000-0000-0000-0000-000000000001'; -- Wowinx SL      -> Tecnología
update empresa set area_id = '00000000-0000-0000-0005-000000000003' where id = '00000000-0000-0000-0000-000000000002'; -- Málaga CF SAD  -> Deportes

-- Los proyectos heredan de su empresa, salvo Interno y Asesoría intragrupo (NULL).
update proyecto p
   set area_id = e.area_id
  from empresa e
 where e.id = p.empresa_id
   and p.codigo not in ('INTERNO', 'ASESINT');

-- Corrección de dato de demo (T-016): el texto decía "viernes 26" porque copiaba el calendario del
-- mock; en el calendario real de 2026 el 26 de septiembre es SÁBADO y el viernes es el 25. La app
-- manda en fechas: se ajusta al día real. Solo toca la fila si conserva el texto original.
update ticket
   set descripcion = replace(descripcion, 'viernes 26', 'viernes 25')
 where ref = 'T-016'
   and descripcion like '%tarde del viernes 26%';

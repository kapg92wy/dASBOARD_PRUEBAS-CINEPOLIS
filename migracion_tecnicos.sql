-- ═══════════════════════════════════════════════════════════════
--  migracion_tecnicos.sql
--  Corre esto UNA VEZ en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1) Asignación de técnico en las incidencias
ALTER TABLE cp_incidencias ADD COLUMN IF NOT EXISTS tecnico_id        TEXT;
ALTER TABLE cp_incidencias ADD COLUMN IF NOT EXISTS tecnico_nombre    TEXT;
ALTER TABLE cp_incidencias ADD COLUMN IF NOT EXISTS fecha_asignacion  TIMESTAMPTZ;

-- push_enviado: queda NULL para las no asignadas.
-- Al asignar (desde la app) se pone 0; el script lo pone 1 cuando ya mandó el aviso.
ALTER TABLE cp_incidencias ADD COLUMN IF NOT EXISTS push_enviado      INT;


-- 2) Tabla de suscripciones de notificaciones (una por dispositivo del técnico)
CREATE TABLE IF NOT EXISTS cp_push_subs (
  id           TEXT PRIMARY KEY,
  usuario_id   TEXT NOT NULL,
  username     TEXT,
  subscription JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Mismo criterio que el resto del proyecto: RLS permisiva con la llave anon
ALTER TABLE cp_push_subs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_cp_push_subs" ON cp_push_subs;
CREATE POLICY "anon_all_cp_push_subs" ON cp_push_subs
  FOR ALL TO anon USING (true) WITH CHECK (true);

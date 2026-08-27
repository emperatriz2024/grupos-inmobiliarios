INSERT INTO workspaces(id,name,timezone,country_code,default_currency)
VALUES ('00000000-0000-7000-8000-000000000001','Emperatriz Radar','America/Caracas','VE','USD')
ON CONFLICT(id) DO NOTHING;

-- UUIDs are stable mappings for the Phase 0A territorial seed.
INSERT INTO territories(id,workspace_id,parent_id,type,name,canonical_slug,country_code,state_name,municipality_name) VALUES
('00000000-0000-7000-8000-000000000101','00000000-0000-7000-8000-000000000001',NULL,'country','Venezuela','venezuela','VE',NULL,NULL),
('00000000-0000-7000-8000-000000000102','00000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000101','state','Carabobo','carabobo','VE','Carabobo',NULL),
('00000000-0000-7000-8000-000000000103','00000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000102','municipality','Valencia','valencia','VE','Carabobo','Valencia'),
('00000000-0000-7000-8000-000000000104','00000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000103','macrozone','Valencia Norte','valencia-norte','VE','Carabobo','Valencia'),
('00000000-0000-7000-8000-000000000105','00000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000104','zone_family','Familia Trigal','familia-trigal','VE','Carabobo','Valencia'),
('00000000-0000-7000-8000-000000000106','00000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000105','zone','El Trigal','el-trigal','VE','Carabobo','Valencia'),
('00000000-0000-7000-8000-000000000107','00000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000106','subzone','Trigal Norte','trigal-norte','VE','Carabobo','Valencia'),
('00000000-0000-7000-8000-000000000108','00000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000106','subzone','Trigal Centro','trigal-centro','VE','Carabobo','Valencia'),
('00000000-0000-7000-8000-000000000109','00000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000106','subzone','Trigal Sur','trigal-sur','VE','Carabobo','Valencia')
ON CONFLICT(id) DO NOTHING;

INSERT INTO territory_aliases(id,territory_id,alias,normalized_alias)
VALUES ('00000000-0000-7000-8000-000000000201','00000000-0000-7000-8000-000000000105','Trigal','trigal')
ON CONFLICT(id) DO NOTHING;

INSERT INTO territory_closure(ancestor_id,descendant_id,depth)
SELECT ancestor.id,descendant.id,0
FROM territories ancestor JOIN territories descendant ON ancestor.id=descendant.id
WHERE ancestor.workspace_id='00000000-0000-7000-8000-000000000001'
ON CONFLICT DO NOTHING;

WITH RECURSIVE lineage AS (
  SELECT id AS descendant_id,parent_id AS ancestor_id,1 AS depth FROM territories WHERE parent_id IS NOT NULL
  UNION ALL SELECT lineage.descendant_id,territories.parent_id,lineage.depth+1 FROM lineage JOIN territories ON territories.id=lineage.ancestor_id WHERE territories.parent_id IS NOT NULL
)
INSERT INTO territory_closure(ancestor_id,descendant_id,depth)
SELECT ancestor_id,descendant_id,depth FROM lineage WHERE ancestor_id IS NOT NULL ON CONFLICT DO NOTHING;

import { DataSource } from 'typeorm';

/**
 * Tables whose rows are reference data seeded by migration, not fixtures a spec
 * creates. Truncating them would leave every later spec without the catalog its
 * foreign keys point at, so they are held back.
 */
const REFERENCE_TABLES = new Set(['permission']);

export async function truncateDatabase(dataSource: DataSource) {
  const tables = dataSource.entityMetadatas
    .filter((e) => !REFERENCE_TABLES.has(e.tableName))
    .map((e) => `"${e.tableName}"`);

  if (tables.length === 0) return;

  await dataSource.query(
    `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`
  );
}

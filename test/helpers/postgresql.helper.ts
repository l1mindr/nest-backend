import { DataSource } from 'typeorm';

export async function truncateDatabase(dataSource: DataSource) {
  const tables = dataSource.entityMetadatas.map((e) => `"${e.tableName}"`);

  if (tables.length === 0) return;

  await dataSource.query(
    `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`
  );
}

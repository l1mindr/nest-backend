import { DataSource } from 'typeorm';

export async function runMigrations(dataSource: DataSource) {
  if (!dataSource.isInitialized) await dataSource.initialize();
  await dataSource.synchronize(true);
}

export async function resetDatabase(dataSource: DataSource) {
  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);

    await repository.query(
      `TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE;`
    );
  }
}

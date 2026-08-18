import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';

export async function getMongoConnection(app: INestApplication) {
  return app.get(getConnectionToken());
}

export async function clearMongoCollections(connection: any) {
  const collections = await connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

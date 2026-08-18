import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { MONGODB_CONNECTION_NAME } from '../../src/infrastructure/logging/mongodb/mongodb.constants';

export async function getMongoConnection(app: INestApplication) {
  return app.get(getConnectionToken(MONGODB_CONNECTION_NAME));
}

export async function clearMongoCollections(connection: any) {
  const collections = await connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

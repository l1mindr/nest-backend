import { registerAs } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';

export default registerAs('mongodb', () => {
  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DATABASE;

  if (!uri || !database) {
    throw new Error(
      'MONGODB_URI and MONGODB_DATABASE must be set for logging persistence'
    );
  }

  const config: MongooseModuleOptions = {
    uri,
    dbName: database,
    retryWrites: true,
    w: 'majority',
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 2
  };

  return config;
});

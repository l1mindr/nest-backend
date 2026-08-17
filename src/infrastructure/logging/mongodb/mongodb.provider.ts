import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import mongodbConfig from './mongodb.config';
import { MONGODB_CONNECTION_NAME } from './mongodb.constants';

@Module({
  imports: [
    ConfigModule.forFeature(mongodbConfig),
    MongooseModule.forRootAsync({
      connectionName: MONGODB_CONNECTION_NAME,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const opts = config.get<MongooseModuleOptions>('mongodb');
        if (!opts) {
          throw new Error('MongoDB configuration is missing');
        }
        return opts;
      }
    })
  ]
})
export class MongoDbModule {}

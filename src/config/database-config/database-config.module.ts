import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvConfigService } from '../env-config/env-config.service.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [EnvConfigService],
      useFactory: (envConfigService: EnvConfigService) => {
        const isProd = envConfigService.isProduction();
        const ca = envConfigService.getDatabaseCaCert();
        const ssl = ca
          ? { rejectUnauthorized: true, ca }
          : { rejectUnauthorized: isProd };

        const dbUrl = new URL(envConfigService.getDatabaseUrl());

        return {
          type: 'postgres',
          host: dbUrl.hostname,
          port: Number(dbUrl.port) || 5432,
          username: decodeURIComponent(dbUrl.username),
          password: decodeURIComponent(dbUrl.password),
          database: dbUrl.pathname.replace(/^\//, ''),
          ssl,
          // Connection pool configuration
          extra: {
            ssl,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
          },
          autoLoadEntities: true,
          synchronize: !isProd,
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseConfigModule {}

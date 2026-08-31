import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EnvConfigService {
  constructor(private readonly configService: ConfigService) {}

  getNodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  getPort(): number {
    return Number(this.configService.get<number>('PORT', 3000));
  }

  getDatabaseUrl(): string {
    return this.configService.get<string>('DATABASE_URL', '');
  }

  // Load CA certificate from env or local file
  getDatabaseCaCert(): string | undefined {
    let cert =
      this.configService.get<string>('DATABASE_CA_CERT') ||
      this.configService.get<string>('DB_CA_CERT');

    if (cert) {
      if (!cert.includes('-----BEGIN CERTIFICATE-----')) {
        try {
          const decoded = Buffer.from(cert, 'base64').toString('utf8');
          if (decoded.includes('-----BEGIN CERTIFICATE-----')) {
            cert = decoded;
          }
        } catch {
          // Keep raw string if decode fails
        }
      }
      return cert.replace(/\\n/g, '\n');
    }

    const certPath = path.resolve(process.cwd(), 'ca.pem');
    if (fs.existsSync(certPath)) {
      return fs.readFileSync(certPath, 'utf8');
    }
    return undefined;
  }

  getRedisUrl(): string {
    return this.configService.get<string>('REDIS_URL', '');
  }

  getJwtSecret(): string {
    return this.configService.get<string>(
      'JWT_SECRET',
      'default_jwt_secret_key_change_in_prod',
    );
  }

  getJwtExpiration(): string {
    return this.configService.get<string>('JWT_EXPIRATION', '7d');
  }

  isProduction(): boolean {
    return this.getNodeEnv() === 'production';
  }
}

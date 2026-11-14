import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  app.setGlobalPrefix(configService.get<string>('app.apiPrefix', 'api/v1'));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  const nodeEnv = configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? 'development';
  const allowedOrigins = (configService.get<string>('FRONTEND_URL') ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  // En développement/test, le frontend web est aussi ouvert depuis le réseau local
  // (autre PC, téléphone) : sans ces origines le navigateur bloque les appels alors
  // que l'application native fonctionne. En production, seule FRONTEND_URL compte.
  const privateOrigin =
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // requêtes natives, curl, SSR
      const normalized = origin.replace(/\/+$/, '');
      if (!allowedOrigins.length) return callback(null, nodeEnv !== 'production');
      if (allowedOrigins.includes(normalized)) return callback(null, true);
      if (nodeEnv !== 'production' && privateOrigin.test(normalized)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('XeuySil API')
    .setDescription('API REST de la plateforme XeuySil')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: false });

  await app.listen(configService.get<number>('app.port', 3000));
}

void bootstrap();

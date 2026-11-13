import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('XeuySil API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const configService = app.get(ConfigService);
    app.setGlobalPrefix(configService.get<string>('app.apiPrefix', 'api/v1'));
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    const swaggerConfig = new DocumentBuilder()
      .setTitle('XeuySil API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, { useGlobalPrefix: false });
    await app.init();
  });

  it('serves Swagger documentation at /docs', () => {
    return request(app.getHttpServer())
      .get('/docs')
      .expect(200);
  });

  it('protects the bootstrap endpoint until Supabase auth is configured', () => {
    return request(app.getHttpServer())
      .get('/api/v1/bootstrap')
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});

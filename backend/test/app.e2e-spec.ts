import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { ELASTICSEARCH_CLIENT } from '../src/elasticsearch/elasticsearch.module';
import { ValidationPipe } from '@nestjs/common';

describe('API (e2e)', () => {
  let app: INestApplication;
  const esMock = {
    indices: {
      exists: jest.fn().mockResolvedValue(true),
      create: jest.fn(),
    },
    search: jest.fn(),
    get: jest.fn(),
    index: jest.fn(),
    delete: jest.fn(),
  };

  beforeAll(async () => {
    // demo password: "password"
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD_HASH =
      '$2b$10$DU6rbEbsX/SzqGmEWe8Y7uDBqkWBGkCC2DC49WD/R5Sr1iq/.TMRK';
    process.env.JWT_SECRET = 'test-secret';
    process.env.ELASTICSEARCH_NODE = 'http://test:9200';
    process.env.ELASTICSEARCH_INDEX = 'dev-tools-links';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ELASTICSEARCH_CLIENT)
      .useValue(esMock)
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts behavior for e2e
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });

  it('POST /api/auth/login returns JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' })
      .expect(201);
    expect(res.body.access_token).toBeTruthy();
  });
});

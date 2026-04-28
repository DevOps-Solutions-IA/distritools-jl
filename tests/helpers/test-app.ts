import 'tests/helpers/test-env';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { SuperTest, Test as SupertestRequest } from 'supertest';
import { generate } from 'otplib';
import { AppModule } from 'src/app/app.module';

export async function createTestApp(): Promise<{
  app: INestApplication;
  http: SuperTest<SupertestRequest>;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({
    rawBody: true,
  });

  app.setGlobalPrefix('api/v1');
  await app.init();

  return {
    app,
    http: request(app.getHttpServer()),
  };
}

export async function loginAsAdmin(
  http: SuperTest<SupertestRequest>,
  email: string,
  password: string,
  twoFactorSecret: string,
) {
  const loginResponse = await http.post('/api/v1/auth/login').send({
    email,
    password,
  });

  const code = await generate({ secret: twoFactorSecret });
  const verifyResponse = await http.post('/api/v1/auth/verify-2fa').send({
    challengeToken: loginResponse.body.challengeToken,
    code,
  });

  return verifyResponse.body as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; permissions: string[] };
  };
}

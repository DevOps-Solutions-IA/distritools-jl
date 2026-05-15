import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MetricsInterceptor } from 'src/infra/telemetry/metrics/metrics.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from 'src/app/app.module';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';

export async function bootstrap(): Promise<void> {
  const corsOriginsEnv = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';

  if (corsOriginsEnv.length === 0) {
    if (isProduction) {
      throw new Error(
        'FATAL: CORS_ORIGINS is empty in production. Set CORS_ORIGINS to a comma-separated list of allowed origins.',
      );
    }
    corsOriginsEnv.push('http://localhost:3001');
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.enableCors({
    origin: corsOriginsEnv,
    credentials: true,
  });

  app.enableShutdownHooks();

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(app.get(MetricsInterceptor));

  const config = new DocumentBuilder()
    .setTitle('DistriTools JL API')
    .setDescription('Enterprise backend API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

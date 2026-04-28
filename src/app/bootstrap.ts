import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MetricsInterceptor } from 'src/infra/telemetry/metrics/metrics.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from 'src/app/app.module';

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    rawBody: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
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

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000').split(','),
    credentials: true,
  });

  // Routes live under /v1 (config API_PREFIX). Versioning is encoded in the
  // prefix itself, so no additional URI versioning — /v1/intents, not /v1/1/….
  app.setGlobalPrefix(config.get<string>('API_PREFIX') ?? 'v1', {
    exclude: ['api/auth/(.*)', 'health'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Archon API')
    .setDescription('Programmable decision and execution layer for onchain finance')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document);

  const port = Number(config.get<string>('PORT') ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Archon backend listening on :${port}`);
}

void bootstrap();

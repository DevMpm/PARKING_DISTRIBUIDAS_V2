import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
  .addBearerAuth()
  .setTitle('Servicio Auditoria')
  .setDescription('Descripción de la API y los endpoints para el servicio de auditoría.')
  .setVersion('1.0')
  .build();

  const docs = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/auditoria/docs',app, docs);

  await app.listen(process.env.PORT ?? 3003);
}
bootstrap();

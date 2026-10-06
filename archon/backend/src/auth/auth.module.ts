import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { SessionGuard } from '../common/guards/session.guard';

@Module({
  controllers: [AuthController],
  providers: [{ provide: APP_GUARD, useClass: SessionGuard }],
  exports: [],
})
export class AuthModule {}

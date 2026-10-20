import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { SessionGuard } from '../common/guards/session.guard';

@Module({
  imports: [ApiKeysModule, TenancyModule],
  controllers: [AuthController],
  providers: [{ provide: APP_GUARD, useClass: SessionGuard }],
  exports: [],
})
export class AuthModule {}

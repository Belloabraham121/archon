import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ChainsModule } from '../chains/chains.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';

@Module({ imports: [ChainsModule, PrismaModule, TenancyModule, AuditModule], controllers: [ConnectorsController], providers: [ConnectorsService], exports: [ConnectorsService] })
export class ConnectorsModule {}

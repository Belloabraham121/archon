import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { TenancyModule } from '../tenancy/tenancy.module';

@Module({ imports: [TenancyModule], providers: [EventsGateway], exports: [EventsGateway] })
export class GatewayModule {}

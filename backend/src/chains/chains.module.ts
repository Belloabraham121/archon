import { Module } from '@nestjs/common';
import { ChainsService, DEMO_ADAPTERS, REAL_ADAPTERS } from './chains.service';
import { demoAdapters } from './adapters/mock-venue.adapter';
import { liveBaseAdapters } from './adapters/http-venue.adapter';

@Module({
  providers: [
    ChainsService,
    { provide: DEMO_ADAPTERS, useFactory: () => demoAdapters() },
    { provide: REAL_ADAPTERS, useFactory: () => liveBaseAdapters() },
  ],
  exports: [ChainsService],
})
export class ChainsModule {}

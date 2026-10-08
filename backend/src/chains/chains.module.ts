import { Module } from '@nestjs/common';
import { ChainsService, DEMO_ADAPTERS, REAL_ADAPTERS } from './chains.service';
import { demoAdapters } from './adapters/mock-venue.adapter';
import { baseAdapters } from './adapters/evm-venue.adapter';

@Module({
  providers: [
    ChainsService,
    { provide: DEMO_ADAPTERS, useFactory: () => demoAdapters() },
    { provide: REAL_ADAPTERS, useFactory: () => baseAdapters() },
  ],
  exports: [ChainsService],
})
export class ChainsModule {}

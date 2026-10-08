import { Module } from '@nestjs/common';
import { ChainsService, DEMO_ADAPTERS } from './chains.service';
import { demoAdapters } from './adapters/mock-venue.adapter';

@Module({
  providers: [
    ChainsService,
    { provide: DEMO_ADAPTERS, useFactory: () => demoAdapters() },
  ],
  exports: [ChainsService],
})
export class ChainsModule {}

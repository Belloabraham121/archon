import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ChainAdapter } from './adapters/chain-adapter.interface';
import { demoAdapters } from './adapters/mock-venue.adapter';

export const DEMO_ADAPTERS = 'DEMO_ADAPTERS';

@Injectable()
export class ChainsService implements OnModuleInit {
  private readonly adapters = new Map<string, ChainAdapter[]>();

  constructor(@Inject(DEMO_ADAPTERS) private readonly demo: ChainAdapter[]) {}

  onModuleInit() {
    for (const adapter of this.demo) this.register(adapter);
  }

  register(adapter: ChainAdapter) {
    const list = this.adapters.get(adapter.chain) ?? [];
    list.push(adapter);
    this.adapters.set(adapter.chain, list);
  }

  /** All venue adapters for a chain. Throws when the chain is unsupported. */
  forChain(chain: string): ChainAdapter[] {
    const adapters = this.adapters.get(chain);
    if (!adapters || adapters.length === 0) {
      throw new Error(`Unsupported chain: ${chain}`);
    }
    return adapters;
  }

  get(chain: string, venue?: string): ChainAdapter {
    const adapters = this.forChain(chain);
    if (!venue) return adapters[0];
    const found = adapters.find((a) => (a as { venue?: string }).venue === venue);
    if (!found) throw new Error(`Unsupported venue ${venue} on ${chain}`);
    return found;
  }

  supportedChains(): string[] {
    return [...this.adapters.keys()];
  }
}

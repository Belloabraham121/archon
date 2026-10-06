import { Injectable } from '@nestjs/common';
import { ChainAdapter } from './adapters/chain-adapter.interface';

@Injectable()
export class ChainsService {
  private readonly adapters = new Map<string, ChainAdapter>();

  register(adapter: ChainAdapter) {
    this.adapters.set(adapter.chain, adapter);
  }

  get(chain: string): ChainAdapter {
    const adapter = this.adapters.get(chain);
    if (!adapter) throw new Error(`Unsupported chain: ${chain}`);
    return adapter;
  }

  supportedChains(): string[] {
    return [...this.adapters.keys()];
  }
}

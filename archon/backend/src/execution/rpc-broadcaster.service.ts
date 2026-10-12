import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class RpcBroadcasterService {
  private url(chain: string): string | null {
    if (chain === 'tempo') return process.env.TEMPO_RPC_URL ?? 'https://rpc.moderato.tempo.xyz';
    try {
      const configured = JSON.parse(process.env.ARCHON_RPC_URLS ?? '{}') as Record<string, unknown>;
      const value = configured[chain];
      return typeof value === 'string' && /^https?:\/\//.test(value) ? value : null;
    } catch { return null; }
  }

  supports(chain: string) { return this.url(chain) !== null; }

  async broadcast(chain: string, rawTransaction: string): Promise<{ hash: string }> {
    if (!/^0x[0-9a-fA-F]+$/.test(rawTransaction)) throw new BadRequestException('A signed raw EVM transaction must be a 0x-prefixed hexadecimal string');
    return this.call<{ result?: string; error?: { message?: string } }>(chain, 'eth_sendRawTransaction', [rawTransaction]).then((response) => {
      if (!response.result) throw new BadRequestException(response.error?.message ?? 'RPC did not return a transaction hash');
      return { hash: response.result };
    });
  }

  async status(chain: string, hash: string): Promise<string> {
    const response = await this.call<{ result?: { status?: string } | null }>(chain, 'eth_getTransactionReceipt', [hash]);
    if (!response.result) return 'pending';
    return response.result.status === '0x1' ? 'confirmed' : 'failed';
  }

  private async call<T>(chain: string, method: string, params: unknown[]): Promise<T> {
    const url = this.url(chain);
    if (!url) throw new BadRequestException(`No RPC is configured for ${chain}. Set ARCHON_RPC_URLS with a trusted HTTPS RPC URL.`);
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }) });
    if (!response.ok) throw new BadRequestException(`${chain} RPC request failed (${response.status})`);
    return response.json() as Promise<T>;
  }
}

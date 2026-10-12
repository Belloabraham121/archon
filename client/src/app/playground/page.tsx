import { TempoPlayground, WalletGenerator } from "@/components/playground/tempo-playground";
import { RpcBroadcastConsole } from "@/components/playground/rpc-broadcast-console";

export const metadata = { title: "Tempo policy playground" };

export default function PlaygroundPage() {
  return <><TempoPlayground /><WalletGenerator /><RpcBroadcastConsole /></>;
}

export {};

type AdenaRes = {
  code?: number;
  status?: string;
  type?: string;
  message?: string;
  data?: {
    address?: string;
    coins?: string;
    chainId?: string;
    hash?: string;
    height?: number | string;
  };
};

type Adena = {
  AddEstablish: (name: string) => Promise<AdenaRes>;
  AddNetwork: (net: { chainId: string; chainName: string; rpcUrl: string }) => Promise<AdenaRes>;
  SwitchNetwork: (chainId: string | { chainId: string }) => Promise<AdenaRes>;
  GetAccount: () => Promise<AdenaRes>;
  GetNetwork?: () => Promise<AdenaRes>;
  DoContract: (req: Record<string, unknown>) => Promise<AdenaRes>;
};

declare global {
  interface Window {
    adena?: Adena;
  }
}

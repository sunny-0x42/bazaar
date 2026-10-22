import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBankUgnot, readBankUgnot } from "./wallets";

function rpc(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readBankUgnot", () => {
  it("reads ugnot from the bank path when the account path fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const path = JSON.parse(String(init?.body)).params.path as string;
        if (path.startsWith("auth/")) return rpc({ result: { response: { ResponseBase: { Error: "missing" } } } });
        return rpc({ result: { response: { ResponseBase: { Data: btoa("165ugnot") } } } });
      }),
    );
    await expect(readBankUgnot("https://rpc.example", "g1abc")).resolves.toBe(165);
    await expect(fetchBankUgnot("https://rpc.example", "g1abc")).resolves.toBe(165);
  });

  it("returns null when the chain cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(readBankUgnot("https://rpc.example", "g1abc")).resolves.toBeNull();
    await expect(fetchBankUgnot("https://rpc.example", "g1abc")).resolves.toBe(0);
  });

  it("returns 0 when the chain answers with an empty account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => rpc({ result: { response: { ResponseBase: { Data: btoa("null") } } } })),
    );
    await expect(readBankUgnot("https://rpc.example", "g1abc")).resolves.toBe(0);
  });
});

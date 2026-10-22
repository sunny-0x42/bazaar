import { describe, expect, it } from "vitest";
import { DROP_ADD_CAP } from "./dropjson";
import {
  chunkDropLines,
  ADENA_SIMULATE_GAS,
  LAUNCH_ADD_GAS_WANTED,
  LAUNCH_ADD_PER_TX,
  dropSignatureCount,
  gasFeeUgnot,
  packLaunchTxs,
  skipLaunchSetup,
  txGasWanted,
  type LaunchChain,
  type LaunchMsg,
} from "./launchtx";

const fresh: LaunchChain = {
  needsInit: true,
  reserved: false,
  wlPrice: 0,
  wlSupply: 0,
  wlStart: 0,
  wlEnd: 0,
  publicStart: 0,
  publicEnd: 0,
  wlCap: 0,
  pubCap: 0,
};

describe("launch transactions", () => {
  it("charges the floor gas price instead of 2 GNOT", () => {
    const wanted = txGasWanted([{ func: "SetDropSale", args: ["500000", "333"] }]);
    const fee = gasFeeUgnot(wanted, 1, 1000);
    expect(fee).toBeLessThan(20_000);
    expect(fee).toBeGreaterThan(0);
  });

  it("keeps each AddDropItems message inside the realm cap", () => {
    const lines = Array.from({ length: 1111 }, (_, i) => `N${i}|ipfs://abc|Common|`);
    const msgs = chunkDropLines(lines);
    expect(msgs).toHaveLength(Math.ceil(1111 / DROP_ADD_CAP));
    for (const msg of msgs) {
      expect(msg.args[0].split("\n").length).toBeLessThanOrEqual(DROP_ADD_CAP);
    }
  });

  it("packs a 1111-item drop as one AddDropItems signature each", () => {
    const line = "x".repeat(200);
    const msgs: LaunchMsg[] = [];
    for (let i = 0; i < 1111; i += DROP_ADD_CAP) {
      const take = Math.min(DROP_ADD_CAP, 1111 - i);
      msgs.push({ func: "AddDropItems", args: [Array(take).fill(line).join("\n")] });
    }
    const groups = packLaunchTxs(msgs);
    expect(groups).toHaveLength(Math.ceil(1111 / DROP_ADD_CAP));
    for (const group of groups) {
      expect(group).toHaveLength(1);
      expect(group[0]?.func).toBe("AddDropItems");
      expect(group.filter((msg) => msg.func === "AddDropItems")).toHaveLength(LAUNCH_ADD_PER_TX);
      expect(txGasWanted(group)).toBe(LAUNCH_ADD_GAS_WANTED);
      expect(txGasWanted(group)).toBeLessThan(ADENA_SIMULATE_GAS);
      expect(gasFeeUgnot(txGasWanted(group), 1, 1000)).toBe(2_000_000);
    }
    expect(dropSignatureCount(1111)).toBe(Math.ceil(1111 / DROP_ADD_CAP) + 2);
  });

  it("keeps item upload off the hide, reveal, allowlist, and resume signatures", () => {
    const line = "n|https://gateway.pinata.cloud/ipfs/bafy|Common|";
    const groups = packLaunchTxs<LaunchMsg>([
      { func: "SetHidden", args: ["true"] },
      { func: "AddDropItems", args: [Array(DROP_ADD_CAP).fill(line).join("\n")] },
      { func: "SetPrereveal", args: ["https://gateway.pinata.cloud/ipfs/bafy"] },
      { func: "AddDropItems", args: [line] },
      { func: "AddAllowlist", args: ["g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt"] },
      { func: "ResumeMint", args: [] },
    ]);
    expect(groups.map((group) => group.map((msg) => msg.func))).toEqual([
      ["SetHidden"],
      ["AddDropItems"],
      ["SetPrereveal"],
      ["AddDropItems"],
      ["AddAllowlist", "ResumeMint"],
    ]);
  });

  it("does not reserve again after Init, and keeps rounds already stored", () => {
    expect(skipLaunchSetup(fresh).reserve).toBe(false);
    expect(skipLaunchSetup({ ...fresh, reserved: true }).reserve).toBe(true);
    const continued = skipLaunchSetup({
      ...fresh,
      needsInit: false,
      reserved: false,
      wlPrice: 10_000_000,
      wlSupply: 333,
      wlStart: 1790604000,
      wlEnd: 1790604900,
      publicStart: 1790605200,
      publicEnd: 1790606700,
      wlCap: 1,
      pubCap: 3,
    });
    expect(continued).toEqual({ reserve: true, init: true, sale: true, clock: true, caps: true });
  });

  it("still writes a whitelist when Init already happened but the round is empty", () => {
    const skipped = skipLaunchSetup({ ...fresh, needsInit: false });
    expect(skipped.init).toBe(true);
    expect(skipped.sale).toBe(false);
    expect(skipped.clock).toBe(false);
  });

  it("does not split a single small message", () => {
    const msgs: LaunchMsg[] = [{ func: "Init", args: ["Name", "slug", "ipfs://c", "1111", "1", "0"] }];
    expect(packLaunchTxs(msgs)).toHaveLength(1);
  });
});

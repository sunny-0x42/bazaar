import { DROP_ADD_CAP } from "./dropjson";

/** One MsgCall inside a launch signature. */
export type LaunchMsg = {
  func: string;
  args: string[];
  send?: string;
};

/**
 * Adena 1.21 simulates every DoContract at 2_000_000_000 gas and blocks
 * Approve when the call goes over. The out-of-gas log stops at that ceiling,
 * so "used 2000000106" only means the call went past it.
 * One 20-line AddDropItems on Onyx bazaargens2 used about 406_000_000 gas.
 * A mainnet 20-line batch used about 456_000_000. Three packed calls stay
 * near 1.2B. The last bazaargens signature packed the heaviest trailing
 * batches with SetHidden, SetPrereveal, and ResumeMint and crossed 2B.
 * Each AddDropItems is its own signature. 1.6B gasWanted covers a heavier
 * tail and stays under the simulate ceiling.
 */
export const ADENA_SIMULATE_GAS = 2_000_000_000;
export const LAUNCH_GAS_BUFFER = 1.25;
export const LAUNCH_MAX_GAS_WANTED = 1_800_000_000;
export const LAUNCH_GAS_CAP = 1_400_000_000;
export const LAUNCH_BYTES_CAP = 60_000;
export const LAUNCH_ADD_PER_TX = 1;
export const LAUNCH_ADD_GAS_WANTED = 1_600_000_000;
/** 406M measured / ~8.4M raw line estimate. */
const ADD_DROP_GAS_SCALE = 50;

/** Gas estimate for one message, scaled for AddDropItems from the Onyx measurement. */
export function estimateMsgGas(msg: LaunchMsg): number {
  const blob = msg.args.join("\n");
  if (msg.func === "AddDropItems") {
    const lines = blob.split("\n").filter(Boolean).length;
    return (1_200_000 + lines * 350_000 + blob.length * 50) * ADD_DROP_GAS_SCALE;
  }
  if (msg.func === "Init") return 8_000_000;
  if (msg.func === "Reserve") return 4_000_000;
  return 2_500_000;
}

function isAddDrop(msg: LaunchMsg): boolean {
  return msg.func === "AddDropItems";
}

/**
 * Split an ordered message list into signatures.
 * An AddDropItems call never shares a signature with another call, so the
 * last item batch is not joined to SetHidden, SetPrereveal, AddAllowlist,
 * or ResumeMint.
 */
export function packLaunchTxs<T extends LaunchMsg>(msgs: T[]): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let gas = 0;
  let bytes = 0;
  const flush = () => {
    if (cur.length === 0) return;
    out.push(cur);
    cur = [];
    gas = 0;
    bytes = 0;
  };
  for (const msg of msgs) {
    const g = estimateMsgGas(msg);
    const b = msg.func.length + msg.args.join("\n").length;
    const adds = cur.filter(isAddDrop).length;
    const incomingAdd = isAddDrop(msg);
    const splitAdd =
      cur.length > 0 &&
      ((incomingAdd && (adds >= LAUNCH_ADD_PER_TX || cur.some((m) => !isAddDrop(m)))) ||
        (!incomingAdd && adds > 0));
    if (cur.length > 0 && (splitAdd || gas + g > LAUNCH_GAS_CAP || bytes + b > LAUNCH_BYTES_CAP)) {
      flush();
    }
    cur.push(msg);
    gas += g;
    bytes += b;
  }
  flush();
  return out;
}

export function chunkDropLines(lines: string[]): LaunchMsg[] {
  const out: LaunchMsg[] = [];
  for (let i = 0; i < lines.length; i += DROP_ADD_CAP) {
    const chunk = lines.slice(i, i + DROP_ADD_CAP);
    if (chunk.length === 0) continue;
    out.push({ func: "AddDropItems", args: [chunk.join("\n")] });
  }
  return out;
}

/** ugnot fee for this gasWanted at `ugnot` per `gas` units, plus the launch buffer. */
export function gasFeeUgnot(gasWanted: number, ugnot: number, gas: number): number {
  const per = gas > 0 ? ugnot / gas : 0.001;
  const min = Math.ceil(gasWanted * per);
  return Math.max(1, Math.ceil(min * LAUNCH_GAS_BUFFER));
}

export function txGasWanted(msgs: LaunchMsg[]): number {
  const sum = msgs.reduce((n, msg) => n + estimateMsgGas(msg), 0);
  let wanted = Math.min(LAUNCH_MAX_GAS_WANTED, Math.max(1_000_000, Math.ceil(sum * LAUNCH_GAS_BUFFER)));
  if (msgs.some(isAddDrop)) {
    wanted = Math.min(LAUNCH_MAX_GAS_WANTED, Math.max(wanted, LAUNCH_ADD_GAS_WANTED));
  }
  return wanted;
}

export type LaunchChain = {
  needsInit: boolean;
  reserved: boolean;
  wlPrice: number;
  wlSupply: number;
  wlStart: number;
  wlEnd: number;
  publicStart: number;
  publicEnd: number;
  wlCap: number;
  pubCap: number;
};

/**
 * After Init the factory drops the reservation, so Reserve would panic
 * `slug taken`. Rounds already stored are left alone so a reloaded form
 * cannot overwrite them while the remaining items upload.
 */
export function skipLaunchSetup(chain: LaunchChain): {
  reserve: boolean;
  init: boolean;
  sale: boolean;
  clock: boolean;
  caps: boolean;
} {
  const live = !chain.needsInit;
  return {
    reserve: live || chain.reserved,
    init: live,
    sale: live && (chain.wlPrice > 0 || chain.wlSupply > 0),
    clock: live && (chain.wlStart > 0 || chain.wlEnd > 0 || chain.publicStart > 0 || chain.publicEnd > 0),
    caps: live && (chain.wlCap > 0 || chain.pubCap > 0),
  };
}

/** Signature count the wizard shows. Uses the same packer as the real launch. */
export function dropSignatureCount(itemCount: number, setup = 6): number {
  const msgs: LaunchMsg[] = [];
  for (let i = 0; i < setup; i++) msgs.push({ func: "SetMintSchedule", args: ["0", "0", "0", "0"] });
  const line = "x".repeat(200);
  const n = Math.max(0, Math.floor(itemCount));
  for (let i = 0; i < n; i += DROP_ADD_CAP) {
    const take = Math.min(DROP_ADD_CAP, n - i);
    msgs.push({ func: "AddDropItems", args: [Array(take).fill(line).join("\n")] });
  }
  if (n > 0) msgs.push({ func: "ResumeMint", args: [] });
  return packLaunchTxs(msgs).length;
}

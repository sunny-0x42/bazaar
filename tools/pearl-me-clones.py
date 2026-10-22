"""Clone Magic Eden sample packs onto Pearl factoryv3. Password from GNOKEY_PASS. Never printed."""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _qeval import qeval  # noqa: E402

KEY = "deploykey"
REMOTE = "https://rpc.pearl.testnets.gno.land:443"
CHAIN = "pearl-1"
CREATOR = "g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt"
FACTORY = f"gno.land/r/{CREATOR}/bazaar/factoryv3"
ROOT = Path(__file__).resolve().parent.parent
PACK_PATH = ROOT / "web" / "public" / "samples" / "me-pearl-clones.json"
FROZEN = {"foam", "mist", "reef", "glow", "wave"}
TARGET_SLUGS = ("tffoxes", "ffoxes", "madlads")
LIST_PRICE = "1000000"
FEE_LIVE = "10000000"
CALL_GAS_FEE = "20000ugnot"
CALL_GAS_WANTED = "20000000"
HEAVY_GAS_FEE = "150000ugnot"
HEAVY_GAS_WANTED = "150000000"
ADDPKG_GAS_FEE = "250000ugnot"
ADDPKG_GAS_WANTED = "250000000"
ADDPKG_MAX_DEPOSIT = "10000000ugnot"
FACTORY_V2 = f"gno.land/r/{CREATOR}/bazaar/factoryv2"
NFTV7 = f"gno.land/r/{CREATOR}/bazaar/nftv7"


def unwrap_string(data: str) -> str:
    m = re.search(r'\("(.*)"\s+string\)', data or "", re.S)
    if not m:
        return data or ""
    return m.group(1).encode("utf-8").decode("unicode_escape")


def redact(text: str, password: str) -> str:
    out = text or ""
    if password:
        out = out.replace(password, "[redacted]")
    return re.sub(r"(?i)(mnemonic|seed phrase|secret|password)[^\n]*", r"\1 [redacted]", out)


def height_hash(text: str) -> tuple[str, str]:
    h = ""
    x = ""
    m = re.search(r"HEIGHT:\s+(\d+)", text)
    if m:
        h = m.group(1)
    m = re.search(r"TX HASH:\s+(\S+)", text)
    if m:
        x = m.group(1).strip()
    return h, x


def gnokey_call(pkg: str, func: str, args: list[str], send: str = "", gas_fee: str = CALL_GAS_FEE, gas_wanted: str = CALL_GAS_WANTED) -> str:
    password = os.environ.get("GNOKEY_PASS") or ""
    if not password:
        raise SystemExit("GNOKEY_PASS missing")
    exe = shutil.which("gnokey")
    if not exe:
        raise SystemExit("gnokey not found")
    cmd = [
        exe,
        "maketx",
        "call",
        KEY,
        "--pkgpath",
        pkg,
        "--func",
        func,
        "--gas-fee",
        gas_fee,
        "--gas-wanted",
        gas_wanted,
        "--chainid",
        CHAIN,
        "--remote",
        REMOTE,
        "--broadcast",
        "-insecure-password-stdin",
    ]
    if send:
        cmd.extend(["--send", send])
    for a in args:
        cmd.extend(["--args", a])
    proc = subprocess.run(cmd, input=(password + "\n").encode("utf-8"), capture_output=True)
    stdout = (proc.stdout or b"").decode("utf-8", errors="replace")
    stderr = (proc.stderr or b"").decode("utf-8", errors="replace")
    combined = redact(stdout + "\n" + stderr, password)
    h, x = height_hash(combined)
    print(f"OK {func} {pkg.rsplit('/', 1)[-1]} height={h} hash={x} exit={proc.returncode}", flush=True)
    if proc.returncode != 0:
        low = combined.lower()
        skip_needles = (
            "already initialized",
            "slug taken",
            "col: listed",
            "factory: no funds",
            "nft: no fees",
        )
        if any(n in low for n in skip_needles):
            print(f"SKIP {func} ({low.strip()[:180]})", flush=True)
            return combined
        if "invalid account password" in low:
            raise SystemExit(f"Failed: {func} - invalid password for key.")
        print(combined, flush=True)
        raise SystemExit(f"Failed: {func} (exit {proc.returncode})")
    return combined


def eval_pkg(pkg: str, expr: str) -> tuple[str, str]:
    data, err = qeval(expr, pkg)
    print(json.dumps({"pkg": pkg, "expr": expr, "data": data, "err": err}, ensure_ascii=False), flush=True)
    return data, err


def int_of(data: str) -> int | None:
    m = re.search(r"\((-?\d+)\s+int(?:64)?\)", data or "")
    if not m:
        return None
    return int(m.group(1))


def bool_of(data: str) -> bool | None:
    m = re.search(r"\((true|false)\s+bool\)", data or "")
    if not m:
        return None
    return m.group(1) == "true"


def col_pkg(slug: str) -> str:
    return f"gno.land/r/{CREATOR}/bazaar/c/{slug}"


def list_slugs() -> str:
    data, _ = eval_pkg(FACTORY, "ListCollections()")
    return unwrap_string(data).replace("\\n", "\n")


def has_slug(cols: str, slug: str) -> bool:
    return any(ln.startswith(slug + "|") for ln in cols.splitlines())


def launch_fee() -> int | None:
    data, _ = eval_pkg(FACTORY, "LaunchFee()")
    return int_of(data)


def bank_ugnot() -> int:
    exe = shutil.which("gnokey")
    if not exe:
        raise SystemExit("gnokey not found")
    proc = subprocess.run(
        [exe, "query", f"bank/balances/{CREATOR}", "--remote", REMOTE],
        capture_output=True,
    )
    text = ((proc.stdout or b"") + (proc.stderr or b"")).decode("utf-8", errors="replace")
    m = re.search(r"(\d+)ugnot", text)
    if not m:
        print(f"WARN bank parse {text[:400]}", flush=True)
        return 0
    n = int(m.group(1))
    print(f"BAL {n}ugnot", flush=True)
    return n


def addpkg(slug: str) -> None:
    ps1 = ROOT / "tools" / "pearl-new-col.ps1"
    cmd = [
        "powershell",
        "-NoProfile",
        "-File",
        str(ps1),
        "-Slug",
        slug,
        "-GasFee",
        ADDPKG_GAS_FEE,
        "-GasWanted",
        ADDPKG_GAS_WANTED,
        "-MaxDeposit",
        ADDPKG_MAX_DEPOSIT,
    ]
    print(f">> addpkg {slug}", flush=True)
    proc = subprocess.run(cmd, capture_output=True)
    password = os.environ.get("GNOKEY_PASS") or ""
    out = redact((proc.stdout or b"").decode("utf-8", errors="replace") + "\n" + (proc.stderr or b"").decode("utf-8", errors="replace"), password)
    print(out[-4000:], flush=True)
    if proc.returncode != 0:
        if "Already on chain" in out:
            return
        raise SystemExit(f"Failed: addpkg {slug} (exit {proc.returncode})")


def load_pack() -> list[dict]:
    packs = json.loads(PACK_PATH.read_text(encoding="utf-8"))
    by_slug = {p["slug"]: p for p in packs}
    out = []
    for slug in TARGET_SLUGS:
        if slug not in by_slug:
            raise SystemExit(f"pack missing {slug}")
        if slug in FROZEN:
            raise SystemExit(f"refusing frozen slug {slug}")
        p = by_slug[slug]
        if "/samples/" in (p.get("cover") or "") or "/samples/" in (p.get("blob") or ""):
            raise SystemExit(f"{slug} pack still has /samples thumbs")
        out.append(p)
    return out


def clone_one(pack: dict) -> None:
    slug = pack["slug"]
    pkg = col_pkg(slug)
    cols = list_slugs()
    if has_slug(cols, slug):
        print(f"RESUME {slug} already in ListCollections", flush=True)
    else:
        who = unwrap_string(eval_pkg(FACTORY, f'ReservedCreator("{slug}")')[0])
        if who == CREATOR:
            print(f"RESUME {slug} already reserved", flush=True)
        else:
            gnokey_call(FACTORY, "Reserve", [slug])

        addpkg(slug)
        minted_data, minted_err = eval_pkg(pkg, "Minted()")
        need_init = "call Init first" in (minted_err or "") or "call Init first" in (minted_data or "")
        if need_init:
            gnokey_call(
                pkg,
                "Init",
                [
                    str(pack["name"]),
                    slug,
                    str(pack["cover"]),
                    str(pack["maxSupply"]),
                    "0",
                    str(pack["royaltyBps"]),
                ],
                gas_fee=HEAVY_GAS_FEE,
                gas_wanted=HEAVY_GAS_WANTED,
            )
        else:
            print(f"RESUME {slug} already inited Minted={minted_data}", flush=True)

    loaded_data, loaded_err = eval_pkg(pkg, "LoadedOf()")
    loaded_n = int_of(loaded_data) or 0
    if "call Init first" in (loaded_err or ""):
        raise SystemExit(f"{slug} Init did not stick")
    if loaded_n < 8:
        blob = str(pack["blob"]).replace("\r\n", "\n").strip()
        lines = [ln for ln in blob.split("\n") if ln.strip()]
        if len(lines) != 8:
            raise SystemExit(f"{slug} blob lines={len(lines)}")
        gnokey_call(
            pkg,
            "AddDropItems",
            [blob],
            gas_fee=HEAVY_GAS_FEE,
            gas_wanted=HEAVY_GAS_WANTED,
        )
    else:
        print(f"RESUME {slug} slots loaded={loaded_n}", flush=True)

    minted_n = int_of(eval_pkg(pkg, "Minted()")[0]) or 0
    while minted_n < 8:
        gnokey_call(pkg, "PublicMint", [], gas_fee=HEAVY_GAS_FEE, gas_wanted=HEAVY_GAS_WANTED)
        minted_n = int_of(eval_pkg(pkg, "Minted()")[0]) or minted_n + 1
    print(f"{slug} minted={minted_n}", flush=True)

    for i in range(1, 5):
        listed = bool_of(eval_pkg(pkg, f"Listed({i})")[0])
        if listed:
            print(f"RESUME {slug} id={i} already listed", flush=True)
            continue
        gnokey_call(
            pkg,
            "List",
            [str(i), LIST_PRICE],
            gas_fee=HEAVY_GAS_FEE,
            gas_wanted=HEAVY_GAS_WANTED,
        )


def prove(packs: list[dict]) -> int:
    print("=== PROVE (python qeval factoryv3) ===", flush=True)
    cols = unwrap_string(eval_pkg(FACTORY, "ListCollections()")[0])
    fee = int_of(eval_pkg(FACTORY, "LaunchFee()")[0])
    ok = True
    results = []
    for pack in packs:
        slug = pack["slug"]
        pkg = col_pkg(slug)
        uri = unwrap_string(eval_pkg(pkg, "TokenURI(1)")[0])
        decoded = urllib.parse.unquote(uri)
        minted = int_of(eval_pkg(pkg, "Minted()")[0])
        addr = unwrap_string(eval_pkg(FACTORY, f'CollectionAddr("{slug}")')[0])
        cover_host_ok = any(
            h in decoded for h in ("famousfoxes.com", "madlads.s3", "arweave")
        )
        if not has_slug(cols, slug):
            print(f"FAIL ListCollections missing {slug}", file=sys.stderr)
            ok = False
        if minted != 8:
            print(f"FAIL {slug} Minted={minted}", file=sys.stderr)
            ok = False
        if "https://" not in decoded:
            print(f"FAIL {slug} TokenURI missing https://", file=sys.stderr)
            ok = False
        if not cover_host_ok:
            print(f"FAIL {slug} TokenURI host {uri[:180]}", file=sys.stderr)
            ok = False
        if "/samples/" in decoded:
            print(f"FAIL {slug} TokenURI still /samples thumb", file=sys.stderr)
            ok = False
        if not addr.startswith("g1"):
            print(f"FAIL {slug} CollectionAddr={addr!r}", file=sys.stderr)
            ok = False
        results.append((slug, addr, uri, minted))
    if fee != 10_000_000:
        print(f"FAIL LaunchFee={fee}", file=sys.stderr)
        ok = False
    for slug, addr, uri, minted in results:
        print(f"SLUG={slug}")
        print(f"ADDR={addr}")
        print(f"MINTED={minted}")
        print(f"TokenURI(1)={uri[:240]}")
        print(f"#/m/{slug}")
    if not ok:
        return 1
    print("ME_CLONES_OK")
    return 0


def main() -> int:
    os.environ["PATH"] = r"C:\Users\Hi\tools;" + os.environ.get("PATH", "")
    packs = load_pack()
    bank_ugnot()
    cols = list_slugs()
    for frozen in FROZEN:
        if has_slug(cols, frozen):
            print(f"NOTE factoryv3 already has {frozen} (untouched)", flush=True)
    fee_zeroed = False
    try:
        factory_bank, _ = eval_pkg(FACTORY, "Address()")
        print(f"factory Address {factory_bank}", flush=True)
        if bank_ugnot() < 25_000_000:
            gnokey_call(FACTORY, "Withdraw", [])
            gnokey_call(FACTORY_V2, "Withdraw", [])
            gnokey_call(NFTV7, "WithdrawFees", [])
        bank_ugnot()

        fee = launch_fee()
        if fee != 0:
            gnokey_call(FACTORY, "SetLaunchFee", ["0"])
            fee_zeroed = True
        else:
            print("RESUME LaunchFee already 0", flush=True)
            fee_zeroed = True

        fee = launch_fee()
        if fee != 0:
            raise SystemExit(f"LaunchFee did not go to 0: {fee}")

        for pack in packs:
            clone_one(pack)
    finally:
        if fee_zeroed:
            gnokey_call(FACTORY, "SetLaunchFee", [FEE_LIVE])
        else:
            print("NOTE LaunchFee not restored (never zeroed)", flush=True)

    return prove(packs)


if __name__ == "__main__":
    raise SystemExit(main())

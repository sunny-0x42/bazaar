"""Pearl vm/qeval. Usage: python tools/_qeval.py DropLine tide"""
from __future__ import annotations

import base64
import json
import re
import sys
import urllib.request

PKG = "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv7"
RPC = "https://rpc.pearl.testnets.gno.land:443"


def qeval(expr: str, pkg: str | None = None) -> tuple[str, str]:
    pkg = pkg or PKG
    payload = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "abci_query",
            "params": {
                "path": "vm/qeval",
                "data": base64.b64encode(f"{pkg}.{expr}".encode()).decode(),
                "prove": False,
            },
        }
    ).encode()
    req = urllib.request.Request(RPC, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode())
    result = body.get("result") or {}
    response = result.get("response") or {}
    base = response.get("ResponseBase") or {}
    err = base.get("Error")
    log = str(base.get("Log") or "")
    data = base.get("Data") or ""
    if data:
        try:
            data = base64.b64decode(data).decode("utf-8", errors="replace")
        except Exception:
            data = str(data)
    if err:
        return data, log or str(err)
    if body.get("error"):
        return data, str(body.get("error"))
    return data, ""


def build_expr(argv: list[str]) -> str:
    if not argv:
        return "LaunchFee()"
    func = argv[0]
    args = argv[1:]
    if not args:
        return f"{func}()"
    parts = []
    for a in args:
        if re.fullmatch(r"-?\d+", a):
            parts.append(a)
        else:
            parts.append(json.dumps(a))
    return f"{func}({', '.join(parts)})"


if __name__ == "__main__":
    argv = sys.argv[1:]
    pkg = PKG
    if len(argv) >= 2 and argv[0] in ("--pkg", "-p"):
        pkg = argv[1]
        argv = argv[2:]
    expr = build_expr(argv)
    try:
        data, err = qeval(expr, pkg)
        sys.stdout.write(json.dumps({"pkg": pkg, "expr": expr, "data": data, "err": err}, ensure_ascii=False))
    except Exception as exc:
        sys.stdout.write(json.dumps({"pkg": pkg, "expr": expr, "data": "", "err": str(exc)}, ensure_ascii=False))
        sys.exit(2)

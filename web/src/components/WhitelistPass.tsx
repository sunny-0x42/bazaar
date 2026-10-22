import { useEffect, useRef, useState } from "react";
import { shortAddr } from "../lib/chain";
import { crewTitle, GENESIS_SUPPLY, WLIST_CAP } from "../lib/wlist";

type Props = {
  place: number;
  handle: string;
  address: string;
};

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function bracket(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, t: number, flipX: boolean, flipY: boolean) {
  ctx.strokeStyle = "#2a85ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  ctx.moveTo(x, y + sy * len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + sx * len, y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0, 132, 255, 0.45)";
  ctx.lineWidth = t;
  ctx.stroke();
}

export async function renderWhitelistPass(props: Props): Promise<Blob | null> {
  const w = 1200;
  const h = 675;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  const g = ctx.createRadialGradient(280, 280, 40, 280, 320, 520);
  g.addColorStop(0, "rgba(42,133,255,0.22)");
  g.addColorStop(1, "#070b12");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(42,133,255,0.16)";
  ctx.lineWidth = 1;
  for (let x = 40; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 40; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  roundRect(ctx, 16, 16, w - 32, h - 32, 30);
  ctx.fillStyle = "rgba(10,15,24,0.88)";
  ctx.fill();
  ctx.shadowColor = "rgba(42,133,255,0.55)";
  ctx.shadowBlur = 28;
  ctx.strokeStyle = "rgba(42,133,255,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  let logo: HTMLImageElement | null = null;
  try {
    logo = await loadImg(`${window.location.origin}/bazaar-mark.svg`);
  } catch {
    logo = null;
  }
  if (logo) {
    ctx.shadowColor = "rgba(42,133,255,0.8)";
    ctx.shadowBlur = 18;
    ctx.drawImage(logo, 48, 36, 48, 48);
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = "#f4f7fb";
  ctx.font = "800 34px Inter, system-ui, sans-serif";
  ctx.fillText("Nomaq", 110, 70);
  ctx.fillStyle = "#2a85ff";
  ctx.font = "800 12px Inter, system-ui, sans-serif";
  ctx.fillText("MISSION CONTROL", 960, 56);

  const frameX = 48;
  const frameY = 108;
  const frameS = 438;
  ctx.shadowColor = "rgba(42,133,255,0.45)";
  ctx.shadowBlur = 32;
  roundRect(ctx, frameX, frameY, frameS, frameS, 24);
  ctx.fillStyle = "#101722";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#2a85ff";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.save();
  roundRect(ctx, frameX + 14, frameY + 14, frameS - 28, frameS - 28, 16);
  ctx.clip();
  const lg = ctx.createRadialGradient(frameX + frameS / 2, frameY + frameS / 2, 20, frameX + frameS / 2, frameY + frameS / 2, 220);
  lg.addColorStop(0, "rgba(42,133,255,0.35)");
  lg.addColorStop(1, "#0d1520");
  ctx.fillStyle = lg;
  ctx.fillRect(frameX, frameY, frameS, frameS);
  if (logo) {
    ctx.shadowColor = "rgba(42,133,255,0.95)";
    ctx.shadowBlur = 40;
    ctx.drawImage(logo, frameX + 99, frameY + 99, 240, 240);
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = "rgba(8,12,20,0.22)";
  for (let y = frameY + 16; y < frameY + frameS - 16; y += 3) {
    ctx.fillRect(frameX + 16, y, frameS - 32, 1);
  }
  ctx.restore();
  bracket(ctx, frameX + 22, frameY + 22, 28, 6, false, false);
  bracket(ctx, frameX + frameS - 22, frameY + 22, 28, 6, true, false);
  bracket(ctx, frameX + 22, frameY + frameS - 22, 28, 6, false, true);
  bracket(ctx, frameX + frameS - 22, frameY + frameS - 22, 28, 6, true, true);
  ctx.fillStyle = "#8b9bb0";
  ctx.font = "700 13px Inter, system-ui, sans-serif";
  ctx.fillText("CAM 01 · CREW", frameX + 36, frameY + 48);
  roundRect(ctx, frameX + 24, frameY + frameS - 64, 188, 36, 8);
  ctx.fillStyle = "#2a85ff";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "800 14px Inter, system-ui, sans-serif";
  ctx.fillText("GO FOR LAUNCH", frameX + 42, frameY + frameS - 40);

  const rx = 528;
  ctx.fillStyle = "#2a85ff";
  ctx.font = "800 13px Inter, system-ui, sans-serif";
  ctx.fillText(`RECRUITED FOR BAZAAR GENS ${GENESIS_SUPPLY.toLocaleString("en-US")}`, rx, 148);
  ctx.fillStyle = "#f4f7fb";
  ctx.font = "800 38px Inter, system-ui, sans-serif";
  ctx.fillText(crewTitle(props.place), rx, 204);
  let y = 248;
  if (props.handle) {
    ctx.fillStyle = "#d7e3f4";
    ctx.font = "700 28px Inter, system-ui, sans-serif";
    ctx.fillText(`@${props.handle}`, rx, y);
    y += 52;
  }
  ctx.fillStyle = "#8b9bb0";
  ctx.font = "700 13px Inter, system-ui, sans-serif";
  ctx.fillText("CREW NO.", rx, y);
  y += 88;
  ctx.fillStyle = "#f4f7fb";
  ctx.shadowColor = "rgba(42,133,255,0.55)";
  ctx.shadowBlur = 16;
  ctx.font = "800 96px Inter, system-ui, sans-serif";
  ctx.fillText(`#${String(props.place).padStart(3, "0")}`, rx, y);
  ctx.shadowBlur = 0;
  y += 48;
  ctx.fillStyle = "#8b9bb0";
  ctx.font = "600 16px Inter, system-ui, sans-serif";
  ctx.fillText(
    `11% PROTOCOL SHARE  ·  WHITELIST ${WLIST_CAP} FCFS  ·  ${GENESIS_SUPPLY.toLocaleString("en-US")} NFTS`,
    rx,
    y,
  );
  y += 30;
  ctx.fillText("PRE-REGISTERED  ·  28 SEP 2026 UTC", rx, y);
  y += 36;
  ctx.fillStyle = "#5b6b80";
  ctx.font = "600 16px ui-monospace, monospace";
  ctx.fillText(shortAddr(props.address), rx, y);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

export async function downloadWhitelistPass(props: Props) {
  const blob = await renderWhitelistPass(props);
  if (!blob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bazaar-genesis-${String(props.place).padStart(3, "0")}.jpg`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Fireworks() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const particles: { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }[] = [];
    const colors = ["#2a85ff", "#9ec5ff", "#f4f7fb", "#ffd36a", "#7ec8ff"];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    const burst = (x: number, y: number) => {
      for (let i = 0; i < 46; i++) {
        const angle = (Math.PI * 2 * i) / 46 + Math.random() * 0.2;
        const speed = 1.6 + Math.random() * 4.4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          max: 48 + Math.random() * 28,
          color: colors[i % colors.length],
          size: 2 + Math.random() * 2.2,
        });
      }
    };
    let raf = 0;
    let last = 0;
    let bursts = 0;
    const started = performance.now();
    const tick = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (now - started < 4200 && now - last > 420 && bursts < 9) {
        last = now;
        bursts += 1;
        burst(canvas.width * (0.18 + Math.random() * 0.64), canvas.height * (0.12 + Math.random() * 0.32));
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += 1;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        if (p.life > p.max) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (now - started < 5600 || particles.length > 0) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("resize", resize);
    burst(window.innerWidth * 0.32, window.innerHeight * 0.22);
    burst(window.innerWidth * 0.68, window.innerHeight * 0.18);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="pass-pop-fire" aria-hidden />;
}

export function PassCelebrate({ place, handle, address, onClose }: Props & { onClose: () => void }) {
  const [src, setSrc] = useState("");
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    let url = "";
    let live = true;
    void renderWhitelistPass({ place, handle, address }).then((blob) => {
      if (!live || !blob) return;
      url = URL.createObjectURL(blob);
      setSrc(url);
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey);
      if (url) URL.revokeObjectURL(url);
    };
  }, [place, handle, address]);
  return (
    <div className="pass-pop" role="presentation" onClick={() => closeRef.current()}>
      <Fireworks />
      <div
        className="pass-pop-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pass-pop-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="wpass-kicker">You're in</p>
        <h2 id="pass-pop-title">Whitelist pass</h2>
        {src ? (
          <img src={src} alt={`Bazaar Gens whitelist pass number ${place}`} />
        ) : (
          <p className="hint">Rendering pass…</p>
        )}
        <div className="pass-pop-actions">
          <button
            className="btn primary"
            type="button"
            disabled={!src || busy}
            onClick={() => {
              setBusy(true);
              void downloadWhitelistPass({ place, handle, address }).finally(() => setBusy(false));
            }}
          >
            {busy ? "Downloading…" : "Download"}
          </button>
          <button className="btn" type="button" onClick={() => closeRef.current()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function WhitelistPass({ place, handle, address }: Props) {
  const [busy, setBusy] = useState(false);
  const render = async () => {
    setBusy(true);
    try {
      await downloadWhitelistPass({ place, handle, address });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="wpass" key={`${place}-${handle}`}>
      <div className="wpass-cam">
        <span className="wpass-glow" aria-hidden />
        <img src="/bazaar-mark.svg" alt="" className="wpass-fallback" />
        <span className="wpass-scan" aria-hidden />
        <span className="wpass-stamp">Go for launch</span>
      </div>
      <div className="wpass-copy">
        <p className="wpass-kicker">Recruited for Bazaar Gens {GENESIS_SUPPLY.toLocaleString("en-US")}</p>
        <h3>{crewTitle(place)}</h3>
        {handle ? <p className="wpass-handle">@{handle}</p> : null}
        <p className="wpass-no">Crew no.</p>
        <p className="wpass-num">#{String(place).padStart(3, "0")}</p>
        <p className="wpass-meta">
          11% protocol share · WHITELIST {WLIST_CAP} FCFS · {GENESIS_SUPPLY.toLocaleString("en-US")} NFTs
        </p>
        {address ? <p className="wpass-addr mono">{shortAddr(address)}</p> : null}
        <button className="btn primary" type="button" disabled={busy} onClick={() => void render()}>
          {busy ? "Rendering…" : "Render pass"}
        </button>
      </div>
    </div>
  );
}

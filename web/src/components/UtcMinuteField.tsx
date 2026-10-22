import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { joinUtcMinute, splitUtcMinute } from "../lib/chain";

const OPEN_EVENT = "utc-minute-open";
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type Day = { y: number; m: number; d: number };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseYmd(value: string): Day | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function utcToday(): Day {
  const now = new Date();
  return { y: now.getUTCFullYear(), m: now.getUTCMonth(), d: now.getUTCDate() };
}

function shiftDay(day: Day, delta: number): Day {
  const next = new Date(Date.UTC(day.y, day.m, day.d + delta));
  return { y: next.getUTCFullYear(), m: next.getUTCMonth(), d: next.getUTCDate() };
}

function monthName(y: number, m: number): string {
  return new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Monday-first, six weeks. Dates are UTC so the OS calendar cannot shift the day. */
function monthGrid(y: number, m: number): { day: Day; outside: boolean }[] {
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(y, m, 1 - lead));
  const cells = Array.from({ length: 42 }, (_, i) => {
    const dt = new Date(start.getTime() + i * 86400000);
    const day = { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
    return { day, outside: day.m !== m || day.y !== y };
  });
  while (cells.length > 28 && cells.slice(-7).every((cell) => cell.outside)) cells.splice(-7, 7);
  return cells;
}

function hourOf(time: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
}

function minuteOf(time: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  return m ? m[2] : "00";
}

function sameDay(a: Day | null, b: Day | null): boolean {
  return !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d;
}

function placePopover(trigger: HTMLElement, pop: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const header = document.querySelector(".site-header");
  const topBound = (header ? header.getBoundingClientRect().bottom : 0) + 8;
  let bottomBound = window.innerHeight - 8;
  const nav = document.querySelector(".wizard-nav");
  if (nav) {
    const navRect = nav.getBoundingClientRect();
    if (navRect.top > window.innerHeight * 0.45 && navRect.top < window.innerHeight) {
      bottomBound = Math.min(bottomBound, navRect.top - 8);
    }
  }
  const free = Math.max(160, bottomBound - topBound);
  pop.style.maxHeight = `${free}px`;
  const width = pop.offsetWidth;
  const height = Math.min(pop.offsetHeight, free);
  let left = rect.left;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width;
  if (left < 8) left = 8;
  const spaceBelow = bottomBound - rect.bottom - 6;
  const spaceAbove = rect.top - topBound - 6;
  let top = spaceBelow >= height || spaceBelow >= spaceAbove ? rect.bottom + 6 : rect.top - 6 - height;
  if (top < topBound) top = topBound;
  if (top + height > bottomBound) top = Math.max(topBound, bottomBound - height);
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
}

export function UtcMinuteField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const uid = useId();
  const popId = `${uid}-pop`;
  const labelId = `${uid}-label`;
  const valueId = `${uid}-value`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<"day" | "hour" | "minute" | null>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"hour" | "minute">("hour");
  const [staged, setStaged] = useState<number | null>(null);
  const [stagedMinute, setStagedMinute] = useState<number | null>(null);
  const [view, setView] = useState(() => {
    const today = utcToday();
    return { y: today.y, m: today.m };
  });
  const [focusDay, setFocusDay] = useState<Day | null>(null);
  const [focusHour, setFocusHour] = useState(0);
  const [focusMinute, setFocusMinute] = useState(0);

  const parts = splitUtcMinute(value);
  const selected = parts.date ? parseYmd(parts.date) : null;
  const savedHour = hourOf(parts.time);
  const savedMinute = parts.time ? Number(minuteOf(parts.time)) : null;
  const shownHour = savedHour ?? staged ?? focusHour;
  const shownMinute = savedMinute ?? stagedMinute ?? 0;
  const today = utcToday();
  const cells = monthGrid(view.y, view.m);

  function shut(restore: boolean) {
    setOpen(false);
    setStaged(null);
    setStagedMinute(null);
    setPanel("hour");
    if (restore) triggerRef.current?.focus();
  }

  function commit(date: string, time: string) {
    const next = joinUtcMinute(date, time);
    if (next && next !== value) onChange(next);
  }

  function openPop() {
    const start = selected ?? utcToday();
    pendingFocus.current = "day";
    setView({ y: start.y, m: start.m });
    setFocusDay(start);
    setFocusHour(savedHour ?? staged ?? 0);
    setFocusMinute(savedMinute ?? stagedMinute ?? 0);
    setPanel("hour");
    setOpen(true);
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: uid }));
  }

  function pickDay(day: Day) {
    const date = ymd(day.y, day.m, day.d);
    setView({ y: day.y, m: day.m });
    setFocusDay(day);
    pendingFocus.current = "day";
    if (!parts.date && (staged != null || stagedMinute != null)) {
      commit(date, `${pad(staged ?? 0)}:${pad(stagedMinute ?? 0)}`);
      shut(true);
      return;
    }
    commit(date, parts.time || "00:00");
  }

  function pickHour(hour: number) {
    setFocusHour(hour);
    setPanel("minute");
    const minute = savedMinute ?? stagedMinute ?? 0;
    setFocusMinute(minute);
    pendingFocus.current = "minute";
    if (!parts.date) {
      setStaged(hour);
      return;
    }
    commit(parts.date, `${pad(hour)}:${pad(minute)}`);
  }

  function pickMinute(minute: number) {
    setFocusMinute(minute);
    const hour = savedHour ?? staged ?? focusHour;
    if (!parts.date) {
      setStaged(hour);
      setStagedMinute(minute);
      return;
    }
    const next = joinUtcMinute(parts.date, `${pad(hour)}:${pad(minute)}`);
    if (next && next !== value) onChange(next);
    shut(true);
  }

  function clearAll() {
    if (value) onChange("");
    shut(true);
  }

  function moveDay(delta: number) {
    const next = shiftDay(focusDay ?? selected ?? utcToday(), delta);
    setView({ y: next.y, m: next.m });
    setFocusDay(next);
    pendingFocus.current = "day";
    if (parts.date) commit(ymd(next.y, next.m, next.d), parts.time || "00:00");
  }

  function showMonth(delta: number, moveFocus: boolean) {
    const base = focusDay ?? selected ?? utcToday();
    const dt = new Date(Date.UTC(base.y, base.m + delta, 1));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const next = { y, m, d: Math.min(base.d, dim) };
    setView({ y, m });
    setFocusDay(next);
    pendingFocus.current = moveFocus ? "day" : null;
  }

  function weekEdge(end: boolean) {
    const base = focusDay ?? selected ?? utcToday();
    const dow = (new Date(Date.UTC(base.y, base.m, base.d)).getUTCDay() + 6) % 7;
    moveDay(end ? 6 - dow : -dow);
  }

  function moveHour(delta: number) {
    const cols = window.matchMedia("(max-width: 720px)").matches ? 6 : 4;
    const step = delta === 0 ? cols : delta;
    setFocusHour((cur) => Math.min(23, Math.max(0, cur + step)));
    pendingFocus.current = "hour";
  }

  function moveMinute(delta: number) {
    setFocusMinute((cur) => Math.min(59, Math.max(0, cur + delta)));
    pendingFocus.current = "minute";
  }

  useEffect(() => {
    function onOpen(e: Event) {
      if ((e as CustomEvent<string>).detail !== uid) {
        setOpen(false);
        setStaged(null);
        setStagedMinute(null);
        setPanel("hour");
      }
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: PointerEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
      setStaged(null);
      setStagedMinute(null);
      setPanel("hour");
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      setStaged(null);
      setStagedMinute(null);
      setPanel("hour");
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const pop = popRef.current;
    if (!trigger || !pop) return;
    const apply = () => placePopover(trigger, pop);
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("scroll", apply, true);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("scroll", apply, true);
    };
  }, [open, view.y, view.m, value, panel]);

  useLayoutEffect(() => {
    if (!open) return;
    const want = pendingFocus.current;
    if (!want) return;
    pendingFocus.current = null;
    const pop = popRef.current;
    if (!pop) return;
    if (want === "day" && focusDay) {
      pop.querySelector<HTMLButtonElement>(`[data-ymd="${ymd(focusDay.y, focusDay.m, focusDay.d)}"]`)?.focus();
    } else if (want === "hour") {
      pop.querySelector<HTMLButtonElement>(`[data-hour="${focusHour}"]`)?.focus();
    } else if (want === "minute") {
      const minuteBtn = pop.querySelector<HTMLButtonElement>(`[data-minute="${focusMinute}"]`);
      const scroller = minuteBtn?.parentElement;
      if (minuteBtn && scroller) {
        const top = minuteBtn.offsetTop;
        const bottom = top + minuteBtn.offsetHeight;
        if (top < scroller.scrollTop) scroller.scrollTop = top;
        else if (bottom > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = bottom - scroller.clientHeight;
      }
      minuteBtn?.focus({ preventScroll: true });
    }
  }, [open, focusDay, focusHour, focusMinute, view.y, view.m, panel]);

  function trapTab(e: ReactKeyboardEvent) {
    if (e.key !== "Tab") return;
    const pop = popRef.current;
    if (!pop) return;
    const items = [...pop.querySelectorAll<HTMLElement>("button")].filter((el) => el.tabIndex >= 0);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const saved = value ? `${value} UTC` : "No date yet. A date alone is 00:00 UTC.";

  const pop = open ? (
    <div
      ref={popRef}
      id={popId}
      className="utc-minute-pop"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={trapTab}
    >
      <div className="utc-minute-cal">
        <div className="utc-minute-head">
          <button type="button" className="utc-minute-nav" aria-label="Previous month" onClick={() => showMonth(-1, false)}>
            ‹
          </button>
          <strong className="utc-minute-month">{monthName(view.y, view.m)}</strong>
          <button type="button" className="utc-minute-nav" aria-label="Next month" onClick={() => showMonth(1, false)}>
            ›
          </button>
        </div>
        <div className="utc-minute-week">
          {WEEK.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div className="utc-minute-days">
          {cells.map(({ day, outside }) => {
            const key = ymd(day.y, day.m, day.d);
            const on = parts.date === key;
            const focused = sameDay(focusDay, day);
            return (
              <button
                key={key}
                type="button"
                className={`utc-minute-day${outside ? " is-out" : ""}${on ? " is-on" : ""}${sameDay(today, day) ? " is-today" : ""}`}
                data-ymd={key}
                tabIndex={focused || (!focusDay && on) ? 0 : -1}
                aria-pressed={on}
                aria-label={`${day.d} ${monthName(day.y, day.m)}`}
                onClick={() => pickDay(day)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") { e.preventDefault(); moveDay(-1); }
                  else if (e.key === "ArrowRight") { e.preventDefault(); moveDay(1); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); moveDay(-7); }
                  else if (e.key === "ArrowDown") { e.preventDefault(); moveDay(7); }
                  else if (e.key === "Home") { e.preventDefault(); weekEdge(false); }
                  else if (e.key === "End") { e.preventDefault(); weekEdge(true); }
                  else if (e.key === "PageUp") { e.preventDefault(); showMonth(-1, true); }
                  else if (e.key === "PageDown") { e.preventDefault(); showMonth(1, true); }
                }}
              >
                {day.d}
              </button>
            );
          })}
        </div>
      </div>
      <div className="utc-minute-side">
        <div className="utc-minute-switch">
          <button type="button" className={panel === "hour" ? "is-on" : ""} aria-pressed={panel === "hour"} onClick={() => setPanel("hour")}>
            Hour
          </button>
          <button
            type="button"
            className={panel === "minute" ? "is-on" : ""}
            aria-pressed={panel === "minute"}
            onClick={() => {
              setPanel("minute");
              pendingFocus.current = "minute";
            }}
          >
            Minute
          </button>
          <span className="num">{pad(shownHour)}:{pad(shownMinute)}</span>
        </div>
        {panel === "hour" ? (
          <div className="utc-minute-hours">
            {Array.from({ length: 24 }, (_, hour) => {
              const on = shownHour === hour && (savedHour === hour || staged === hour);
              const stagedOn = !parts.date && staged === hour;
              return (
                <button
                  key={hour}
                  type="button"
                  className={`utc-minute-hour${on ? " is-on" : ""}${stagedOn && !on ? " is-staged" : ""}`}
                  data-hour={hour}
                  tabIndex={focusHour === hour ? 0 : -1}
                  aria-pressed={on}
                  aria-label={`${pad(hour)}:${pad(shownMinute)}`}
                  onClick={() => pickHour(hour)}
                  onKeyDown={(e) => {
                    const cols = window.matchMedia("(max-width: 720px)").matches ? 6 : 4;
                    if (e.key === "ArrowLeft") { e.preventDefault(); moveHour(-1); }
                    else if (e.key === "ArrowRight") { e.preventDefault(); moveHour(1); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); moveHour(-cols); }
                    else if (e.key === "ArrowDown") { e.preventDefault(); moveHour(cols); }
                  }}
                >
                  {pad(hour)}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="utc-minute-mins">
            {Array.from({ length: 60 }, (_, minute) => {
              const on = shownMinute === minute && (savedMinute === minute || stagedMinute === minute);
              return (
                <button
                  key={minute}
                  type="button"
                  className={`utc-minute-min${on ? " is-on" : ""}`}
                  data-minute={minute}
                  tabIndex={focusMinute === minute ? 0 : -1}
                  aria-pressed={on}
                  aria-label={`${pad(shownHour)}:${pad(minute)}`}
                  onClick={() => pickMinute(minute)}
                  onKeyDown={(e) => {
                    const cols = window.matchMedia("(max-width: 720px)").matches ? 6 : 4;
                    if (e.key === "ArrowLeft") { e.preventDefault(); moveMinute(-1); }
                    else if (e.key === "ArrowRight") { e.preventDefault(); moveMinute(1); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); moveMinute(-cols); }
                    else if (e.key === "ArrowDown") { e.preventDefault(); moveMinute(cols); }
                  }}
                >
                  {pad(minute)}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {value ? (
        <div className="utc-minute-foot">
          <button type="button" className="utc-minute-foot-clear" onClick={clearAll}>
            Clear
          </button>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="utc-minute" ref={rootRef}>
      <span id={labelId}>{label}</span>
      <span className="utc-minute-control">
        <button
          ref={triggerRef}
          type="button"
          className={`utc-minute-btn${value ? "" : " is-empty"}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popId : undefined}
          aria-labelledby={`${labelId} ${valueId}`}
          onClick={() => (open ? shut(false) : openPop())}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              openPop();
            }
          }}
        >
          <span id={valueId} className={value ? "num" : undefined}>
            {value || "YYYY-MM-DD HH:MM"}
          </span>
          <svg className="select-caret" viewBox="0 0 12 8" width="10" height="7" aria-hidden>
            <path d="M1.2 1.4 6 6.2 10.8 1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        {value ? (
          <button type="button" className="utc-minute-clear" aria-label={`Clear ${label}`} onClick={clearAll}>
            ×
          </button>
        ) : null}
      </span>
      <span className="hint">{saved}</span>
      {pop ? createPortal(pop, document.body) : null}
    </div>
  );
}

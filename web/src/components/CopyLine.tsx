import { useState, type MouseEvent } from "react";

type Props = {
  display: string;
  value: string;
  label?: string;
  variant?: "chip" | "row";
};

function CopyIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M6.5 11.2 3.8 8.5l.9-.9 1.8 1.8 4.8-4.8.9.9z" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 2h6a1 1 0 0 1 1 1v8h-1.5V3.5H6V2zm-2.5 3H10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 1.5V14H10V6.5H3.5z"
      />
    </svg>
  );
}

export function CopyLine({ display, value, label, variant = "chip" }: Props) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  async function copy(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }
  const aria = copied ? "Copied" : `Copy ${label || display}`;
  if (variant === "row") {
    return (
      <button className="copy-row" type="button" title={value} aria-label={aria} onClick={(e) => void copy(e)}>
        {label ? <span className="copy-label">{label}</span> : null}
        <span className="copy-row-text mono">{display}</span>
        <span className="copy-row-icon" aria-hidden="true">
          <CopyIcon copied={copied} />
        </span>
      </button>
    );
  }
  return (
    <span className="copy-chip" title={value}>
      {label ? <span className="copy-label">{label}</span> : null}
      <span className="copy-chip-text mono">{display}</span>
      <button className="copy-chip-btn" type="button" aria-label={aria} onClick={(e) => void copy(e)}>
        <CopyIcon copied={copied} />
      </button>
    </span>
  );
}

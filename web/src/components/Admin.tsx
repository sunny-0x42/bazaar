import { useEffect, useState } from "react";
import type { ChainCollection } from "../lib/chain";
import { EmptyState } from "./EmptyState";

type Props = {
  allowed: boolean;
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  drops: ChainCollection[];
  featured: string[];
  onSave: (slugs: string[]) => void;
  onConnect: () => void;
};

const MAX = 8;

export function Admin({ allowed, connected, blocked, busy, drops, featured, onSave, onConnect }: Props) {
  if (!connected) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Admin</h1>
        </header>
        <EmptyState title="Connect the deploy wallet" body="This page is only for the realm admin.">
          <button className="btn primary" type="button" onClick={onConnect}>
            Connect Adena
          </button>
        </EmptyState>
      </section>
    );
  }
  if (!allowed) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Admin</h1>
        </header>
        <EmptyState title="Not admin" body="This page is only for the realm admin." />
      </section>
    );
  }

  const launchpads = drops.filter((col) => col.drop);
  const known = new Set(launchpads.map((d) => d.slug));
  const initial = featured.filter((slug) => known.has(slug));

  return (
    <AdminForm blocked={blocked} busy={busy} launchpads={launchpads} initial={initial} onSave={onSave} />
  );
}

function AdminForm({
  blocked,
  busy,
  launchpads,
  initial,
  onSave,
}: {
  blocked: boolean;
  busy: boolean;
  launchpads: ChainCollection[];
  initial: string[];
  onSave: (slugs: string[]) => void;
}) {
  const initialKey = initial.join(",");
  const [picked, setPicked] = useState(() => (initialKey ? initialKey.split(",") : []));
  useEffect(() => {
    setPicked(initialKey ? initialKey.split(",") : []);
  }, [initialKey]);

  const rest = launchpads.filter((d) => !picked.includes(d.slug));
  const rows = [
    ...picked.map((slug) => launchpads.find((d) => d.slug === slug)).filter((col): col is ChainCollection => !!col),
    ...rest,
  ];

  function toggle(slug: string) {
    setPicked((cur) => {
      if (cur.includes(slug)) return cur.filter((s) => s !== slug);
      if (cur.length >= MAX) return cur;
      return [...cur, slug];
    });
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>Admin</h1>
        <p className="muted">Pick featured launchpads. Up to {MAX}, in the order you tick. Collection cards on Explore rank by volume on their own.</p>
      </header>
      <div className="panel form-narrow">
        <div className="field-group">
          <h2>Featured launchpads</h2>
          <p className="hint">Empty list hides the launchpad row. Save signs SetFeatured. Featured collections use volume, not this list.</p>
          {launchpads.length === 0 ? (
            <p className="muted">No launchpad drops on this book yet.</p>
          ) : (
            <ul className="admin-drop-list">
              {rows.map((col) => {
                const on = picked.includes(col.slug);
                const idx = picked.indexOf(col.slug);
                return (
                  <li key={col.slug}>
                    <label className="admin-drop">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={blocked || busy || (!on && picked.length >= MAX)}
                        onChange={() => toggle(col.slug)}
                      />
                      <span>
                        {on ? <span className="muted">{idx + 1}. </span> : null}
                        <strong>{col.name}</strong> <span className="mono muted">{col.slug}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <button className="btn primary" type="button" disabled={blocked || busy} onClick={() => onSave(picked)}>
            Save featured
          </button>
        </div>
      </div>
    </section>
  );
}

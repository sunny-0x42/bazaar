import { useMemo, useState } from "react";
import { traitGroups, type Item } from "../lib/chain";

type Props = {
  items: Item[];
  listedOnly: boolean;
  onListedOnly: (v: boolean) => void;
  minGnot: string;
  maxGnot: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  selected: Record<string, string[]>;
  onToggle: (type: string, value: string) => void;
  onClear: () => void;
};

export function TraitFilters({
  items,
  listedOnly,
  onListedOnly,
  minGnot,
  maxGnot,
  onMin,
  onMax,
  selected,
  onToggle,
  onClear,
}: Props) {
  const groups = useMemo(() => traitGroups(items), [items]);
  const [open, setOpen] = useState<Record<string, boolean>>({ Rarity: true });
  const active = Object.values(selected).reduce((n, v) => n + v.length, 0) + (listedOnly ? 1 : 0);

  return (
    <aside className="trait-filters" aria-label="Filters">
      <div className="trait-filters-head">
        <h2>Filters</h2>
        {active > 0 ? (
          <button className="text-btn" type="button" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>

      <fieldset>
        <legend>Status</legend>
        <label className="trait-check">
          <input type="checkbox" checked={listedOnly} onChange={(e) => onListedOnly(e.target.checked)} />
          Listed
        </label>
      </fieldset>

      <fieldset>
        <legend>Price (GNOT)</legend>
        <div className="trait-price">
          <input value={minGnot} onChange={(e) => onMin(e.target.value)} inputMode="decimal" placeholder="Min" aria-label="Min GNOT" />
          <span className="muted">–</span>
          <input value={maxGnot} onChange={(e) => onMax(e.target.value)} inputMode="decimal" placeholder="Max" aria-label="Max GNOT" />
        </div>
      </fieldset>

      {groups.map((g) => {
        const isOpen = open[g.type] !== false;
        const picked = selected[g.type] || [];
        return (
          <div className="trait-group" key={g.type}>
            <button
              type="button"
              className="trait-group-head"
              aria-expanded={isOpen}
              onClick={() => setOpen((s) => ({ ...s, [g.type]: !isOpen }))}
            >
              {g.type}
              {picked.length ? <span className="muted">{picked.length}</span> : null}
            </button>
            {isOpen ? (
              <ul>
                {g.values.map((row) => {
                  const on = picked.includes(row.value);
                  return (
                    <li key={row.value}>
                      <label className="trait-check">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => onToggle(g.type, row.value)}
                        />
                        <span>{row.value}</span>
                        <span className="muted">{row.count}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </aside>
  );
}

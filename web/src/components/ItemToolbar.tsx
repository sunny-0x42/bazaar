import type { ReactNode } from "react";
import { ITEM_RARITIES, type ItemSort, type SortDir } from "../lib/chain";
import { Select } from "./Select";

type Props = {
  countLabel: string;
  rarity: string;
  minGnot: string;
  maxGnot: string;
  sort?: ItemSort;
  dir?: SortDir;
  onRarity: (v: string) => void;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  onSort?: (v: ItemSort) => void;
  onDir?: () => void;
  compact?: boolean;
  extra?: ReactNode;
};

export function ItemToolbar({
  countLabel,
  rarity,
  minGnot,
  maxGnot,
  sort,
  dir,
  onRarity,
  onMin,
  onMax,
  onSort,
  onDir,
  compact,
  extra,
}: Props) {
  return (
    <div className="toolbar">
      <p className="muted toolbar-count">{countLabel}</p>
      {compact ? null : (
        <>
      <Select
        ariaLabel="Rarity"
        value={rarity}
        onChange={onRarity}
        options={[{ value: "all", label: "All rarities" }, ...ITEM_RARITIES.map((row) => ({ value: row, label: row }))]}
      />
      <label className="price-field">
        <span className="sr-only">Min GNOT</span>
        <input
          value={minGnot}
          onChange={(e) => onMin(e.target.value)}
          inputMode="decimal"
          placeholder="Min"
          aria-label="Min GNOT"
        />
      </label>
      <label className="price-field">
        <span className="sr-only">Max GNOT</span>
        <input
          value={maxGnot}
          onChange={(e) => onMax(e.target.value)}
          inputMode="decimal"
          placeholder="Max"
          aria-label="Max GNOT"
        />
      </label>
        </>
      )}
      {onSort && sort ? (
        <Select
          ariaLabel="Sort items"
          value={sort}
          onChange={(v) => onSort(v as ItemSort)}
          options={[
            { value: "price", label: "Price" },
            { value: "name", label: "Name" },
            { value: "id", label: "Id" },
          ]}
        />
      ) : null}
      {onDir && dir ? (
        <button
          className="icon-btn"
          type="button"
          aria-label={dir === "asc" ? "Sort descending" : "Sort ascending"}
          onClick={onDir}
        >
          {dir === "asc" ? "↑" : "↓"}
        </button>
      ) : null}
      {extra}
    </div>
  );
}

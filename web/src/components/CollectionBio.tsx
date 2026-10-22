import { useEffect, useState } from "react";
import { sameAddr } from "../lib/chain";
import { absMetaImage, applyPageMeta, collectionTitle, fallbackBio } from "../lib/pagemeta";

type Props = {
  slug: string;
  chainBio: string;
  creator: string;
  wallet: string;
  name: string;
  cover: string;
};

export function CollectionBio({ slug, chainBio, creator, wallet, name, cover }: Props) {
  const [saved, setSaved] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    setSaved(null);
    fetch(`/api/bio?slug=${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((body) => {
        if (live) setSaved(typeof body.description === "string" ? body.description : "");
      })
      .catch(() => {
        if (live) setSaved("");
      });
    return () => {
      live = false;
    };
  }, [slug]);

  const shown =
    (saved != null ? saved : String(chainBio || "")).trim() ||
    (slug === "bazaargens" ? fallbackBio(slug, name) : "");

  if (editing) {
    return (
      <form
        className="bio-edit"
        onSubmit={(e) => {
          e.preventDefault();
          setErr("");
          setBusy(true);
          fetch("/api/bio", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slug, description: draft, address: wallet || "" }),
          })
            .then(async (res) => {
              const body = await res.json();
              if (!res.ok || body.ok === false) {
                throw new Error(
                  body.error === "creator"
                    ? "Connect the creator wallet to edit this description."
                    : "Could not save the description.",
                );
              }
              const next = typeof body.description === "string" ? body.description : "";
              setSaved(next);
              setEditing(false);
              applyPageMeta({
                title: collectionTitle(name || slug),
                description: next || shown,
                image: absMetaImage(cover),
                url: `https://nomaq.xyz/c/${slug}`,
                card: "summary",
              });
            })
            .catch((error) => {
              setErr(error instanceof Error ? error.message : "Could not save the description.");
            })
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Description
          <textarea value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <span className="hint">{draft.trim().length}/200. Shown on the collection and in the link preview.</span>
        {err ? <p className="bio-error">{err}</p> : null}
        <div className="bio-edit-actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Saving" : "Save"}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setEditing(false);
              setErr("");
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="bio-block">
      {shown ? <p className="collection-bio">{shown}</p> : null}
      {sameAddr(wallet, creator) ? (
        <button
          className="text-btn bio-add"
          type="button"
          onClick={() => {
            setDraft(shown);
            setErr("");
            setEditing(true);
          }}
        >
          {shown ? "Edit description" : "Add description"}
        </button>
      ) : null}
    </div>
  );
}

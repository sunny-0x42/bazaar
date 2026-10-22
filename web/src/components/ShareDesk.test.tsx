import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareDesk } from "./ShareDesk";

const view = {
  perkPkg: "gno.land/r/demo/perk",
  minted: 218,
  totalWeight: 0,
  accountedUgnot: 0,
  poolUgnot: 2_398_000,
};

describe("ShareDesk", () => {
  it("shows the next span and holds the button until the backlog is accepted", () => {
    const html = renderToStaticMarkup(
      <ShareDesk
        rpc=""
        factory=""
        collection=""
        blocked={false}
        busy={false}
        onSyncSpan={async () => false}
        preview={view}
      />,
    );
    expect(html).toContain("Share desk");
    expect(html).toContain("2.40 GNOT");
    expect(html).toContain('data-next="1-20"');
    expect(html).toContain("Next span 1–20 of 218 minted.");
    expect(html).toContain("first NFT this records");
    expect(html).toContain("disabled");
    expect(html).toContain(">Record 1–20<");
  });

  it("opens the button once weight is already recorded", () => {
    const html = renderToStaticMarkup(
      <ShareDesk
        rpc=""
        factory=""
        collection=""
        blocked={false}
        busy={false}
        onSyncSpan={async () => false}
        preview={{ ...view, totalWeight: 25, poolUgnot: 2_398_000, accountedUgnot: 2_398_000 }}
      />,
    );
    expect(html).not.toContain("first NFT this records");
    expect(html).toContain('<button class="btn primary" type="button">Record 1–20</button>');
  });

  it("does not treat an unsettled perk2 pool as a first-sync capture", () => {
    const html = renderToStaticMarkup(
      <ShareDesk
        rpc=""
        factory=""
        collection=""
        blocked={false}
        busy={false}
        onSyncSpan={async () => false}
        preview={{ ...view, epoch: true, unsettledUgnot: 2_456_437, poolUgnot: 2_456_437 }}
      />,
    );
    expect(html).toContain("does not pay GNOT");
    expect(html).toContain("2.456437 GNOT");
    expect(html).not.toContain("first NFT this records");
    expect(html).toContain('<button class="btn primary" type="button">Record 1–20</button>');
    expect(html).toContain("Settle needs recorded weight");
    expect(html).toContain(">Settle<");
  });

  it("holds Settle until this signature is accepted", () => {
    const html = renderToStaticMarkup(
      <ShareDesk
        rpc=""
        factory=""
        collection=""
        blocked={false}
        busy={false}
        onSyncSpan={async () => false}
        onSettle={async () => false}
        preview={{ ...view, epoch: true, totalWeight: 9_175, unsettledUgnot: 4_147_687, poolUgnot: 4_147_687 }}
      />,
    );
    expect(html).toContain("Split 4.147687 GNOT (4,147,687 ugnot) across weight 9,175 now.");
    expect(html).toContain("Weight synced later joins the next Settle.");
    expect(html).toContain('<button class="btn primary" type="button" disabled="">Settle</button>');
  });
});

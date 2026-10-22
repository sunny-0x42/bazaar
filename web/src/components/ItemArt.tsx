import { useState } from "react";
import { artSrc, isArtSrc } from "../lib/chain";
import { TokenMark } from "./TokenMark";

type Props = {
  name: string;
  image: string;
  size?: number;
  alt?: string;
  /** Hero and mint covers. Grid cards stay lazy so the first screen is not blocked on every image. */
  priority?: boolean;
};

export function ItemArt({ name, image, size, alt = "", priority = false }: Props) {
  const url = artSrc(image);
  const [brokenFor, setBrokenFor] = useState("");
  const show = isArtSrc(image.trim()) && brokenFor !== url;
  const loading = priority ? "eager" : "lazy";

  if (size) {
    return show ? (
      <img
        className="item-art-thumb"
        src={url}
        alt={alt}
        width={size}
        height={size}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setBrokenFor(url)}
      />
    ) : (
      <TokenMark symbol={name} size={size} />
    );
  }

  return (
    <div className="item-art">
      {show ? (
        <img
          src={url}
          alt={alt}
          loading={loading}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBrokenFor(url)}
        />
      ) : (
        <TokenMark symbol={name} fill />
      )}
    </div>
  );
}

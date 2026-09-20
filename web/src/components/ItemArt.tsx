import { useState } from "react";
import { artSrc, isArtSrc } from "../lib/chain";
import { TokenMark } from "./TokenMark";

type Props = {
  name: string;
  image: string;
  size?: number;
  alt?: string;
};

export function ItemArt({ name, image, size, alt = "" }: Props) {
  const url = artSrc(image);
  const [brokenFor, setBrokenFor] = useState("");
  const show = isArtSrc(image.trim()) && brokenFor !== url;

  if (size) {
    return show ? (
      <img
        className="item-art-thumb"
        src={url}
        alt={alt}
        width={size}
        height={size}
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
        <img src={url} alt={alt} referrerPolicy="no-referrer" onError={() => setBrokenFor(url)} />
      ) : (
        <TokenMark symbol={name} fill />
      )}
    </div>
  );
}

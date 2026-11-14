import type { CSSProperties } from "react";
import { MAP_SCENERY } from "./KqPlacardMap.scene";
import sprites from "./KqPlacardMap.sprites.json";
import styles from "./KqPlacardMapAtmosphere.module.css";

type Sprite = typeof sprites.items[number];

function position(sprite: Sprite): CSSProperties {
  return { left: `${sprite.x / 1536 * 100}%`, top: `${sprite.y / 1024 * 100}%`, width: `${sprite.width / 1536 * 100}%`, height: `${sprite.height / 1024 * 100}%` };
}

function texture(sprite: Sprite): CSSProperties {
  return {
    backgroundImage: `url(${sprites.asset})`,
    backgroundSize: `${sprites.width / sprite.width * 100}% ${sprites.height / sprite.height * 100}%`,
    backgroundPosition: `${sprite.atlasX / (sprites.width - sprite.width) * 100}% ${sprite.atlasY / (sprites.height - sprite.height) * 100}%`,
  };
}

/** The original cuts are baked into a texture so mobile browsers animate HTML layers. */
export function KqPlacardMapScenery() {
  return <div className={styles.scenery} data-map-scenery>
    {sprites.items.filter(sprite => sprite.kind === "back").map(sprite =>
      <div key={sprite.id} className={styles.sceneryPiece} style={{ ...position(sprite), ...texture(sprite) }} />)}
    {MAP_SCENERY.map(piece => {
      const sprite = sprites.items.find(sprite => sprite.kind === "art" && sprite.id === piece.id)!;
      const origin = `${(piece.anchor[0] - sprite.x) / sprite.width * 100}% ${(piece.anchor[1] - sprite.y) / sprite.height * 100}%`;
      return <div key={piece.id} className={styles.sceneryPiece} style={position(sprite)} data-scenery-reaction={piece.building}>
        <div className={styles.sceneryArt} style={texture(sprite)} data-scenery-motion={piece.id} data-scenery-origin={origin} />
      </div>;
    })}
  </div>;
}

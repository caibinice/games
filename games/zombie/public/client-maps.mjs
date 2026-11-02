import { CLIENT_MAPS, CLIENT_LEVEL_MAPS } from './client-map-data.mjs';

// Source IDs, not chapter colours or round-robin choices. Old inline stages and
// lazy activity stages share the same native LevelID -> MapID mapping.
export function clientMap(stage) {
  const id = stage?.base?.MapID ?? CLIENT_LEVEL_MAPS[stage?.LevelID];
  return CLIENT_MAPS[id] || null;
}

export function mapDestination(width, imageWidth, imageHeight) {
  return { x: 0, y: 0, width, height: (width * imageHeight) / imageWidth };
}

// Keep only the current map; long sessions do not pin every map image in memory.
// While loading/failed/missing, the caller draws its explicit screenshot fallback.
export function createClientMaps(context, ImageClass = globalThis.Image) {
  let current = null,
    image = null;
  return {
    select(stage) {
      const next = clientMap(stage);
      if (current === next) return;
      current = next;
      image = null;
      if (next?.file) {
        image = new ImageClass();
        image.src = new URL(next.file, import.meta.url);
      }
    },
    draw(width = 540) {
      if (!image?.complete || !image.naturalWidth) return false;
      const dest = mapDestination(width, image.naturalWidth, image.naturalHeight);
      context.fillStyle = '#4c4b43';
      context.fillRect(0, 0, width, 1200);
      context.drawImage(image, dest.x, dest.y, dest.width, dest.height);
      return true;
    },
    get mapId() {
      return current?.MapID || null;
    },
  };
}

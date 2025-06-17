import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import * as olSize from "ol/size";
import { useMemo } from "react";
import TileState from "ol/TileState";
import { svgUrlToBitmapDataUrl } from "./svg-to-bitmap";

export default function useMapLayer({
  map,
  projection,
  tileWorker,
  onError,
  onSuccess,
}) {
  return useMemo(() => {
    if (!(map && projection && tileWorker)) return;

    const source = new XYZ({
      projection,
      tileLoadFunction: loadTile,
      url: "{z}/{x}/{y}.png",
    });

    // Håll reda på pågående tile‐löften
    const awaitedTiles = {};

    tileWorker.onmessage = async ({ data }) => {
      const { type, tileId, url, error } = data;

      switch (type) {
        case "READY":
          // Initial READY från SET_MAP_FILE – inget extra
          return;

        case "TILER_READY":
          // Worker har applicerat nytt includeSymbols‐filter
          // Tvinga OL att refresha alla tiles
          source.refresh();
          return;

        case "TILE": {
          const tileData = awaitedTiles[tileId];
          if (!tileData) {
            console.warn(`Received unknown tile ${tileId}.`);
            return;
          }
          const { tile, resolve, reject } = tileData;
          try {
            const tileGrid = source.getTileGrid();
            const tileSize = olSize.toSize(
              tileGrid.getTileSize(tile.tileCoord[0])
            );
            const bitmapUrl = await svgUrlToBitmapDataUrl(url, tileSize);
            const img = tile.getImage();
            img.src = bitmapUrl;
            img.addEventListener("load", () => {
              // URL.revokeObjectURL(bitmapUrl);
            });
            delete awaitedTiles[tileId];
            onSuccess();
            resolve();
          } catch (e) {
            delete awaitedTiles[tileId];
            reject(e);
          }
          return;
        }

        case "ERROR":
          onError(error);
          return;

        default:
          console.warn(`Unknown message type "${type}".`);
      }
    };

    return new TileLayer({ source });

    function loadTile(tile) {
      return new Promise((resolve, reject) => {
        if (tile.getImage().src) {
          // Redan laddad
          resolve();
          return;
        }
        try {
          const { tileCoord } = tile;
          const [z] = tileCoord;
          const tileGrid = source.getTileGrid();
          const resolution = tileGrid.getResolution(z);
          const tileSize = olSize.toSize(tileGrid.getTileSize(z));
          const extent = tileGrid.getTileCoordExtent(tileCoord);
          const tileId = tileCoord.join("/");

          awaitedTiles[tileId] = { tile, resolve, reject };
          tileWorker.postMessage({
            type: "GET_TILE",
            tileId,
            extent,
            resolution,
            tileSize,
          });
        } catch (e) {
          onError(e);
          tile.setState(TileState.ERROR);
          reject(e);
        }
      });
    }
  }, [map, projection, tileWorker, onSuccess, onError]);
}

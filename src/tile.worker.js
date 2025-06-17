import { readMap } from "./services/map";
import OcadTiler from "./services/ocad-tiler";
import { svgToUrl } from "./services/svg-to-bitmap";
import { XMLSerializer, DOMImplementation } from "@xmldom/xmldom";

const domImplementation = new DOMImplementation();

// Worker state
let tiler;

onmessage = async function ({ data }) {
  try {
    switch (data.type) {
      case "SET_MAP_FILE": {
        const mapFile = await readMap(data.blob);
        tiler = new OcadTiler(mapFile);
        postMessage({ type: "READY" });
        break;
      }

      case "SET_TILER": {
        // Hantera uppdatering av includeSymbols
        if (!tiler) throw new Error("Tiler not initialized");
        const opts = data.options || {};
        // Skapa en ny tiler-instans med includeSymbols från den befintliga ocadFile
        tiler = new OcadTiler(tiler.ocadFile, { includeSymbols: opts.includeSymbols });
        postMessage({ type: "TILER_READY" });
        break;
      }

      case "GET_TILE": {
        const { tileId, extent, resolution, tileSize } = data;
        const svg = tiler.renderSvg(extent, resolution, {
          DOMImplementation: domImplementation,
        });
        svg.setAttributeNS(null, "width", tileSize[0]);
        svg.setAttributeNS(null, "height", tileSize[1]);
        svg.setAttribute("viewBox", `0 0 ${tileSize[0]} ${tileSize[1]}`);
        fixIds(svg);
        postMessage({ type: "TILE", tileId, url: svgToUrl(svg, new XMLSerializer()) });
        break;
      }

      default:
        throw new Error(`Unhandled message type "${data.type}".`);
    }
  } catch (e) {
    postMessage({ type: "ERROR", request: data, error: { message: e.message, stack: e.stack } });
  }
};

// I xmldom representeras id som attribut, inte property
function fixIds(n) {
  if (n.id) {
    n.setAttributeNS("http://www.w3.org/2000/svg", "id", n.id);
  }
  if (n.childNodes) {
    for (let i = 0; i < n.childNodes.length; i++) {
      fixIds(n.childNodes[i]);
    }
  }
}

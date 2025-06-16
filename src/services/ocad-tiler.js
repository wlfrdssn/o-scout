import { ocadToSvg } from 'ocad2geojson/src/ocad-to-svg'
import Flatbush from 'flatbush'

const defaultDOMImplementation = getDefaultDOMImplementation()
const hundredsMmToMeter = 1 / (100 * 1000)

export default class OcadTiler {
  constructor(ocadFile, options) {
    this.options = {
      ...options,
    }

    this.ocadFile = ocadFile
    this.index = new Flatbush(this.ocadFile.objects.length)

    const bounds = [
      Number.MAX_VALUE,
      Number.MAX_VALUE,
      -Number.MAX_VALUE,
      -Number.MAX_VALUE,
    ]

    for (const o of this.ocadFile.objects) {
      let minX = Number.MAX_VALUE
      let minY = Number.MAX_VALUE
      let maxX = -Number.MAX_VALUE
      let maxY = -Number.MAX_VALUE

      for (const [x, y] of o.coordinates) {
        minX = Math.min(x, minX)
        minY = Math.min(y, minY)
        maxX = Math.max(x, maxX)
        maxY = Math.max(y, maxY)
      }
      this.index.add(minX, minY, maxX, maxY)

      bounds[0] = Math.min(minX, bounds[0])
      bounds[1] = Math.min(minY, bounds[1])
      bounds[2] = Math.max(maxX, bounds[2])
      bounds[3] = Math.max(maxY, bounds[3])
    }

    this.index.finish()
    const crs = ocadFile.getCrs()
    this.bounds = mapExtentToProjected(bounds, crs)
  }

  

renderSvg(extent, resolution, options = {}) {
  // Sätt mergedOptions: anropsvärden har företräde, men fallback till this.options
  const mergedOptions = {
    includeSymbols: this.options.includeSymbols,
    minSym: this.options.minSym,
    maxSym: this.options.maxSym,
    // ev. andra defaultfält som du vill ärva
    ...options,
  };

  console.log('🔍 renderSvg anropad med mergedOptions:', mergedOptions);
  // ... använd mergedOptions i filtreringen:
  let objects = this.getObjects(extent, (mergedOptions.buffer || 256) * resolution);

  // Filtrera på includeSymbols om det finns en icke-tom array
  if (Array.isArray(mergedOptions.includeSymbols) && mergedOptions.includeSymbols.length > 0) {
    console.log('🔍 Filtrerar med includeSymbols:', mergedOptions.includeSymbols);
    const includeSet = new Set(
      mergedOptions.includeSymbols.map(v => {
        // konvertera sträng till number om nödvändigt
        if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
        return v;
      })
    );
    objects = objects.filter(o => {
      const symNum = typeof o.sym === 'string' ? Number(o.sym) : o.sym;
      const match = includeSet.has(symNum);
      console.log(`   ▶️ include filter testar sym=${symNum}, keep?`, match);
      return match;
    });
    console.log('🔍 Efter includeSymbols-filter, objects.length =', objects.length);
  } else {
    console.log('🔍 Ingen includeSymbols-filtrering (array saknas eller tom).');
  }

  // Range-filtrering om satt
  const hasMin = mergedOptions.minSym != null && !isNaN(Number(mergedOptions.minSym));
  const hasMax = mergedOptions.maxSym != null && !isNaN(Number(mergedOptions.maxSym));
  console.log('🔍 minSym/maxSym:', mergedOptions.minSym, mergedOptions.maxSym, 'hasMin/hasMax:', hasMin, hasMax);
  if (hasMin || hasMax) {
    const min = hasMin ? Number(mergedOptions.minSym) : -Infinity;
    const max = hasMax ? Number(mergedOptions.maxSym) : Infinity;
    objects = objects.filter(o => {
      const symNum = typeof o.sym === 'string' ? Number(o.sym) : o.sym;
      const keep = symNum >= min && symNum <= max;
      console.log(`   ▶️ range filter testar sym=${symNum}, keep?`, keep);
      return keep;
    });
    console.log('🔍 Efter range-filter, objects.length =', objects.length);
  } else {
    console.log('🔍 Ingen range-filtrering.');
  }

  // Kontrollera slutligt kvarvarande syms:
  console.log('🔍 Kvar efter filtrering, exempel sym:', objects.slice(0,10).map(o=>o.sym));

  // Anropa ocadToSvg med filtered objects
  const document = (mergedOptions.DOMImplementation || defaultDOMImplementation)
    .createDocument(null, 'xml', null);
  console.log('🔍 Anropar ocadToSvg med objektnummer:', objects.length);
  const svg = ocadToSvg(this.ocadFile, { objects, document });
    // Resten av koden är oförändrad:
    const mapGroup = svg.getElementsByTagName('g')[0];
    const crs = this.ocadFile.getCrs();
    extent = projectedExtentToMapCoords(extent, crs);
    const rotation = options.applyGrivation
      ? `rotate(${(crs.grivation / Math.PI) * 180})`
      : '';
    const transform = `scale(${
      (hundredsMmToMeter * crs.scale) / resolution
    }) translate(${-extent[0]}, ${extent[3]}) ${rotation}`;
    mapGroup.setAttributeNS('', 'transform', transform);
    if (options.fill) {
      const rect = document.createElement('rect');
      rect.setAttributeNS(
        'http://www.w3.org/2000/svg',
        'fill',
        `${options.fill}`
      );
      rect.setAttributeNS('http://www.w3.org/2000/svg', 'width', '100%');
      rect.setAttributeNS('http://www.w3.org/2000/svg', 'height', '100%');
      svg.insertBefore(rect, svg.firstChild);
    }
    return svg;
  }

  getObjects(extent, buffer) {
    const crs = this.ocadFile.getCrs()
    extent = projectedExtentToMapCoords(extent, crs)
    extent = enlargeExtent(extent, buffer)
    return this.index
      .search(extent[0], extent[1], extent[2], extent[3])
      .map(i => this.ocadFile.objects[i])
  }

  tileBounds(resolution, tileSize) {
    const projectedTileSize = tileSize * resolution
    const { bounds } = this
    return [
      roundDown(bounds[0], projectedTileSize),
      roundDown(bounds[1], projectedTileSize),
      roundUp(bounds[2], projectedTileSize),
      roundUp(bounds[3], projectedTileSize),
    ]
  }

  getTileExtent(resolution, tileSize, row, col) {
    const projectedTileSize = tileSize * resolution
    return [
      col * projectedTileSize,
      row * projectedTileSize,
      (col + 1) * projectedTileSize,
      (row + 1) * projectedTileSize,
    ]
  }
}

function roundDown(x, div) {
  return Math.floor(x / div)
}

function roundUp(x, div) {
  return Math.ceil(x / div)
}

function projectedExtentToMapCoords(extent, crs) {
  return transformExtent(extent, c => crs.toMapCoord(c))
}

function mapExtentToProjected(extent, crs) {
  return transformExtent(extent, c => crs.toProjectedCoord(c))
}

function transformExtent(extent, transform) {
  const corners = [
    [extent[0], extent[1]],
    [extent[2], extent[1]],
    [extent[2], extent[3]],
    [extent[0], extent[3]],
  ]
  const transformed = corners.map(transform)
  return [
    Math.min.apply(
      Math,
      transformed.map(c => c[0])
    ),
    Math.min.apply(
      Math,
      transformed.map(c => c[1])
    ),
    Math.max.apply(
      Math,
      transformed.map(c => c[0])
    ),
    Math.max.apply(
      Math,
      transformed.map(c => c[1])
    ),
  ]
}

function enlargeExtent(extent, buffer) {
  return [
    extent[0] - buffer,
    extent[1] - buffer,
    extent[2] + buffer,
    extent[3] + buffer,
  ]
}

function getDefaultDOMImplementation() {
  const global = getGlobal()
  const document = global.document
  return document && document.implementation
}

function getGlobal() {
  if (typeof global !== 'undefined') {
    return global
  } else if (typeof window !== 'undefined') {
    return window
  } else {
    return {}
  }
}

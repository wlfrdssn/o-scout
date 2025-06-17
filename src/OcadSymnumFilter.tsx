import React, { useState, useEffect } from 'react'
import { useMap } from './store'

// Full list enligt ISOM 2017 (nummer delat med 1000)
const SYMBOL_LABELS: Record<number, string> = {
  // Terrängdetaljer
  101: 'Contour',
  102: 'Index contour',
  103: 'Form line',
  104: 'Earth bank',
  105.1: 'Earth wall',
  105.2: 'Retaining earth wall',
  106: 'Ruined earth wall',
  107: 'Erosion gully',
  108: 'Small erosion gully',
  109: 'Small knoll',
  110: 'Small elongated knoll',
  111: 'Small depression',
  112: 'Pit',
  113: 'Broken ground',
  114: 'Very broken ground',
  115: 'Prominent landform feature',

  // Klippor och block
  201: 'Impassable cliff',
  202: 'Cliff',
  203.1: 'Rocky pit or cave',
  203.2: 'Dangerous pit',
  204: 'Boulder',
  205: 'Large boulder',
  206: 'Gigantic boulder or rock pillar',
  207: 'Boulder cluster',
  208: 'Boulder field',
  209: 'Dense boulder field',

  // Vegetation
  401: 'Open land (field)',
  402: 'Scattered trees',
  403: 'Forest (slow run)',
  404: 'Forest (easy run)',
  405: 'Forest (walk)',
  406: 'Forest (fight)',
  407: 'Out-of-bounds vegetation',

  // Vatten
  301: 'Uncrossable body of water',
  302: 'Shallow body of water',
  303: 'Waterhole',
  304: 'Crossable watercourse',
  305: 'Small crossable watercourse',
  306: 'Minor/seasonal water channel',
  307: 'Uncrossable marsh',
  308: 'Marsh',
  309: 'Narrow marsh',
  310: 'Indistinct marsh',

  // Stigar och vägar
  501: 'Major road',
  502: 'Minor road',
  503: 'Track',
  504: 'Vehicle track',
  505: 'Footpath',
  506: 'Imp. footpath',
  507: 'Indistinct path',
  508: 'Narrow ride or linear trace',
  509: 'Railway',

  // Man-made
  510: 'Power line, cableway or skilift',
  511: 'Major power line',
  512: 'Bridge / tunnel',
  513.1: 'Wall',
  513.2: 'Retaining wall',
  514: 'Ruined wall',
  515: 'Impassable wall',
  516: 'Fence',
  517: 'Ruined fence',
  518: 'Impassable fence',
  519: 'Crossing point',
  520: 'Area that shall not be entered',
  521: 'Building',
  522: 'Canopy',
  523: 'Ruin',
  524: 'High tower',
  525: 'Small tower',
  526: 'Cairn',
  527: 'Fodder rack',
  528: 'Prominent line feature',
  529: 'Prominent impassable line feature',
  530: 'Prominent man-made ring',
  531: 'Prominent man-made X',
  532: 'Stairway',

  // Orientering
  601: 'Magnetic north line',
  602: 'Registration mark',

  // Kontroll- och banmarkering
  701: 'Start point triangle',
  702: 'Finish double circle',
  703: 'Control point circle',
  704: 'Control number text',
  705: 'Course line',
  706: 'Finish',
  707: 'Marked route',
  708: 'Out-of-bounds boundary',
  709: 'Out-of-bounds area',
}

export default function OcadSymnumFilter() {
  const mapFile = useMap(s => s.mapFile)
  const updateTiler = useMap(s => s.updateTiler)
  const selectedSymnums = useMap(s => new Set(s.selectedSymnums))
  const setSelectedSymnums = useMap(s => s.setSelectedSymnums)

  const [uniqueSymnums, setUniqueSymnums] = useState<number[]>([])

  useEffect(() => {
    if (!mapFile) return

    const allNums = mapFile.objects
      .map((o: any) => {
        const raw = typeof o.sym === 'string' ? Number(o.sym) : o.sym
        return raw / 1000
      })
      .filter((n: number) => !isNaN(n))

    const uniques = Array.from(new Set(allNums)).sort((a, b) => a - b)
    setUniqueSymnums(uniques)

    // Initiera store och applicera filter direkt första gången
    setSelectedSymnums(uniques)
    updateTiler(uniques.map(n => n * 1000))
  }, [mapFile, setSelectedSymnums, updateTiler])

  if (!mapFile) return null

  const allSelected = uniqueSymnums.length > 0 && uniqueSymnums.every(n => selectedSymnums.has(n))

  const toggleSelectAll = () => {
    if (allSelected) setSelectedSymnums([])
    else setSelectedSymnums(uniqueSymnums)
  }

  const onToggle = (num: number) => {
    const next = new Set(selectedSymnums)
    if (next.has(num)) next.delete(num)
    else next.add(num)
    setSelectedSymnums(Array.from(next))
  }

  const applyFilter = () => {
    const syms = Array.from(selectedSymnums)
      .map(n => n * 1000)
      .sort((a, b) => a - b)
    updateTiler(syms)
  }

  return (
    <div className="ocad-symnum-filter">
      {/* Sticky header with checkbox and update button */}
      <div className="sticky top-0 flex justify-end mb-2 p-2 border-b">
        <button
          className="px-2 py-1 rounded bg-green-500 text-white hover:bg-green-600"
          onClick={applyFilter}
        >
          Uppdatera symboler
        </button>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
        {/* Checkbox för markera/avmarkera alla högst upp */}
        <label className="block mb-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="mr-2"
          />
          Markera/avmarkera alla
        </label>
        {uniqueSymnums.map(num => (
          <label key={num} className="block mb-1">
            <input
              type="checkbox"
              checked={selectedSymnums.has(num)}
              onChange={() => onToggle(num)}
              className="mr-2"
            />
            {num}{SYMBOL_LABELS[num] ? ` – ${SYMBOL_LABELS[num]}` : ''}
          </label>
        ))}
      </div>
    </div>
  )
}

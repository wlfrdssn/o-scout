import React, { useState, useEffect } from 'react'
import { useMap } from './store'

export default function OcadSymnumFilter() {
  const mapFile = useMap(s => s.mapFile)
  const updateTiler = useMap(s => s.updateTiler)
  const selectedSymnums = useMap(s => new Set(s.selectedSymnums))
  const setSelectedSymnums = useMap(s => s.setSelectedSymnums)

  const [uniqueSymnums, setUniqueSymnums] = useState<number[]>([])
  const [symnumToNumber, setSymnumToNumber] = useState<Record<number, string>>({})
  const [symnumToDescription, setSymnumToDescription] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!mapFile) return

    const rawSyms: number[] = mapFile.objects
      .map((o: any) => {
        const raw = typeof o.sym === 'string' ? Number(o.sym) : o.sym
        return isNaN(raw) ? null : (raw as number)
      })
      .filter((x): x is number => x !== null)

    const symToNum: Record<number, string> = {}
    const symToDesc: Record<number, string> = {}
    if (Array.isArray((mapFile as any).symbols)) {
      (mapFile as any).symbols.forEach((s: any) => {
        let symnumRaw: number | null = null
        if (s.symNum !== undefined) {
          const val = typeof s.symNum === 'number' ? s.symNum : Number(s.symNum)
          if (!isNaN(val)) symnumRaw = val
        }
        if (symnumRaw === null && s.symnum !== undefined) {
          const val = typeof s.symnum === 'number' ? s.symnum : Number(s.symnum)
          if (!isNaN(val)) symnumRaw = val
        }
        if (symnumRaw === null) return

        if (s.number !== undefined) {
          const numField = typeof s.number === 'string' ? s.number : String(s.number)
          symToNum[symnumRaw] = numField
        }
        if (typeof s.description === 'string' && s.description.trim() !== '') {
          symToDesc[symnumRaw] = s.description.trim()
        }
      })
    }

    const symSet = new Set<number>()
    rawSyms.forEach(raw => {
      if (symToNum[raw] !== undefined) {
        symSet.add(raw)
      }
    })
    const symnumsArray = Array.from(symSet).sort((a, b) => a - b)

    setUniqueSymnums(symnumsArray)
    setSymnumToNumber(symToNum)
    setSymnumToDescription(symToDesc)

    setSelectedSymnums(symnumsArray)
  }, [mapFile, setSelectedSymnums, updateTiler])

  if (!mapFile) return null

  const allSelected =
    uniqueSymnums.length > 0 && uniqueSymnums.every(s => selectedSymnums.has(s))

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedSymnums([])
    } else {
      setSelectedSymnums(uniqueSymnums)
    }
  }

  const onToggle = (symnum: number) => {
    const next = new Set(selectedSymnums)
    if (next.has(symnum)) next.delete(symnum)
    else next.add(symnum)
    setSelectedSymnums(Array.from(next))
  }

  const applyFilter = () => {
    const syms = Array.from(selectedSymnums).sort((a, b) => a - b)
    updateTiler(syms)
  }

  return (
    <div className="ocad-symnum-filter">
      {/* Sticky header med Uppdatera-knapp */}
      <div className="sticky top-0 bg-white z-10 flex justify-end p-2 border-b">
        <button
          className="px-2 py-1 rounded bg-green-500 text-white hover:bg-green-600"
          onClick={applyFilter}
        >
          Uppdatera symboler
        </button>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
        {/* Markera/avmarkera alla placeras överst men utan sticky */}
        <label className="block mb-2 p-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="mr-2"
          />
          Markera/avmarkera alla
        </label>

        {uniqueSymnums.map(symnum => {
          const displayNumber = symnumToNumber[symnum]
          const desc = symnumToDescription[symnum]
          let textToShow = displayNumber
          if (desc !== undefined) {
            textToShow = `${displayNumber} – ${desc}`
          }
          return (
            <label key={symnum} className="flex items-center mb-1 p-2">
              <input
                type="checkbox"
                checked={selectedSymnums.has(symnum)}
                onChange={() => onToggle(symnum)}
                className="mr-2"
              />
              <span className="font-medium">{textToShow}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

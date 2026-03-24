import { Head } from '@inertiajs/react'
import { useState, useMemo } from 'react'
import AppLayout from '~/layouts/AppLayout'
import { IconBolt, IconBattery2, IconChevronDown, IconChevronUp, IconInfoCircle } from '@tabler/icons-react'

// ── Battery presets ────────────────────────────────────────────────────────
const PRESETS: Record<string, { label: string; nominalV: number; capacityAh: number; maxCRate: number }> = {
  '18650': { label: '18650 (common laptop/flashlight cell)', nominalV: 3.6, capacityAh: 3.0, maxCRate: 2 },
  '21700': { label: '21700 (e-bike, high-capacity)', nominalV: 3.6, capacityAh: 5.0, maxCRate: 2 },
  lifepo4_small: { label: 'LiFePO4 cell (long-life solar storage)', nominalV: 3.2, capacityAh: 3.2, maxCRate: 3 },
  lifepo4_big: { label: 'LiFePO4 100 Ah block (van/cabin)', nominalV: 3.2, capacityAh: 100, maxCRate: 1 },
  lipo: { label: 'LiPo (drone / RC)', nominalV: 3.7, capacityAh: 5.0, maxCRate: 5 },
  lead_acid: { label: 'Lead-acid 12 V (car battery style)', nominalV: 2.0, capacityAh: 45, maxCRate: 0.2 },
  ev_pouch: { label: 'EV pouch cell (high-energy)', nominalV: 3.65, capacityAh: 60, maxCRate: 2 },
  custom: { label: 'Custom — enter my own specs', nominalV: 0, capacityAh: 0, maxCRate: 0 },
}

// ── Wire table ──────────────────────────────────────────────────────────────
const WIRES = [
  { awg: 10, safeA: 44 },
  { awg: 12, safeA: 33 },
  { awg: 14, safeA: 26 },
  { awg: 16, safeA: 18 },
  { awg: 18, safeA: 13 },
]

function recommendWire(amps: number) {
  return WIRES.find((w) => amps <= w.safeA) ?? WIRES[0]
}

function recommendFuse(amps: number) {
  const sizes = [1, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 125, 150, 200]
  return sizes.find((s) => s >= amps * 1.25) ?? 200
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function num(s: string) {
  const v = parseFloat(s)
  return isNaN(v) ? 0 : v
}

// ── Small reusable components ────────────────────────────────────────────────
function Field({
  label,
  hint,
  unit,
  value,
  onChange,
  min = 0,
  step = 1,
  placeholder,
}: {
  label: string
  hint?: string
  unit?: string
  value: string
  onChange: (v: string) => void
  min?: number
  step?: number
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-text-primary">
        {label}
        {unit && <span className="ml-1 font-normal text-text-secondary text-xs">({unit})</span>}
      </label>
      {hint && <p className="text-xs text-text-secondary -mt-0.5">{hint}</p>}
      <input
        type="number"
        min={min}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-desert-green"
      />
    </div>
  )
}

function SectionCard({
  step,
  title,
  children,
  complete,
}: {
  step: number
  title: string
  children: React.ReactNode
  complete?: boolean
}) {
  return (
    <div className={`rounded-xl border-2 p-5 space-y-4 transition-colors ${complete ? 'border-desert-green' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${complete ? 'bg-desert-green text-white' : 'bg-gray-200 dark:bg-gray-700 text-text-secondary'}`}>
          {step}
        </span>
        <h2 className="font-bold text-lg text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function ResultChip({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col gap-1 ${accent ? 'bg-desert-green text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
      <span className={`text-xs font-medium uppercase tracking-wider ${accent ? 'opacity-75' : 'text-text-secondary'}`}>{label}</span>
      <span className={`text-2xl font-bold font-mono ${accent ? '' : 'text-text-primary'}`}>{value}</span>
      {sub && <span className={`text-xs ${accent ? 'opacity-80' : 'text-text-secondary'}`}>{sub}</span>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PowerCalculator() {
  // Step 1 — load
  const [watts, setWatts] = useState('')
  const [voltage, setVoltage] = useState('12')

  // Step 2 — runtime
  const [runtimeH, setRuntimeH] = useState('')
  const [lossPercent, setLossPercent] = useState('10')

  // Step 3 — battery
  const [presetKey, setPresetKey] = useState('18650')
  const [customV, setCustomV] = useState('')
  const [customAh, setCustomAh] = useState('')
  const [customCRate, setCustomCRate] = useState('')
  const [cRate, setCRate] = useState('0.5')

  // UI state
  const [showTip, setShowTip] = useState(false)

  const isCustom = presetKey === 'custom'

  const cell = useMemo(() => {
    if (isCustom) {
      return {
        nominalV: num(customV),
        capacityAh: num(customAh),
        maxCRate: num(customCRate),
      }
    }
    return PRESETS[presetKey]
  }, [presetKey, customV, customAh, customCRate, isCustom])

  // Derived current from watts + voltage
  const loadAmps = useMemo(() => {
    const v = num(voltage)
    const w = num(watts)
    return v > 0 && w > 0 ? w / v : 0
  }, [watts, voltage])

  // Readiness checks
  const step1Complete = num(watts) > 0 && num(voltage) > 0
  const step2Complete = num(runtimeH) > 0
  const step3Complete =
    step1Complete &&
    step2Complete &&
    cell.nominalV > 0 &&
    cell.capacityAh > 0

  // ── Main calculation ────────────────────────────────────────────────────
  const result = useMemo(() => {
    if (!step3Complete) return null

    const totalW = num(watts)
    const sysV = num(voltage)
    const hours = num(runtimeH)
    const loss = num(lossPercent)
    const cr = num(cRate)

    const adjustedW = totalW / (1 - loss / 100)
    const seriesCells = Math.max(1, Math.ceil(sysV / cell.nominalV))
    const packV = seriesCells * cell.nominalV
    const packCurrentA = adjustedW / packV

    // Parallel for C-rate constraint
    const maxCurrentPerCell = Math.max(0.01, cr) * cell.capacityAh
    const parallelForCRate = Math.ceil(packCurrentA / maxCurrentPerCell)

    // Parallel for capacity constraint
    const capacityNeededAh = (adjustedW * hours) / packV
    const parallelForCapacity = Math.ceil(capacityNeededAh / cell.capacityAh)

    const parallel = Math.max(1, parallelForCRate, parallelForCapacity)
    const totalCells = seriesCells * parallel
    const totalPackAh = parallel * cell.capacityAh
    const actualRuntimeH = (totalPackAh * packV) / adjustedW

    const wire = recommendWire(loadAmps)
    const fuse = recommendFuse(loadAmps)

    const cRateWarning = cr > cell.maxCRate && cell.maxCRate > 0

    return {
      adjustedW,
      seriesCells,
      parallel,
      packV,
      totalCells,
      totalPackAh,
      capacityNeededAh,
      actualRuntimeH,
      wire,
      fuse,
      cRateWarning,
      packConfig: `${seriesCells}S${parallel}P`,
    }
  }, [step3Complete, watts, voltage, runtimeH, lossPercent, cRate, cell, loadAmps])

  return (
    <AppLayout>
      <Head title="Power System Calculator" />

      <div className="max-w-2xl mx-auto p-4 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <IconBolt size={32} className="text-desert-orange-light shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Power System Calculator</h1>
            <p className="text-sm text-text-secondary">
              Figure out how many batteries you need and how to wire them safely.
            </p>
          </div>
        </div>

        {/* ── Step 1: Your load ── */}
        <SectionCard step={1} title="What are you powering?" complete={step1Complete}>
          <p className="text-sm text-text-secondary">
            Enter the total watts your device or system draws, and the voltage it runs on.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Power draw"
              unit="Watts"
              hint="Check the device label or manual"
              value={watts}
              onChange={setWatts}
              min={1}
              step={10}
              placeholder="e.g. 120"
            />
            <Field
              label="System voltage"
              unit="Volts"
              hint="12 V for most vehicles/off-grid"
              value={voltage}
              onChange={setVoltage}
              min={1}
              step={1}
              placeholder="e.g. 12"
            />
          </div>
          {step1Complete && (
            <div className="rounded-lg bg-desert-green/10 border border-desert-green/30 px-4 py-2 text-sm text-text-primary">
              That's <span className="font-bold text-desert-green">{loadAmps.toFixed(1)} A</span> of continuous current at {voltage} V.
            </div>
          )}
        </SectionCard>

        {/* ── Step 2: How long ── */}
        <SectionCard step={2} title="How long does it need to run?" complete={step2Complete}>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Runtime needed"
              unit="hours"
              hint="How many hours on a single charge?"
              value={runtimeH}
              onChange={setRuntimeH}
              min={0.1}
              step={0.5}
              placeholder="e.g. 5"
            />
            <Field
              label="Expected losses"
              unit="%"
              hint="Wiring heat, converter inefficiency"
              value={lossPercent}
              onChange={setLossPercent}
              min={0}
              max={50}
              step={1}
              placeholder="10"
            />
          </div>
          <button
            onClick={() => setShowTip((p) => !p)}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-desert-green transition-colors"
          >
            <IconInfoCircle size={14} />
            What is "losses"?
            {showTip ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
          </button>
          {showTip && (
            <p className="text-xs text-text-secondary bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
              No power system is 100% efficient. Wires generate heat, DC-DC converters waste some energy,
              and battery chemistry itself has losses. 10% is a safe default for simple systems.
              Add more (15–20%) if you're running through an inverter.
            </p>
          )}
        </SectionCard>

        {/* ── Step 3: Battery ── */}
        <SectionCard step={3} title="What battery cells are you using?" complete={step3Complete}>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-text-primary">Battery type</label>
            <select
              value={presetKey}
              onChange={(e) => setPresetKey(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-desert-green"
            >
              {Object.entries(PRESETS).map(([k, p]) => (
                <option key={k} value={k} className="bg-gray-800">
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom fields */}
          {isCustom && (
            <div className="rounded-lg border border-dashed border-desert-green p-4 space-y-4">
              <p className="text-sm font-semibold text-desert-green">Enter your cell's specs</p>
              <div className="grid grid-cols-3 gap-3">
                <Field
                  label="Nominal voltage"
                  unit="V per cell"
                  hint="Typical: 3.2–3.7 V for lithium"
                  value={customV}
                  onChange={setCustomV}
                  min={0.1}
                  step={0.1}
                  placeholder="3.6"
                />
                <Field
                  label="Cell capacity"
                  unit="Ah per cell"
                  hint="From the datasheet or label"
                  value={customAh}
                  onChange={setCustomAh}
                  min={0.1}
                  step={0.1}
                  placeholder="5.0"
                />
                <Field
                  label="Max C-rate"
                  unit="C"
                  hint="Max safe discharge rate"
                  value={customCRate}
                  onChange={setCustomCRate}
                  min={0.1}
                  step={0.1}
                  placeholder="1.0"
                />
              </div>
              <p className="text-xs text-text-secondary">
                Not sure? A safe default C-rate for most lithium cells is 0.5 – 1.0 C.
              </p>
            </div>
          )}

          {/* C-rate slider — shown for all types */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">
                How hard will you discharge?
              </label>
              <span className="font-mono font-bold text-desert-green text-sm">{cRate} C</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={isCustom ? Math.max(num(customCRate) || 5, 5) : PRESETS[presetKey].maxCRate * 2 || 5}
              step={0.1}
              value={cRate}
              onChange={(e) => setCRate(e.target.value)}
              className="accent-desert-green w-full"
            />
            <div className="flex justify-between text-xs text-text-secondary">
              <span>0.1 C — slow, gentle (longest life)</span>
              <span>Higher C — faster discharge</span>
            </div>
            {!isCustom && (
              <p className="text-xs text-text-secondary">
                Recommended max for this cell: <span className="font-semibold">{PRESETS[presetKey].maxCRate} C</span>
              </p>
            )}
          </div>
        </SectionCard>

        {/* ── Results ── */}
        {result ? (
          <div className="rounded-xl border-2 border-desert-green p-5 space-y-5">
            <h2 className="font-bold text-lg text-text-primary flex items-center gap-2">
              <IconBattery2 size={22} className="text-desert-green" />
              Your Battery Pack
            </h2>

            {result.cRateWarning && (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
                ⚠️ Your discharge rate ({cRate} C) exceeds this cell's rated max ({cell.maxCRate} C).
                Consider lowering the C-rate or choosing a cell rated for higher discharge.
              </div>
            )}

            {/* Primary results */}
            <div className="grid grid-cols-2 gap-3">
              <ResultChip
                label="Pack configuration"
                value={result.packConfig}
                sub={`${result.seriesCells} cells in series × ${result.parallel} in parallel`}
                accent
              />
              <ResultChip
                label="Total cells needed"
                value={`${result.totalCells}`}
                sub={`${result.packV.toFixed(1)} V pack`}
                accent
              />
              <ResultChip
                label="Estimated runtime"
                value={`${result.actualRuntimeH.toFixed(1)} hrs`}
                sub={`Need ${result.capacityNeededAh.toFixed(1)} Ah — pack gives ${result.totalPackAh.toFixed(1)} Ah`}
                accent
              />
              <ResultChip
                label="Total power draw"
                value={`${result.adjustedW.toFixed(0)} W`}
                sub={`Includes ${lossPercent}% system losses`}
                accent
              />
            </div>

            {/* Wiring */}
            <div>
              <h3 className="font-semibold text-text-primary mb-3">Safe wiring for {loadAmps.toFixed(1)} A</h3>
              <div className="grid grid-cols-2 gap-3">
                <ResultChip
                  label="Minimum wire size"
                  value={`${result.wire.awg} AWG`}
                  sub={`Handles up to ${result.wire.safeA} A safely`}
                />
                <ResultChip
                  label="Fuse / breaker"
                  value={`${result.fuse} A`}
                  sub="Protects wiring from shorts"
                />
              </div>
            </div>

            {/* Plain-English summary */}
            <div className="rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-4 text-sm text-text-primary space-y-1">
              <p className="font-semibold mb-2">Summary</p>
              <p>
                Build a <strong>{result.packConfig} pack</strong> using{' '}
                <strong>{result.totalCells} cells</strong>. That gives you{' '}
                <strong>{result.packV.toFixed(1)} V</strong> at{' '}
                <strong>{result.totalPackAh.toFixed(1)} Ah</strong>, which should run your{' '}
                {watts} W load for approximately{' '}
                <strong>{result.actualRuntimeH.toFixed(1)} hours</strong>.
              </p>
              <p>
                Wire the main feed with at least <strong>{result.wire.awg} AWG</strong> wire and
                protect it with a <strong>{result.fuse} A fuse</strong> as close to the battery as
                possible.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center text-text-secondary text-sm">
            Complete all three steps above to see your results.
          </div>
        )}

      </div>
    </AppLayout>
  )
}

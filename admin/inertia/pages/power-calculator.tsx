import { Head } from '@inertiajs/react'
import { useState, useMemo, useCallback } from 'react'
import AppLayout from '~/layouts/AppLayout'

// ── Persistent state hook (survives navigation) ────────────────────────────
function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setInner] = useState<T>(() => {
    try {
      const stored = localStorage.getItem('nomad_powercalc_' + key)
      return stored !== null ? (JSON.parse(stored) as T) : initial
    } catch {
      return initial
    }
  })

  const setValue = useCallback(
    (v: T | ((prev: T) => T)) => {
      setInner((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
        try { localStorage.setItem('nomad_powercalc_' + key, JSON.stringify(next)) } catch {}
        return next
      })
    },
    [key]
  )

  return [value, setValue]
}
import {
  IconBolt,
  IconBattery2,
  IconSun,
  IconWind,
  IconInfoCircle,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react'

// ── Wire table (80% NEC derate applied) ────────────────────────────────────
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

function num(s: string) {
  const v = parseFloat(s)
  return isNaN(v) ? 0 : v
}

// ── Reusable field ─────────────────────────────────────────────────────────
function Field({
  label,
  hint,
  unit,
  value,
  onChange,
  min = 0,
  step = 1,
  placeholder,
  required,
}: {
  label: string
  hint?: string
  unit?: string
  value: string
  onChange: (v: string) => void
  min?: number
  step?: number
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-text-primary">
        {label}
        {unit && <span className="ml-1 font-normal text-text-secondary text-xs">({unit})</span>}
        {required && <span className="ml-1 text-desert-orange-light text-xs">*</span>}
      </label>
      {hint && <p className="text-xs text-text-secondary">{hint}</p>}
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
  step?: number
  title: string
  children: React.ReactNode
  complete?: boolean
}) {
  return (
    <div
      className={`rounded-xl border-2 p-5 space-y-4 transition-colors ${
        complete ? 'border-desert-green' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-center gap-3">
        {step !== undefined && (
          <span
            className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold shrink-0 ${
              complete
                ? 'bg-desert-green text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-text-secondary'
            }`}
          >
            {step}
          </span>
        )}
        <h2 className="font-bold text-base text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Chip({
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
    <div
      className={`rounded-xl p-4 flex flex-col gap-0.5 ${
        accent ? 'bg-desert-green text-white' : 'bg-gray-100 dark:bg-gray-800'
      }`}
    >
      <span
        className={`text-xs font-medium uppercase tracking-wider ${
          accent ? 'opacity-75' : 'text-text-secondary'
        }`}
      >
        {label}
      </span>
      <span className={`text-xl font-bold font-mono ${accent ? '' : 'text-text-primary'}`}>
        {value}
      </span>
      {sub && (
        <span className={`text-xs ${accent ? 'opacity-80' : 'text-text-secondary'}`}>{sub}</span>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Battery Calculator
// ══════════════════════════════════════════════════════════════════════════════
function BatteryCalc({
  onPackChange,
}: {
  onPackChange: (wh: number | null) => void
}) {
  const [watts, setWatts] = useLocalStorage('watts', '')
  const [voltage, setVoltage] = useLocalStorage('voltage', '12')
  const [runtimeH, setRuntimeH] = useLocalStorage('runtimeH', '')
  const [lossPercent, setLossPercent] = useLocalStorage('lossPercent', '10')
  const [cellV, setCellV] = useLocalStorage('cellV', '')
  const [cellAh, setCellAh] = useLocalStorage('cellAh', '')
  const [maxCRate, setMaxCRate] = useLocalStorage('maxCRate', '')
  const [cRate, setCRate] = useLocalStorage('cRate', '0.5')
  const [showLossTip, setShowLossTip] = useState(false)

  const loadAmps = useMemo(() => {
    const v = num(voltage)
    const w = num(watts)
    return v > 0 && w > 0 ? w / v : 0
  }, [watts, voltage])

  const step1OK = num(watts) > 0 && num(voltage) > 0
  const step2OK = num(runtimeH) > 0
  const step3OK = num(cellV) > 0 && num(cellAh) > 0 && num(maxCRate) > 0
  const allOK = step1OK && step2OK && step3OK

  const result = useMemo(() => {
    if (!allOK) {
      onPackChange(null)
      return null
    }

    const totalW = num(watts)
    const sysV = num(voltage)
    const hours = num(runtimeH)
    const loss = num(lossPercent)
    const cr = num(cRate)
    const cv = num(cellV)
    const cah = num(cellAh)

    const adjustedW = totalW / (1 - loss / 100)
    const seriesCells = Math.max(1, Math.ceil(sysV / cv))
    const packV = seriesCells * cv
    const packCurrentA = adjustedW / packV

    const maxCurrentPerCell = Math.max(0.01, cr) * cah
    const parallelForCRate = Math.ceil(packCurrentA / maxCurrentPerCell)
    const capacityNeededAh = (adjustedW * hours) / packV
    const parallelForCapacity = Math.ceil(capacityNeededAh / cah)
    const parallel = Math.max(1, parallelForCRate, parallelForCapacity)

    const totalCells = seriesCells * parallel
    const totalPackAh = parallel * cah
    const actualRuntimeH = (totalPackAh * packV) / adjustedW
    const packWh = packV * totalPackAh

    const wire = recommendWire(loadAmps)
    const fuse = recommendFuse(loadAmps)
    const cRateWarning = cr > num(maxCRate) && num(maxCRate) > 0

    onPackChange(packWh)

    return {
      adjustedW,
      seriesCells,
      parallel,
      packV,
      totalCells,
      totalPackAh,
      packWh,
      capacityNeededAh,
      actualRuntimeH,
      wire,
      fuse,
      cRateWarning,
      packConfig: `${seriesCells}S${parallel}P`,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOK, watts, voltage, runtimeH, lossPercent, cRate, cellV, cellAh, maxCRate, loadAmps])

  return (
    <div className="space-y-4">
      {/* Step 1 */}
      <SectionCard step={1} title="What are you powering?" complete={step1OK}>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Total power draw"
            unit="Watts"
            hint="From device label or manual"
            value={watts}
            onChange={setWatts}
            min={1}
            step={10}
            placeholder="120"
            required
          />
          <Field
            label="System voltage"
            unit="Volts"
            hint="12 V is most common off-grid"
            value={voltage}
            onChange={setVoltage}
            min={1}
            placeholder="12"
            required
          />
        </div>
        {step1OK && (
          <p className="text-sm rounded-lg bg-desert-green/10 border border-desert-green/30 px-3 py-2">
            That's{' '}
            <span className="font-bold text-desert-green">{loadAmps.toFixed(1)} A</span>{' '}
            continuous draw.
          </p>
        )}
      </SectionCard>

      {/* Step 2 */}
      <SectionCard step={2} title="How long does it need to run?" complete={step2OK}>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Runtime needed"
            unit="hours"
            value={runtimeH}
            onChange={setRuntimeH}
            min={0.1}
            step={0.5}
            placeholder="5"
            required
          />
          <Field
            label="System losses"
            unit="%"
            hint="Wiring + converter waste heat"
            value={lossPercent}
            onChange={setLossPercent}
            min={0}
            max={50}
            placeholder="10"
          />
        </div>
        <button
          onClick={() => setShowLossTip((p) => !p)}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-desert-green"
        >
          <IconInfoCircle size={13} />
          What are losses?
          {showLossTip ? <IconChevronUp size={11} /> : <IconChevronDown size={11} />}
        </button>
        {showLossTip && (
          <p className="text-xs text-text-secondary bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
            No system is 100% efficient. Wires get warm, converters waste some power. 10% is a
            good default. Use 15–20% if running through an inverter.
          </p>
        )}
      </SectionCard>

      {/* Step 3 */}
      <SectionCard step={3} title="Battery cell specs" complete={step3OK}>
        <p className="text-xs text-text-secondary">
          Enter the specs from your cell's datasheet or label.{' '}
          <span className="text-desert-orange-light">*</span> All fields required.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Cell voltage"
            unit="V"
            hint="Per cell (e.g. 3.2, 3.6, 3.7)"
            value={cellV}
            onChange={setCellV}
            min={0.1}
            step={0.1}
            placeholder="3.6"
            required
          />
          <Field
            label="Cell capacity"
            unit="Ah"
            hint="Per cell (from label)"
            value={cellAh}
            onChange={setCellAh}
            min={0.1}
            step={0.1}
            placeholder="5.0"
            required
          />
          <Field
            label="Max C-rate"
            unit="C"
            hint="Max safe discharge (datasheet)"
            value={maxCRate}
            onChange={setMaxCRate}
            min={0.1}
            step={0.1}
            placeholder="1.0"
            required
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-text-primary">Planned discharge rate</span>
            <span className="font-mono font-bold text-desert-green text-sm">{cRate} C</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={cRate}
            onChange={(e) => setCRate(e.target.value)}
            className="accent-desert-green w-full"
          />
          <div className="flex justify-between text-xs text-text-secondary">
            <span>0.1 C — slow &amp; gentle</span>
            <span>5 C — fast, high heat</span>
          </div>
          {num(maxCRate) > 0 && (
            <p className="text-xs text-text-secondary">
              Your cell's rated max: <strong>{maxCRate} C</strong>
            </p>
          )}
        </div>
        {result?.cRateWarning && (
          <p className="text-xs rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 px-3 py-2 text-yellow-800 dark:text-yellow-300">
            ⚠️ {cRate} C exceeds your cell's rated max of {maxCRate} C. Lower the rate or add more
            parallel cells.
          </p>
        )}
      </SectionCard>

      {/* Results */}
      {result ? (
        <div className="rounded-xl border-2 border-desert-green p-5 space-y-4">
          <h3 className="font-bold text-text-primary flex items-center gap-2">
            <IconBattery2 size={18} className="text-desert-green" />
            Battery Pack Results
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Chip
              label="Pack config"
              value={result.packConfig}
              sub={`${result.seriesCells}S × ${result.parallel}P`}
              accent
            />
            <Chip
              label="Total cells"
              value={`${result.totalCells}`}
              sub={`${result.packV.toFixed(1)} V · ${result.totalPackAh.toFixed(1)} Ah`}
              accent
            />
            <Chip
              label="Runtime"
              value={`${result.actualRuntimeH.toFixed(1)} hrs`}
              sub={`Pack: ${result.packWh.toFixed(0)} Wh`}
              accent
            />
            <Chip
              label="Total draw"
              value={`${result.adjustedW.toFixed(0)} W`}
              sub={`Incl. ${lossPercent}% losses`}
              accent
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Chip
              label="Min wire size"
              value={`${result.wire.awg} AWG`}
              sub={`Safe to ${result.wire.safeA} A`}
            />
            <Chip
              label="Fuse / breaker"
              value={`${result.fuse} A`}
              sub="Near battery positive"
            />
          </div>
          <div className="rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-sm space-y-1">
            <p>
              Build a <strong>{result.packConfig}</strong> pack with{' '}
              <strong>{result.totalCells} cells</strong> — {result.packV.toFixed(1)} V at{' '}
              {result.totalPackAh.toFixed(1)} Ah. Runs {watts} W for roughly{' '}
              <strong>{result.actualRuntimeH.toFixed(1)} hours</strong>. Use{' '}
              <strong>{result.wire.awg} AWG</strong> wire and a{' '}
              <strong>{result.fuse} A fuse</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-text-secondary">
          Complete all three steps to see your pack configuration.
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Energy Recovery Calculator
// ══════════════════════════════════════════════════════════════════════════════
type SourceType = 'solar' | 'wind' | 'custom'

function EnergyRecovery({ packWh }: { packWh: number | null }) {
  const [source, setSource] = useLocalStorage<SourceType>('source', 'solar')

  // Solar
  const [panelW, setPanelW] = useLocalStorage('panelW', '220')
  const [panelCount, setPanelCount] = useLocalStorage('panelCount', '1')
  const [sunHours, setSunHours] = useLocalStorage('sunHours', '5')
  const [solarEfficiency, setSolarEfficiency] = useLocalStorage('solarEfficiency', '85')

  // Wind
  const [turbineW, setTurbineW] = useLocalStorage('turbineW', '')
  const [windHours, setWindHours] = useLocalStorage('windHours', '')
  const [windEfficiency, setWindEfficiency] = useLocalStorage('windEfficiency', '80')

  // Custom
  const [customW, setCustomW] = useLocalStorage('customW', '')
  const [customHours, setCustomHours] = useLocalStorage('customHours', '')
  const [customEfficiency, setCustomEfficiency] = useLocalStorage('customEfficiency', '85')

  const result = useMemo(() => {
    let sourceWatts = 0
    let hoursPerDay = 0
    let efficiencyPct = 85

    if (source === 'solar') {
      sourceWatts = num(panelW) * num(panelCount)
      hoursPerDay = num(sunHours)
      efficiencyPct = num(solarEfficiency) || 85
    } else if (source === 'wind') {
      sourceWatts = num(turbineW)
      hoursPerDay = num(windHours)
      efficiencyPct = num(windEfficiency) || 80
    } else {
      sourceWatts = num(customW)
      hoursPerDay = num(customHours)
      efficiencyPct = num(customEfficiency) || 85
    }

    if (sourceWatts <= 0 || hoursPerDay <= 0) return null

    const eff = efficiencyPct / 100
    const effectiveW = sourceWatts * eff
    const whPerDay = effectiveW * hoursPerDay

    if (packWh && packWh > 0) {
      const totalSunHoursNeeded = packWh / effectiveW
      const daysToCharge = totalSunHoursNeeded / hoursPerDay
      const hoursToCharge = totalSunHoursNeeded

      return {
        sourceWatts,
        effectiveW,
        whPerDay,
        hoursToCharge,
        daysToCharge,
        hasPackContext: true,
      }
    }

    return {
      sourceWatts,
      effectiveW,
      whPerDay,
      hoursToCharge: null,
      daysToCharge: null,
      hasPackContext: false,
    }
  }, [
    source,
    panelW, panelCount, sunHours, solarEfficiency,
    turbineW, windHours, windEfficiency,
    customW, customHours, customEfficiency,
    packWh,
  ])

  const sourceLabel = source === 'solar' ? 'Solar Array' : source === 'wind' ? 'Wind Turbine' : 'Custom Source'

  return (
    <div className="space-y-4">
      {/* Source selector */}
      <SectionCard title="Clean Energy Source" complete={!!result}>
        <div className="grid grid-cols-3 gap-2">
          {(['solar', 'wind', 'custom'] as SourceType[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 py-3 px-2 text-sm font-semibold transition-colors ${
                source === s
                  ? 'border-desert-green bg-desert-green text-white'
                  : 'border-gray-200 dark:border-gray-700 text-text-secondary hover:border-desert-green'
              }`}
            >
              {s === 'solar' && <IconSun size={20} />}
              {s === 'wind' && <IconWind size={20} />}
              {s === 'custom' && <IconBolt size={20} />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Solar inputs */}
        {source === 'solar' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Watts per panel"
                unit="W"
                hint="From panel label"
                value={panelW}
                onChange={setPanelW}
                min={1}
                step={10}
                placeholder="220"
              />
              <Field
                label="Number of panels"
                value={panelCount}
                onChange={setPanelCount}
                min={1}
                placeholder="1"
              />
            </div>
            {num(panelW) > 0 && num(panelCount) > 0 && (
              <p className="text-sm rounded-lg bg-desert-green/10 border border-desert-green/30 px-3 py-2">
                Array total:{' '}
                <span className="font-bold text-desert-green">
                  {(num(panelW) * num(panelCount)).toFixed(0)} W
                </span>
              </p>
            )}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-text-primary">Hours of usable sun per day</span>
                <span className="font-mono font-bold text-desert-green text-sm">{sunHours} hrs</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={14}
                step={0.5}
                value={sunHours}
                onChange={(e) => setSunHours(e.target.value)}
                className="accent-desert-green w-full"
              />
              <div className="flex justify-between text-xs text-text-secondary">
                <span>Winter minimum (~4 hrs)</span>
                <span>Summer peak (~12 hrs)</span>
              </div>
            </div>
            <Field
              label="Charge controller efficiency"
              unit="%"
              hint="MPPT controller: 90–98%. PWM: 70–80%"
              value={solarEfficiency}
              onChange={setSolarEfficiency}
              min={50}
              max={100}
              placeholder="85"
            />
          </div>
        )}

        {/* Wind inputs */}
        {source === 'wind' && (
          <div className="space-y-3">
            <Field
              label="Turbine rated output"
              unit="Watts"
              hint="Peak output at rated wind speed"
              value={turbineW}
              onChange={setTurbineW}
              min={1}
              step={50}
              placeholder="400"
            />
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-text-primary">Hours of productive wind per day</span>
                <span className="font-mono font-bold text-desert-green text-sm">{windHours || '—'} hrs</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={24}
                step={0.5}
                value={windHours || 6}
                onChange={(e) => setWindHours(e.target.value)}
                className="accent-desert-green w-full"
              />
              <div className="flex justify-between text-xs text-text-secondary">
                <span>0.5 hrs</span>
                <span>24 hrs</span>
              </div>
            </div>
            <Field
              label="System efficiency"
              unit="%"
              hint="Turbine + charge controller. Typical: 70–85%"
              value={windEfficiency}
              onChange={setWindEfficiency}
              min={30}
              max={100}
              placeholder="80"
            />
          </div>
        )}

        {/* Custom inputs */}
        {source === 'custom' && (
          <div className="space-y-3">
            <Field
              label="Source output"
              unit="Watts"
              hint="Rated output of your energy source"
              value={customW}
              onChange={setCustomW}
              min={1}
              step={10}
              placeholder="500"
            />
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-text-primary">Hours of production per day</span>
                <span className="font-mono font-bold text-desert-green text-sm">{customHours || '—'} hrs</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={24}
                step={0.5}
                value={customHours || 8}
                onChange={(e) => setCustomHours(e.target.value)}
                className="accent-desert-green w-full"
              />
              <div className="flex justify-between text-xs text-text-secondary">
                <span>0.5 hrs</span>
                <span>24 hrs</span>
              </div>
            </div>
            <Field
              label="Efficiency"
              unit="%"
              hint="Account for charge controller and wiring losses"
              value={customEfficiency}
              onChange={setCustomEfficiency}
              min={1}
              max={100}
              placeholder="85"
            />
          </div>
        )}
      </SectionCard>

      {/* Results */}
      {result ? (
        <div className="rounded-xl border-2 border-desert-green p-5 space-y-4">
          <h3 className="font-bold text-text-primary flex items-center gap-2">
            {source === 'solar' && <IconSun size={18} className="text-desert-green" />}
            {source === 'wind' && <IconWind size={18} className="text-desert-green" />}
            {source === 'custom' && <IconBolt size={18} className="text-desert-green" />}
            {sourceLabel} Output
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <Chip
              label="Source output"
              value={`${result.effectiveW.toFixed(0)} W`}
              sub={`After efficiency losses`}
              accent
            />
            <Chip
              label="Energy per day"
              value={`${result.whPerDay >= 1000 ? (result.whPerDay / 1000).toFixed(2) + ' kWh' : result.whPerDay.toFixed(0) + ' Wh'}`}
              sub={`At current settings`}
              accent
            />
          </div>

          {result.hasPackContext && result.hoursToCharge !== null && result.daysToCharge !== null ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Chip
                  label="Production time to full charge"
                  value={`${result.hoursToCharge.toFixed(1)} hrs`}
                  sub={`Of active ${source === 'solar' ? 'sun' : source === 'wind' ? 'wind' : 'production'}`}
                  accent
                />
                <Chip
                  label="Calendar days to full charge"
                  value={
                    result.daysToCharge < 1
                      ? `${(result.daysToCharge * 24).toFixed(1)} hrs`
                      : `${result.daysToCharge.toFixed(1)} days`
                  }
                  sub={`Based on ${source === 'solar' ? sunHours : source === 'wind' ? windHours : customHours} hrs/day`}
                  accent
                />
              </div>
              <div className="rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-sm">
                <p>
                  Your <strong>{result.sourceWatts.toFixed(0)} W {sourceLabel.toLowerCase()}</strong> produces{' '}
                  <strong>
                    {result.whPerDay >= 1000
                      ? (result.whPerDay / 1000).toFixed(2) + ' kWh'
                      : result.whPerDay.toFixed(0) + ' Wh'}
                  </strong>{' '}
                  per day. To fully charge a{' '}
                  <strong>{packWh && packWh >= 1000 ? (packWh / 1000).toFixed(2) + ' kWh' : (packWh ?? 0).toFixed(0) + ' Wh'}</strong> pack you need{' '}
                  <strong>{result.hoursToCharge.toFixed(1)} hours</strong> of production —{' '}
                  roughly{' '}
                  <strong>
                    {result.daysToCharge < 1
                      ? 'less than a day'
                      : `${result.daysToCharge.toFixed(1)} days`}
                  </strong>.
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-sm text-text-secondary">
              Configure your battery pack on the left to see charge time estimates.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-text-secondary">
          Fill in your energy source details to see daily output.
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════════════════════
export default function PowerCalculator() {
  const [packWh, setPackWh] = useState<number | null>(null)

  return (
    <AppLayout>
      <Head title="Power System Calculator" />

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <IconBolt size={30} className="text-desert-orange-light shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Power System Calculator</h1>
            <p className="text-sm text-text-secondary">
              Size your battery pack and see how long it takes to recharge from clean energy.
              All calculations run locally — no internet required.
            </p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div>
            <h2 className="font-bold text-text-primary mb-3 flex items-center gap-2">
              <IconBattery2 size={18} className="text-desert-green" />
              Battery System
            </h2>
            <BatteryCalc onPackChange={setPackWh} />
          </div>

          <div>
            <h2 className="font-bold text-text-primary mb-3 flex items-center gap-2">
              <IconSun size={18} className="text-desert-green" />
              Energy Recovery
            </h2>
            <EnergyRecovery packWh={packWh} />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

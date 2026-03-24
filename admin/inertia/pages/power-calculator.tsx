import { Head } from '@inertiajs/react'
import { useState, useCallback } from 'react'
import AppLayout from '~/layouts/AppLayout'
import { IconBolt, IconBattery, IconPlug, IconAlertTriangle } from '@tabler/icons-react'

// ── Battery cell database ──────────────────────────────────────────────────
const BATTERY_TYPES: Record<
  string,
  { nominalV: number; capacityAh: number; label: string; maxC: number }
> = {
  '18650': { nominalV: 3.6, capacityAh: 3.0, label: '18650 Li-ion (3.0 Ah)', maxC: 2 },
  '21700': { nominalV: 3.6, capacityAh: 5.0, label: '21700 Li-ion (5.0 Ah)', maxC: 2 },
  lifepo4_cell: { nominalV: 3.2, capacityAh: 3.2, label: 'LiFePO4 26650 (3.2 Ah)', maxC: 3 },
  lifepo4_100ah: { nominalV: 3.2, capacityAh: 100, label: 'LiFePO4 100 Ah pack cell', maxC: 1 },
  lipo: { nominalV: 3.7, capacityAh: 5.0, label: 'LiPo (5.0 Ah)', maxC: 5 },
  lead_acid: { nominalV: 2.0, capacityAh: 45, label: 'Lead-Acid 12V (45 Ah)', maxC: 0.2 },
  ev_pouch: { nominalV: 3.65, capacityAh: 60, label: 'EV Pouch Cell (60 Ah)', maxC: 2 },
}

// ── Wire ampacity table (continuous, chassis wiring) ──────────────────────
const WIRE_AMPACITY: { awg: number; maxA: number }[] = [
  { awg: 10, maxA: 55 },
  { awg: 12, maxA: 41 },
  { awg: 14, maxA: 32 },
  { awg: 16, maxA: 22 },
  { awg: 18, maxA: 16 },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function recommendWire(currentA: number): { awg: number; maxA: number } {
  for (const entry of WIRE_AMPACITY) {
    if (currentA <= entry.maxA * 0.8) return entry // 80 % NEC derate
  }
  return WIRE_AMPACITY[0] // fallback to 10 AWG
}

function recommendFuse(currentA: number): number {
  // Next standard fuse size above 125 % of load current
  const target = currentA * 1.25
  const fuses = [1, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 125, 150, 200]
  return fuses.find((f) => f >= target) ?? 200
}

interface CalcResult {
  powerDrawW: number
  adjustedPowerW: number
  capacityNeededAh: number
  seriesCells: number
  parallelCells: number
  packVoltage: number
  totalCells: number
  wireRec: { awg: number; maxA: number }
  fuseA: number
  estimatedRuntimeH: number
  packConfig: string
  warning: string | null
}

// ── Main calculation ───────────────────────────────────────────────────────
function calculate(inputs: {
  voltage: number
  current: number
  runtimeH: number
  batteryType: string
  cRate: number
  lossPercent: number
}): CalcResult {
  const { voltage, current, runtimeH, batteryType, cRate, lossPercent } = inputs
  const cell = BATTERY_TYPES[batteryType]

  const powerDrawW = voltage * current
  const adjustedPowerW = powerDrawW / (1 - lossPercent / 100)

  // Series cells to achieve pack voltage
  const seriesCells = Math.ceil(voltage / cell.nominalV)
  const packVoltage = seriesCells * cell.nominalV

  // Capacity needed at pack level
  const capacityNeededAh = (adjustedPowerW * runtimeH) / packVoltage

  // Capacity per string limited by C-rate: I_discharge = cRate × Ah_cell
  // So pack current = adjustedPowerW / packVoltage
  const packCurrentA = adjustedPowerW / packVoltage
  const maxCurrentPerCell = cRate * cell.capacityAh
  const parallelCells = Math.max(1, Math.ceil(packCurrentA / maxCurrentPerCell))

  // If capacity constraint requires more parallel cells, use that
  const parallelForCapacity = Math.ceil(capacityNeededAh / cell.capacityAh)
  const finalParallel = Math.max(parallelCells, parallelForCapacity)

  const totalCells = seriesCells * finalParallel
  const totalPackAh = finalParallel * cell.capacityAh
  const estimatedRuntimeH = (totalPackAh * packVoltage) / adjustedPowerW

  const wireRec = recommendWire(current)
  const fuseA = recommendFuse(current)

  const packConfig =
    batteryType === 'lead_acid' || batteryType === 'lifepo4_100ah'
      ? `${seriesCells}S${finalParallel}P`
      : `${seriesCells}S${finalParallel}P (${batteryType})`

  let warning: string | null = null
  if (cRate > cell.maxC) {
    warning = `C-rate ${cRate}C exceeds recommended max ${cell.maxC}C for ${cell.label}. Reduce load or add more parallel cells.`
  }

  return {
    powerDrawW,
    adjustedPowerW,
    capacityNeededAh,
    seriesCells,
    parallelCells: finalParallel,
    packVoltage,
    totalCells,
    wireRec,
    fuseA,
    estimatedRuntimeH,
    packConfig,
    warning,
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────
function InputField({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step,
  helper,
}: {
  label: string
  unit?: string
  value: number | string
  onChange: (v: string) => void
  min?: number
  max?: number
  step?: number
  helper?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-text-primary">
        {label}
        {unit && <span className="ml-1 text-xs text-text-secondary">({unit})</span>}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-desert-green bg-transparent px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-desert-green"
      />
      {helper && <p className="text-xs text-text-secondary">{helper}</p>}
    </div>
  )
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between rounded px-4 py-3 ${
        highlight ? 'bg-desert-green text-white font-bold' : 'bg-gray-100 dark:bg-gray-800'
      }`}
    >
      <span className="text-sm">{label}</span>
      <span className={`font-mono text-sm ${highlight ? '' : 'text-desert-green font-semibold'}`}>
        {value}
      </span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function PowerCalculator() {
  const [voltage, setVoltage] = useState('12')
  const [current, setCurrent] = useState('10')
  const [runtimeH, setRuntimeH] = useState('5')
  const [batteryType, setBatteryType] = useState('18650')
  const [cRate, setCRate] = useState('0.5')
  const [lossPercent, setLossPercent] = useState('10')

  const result = useCallback((): CalcResult | null => {
    const v = parseFloat(voltage)
    const a = parseFloat(current)
    const h = parseFloat(runtimeH)
    const c = parseFloat(cRate)
    const l = parseFloat(lossPercent)
    if (!v || !a || !h || !c || isNaN(l)) return null
    if (v <= 0 || a <= 0 || h <= 0 || c <= 0) return null
    return calculate({ voltage: v, current: a, runtimeH: h, batteryType, cRate: c, lossPercent: l })
  }, [voltage, current, runtimeH, batteryType, cRate, lossPercent])

  const res = result()

  return (
    <AppLayout>
      <Head title="Power System Calculator" />

      <div className="max-w-5xl mx-auto p-4 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <IconBolt size={36} className="text-desert-orange-light" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Power System Calculator</h1>
            <p className="text-sm text-text-secondary">
              Size battery packs, wiring, and fuses for off-grid &amp; rebuild projects
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Inputs ── */}
          <div className="rounded-lg border border-desert-green p-5 space-y-4">
            <h2 className="flex items-center gap-2 font-semibold text-text-primary">
              <IconPlug size={20} className="text-desert-green" />
              System Parameters
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="System Voltage"
                unit="V"
                value={voltage}
                onChange={setVoltage}
                min={1}
                step={0.1}
                helper="Nominal pack voltage"
              />
              <InputField
                label="Load Current"
                unit="A"
                value={current}
                onChange={setCurrent}
                min={0.1}
                step={0.1}
                helper="Continuous draw"
              />
              <InputField
                label="Required Runtime"
                unit="hours"
                value={runtimeH}
                onChange={setRuntimeH}
                min={0.1}
                step={0.25}
              />
              <InputField
                label="Power Loss"
                unit="%"
                value={lossPercent}
                onChange={setLossPercent}
                min={0}
                max={50}
                step={1}
                helper="Wiring + converter losses"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">Battery Cell Type</label>
              <select
                value={batteryType}
                onChange={(e) => setBatteryType(e.target.value)}
                className="rounded border border-desert-green bg-transparent px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-desert-green"
              >
                {Object.entries(BATTERY_TYPES).map(([key, cell]) => (
                  <option key={key} value={key} className="bg-gray-800">
                    {cell.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-text-primary">
                  Discharge C-rate
                  <span className="ml-1 text-xs text-text-secondary">(C)</span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={cRate}
                  onChange={(e) => setCRate(e.target.value)}
                  className="accent-desert-green"
                />
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>0.1C</span>
                  <span className="font-semibold text-desert-green">{cRate}C</span>
                  <span>5C</span>
                </div>
                <p className="text-xs text-text-secondary">
                  Low-power systems: 0.2–0.5C &nbsp;|&nbsp; EV: 1–3C
                </p>
              </div>

              {/* Cell quick-ref */}
              <div className="rounded bg-gray-100 dark:bg-gray-800 p-3 text-xs space-y-1">
                <p className="font-semibold text-text-primary mb-1">Cell Reference</p>
                <p>Nominal V: <span className="font-mono text-desert-green">{BATTERY_TYPES[batteryType].nominalV} V</span></p>
                <p>Capacity: <span className="font-mono text-desert-green">{BATTERY_TYPES[batteryType].capacityAh} Ah</span></p>
                <p>Max C: <span className="font-mono text-desert-green">{BATTERY_TYPES[batteryType].maxC}C</span></p>
              </div>
            </div>

            {/* Derived power */}
            {voltage && current && (
              <div className="rounded bg-desert-green/10 border border-desert-green/30 px-4 py-2 text-sm">
                Estimated load:{' '}
                <span className="font-bold font-mono text-desert-green">
                  {(parseFloat(voltage) * parseFloat(current)).toFixed(1)} W
                </span>
              </div>
            )}
          </div>

          {/* ── Outputs ── */}
          <div className="rounded-lg border border-desert-green p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-text-primary">
              <IconBattery size={20} className="text-desert-green" />
              Calculation Results
            </h2>

            {res ? (
              <>
                {res.warning && (
                  <div className="flex items-start gap-2 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                    <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                    {res.warning}
                  </div>
                )}

                <div className="space-y-2">
                  <ResultRow
                    label="Power Draw (gross)"
                    value={`${res.powerDrawW.toFixed(1)} W`}
                  />
                  <ResultRow
                    label="Adjusted Power (with losses)"
                    value={`${res.adjustedPowerW.toFixed(1)} W`}
                  />
                  <ResultRow
                    label="Capacity Needed"
                    value={`${res.capacityNeededAh.toFixed(1)} Ah`}
                    highlight
                  />
                  <ResultRow
                    label="Pack Configuration"
                    value={`${res.seriesCells}S${res.parallelCells}P`}
                    highlight
                  />
                  <ResultRow
                    label="Pack Voltage"
                    value={`${res.packVoltage.toFixed(2)} V`}
                  />
                  <ResultRow
                    label="Total Cells"
                    value={`${res.totalCells}`}
                  />
                  <ResultRow
                    label="Wire Gauge"
                    value={`${res.wireRec.awg} AWG (≤${res.wireRec.maxA} A)`}
                    highlight
                  />
                  <ResultRow
                    label="Fuse Rating"
                    value={`${res.fuseA} A`}
                    highlight
                  />
                  <ResultRow
                    label="Estimated Runtime"
                    value={`${res.estimatedRuntimeH.toFixed(2)} hrs`}
                    highlight
                  />
                </div>

                {/* Config summary card */}
                <div className="mt-4 rounded-lg bg-desert-green text-white p-4 text-center space-y-1">
                  <p className="text-xs opacity-80 uppercase tracking-wider">Pack Summary</p>
                  <p className="text-3xl font-bold font-mono">
                    {res.seriesCells}S{res.parallelCells}P
                  </p>
                  <p className="text-sm opacity-90">
                    {res.totalCells} cells &nbsp;·&nbsp; {res.packVoltage.toFixed(1)} V &nbsp;·&nbsp;{' '}
                    {(res.parallelCells * BATTERY_TYPES[batteryType].capacityAh).toFixed(1)} Ah
                  </p>
                  <p className="text-sm opacity-90">
                    {res.wireRec.awg} AWG wire &nbsp;·&nbsp; {res.fuseA} A fuse
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-text-secondary text-sm">
                Fill in all fields to see results
              </div>
            )}
          </div>
        </div>

        {/* ── Reference table ── */}
        <div className="rounded-lg border border-desert-green p-5">
          <h2 className="font-semibold text-text-primary mb-3">Quick Reference — Wire Ampacity</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-desert-green text-white">
                  <th className="px-4 py-2 text-left rounded-tl">AWG</th>
                  <th className="px-4 py-2 text-left">Max Continuous (A)</th>
                  <th className="px-4 py-2 text-left">80% Derated (A)</th>
                  <th className="px-4 py-2 text-left rounded-tr">Typical Use</th>
                </tr>
              </thead>
              <tbody>
                {WIRE_AMPACITY.map((row, i) => {
                  const isRec = res?.wireRec.awg === row.awg
                  return (
                    <tr
                      key={row.awg}
                      className={`${
                        isRec
                          ? 'bg-desert-orange-light/20 font-semibold'
                          : i % 2 === 0
                          ? 'bg-gray-50 dark:bg-gray-800/50'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-2">{row.awg} AWG {isRec && <span className="text-desert-orange-light text-xs ml-1">← recommended</span>}</td>
                      <td className="px-4 py-2 font-mono">{row.maxA} A</td>
                      <td className="px-4 py-2 font-mono">{(row.maxA * 0.8).toFixed(0)} A</td>
                      <td className="px-4 py-2 text-text-secondary">
                        {row.awg === 10
                          ? 'Main feeds, inverters'
                          : row.awg === 12
                          ? 'Branch circuits, motors'
                          : row.awg === 14
                          ? 'Lighting, small loads'
                          : row.awg === 16
                          ? 'Accessories, sensors'
                          : 'Low-power, signal'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Battery info ── */}
        <div className="rounded-lg border border-desert-green p-5">
          <h2 className="font-semibold text-text-primary mb-3">Battery Cell Reference</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-desert-green text-white">
                  <th className="px-4 py-2 text-left rounded-tl">Cell</th>
                  <th className="px-4 py-2 text-left">Nominal V</th>
                  <th className="px-4 py-2 text-left">Capacity (Ah)</th>
                  <th className="px-4 py-2 text-left">Max C-rate</th>
                  <th className="px-4 py-2 text-left rounded-tr">Best For</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(BATTERY_TYPES).map(([key, cell], i) => (
                  <tr
                    key={key}
                    className={`${
                      batteryType === key
                        ? 'bg-desert-orange-light/20 font-semibold'
                        : i % 2 === 0
                        ? 'bg-gray-50 dark:bg-gray-800/50'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-2">
                      {cell.label.split(' ')[0]}{' '}
                      {batteryType === key && (
                        <span className="text-desert-orange-light text-xs ml-1">← selected</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono">{cell.nominalV} V</td>
                    <td className="px-4 py-2 font-mono">{cell.capacityAh} Ah</td>
                    <td className="px-4 py-2 font-mono">{cell.maxC}C</td>
                    <td className="px-4 py-2 text-text-secondary">
                      {key === '18650'
                        ? 'Flashlights, DIY packs, low-power'
                        : key === '21700'
                        ? 'E-bikes, higher-capacity packs'
                        : key === 'lifepo4_cell'
                        ? 'Solar storage, long-cycle life'
                        : key === 'lifepo4_100ah'
                        ? 'Camper vans, off-grid cabins'
                        : key === 'lipo'
                        ? 'Drones, RC, high-discharge'
                        : key === 'lead_acid'
                        ? 'Low cost, starter batteries'
                        : 'EV packs, high energy density'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppLayout>
  )
}

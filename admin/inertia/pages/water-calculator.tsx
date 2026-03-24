import { Head } from '@inertiajs/react'
import { useState, useMemo, useCallback } from 'react'
import AppLayout from '~/layouts/AppLayout'
import {
  IconDroplet,
  IconFlask,
  IconAlertTriangle,
  IconInfoCircle,
  IconChevronDown,
  IconChevronUp,
  IconShieldCheck,
  IconFlame,
} from '@tabler/icons-react'

// ── Persistent state (survives navigation) ─────────────────────────────────
function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setInner] = useState<T>(() => {
    try {
      const stored = localStorage.getItem('nomad_watercalc_' + key)
      return stored !== null ? (JSON.parse(stored) as T) : initial
    } catch {
      return initial
    }
  })
  const setValue = useCallback(
    (v: T | ((prev: T) => T)) => {
      setInner((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
        try { localStorage.setItem('nomad_watercalc_' + key, JSON.stringify(next)) } catch {}
        return next
      })
    },
    [key]
  )
  return [value, setValue]
}

// ── Types ──────────────────────────────────────────────────────────────────
type WaterSource = 'rainwater' | 'groundwater' | 'surface' | 'unknown'
type Method = 'bleach' | 'iodine' | 'generic' | 'boil'
type RiskLevel = 'low' | 'moderate' | 'high'
type VolumeUnit = 'gal' | 'L'

// ── Static risk and treatment data ─────────────────────────────────────────
const SOURCE_RISK: Record<WaterSource, { label: string; color: string; notes: string[]; defaultRisk: RiskLevel }> = {
  rainwater: {
    label: 'Rainwater',
    color: 'blue',
    defaultRisk: 'low',
    notes: [
      'Generally lowest biological risk if collected from a clean surface.',
      'First-flush runoff (initial rain after a dry period) concentrates pollutants — discard it.',
      'Rooftop collection can introduce bird feces, lead paint, and particulates.',
      'In areas with air pollution or wildfire smoke, rain can carry contaminants.',
    ],
  },
  groundwater: {
    label: 'Groundwater / Well',
    color: 'amber',
    defaultRisk: 'low',
    notes: [
      'Naturally filtered but not sterile — bacterial and chemical risks exist.',
      'Can be contaminated by nearby septic systems, agriculture runoff, or industry.',
      'Well water quality can change rapidly after heavy rainfall or flooding.',
      'Test periodically; do not assume "always safe" based on past tests.',
    ],
  },
  surface: {
    label: 'Surface Water (River / Lake)',
    color: 'red',
    defaultRisk: 'high',
    notes: [
      'Always assume biological contamination. Treat before drinking.',
      'Giardia and Cryptosporidium are common — chlorine alone may not be enough for high risk.',
      'Turbid water reduces chemical treatment effectiveness. Always filter first.',
      'After storms, flooding, or upstream activity, risk increases dramatically.',
      'Blue-green algae (cyanobacteria) produce toxins that filtration and boiling cannot remove.',
    ],
  },
  unknown: {
    label: 'Unknown Source',
    color: 'red',
    defaultRisk: 'high',
    notes: [
      'Treat as high risk. Unknown water should always receive full treatment.',
      'Filter visible particulates first, then apply chemical treatment, then boil if possible.',
      'If the water smells strongly of chemicals, petroleum, or sewage — do not drink even after treatment.',
    ],
  },
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Minimal Risk',
  moderate: 'Moderate Risk',
  high: 'High Risk',
}

// Bleach drops per GALLON (baseline for 5% chlorine, clear water)
const BLEACH_BASE_DROPS_PER_GAL: Record<RiskLevel, number> = {
  low: 4,
  moderate: 8,
  high: 16,
}

// Iodine drops per LITER (baseline for 2% iodine tincture)
const IODINE_BASE_DROPS_PER_L: Record<RiskLevel, number> = {
  low: 5,
  moderate: 10,
  high: 20,
}

// Target free chlorine concentration mg/L (ppm) for generic chemical
const GENERIC_TARGET_PPM: Record<RiskLevel, number> = {
  low: 1,
  moderate: 2,
  high: 4,
}

const CONTACT_TIME: Record<Method, Record<RiskLevel, string>> = {
  bleach: {
    low: 'Let stand 30 minutes before drinking. If water is cold (<10 °C / 50 °F), wait 60 minutes.',
    moderate: 'Let stand 30 minutes. If cloudy or cold, wait 60 minutes.',
    high: 'Let stand 60 minutes. Boil afterward if possible.',
  },
  iodine: {
    low: 'Let stand 30 minutes. Iodine is less effective in cold water — wait 60 min if cold.',
    moderate: 'Let stand 30–60 minutes. Do not use iodine as a long-term solution.',
    high: 'Let stand 60 minutes, then boil if possible. Iodine may not eliminate Cryptosporidium.',
  },
  generic: {
    low: 'Follow manufacturer contact time. Typically 15–30 minutes.',
    moderate: 'Follow manufacturer contact time. Typically 30 minutes.',
    high: 'Follow manufacturer contact time plus an additional 15 minutes. Boil if possible.',
  },
  boil: {
    low: 'Bring to a rolling boil for 1 minute. At elevations above 5,000 ft (1,500 m), boil for 3 minutes.',
    moderate: 'Bring to a rolling boil for 1 minute. Above 5,000 ft, boil 3 minutes.',
    high: 'Bring to a rolling boil for 3 minutes regardless of altitude. Let cool covered.',
  },
}

function getTreatmentSteps(source: WaterSource, method: Method, risk: RiskLevel): string[] {
  const steps: string[] = []

  // Filtering
  if (source === 'surface' || source === 'unknown' || risk === 'high') {
    steps.push('Pre-filter through multiple layers of clean cloth or a commercial sediment filter to remove large particles.')
  } else if (risk === 'moderate') {
    steps.push('Pre-filter through cloth if water appears cloudy or has visible particles.')
  }

  // Settling
  if (risk === 'high' || source === 'surface') {
    steps.push('Allow sediment to settle for 30–60 minutes before treatment if very turbid.')
  }

  // Chemical treatment
  if (method === 'bleach') steps.push('Add calculated bleach dose and stir gently.')
  if (method === 'iodine') steps.push('Add calculated iodine drops and stir gently.')
  if (method === 'generic') steps.push('Add calculated purification chemical dose per manufacturer instructions.')

  // Contact time
  if (method !== 'boil') {
    steps.push(CONTACT_TIME[method][risk])
  }

  // Boil
  if (method === 'boil' || (risk === 'high' && method !== 'boil')) {
    steps.push(CONTACT_TIME['boil'][risk])
  }

  // Storage
  steps.push('Store treated water in a covered, clean container. Use within 24 hours if possible.')

  return steps
}

function num(s: string): number {
  const v = parseFloat(s)
  return isNaN(v) ? 0 : v
}

function fmtNum(v: number, decimals = 1): string {
  return v.toFixed(decimals).replace(/\.?0+$/, '') || '0'
}

// ── Reusable components ────────────────────────────────────────────────────
function SectionCard({
  step,
  title,
  complete,
  children,
}: {
  step?: number
  title: string
  complete?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border-2 p-5 space-y-4 transition-colors ${complete ? 'border-desert-green' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-center gap-3">
        {step !== undefined && (
          <span className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold shrink-0 ${complete ? 'bg-desert-green text-white' : 'bg-gray-200 dark:bg-gray-700 text-text-secondary'}`}>
            {step}
          </span>
        )}
        <h2 className="font-bold text-base text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Chip({ label, value, sub, accent, warn }: {
  label: string; value: string; sub?: string; accent?: boolean; warn?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col gap-0.5 ${accent ? 'bg-desert-green text-white' : warn ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400' : 'bg-gray-100 dark:bg-gray-800'}`}>
      <span className={`text-xs font-medium uppercase tracking-wider ${accent ? 'opacity-75' : warn ? 'text-yellow-700 dark:text-yellow-300' : 'text-text-secondary'}`}>{label}</span>
      <span className={`text-xl font-bold font-mono ${accent ? '' : warn ? 'text-yellow-800 dark:text-yellow-200' : 'text-text-primary'}`}>{value}</span>
      {sub && <span className={`text-xs ${accent ? 'opacity-80' : 'text-text-secondary'}`}>{sub}</span>}
    </div>
  )
}

function ToggleGroup<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string; icon?: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors ${
            value === o.value
              ? 'border-desert-green bg-desert-green text-white'
              : 'border-gray-200 dark:border-gray-700 text-text-secondary hover:border-desert-green'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function WaterCalculator() {
  // Step 1 — source
  const [source, setSource] = useLocalStorage<WaterSource>('source', 'unknown')
  const [notes, setNotes] = useLocalStorage('notes', '')

  // Step 2 — volume
  const [volume, setVolume] = useLocalStorage('volume', '1')
  const [unit, setUnit] = useLocalStorage<VolumeUnit>('unit', 'gal')

  // Step 3 — method & concentration
  const [method, setMethod] = useLocalStorage<Method>('method', 'bleach')
  const [bleachPct, setBleachPct] = useLocalStorage('bleachPct', '5')
  const [iodineConc, setIodineConc] = useLocalStorage('iodineConc', '2')
  const [genericConc, setGenericConc] = useLocalStorage('genericConc', '')

  // Step 4 — risk
  const [risk, setRisk] = useLocalStorage<RiskLevel>('risk', 'moderate')

  // UI
  const [showRef, setShowRef] = useState(false)

  const volumeL = useMemo(() => {
    const v = num(volume)
    return unit === 'gal' ? v * 3.785 : v
  }, [volume, unit])

  const volumeGal = useMemo(() => {
    const v = num(volume)
    return unit === 'L' ? v / 3.785 : v
  }, [volume, unit])

  const sourceInfo = SOURCE_RISK[source]

  // ── Dosing calc ──────────────────────────────────────────────────────────
  const dosing = useMemo(() => {
    if (method === 'boil') return null

    if (method === 'bleach') {
      const pct = num(bleachPct) || 5
      // Scale from 5% baseline
      const scaledDropsPerGal = (BLEACH_BASE_DROPS_PER_GAL[risk] * 5) / pct
      const totalDrops = scaledDropsPerGal * volumeGal
      const totalMl = totalDrops * 0.05
      return {
        perUnitLabel: unit === 'gal' ? 'per gallon' : 'per liter',
        perUnit: unit === 'gal' ? scaledDropsPerGal : scaledDropsPerGal / 3.785,
        totalDrops,
        totalMl,
        unit: 'drops',
        note: `Based on ${pct}% sodium hypochlorite (bleach). 1 drop ≈ 0.05 mL. Use unscented, additive-free bleach only.`,
      }
    }

    if (method === 'iodine') {
      const pct = num(iodineConc) || 2
      // Scale from 2% baseline
      const scaledDropsPerL = (IODINE_BASE_DROPS_PER_L[risk] * 2) / pct
      const totalDrops = scaledDropsPerL * volumeL
      const totalMl = totalDrops * 0.05
      return {
        perUnitLabel: unit === 'L' ? 'per liter' : 'per gallon',
        perUnit: unit === 'L' ? scaledDropsPerL : scaledDropsPerL * 3.785,
        totalDrops,
        totalMl,
        unit: 'drops',
        note: `Based on ${pct}% iodine tincture. Do not use iodine as a long-term solution or if pregnant/thyroid conditions exist.`,
      }
    }

    if (method === 'generic') {
      const sourceConc = num(genericConc)
      if (!sourceConc) return null
      const targetPpm = GENERIC_TARGET_PPM[risk]
      // mg needed = targetPpm (mg/L) × volumeL
      // volume of chemical (mL) = mg_needed / (sourceConc_ppm × 1000/1000) = mg_needed / sourceConc
      // Since sourceConc is in mg/mL (ppm of stock solution):
      // Actually ppm = mg/L, so stock is sourceConc mg/mL = sourceConc*1000 mg/L
      const mgNeeded = targetPpm * volumeL
      const mlNeeded = mgNeeded / sourceConc
      return {
        perUnitLabel: unit === 'L' ? 'per liter' : 'per gallon',
        perUnit: unit === 'L' ? mlNeeded / volumeL : (mlNeeded / volumeL) * 3.785,
        totalDrops: mlNeeded / 0.05,
        totalMl: mlNeeded,
        unit: 'mL',
        note: `Targeting ${targetPpm} mg/L (ppm) free residual. Chemical concentration: ${sourceConc} mg/mL. Always confirm with manufacturer label.`,
      }
    }

    return null
  }, [method, bleachPct, iodineConc, genericConc, risk, volumeGal, volumeL, unit])

  const treatmentSteps = useMemo(
    () => getTreatmentSteps(source, method, risk),
    [source, method, risk]
  )

  const riskColor = {
    low: 'text-green-600 dark:text-green-400',
    moderate: 'text-yellow-600 dark:text-yellow-400',
    high: 'text-red-600 dark:text-red-400',
  }[risk]

  const riskBg = {
    low: 'bg-green-50 dark:bg-green-900/20 border-green-300',
    moderate: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400',
    high: 'bg-red-50 dark:bg-red-900/20 border-red-400',
  }[risk]

  const sourceColor = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300',
    amber: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-400',
  }[sourceInfo.color]

  return (
    <AppLayout>
      <Head title="Water Safety Calculator" />

      <div className="max-w-5xl mx-auto p-4 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <IconDroplet size={30} className="text-blue-500 shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Water Safety &amp; Purification Calculator</h1>
            <p className="text-sm text-text-secondary">
              Estimate risk, calculate treatment dosing, and get step-by-step guidance.
              Runs fully offline — no internet required.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* ── Left column: Inputs ── */}
          <div className="space-y-4">

            {/* Step 1: Source */}
            <SectionCard step={1} title="Where did the water come from?" complete={true}>
              <ToggleGroup<WaterSource>
                value={source}
                onChange={setSource}
                options={[
                  { value: 'rainwater', label: 'Rain' },
                  { value: 'groundwater', label: 'Well / Ground' },
                  { value: 'surface', label: 'River / Lake' },
                  { value: 'unknown', label: 'Unknown' },
                ]}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-text-primary">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 'green algae present', 'after wildfire', 'near construction site', 'smells musty'"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-desert-green"
                />
                <p className="text-xs text-text-secondary">Used for your reference only — does not affect calculations.</p>
              </div>
            </SectionCard>

            {/* Step 2: Volume */}
            <SectionCard step={2} title="How much water are you treating?" complete={num(volume) > 0}>
              <div className="flex gap-3 items-end">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-sm font-semibold text-text-primary">Volume</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.5}
                    placeholder="1"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-desert-green"
                  />
                </div>
                <ToggleGroup<VolumeUnit>
                  value={unit}
                  onChange={setUnit}
                  options={[
                    { value: 'gal', label: 'Gallons' },
                    { value: 'L', label: 'Liters' },
                  ]}
                />
              </div>
              {num(volume) > 0 && (
                <p className="text-sm rounded-lg bg-desert-green/10 border border-desert-green/30 px-3 py-2">
                  {fmtNum(num(volume), 2)} {unit === 'gal' ? 'gallons' : 'liters'} ={' '}
                  <span className="font-bold text-desert-green">
                    {unit === 'gal' ? `${fmtNum(volumeL, 1)} L` : `${fmtNum(volumeGal, 2)} gal`}
                  </span>
                </p>
              )}
            </SectionCard>

            {/* Step 3: Method */}
            <SectionCard
              step={3}
              title="How are you purifying it?"
              complete={method === 'boil' || (method === 'generic' ? num(genericConc) > 0 : true)}
            >
              <ToggleGroup<Method>
                value={method}
                onChange={setMethod}
                options={[
                  { value: 'bleach', label: 'Bleach', icon: <IconFlask size={15} /> },
                  { value: 'iodine', label: 'Iodine', icon: <IconFlask size={15} /> },
                  { value: 'generic', label: 'Chemical', icon: <IconFlask size={15} /> },
                  { value: 'boil', label: 'Boil only', icon: <IconFlame size={15} /> },
                ]}
              />

              {method === 'bleach' && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-text-primary">
                    Bleach concentration
                    <span className="ml-1 font-normal text-text-secondary text-xs">(% available chlorine)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    step={0.25}
                    placeholder="5"
                    value={bleachPct}
                    onChange={(e) => setBleachPct(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-desert-green"
                  />
                  <p className="text-xs text-text-secondary">
                    Regular household bleach is typically 5–6%. Ultra or concentrated bleach: 8.25%. Check the label.
                    Use unscented, additive-free bleach only.
                  </p>
                </div>
              )}

              {method === 'iodine' && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-text-primary">
                    Iodine concentration
                    <span className="ml-1 font-normal text-text-secondary text-xs">(% iodine tincture)</span>
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={10}
                    step={0.5}
                    placeholder="2"
                    value={iodineConc}
                    onChange={(e) => setIodineConc(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-desert-green"
                  />
                  <p className="text-xs text-text-secondary">
                    Standard iodine tincture from a first-aid kit is 2%. Lugol's iodine is typically 5 or 10%.
                  </p>
                </div>
              )}

              {method === 'generic' && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-text-primary">
                    Chemical concentration
                    <span className="ml-1 font-normal text-text-secondary text-xs">(mg/mL of active ingredient)</span>
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    placeholder="e.g. 10"
                    value={genericConc}
                    onChange={(e) => setGenericConc(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-desert-green"
                  />
                  <p className="text-xs text-text-secondary">
                    Check your product label for active ingredient mg/mL. This calculator targets 1–4 mg/L free residual.
                  </p>
                </div>
              )}

              {method === 'boil' && (
                <p className="text-sm rounded-lg bg-desert-green/10 border border-desert-green/30 px-3 py-2">
                  Boiling is the most reliable method. It kills bacteria, viruses, and most parasites.
                  Chemical dosing is not required — see treatment steps in the results.
                </p>
              )}
            </SectionCard>

            {/* Step 4: Risk level */}
            <SectionCard step={4} title="What's the risk level?" complete={true}>
              <ToggleGroup<RiskLevel>
                value={risk}
                onChange={setRisk}
                options={[
                  { value: 'low', label: 'Low risk' },
                  { value: 'moderate', label: 'Moderate' },
                  { value: 'high', label: 'High risk' },
                ]}
              />
              <div className={`rounded-lg border px-3 py-2 text-sm ${riskBg}`}>
                <p className={`font-semibold ${riskColor}`}>{RISK_LABELS[risk]}</p>
                <p className="text-text-secondary text-xs mt-0.5">
                  {risk === 'low' && 'Clean source, no known contamination, normal conditions.'}
                  {risk === 'moderate' && 'After a storm, uncertain source history, or visible turbidity.'}
                  {risk === 'high' && 'Flooding, known contamination, algae bloom, disaster scenario, or unknown source.'}
                </p>
              </div>
            </SectionCard>
          </div>

          {/* ── Right column: Results ── */}
          <div className="space-y-4">

            {/* Source risk notes */}
            <div className={`rounded-xl border-2 p-5 space-y-3 ${sourceColor}`}>
              <h2 className="font-bold text-base text-text-primary flex items-center gap-2">
                <IconAlertTriangle size={18} />
                Risk Notes — {sourceInfo.label}
              </h2>
              <ul className="space-y-2">
                {sourceInfo.notes.map((note, i) => (
                  <li key={i} className="flex gap-2 text-sm text-text-primary">
                    <span className="mt-0.5 shrink-0 opacity-60">•</span>
                    {note}
                  </li>
                ))}
              </ul>
              {notes.trim() && (
                <div className="rounded-lg bg-white/50 dark:bg-black/20 border border-current/20 px-3 py-2 text-sm">
                  <p className="font-semibold text-text-primary text-xs uppercase tracking-wide mb-1">Your notes</p>
                  <p className="text-text-primary italic">{notes}</p>
                </div>
              )}
            </div>

            {/* Dosing */}
            {method !== 'boil' && (
              <div className="rounded-xl border-2 border-desert-green p-5 space-y-4">
                <h2 className="font-bold text-base text-text-primary flex items-center gap-2">
                  <IconFlask size={18} className="text-desert-green" />
                  Dosing Calculator
                </h2>

                {dosing ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Chip
                        label={`Drops ${dosing.perUnitLabel}`}
                        value={`${fmtNum(dosing.perUnit, 1)} drops`}
                        accent
                      />
                      <Chip
                        label={`Total for ${fmtNum(num(volume), 1)} ${unit}`}
                        value={`${fmtNum(dosing.totalDrops, 0)} drops`}
                        accent
                      />
                      <Chip
                        label="Total volume (mL)"
                        value={`${fmtNum(dosing.totalMl, 2)} mL`}
                        sub={dosing.totalMl < 1 ? 'Less than 1 mL — use a dropper' : undefined}
                        accent
                      />
                      <Chip
                        label="Contact time"
                        value={risk === 'high' ? '60 min' : '30 min'}
                        sub="Before drinking"
                        accent
                      />
                    </div>
                    <p className="text-xs text-text-secondary px-1">{dosing.note}</p>
                  </>
                ) : (
                  method === 'generic' && (
                    <p className="text-sm text-text-secondary">
                      Enter your chemical concentration above to calculate dosing.
                    </p>
                  )
                )}
              </div>
            )}

            {/* Treatment steps */}
            <div className="rounded-xl border-2 border-desert-green p-5 space-y-3">
              <h2 className="font-bold text-base text-text-primary flex items-center gap-2">
                <IconShieldCheck size={18} className="text-desert-green" />
                Treatment Steps
              </h2>
              <ol className="space-y-2.5">
                {treatmentSteps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-desert-green text-white text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-text-primary">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Contact time summary */}
            <div className="rounded-xl bg-gray-100 dark:bg-gray-800 p-4 text-sm space-y-1">
              <p className="font-semibold text-text-primary">Contact Time Reminder</p>
              <p className="text-text-secondary">{CONTACT_TIME[method][risk]}</p>
            </div>

            {/* Warning for high-risk + chemical only */}
            {risk === 'high' && method !== 'boil' && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-400 px-4 py-3 text-sm text-red-800 dark:text-red-300 flex gap-2">
                <IconAlertTriangle size={18} className="shrink-0 mt-0.5" />
                <p>
                  At high risk, chemical treatment alone may not eliminate <strong>Cryptosporidium</strong> or
                  <strong> cyanotoxins</strong>. Boiling after chemical treatment is strongly recommended.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Reference section ── */}
        <div>
          <button
            onClick={() => setShowRef((p) => !p)}
            className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-desert-green transition-colors mb-3"
          >
            <IconInfoCircle size={16} />
            Reference Tables &amp; Storage Notes
            {showRef ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </button>

          {showRef && (
            <div className="space-y-5">

              {/* Source risk table */}
              <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 p-5">
                <h3 className="font-bold text-text-primary mb-3">Common Water Source Risk Overview</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-desert-green text-white">
                        <th className="px-4 py-2 text-left rounded-tl">Source</th>
                        <th className="px-4 py-2 text-left">Typical Risk</th>
                        <th className="px-4 py-2 text-left">Primary Concerns</th>
                        <th className="px-4 py-2 text-left rounded-tr">Minimum Treatment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { source: 'Rainwater (clean collection)', risk: 'Low', concerns: 'Air pollutants, roof contaminants, first flush', min: 'Filter + boil or chemical' },
                        { source: 'Well / Groundwater', risk: 'Low–Moderate', concerns: 'Bacteria, nitrates, heavy metals, septic runoff', min: 'Test periodically; boil if uncertain' },
                        { source: 'Clear river / lake', risk: 'Moderate', concerns: 'Giardia, bacteria, sediment', min: 'Filter + chemical + boil' },
                        { source: 'Turbid / muddy water', risk: 'High', concerns: 'All of the above + elevated pathogen load', min: 'Settle → Filter → chemical → boil' },
                        { source: 'Flood / disaster water', risk: 'Very High', concerns: 'Sewage, chemicals, all pathogens', min: 'Do not drink unless absolutely necessary; full treatment + boil' },
                        { source: 'Water with algae bloom', risk: 'High', concerns: 'Cyanotoxins (cannot be removed by boiling or chlorine alone)', min: 'Do not use if possible; no reliable field treatment for toxins' },
                      ].map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}>
                          <td className="px-4 py-2 font-medium">{row.source}</td>
                          <td className="px-4 py-2">{row.risk}</td>
                          <td className="px-4 py-2 text-text-secondary">{row.concerns}</td>
                          <td className="px-4 py-2 text-text-secondary">{row.min}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Chemical storage notes */}
              <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 p-5 space-y-3">
                <h3 className="font-bold text-text-primary">Chemical Storage &amp; Shelf Life</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3 space-y-1">
                    <p className="font-semibold">Household Bleach</p>
                    <p className="text-text-secondary">Loses ~20% potency per year stored at room temperature. Buy fresh stock annually. Store in a cool, dark place. Never mix with ammonia or other chemicals.</p>
                  </div>
                  <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3 space-y-1">
                    <p className="font-semibold">Iodine Tincture</p>
                    <p className="text-text-secondary">Stable for 4+ years if kept sealed and away from light. Not suitable for pregnant individuals, those with thyroid conditions, or long-term use (&gt; 3 weeks). Avoid for infants.</p>
                  </div>
                  <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3 space-y-1">
                    <p className="font-semibold">Commercial Tablets</p>
                    <p className="text-text-secondary">Check expiry date. Once opened, use within the manufacturer's stated period. Halazone tablets degrade faster than iodine or chlorine dioxide tablets.</p>
                  </div>
                </div>
              </div>

              {/* General reminders */}
              <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-5">
                <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
                  <IconAlertTriangle size={16} className="text-yellow-600" />
                  Important Reminders
                </h3>
                <ul className="space-y-2 text-sm text-text-primary">
                  <li>• <strong>Never drink untreated water</strong> from an unknown or high-risk source — even a small amount can cause serious illness.</li>
                  <li>• <strong>Filter solids first</strong> — chemical treatment is less effective in turbid water. Sediment can shield pathogens from chlorine/iodine.</li>
                  <li>• <strong>Temperature matters</strong> — chemical treatment is slower in cold water. Extend contact time or use boiling.</li>
                  <li>• <strong>Chemical taste</strong> can be reduced by aerating treated water (pour between containers) or adding a pinch of vitamin C (ascorbic acid) after the contact time is complete.</li>
                  <li>• <strong>Cyanotoxins and heavy metals</strong> are not removed by boiling or standard chemical treatment. If algae blooms or industrial contamination is suspected, do not use the water.</li>
                  <li>• For serious illness or suspected poisoning, consult the <strong>ZIM medical reference</strong> available on this NOMAD node.</li>
                </ul>
              </div>

            </div>
          )}
        </div>

      </div>
    </AppLayout>
  )
}

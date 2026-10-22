import { formatLocalTime } from '../lib/format'
import { LEVEL_LABEL } from '../lib/risk'
import type { Plan, SelectedCheckpoint } from '../types'
import './CheckpointPicker.css'

interface CheckpointPickerProps {
  plan: Plan
  routeId: string
  selection: SelectedCheckpoint | null
  onSelectCheckpoint: (selection: SelectedCheckpoint | null) => void
}

export default function CheckpointPicker({
  plan,
  routeId,
  selection,
  onSelectCheckpoint,
}: CheckpointPickerProps) {
  const checkpoints = plan.routes.find((r) => r.id === routeId)?.checkpoints ?? []
  const index = selection?.routeId === routeId ? selection.index : null
  const select = (next: number) => onSelectCheckpoint({ routeId, index: next })

  return (
    <div className="cp-picker" role="group" aria-label="Browse checkpoints">
      <button
        type="button"
        className="cp-picker__step"
        aria-label="Previous checkpoint"
        disabled={index === null || index === 0}
        onClick={() => index !== null && select(index - 1)}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M10 3 5 8l5 5" />
        </svg>
      </button>
      <select
        className="cp-picker__select num"
        aria-label="Checkpoint"
        value={index === null ? '' : String(index)}
        onChange={(event) =>
          event.target.value === '' ? onSelectCheckpoint(null) : select(Number(event.target.value))
        }
      >
        <option value="">None</option>
        {checkpoints.map((cp, i) => (
          <option key={i} value={i}>
            MP {Math.round(cp.mile)} - {formatLocalTime(cp)} - {LEVEL_LABEL[cp.level]}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="cp-picker__step"
        aria-label="Next checkpoint"
        disabled={checkpoints.length === 0 || index === checkpoints.length - 1}
        onClick={() => select(index === null ? 0 : index + 1)}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="m6 3 5 5-5 5" />
        </svg>
      </button>
    </div>
  )
}

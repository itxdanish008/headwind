import { useId, useState, type ReactNode } from 'react'
import { useGeocode } from '../api/client'
import './PlaceInput.css'

interface PlaceInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  icon: ReactNode
  invalid?: boolean
  errorId?: string
}

export default function PlaceInput({
  label,
  value,
  onChange,
  onBlur,
  icon,
  invalid,
  errorId,
}: PlaceInputProps) {
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [picked, setPicked] = useState<string | null>(null)
  const { data, isFetching } = useGeocode(value, value !== picked)
  const suggestions = data ?? []
  const showEmpty = value.trim().length >= 2 && !isFetching && data !== undefined
  const expanded = open && (isFetching || suggestions.length > 0 || showEmpty)

  function choose(suggestion: string) {
    onChange(suggestion)
    setPicked(suggestion)
    setOpen(false)
    setActive(-1)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (suggestions.length === 0) return
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter' && expanded && active >= 0) {
      event.preventDefault()
      choose(suggestions[active])
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="place-input">
      <label className="place-input__field" data-invalid={invalid || undefined}>
        <span className="place-input__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="place-input__body">
          <span className="label">{label}</span>
          <input
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && active >= 0 ? `${id}-opt-${active}` : undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => {
              onChange(event.target.value)
              setOpen(true)
              setActive(-1)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setOpen(false)
              onBlur?.()
            }}
            onKeyDown={handleKeyDown}
          />
        </span>
      </label>
      <ul
        id={listId}
        role="listbox"
        aria-label={`${label} suggestions`}
        className="place-input__list glass"
        hidden={!expanded}
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion}
            id={`${id}-opt-${index}`}
            role="option"
            aria-selected={index === active}
            className="place-input__option"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(suggestion)}
            onMouseMove={() => setActive(index)}
          >
            {suggestion}
          </li>
        ))}
        {isFetching && <li className="place-input__status">Searching...</li>}
        {showEmpty && suggestions.length === 0 && (
          <li className="place-input__status">No matches</li>
        )}
      </ul>
    </div>
  )
}

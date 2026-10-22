import { motion, useReducedMotion } from 'motion/react'
import { useTheme } from '../theme/context'
import './ThemeToggle.css'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const reduceMotion = useReducedMotion()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label="Light theme"
      className="theme-toggle"
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
    >
      <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
      </svg>
      <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </svg>
      <motion.span
        className="theme-toggle-knob"
        animate={{ x: isLight ? 34 : 0 }}
        transition={
          reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }
        }
      />
    </button>
  )
}

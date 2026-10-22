import { motion, useReducedMotion } from 'motion/react'
import type { Plan } from '../types'
import { assignRouteColors } from '../lib/risk'
import { radioKeyHandler } from '../lib/radioGroup'
import RouteCard from './RouteCard'
import './RouteList.css'

export interface RouteListProps {
  plan: Plan
  selectedId: string
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

export default function RouteList({ plan, selectedId, onSelect, onHover }: RouteListProps) {
  const reduced = useReducedMotion() ?? false
  const colors = assignRouteColors(
    plan.routes.map((r) => r.id),
    plan.recommended_route_id,
  )
  const ordered = [
    ...plan.routes.filter((r) => r.id === plan.recommended_route_id),
    ...plan.routes.filter((r) => r.id !== plan.recommended_route_id),
  ]

  const onKeyDown = radioKeyHandler({
    values: ordered.map((r) => r.id),
    current: selectedId,
    onSelect,
  })

  return (
    <div className="route-list" role="radiogroup" aria-label="Route options" onKeyDown={onKeyDown}>
      {ordered.map((route, i) => (
        <motion.div
          key={route.id}
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1], delay: i * 0.07 }}
        >
          <RouteCard
            route={route}
            colorVar={colors[route.id]}
            recommended={route.id === plan.recommended_route_id}
            selected={route.id === selectedId}
            animate={!reduced}
            onSelect={() => onSelect(route.id)}
            onHover={(hovered) => onHover(hovered ? route.id : null)}
          />
        </motion.div>
      ))}
    </div>
  )
}

export function RouteListSkeleton() {
  return (
    <div className="route-list" role="status" aria-busy="true" aria-label="Loading routes">
      {[0, 1, 2].map((i) => (
        <div key={i} className="route-skeleton glass" />
      ))}
    </div>
  )
}

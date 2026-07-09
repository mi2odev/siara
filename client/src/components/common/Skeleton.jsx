import './Skeleton.css'

/**
 * Single shimmer placeholder block. Purely decorative (aria-hidden) — announce
 * loading via the parent list's label instead.
 */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
  return (
    <span
      className="siara-skeleton"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}

/**
 * Content-shaped loading placeholder for a list: a few rows of an optional
 * avatar circle plus two text lines. Reads as "content is loading" far better
 * than a spinner or bare "Loading…" text.
 */
export function SkeletonList({ rows = 5, avatar = true, label }) {
  return (
    <div className="siara-skeleton-list" role="status" aria-busy="true" aria-live="polite">
      {label ? <span className="siara-sr-only">{label}</span> : null}
      {Array.from({ length: rows }).map((_, index) => (
        <div className="siara-skeleton-row" key={index}>
          {avatar ? <Skeleton width={40} height={40} radius="50%" /> : null}
          <div className="siara-skeleton-row__lines">
            <Skeleton width="55%" height={12} />
            <Skeleton width="85%" height={10} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default Skeleton

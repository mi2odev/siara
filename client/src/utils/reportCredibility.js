// Pure credibility calculator. All inputs come from the existing report
// payload (no extra API calls). Returns a 0–100 score, a coarse level label,
// and an ordered list of human-readable reasons.

const SAW_IT_TOO_BONUS = 5
const SAW_IT_TOO_CAP = 4

function safeNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function pickSpamScorePercent(report) {
  // The feed payload exposes spamAnalysis.spamScore as 0..100; older code
  // sometimes leaks 0..1. Normalise both.
  const raw =
    safeNumber(report?.spamAnalysis?.spamScore) ??
    safeNumber(report?.spamScore) ??
    safeNumber(report?.latestSpamScore) ??
    safeNumber(report?.latest_spam_score)
  if (raw == null) return null
  // spamAnalysis.spamScore is already normalised server-side to 0..100. Only
  // clamp — re-scaling here wrongly turned a 0.5% score into 50%.
  return Math.max(0, Math.min(100, raw))
}

function pickPredictedLabel(report) {
  return String(
    report?.spamAnalysis?.predictedLabel ||
      report?.predictedLabel ||
      report?.latestPredictedLabel ||
      report?.latest_predicted_label ||
      '',
  )
    .trim()
    .toLowerCase()
}

function isPoliceVerified(report) {
  if (report?.verifiedByOfficerId) return true
  if (report?.verifiedAt) return true
  const verdict = String(
    report?.reviewVerdict || report?.review_verdict || '',
  ).toLowerCase()
  return verdict === 'verified' || verdict === 'confirmed'
}

function hasMedia(report) {
  if (Array.isArray(report?.media) && report.media.length > 0) return true
  if (Array.isArray(report?.images) && report.images.length > 0) return true
  return false
}

function reporterTrustScore(report) {
  // The feed payload exposes the reporter's trust score at reportedBy.trustScore
  // (see reports.js mapReportRow). The older paths below never matched, so the
  // ±10 trust adjustment silently never applied.
  return (
    safeNumber(report?.reportedBy?.trustScore) ??
    safeNumber(report?.reportedBy?.trust_score) ??
    safeNumber(report?.reporterTrustScore) ??
    safeNumber(report?.reporter?.trustScore) ??
    safeNumber(report?.reporter_trust_score)
  )
}

function sawItTooCount(report) {
  return (
    safeNumber(report?.sawItTooCount) ??
    safeNumber(report?.saw_it_too_count) ??
    0
  )
}

function hasValidLocation(report) {
  // Coordinates live under report.location.{lat,lng} in the feed payload
  // (reports.js). Reading top-level lat/lng made EVERY report look location-
  // invalid, so the score was always penalised and the "Location appears
  // invalid" reason showed on every card.
  const lat = safeNumber(report?.location?.lat ?? report?.lat ?? report?.latitude)
  const lng = safeNumber(report?.location?.lng ?? report?.lng ?? report?.longitude)
  if (lat == null || lng == null) return false
  if (lat === 0 && lng === 0) return false
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  return true
}

function levelFromScore(score) {
  if (!Number.isFinite(score)) return 'unknown'
  if (score >= 75) return 'high'
  if (score >= 45) return 'medium'
  return 'low'
}

export function computeReportCredibility(report) {
  if (!report || typeof report !== 'object') {
    return {
      score: null,
      level: 'unknown',
      isSpam: false,
      reasons: [],
    }
  }

  let score = 50
  const reasons = []

  if (isPoliceVerified(report)) {
    score += 25
    reasons.push({ kind: 'positive', text: 'Verified by a police officer' })
  }

  const trust = reporterTrustScore(report)
  if (trust != null) {
    if (trust >= 75) {
      score += 10
      reasons.push({ kind: 'positive', text: 'Reporter has a high trust score' })
    } else if (trust <= 25) {
      score -= 10
      reasons.push({ kind: 'negative', text: 'Reporter has a low trust score' })
    }
  }

  if (hasMedia(report)) {
    score += 8
    reasons.push({ kind: 'positive', text: 'Includes a photo or media attachment' })
  }

  if (hasValidLocation(report)) {
    score += 7
    reasons.push({ kind: 'positive', text: 'Reported on a valid road location' })
  } else {
    score -= 18
    reasons.push({ kind: 'negative', text: 'Location appears invalid' })
  }

  const sawCount = sawItTooCount(report)
  if (sawCount > 0) {
    const bonus = Math.min(SAW_IT_TOO_BONUS * sawCount, SAW_IT_TOO_BONUS * SAW_IT_TOO_CAP)
    score += bonus
    reasons.push({
      kind: 'positive',
      text: `${sawCount} other ${sawCount === 1 ? 'driver' : 'drivers'} confirmed it`,
    })
  }

  const label = pickPredictedLabel(report)
  const spamPercent = pickSpamScorePercent(report)
  let isSpam = false

  if (label === 'spam' || (spamPercent != null && spamPercent >= 65)) {
    score -= 32
    isSpam = true
    reasons.push({ kind: 'negative', text: 'AI detector flagged this as likely spam' })
  } else if (label === 'suspicious' || (spamPercent != null && spamPercent >= 45)) {
    score -= 14
    reasons.push({ kind: 'negative', text: 'AI detector flagged it as suspicious' })
  } else if (label === 'real' && spamPercent != null && spamPercent < 25) {
    score += 10
    reasons.push({ kind: 'positive', text: 'AI detector classified content as legitimate' })
  }

  if (label === 'out_of_context') {
    score -= 22
    reasons.push({ kind: 'negative', text: 'Content does not match a road incident' })
  }

  // Bound and round
  const bounded = Math.max(0, Math.min(100, Math.round(score)))
  const level = levelFromScore(bounded)

  // Sort: positives first, then negatives, but cap to 6 items for badges
  const ordered = [...reasons].sort((a, b) => {
    if (a.kind === b.kind) return 0
    return a.kind === 'positive' ? -1 : 1
  })

  return {
    score: bounded,
    level,
    isSpam,
    reasons: ordered.slice(0, 6),
  }
}

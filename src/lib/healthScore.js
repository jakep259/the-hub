import { differenceInDays, parseISO, isToday, format } from 'date-fns'

/**
 * Calculate health score for a bookie based on its activity log.
 * @param {Object} bookie - bookie record
 * @param {Array}  bets   - array of bet records for this bookie
 * @param {Array}  offers - array of offer records for this bookie
 * @returns {number} score 0-100
 */
export function calculateHealthScore(bookie, bets = [], offers = []) {
  let score = 100

  const now = new Date()

  // ── Days since last mug bet ──────────────────────────────────────────────
  const mugBets = bets.filter(b => b.bet_type === 'mug')
  const lastMugDate = mugBets.length
    ? new Date(Math.max(...mugBets.map(b => new Date(b.placed_at))))
    : null

  if (lastMugDate) {
    const daysSince = differenceInDays(now, lastMugDate)
    if (daysSince > 7) {
      score -= (daysSince - 7) * 2
    }
  } else {
    // Never placed a mug bet — penalise as if 14 days overdue
    score -= 14
  }

  // ── Offer uptake ratio ───────────────────────────────────────────────────
  const takenOffers = offers.filter(o => o.status === 'Completed' || o.status === 'Taken')
  const allOffers = offers.length
  if (allOffers > 0) {
    const ratio = takenOffers.length / allOffers
    if (ratio > 0.8) score -= 10
  }

  // ── Same-day withdrawal after offer ─────────────────────────────────────
  // Represented by a flag on the bookie record
  if (bookie.same_day_withdrawal) score -= 8

  // ── Stakes only on offer days ────────────────────────────────────────────
  if (bookie.stake_only_on_offer_days) score -= 5

  // ── Positive: mug bets placed ────────────────────────────────────────────
  const recentMugBets = mugBets.filter(b => {
    const d = differenceInDays(now, new Date(b.placed_at))
    return d <= 30
  })
  score += recentMugBets.length * 8

  // ── Positive: recreational bets ─────────────────────────────────────────
  const recBets = bets.filter(b => b.bet_type === 'recreational')
  const recentRec = recBets.filter(b => {
    const d = differenceInDays(now, new Date(b.placed_at))
    return d <= 30
  })
  score += recentRec.length * 3

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function healthColor(score) {
  if (score >= 75) return 'green'
  if (score >= 50) return 'amber'
  return 'red'
}

export function healthLabel(score) {
  if (score >= 75) return 'Healthy'
  if (score >= 50) return 'Caution'
  return 'At Risk'
}

export function healthBadgeClass(score) {
  if (score >= 75) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (score >= 50) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}

export function offerSafetyRating(bookie, bets, offers) {
  const score = calculateHealthScore(bookie, bets, offers)
  if (score >= 70) return { rating: 'Safe', color: 'emerald' }
  if (score >= 50) return { rating: 'Caution', color: 'amber' }
  return { rating: 'Skip', color: 'red' }
}

export function getMugBetRecommendation(bookie, bets, offers) {
  const score = calculateHealthScore(bookie, bets, offers)
  const mugBets = bets.filter(b => b.bet_type === 'mug')
  const lastMugDate = mugBets.length
    ? new Date(Math.max(...mugBets.map(b => new Date(b.placed_at))))
    : null
  const daysSince = lastMugDate ? differenceInDays(new Date(), lastMugDate) : 999

  let urgency = 'normal'
  if (daysSince >= 14 || score < 50) urgency = 'urgent'
  else if (daysSince >= 7 || score < 70) urgency = 'soon'

  const offerBets = offers.filter(o => o.status === 'Completed')
  const avgStake = offerBets.length
    ? offerBets.reduce((s, o) => s + (o.stake || 10), 0) / offerBets.length
    : 20

  const minStake = Math.round(avgStake * 0.05 * 2) / 2
  const maxStake = Math.round(avgStake * 0.10 * 2) / 2

  return {
    urgency,
    stakeRange: `£${minStake}–£${maxStake}`,
    sport: Math.random() > 0.5 ? 'Football' : 'Horse Racing',
    oddsRange: 'Evens – 2/1',
    withdrawalTip: 'Wait 2–3 days after offer settlement before withdrawing',
  }
}

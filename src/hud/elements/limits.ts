/**
 * OMC HUD - Rate Limits Element
 *
 * Renders 5-hour and weekly rate limit usage display.
 */

import type { RateLimits } from '../types.js';
import { RESET } from '../colors.js';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';

// Thresholds for rate limit warnings
const WARNING_THRESHOLD = 70;
const CRITICAL_THRESHOLD = 90;

/**
 * Get color based on percentage
 */
function getColor(percent: number): string {
  if (percent >= CRITICAL_THRESHOLD) {
    return RED;
  } else if (percent >= WARNING_THRESHOLD) {
    return YELLOW;
  }
  return GREEN;
}

/**
 * Format reset time as human-readable duration.
 * Returns null if date is null/undefined or in the past.
 */
function formatResetTime(date: Date | null | undefined): string | null {
  if (!date) return null;

  const now = Date.now();
  const resetMs = date.getTime();
  const diffMs = resetMs - now;

  // Already reset or invalid
  if (diffMs <= 0) return null;

  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return `${diffDays}d${remainingHours}h`;
  }

  const remainingMinutes = diffMinutes % 60;
  return `${diffHours}h${remainingMinutes}m`;
}

/**
 * Render rate limits display.
 *
 * Format: 5h:45%(3h42m) wk:12%/S:45%(2d5h)
 * Where S:45% is Sonnet-specific weekly usage
 */
export function renderRateLimits(limits: RateLimits | null): string | null {
  if (!limits) return null;

  const fiveHour = Math.min(100, Math.max(0, Math.round(limits.fiveHourPercent)));
  const weekly = Math.min(100, Math.max(0, Math.round(limits.weeklyPercent)));
  const sonnetWeekly = limits.sonnetWeeklyPercent != null
    ? Math.min(100, Math.max(0, Math.round(limits.sonnetWeeklyPercent)))
    : null;

  const fiveHourColor = getColor(fiveHour);
  const weeklyColor = getColor(weekly);
  const sonnetColor = sonnetWeekly != null ? getColor(sonnetWeekly) : GREEN;

  // Format reset times
  const fiveHourReset = formatResetTime(limits.fiveHourResetsAt);
  const weeklyReset = formatResetTime(limits.weeklyResetsAt);

  // Build parts with optional reset times
  const fiveHourPart = fiveHourReset
    ? `5h:${fiveHourColor}${fiveHour}%${RESET}${DIM}(${fiveHourReset})${RESET}`
    : `5h:${fiveHourColor}${fiveHour}%${RESET}`;

  // Weekly part with Sonnet quota (compact inline format)
  let weeklyPart: string;
  if (sonnetWeekly != null) {
    const weeklyDisplay = `${DIM}wk:${RESET}${weeklyColor}${weekly}%${RESET}`;
    const sonnetDisplay = `${DIM}S:${RESET}${sonnetColor}${sonnetWeekly}%${RESET}`;
    const resetDisplay = weeklyReset ? `${DIM}(${weeklyReset})${RESET}` : '';
    weeklyPart = `${weeklyDisplay}/${sonnetDisplay}${resetDisplay}`;
  } else {
    weeklyPart = weeklyReset
      ? `${DIM}wk:${RESET}${weeklyColor}${weekly}%${RESET}${DIM}(${weeklyReset})${RESET}`
      : `${DIM}wk:${RESET}${weeklyColor}${weekly}%${RESET}`;
  }

  return `${fiveHourPart} ${weeklyPart}`;
}

/**
 * Render compact rate limits (just percentages).
 *
 * Format: 45%/12%/S:45%
 * Where S:45% is Sonnet-specific weekly usage
 */
export function renderRateLimitsCompact(limits: RateLimits | null): string | null {
  if (!limits) return null;

  const fiveHour = Math.min(100, Math.max(0, Math.round(limits.fiveHourPercent)));
  const weekly = Math.min(100, Math.max(0, Math.round(limits.weeklyPercent)));
  const sonnetWeekly = limits.sonnetWeeklyPercent != null
    ? Math.min(100, Math.max(0, Math.round(limits.sonnetWeeklyPercent)))
    : null;

  const fiveHourColor = getColor(fiveHour);
  const weeklyColor = getColor(weekly);
  const sonnetColor = sonnetWeekly != null ? getColor(sonnetWeekly) : GREEN;

  if (sonnetWeekly != null) {
    return `${fiveHourColor}${fiveHour}%${RESET}/${weeklyColor}${weekly}%${RESET}/${DIM}S:${RESET}${sonnetColor}${sonnetWeekly}%${RESET}`;
  }

  return `${fiveHourColor}${fiveHour}%${RESET}/${weeklyColor}${weekly}%${RESET}`;
}

/**
 * Render rate limits with visual progress bars.
 *
 * Format: 5h:[████░░░░]45%(3h42m) wk:[█░░░░░░░]12% S:[███░░░░]45%(2d5h)
 * Where S:[███░░░░]45% is Sonnet-specific weekly usage bar
 */
export function renderRateLimitsWithBar(
  limits: RateLimits | null,
  barWidth: number = 8
): string | null {
  if (!limits) return null;

  const fiveHour = Math.min(100, Math.max(0, Math.round(limits.fiveHourPercent)));
  const weekly = Math.min(100, Math.max(0, Math.round(limits.weeklyPercent)));
  const sonnetWeekly = limits.sonnetWeeklyPercent != null
    ? Math.min(100, Math.max(0, Math.round(limits.sonnetWeeklyPercent)))
    : null;

  const fiveHourColor = getColor(fiveHour);
  const weeklyColor = getColor(weekly);
  const sonnetColor = sonnetWeekly != null ? getColor(sonnetWeekly) : GREEN;

  // Build bars
  const fiveHourFilled = Math.round((fiveHour / 100) * barWidth);
  const fiveHourEmpty = barWidth - fiveHourFilled;
  const fiveHourBar = `${fiveHourColor}${'█'.repeat(fiveHourFilled)}${DIM}${'░'.repeat(fiveHourEmpty)}${RESET}`;

  const weeklyFilled = Math.round((weekly / 100) * barWidth);
  const weeklyEmpty = barWidth - weeklyFilled;
  const weeklyBar = `${weeklyColor}${'█'.repeat(weeklyFilled)}${DIM}${'░'.repeat(weeklyEmpty)}${RESET}`;

  // Format reset times
  const fiveHourReset = formatResetTime(limits.fiveHourResetsAt);
  const weeklyReset = formatResetTime(limits.weeklyResetsAt);

  // Build parts with bars
  const fiveHourPart = fiveHourReset
    ? `5h:[${fiveHourBar}]${fiveHourColor}${fiveHour}%${RESET}${DIM}(${fiveHourReset})${RESET}`
    : `5h:[${fiveHourBar}]${fiveHourColor}${fiveHour}%${RESET}`;

  let weeklyPart: string;
  if (sonnetWeekly != null) {
    // Build Sonnet bar
    const sonnetFilled = Math.round((sonnetWeekly / 100) * barWidth);
    const sonnetEmpty = barWidth - sonnetFilled;
    const sonnetBar = `${sonnetColor}${'█'.repeat(sonnetFilled)}${DIM}${'░'.repeat(sonnetEmpty)}${RESET}`;

    const weeklyDisplay = `${DIM}wk:${RESET}[${weeklyBar}]${weeklyColor}${weekly}%${RESET}`;
    const sonnetDisplay = `${DIM}S:${RESET}[${sonnetBar}]${sonnetColor}${sonnetWeekly}%${RESET}`;
    const resetDisplay = weeklyReset ? `${DIM}(${weeklyReset})${RESET}` : '';
    weeklyPart = `${weeklyDisplay} ${sonnetDisplay}${resetDisplay}`;
  } else {
    weeklyPart = weeklyReset
      ? `${DIM}wk:${RESET}[${weeklyBar}]${weeklyColor}${weekly}%${RESET}${DIM}(${weeklyReset})${RESET}`
      : `${DIM}wk:${RESET}[${weeklyBar}]${weeklyColor}${weekly}%${RESET}`;
  }

  return `${fiveHourPart} ${weeklyPart}`;
}

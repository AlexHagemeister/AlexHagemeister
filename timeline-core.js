/**
 * Core timeline utilities used across Kairoscope.
 * Each function is intentionally pure so that the targeted regression tests in
 * `tests/timeline-core.test.js` can exercise them without requiring a DOM.
 */
export const MONTH_MS = 2_629_800_000; // average month (30.44 days)
export const YEAR_MS = 31_557_600_000; // average year (365.25 days)

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Converts the logarithmic slider position into milliseconds-per-pixel.
 * Tested in `timeline-core.test.js` to guarantee that integer slider steps map
 * exactly to base-10 scales (e.g. -3 => 1µs) without accumulating rounding
 * errors.
 */
export function msPerPixelFromSlider(value) {
  return Math.pow(10, value);
}

/**
 * Bounding helper for UI interactions.
 * Explicitly covered by `clamps values within bounds` in the test suite so
 * future changes to input validation remain deliberate.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Chooses major/minor tick spacing for the current zoom level.
 * The test suite verifies that the resulting spacing stays close to the
 * desired 120px cadence and that the returned subdivision count matches the
 * chosen base (2, 5, or 10).
 */
export function chooseTickInterval(msPerPixel) {
  const desiredPixelSpacing = 120;
  const desiredMs = msPerPixel * desiredPixelSpacing;
  const exponent = Math.floor(Math.log10(desiredMs));
  const baseCandidates = [1, 2, 5];
  let best = baseCandidates[0] * Math.pow(10, exponent);
  let bestBase = baseCandidates[0];
  let bestScore = Infinity;

  for (const base of baseCandidates) {
    const candidate = base * Math.pow(10, exponent);
    const pixels = candidate / msPerPixel;
    const score = Math.abs(pixels - desiredPixelSpacing);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
      bestBase = base;
    }
  }

  const subdivisions = bestBase === 5 ? 5 : bestBase === 2 ? 4 : 5;
  const minor = best / subdivisions;
  return { major: best, minor, subdivisions };
}

/**
 * Pulls common date parts, honoring UTC when requested.
 * Tests pin the output using fixed timestamps to demonstrate the UTC/local
 * distinction without depending on the runtime's locale formatting.
 */
export function getDateParts(date, useUTC) {
  if (useUTC) {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      millisecond: date.getUTCMilliseconds(),
      weekday: date.getUTCDay(),
    };
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    millisecond: date.getMilliseconds(),
    weekday: date.getDay(),
  };
}

/**
 * Pads numbers so that temporal labels remain aligned.
 * The dedicated padding test ensures we do not regress to locale-dependent
 * formatting or trimming that could break label comparisons.
 */
export function pad(number, length = 2) {
  return number.toString().padStart(length, "0");
}

/**
 * Formats major tick labels for the current scale.
 * Tests cover millisecond, second, day, and year spans to ensure the adaptive
 * copy remains legible across zoom levels and respects UTC toggling.
 */
export function formatTickLabel(date, intervalMs, useUTC) {
  const parts = getDateParts(date, useUTC);
  const { hour, minute, second, millisecond } = parts;
  if (intervalMs < 1) {
    return `${pad(hour)}:${pad(minute)}:${pad(second)}.${pad(millisecond, 3)}`;
  }
  if (intervalMs < 1_000) {
    return `${pad(hour)}:${pad(minute)}:${pad(second)}.${pad(millisecond, 3)}`;
  }
  if (intervalMs < 60_000) {
    return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
  }
  if (intervalMs < 3_600_000) {
    return `${pad(hour)}:${pad(minute)}`;
  }
  if (intervalMs < 86_400_000) {
    return `${WEEKDAYS[parts.weekday].slice(0, 3)} ${pad(hour)}:${pad(minute)}`;
  }
  if (intervalMs < 604_800_000) {
    return `${WEEKDAYS[parts.weekday]} ${pad(hour)}:${pad(minute)}`;
  }
  if (intervalMs < MONTH_MS) {
    return `${MONTHS[parts.month]} ${parts.day}`;
  }
  if (intervalMs < YEAR_MS) {
    return `${MONTHS[parts.month]} ${parts.day}, ${parts.year}`;
  }
  return `${parts.year}`;
}

/**
 * Describes a duration in friendly prose.
 * The test suite asserts that compound units render correctly (e.g. weeks plus
 * days) and that sub-millisecond durations round as expected.
 */
export function formatDuration(ms) {
  const absMs = Math.abs(ms);
  if (absMs < 1) {
    return `${absMs.toFixed(3)} ms`;
  }
  const units = [
    { label: "year", ms: YEAR_MS },
    { label: "month", ms: MONTH_MS },
    { label: "week", ms: 604_800_000 },
    { label: "day", ms: 86_400_000 },
    { label: "hour", ms: 3_600_000 },
    { label: "minute", ms: 60_000 },
    { label: "second", ms: 1_000 },
    { label: "millisecond", ms: 1 },
  ];

  const parts = [];
  let remaining = absMs;
  for (const unit of units) {
    if (remaining >= unit.ms || unit.ms === 1) {
      const count = unit.ms === 1 ? Math.round(remaining) : Math.floor(remaining / unit.ms);
      if (count > 0) {
        parts.push(`${count} ${unit.label}${count !== 1 ? "s" : ""}`);
        remaining -= count * unit.ms;
      }
    }
    if (parts.length === 2) break;
  }
  return parts.join(" ") || `${absMs.toFixed(0)} ms`;
}

/**
 * Expresses how far the viewport has drifted from the present moment.
 * Tests assert that offsets below two pixels worth of time resolve to
 * "Present" while larger excursions describe the signed duration.
 */
export function describeOffset(offsetMs, renderMsPerPixel) {
  if (Math.abs(offsetMs) < renderMsPerPixel * 2) {
    return "Present";
  }
  const sign = offsetMs > 0 ? "+" : "-";
  return `Exploring ${sign}${formatDuration(offsetMs)}`;
}

/**
 * Produces the headline timestamp shown for the focus point.
 * The regression tests ensure the output preserves weekday/month names and a
 * millisecond-resolved clock for both UTC and local time flows.
 */
export function formatCenterTimestamp(date, useUTC) {
  const parts = getDateParts(date, useUTC);
  const weekday = WEEKDAYS[parts.weekday];
  const month = MONTHS[parts.month];
  const time = `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}.${pad(
    parts.millisecond,
    3
  )}`;
  return `${weekday} • ${month} ${parts.day}, ${parts.year} • ${time}`;
}

/**
 * Resolves the label for the timezone toggle.
 * Tests double-check the UTC branch and that the local branch includes the
 * platform-specific abbreviation so users know the reference frame.
 */
export function getTimezoneLabel(useUTC) {
  if (useUTC) {
    return "UTC";
  }
  const formatter = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" });
  const parts = formatter.formatToParts(new Date());
  const tz = parts.find((part) => part.type === "timeZoneName");
  return tz ? `Local (${tz.value})` : "Local";
}

/**
 * Targeted regression tests for Kairoscope's core timeline helpers.
 *
 * These scenarios intentionally avoid the DOM so contributors can iterate on
 * mathematical or formatting logic quickly. When adding new helpers, mirror the
 * structure below: document the intention with a short comment, codify the
 * expected behaviour, and point future maintainers to `npm test` (also captured
 * in the project README).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  msPerPixelFromSlider,
  clamp,
  chooseTickInterval,
  formatTickLabel,
  formatDuration,
  describeOffset,
  formatCenterTimestamp,
  getTimezoneLabel,
  getDateParts,
  pad,
  MONTH_MS,
} from '../timeline-core.js';

// Slider mapping -----------------------------------------------------------------
// Ensures the logarithmic slider remains stable across edge zoom levels.
test('msPerPixelFromSlider preserves base-10 scaling', () => {
  assert.equal(msPerPixelFromSlider(0), 1);
  assert.equal(msPerPixelFromSlider(1), 10);
  assert.equal(msPerPixelFromSlider(-2), 0.01);
});

// Clamp ---------------------------------------------------------------------------
// Guards changes that might accidentally allow the slider to slip outside bounds.
test('clamp bounds values within the provided range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(22, 0, 10), 10);
});

// Tick intervals -----------------------------------------------------------------
// Keeps major gridlines roughly 120px apart and validates the subdivision logic.
test('chooseTickInterval tracks the desired 120px rhythm', () => {
  const msPerPixel = 1000; // Roughly seconds-per-pixel zoom
  const { major, minor, subdivisions } = chooseTickInterval(msPerPixel);
  const pixelSpacing = major / msPerPixel;
  assert.ok(Math.abs(pixelSpacing - 120) <= 20, 'major ticks should stay near 120px apart');
  assert.ok(Math.abs(minor * subdivisions - major) < 1e-6, 'minor ticks should compose the major interval');
  assert.ok([4, 5].includes(subdivisions), 'subdivision choices should remain predictable');
});

// Date helpers -------------------------------------------------------------------
// Demonstrates the UTC/local divergence without relying on locale formatting.
test('getDateParts respects the UTC toggle', () => {
  const sample = new Date(Date.UTC(2024, 0, 1, 12, 34, 56, 789));
  const local = getDateParts(sample, false);
  const utc = getDateParts(sample, true);
  assert.equal(utc.hour, 12);
  assert.equal(utc.minute, 34);
  assert.equal(utc.second, 56);
  assert.equal(utc.millisecond, 789);
  // Local time may differ depending on the runtime timezone, but the padded
  // clock remains consistent via the shared pad() helper.
  assert.equal(pad(local.millisecond, 3).length, 3);
});

// Tick labels --------------------------------------------------------------------
// Verifies scale-aware labels from milliseconds up to months.
test('formatTickLabel adapts copy to the current scale', () => {
  const sample = new Date(Date.UTC(2024, 0, 1, 12, 34, 56, 789));
  assert.equal(formatTickLabel(sample, 0.5, true), '12:34:56.789');
  assert.equal(formatTickLabel(sample, 30_000, true), '12:34:56');
  assert.equal(formatTickLabel(sample, 3_600_000, true), 'Mon 12:34');
  assert.equal(formatTickLabel(sample, 700_000_000, true), 'January 1');
  assert.equal(formatTickLabel(sample, MONTH_MS * 2, true), 'January 1, 2024');
  assert.equal(formatTickLabel(sample, 40_000_000_000, true), '2024');
});

// Duration formatting ------------------------------------------------------------
// Captures both fractional milliseconds and compound larger durations.
test('formatDuration builds friendly descriptions', () => {
  assert.equal(formatDuration(0.4), '0.400 ms');
  assert.equal(formatDuration(2_000), '2 seconds');
  assert.equal(formatDuration(604_800_000 + 86_400_000), '1 week 1 day');
  assert.equal(formatDuration(-90_000), '1 minute 30 seconds');
});

// Offset description -------------------------------------------------------------
// Ensures the focus banner snaps back to "Present" when near the origin.
test('describeOffset distinguishes present from explorations', () => {
  assert.equal(describeOffset(10, 10), 'Present');
  assert.equal(describeOffset(50, 10), 'Exploring +50 milliseconds');
  assert.equal(describeOffset(-3_600_000, 1_000), 'Exploring -1 hour');
});

// Center timestamp ---------------------------------------------------------------
// Validates the headline string that anchors the status panel.
test('formatCenterTimestamp assembles a precise headline', () => {
  const sample = new Date(Date.UTC(2024, 0, 1, 12, 34, 56, 789));
  assert.equal(
    formatCenterTimestamp(sample, true),
    'Monday • January 1, 2024 • 12:34:56.789'
  );
});

// Timezone label -----------------------------------------------------------------
// Guards the copy shown on the timezone toggle so users know the active frame.
test('getTimezoneLabel reflects UTC/local state', () => {
  assert.equal(getTimezoneLabel(true), 'UTC');
  const localLabel = getTimezoneLabel(false);
  assert.ok(localLabel.startsWith('Local'), 'local timezone label should clearly start with "Local"');
});

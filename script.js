import {
  msPerPixelFromSlider,
  clamp,
  chooseTickInterval,
  formatTickLabel,
  formatDuration,
  describeOffset,
  formatCenterTimestamp,
  getTimezoneLabel,
} from "./timeline-core.js";

// The DOM-facing controller wires together the pure utilities above. The unit
// tests in `tests/timeline-core.test.js` describe how to exercise each helper
// before touching this event-heavy layer.
const canvas = document.getElementById("timeline");
const ctx = canvas.getContext("2d");
const zoomSlider = document.getElementById("zoomSlider");
const resetButton = document.getElementById("resetButton");
const timezoneToggle = document.getElementById("timezoneToggle");
const scaleValueEl = document.getElementById("scaleValue");
const focusValueEl = document.getElementById("focusValue");
const timezoneValueEl = document.getElementById("timezoneValue");

const state = {
  sliderValue: parseFloat(zoomSlider.value),
  targetMsPerPixel: msPerPixelFromSlider(parseFloat(zoomSlider.value)),
  renderMsPerPixel: msPerPixelFromSlider(parseFloat(zoomSlider.value)),
  targetOffset: 0,
  renderOffset: 0,
  useUTC: false,
  exploring: false,
  lastInteraction: performance.now(),
  activePointers: new Map(),
  isDragging: false,
  lastDragX: 0,
  pinchStartDistance: 0,
  pinchStartSliderValue: parseFloat(zoomSlider.value),
  lastTapTime: 0,
  dpr: window.devicePixelRatio || 1,
  fontFamily: getComputedStyle(document.body).fontFamily,
};

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * state.dpr);
  canvas.height = Math.round(rect.height * state.dpr);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function updateControls() {
  timezoneToggle.setAttribute("aria-pressed", state.useUTC ? "true" : "false");
  timezoneToggle.textContent = state.useUTC
    ? "Use Local Time"
    : "Use Coordinated Universal Time";
  timezoneValueEl.textContent = getTimezoneLabel(state.useUTC);
}

updateControls();

function scheduleInteractionUpdate() {
  state.lastInteraction = performance.now();
}

zoomSlider.addEventListener("input", (event) => {
  const value = parseFloat(event.target.value);
  state.sliderValue = value;
  state.targetMsPerPixel = msPerPixelFromSlider(value);
  scheduleInteractionUpdate();
});

resetButton.addEventListener("click", () => {
  state.targetOffset = 0;
  state.exploring = false;
  scheduleInteractionUpdate();
});

timezoneToggle.addEventListener("click", () => {
  state.useUTC = !state.useUTC;
  updateControls();
  scheduleInteractionUpdate();
});

canvas.addEventListener("dblclick", () => {
  state.targetOffset = 0;
  state.exploring = false;
  scheduleInteractionUpdate();
});

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  state.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  scheduleInteractionUpdate();

  const now = performance.now();
  if (now - state.lastTapTime < 350) {
    state.targetOffset = 0;
    state.exploring = false;
  }
  state.lastTapTime = now;

  if (state.activePointers.size === 1) {
    state.isDragging = true;
    state.lastDragX = event.clientX;
  } else if (state.activePointers.size === 2) {
    const points = Array.from(state.activePointers.values());
    state.pinchStartDistance = distance(points[0], points[1]);
    state.pinchStartSliderValue = state.sliderValue;
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.activePointers.has(event.pointerId)) return;
  state.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (state.activePointers.size === 1 && state.isDragging) {
    const deltaX = event.clientX - state.lastDragX;
    state.lastDragX = event.clientX;
    state.targetOffset -= deltaX * state.renderMsPerPixel;
    state.exploring = Math.abs(state.targetOffset) > state.renderMsPerPixel * 4;
  } else if (state.activePointers.size === 2) {
    const points = Array.from(state.activePointers.values());
    const newDistance = distance(points[0], points[1]);
    if (state.pinchStartDistance > 0 && newDistance > 0) {
      const ratio = newDistance / state.pinchStartDistance;
      if (!Number.isFinite(ratio) || ratio <= 0) {
        return;
      }
      const newSliderValue = clamp(
        state.pinchStartSliderValue - Math.log10(ratio),
        parseFloat(zoomSlider.min),
        parseFloat(zoomSlider.max)
      );
      state.sliderValue = newSliderValue;
      zoomSlider.value = newSliderValue.toFixed(2);
      state.targetMsPerPixel = msPerPixelFromSlider(newSliderValue);
    }
  }
  scheduleInteractionUpdate();
});

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function endPointer(event) {
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  if (state.activePointers.has(event.pointerId)) {
    state.activePointers.delete(event.pointerId);
  }
  if (state.activePointers.size < 2) {
    state.pinchStartDistance = 0;
  }
  if (state.activePointers.size === 0) {
    state.isDragging = false;
  } else if (state.activePointers.size === 1) {
    const remaining = Array.from(state.activePointers.values())[0];
    state.isDragging = true;
    state.lastDragX = remaining.x;
  }
}

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerout", endPointer);

function handleWheel(event) {
  event.preventDefault();
  const delta = event.deltaY > 0 ? 0.1 : -0.1;
  const newSliderValue = clamp(
    state.sliderValue + delta,
    parseFloat(zoomSlider.min),
    parseFloat(zoomSlider.max)
  );
  state.sliderValue = newSliderValue;
  zoomSlider.value = newSliderValue.toFixed(2);
  state.targetMsPerPixel = msPerPixelFromSlider(newSliderValue);
  scheduleInteractionUpdate();
}

canvas.addEventListener("wheel", handleWheel, { passive: false });

function handleKeydown(event) {
  switch (event.key) {
    case "ArrowLeft":
      state.targetOffset -= state.renderMsPerPixel * 90;
      state.exploring = Math.abs(state.targetOffset) > state.renderMsPerPixel * 4;
      scheduleInteractionUpdate();
      event.preventDefault();
      break;
    case "ArrowRight":
      state.targetOffset += state.renderMsPerPixel * 90;
      state.exploring = Math.abs(state.targetOffset) > state.renderMsPerPixel * 4;
      scheduleInteractionUpdate();
      event.preventDefault();
      break;
    case "ArrowUp":
      adjustSlider(-0.2);
      scheduleInteractionUpdate();
      event.preventDefault();
      break;
    case "ArrowDown":
      adjustSlider(0.2);
      scheduleInteractionUpdate();
      event.preventDefault();
      break;
    case "0":
    case "Escape":
      state.targetOffset = 0;
      state.exploring = false;
      scheduleInteractionUpdate();
      break;
    default:
      break;
  }
}

document.addEventListener("keydown", handleKeydown);

function adjustSlider(delta) {
  const newSliderValue = clamp(
    state.sliderValue + delta,
    parseFloat(zoomSlider.min),
    parseFloat(zoomSlider.max)
  );
  state.sliderValue = newSliderValue;
  zoomSlider.value = newSliderValue.toFixed(2);
  state.targetMsPerPixel = msPerPixelFromSlider(newSliderValue);
}

function updateInfoPanels(viewWidth) {
  const spanMs = state.renderMsPerPixel * viewWidth;
  scaleValueEl.textContent = `${formatDuration(spanMs)} across the viewport`;

  const centerTime = new Date(Date.now() + state.renderOffset);
  const focusDescriptor = describeOffset(state.renderOffset, state.renderMsPerPixel);
  focusValueEl.textContent = `${focusDescriptor} • ${formatCenterTimestamp(
    centerTime,
    state.useUTC
  )}`;

  timezoneValueEl.textContent = getTimezoneLabel(state.useUTC);
}

function render() {
  const { width, height } = canvas;
  ctx.save();
  ctx.scale(state.dpr, state.dpr);
  const viewWidth = width / state.dpr;
  const viewHeight = height / state.dpr;

  ctx.clearRect(0, 0, viewWidth, viewHeight);
  const gradient = ctx.createLinearGradient(0, 0, 0, viewHeight);
  gradient.addColorStop(0, "rgba(255, 215, 0, 0.05)");
  gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.8)");
  gradient.addColorStop(1, "rgba(255, 215, 0, 0.08)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const smoothing = 0.15;
  state.renderMsPerPixel += (state.targetMsPerPixel - state.renderMsPerPixel) * smoothing;
  state.renderOffset += (state.targetOffset - state.renderOffset) * smoothing;
  if (Math.abs(state.targetOffset) < state.renderMsPerPixel * 1.2) {
    state.targetOffset = 0;
    state.exploring = false;
  }

  const centerTime = Date.now() + state.renderOffset;
  const tickIntervals = chooseTickInterval(state.renderMsPerPixel);
  const { major, minor } = tickIntervals;

  const startTime = centerTime - viewWidth / 2 * state.renderMsPerPixel - major * 2;
  const endTime = centerTime + viewWidth / 2 * state.renderMsPerPixel + major * 2;
  const totalRange = endTime - startTime;
  const maxTicks = 5000;
  const estimatedTicks = totalRange / minor;
  const tickCount = Math.min(Math.ceil(estimatedTicks) + 2, maxTicks);
  const firstTickIndex = Math.floor(startTime / minor);

  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255, 215, 0, 0.45)";

  ctx.beginPath();
  ctx.moveTo(0, viewHeight / 2);
  ctx.lineTo(viewWidth, viewHeight / 2);
  ctx.strokeStyle = "rgba(255, 215, 0, 0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `500 ${Math.max(12, viewHeight * 0.05)}px ${state.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  let lastLabelRight = -Infinity;

  for (let i = 0; i <= tickCount; i += 1) {
    const tickTime = (firstTickIndex + i) * minor;
    if (tickTime < startTime - minor || tickTime > endTime + minor) continue;
    const x = (tickTime - centerTime) / state.renderMsPerPixel + viewWidth / 2;
    if (x < -50 || x > viewWidth + 50) continue;

    const majorIndex = Math.round(tickTime / major);
    const isMajor = Math.abs(tickTime - majorIndex * major) < minor / 2;

    const tickHeight = isMajor ? viewHeight * 0.42 : viewHeight * 0.22;
    ctx.beginPath();
    ctx.moveTo(x, (viewHeight - tickHeight) / 2);
    ctx.lineTo(x, (viewHeight + tickHeight) / 2);
    ctx.strokeStyle = isMajor ? "rgba(255, 215, 0, 0.85)" : "rgba(255, 215, 0, 0.35)";
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.stroke();

    if (isMajor) {
      const label = formatTickLabel(new Date(tickTime), major, state.useUTC);
      const textWidth = ctx.measureText(label).width;
      if (x - textWidth / 2 > lastLabelRight + 8 && x + textWidth / 2 < viewWidth - 4) {
        ctx.fillStyle = "rgba(255, 215, 0, 0.75)";
        ctx.fillText(label, x, viewHeight * 0.58);
        lastLabelRight = x + textWidth / 2;
      }
    }
  }

  ctx.restore();
  canvas.classList.toggle("is-dragging", state.isDragging && state.activePointers.size === 1);
  updateInfoPanels(viewWidth);
  requestAnimationFrame(render);
}

requestAnimationFrame(render);

function animate() {
  const now = performance.now();
  if (Math.abs(state.targetOffset) < state.renderMsPerPixel * 2 && now - state.lastInteraction > 4000) {
    // Drift gently back to present if user hasn't interacted for a while
    state.targetOffset *= 0.92;
  }
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

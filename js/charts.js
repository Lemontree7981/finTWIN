/**
 * Canvas-based Fan Chart Renderer
 * Draws percentile bands + median line for simulation results
 */

const ChartRenderer = (() => {
  const COLORS = {
    p5_p95:  { fill: 'rgba(0, 212, 170, 0.06)', stroke: 'rgba(0, 212, 170, 0.15)' },
    p10_p90: { fill: 'rgba(0, 212, 170, 0.08)', stroke: 'rgba(0, 212, 170, 0.2)' },
    p25_p75: { fill: 'rgba(0, 212, 170, 0.12)', stroke: 'rgba(0, 212, 170, 0.25)' },
    median:  { stroke: '#ffd93d', width: 2.5 },
    baseline:{ stroke: '#a78bfa', width: 1.5, dash: [6, 4] },
    grid:    { stroke: 'rgba(255, 255, 255, 0.05)' },
    axis:    { stroke: 'rgba(255, 255, 255, 0.1)' },
    text:    'rgba(255, 255, 255, 0.45)',
    zero:    'rgba(255, 107, 107, 0.3)'
  };

  const PADDING = { top: 30, right: 30, bottom: 50, left: 80 };

  /**
   * Render the fan chart
   * @param {HTMLCanvasElement} canvas
   * @param {Object} results - simulation results from SimulationEngine
   * @param {Object} [baselineResults] - optional baseline for comparison
   * @param {boolean} [animate] - whether to animate the draw
   */
  function render(canvas, results, baselineResults = null, animate = true) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size matching container
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const plotW = w - PADDING.left - PADDING.right;
    const plotH = h - PADDING.top - PADDING.bottom;

    const yearly = results.stats.yearly;
    const years = results.years;

    // Determine Y range
    let yMin = Infinity, yMax = -Infinity;
    for (const ys of yearly) {
      yMin = Math.min(yMin, ys.p5);
      yMax = Math.max(yMax, ys.p95);
    }
    if (baselineResults) {
      for (const ys of baselineResults.stats.yearly) {
        yMin = Math.min(yMin, ys.p5);
        yMax = Math.max(yMax, ys.p95);
      }
    }

    // Add 10% padding
    const yRange = yMax - yMin || 1;
    yMin -= yRange * 0.08;
    yMax += yRange * 0.08;

    // Scale functions
    const xScale = (year) => PADDING.left + (year / years) * plotW;
    const yScale = (val) => PADDING.top + (1 - (val - yMin) / (yMax - yMin)) * plotH;

    if (animate) {
      animateDraw(ctx, w, h, plotW, plotH, yearly, years, yMin, yMax, xScale, yScale, baselineResults);
    } else {
      drawFull(ctx, w, h, plotW, plotH, yearly, years, yMin, yMax, xScale, yScale, baselineResults);
    }
  }

  function drawFull(ctx, w, h, plotW, plotH, yearly, years, yMin, yMax, xScale, yScale, baselineResults) {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, plotW, plotH, years, yMin, yMax, xScale, yScale);
    drawBands(ctx, yearly, years, xScale, yScale, 1);
    if (baselineResults) {
      drawBaselineLine(ctx, baselineResults.stats.yearly, years, xScale, yScale, 1);
    }
    drawMedianLine(ctx, yearly, years, xScale, yScale, 1);
    drawAxes(ctx, w, h, plotW, plotH, years, yMin, yMax, xScale, yScale);
    drawZeroLine(ctx, yMin, yMax, xScale, yScale, years, plotW);
  }

  function animateDraw(ctx, w, h, plotW, plotH, yearly, years, yMin, yMax, xScale, yScale, baselineResults) {
    let progress = 0;
    const duration = 800; // ms
    const startTime = performance.now();

    function frame(now) {
      progress = Math.min(1, (now - startTime) / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      ctx.clearRect(0, 0, w, h);
      drawGrid(ctx, w, h, plotW, plotH, years, yMin, yMax, xScale, yScale);
      drawBands(ctx, yearly, years, xScale, yScale, eased);
      if (baselineResults) {
        drawBaselineLine(ctx, baselineResults.stats.yearly, years, xScale, yScale, eased);
      }
      drawMedianLine(ctx, yearly, years, xScale, yScale, eased);
      drawAxes(ctx, w, h, plotW, plotH, years, yMin, yMax, xScale, yScale);
      drawZeroLine(ctx, yMin, yMax, xScale, yScale, years, plotW);

      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }

  function drawGrid(ctx, w, h, plotW, plotH, years, yMin, yMax, xScale, yScale) {
    ctx.strokeStyle = COLORS.grid.stroke;
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const yTicks = niceScale(yMin, yMax, 5);
    for (const val of yTicks) {
      const y = yScale(val);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(PADDING.left + plotW, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let yr = 0; yr <= years; yr++) {
      const x = xScale(yr);
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, PADDING.top + plotH);
      ctx.stroke();
    }
  }

  function drawBands(ctx, yearly, years, xScale, yScale, progress) {
    const maxYear = Math.floor(years * progress);
    const fractional = (years * progress) - maxYear;

    // P5-P95 band
    drawBand(ctx, yearly, 'p5', 'p95', xScale, yScale, COLORS.p5_p95.fill, maxYear, fractional);
    // P10-P90 band
    drawBand(ctx, yearly, 'p10', 'p90', xScale, yScale, COLORS.p10_p90.fill, maxYear, fractional);
    // P25-P75 band
    drawBand(ctx, yearly, 'p25', 'p75', xScale, yScale, COLORS.p25_p75.fill, maxYear, fractional);
  }

  function drawBand(ctx, yearly, lowKey, highKey, xScale, yScale, fillStyle, maxYear, fractional) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();

    // Upper edge (forward)
    for (let y = 0; y <= maxYear && y < yearly.length; y++) {
      const x = xScale(y);
      const val = yScale(yearly[y][highKey]);
      if (y === 0) ctx.moveTo(x, val);
      else ctx.lineTo(x, val);
    }

    // Interpolate fractional year
    if (fractional > 0 && maxYear + 1 < yearly.length) {
      const y0 = yearly[maxYear][highKey];
      const y1 = yearly[maxYear + 1][highKey];
      const interp = y0 + (y1 - y0) * fractional;
      ctx.lineTo(xScale(maxYear + fractional), yScale(interp));
    }

    // Lower edge (backward)
    const endIdx = fractional > 0 && maxYear + 1 < yearly.length ? maxYear + 1 : maxYear;
    if (fractional > 0 && maxYear + 1 < yearly.length) {
      const y0 = yearly[maxYear][lowKey];
      const y1 = yearly[maxYear + 1][lowKey];
      const interp = y0 + (y1 - y0) * fractional;
      ctx.lineTo(xScale(maxYear + fractional), yScale(interp));
    }

    for (let y = Math.min(maxYear, yearly.length - 1); y >= 0; y--) {
      const x = xScale(y);
      const val = yScale(yearly[y][lowKey]);
      ctx.lineTo(x, val);
    }

    ctx.closePath();
    ctx.fill();
  }

  function drawMedianLine(ctx, yearly, years, xScale, yScale, progress) {
    const maxYear = Math.floor(years * progress);
    const fractional = (years * progress) - maxYear;

    ctx.strokeStyle = COLORS.median.stroke;
    ctx.lineWidth = COLORS.median.width;
    ctx.setLineDash([]);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Glow effect
    ctx.shadowColor = COLORS.median.stroke;
    ctx.shadowBlur = 8;

    ctx.beginPath();
    for (let y = 0; y <= maxYear && y < yearly.length; y++) {
      const x = xScale(y);
      const val = yScale(yearly[y].median);
      if (y === 0) ctx.moveTo(x, val);
      else ctx.lineTo(x, val);
    }

    if (fractional > 0 && maxYear + 1 < yearly.length) {
      const y0 = yearly[maxYear].median;
      const y1 = yearly[maxYear + 1].median;
      const interp = y0 + (y1 - y0) * fractional;
      ctx.lineTo(xScale(maxYear + fractional), yScale(interp));
    }

    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw dot at the end
    const endYear = Math.min(maxYear, yearly.length - 1);
    let dotX, dotY;
    if (fractional > 0 && maxYear + 1 < yearly.length) {
      const y0 = yearly[maxYear].median;
      const y1 = yearly[maxYear + 1].median;
      dotX = xScale(maxYear + fractional);
      dotY = yScale(y0 + (y1 - y0) * fractional);
    } else {
      dotX = xScale(endYear);
      dotY = yScale(yearly[endYear].median);
    }

    ctx.fillStyle = COLORS.median.stroke;
    ctx.shadowColor = COLORS.median.stroke;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawBaselineLine(ctx, yearly, years, xScale, yScale, progress) {
    const maxYear = Math.floor(years * progress);
    const fractional = (years * progress) - maxYear;

    ctx.strokeStyle = COLORS.baseline.stroke;
    ctx.lineWidth = COLORS.baseline.width;
    ctx.setLineDash(COLORS.baseline.dash);
    ctx.lineJoin = 'round';

    ctx.beginPath();
    for (let y = 0; y <= maxYear && y < yearly.length; y++) {
      const x = xScale(y);
      const val = yScale(yearly[y].median);
      if (y === 0) ctx.moveTo(x, val);
      else ctx.lineTo(x, val);
    }

    if (fractional > 0 && maxYear + 1 < yearly.length) {
      const y0 = yearly[maxYear].median;
      const y1 = yearly[maxYear + 1].median;
      const interp = y0 + (y1 - y0) * fractional;
      ctx.lineTo(xScale(maxYear + fractional), yScale(interp));
    }

    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawZeroLine(ctx, yMin, yMax, xScale, yScale, years, plotW) {
    if (yMin < 0 && yMax > 0) {
      const y = yScale(0);
      ctx.strokeStyle = COLORS.zero;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(PADDING.left + plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = 'rgba(255, 107, 107, 0.5)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('₹0 (Broke)', PADDING.left + plotW, y - 4);
    }
  }

  function drawAxes(ctx, w, h, plotW, plotH, years, yMin, yMax, xScale, yScale) {
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '11px Inter, sans-serif';

    // X axis labels
    for (let yr = 0; yr <= years; yr++) {
      const x = xScale(yr);
      const label = yr === 0 ? 'Now' : `Y${yr}`;
      ctx.fillText(label, x, PADDING.top + plotH + 12);
    }

    // X axis title
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillText('Years', PADDING.left + plotW / 2, PADDING.top + plotH + 32);

    // Y axis labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.text;
    ctx.font = '11px JetBrains Mono, monospace';

    const yTicks = niceScale(yMin, yMax, 5);
    for (const val of yTicks) {
      const y = yScale(val);
      ctx.fillText(formatCurrency(val, true), PADDING.left - 10, y);
    }
  }

  function niceScale(min, max, targetTicks) {
    const range = max - min;
    const roughStep = range / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const residual = roughStep / magnitude;

    let niceStep;
    if (residual <= 1.5) niceStep = magnitude;
    else if (residual <= 3) niceStep = 2 * magnitude;
    else if (residual <= 7) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;

    const start = Math.ceil(min / niceStep) * niceStep;
    const ticks = [];
    for (let val = start; val <= max; val += niceStep) {
      ticks.push(val);
    }
    return ticks;
  }

  function formatCurrency(value, short = false) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (short) {
      if (abs >= 1e7) return sign + '₹' + (abs / 1e7).toFixed(1) + 'Cr';
      if (abs >= 1e5) return sign + '₹' + (abs / 1e5).toFixed(1) + 'L';
      if (abs >= 1e3) return sign + '₹' + (abs / 1e3).toFixed(0) + 'K';
      return sign + '₹' + abs.toFixed(0);
    }

    return sign + '₹' + abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  /** Handle window resize */
  function handleResize(canvas, results, baselineResults) {
    render(canvas, results, baselineResults, false);
  }

  // --- Tooltip / Hover Interaction ---
  let lastRenderParams = null;
  let tooltipEl = null;
  let crosshairActive = false;

  function ensureTooltip(canvas) {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'chart-tooltip';
    tooltipEl.innerHTML = '';
    canvas.parentElement.style.position = 'relative';
    canvas.parentElement.appendChild(tooltipEl);
    return tooltipEl;
  }

  function attachHoverListeners(canvas) {
    if (canvas._hoverBound) return;
    canvas._hoverBound = true;

    canvas.addEventListener('mousemove', (e) => {
      if (!lastRenderParams) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      handleHover(canvas, mouseX, mouseY);
    });

    canvas.addEventListener('mouseleave', () => {
      crosshairActive = false;
      const tip = ensureTooltip(canvas);
      tip.classList.remove('visible');
      // Redraw without crosshair
      if (lastRenderParams) {
        const p = lastRenderParams;
        drawFull(p.ctx, p.w, p.h, p.plotW, p.plotH, p.yearly, p.years, p.yMin, p.yMax, p.xScale, p.yScale, p.baselineResults);
      }
    });
  }

  function handleHover(canvas, mouseX, mouseY) {
    const p = lastRenderParams;
    if (!p) return;

    // Determine which year the mouse is closest to
    const plotLeft = PADDING.left;
    const plotRight = PADDING.left + p.plotW;
    if (mouseX < plotLeft || mouseX > plotRight) {
      const tip = ensureTooltip(canvas);
      tip.classList.remove('visible');
      return;
    }

    const yearFraction = ((mouseX - plotLeft) / p.plotW) * p.years;
    const year = Math.round(yearFraction);
    const clampedYear = Math.max(0, Math.min(year, p.years));

    if (clampedYear >= p.yearly.length) return;

    const ys = p.yearly[clampedYear];
    const xPos = p.xScale(clampedYear);

    // Redraw base chart (no animation)
    drawFull(p.ctx, p.w, p.h, p.plotW, p.plotH, p.yearly, p.years, p.yMin, p.yMax, p.xScale, p.yScale, p.baselineResults);

    // Draw crosshair line
    p.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    p.ctx.lineWidth = 1;
    p.ctx.setLineDash([4, 4]);
    p.ctx.beginPath();
    p.ctx.moveTo(xPos, PADDING.top);
    p.ctx.lineTo(xPos, PADDING.top + p.plotH);
    p.ctx.stroke();
    p.ctx.setLineDash([]);

    // Draw dots at each percentile
    const dots = [
      { key: 'p95', color: 'rgba(0, 212, 170, 0.5)' },
      { key: 'p75', color: 'rgba(0, 212, 170, 0.7)' },
      { key: 'median', color: '#ffd93d' },
      { key: 'p25', color: 'rgba(0, 212, 170, 0.7)' },
      { key: 'p5', color: 'rgba(255, 107, 107, 0.7)' }
    ];

    for (const dot of dots) {
      const dy = p.yScale(ys[dot.key]);
      p.ctx.fillStyle = dot.color;
      p.ctx.beginPath();
      p.ctx.arc(xPos, dy, 4, 0, Math.PI * 2);
      p.ctx.fill();
    }

    // Position and fill tooltip
    const tip = ensureTooltip(canvas);
    const label = clampedYear === 0 ? 'Now' : `Year ${clampedYear}`;
    tip.innerHTML = `
      <div class="chart-tooltip__title">${label}</div>
      <div class="chart-tooltip__row"><span class="chart-tooltip__label">P95 (Best)</span><span class="chart-tooltip__value chart-tooltip__value--teal">${formatCurrency(ys.p95, true)}</span></div>
      <div class="chart-tooltip__row"><span class="chart-tooltip__label">P75</span><span class="chart-tooltip__value chart-tooltip__value--dim">${formatCurrency(ys.p75, true)}</span></div>
      <div class="chart-tooltip__row"><span class="chart-tooltip__label">Median</span><span class="chart-tooltip__value chart-tooltip__value--gold">${formatCurrency(ys.median, true)}</span></div>
      <div class="chart-tooltip__row"><span class="chart-tooltip__label">P25</span><span class="chart-tooltip__value chart-tooltip__value--dim">${formatCurrency(ys.p25, true)}</span></div>
      <div class="chart-tooltip__row"><span class="chart-tooltip__label">P5 (Worst)</span><span class="chart-tooltip__value chart-tooltip__value--coral">${formatCurrency(ys.p5, true)}</span></div>
    `;

    // Position tooltip
    const tipWidth = 180;
    let tipX = mouseX + 16;
    if (tipX + tipWidth > p.w) tipX = mouseX - tipWidth - 16;
    let tipY = mouseY - 40;
    if (tipY < 0) tipY = mouseY + 16;

    tip.style.left = tipX + 'px';
    tip.style.top = tipY + 'px';
    tip.classList.add('visible');
    crosshairActive = true;
  }

  // Override render to store params and attach listeners
  const _originalRender = render;
  function renderWithTooltip(canvas, results, baselineResults, animate) {
    _originalRender(canvas, results, baselineResults, animate);

    // Store params for hover after animation completes
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const plotW = w - PADDING.left - PADDING.right;
    const plotH = h - PADDING.top - PADDING.bottom;
    const yearly = results.stats.yearly;
    const years = results.years;

    let yMin = Infinity, yMax = -Infinity;
    for (const ys of yearly) {
      yMin = Math.min(yMin, ys.p5);
      yMax = Math.max(yMax, ys.p95);
    }
    if (baselineResults) {
      for (const ys of baselineResults.stats.yearly) {
        yMin = Math.min(yMin, ys.p5);
        yMax = Math.max(yMax, ys.p95);
      }
    }
    const yRange = yMax - yMin || 1;
    yMin -= yRange * 0.08;
    yMax += yRange * 0.08;

    const xScale = (year) => PADDING.left + (year / years) * plotW;
    const yScale = (val) => PADDING.top + (1 - (val - yMin) / (yMax - yMin)) * plotH;

    lastRenderParams = { ctx, w, h, plotW, plotH, yearly, years, yMin, yMax, xScale, yScale, baselineResults };
    attachHoverListeners(canvas);
  }

  return { render: renderWithTooltip, handleResize, formatCurrency };
})();

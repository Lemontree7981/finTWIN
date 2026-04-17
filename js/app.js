/**
 * App Controller
 * Wires DOM events, manages state, orchestrates simulation → render → narrative
 */

const App = (() => {
  // --- State ---
  let state = {
    profile: null,
    selectedScenario: 'baseline',
    baselineResults: null,
    scenarioResults: null,
    isRunning: false
  };

  // --- DOM References ---
  const DOM = {};

  function init() {
    cacheDOMRefs();
    bindEvents();
    selectScenario('baseline');
  }

  function cacheDOMRefs() {
    DOM.age = document.getElementById('input-age');
    DOM.salary = document.getElementById('input-salary');
    DOM.savings = document.getElementById('input-savings');
    DOM.expenses = document.getElementById('input-expenses');
    DOM.goal = document.getElementById('input-goal');
    DOM.runBtn = document.getElementById('run-btn');
    DOM.scenarioCards = document.querySelectorAll('.scenario-card');
    DOM.resultsSection = document.getElementById('results-section');
    DOM.chartCanvas = document.getElementById('fan-chart');
    DOM.narrativeContent = document.getElementById('narrative-content');
    DOM.narrativeSource = document.getElementById('narrative-source');
    DOM.customPanel = document.getElementById('custom-panel');
    // Metric cards
    DOM.metricMedian = document.getElementById('metric-median');
    DOM.metricBest = document.getElementById('metric-best');
    DOM.metricWorst = document.getElementById('metric-worst');
    DOM.metricGoal = document.getElementById('metric-goal');
    DOM.metricRuin = document.getElementById('metric-ruin');
    DOM.metricBaseline = document.getElementById('metric-baseline');

    // Risk gauge
    DOM.riskBar = document.getElementById('risk-bar');
    DOM.riskLabel = document.getElementById('risk-label');
    DOM.riskScore = document.getElementById('risk-score');

    // Comparison
    DOM.compBaseline = document.getElementById('comp-baseline');
    DOM.compScenario = document.getElementById('comp-scenario');
    DOM.compScenarioTitle = document.getElementById('comp-scenario-title');

    // Custom inputs
    DOM.customReturnMean = document.getElementById('custom-return-mean');
    DOM.customReturnStd = document.getElementById('custom-return-std');
    DOM.customIncomeGrowth = document.getElementById('custom-income-growth');
    DOM.customExpenseInflation = document.getElementById('custom-expense-inflation');
  }

  function bindEvents() {
    // Scenario selection
    DOM.scenarioCards.forEach(card => {
      card.addEventListener('click', () => {
        selectScenario(card.dataset.scenario);
      });
    });

    // Run button
    DOM.runBtn.addEventListener('click', runSimulation);

    // Allow Enter key to trigger run
    document.querySelectorAll('.form-group input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runSimulation();
      });
    });

    // Window resize — re-render chart
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.scenarioResults) {
          ChartRenderer.handleResize(DOM.chartCanvas, state.scenarioResults, state.baselineResults);
        }
      }, 200);
    });
  }

  function selectScenario(scenarioId) {
    state.selectedScenario = scenarioId;

    DOM.scenarioCards.forEach(card => {
      card.classList.toggle('active', card.dataset.scenario === scenarioId);
    });

    // Show/hide custom panel
    if (DOM.customPanel) {
      DOM.customPanel.classList.toggle('visible', scenarioId === 'custom');
    }
  }

  function getProfile() {
    const age = parseInt(DOM.age.value) || 28;
    const salary = parseFloat(DOM.salary.value) || 800000;
    const savings = parseFloat(DOM.savings.value) || 300000;
    const monthlyExpenses = parseFloat(DOM.expenses.value) || 35000;
    const goalAmount = parseFloat(DOM.goal.value) || 5000000;

    return { age, salary, savings, monthlyExpenses, goalAmount };
  }

  function getScenario() {
    const scenarioId = state.selectedScenario;
    let scenario = { ...Scenarios[scenarioId] };

    // Apply custom overrides
    if (scenarioId === 'custom') {
      scenario.returnMean = (parseFloat(DOM.customReturnMean?.value) || 10) / 100;
      scenario.returnStd = (parseFloat(DOM.customReturnStd?.value) || 18) / 100;
      scenario.incomeGrowthMean = (parseFloat(DOM.customIncomeGrowth?.value) || 6) / 100;
      scenario.expenseInflationMean = (parseFloat(DOM.customExpenseInflation?.value) || 5) / 100;
    }

    return scenario;
  }

  function runSimulation() {
    if (state.isRunning) return;

    const profile = getProfile();
    const scenario = getScenario();
    const baseline = Scenarios.baseline;

    state.profile = profile;
    state.isRunning = true;

    // UI: loading state
    DOM.runBtn.classList.add('loading');
    DOM.runBtn.disabled = true;

    // Use requestAnimationFrame + setTimeout to let the UI update
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          // Run baseline
          state.baselineResults = SimulationEngine.simulate(profile, baseline, { years: 10, runs: 1000 });

          // Run selected scenario
          if (scenario.id === 'baseline') {
            state.scenarioResults = state.baselineResults;
          } else {
            state.scenarioResults = SimulationEngine.simulate(profile, scenario, { years: 10, runs: 1000 });
          }

          renderResults(state.scenarioResults, state.baselineResults, profile, scenario);
        } catch (err) {
          console.error('Simulation error:', err);
        } finally {
          state.isRunning = false;
          DOM.runBtn.classList.remove('loading');
          DOM.runBtn.disabled = false;
        }
      }, 50);
    });
  }

  function renderResults(results, baselineResults, profile, scenario) {
    // Show results section
    DOM.resultsSection.classList.add('visible');

    // Smooth scroll to results
    setTimeout(() => {
      DOM.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    const s = results.stats;
    const b = baselineResults.stats;

    // --- Metric cards ---
    animateMetric(DOM.metricMedian, s.final.median);
    animateMetric(DOM.metricBest, s.final.p95);
    animateMetric(DOM.metricWorst, s.final.p5);
    animateMetricPercent(DOM.metricGoal, s.goalProbability);
    animateMetricPercent(DOM.metricRuin, s.ruinProbability);
    animateMetric(DOM.metricBaseline, b.final.median);

    // Sub labels
    setSubLabel(DOM.metricMedian, 'Most likely outcome');
    setSubLabel(DOM.metricBest, 'Top 5% of outcomes');
    setSubLabel(DOM.metricWorst, 'Bottom 5% of outcomes');
    setSubLabel(DOM.metricGoal, `Target: ${ChartRenderer.formatCurrency(s.goalAmount, true)}`);
    setSubLabel(DOM.metricRuin, s.ruinProbability > 0 ? `${s.ruinWithin3Prob.toFixed(0)}% within 3 years` : 'Savings remain positive');
    setSubLabel(DOM.metricBaseline, 'Continue working (median)');

    // --- Risk gauge ---
    const riskScore = computeRiskScore(s);
    const riskInfo = getRiskLabel(riskScore);
    DOM.riskBar.style.width = riskScore + '%';
    DOM.riskBar.className = 'risk-gauge__bar risk-gauge__bar--' + riskInfo.class;
    DOM.riskLabel.textContent = riskInfo.label;
    DOM.riskLabel.style.color = riskInfo.color;
    DOM.riskScore.textContent = riskScore + '/100';
    DOM.riskScore.style.color = riskInfo.color;

    // --- Fan chart ---
    const baselineOverlay = scenario.id !== 'baseline' ? baselineResults : null;
    ChartRenderer.render(DOM.chartCanvas, results, baselineOverlay, true);

    // --- Comparison ---
    renderComparison(s, b, scenario);

    // --- Narrative ---
    DOM.narrativeContent.innerHTML = '<div class="narrative-loading"><div class="narrative-loading__spinner"></div><span>Preparing analysis...</span></div>';
    DOM.narrativeContent.style.opacity = '1';
    DOM.narrativeContent.style.transform = 'translateY(0)';
    if (DOM.narrativeSource) DOM.narrativeSource.innerHTML = '';

    NarrativeGenerator.generate(results, baselineResults, profile, scenario)
      .then(({ html, source }) => {
        DOM.narrativeContent.innerHTML = html;

        if (DOM.narrativeSource) {
          DOM.narrativeSource.innerHTML = source === 'template'
            ? '<span class="source-badge source-badge--template">Local Analysis</span>'
            : '';
        }

        // Animate in
        DOM.narrativeContent.style.opacity = '0';
        DOM.narrativeContent.style.transform = 'translateY(12px)';
        setTimeout(() => {
          DOM.narrativeContent.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
          DOM.narrativeContent.style.opacity = '1';
          DOM.narrativeContent.style.transform = 'translateY(0)';
        }, 100);
      })
      .catch(err => {
        console.error('Narrative generation error:', err);
        DOM.narrativeContent.innerHTML = `<div class="warning-box"><strong>Error:</strong> ${err.message}</div>`;
      });
  }

  function animateMetric(el, value) {
    if (!el) return;
    const valueEl = el.querySelector('.metric-card__value');
    if (!valueEl) return;

    const formatted = ChartRenderer.formatCurrency(value, true);
    const duration = 800;
    const startTime = performance.now();
    const startVal = 0;

    function frame(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (value - startVal) * eased;
      valueEl.textContent = ChartRenderer.formatCurrency(current, true);
      if (progress < 1) requestAnimationFrame(frame);
      else valueEl.textContent = formatted;
    }

    requestAnimationFrame(frame);
  }

  function animateMetricPercent(el, value) {
    if (!el) return;
    const valueEl = el.querySelector('.metric-card__value');
    if (!valueEl) return;

    const duration = 800;
    const startTime = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = value * eased;
      valueEl.textContent = current.toFixed(1) + '%';
      if (progress < 1) requestAnimationFrame(frame);
      else valueEl.textContent = value.toFixed(1) + '%';
    }

    requestAnimationFrame(frame);
  }

  function setSubLabel(el, text) {
    if (!el) return;
    const sub = el.querySelector('.metric-card__sub');
    if (sub) sub.textContent = text;
  }

  function renderComparison(s, b, scenario) {
    const rows = [
      { label: 'Median Net Worth', key: 'median' },
      { label: 'Best Case (P95)', key: 'p95' },
      { label: 'Worst Case (P5)', key: 'p5' },
      { label: 'Mean', key: 'mean' }
    ];

    // Baseline column
    if (DOM.compBaseline) {
      DOM.compBaseline.innerHTML = rows.map(row => `
        <div class="comparison-row">
          <span class="comparison-row__label">${row.label}</span>
          <span class="comparison-row__value comparison-row__value--neutral">${ChartRenderer.formatCurrency(b.final[row.key], true)}</span>
        </div>
      `).join('');
    }

    // Scenario column
    if (DOM.compScenario) {
      DOM.compScenario.innerHTML = rows.map(row => {
        const diff = s.final[row.key] - b.final[row.key];
        const colorClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
        const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
        return `
          <div class="comparison-row">
            <span class="comparison-row__label">${row.label}</span>
            <span class="comparison-row__value comparison-row__value--${colorClass}">
              ${ChartRenderer.formatCurrency(s.final[row.key], true)} ${scenario.id !== 'baseline' ? arrow : ''}
            </span>
          </div>
        `;
      }).join('');
    }

    // Update scenario title
    if (DOM.compScenarioTitle) {
      DOM.compScenarioTitle.innerHTML = `<span class="dot"></span> ${scenario.name}`;
    }
  }

  // --- Initialize on DOM ready ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { runSimulation, selectScenario };
})();

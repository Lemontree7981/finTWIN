/**
 * App Controller â€” AI Financial Digital Twin
 * Wires DOM events, manages state, orchestrates simulation â†’ behavioral â†’ render â†’ narrative â†’ chat
 */

const App = (() => {
  // --- State ---
  let state = {
    profile: null,
    selectedScenario: 'baseline',
    activeScenarioConfig: null,
    baselineResults: null,
    scenarioResults: null,
    behavioralReport: null,
    isRunning: false,
    chatOpen: false,
    chatBusy: false,
    chatMemory: {
      goal: null,
      riskProfile: null,
      plannedEvents: [],
      controls: {}
    }
  };

  // --- DOM References ---
  const DOM = {};

  function init() {
    cacheDOMRefs();
    bindEvents();
    selectScenario('baseline');
    state.activeScenarioConfig = Scenarios.baseline;
    initChat();
    updateHealthIndicators();
  }

  function cacheDOMRefs() {
    DOM.age = document.getElementById('input-age');
    DOM.salary = document.getElementById('input-salary');
    DOM.savings = document.getElementById('input-savings');
    DOM.expenses = document.getElementById('input-expenses');
    DOM.goal = document.getElementById('input-goal');
    DOM.years = document.getElementById('input-years');
    DOM.runBtn = document.getElementById('run-btn');
    DOM.scenarioCards = document.querySelectorAll('.scenario-card');
    DOM.resultsSection = document.getElementById('results-section');
    DOM.chartCanvas = document.getElementById('fan-chart');
    DOM.narrativeContent = document.getElementById('narrative-content');
    DOM.narrativeSource = document.getElementById('narrative-source');
    DOM.customPanel = document.getElementById('custom-panel');

    // Scenario parameter panels
    DOM.scenarioPanels = {
      buy_house: document.getElementById('panel-buy-house'),
      aggressive: document.getElementById('panel-aggressive'),
      career_switch: document.getElementById('panel-career-switch'),
      quit_job: document.getElementById('panel-quit-job')
    };

    // Currency inputs
    DOM.currencyInputs = document.querySelectorAll('input[data-type="currency"]');

    // Buy a House inputs
    DOM.housePrice = document.getElementById('house-price');
    DOM.houseDownPayment = document.getElementById('house-down-payment');
    DOM.houseInterestRate = document.getElementById('house-interest-rate');
    DOM.houseTenure = document.getElementById('house-tenure');
    DOM.houseMaintenance = document.getElementById('house-maintenance');
    DOM.houseEmiPreview = document.getElementById('house-emi-preview');

    // Aggressive Investing inputs
    DOM.aggInitialInvestment = document.getElementById('agg-initial-investment');
    DOM.aggMonthlyInvestment = document.getElementById('agg-monthly-investment');
    DOM.aggDuration = document.getElementById('agg-duration');
    DOM.aggReturnProfile = document.getElementById('agg-return-profile');
    DOM.aggCrashBehavior = document.getElementById('agg-crash-behavior');

    // Career Switch inputs
    DOM.careerStability = document.getElementById('career-stability');
    DOM.careerSwitchTime = document.getElementById('career-switch-time');
    DOM.careerStartSalary = document.getElementById('career-start-salary');
    DOM.careerGrowthRate = document.getElementById('career-growth-rate');
    DOM.careerIncomeGap = document.getElementById('career-income-gap');

    // Business inputs
    DOM.bizInvestment = document.getElementById('biz-investment');
    DOM.bizRisk = document.getElementById('biz-risk');
    DOM.bizCommitment = document.getElementById('biz-commitment');

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

    // Health indicators
    DOM.healthSavingsRate = document.getElementById('health-savings-rate-value');
    DOM.healthEmergency = document.getElementById('health-emergency-value');
    DOM.healthExpenseRatio = document.getElementById('health-expense-ratio-value');

    // Chat elements
    DOM.chatFab = document.getElementById('chat-fab');
    DOM.chatPanel = document.getElementById('chat-panel');
    DOM.chatClose = document.getElementById('chat-close');
    DOM.chatMessages = document.getElementById('chat-messages');
    DOM.chatInput = document.getElementById('chat-input');
    DOM.chatSend = document.getElementById('chat-send');
    DOM.chatPrompts = document.getElementById('chat-prompts');
    DOM.chatMemory = document.getElementById('chat-memory');
    DOM.chatStatus = document.getElementById('chat-status');

    // Tax rate
    DOM.taxRate = document.getElementById('input-tax-rate');

    // Compare All
    DOM.compareAllBtn = document.getElementById('compare-all-btn');
    DOM.compareTableSection = document.getElementById('compare-table-section');
    DOM.compareTableBody = document.getElementById('compare-table-body');
    DOM.compareTableClose = document.getElementById('compare-table-close');

    // Confetti
    DOM.confettiCanvas = document.getElementById('confetti-canvas');
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
    document.querySelectorAll('.input-panel .form-group input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runSimulation();
      });
      // Update health indicators on input change
      input.addEventListener('input', debounce(updateHealthIndicators, 300));
    });

    // Scenario panel inputs: Enter key to run + live EMI preview
    document.querySelectorAll('.scenario-params-panel .form-group input, .scenario-params-panel .form-group select').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runSimulation();
      });
    });

    // Live EMI preview for Buy a House
    ['house-price', 'house-down-payment', 'house-interest-rate', 'house-tenure', 'house-maintenance'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', debounce(updateHouseEmiPreview, 200));
    });

    // Chat events
    DOM.chatFab.addEventListener('click', toggleChat);
    DOM.chatClose.addEventListener('click', closeChat);
    DOM.chatSend.addEventListener('click', handleChatSend);
    DOM.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleChatSend();
    });

    // Currency formatting
    DOM.currencyInputs.forEach(input => {
      // Initial format
      input.value = formatCurrencyInput(input.value);

      input.addEventListener('input', (e) => {
        const cursor = e.target.selectionStart;
        const oldLen = e.target.value.length;
        
        const formatted = formatCurrencyInput(e.target.value);
        e.target.value = formatted;

        const newLen = formatted.length;
        const pos = cursor + (newLen - oldLen);
        e.target.setSelectionRange(pos, pos);
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

    // Compare All
    if (DOM.compareAllBtn) {
      DOM.compareAllBtn.addEventListener('click', compareAllScenarios);
    }
    if (DOM.compareTableClose) {
      DOM.compareTableClose.addEventListener('click', () => {
        DOM.compareTableSection.classList.remove('visible');
      });
    }
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // --- Formatting Helpers ---
  function formatCurrencyInput(val) {
    if (val === null || val === undefined || val === '') return '';
    // Strip everything but digits
    const numeric = String(val).replace(/\D/g, '');
    if (numeric === '') return '';
    // Format with commas (Indian system)
    return parseInt(numeric).toLocaleString('en-IN');
  }

  function parseCurrencyInput(val) {
    if (!val) return 0;
    const numeric = String(val).replace(/,/g, '');
    return parseFloat(numeric) || 0;
  }

  // ===================================================
  // Health Indicators (live update from input fields)
  // ===================================================
  function updateHealthIndicators() {
    const profile = getProfile();
    const annualExpenses = profile.monthlyExpenses * 12;
    const savingsRate = ((profile.salary - annualExpenses) / profile.salary) * 100;
    const emergencyMonths = profile.savings / profile.monthlyExpenses;
    const expenseRatio = (profile.monthlyExpenses / (profile.salary / 12)) * 100;

    if (DOM.healthSavingsRate) {
      DOM.healthSavingsRate.textContent = savingsRate.toFixed(1) + '%';
      DOM.healthSavingsRate.style.color = savingsRate >= 20 ? '#00d4aa' : savingsRate >= 10 ? '#ffd93d' : '#ff6b6b';
    }
    if (DOM.healthEmergency) {
      DOM.healthEmergency.textContent = emergencyMonths.toFixed(1) + ' mo';
      DOM.healthEmergency.style.color = emergencyMonths >= 6 ? '#00d4aa' : emergencyMonths >= 3 ? '#ffd93d' : '#ff6b6b';
    }
    if (DOM.healthExpenseRatio) {
      DOM.healthExpenseRatio.textContent = expenseRatio.toFixed(0) + '%';
      DOM.healthExpenseRatio.style.color = expenseRatio <= 50 ? '#00d4aa' : expenseRatio <= 70 ? '#ffd93d' : '#ff6b6b';
    }
  }

  // ===================================================
  // Scenario Selection
  // ===================================================
  function selectScenario(scenarioId) {
    state.selectedScenario = scenarioId;

    DOM.scenarioCards.forEach(card => {
      card.classList.toggle('active', card.dataset.scenario === scenarioId);
    });

    // Toggle custom panel
    if (DOM.customPanel) {
      DOM.customPanel.classList.toggle('visible', scenarioId === 'custom');
    }

    // Toggle scenario-specific parameter panels
    if (DOM.scenarioPanels) {
      for (const [id, panel] of Object.entries(DOM.scenarioPanels)) {
        if (panel) {
          panel.classList.toggle('visible', id === scenarioId);
        }
      }
    }

    // Update EMI preview when house scenario selected
    if (scenarioId === 'buy_house') {
      updateHouseEmiPreview();
    }
  }

  function getProfile() {
    const age = parseInt(DOM.age.value) || 0;
    const salary = parseCurrencyInput(DOM.salary.value);
    const savings = parseCurrencyInput(DOM.savings.value);
    const monthlyExpenses = parseCurrencyInput(DOM.expenses.value);
    const goalAmount = parseCurrencyInput(DOM.goal.value);
    const years = parseInt(DOM.years?.value) || 10;
    const taxRate = (parseFloat(DOM.taxRate?.value) || 30) / 100;

    return { age, salary, savings, monthlyExpenses, goalAmount, years, taxRate };
  }

  function getScenario() {
    const scenarioId = state.selectedScenario;

    // Custom scenario
    if (scenarioId === 'custom') {
      let scenario = { ...Scenarios.custom };
      scenario.returnMean = (parseFloat(DOM.customReturnMean?.value) || 10) / 100;
      scenario.returnStd = (parseFloat(DOM.customReturnStd?.value) || 18) / 100;
      scenario.incomeGrowthMean = (parseFloat(DOM.customIncomeGrowth?.value) || 6) / 100;
      scenario.expenseInflationMean = (parseFloat(DOM.customExpenseInflation?.value) || 5) / 100;
      return scenario;
    }

    // Buy a House — build from user inputs
    if (scenarioId === 'buy_house') {
      return buildBuyHouseScenario({
        propertyPrice: parseCurrencyInput(DOM.housePrice?.value) || 5000000,
        downPayment: parseCurrencyInput(DOM.houseDownPayment?.value) || 1000000,
        interestRate: parseFloat(DOM.houseInterestRate?.value) || 8.5,
        tenureYears: parseInt(DOM.houseTenure?.value) || 20,
        monthlyMaintenance: parseCurrencyInput(DOM.houseMaintenance?.value) || 3000
      });
    }

    // Aggressive Investing — build from user inputs
    if (scenarioId === 'aggressive') {
      return buildAggressiveScenario({
        initialInvestment: parseCurrencyInput(DOM.aggInitialInvestment?.value) || 100000,
        monthlyInvestment: parseCurrencyInput(DOM.aggMonthlyInvestment?.value) || 10000,
        durationYears: parseInt(DOM.aggDuration?.value) || 10,
        returnProfile: DOM.aggReturnProfile?.value || 'aggressive',
        crashBehavior: DOM.aggCrashBehavior?.value || 'hold'
      });
    }

    // Career Switch — build from user inputs
    if (scenarioId === 'career_switch') {
      return buildCareerSwitchScenario({
        jobStability: DOM.careerStability?.value || 'medium',
        switchTimeYears: parseFloat(DOM.careerSwitchTime?.value) || 1,
        expectedStartSalary: parseCurrencyInput(DOM.careerStartSalary?.value) || 600000,
        expectedGrowthRate: parseFloat(DOM.careerGrowthRate?.value) || 12,
        incomeGapMonths: parseInt(DOM.careerIncomeGap?.value) || 3
      });
    }

    // Start a Business — build from user inputs
    if (scenarioId === 'quit_job') {
      return buildBusinessScenario({
        investmentAmount: parseCurrencyInput(DOM.bizInvestment?.value) || 300000,
        businessRisk: DOM.bizRisk?.value || 'medium',
        timeCommitment: DOM.bizCommitment?.value || 'full_time'
      });
    }

    // Default: use predefined scenario as-is
    return { ...Scenarios[scenarioId] };
  }

  // ===================================================
  // House EMI Preview
  // ===================================================
  function updateHouseEmiPreview() {
    if (!DOM.houseEmiPreview) return;
    const price = parseCurrencyInput(DOM.housePrice?.value) || 5000000;
    const down = parseCurrencyInput(DOM.houseDownPayment?.value) || 1000000;
    const rate = parseFloat(DOM.houseInterestRate?.value) || 8.5;
    const tenure = parseInt(DOM.houseTenure?.value) || 20;
    const maintenance = parseCurrencyInput(DOM.houseMaintenance?.value) || 3000;

    const loan = Math.max(0, price - down);
    const mr = (rate / 100) / 12;
    const months = tenure * 12;
    let emi = 0;
    if (loan > 0 && mr > 0) {
      const f = Math.pow(1 + mr, months);
      emi = loan * mr * f / (f - 1);
    }
    const totalCost = emi * months;
    const totalInterest = totalCost - loan;

    DOM.houseEmiPreview.innerHTML = [
      `Loan: <strong>₹${(loan / 1e5).toFixed(1)}L</strong>`,
      `EMI: <strong>₹${Math.round(emi).toLocaleString('en-IN')}/mo</strong>`,
      `Total Interest: <strong>₹${(totalInterest / 1e5).toFixed(1)}L</strong>`,
      `Monthly Total: <strong>₹${Math.round(emi + maintenance).toLocaleString('en-IN')}</strong>`
    ].join(' &nbsp;|&nbsp; ');
  }

  // ===================================================
  // Main Simulation Run
  // ===================================================
  function runSimulation() {
    if (state.isRunning) return;

    const profile = getProfile();
    const scenario = getScenario();
    const baseline = Scenarios.baseline;

    state.profile = profile;
    state.activeScenarioConfig = scenario;
    state.isRunning = true;

    DOM.runBtn.classList.add('loading');
    DOM.runBtn.disabled = true;

    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          state.baselineResults = SimulationEngine.simulate(profile, baseline, { years: profile.years, runs: 1000 });

          if (scenario.id === 'baseline') {
            state.scenarioResults = state.baselineResults;
          } else {
            state.scenarioResults = SimulationEngine.simulate(profile, scenario, { years: profile.years, runs: 1000 });
          }

          // Run behavioral analysis
          state.behavioralReport = BehavioralEngine.analyze(
            profile, state.scenarioResults, state.baselineResults, scenario
          );

          renderResults(state.scenarioResults, state.baselineResults, profile, scenario, state.behavioralReport);
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

  // ===================================================
  // Render Results
  // ===================================================
  function renderResults(results, baselineResults, profile, scenario, behavioralReport) {
    DOM.resultsSection.classList.add('visible');

    setTimeout(() => {
      DOM.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    const s = results.stats;
    const b = baselineResults.stats;

    // Metric cards
    animateMetric(DOM.metricMedian, s.final.median);
    animateMetric(DOM.metricBest, s.final.p95);
    animateMetric(DOM.metricWorst, s.final.p5);
    animateMetricPercent(DOM.metricGoal, s.goalProbability);
    animateMetricPercent(DOM.metricRuin, s.ruinProbability);
    animateMetric(DOM.metricBaseline, b.final.median);

    setSubLabel(DOM.metricMedian, 'Most likely outcome');
    setSubLabel(DOM.metricBest, 'Top 5% of outcomes');
    setSubLabel(DOM.metricWorst, 'Bottom 5% of outcomes');
    setSubLabel(DOM.metricGoal, `Target: ${ChartRenderer.formatCurrency(s.goalAmount, true)}`);
    setSubLabel(DOM.metricRuin, s.ruinProbability > 0 ? `${s.ruinWithin3Prob.toFixed(0)}% within 3 years` : 'Savings remain positive');
    setSubLabel(DOM.metricBaseline, 'Continue working (median)');

    // Risk gauge
    const riskScore = computeRiskScore(s);
    const riskInfo = getRiskLabel(riskScore);
    DOM.riskBar.style.width = riskScore + '%';
    DOM.riskBar.className = 'risk-gauge__bar risk-gauge__bar--' + riskInfo.class;
    DOM.riskLabel.textContent = riskInfo.label;
    DOM.riskLabel.style.color = riskInfo.color;
    DOM.riskScore.textContent = riskScore + '/100';
    DOM.riskScore.style.color = riskInfo.color;

    // Fan chart
    const baselineOverlay = scenario.id !== 'baseline' ? baselineResults : null;
    ChartRenderer.render(DOM.chartCanvas, results, baselineOverlay, true);

    // Comparison
    renderComparison(s, b, scenario);

    // Narrative (with behavioral report)
    DOM.narrativeContent.innerHTML = '<div class="narrative-loading"><div class="narrative-loading__spinner"></div><span>Analyzing with AI...</span></div>';
    DOM.narrativeContent.style.opacity = '1';
    DOM.narrativeContent.style.transform = 'translateY(0)';
    if (DOM.narrativeSource) DOM.narrativeSource.innerHTML = '';

    NarrativeGenerator.generate(results, baselineResults, profile, scenario, behavioralReport)
      .then(({ html, source }) => {
        DOM.narrativeContent.innerHTML = html;

        if (DOM.narrativeSource) {
          DOM.narrativeSource.innerHTML = '<span class="source-badge source-badge--template">AI Analysis</span>';
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
        DOM.narrativeContent.innerHTML = `<div class="decision-verdict decision-verdict--risky"><strong>Error:</strong> ${err.message}</div>`;
      });

    // Confetti on high goal probability
    if (results.stats.goalProbability > 80) {
      launchConfetti();
    }
  }

  // ===================================================
  // Animation Helpers
  // ===================================================
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

    if (DOM.compBaseline) {
      DOM.compBaseline.innerHTML = rows.map(row => `
        <div class="comparison-row">
          <span class="comparison-row__label">${row.label}</span>
          <span class="comparison-row__value comparison-row__value--neutral">${ChartRenderer.formatCurrency(b.final[row.key], true)}</span>
        </div>
      `).join('');
    }

    if (DOM.compScenario) {
      DOM.compScenario.innerHTML = rows.map(row => {
        const diff = s.final[row.key] - b.final[row.key];
        const colorClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
        const arrow = diff > 0 ? '+' : diff < 0 ? '-' : '=';
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

    if (DOM.compScenarioTitle) {
      DOM.compScenarioTitle.innerHTML = `<span class="dot"></span> ${scenario.name}`;
    }
  }

  // ===================================================
  // Compare All Scenarios
  // ===================================================
  function compareAllScenarios() {
    const profile = getProfile();
    const scenarioIds = ['baseline', 'quit_job', 'aggressive', 'buy_house', 'career_switch'];
    const allResults = [];

    DOM.compareAllBtn.disabled = true;
    DOM.compareAllBtn.textContent = 'Running...';

    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          for (const id of scenarioIds) {
            const scenario = Scenarios[id];
            const results = SimulationEngine.simulate(profile, scenario, { years: profile.years, runs: 1000 });
            allResults.push({ scenario, results });
          }
          renderCompareTable(allResults);
          DOM.compareTableSection.classList.add('visible');
          setTimeout(() => {
            DOM.compareTableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        } catch (err) {
          console.error('Compare all error:', err);
        } finally {
          DOM.compareAllBtn.disabled = false;
          DOM.compareAllBtn.innerHTML = '<span class="compare-all-btn__icon">📊</span><span>Compare All Scenarios</span>';
        }
      }, 50);
    });
  }

  function renderCompareTable(allResults) {
    const metrics = [
      { label: 'Median (P50)', key: 'median', format: 'currency' },
      { label: 'Best Case (P95)', key: 'p95', format: 'currency' },
      { label: 'Worst Case (P5)', key: 'p5', format: 'currency' },
      { label: 'Goal Probability', key: 'goalProbability', format: 'percent' },
      { label: 'Ruin Probability', key: 'ruinProbability', format: 'percent' }
    ];

    // Find best/worst for each metric
    const bestIdx = {};
    const worstIdx = {};
    for (const m of metrics) {
      let bestI = 0, worstI = 0;
      for (let i = 1; i < allResults.length; i++) {
        const val = m.key === 'goalProbability' || m.key === 'ruinProbability'
          ? allResults[i].results.stats[m.key]
          : allResults[i].results.stats.final[m.key];
        const bestVal = m.key === 'goalProbability' || m.key === 'ruinProbability'
          ? allResults[bestI].results.stats[m.key]
          : allResults[bestI].results.stats.final[m.key];
        const worstVal = m.key === 'goalProbability' || m.key === 'ruinProbability'
          ? allResults[worstI].results.stats[m.key]
          : allResults[worstI].results.stats.final[m.key];

        if (m.key === 'ruinProbability') {
          if (val < bestVal) bestI = i;
          if (val > worstVal) worstI = i;
        } else {
          if (val > bestVal) bestI = i;
          if (val < worstVal) worstI = i;
        }
      }
      bestIdx[m.key] = bestI;
      worstIdx[m.key] = worstI;
    }

    let html = '<table class="compare-table">';
    // Header
    html += '<thead><tr><th>Metric</th>';
    for (const { scenario } of allResults) {
      html += `<th><i class="ct-scenario-icon">${scenario.icon}</i> ${scenario.name}</th>`;
    }
    html += '</tr></thead><tbody>';

    // Rows
    for (const m of metrics) {
      html += '<tr>';
      html += `<td>${m.label}</td>`;
      for (let i = 0; i < allResults.length; i++) {
        const s = allResults[i].results.stats;
        const val = m.key === 'goalProbability' || m.key === 'ruinProbability'
          ? s[m.key]
          : s.final[m.key];

        const isBest = bestIdx[m.key] === i;
        const isWorst = worstIdx[m.key] === i;
        const cls = isBest ? 'ct-best' : isWorst ? 'ct-worst' : '';

        const formatted = m.format === 'percent'
          ? val.toFixed(1) + '%'
          : ChartRenderer.formatCurrency(val, true);

        html += `<td class="${cls}">${formatted}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table>';
    DOM.compareTableBody.innerHTML = html;
  }

  // ===================================================
  // Confetti System
  // ===================================================
  function launchConfetti() {
    const canvas = DOM.confettiCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#00d4aa', '#ffd93d', '#a78bfa', '#60a5fa', '#ff6b6b', '#4ade80'];
    const count = 120;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.3 - canvas.height * 0.1,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
      });
    }

    let frame = 0;
    const maxFrames = 180;

    function animate() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const fadeStart = maxFrames * 0.6;
      const globalFade = frame > fadeStart ? 1 - (frame - fadeStart) / (maxFrames - fadeStart) : 1;

      for (const p of particles) {
        p.x += p.vx;
        p.vy += 0.08; // gravity
        p.y += p.vy;
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;
        p.opacity = globalFade;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    requestAnimationFrame(animate);
  }

  // ===================================================
  // Chat System
  // ===================================================
  function initChat() {
    renderSuggestedPrompts();
    renderChatMemory();
    updateChatStatus();
  }

  function toggleChat() {
    if (state.chatOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  function openChat() {
    state.chatOpen = true;
    DOM.chatPanel.classList.add('visible');
    DOM.chatFab.classList.add('hidden');
    DOM.chatInput.focus();
  }

  function closeChat() {
    state.chatOpen = false;
    DOM.chatPanel.classList.remove('visible');
    DOM.chatFab.classList.remove('hidden');
  }

  function renderSuggestedPrompts() {
    const plannerPrompts = typeof PlannerEngine !== 'undefined'
      ? PlannerEngine.getSuggestedPrompts(state.chatMemory)
      : [];
    const contextualPrompts = ChatEngine.getContextualPrompts(state.scenarioResults, state.behavioralReport, 6);
    const prompts = [...new Set([...plannerPrompts, ...contextualPrompts])].slice(0, 4);

    if (DOM.chatPrompts) {
      DOM.chatPrompts.innerHTML = prompts.map(p =>
        `<button class="chat-prompt-chip" data-prompt="${p}">${p}</button>`
      ).join('');

      DOM.chatPrompts.querySelectorAll('.chat-prompt-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          DOM.chatInput.value = chip.dataset.prompt;
          handleChatSend();
        });
      });
    }
  }

  function renderChatMemory() {
    if (!DOM.chatMemory || typeof PlannerEngine === 'undefined') return;

    const summary = PlannerEngine.buildMemorySummary(state.chatMemory);

    if (!summary.length) {
      DOM.chatMemory.innerHTML = `
        <div class="chat-memory__label">Session Memory</div>
        <div class="chat-memory__empty">No saved goals yet. Mention a timeline, target, or preference and I'll remember it for this session.</div>
      `;
      return;
    }

    DOM.chatMemory.innerHTML = `
      <div class="chat-memory__label">Session Memory</div>
      <div class="chat-memory__chips">
        ${summary.map(item => `<span class="chat-memory__chip">${escapeHtml(item)}</span>`).join('')}
      </div>
    `;
  }

  function updateChatStatus() {
    if (!DOM.chatStatus) return;

    if (typeof ChatApi === 'undefined') {
      DOM.chatStatus.textContent = 'Local simulator mode';
      DOM.chatStatus.dataset.mode = 'local';
      return;
    }

    DOM.chatStatus.textContent = ChatApi.getStatusText();
    DOM.chatStatus.dataset.mode = ChatApi.getMode();
  }

  function setChatBusy(isBusy) {
    state.chatBusy = isBusy;

    if (DOM.chatInput) {
      DOM.chatInput.disabled = isBusy;
      if (!isBusy && state.chatOpen) DOM.chatInput.focus();
    }

    if (DOM.chatSend) {
      DOM.chatSend.disabled = isBusy;
    }
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function summarizeResults(results) {
    if (!results?.stats) return null;

    return {
      years: results.years,
      medianFinalWealth: results.stats.final.median,
      bestCaseFinalWealth: results.stats.final.p95,
      worstCaseFinalWealth: results.stats.final.p5,
      goalProbability: results.stats.goalProbability,
      ruinProbability: results.stats.ruinProbability
    };
  }

  function summarizeBehavioralReport(behavioralReport) {
    if (!behavioralReport) return null;

    return {
      healthScore: behavioralReport.healthScore,
      savingsRate: behavioralReport.savingsRate,
      emergencyMonths: behavioralReport.emergencyMonths,
      expenseRatio: behavioralReport.expenseRatio,
      keyInsights: (behavioralReport.insights || []).slice(0, 3).map((insight) => ({
        title: insight.title,
        severity: insight.severity,
        message: insight.message
      }))
    };
  }

  function buildDashboardContext(activeScenario, overrideResults = null, overrideBaseline = null, overrideBehavioral = null) {
    return {
      selectedScenario: activeScenario,
      latestResults: summarizeResults(overrideResults || state.scenarioResults),
      baselineResults: summarizeResults(overrideBaseline || state.baselineResults),
      behavioral: summarizeBehavioralReport(overrideBehavioral || state.behavioralReport),
      sessionMemory: state.chatMemory
    };
  }

  function buildRemoteChatContext(message, chatRun = null) {
    const scenario = chatRun?.scenarioResult?.scenario || state.activeScenarioConfig || getScenario();
    const activeScenario = scenario ? { id: scenario.id, name: scenario.name } : null;

    return {
      message,
      profile: chatRun?.chatProfile || state.profile || getProfile(),
      activeScenario,
      scenarioAnalysis: chatRun
        ? ChatEngine.buildAiContext(
          chatRun.intent,
          chatRun.scenarioResults,
          chatRun.baselineResults,
          chatRun.chatProfile,
          chatRun.scenarioResult.scenario,
          chatRun.behavioralReport
        )
        : null,
      latestDashboardState: buildDashboardContext(
        activeScenario,
        chatRun?.scenarioResults || null,
        chatRun?.baselineResults || null,
        chatRun?.behavioralReport || null
      ),
      sessionMemory: state.chatMemory
    };
  }

  function updateChatMemory(message, profile) {
    if (typeof PlannerEngine === 'undefined') return;

    const patch = PlannerEngine.buildMemoryPatch(message, profile);
    state.chatMemory = PlannerEngine.mergeMemory(state.chatMemory, patch);
    renderChatMemory();
  }

  function simulateChatRun(intent, scenarioResult, profile) {
    const chatProfile = { ...profile, ...(scenarioResult.profileOverride || {}) };

    if (intent) {
      intent.assumptions = scenarioResult.assumptions || [];
    }

    const simOptions = {
      years: scenarioResult.simulationOverride?.years || scenarioResult.simulationYears || profile.years || 10,
      runs: 1000
    };

    const baselineResults = SimulationEngine.simulate(chatProfile, Scenarios.baseline, simOptions);
    const scenarioResults = SimulationEngine.simulate(chatProfile, scenarioResult.scenario, simOptions);
    const behavioralReport = BehavioralEngine.analyze(
      chatProfile, scenarioResults, baselineResults, scenarioResult.scenario
    );

    return {
      intent,
      scenarioResult,
      chatProfile,
      baselineResults,
      scenarioResults,
      behavioralReport
    };
  }

  function commitChatRun(chatRun) {
    state.baselineResults = chatRun.baselineResults;
    state.scenarioResults = chatRun.scenarioResults;
    state.behavioralReport = chatRun.behavioralReport;
    state.profile = chatRun.chatProfile;
    state.activeScenarioConfig = chatRun.scenarioResult.scenario;

    renderResults(
      chatRun.scenarioResults,
      chatRun.baselineResults,
      chatRun.chatProfile,
      chatRun.scenarioResult.scenario,
      chatRun.behavioralReport
    );
  }

  function applyDashboardControl(control) {
    if (control.scenarioSelection) {
      selectScenario(control.scenarioSelection);
    }

    control.updates.forEach((update) => {
      switch (update.field) {
        case 'salary':
          if (DOM.salary) DOM.salary.value = formatCurrencyInput(Math.round(update.value));
          break;
        case 'monthlyExpenses':
          if (DOM.expenses) DOM.expenses.value = formatCurrencyInput(Math.round(update.value));
          break;
        case 'savings':
          if (DOM.savings) DOM.savings.value = formatCurrencyInput(Math.round(update.value));
          break;
        case 'goalAmount':
          if (DOM.goal) DOM.goal.value = formatCurrencyInput(Math.round(update.value));
          break;
        case 'taxRatePercent':
          if (DOM.taxRate) DOM.taxRate.value = update.value;
          break;
        case 'customExpenseInflation':
          if (DOM.customExpenseInflation) DOM.customExpenseInflation.value = update.value;
          break;
        case 'customReturnMean':
          if (DOM.customReturnMean) DOM.customReturnMean.value = update.value;
          break;
        case 'customReturnStd':
          if (DOM.customReturnStd) DOM.customReturnStd.value = update.value;
          break;
        default:
          break;
      }
    });

    updateHealthIndicators();
    if (state.selectedScenario === 'buy_house') updateHouseEmiPreview();
  }

  function buildControlIntent(control, message) {
    return {
      intent: 'dashboard_control',
      matched: true,
      originalQuery: message,
      params: { updates: control.updates },
      assumptions: control.updates.map((update) => update.label)
    };
  }

  function runChatScenario(intent) {
    const profile = getProfile();
    const scenarioResult = ChatEngine.buildScenarioFromIntent(intent, profile);
    return simulateChatRun(intent, scenarioResult, profile);
  }

  async function resolveMatchedChatResponse(message, chatRun) {
    const localResponse = ChatEngine.generateChatResponse(
      chatRun.intent,
      chatRun.scenarioResults,
      chatRun.baselineResults,
      chatRun.chatProfile,
      chatRun.scenarioResult.scenario,
      chatRun.behavioralReport
    );

    if (typeof ChatApi === 'undefined' || !ChatApi.canUseRemote()) {
      return localResponse;
    }

    try {
      return await ChatApi.generateReply(buildRemoteChatContext(message, chatRun));
    } catch (err) {
      console.error('Live AI chat error:', err);
      return localResponse;
    }
  }

  function buildOpenChatLocalContext() {
    const profile = state.profile || getProfile();
    const scenario = state.activeScenarioConfig || getScenario();
    const baselineResults = state.baselineResults || SimulationEngine.simulate(profile, Scenarios.baseline, { years: profile.years, runs: 800 });
    const scenarioResults = state.scenarioResults || (
      scenario.id === 'baseline'
        ? baselineResults
        : SimulationEngine.simulate(profile, scenario, { years: profile.years, runs: 800 })
    );
    const behavioralReport = state.behavioralReport || BehavioralEngine.analyze(
      profile,
      scenarioResults,
      baselineResults,
      scenario
    );

    return {
      profile,
      scenario,
      results: scenarioResults,
      baselineResults,
      behavioralReport,
      memory: state.chatMemory
    };
  }

  async function resolveOpenChatResponse(message) {
    if (typeof ChatApi !== 'undefined' && ChatApi.canUseRemote()) {
      return ChatApi.generateReply(buildRemoteChatContext(message));
    }

    return ChatEngine.generateGeneralResponse(message, buildOpenChatLocalContext());
  }

  async function handleChatSend() {
    const message = DOM.chatInput.value.trim();
    if (!message || state.isRunning || state.chatBusy) return;

    addChatMessage(message, 'user');
    DOM.chatInput.value = '';
    setChatBusy(true);

    const typingId = addTypingIndicator();

    try {
      await wait(350);

      const profile = getProfile();
      updateChatMemory(message, profile);

      const plannerControl = typeof PlannerEngine !== 'undefined'
        ? PlannerEngine.detectDashboardControl(message)
        : { matched: false };
      const lifePlan = typeof PlannerEngine !== 'undefined'
        ? PlannerEngine.detectLifePlan(message, profile)
        : { matched: false };
      const goalSeek = typeof PlannerEngine !== 'undefined'
        ? PlannerEngine.detectGoalSeek(message, profile)
        : { matched: false };
      const intent = ChatEngine.detectIntent(message);
      let responseHtml;

      // Check for scenario cloning intents
      const isCloneIntent = intent.intent.startsWith('clone_modify_');

      if (plannerControl.matched) {
        applyDashboardControl(plannerControl);

        const controlIntent = buildControlIntent(plannerControl, message);
        const controlRun = simulateChatRun(controlIntent, {
          scenario: getScenario(),
          profileOverride: {},
          assumptions: controlIntent.assumptions
        }, getProfile());

        responseHtml = PlannerEngine.generateDashboardControlResponse(
          plannerControl,
          controlRun.scenarioResults,
          controlRun.baselineResults,
          controlRun.scenarioResult.scenario
        );

        removeTypingIndicator(typingId);
        addChatMessage(responseHtml, 'ai');
        commitChatRun(controlRun);
      } else if (lifePlan.matched) {
        const planResult = PlannerEngine.buildLifePlanScenario(lifePlan.plan, profile, state.chatMemory);
        const planIntent = {
          intent: 'ai_life_plan',
          matched: true,
          originalQuery: message,
          params: { summary: lifePlan.summary },
          assumptions: planResult.assumptions
        };
        const chatRun = simulateChatRun(planIntent, {
          scenario: planResult.scenario,
          profileOverride: lifePlan.plan.goal?.targetAmount ? { goalAmount: lifePlan.plan.goal.targetAmount } : {},
          assumptions: planResult.assumptions,
          simulationYears: planResult.simulationYears
        }, profile);

        responseHtml = PlannerEngine.buildLifePlanResponse(chatRun, state.chatMemory);

        removeTypingIndicator(typingId);
        addChatMessage(responseHtml, 'ai');
        commitChatRun(chatRun);
      } else if (goalSeek.matched) {
        const goalPlan = PlannerEngine.buildGoalPlan(goalSeek, profile, state.chatMemory);
        responseHtml = PlannerEngine.buildGoalPlanResponse(goalPlan);

        const goalProfile = { ...profile, goalAmount: goalSeek.targetAmount };
        const goalScenarioResult = {
          scenario: goalPlan.displayScenario,
          profileOverride: { goalAmount: goalSeek.targetAmount },
          assumptions: [
            `Target: ${ChatEngine.formatINRShort(goalSeek.targetAmount)}`,
            `Horizon: ${goalSeek.years} years`,
            `Risk profile: ${goalPlan.riskProfile}`,
            goalPlan.requiredExtraMonthly === null
              ? 'Target gap remains under current assumptions'
              : `Extra investing needed: Rs ${Math.round(goalPlan.requiredExtraMonthly).toLocaleString('en-IN')}/month`
          ]
        };
        const goalChatRun = {
          intent: {
            intent: 'goal_seek',
            matched: true,
            originalQuery: message,
            params: {
              targetAmount: goalSeek.targetAmount,
              years: goalSeek.years,
              targetAge: goalSeek.targetAge || null
            },
            assumptions: goalScenarioResult.assumptions
          },
          scenarioResult: goalScenarioResult,
          chatProfile: goalProfile,
          baselineResults: goalPlan.baselineResults,
          scenarioResults: goalPlan.targetResults,
          behavioralReport: BehavioralEngine.analyze(
            goalProfile,
            goalPlan.targetResults,
            goalPlan.baselineResults,
            goalPlan.displayScenario
          )
        };

        removeTypingIndicator(typingId);
        addChatMessage(responseHtml, 'ai');
        commitChatRun(goalChatRun);
      } else if (isCloneIntent) {
        // Clone current scenario with modifications
        const activeScenario = state.activeScenarioConfig || (state.scenarioResults?.scenario
          ? Scenarios[state.scenarioResults.scenario] || Scenarios.baseline
          : Scenarios[state.selectedScenario] || Scenarios.baseline);
        const cloneResult = ChatEngine.buildClonedScenario(intent, getProfile(), activeScenario);
        const chatRun = simulateChatRun(intent, cloneResult, getProfile());

        responseHtml = await resolveMatchedChatResponse(message, chatRun);

        removeTypingIndicator(typingId);
        addChatMessage(responseHtml, 'ai');
        commitChatRun(chatRun);
      } else if (intent.matched) {
        const chatRun = runChatScenario(intent);
        responseHtml = await resolveMatchedChatResponse(message, chatRun);

        removeTypingIndicator(typingId);
        addChatMessage(responseHtml, 'ai');
        commitChatRun(chatRun);
      } else {
        responseHtml = await resolveOpenChatResponse(message);
        removeTypingIndicator(typingId);
        addChatMessage(responseHtml, 'ai');
      }
    } catch (err) {
      console.error('Chat error:', err);
      removeTypingIndicator(typingId);
      addChatMessage(`<p>${escapeHtml(err.message || 'An error occurred while generating the chat response.')}</p>`, 'ai');
    } finally {
      removeTypingIndicator(typingId);
      setChatBusy(false);
      renderSuggestedPrompts();
      updateChatStatus();
    }
  }

  function addChatMessage(content, type) {
    const div = document.createElement('div');
    div.className = `chat-message chat-message--${type}`;

    const avatar = type === 'ai' ? 'AI' : 'You';
    div.innerHTML = `
      <div class="chat-message__avatar">${avatar}</div>
      <div class="chat-message__bubble">${type === 'user' ? `<p>${escapeHtml(content)}</p>` : content}</div>
    `;

    DOM.chatMessages.appendChild(div);
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
  }

  function addTypingIndicator() {
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.className = 'chat-message chat-message--ai';
    div.id = id;
    div.innerHTML = `
      <div class="chat-message__avatar">AI</div>
      <div class="chat-message__bubble">
        <div class="typing-indicator">
          <div class="typing-indicator__dot"></div>
          <div class="typing-indicator__dot"></div>
          <div class="typing-indicator__dot"></div>
        </div>
      </div>
    `;
    DOM.chatMessages.appendChild(div);
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
    return id;
  }

  function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // --- Initialize on DOM ready ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { runSimulation, selectScenario, toggleChat };
})();

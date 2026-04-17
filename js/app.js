/**
 * App Controller — AI Financial Digital Twin
 * Wires DOM events, manages state, orchestrates simulation → behavioral → render → narrative → chat
 */

const App = (() => {
  // --- State ---
  let state = {
    profile: null,
    selectedScenario: 'baseline',
    baselineResults: null,
    scenarioResults: null,
    behavioralReport: null,
    isRunning: false,
    chatOpen: false
  };

  // --- DOM References ---
  const DOM = {};

  function init() {
    cacheDOMRefs();
    bindEvents();
    selectScenario('baseline');
    initChat();
    updateHealthIndicators();
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

    // Chat events
    DOM.chatFab.addEventListener('click', toggleChat);
    DOM.chatClose.addEventListener('click', closeChat);
    DOM.chatSend.addEventListener('click', handleChatSend);
    DOM.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleChatSend();
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

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
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

    if (scenarioId === 'custom') {
      scenario.returnMean = (parseFloat(DOM.customReturnMean?.value) || 10) / 100;
      scenario.returnStd = (parseFloat(DOM.customReturnStd?.value) || 18) / 100;
      scenario.incomeGrowthMean = (parseFloat(DOM.customIncomeGrowth?.value) || 6) / 100;
      scenario.expenseInflationMean = (parseFloat(DOM.customExpenseInflation?.value) || 5) / 100;
    }

    return scenario;
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
    state.isRunning = true;

    DOM.runBtn.classList.add('loading');
    DOM.runBtn.disabled = true;

    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          state.baselineResults = SimulationEngine.simulate(profile, baseline, { years: 10, runs: 1000 });

          if (scenario.id === 'baseline') {
            state.scenarioResults = state.baselineResults;
          } else {
            state.scenarioResults = SimulationEngine.simulate(profile, scenario, { years: 10, runs: 1000 });
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

    if (DOM.compScenarioTitle) {
      DOM.compScenarioTitle.innerHTML = `<span class="dot"></span> ${scenario.name}`;
    }
  }

  // ===================================================
  // Chat System
  // ===================================================
  function initChat() {
    renderSuggestedPrompts();
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
    const prompts = ChatEngine.getRandomPrompts(4);
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

  function handleChatSend() {
    const message = DOM.chatInput.value.trim();
    if (!message || state.isRunning) return;

    // Add user message
    addChatMessage(message, 'user');
    DOM.chatInput.value = '';

    // Show typing indicator
    const typingId = addTypingIndicator();

    // Detect intent
    const intent = ChatEngine.detectIntent(message);

    if (!intent.matched) {
      // Unknown intent
      setTimeout(() => {
        removeTypingIndicator(typingId);
        addChatMessage(
          `<p>I couldn't parse a specific financial scenario from your question. Try asking something like:</p>
          <ul>
            <li>"What if I get a 30% raise?"</li>
            <li>"What if I start a business?"</li>
            <li>"What if my expenses become ₹50,000/month?"</li>
            <li>"Can I save ₹1 crore in 10 years?"</li>
          </ul>
          <p>I work best with clear financial what-if scenarios.</p>`,
          'ai'
        );
        renderSuggestedPrompts();
      }, 600);
      return;
    }

    // Build scenario from intent
    const profile = getProfile();
    const scenarioResult = ChatEngine.buildScenarioFromIntent(intent, profile);
    const chatProfile = { ...profile, ...scenarioResult.profileOverride };

    // Add assumptions to intent for response generation
    intent.assumptions = scenarioResult.assumptions;

    // Run simulation
    setTimeout(() => {
      try {
        const simOptions = {
          years: scenarioResult.simulationOverride?.years || 10,
          runs: 1000
        };

        const baselineResults = SimulationEngine.simulate(chatProfile, Scenarios.baseline, simOptions);
        const scenarioResults = SimulationEngine.simulate(chatProfile, scenarioResult.scenario, simOptions);

        // Run behavioral analysis
        const behavioralReport = BehavioralEngine.analyze(
          chatProfile, scenarioResults, baselineResults, scenarioResult.scenario
        );

        // Generate chat response
        const responseHtml = ChatEngine.generateChatResponse(
          intent, scenarioResults, baselineResults, chatProfile, scenarioResult.scenario, behavioralReport
        );

        removeTypingIndicator(typingId);
        addChatMessage(responseHtml, 'ai');

        // Also update main UI if user wants
        state.baselineResults = baselineResults;
        state.scenarioResults = scenarioResults;
        state.behavioralReport = behavioralReport;
        state.profile = chatProfile;

        renderResults(scenarioResults, baselineResults, chatProfile, scenarioResult.scenario, behavioralReport);
      } catch (err) {
        console.error('Chat simulation error:', err);
        removeTypingIndicator(typingId);
        addChatMessage(`<p>An error occurred during simulation: ${err.message}</p>`, 'ai');
      }

      renderSuggestedPrompts();
    }, 800);
  }

  function addChatMessage(content, type) {
    const div = document.createElement('div');
    div.className = `chat-message chat-message--${type}`;

    const avatar = type === 'ai' ? '🧠' : '👤';
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
      <div class="chat-message__avatar">🧠</div>
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

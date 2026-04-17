/**
 * Narrative Generator — Enhanced Decision Intelligence Layer
 * Generates structured 5-section analysis from simulation output
 * Sections: Scenario Interpretation, Outcome Summary, Risk Analysis, Behavioral Insight, Decision Guidance
 */

const NarrativeGenerator = (() => {
  function formatINR(value) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e7) {
      const cr = abs / 1e7;
      return sign + '₹' + cr.toFixed(cr >= 10 ? 0 : 1) + ' crore';
    }
    if (abs >= 1e5) {
      const lakh = abs / 1e5;
      return sign + '₹' + lakh.toFixed(lakh >= 10 ? 0 : 1) + ' lakh';
    }
    return sign + '₹' + abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function formatPercent(value) {
    return value.toFixed(1) + '%';
  }

  /**
   * Generate narrative from simulation output with behavioral insights
   */
  async function generate(results, baselineResults, profile, scenario, behavioralReport) {
    const html = generateStructured(results, baselineResults, profile, scenario, behavioralReport);
    return { html, source: 'template' };
  }

  function generateStructured(results, baselineResults, profile, scenario, behavioralReport) {
    const s = results.stats;
    const b = baselineResults.stats;
    const years = results.years;

    let html = '';

    // Section 1: Scenario Interpretation
    html += `<div class="narrative-section">`;
    html += `<h3><span class="section-icon">🔍</span> Scenario Interpretation</h3>`;
    html += generateScenarioInterpretation(s, b, years, profile, scenario);
    html += `</div>`;

    // Section 2: Outcome Summary
    html += `<div class="narrative-section">`;
    html += `<h3><span class="section-icon">📊</span> Outcome Summary</h3>`;
    html += generateOutcomeSummary(s, b, years, profile, scenario);
    html += `</div>`;

    // Section 3: Risk Analysis
    html += `<div class="narrative-section">`;
    html += `<h3><span class="section-icon">⚠️</span> Risk Analysis</h3>`;
    html += generateRiskAnalysis(s, b, profile, scenario);
    html += `</div>`;

    // Section 4: Behavioral Insight
    html += `<div class="narrative-section">`;
    html += `<h3><span class="section-icon">🧠</span> Behavioral Insight</h3>`;
    html += generateBehavioralInsight(behavioralReport, profile);
    html += `</div>`;

    // Section 5: Decision Guidance
    html += `<div class="narrative-section narrative-section--decision">`;
    html += `<h3><span class="section-icon">✅</span> Decision Guidance</h3>`;
    html += generateDecisionGuidance(s, b, profile, scenario, behavioralReport);
    html += `</div>`;

    return html;
  }

  // --- Section 1: Scenario Interpretation ---
  function generateScenarioInterpretation(s, b, years, profile, scenario) {
    let html = '';
    const descriptions = {
      baseline: `Analyzing your <strong>current financial trajectory</strong> over ${years} years with no major changes. This serves as your reference point for all other scenarios.`,
      quit_job: `Analyzing the impact of <strong>quitting your job to start a business</strong>. This models a bimodal outcome — you either succeed significantly or struggle — with zero income in year 1 and high income volatility thereafter.`,
      aggressive: `Analyzing <strong>aggressive investment allocation</strong> with higher equity exposure. Expected returns increase to 14%/year but volatility jumps to 25%/year.`,
      buy_house: `Analyzing the financial impact of <strong>buying a house</strong> with EMI commitment (40% of monthly salary). This trades liquid investment capacity for property equity buildup.`,
      career_switch: `Analyzing a <strong>career transition</strong> — accepting a 20-40% salary cut initially in exchange for higher growth potential (10%+ annually) in a new field.`,
      custom: `Analyzing your <strong>custom scenario</strong> with user-defined parameters for returns, volatility, income growth, and expense inflation.`
    };

    html += `<p>${descriptions[scenario.id] || descriptions.baseline}</p>`;

    // State assumptions
    html += `<div class="narrative-assumptions">`;
    html += `<strong>Key Assumptions:</strong>`;
    html += `<ul>`;
    html += `<li>Income growth: ~${((scenario.incomeGrowthMean || 0.06) * 100).toFixed(0)}%/year</li>`;
    html += `<li>Expense inflation: ~${((scenario.expenseInflationMean || 0.05) * 100).toFixed(0)}%/year</li>`;
    html += `<li>Investment returns: ~${((scenario.returnMean || 0.10) * 100).toFixed(0)}%/year (±${((scenario.returnStd || 0.18) * 100).toFixed(0)}% volatility)</li>`;
    html += `<li>Simulation: 1,000 Monte Carlo paths over ${years} years</li>`;
    html += `</ul></div>`;

    return html;
  }

  // --- Section 2: Outcome Summary ---
  function generateOutcomeSummary(s, b, years, profile, scenario) {
    let html = '';
    const medianDiff = s.final.median - b.final.median;

    // Outcome table
    html += `<div class="narrative-outcomes-grid">`;
    html += `<div class="narrative-outcome narrative-outcome--gold"><div class="narrative-outcome__label">Median (P50)</div><div class="narrative-outcome__value">${formatINR(s.final.median)}</div><div class="narrative-outcome__desc">Most likely outcome</div></div>`;
    html += `<div class="narrative-outcome narrative-outcome--teal"><div class="narrative-outcome__label">Best Case (P95)</div><div class="narrative-outcome__value">${formatINR(s.final.p95)}</div><div class="narrative-outcome__desc">Top 5% of simulations</div></div>`;
    html += `<div class="narrative-outcome narrative-outcome--coral"><div class="narrative-outcome__label">Worst Case (P5)</div><div class="narrative-outcome__value">${formatINR(s.final.p5)}</div><div class="narrative-outcome__desc">Bottom 5% of simulations</div></div>`;
    html += `<div class="narrative-outcome narrative-outcome--blue"><div class="narrative-outcome__label">Goal Probability</div><div class="narrative-outcome__value">${formatPercent(s.goalProbability)}</div><div class="narrative-outcome__desc">${formatINR(s.goalAmount)} target</div></div>`;
    html += `</div>`;

    // Comparison sentence
    if (scenario.id !== 'baseline' && Math.abs(medianDiff) > 1000) {
      html += `<p class="narrative-comparison">`;
      if (medianDiff > 0) {
        html += `This scenario projects <span class="highlight-teal">${formatINR(medianDiff)} more</span> than staying at baseline (${formatINR(b.final.median)}).`;
      } else {
        html += `This scenario projects <span class="highlight-coral">${formatINR(Math.abs(medianDiff))} less</span> than staying at baseline (${formatINR(b.final.median)}).`;
      }

      // Goal probability comparison
      const goalDiff = s.goalProbability - b.goalProbability;
      if (Math.abs(goalDiff) > 2) {
        html += ` Goal probability ${goalDiff > 0 ? 'improves' : 'drops'} by <span class="${goalDiff > 0 ? 'highlight-teal' : 'highlight-coral'}">${Math.abs(goalDiff).toFixed(1)}pp</span>.`;
      }
      html += `</p>`;
    }

    return html;
  }

  // --- Section 3: Risk Analysis ---
  function generateRiskAnalysis(s, b, profile, scenario) {
    let html = '';
    const risks = [];

    if (s.ruinProbability > 0) {
      const severity = s.ruinProbability > 30 ? 'coral' : s.ruinProbability > 10 ? 'gold' : 'teal';
      risks.push({
        text: `<span class="highlight-${severity}">${formatPercent(s.ruinProbability)}</span> chance of savings hitting zero at some point. ${s.ruinWithin3Prob > 0 ? `(${formatPercent(s.ruinWithin3Prob)} within first 3 years)` : ''}`,
        severity: s.ruinProbability
      });
    }

    if (s.final.p5 < 0) {
      risks.push({
        text: `In the worst 5% of outcomes, you end up in <span class="highlight-coral">debt</span> at ${formatINR(s.final.p5)}.`,
        severity: 30
      });
    } else if (s.final.p5 < profile.savings) {
      risks.push({
        text: `Worst 5% of outcomes leave you with <em>less</em> than current savings: <span class="highlight-coral">${formatINR(s.final.p5)}</span> vs ${formatINR(profile.savings)} today.`,
        severity: 15
      });
    }

    const scenarioRange = s.final.p95 - s.final.p5;
    const baselineRange = b.final.p95 - b.final.p5;
    if (scenario.id !== 'baseline' && scenarioRange > baselineRange * 1.3) {
      risks.push({
        text: `Outcome uncertainty is <strong>${(scenarioRange / baselineRange).toFixed(1)}x wider</strong> than baseline — much higher unpredictability.`,
        severity: 20
      });
    }

    // Scenario-specific risks
    if (scenario.id === 'quit_job') {
      const runway = profile.savings / profile.monthlyExpenses;
      risks.push({ text: `Runway: <strong>${Math.floor(runway)} months</strong> with zero income. ${runway < 12 ? '<span class="highlight-coral">Below recommended 12-18 months.</span>' : 'Provides moderate buffer.'}`, severity: runway < 12 ? 40 : 10 });
      risks.push({ text: 'Business income is bimodal — you either grow significantly or struggle. The first 2 years are the highest-risk period.', severity: 25 });
    } else if (scenario.id === 'buy_house') {
      risks.push({ text: 'Large EMI commitment significantly reduces monthly investable surplus.', severity: 20 });
      risks.push({ text: 'Property is illiquid — cannot easily convert to cash in emergencies.', severity: 15 });
    } else if (scenario.id === 'aggressive') {
      risks.push({ text: 'Higher equity allocation means <strong>30-40% loss possible in a single bad year</strong>.', severity: 25 });
    } else if (scenario.id === 'career_switch') {
      risks.push({ text: 'Salary cut in years 1-2 reduces savings rate at a critical compounding period.', severity: 20 });
    }

    if (risks.length === 0) {
      html += `<p>This scenario carries <span class="highlight-teal">relatively low risk</span>. No major red flags detected.</p>`;
    } else {
      risks.sort((a, b) => b.severity - a.severity);
      for (const risk of risks) {
        html += `<p class="risk-item">• ${risk.text}</p>`;
      }
    }

    const riskScore = computeRiskScore(s);
    const riskInfo = getRiskLabel(riskScore);
    html += `<p class="risk-score-line">Overall Risk Score: <strong style="color:${riskInfo.color}">${riskScore}/100 — ${riskInfo.label}</strong></p>`;

    return html;
  }

  // --- Section 4: Behavioral Insight ---
  function generateBehavioralInsight(behavioralReport, profile) {
    let html = '';

    if (!behavioralReport || !behavioralReport.insights || behavioralReport.insights.length === 0) {
      html += `<p>No significant behavioral patterns detected. Your financial profile appears well-balanced.</p>`;
      return html;
    }

    const healthInfo = BehavioralEngine.getHealthLabel(behavioralReport.healthScore);
    html += `<div class="behavioral-health-badge">`;
    html += `<span class="behavioral-health-badge__icon">${healthInfo.icon}</span>`;
    html += `<span class="behavioral-health-badge__label">Financial Health: </span>`;
    html += `<span class="behavioral-health-badge__score" style="color:${healthInfo.color}">${behavioralReport.healthScore}/100 — ${healthInfo.label}</span>`;
    html += `</div>`;

    // Show key metrics
    html += `<div class="behavioral-metrics">`;
    html += `<div class="behavioral-metric"><span class="behavioral-metric__label">Savings Rate</span><span class="behavioral-metric__value" style="color:${behavioralReport.savingsRate >= 20 ? '#00d4aa' : behavioralReport.savingsRate >= 10 ? '#ffd93d' : '#ff6b6b'}">${behavioralReport.savingsRate.toFixed(1)}%</span></div>`;
    html += `<div class="behavioral-metric"><span class="behavioral-metric__label">Emergency Fund</span><span class="behavioral-metric__value" style="color:${behavioralReport.emergencyMonths >= 6 ? '#00d4aa' : behavioralReport.emergencyMonths >= 3 ? '#ffd93d' : '#ff6b6b'}">${behavioralReport.emergencyMonths.toFixed(1)} mo</span></div>`;
    html += `<div class="behavioral-metric"><span class="behavioral-metric__label">Expense Ratio</span><span class="behavioral-metric__value" style="color:${behavioralReport.expenseRatio <= 50 ? '#00d4aa' : behavioralReport.expenseRatio <= 70 ? '#ffd93d' : '#ff6b6b'}">${behavioralReport.expenseRatio.toFixed(0)}%</span></div>`;
    html += `</div>`;

    // Insight cards (show warnings/critical only)
    const actionable = behavioralReport.insights.filter(i => i.severity !== 'info' || i.id === 'good_savings');
    for (const insight of actionable.slice(0, 4)) {
      html += `<div class="behavioral-insight-card behavioral-insight-card--${insight.severity}">`;
      html += `<div class="behavioral-insight-card__header">${insight.icon} <strong>${insight.title}</strong> <span class="behavioral-insight-card__metric">${insight.metric}</span></div>`;
      html += `<p>${insight.message}</p>`;
      if (insight.recommendation) {
        html += `<p class="behavioral-insight-card__rec">→ ${insight.recommendation}</p>`;
      }
      html += `</div>`;
    }

    return html;
  }

  // --- Section 5: Decision Guidance ---
  function generateDecisionGuidance(s, b, profile, scenario, behavioralReport) {
    let html = '';

    if (scenario.id === 'baseline') {
      html += `<p>This is your <strong>reference trajectory</strong>.</p>`;
      const verdict = s.final.median > profile.savings * 3 ? 'strong' :
                      s.final.median > profile.savings * 1.5 ? 'moderate' : 'tight';

      const verdictClass = verdict === 'strong' ? 'safe' : verdict === 'moderate' ? 'moderate' : 'risky';
      html += `<div class="decision-verdict decision-verdict--${verdictClass}">`;
      if (verdict === 'strong') {
        html += `<strong>📈 On track.</strong> Your current trajectory projects solid growth. Continue current habits and optimize with scenario exploration.`;
      } else if (verdict === 'moderate') {
        html += `<strong>➡️ Moderate trajectory.</strong> Growth is positive but could be stronger. Consider increasing savings rate or investment returns.`;
      } else {
        html += `<strong>⚠️ Tight trajectory.</strong> Projected growth is limited. Prioritize increasing income or significantly reducing expenses.`;
      }
      html += `</div>`;
      return html;
    }

    const medianDiff = s.final.median - b.final.median;
    const riskScore = computeRiskScore(s);
    const monthsRunway = profile.savings / profile.monthlyExpenses;

    if (medianDiff > 0 && riskScore < 20) {
      html += `<div class="decision-verdict decision-verdict--safe">`;
      html += `<strong>✅ Safe decision.</strong> Positive projected outcome (+${formatINR(medianDiff)}) with low risk (${riskScore}/100). Proceed with a 6-month emergency fund in place.`;
      html += `</div>`;
    } else if (s.final.p95 > b.final.p95 && riskScore > 30) {
      html += `<div class="decision-verdict decision-verdict--${monthsRunway >= 12 ? 'moderate' : 'risky'}">`;
      html += `<strong>${monthsRunway >= 12 ? '⚡ Calculated risk' : '🚫 Insufficient runway'}.</strong> `;
      html += `High upside potential (P95: ${formatINR(s.final.p95)}) but risk score is ${riskScore}/100. `;
      html += `You currently have ${Math.floor(monthsRunway)} months runway. ${monthsRunway < 12 ? '<span class="highlight-coral">Recommended: 12-18 months.</span>' : 'Adequate buffer available.'}`;
      html += `</div>`;
    } else if (medianDiff < 0 && riskScore > s.ruinProbability) {
      html += `<div class="decision-verdict decision-verdict--risky">`;
      html += `<strong>🚫 Financially risky.</strong> Projects ${formatINR(Math.abs(medianDiff))} less than baseline at higher risk. Weigh non-financial benefits carefully against the ~${formatINR(Math.abs(medianDiff))} opportunity cost.`;
      html += `</div>`;
    } else {
      html += `<div class="decision-verdict decision-verdict--moderate">`;
      html += `<strong>➡️ Trade-off decision.</strong> Outcomes roughly comparable to baseline. Let non-financial factors (lifestyle, passion, growth) guide your choice.`;
      html += `</div>`;
    }

    return html;
  }

  return { generate, formatINR };
})();

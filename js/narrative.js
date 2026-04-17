/**
 * Narrative Generator — Enhanced Decision Intelligence Layer
 * Generates structured 6-section analysis from simulation output
 * Sections: Scenario Interpretation, Outcome Summary, Risk Analysis, Behavioral Insight, Decision Guidance, Earning Strategies
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

    // Section 5: Decision Guidance (expanded)
    html += `<div class="narrative-section narrative-section--decision">`;
    html += `<h3><span class="section-icon">✅</span> Decision Guidance</h3>`;
    html += generateDecisionGuidance(s, b, profile, scenario, behavioralReport);
    html += `</div>`;

    // Section 6: Earning Strategies (NEW)
    html += `<div class="narrative-section narrative-section--earning">`;
    html += `<h3><span class="section-icon">💰</span> How to Reach Your Goal</h3>`;
    html += generateEarningStrategies(s, b, profile, scenario, years);
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

  // --- Section 5: Decision Guidance (EXPANDED) ---
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

      // Expanded baseline guidance
      html += generateBaselineActionPlan(s, profile, behavioralReport);
      return html;
    }

    const medianDiff = s.final.median - b.final.median;
    const riskScore = computeRiskScore(s);
    const monthsRunway = profile.monthlyExpenses > 0 ? profile.savings / profile.monthlyExpenses : 0;

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

    // Expanded action plan for every scenario
    html += generateScenarioActionPlan(s, b, profile, scenario, riskScore, monthsRunway, behavioralReport);

    return html;
  }

  // --- Baseline Action Plan ---
  function generateBaselineActionPlan(s, profile, behavioralReport) {
    let html = '';
    const annualExpenses = profile.monthlyExpenses * 12;
    const monthlySalary = profile.salary / 12;
    const monthlySurplus = monthlySalary - profile.monthlyExpenses;
    const savingsRate = profile.salary > 0 ? ((profile.salary - annualExpenses) / profile.salary) * 100 : 0;

    html += `<div class="action-plan">`;
    html += `<h4>📋 Recommended Action Plan</h4>`;

    html += `<div class="action-plan__grid">`;

    // Immediate actions
    html += `<div class="action-plan__card action-plan__card--immediate">`;
    html += `<div class="action-plan__card-header">🔥 Immediate (This Month)</div>`;
    html += `<ul>`;
    if (profile.monthlyExpenses > 0 && profile.savings / profile.monthlyExpenses < 6) {
      const emergencyTarget = profile.monthlyExpenses * 6;
      const emergencyGap = Math.max(0, emergencyTarget - profile.savings);
      html += `<li>Build emergency fund to <strong>${formatINR(emergencyTarget)}</strong> (${formatINR(emergencyGap)} more needed). Keep this in a liquid savings account or liquid fund.</li>`;
    }
    if (monthlySurplus > 0) {
      html += `<li>Automate <strong>${formatINR(Math.round(monthlySurplus * 0.3))}/month</strong> into a SIP (30% of surplus). Start with a diversified index fund like Nifty 50 or Nifty Next 50.</li>`;
    }
    if (savingsRate < 20 && savingsRate >= 0) {
      const targetSaving = Math.round(monthlySalary * 0.2);
      html += `<li>Your savings rate is ${savingsRate.toFixed(0)}%. Target <strong>20% minimum</strong> — that's approximately <strong>${formatINR(targetSaving)}/month</strong> set aside.</li>`;
    }
    html += `</ul></div>`;

    // Short-term
    html += `<div class="action-plan__card action-plan__card--short">`;
    html += `<div class="action-plan__card-header">📅 Short-Term (3-6 Months)</div>`;
    html += `<ul>`;
    html += `<li>Review and optimize your expenses — identify 2-3 non-essential costs to cut, potentially saving <strong>${formatINR(Math.round(profile.monthlyExpenses * 0.1))}/month</strong>.</li>`;
    if (profile.salary > 0) {
      html += `<li>Explore a salary revision or performance bonus. Even a <strong>10% raise</strong> (${formatINR(Math.round(profile.salary * 0.1))}/year more) compounds massively over 10 years.</li>`;
    }
    html += `<li>Set up a proper asset allocation: 60-70% equity for growth if you're under 40, 40-50% if older. Rebalance quarterly.</li>`;
    html += `</ul></div>`;

    // Long-term
    html += `<div class="action-plan__card action-plan__card--long">`;
    html += `<div class="action-plan__card-header">🎯 Long-Term (1-3 Years)</div>`;
    html += `<ul>`;
    html += `<li>Invest in skill development to boost income trajectory. The biggest lever for wealth building in your 20s-30s is <strong>income growth</strong>, not just saving.</li>`;
    if (s.goalProbability < 50 && s.goalAmount > 0) {
      html += `<li>Your goal probability is only ${s.goalProbability.toFixed(0)}%. Consider either extending your timeline, reducing the target, or aggressively increasing your income.</li>`;
    }
    html += `<li>Consider starting a <strong>side income stream</strong> — freelancing, consulting, or a small project — that could add ${formatINR(Math.round(profile.salary * 0.15))}/year to your earnings.</li>`;
    html += `<li>Review your insurance coverage — term life insurance and health insurance protect your wealth from catastrophic events.</li>`;
    html += `</ul></div>`;

    html += `</div></div>`;

    return html;
  }

  // --- Scenario-specific Action Plan ---
  function generateScenarioActionPlan(s, b, profile, scenario, riskScore, monthsRunway, behavioralReport) {
    let html = '';
    html += `<div class="action-plan">`;
    html += `<h4>📋 Detailed Action Plan for "${scenario.name}"</h4>`;

    html += `<div class="action-plan__grid">`;

    if (scenario.id === 'quit_job') {
      html += `<div class="action-plan__card action-plan__card--immediate">`;
      html += `<div class="action-plan__card-header">🔥 Before You Quit</div>`;
      html += `<ul>`;
      html += `<li>Save at least <strong>12-18 months of expenses</strong> (${formatINR(profile.monthlyExpenses * 15)}) as your business runway. You currently have ${Math.floor(monthsRunway)} months.</li>`;
      if (monthsRunway < 12) {
        const needed = Math.max(0, profile.monthlyExpenses * 15 - profile.savings);
        html += `<li class="highlight-coral">⚠️ You need <strong>${formatINR(needed)} more</strong> in savings before quitting. This could take ~${Math.ceil(needed / (profile.salary / 12 - profile.monthlyExpenses))} more months of saving.</li>`;
      }
      html += `<li>Validate your business idea first — get 2-3 paying customers or signed LOIs while still employed. Don't quit into a vacuum.</li>`;
      html += `<li>Reduce personal expenses by 20-30% before quitting. Every rupee saved extends your runway by days.</li>`;
      html += `</ul></div>`;

      html += `<div class="action-plan__card action-plan__card--short">`;
      html += `<div class="action-plan__card-header">📅 First 6 Months of Business</div>`;
      html += `<ul>`;
      html += `<li>Set a <strong>break-even deadline</strong> — most small businesses should aim to cover expenses within 6-9 months. If not, reassess your business model.</li>`;
      html += `<li>Track every rupee — use a simple spreadsheet to monitor your burn rate weekly. Your business needs to reach <strong>${formatINR(profile.monthlyExpenses)}/month</strong> revenue to match current expenses.</li>`;
      html += `<li>Don't invest more than <strong>20% of your total savings</strong> (${formatINR(profile.savings * 0.2)}) into the business initially. Bootstrap aggressively.</li>`;
      html += `<li>Keep applying for grants, startup accelerators, and incubator programs — they provide capital without equity dilution.</li>`;
      html += `</ul></div>`;

      html += `<div class="action-plan__card action-plan__card--long">`;
      html += `<div class="action-plan__card-header">🎯 Year 2-3: Scale or Pivot</div>`;
      html += `<ul>`;
      html += `<li>By year 2, your business should be generating at least <strong>${formatINR(profile.salary * 0.7)}/year</strong> (70% of your old salary). If not, seriously consider pivoting or returning to employment.</li>`;
      html += `<li>Reinvest 30-40% of business profits back into growth. The rest should go to rebuilding your personal savings.</li>`;
      html += `<li>Build systems to make the business less dependent on your time — hire, automate, and create processes.</li>`;
      html += `</ul></div>`;
    } else if (scenario.id === 'buy_house') {
      html += `<div class="action-plan__card action-plan__card--immediate">`;
      html += `<div class="action-plan__card-header">🔥 Before Buying</div>`;
      html += `<ul>`;
      html += `<li>Ensure your down payment doesn't wipe out your emergency fund. Keep at least <strong>${formatINR(profile.monthlyExpenses * 6)}</strong> as a separate emergency reserve.</li>`;
      html += `<li>Get pre-approved for your loan to know your exact EMI. Shop across at least 3 lenders — even a <strong>0.25% rate difference</strong> saves lakhs over the tenure.</li>`;
      html += `<li>Budget for hidden costs: registration (5-7%), stamp duty, legal fees, furnishing — usually <strong>10-15% of property price</strong> on top.</li>`;
      html += `</ul></div>`;

      html += `<div class="action-plan__card action-plan__card--short">`;
      html += `<div class="action-plan__card-header">📅 After Purchase</div>`;
      html += `<ul>`;
      html += `<li>Continue investing even with EMI. Allocate at least <strong>10% of income</strong> (${formatINR(Math.round(profile.salary * 0.1 / 12))}/month) to SIPs alongside your home loan.</li>`;
      html += `<li>Prepay your loan aggressively in the first 5 years — even <strong>1 extra EMI per year</strong> can cut your tenure by 3-4 years and save significant interest.</li>`;
      html += `<li>Claim tax deductions: Section 80C (₹1.5L on principal), Section 24(b) (₹2L on interest for self-occupied property).</li>`;
      html += `</ul></div>`;

      html += `<div class="action-plan__card action-plan__card--long">`;
      html += `<div class="action-plan__card-header">🎯 Maximize Property Value</div>`;
      html += `<ul>`;
      html += `<li>If this is an investment property, target a rental yield of <strong>3-4%</strong> of property value. Below 2% means you're better off investing in equity.</li>`;
      html += `<li>Refinance your loan every 3-4 years if rates drop. Banks don't automatically reduce your rate.</li>`;
      html += `<li>Consider partial prepayment with annual bonuses — this is often the highest-return "investment" you can make (guaranteed savings at your loan rate).</li>`;
      html += `</ul></div>`;
    } else if (scenario.id === 'aggressive') {
      html += `<div class="action-plan__card action-plan__card--immediate">`;
      html += `<div class="action-plan__card-header">🔥 Setup Phase</div>`;
      html += `<ul>`;
      html += `<li>Do NOT go 100% equity. Keep <strong>6 months expenses</strong> in liquid/debt funds as a volatility buffer so you never panic-sell.</li>`;
      html += `<li>Start with a <strong>systematic investment plan (SIP)</strong>, not a lump sum. Deploy in 6-12 monthly installments to average out entry price.</li>`;
      html += `<li>Choose <strong>2-3 diversified funds</strong> maximum: a large-cap index fund, a mid-cap fund, and optionally a flexi-cap. Avoid chasing sector funds.</li>`;
      html += `</ul></div>`;

      html += `<div class="action-plan__card action-plan__card--short">`;
      html += `<div class="action-plan__card-header">📅 Market Downturns (When They Happen)</div>`;
      html += `<ul>`;
      html += `<li><strong>DO NOT SELL during crashes.</strong> Markets have recovered from every crash in history. A 30% crash followed by a 43% recovery = break even. Time heals.</li>`;
      html += `<li>If possible, <strong>increase your SIP by 20-30%</strong> during crashes. Buying low is the single most powerful wealth-building action.</li>`;
      html += `<li>Ignore financial media panic. Your simulation already models these crashes — your median outcome accounts for them.</li>`;
      html += `</ul></div>`;

      html += `<div class="action-plan__card action-plan__card--long">`;
      html += `<div class="action-plan__card-header">🎯 Portfolio Management</div>`;
      html += `<ul>`;
      html += `<li>Rebalance annually. If equity goes above 80% of portfolio, trim back to your target allocation.</li>`;
      html += `<li>Step-up your SIP by 10% every year. If you start at ${formatINR(10000)}/month and increase by 10% annually, you'll invest <strong>2x more</strong> by year 7.</li>`;
      html += `<li>After 5 years, consider adding international diversification (10-15% in US index funds) to reduce India-specific risk.</li>`;
      html += `</ul></div>`;
    } else if (scenario.id === 'career_switch') {
      html += `<div class="action-plan__card action-plan__card--immediate">`;
      html += `<div class="action-plan__card-header">🔥 Transition Preparation</div>`;
      html += `<ul>`;
      html += `<li>Save <strong>6-9 months runway</strong> (${formatINR(profile.monthlyExpenses * 7.5)}) before making the switch. This covers the income gap + unexpected delays.</li>`;
      html += `<li>Start upskilling <em>before</em> you leave. Complete certifications, build a portfolio, or freelance in the new field part-time.</li>`;
      html += `<li>Network aggressively in your target industry. <strong>80% of jobs are filled through referrals</strong>. Reach out to at least 20 people in the field.</li>`;
      html += `</ul></div>`;

      html += `<div class="action-plan__card action-plan__card--short">`;
      html += `<div class="action-plan__card-header">📅 First Year in New Career</div>`;
      html += `<ul>`;
      html += `<li>Accept a temporary salary cut but negotiate hard on growth: ask for <strong>salary reviews every 6 months</strong> during your first 2 years, not annually.</li>`;
      html += `<li>Reduce lifestyle expenses by 15-20% during the transition. This is temporary and protects your financial foundation.</li>`;
      html += `<li>Maintain your investment SIPs even at reduced amounts. <strong>Don't stop investing entirely</strong> — even ${formatINR(Math.round(Math.max(2000, (profile.salary / 12) * 0.1)))}/month keeps the habit alive.</li>`;
      html += `</ul></div>`;

      html += `<div class="action-plan__card action-plan__card--long">`;
      html += `<div class="action-plan__card-header">🎯 Growth Phase (Year 2-5)</div>`;
      html += `<ul>`;
      html += `<li>By year 3, you should aim to earn <strong>${formatINR(Math.round(profile.salary * 1.2))}/year</strong> or more — above your previous salary. If not on that track, reassess if this field truly rewards experience.</li>`;
      html += `<li>As income grows, aggressively increase savings rate to <strong>"catch up"</strong> on the compounding you lost during the transition.</li>`;
      html += `<li>Consider building a personal brand in your new field — writing, speaking, open-source contributions — this accelerates career growth non-linearly.</li>`;
      html += `</ul></div>`;
    } else {
      // Generic fallback for custom or other scenarios
      html += `<div class="action-plan__card action-plan__card--immediate">`;
      html += `<div class="action-plan__card-header">🔥 Priority Actions</div>`;
      html += `<ul>`;
      html += `<li>Maintain an emergency fund covering at least <strong>6 months</strong> of expenses (${formatINR(profile.monthlyExpenses * 6)}).</li>`;
      html += `<li>Ensure your monthly investment is at least <strong>20% of income</strong> (${formatINR(Math.round(profile.salary * 0.2 / 12))}/month).</li>`;
      html += `<li>Regularly review this scenario's assumptions against real market conditions and your evolving life plans.</li>`;
      html += `</ul></div>`;
    }

    html += `</div></div>`;

    return html;
  }

  // --- Section 6: Earning Strategies (NEW) ---
  function generateEarningStrategies(s, b, profile, scenario, years) {
    let html = '';

    const goalAmount = s.goalAmount || 0;
    const medianProjected = s.final.median;
    const gap = goalAmount - medianProjected;
    const monthlySalary = profile.salary / 12;
    const monthlyExpenses = profile.monthlyExpenses;
    const monthlySurplus = Math.max(0, monthlySalary - monthlyExpenses);

    // If no goal set or goal already exceeded
    if (goalAmount <= 0) {
      html += `<p>Set a <strong>10-year wealth goal</strong> above to get personalized earning and income strategy recommendations tailored to your target.</p>`;
      html += `<div class="earning-tip">`;
      html += `<p><strong>💡 General guideline:</strong> Your projected median outcome is <strong>${formatINR(medianProjected)}</strong>. If you want to aim higher, keep reading for strategies to boost your income and investment returns.</p>`;
      html += `</div>`;
    } else if (gap <= 0) {
      html += `<div class="earning-success">`;
      html += `<p>🎉 <strong>You're on track to exceed your goal!</strong> Your median projection of ${formatINR(medianProjected)} surpasses your target of ${formatINR(goalAmount)} by ${formatINR(Math.abs(gap))}.</p>`;
      html += `<p>To further strengthen your position, consider these optimization strategies:</p>`;
      html += `</div>`;
    } else {
      html += `<div class="earning-gap-analysis">`;
      html += `<p>To close the <strong>${formatINR(gap)} gap</strong> between your median projection (${formatINR(medianProjected)}) and your goal (${formatINR(goalAmount)}), here are concrete strategies:</p>`;
      html += `</div>`;
    }

    // Calculate what additional monthly investment would close the gap
    const annualReturn = (scenario.returnMean || 0.10);
    const monthlyReturn = annualReturn / 12;
    const totalMonths = years * 12;

    let requiredExtraMonthly = 0;
    if (gap > 0 && monthlyReturn > 0) {
      // Future value of annuity formula rearranged: PMT = FV / ((1+r)^n - 1) / r
      const fvFactor = (Math.pow(1 + monthlyReturn, totalMonths) - 1) / monthlyReturn;
      requiredExtraMonthly = gap / fvFactor;
    }

    html += `<div class="earning-strategies-grid">`;

    // Strategy 1: Savings & Investment
    html += `<div class="earning-strategy-card">`;
    html += `<div class="earning-strategy-card__icon">📊</div>`;
    html += `<div class="earning-strategy-card__title">Increase Monthly Investment</div>`;
    html += `<div class="earning-strategy-card__body">`;
    if (gap > 0) {
      html += `<p>Investing an additional <strong>${formatINR(Math.round(requiredExtraMonthly))}/month</strong> in a fund earning ~${(annualReturn * 100).toFixed(0)}% would close the gap over ${years} years.</p>`;
    }
    html += `<ul>`;
    html += `<li><strong>Start with step-up SIPs:</strong> Begin with what you can afford and increase by 10-15% annually. Even ${formatINR(Math.max(500, Math.round(monthlySurplus * 0.1)))}/month growing at 10%/year becomes significant.</li>`;
    html += `<li><strong>Use tax-saving instruments:</strong> ELSS funds give tax deduction under 80C (up to ₹1.5L/year) while earning equity-like returns. PPF adds guaranteed 7%+ returns.</li>`;
    html += `<li><strong>Automate on salary day:</strong> Set SIPs on the same day salary credits. You can't spend what you've already invested.</li>`;
    html += `</ul></div></div>`;

    // Strategy 2: Income Growth
    html += `<div class="earning-strategy-card">`;
    html += `<div class="earning-strategy-card__icon">💼</div>`;
    html += `<div class="earning-strategy-card__title">Boost Your Primary Income</div>`;
    html += `<div class="earning-strategy-card__body">`;

    if (profile.salary > 0) {
      const neededRaise = gap > 0 ? Math.round((requiredExtraMonthly * 12 / profile.salary) * 100) : 0;
      if (neededRaise > 0) {
        html += `<p>A <strong>${Math.min(neededRaise, 100)}% total income increase</strong> over ${years} years (${(neededRaise / years).toFixed(1)}%/year above current growth) would close the gap through salary alone.</p>`;
      }
    }
    html += `<ul>`;
    html += `<li><strong>Negotiate proactively:</strong> Most people lose 10-20% in lifetime earnings by not negotiating. Prepare data on market rates and your achievements before reviews.</li>`;
    html += `<li><strong>Switch jobs strategically:</strong> Job changes often yield 20-40% salary increases vs 5-10% internal raises. Target a switch every 2-3 years in high-growth phases of your career.</li>`;
    html += `<li><strong>Get certified:</strong> Industry certifications (AWS, PMP, CFA, etc.) can justify 15-25% salary premiums in technical and finance roles.</li>`;
    html += `<li><strong>Target high-growth sectors:</strong> AI/ML, cloud computing, fintech, and healthtech currently offer 20-50% premium over traditional IT/industry salaries.</li>`;
    html += `</ul></div></div>`;

    // Strategy 3: Side Income
    html += `<div class="earning-strategy-card">`;
    html += `<div class="earning-strategy-card__icon">🚀</div>`;
    html += `<div class="earning-strategy-card__title">Build Side Income Streams</div>`;
    html += `<div class="earning-strategy-card__body">`;
    html += `<p>A side income of <strong>${formatINR(Math.max(5000, Math.round(requiredExtraMonthly * 0.5)))}/month</strong> invested fully can contribute significantly to your goal. Here's how:</p>`;
    html += `<ul>`;
    html += `<li><strong>Freelancing:</strong> Use platforms like Upwork, Toptal, or Fiverr. Technical freelancers earn ₹1,000-₹5,000/hour. Even 5-10 hours/month adds ₹5,000-₹50,000.</li>`;
    html += `<li><strong>Content creation:</strong> Start a YouTube channel, blog, or newsletter in your expertise area. Monetization typically begins at 6-12 months, growing to ₹10,000-₹1,00,000/month with consistency.</li>`;
    html += `<li><strong>Teaching/Tutoring:</strong> Online tutoring or course creation on platforms like Unacademy, Udemy, or Skillshare. Domain experts can earn ₹2,000-₹5,000/hour.</li>`;
    html += `<li><strong>Consulting:</strong> Offer your professional expertise to small businesses. 4-5 hours/week of consulting at ₹2,000-₹10,000/hour = ₹30,000-₹2,00,000/month.</li>`;
    html += `<li><strong>Digital products:</strong> Create templates, tools, e-books, or SaaS products. These scale without your time after the initial build.</li>`;
    html += `</ul></div></div>`;

    // Strategy 4: Expense Optimization
    html += `<div class="earning-strategy-card">`;
    html += `<div class="earning-strategy-card__icon">✂️</div>`;
    html += `<div class="earning-strategy-card__title">Optimize Expenses to Invest More</div>`;
    html += `<div class="earning-strategy-card__body">`;
    if (monthlyExpenses > 0) {
      const saveable = Math.round(monthlyExpenses * 0.15);
      html += `<p>Cutting <strong>15% of expenses</strong> frees up ~<strong>${formatINR(saveable)}/month</strong> for investing. Over ${years} years at ${(annualReturn * 100).toFixed(0)}% returns, this alone adds <strong>${formatINR(Math.round(saveable * ((Math.pow(1 + monthlyReturn, totalMonths) - 1) / monthlyReturn)))}</strong> to your wealth.</p>`;
    }
    html += `<ul>`;
    html += `<li><strong>Audit subscriptions:</strong> Most people have 3-5 unused subscriptions bleeding ₹1,000-₹3,000/month. Cancel ruthlessly.</li>`;
    html += `<li><strong>Reduce dining out by 50%:</strong> Cook more at home. A family eating out 3x/week can save ₹5,000-₹15,000/month by reducing to 1-2x/week.</li>`;
    html += `<li><strong>Negotiate recurring bills:</strong> Call your internet, insurance, and phone providers annually. Loyal customers often get 10-20% discounts just by asking.</li>`;
    html += `<li><strong>Use the 48-hour rule:</strong> For any non-essential purchase over ₹2,000, wait 48 hours. This eliminates 50-70% of impulse spending.</li>`;
    html += `</ul></div></div>`;

    html += `</div>`; // end grid

    // Summary callout
    if (gap > 0 && profile.salary > 0) {
      const monthlyGapPercent = (requiredExtraMonthly / monthlySalary * 100).toFixed(1);
      html += `<div class="earning-summary-callout">`;
      html += `<strong>📌 Bottom Line:</strong> You need to find <strong>${formatINR(Math.round(requiredExtraMonthly))}/month</strong> `;
      html += `(${monthlyGapPercent}% of your current monthly salary) in additional savings or income to bridge the gap. `;
      html += `The most effective approach is a <strong>combination</strong>: boost income by 10-15%, cut expenses by 10-15%, and invest the difference systematically. `;
      html += `Small, consistent actions compound dramatically over ${years} years.`;
      html += `</div>`;
    } else if (gap <= 0 && goalAmount > 0) {
      html += `<div class="earning-summary-callout earning-summary-callout--success">`;
      html += `<strong>📌 Keep Going:</strong> You're ahead of target. Consider raising your goal to stretch your potential, or redirect surplus into `;
      html += `higher-growth opportunities like aggressive equity, real estate, or building a side business for wealth acceleration.`;
      html += `</div>`;
    }

    return html;
  }

  return { generate, formatINR };
})();

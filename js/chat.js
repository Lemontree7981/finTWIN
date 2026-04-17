/**
 * Chat Interface — Natural Language Intelligence Layer
 * Converts user queries into structured financial scenarios via rule-based NLP
 */

const ChatEngine = (() => {

  // --- Intent Patterns ---
  const INTENT_PATTERNS = [
    // Income changes
    {
      patterns: [/(?:what if|suppose|if)\s+(?:i\s+)?(?:get|got|receive)\s+(?:a\s+)?(\d+)\s*%?\s*(?:raise|hike|increment|increase)/i,
                 /(?:salary|income)\s+(?:increase|goes up|raise)\s+(?:by\s+)?(\d+)\s*%/i,
                 /(?:raise|hike|increment)\s+(?:of\s+)?(\d+)\s*%/i],
      intent: 'income_increase',
      extract: (match) => ({ percent: parseFloat(match[1]) })
    },
    {
      patterns: [/(?:what if|suppose|if)\s+(?:i\s+)?(?:lose|lost)\s+(?:my\s+)?job/i,
                 /(?:job\s+loss|fired|laid\s*off|unemployed|retrenched)/i],
      intent: 'job_loss',
      extract: () => ({})
    },
    {
      patterns: [/(?:what if|suppose|if)\s+(?:i\s+)?(?:start|begin|launch)\s+(?:a\s+)?(?:business|startup|company|venture)/i,
                 /(?:quit|leave)\s+(?:my\s+)?(?:job|work)\s+(?:and\s+)?(?:start|for)/i,
                 /(?:become|go)\s+(?:an?\s+)?(?:entrepreneur|self[- ]?employed|freelance)/i],
      intent: 'start_business',
      extract: () => ({})
    },
    {
      patterns: [/(?:what if|suppose|if)\s+(?:i\s+)?(?:switch|change)\s+(?:my\s+)?(?:career|job|field|industry)/i,
                 /career\s+(?:switch|change|transition)/i],
      intent: 'career_switch',
      extract: () => ({})
    },
    // Expense changes
    {
      patterns: [/(?:expenses?|spending)\s+(?:increase|go up|rise|become)\s+(?:to\s+)?(?:₹|rs\.?\s*)?(\d[\d,]*)/i,
                 /(?:what if|suppose|if)\s+(?:i\s+)?(?:spend|start spending)\s+(?:₹|rs\.?\s*)?(\d[\d,]*)\s*(?:per|a|every|\/)\s*month/i,
                 /(?:monthly\s+)?(?:expenses?|spending)\s+(?:of\s+)?(?:₹|rs\.?\s*)?(\d[\d,]*)/i],
      intent: 'expense_change',
      extract: (match) => ({ amount: parseFloat(match[1].replace(/,/g, '')) })
    },
    {
      patterns: [/(?:what if|suppose|if)\s+(?:my\s+)?(?:rent|emi)\s+(?:doubles|increases|goes\s+up)/i],
      intent: 'expense_increase_general',
      extract: () => ({ multiplier: 2 })
    },
    // Investment decisions
    {
      patterns: [/(?:invest|investing)\s+(?:aggressively|aggressive|more\s+in\s+equity|in\s+stocks)/i,
                 /(?:aggressive|high[- ]risk)\s+(?:investing|investment|portfolio)/i],
      intent: 'aggressive_investing',
      extract: () => ({})
    },
    {
      patterns: [/(?:invest|put|keep)\s+(?:everything|all|money)\s+in\s+(?:fd|fixed\s+deposit|bank|savings\s+account|safe)/i,
                 /(?:conservative|safe|low[- ]risk)\s+(?:investing|investment|portfolio)/i],
      intent: 'conservative_investing',
      extract: () => ({})
    },
    // Life events
    {
      patterns: [/(?:what if|suppose|if)\s+(?:i\s+)?(?:buy|purchase|get)\s+(?:a\s+)?(?:house|home|flat|apartment|property)/i,
                 /(?:buy|buying|purchase)\s+(?:a\s+)?(?:house|home|flat|property)\s*(?:worth|for|of|costing)?\s*(?:₹|rs\.?\s*)?(\d[\d,]*\s*(?:lakh|lac|l|crore|cr)?)?/i],
      intent: 'buy_house',
      extract: (match) => ({ value: match[1] ? parseAmount(match[1]) : null })
    },
    // Goal queries
    {
      patterns: [/(?:can i|will i|is it possible to)\s+(?:retire|stop working)\s+(?:by|at|before)\s+(?:age\s+)?(\d+)/i,
                 /(?:retire|retirement)\s+(?:by|at)\s+(\d+)/i],
      intent: 'retirement_query',
      extract: (match) => ({ targetAge: parseInt(match[1]) })
    },
    {
      patterns: [/(?:can i|will i|is it possible to)\s+(?:save|accumulate|build|reach|get to)\s+(?:₹|rs\.?\s*)?(\d[\d,]*\s*(?:lakh|lac|l|crore|cr)?)\s*(?:in|within|by)\s+(\d+)\s*(?:year|yr)/i,
                 /(?:save|accumulate)\s+(?:₹|rs\.?\s*)?(\d[\d,]*\s*(?:lakh|lac|l|crore|cr)?)/i],
      intent: 'savings_goal_query',
      extract: (match) => ({ targetAmount: parseAmount(match[1]), years: match[2] ? parseInt(match[2]) : 10 })
    },
    // Salary specification
    {
      patterns: [/(?:what if|suppose|if)\s+(?:my\s+)?(?:salary|income)\s+(?:is|becomes|was|were|changes?\s+to)\s+(?:₹|rs\.?\s*)?(\d[\d,]*\s*(?:lakh|lac|l|crore|cr|lpa|per\s+annum)?)/i],
      intent: 'salary_change',
      extract: (match) => ({ amount: parseAmount(match[1]) })
    },
    // Scenario cloning / modifications
    {
      patterns: [/(?:same|that)\s+(?:scenario|simulation)\s+(?:but|with|if)\s+(?:my\s+)?(?:expenses?|spending)\s+(?:(?:are|were|was|of|at|become)\s+)?(?:₹|rs\.?\s*)?(\d[\d,]*)\s*(?:\/|per|a)?\s*(?:month)?/i,
                 /(?:same|that)\s+(?:scenario|simulation)\s+(?:but|with|if)\s+(?:₹|rs\.?\s*)?(\d[\d,]*)\s*(?:less|lower|fewer|reduced)\s+(?:expenses?|spending)/i],
      intent: 'clone_modify_expenses',
      extract: (match) => ({ amount: parseFloat(match[1].replace(/,/g, '')) })
    },
    {
      patterns: [/(?:same|that)\s+(?:scenario|simulation)\s+(?:but|with|if)\s+(?:a\s+)?(\d+)\s*%?\s*(?:raise|hike|salary increase|more salary|higher salary)/i,
                 /(?:same|that)\s+(?:scenario|simulation)\s+(?:but|with|if)\s+(?:my\s+)?(?:salary|income)\s+(?:is|at|of|becomes?)\s+(?:₹|rs\.?\s*)?(\d[\d,]*\s*(?:lakh|lac|l|crore|cr|lpa)?)/i],
      intent: 'clone_modify_salary',
      extract: (match) => {
        const raw = match[1].replace(/,/g, '');
        if (/lakh|lac|l\b|lpa|crore|cr/i.test(match[0])) {
          return { amount: parseAmount(match[1]) };
        }
        return { percent: parseFloat(raw) };
      }
    }
  ];

  // --- Amount Parser ---
  function parseAmount(str) {
    if (!str) return null;
    str = str.toLowerCase().replace(/,/g, '').trim();
    let num = parseFloat(str.replace(/[^\d.]/g, ''));
    if (isNaN(num)) return null;
    if (/crore|cr/i.test(str)) num *= 1e7;
    else if (/lakh|lac|l\b|lpa|per\s*annum/i.test(str)) num *= 1e5;
    return num;
  }

  // --- Intent Detection ---
  function detectIntent(message) {
    const clean = message.trim();

    for (const rule of INTENT_PATTERNS) {
      for (const pattern of rule.patterns) {
        const match = clean.match(pattern);
        if (match) {
          return {
            intent: rule.intent,
            params: rule.extract(match),
            originalQuery: clean,
            matched: true
          };
        }
      }
    }

    return {
      intent: 'unknown',
      params: {},
      originalQuery: clean,
      matched: false
    };
  }

  // --- Scenario Builder ---
  function buildScenarioFromIntent(intent, profile) {
    const base = { ...Scenarios.baseline };
    let assumptions = [];
    let scenarioName = '';

    switch (intent.intent) {
      case 'income_increase': {
        const pct = intent.params.percent || 20;
        const newSalary = profile.salary * (1 + pct / 100);
        scenarioName = `${pct}% Salary Raise`;
        assumptions.push(`Salary increases from ${formatINRShort(profile.salary)} to ${formatINRShort(newSalary)} immediately`);
        assumptions.push('Subsequent growth continues at ~6%/year');
        return {
          scenario: {
            ...base,
            id: 'chat_income_increase',
            name: scenarioName,
            icon: '💰',
            incomeOverride: (baseSalary, year) => {
              if (year === 1) return { income: newSalary };
              const grown = newSalary * Math.pow(1.06, year - 1);
              return { income: grown };
            }
          },
          profileOverride: {},
          assumptions,
          scenarioName
        };
      }

      case 'job_loss': {
        scenarioName = 'Job Loss Scenario';
        assumptions.push('Zero income for 6 months');
        assumptions.push('New job at 80% of previous salary after 6 months');
        assumptions.push('Normal growth resumes from year 2');
        return {
          scenario: {
            ...base,
            id: 'chat_job_loss',
            name: scenarioName,
            icon: '⚡',
            riskLevel: 'high',
            incomeOverride: (baseSalary, year) => {
              if (year === 1) return { income: baseSalary * 0.4 }; // ~6mo no income
              if (year === 2) return { income: baseSalary * 0.8 };
              return { income: baseSalary * Math.pow(1.06, year - 2) * 0.8 };
            }
          },
          profileOverride: {},
          assumptions,
          scenarioName
        };
      }

      case 'start_business':
        scenarioName = 'Start a Business';
        assumptions.push('Zero income in year 1 (building phase)');
        assumptions.push('35% chance of significant success by year 3');
        assumptions.push('15% startup costs in year 1');
        return {
          scenario: Scenarios.quit_job,
          profileOverride: {},
          assumptions,
          scenarioName
        };

      case 'career_switch':
        scenarioName = 'Career Switch';
        assumptions.push('60-80% salary in year 1 (transition)');
        assumptions.push('Accelerated 10%+ growth from year 3');
        assumptions.push('5% upskilling cost in year 1');
        return {
          scenario: Scenarios.career_switch,
          profileOverride: {},
          assumptions,
          scenarioName
        };

      case 'expense_change': {
        const newExpense = intent.params.amount;
        scenarioName = `Expenses → ₹${(newExpense / 1000).toFixed(0)}K/month`;
        assumptions.push(`Monthly expenses change to ₹${newExpense.toLocaleString('en-IN')}`);
        assumptions.push('All other parameters remain at baseline');
        return {
          scenario: base,
          profileOverride: { monthlyExpenses: newExpense },
          assumptions,
          scenarioName
        };
      }

      case 'expense_increase_general': {
        const newExpense = profile.monthlyExpenses * (intent.params.multiplier || 2);
        scenarioName = 'Expenses Double';
        assumptions.push(`Monthly expenses double to ₹${newExpense.toLocaleString('en-IN')}`);
        return {
          scenario: base,
          profileOverride: { monthlyExpenses: newExpense },
          assumptions,
          scenarioName
        };
      }

      case 'aggressive_investing':
        scenarioName = 'Aggressive Investing';
        assumptions.push('Expected return: 14%/year (vs 10% baseline)');
        assumptions.push('Volatility: 25%/year (vs 18% baseline)');
        assumptions.push('Higher equity allocation with market risk');
        return {
          scenario: Scenarios.aggressive,
          profileOverride: {},
          assumptions,
          scenarioName
        };

      case 'conservative_investing':
        scenarioName = 'Conservative Investing';
        assumptions.push('Expected return: 6%/year (fixed deposits + debt)');
        assumptions.push('Low volatility: 3%/year');
        assumptions.push('Capital safety prioritized over growth');
        return {
          scenario: {
            ...base,
            id: 'chat_conservative',
            name: scenarioName,
            icon: '🏦',
            returnMean: 0.06,
            returnStd: 0.03,
            riskLevel: 'low'
          },
          profileOverride: {},
          assumptions,
          scenarioName
        };

      case 'buy_house': {
        scenarioName = 'Buy a House';
        const houseValue = intent.params.value || profile.salary * 5;
        assumptions.push(`Property value: ${formatINRShort(houseValue)}`);
        assumptions.push('EMI: ~40% of monthly salary');
        assumptions.push('Property appreciates ~2% net annually');
        return {
          scenario: Scenarios.buy_house,
          profileOverride: {},
          assumptions,
          scenarioName
        };
      }

      case 'salary_change': {
        const newSalary = intent.params.amount;
        if (!newSalary) break;
        scenarioName = `Salary → ${formatINRShort(newSalary)}`;
        assumptions.push(`Salary becomes ${formatINRShort(newSalary)}`);
        assumptions.push('Normal 6% annual growth after change');
        return {
          scenario: base,
          profileOverride: { salary: newSalary },
          assumptions,
          scenarioName
        };
      }

      case 'retirement_query': {
        const targetAge = intent.params.targetAge || 50;
        const yearsToRetire = Math.max(1, targetAge - profile.age);
        scenarioName = `Retire by Age ${targetAge}`;
        assumptions.push(`Retirement in ${yearsToRetire} years (at age ${targetAge})`);
        assumptions.push('Need to sustain expenses post-retirement');
        assumptions.push('Conservative 6% returns post-retirement');
        return {
          scenario: base,
          profileOverride: {},
          assumptions,
          scenarioName,
          simulationOverride: { years: yearsToRetire }
        };
      }

      case 'savings_goal_query': {
        const targetAmount = intent.params.targetAmount;
        const years = intent.params.years || 10;
        scenarioName = `Save ${formatINRShort(targetAmount)} in ${years}yr`;
        assumptions.push(`Target: ${formatINRShort(targetAmount)} in ${years} years`);
        assumptions.push('Using baseline assumptions');
        return {
          scenario: base,
          profileOverride: targetAmount ? { goalAmount: targetAmount } : {},
          assumptions,
          scenarioName,
          simulationOverride: { years }
        };
      }

      default:
        break;
    }

    // Fallback
    return {
      scenario: base,
      profileOverride: {},
      assumptions: ['Using your baseline financial profile'],
      scenarioName: 'Baseline Analysis',
      isDefault: true
    };
  }

  /**
   * Build a cloned scenario with modifications
   * Uses the currently active scenario as a base and applies overrides
   */
  function buildClonedScenario(intent, profile, activeScenario) {
    const base = activeScenario ? { ...activeScenario } : { ...Scenarios.baseline };
    let assumptions = [`Based on: ${base.name || 'Current Scenario'}`];
    let scenarioName = base.name || 'Modified Scenario';
    let profileOverride = {};

    switch (intent.intent) {
      case 'clone_modify_expenses': {
        const newExp = intent.params.amount;
        scenarioName = `${base.name} + ₹${(newExp / 1000).toFixed(0)}K expenses`;
        assumptions.push(`Monthly expenses changed to ₹${newExp.toLocaleString('en-IN')}`);
        profileOverride.monthlyExpenses = newExp;
        break;
      }
      case 'clone_modify_salary': {
        if (intent.params.amount) {
          const newSalary = intent.params.amount;
          scenarioName = `${base.name} + ₹${formatINRShort(newSalary)} salary`;
          assumptions.push(`Salary changed to ${formatINRShort(newSalary)}`);
          profileOverride.salary = newSalary;
        } else if (intent.params.percent) {
          const pct = intent.params.percent;
          const newSalary = profile.salary * (1 + pct / 100);
          scenarioName = `${base.name} + ${pct}% raise`;
          assumptions.push(`Salary increased by ${pct}% to ${formatINRShort(newSalary)}`);
          profileOverride.salary = newSalary;
        }
        break;
      }
    }

    return {
      scenario: { ...base, id: 'chat_clone_' + Date.now(), name: scenarioName },
      profileOverride,
      assumptions,
      scenarioName
    };
  }

  // --- Chat Response Generator ---
  function generateChatResponse(intent, results, baselineResults, profile, scenario, behavioralReport) {
    const s = results.stats;
    const b = baselineResults.stats;
    let html = '';

    // 1. Scenario Interpretation
    html += `<div class="chat-section">`;
    html += `<div class="chat-section__header"><span class="chat-section__icon">🔍</span> Scenario Interpretation</div>`;
    html += `<p>${getIntentDescription(intent)}</p>`;
    if (intent.assumptions && intent.assumptions.length > 0) {
      html += `<div class="chat-assumptions">`;
      html += `<span class="chat-assumptions__label">Assumptions:</span>`;
      html += `<ul>${intent.assumptions.map(a => `<li>${a}</li>`).join('')}</ul>`;
      html += `</div>`;
    }
    html += `</div>`;

    // 2. Outcome Summary
    html += `<div class="chat-section">`;
    html += `<div class="chat-section__header"><span class="chat-section__icon">📊</span> Outcome Summary</div>`;
    html += `<div class="chat-outcomes">`;
    html += `<div class="chat-outcome"><span class="chat-outcome__label">Median</span><span class="chat-outcome__value chat-outcome__value--gold">${formatINRShort(s.final.median)}</span></div>`;
    html += `<div class="chat-outcome"><span class="chat-outcome__label">Best (P95)</span><span class="chat-outcome__value chat-outcome__value--teal">${formatINRShort(s.final.p95)}</span></div>`;
    html += `<div class="chat-outcome"><span class="chat-outcome__label">Worst (P5)</span><span class="chat-outcome__value chat-outcome__value--coral">${formatINRShort(s.final.p5)}</span></div>`;
    html += `<div class="chat-outcome"><span class="chat-outcome__label">Goal Prob.</span><span class="chat-outcome__value ${s.goalProbability >= 50 ? 'chat-outcome__value--teal' : 'chat-outcome__value--coral'}">${s.goalProbability.toFixed(1)}%</span></div>`;
    html += `</div>`;

    // Comparison to baseline
    if (intent.intent !== 'baseline') {
      const diff = s.final.median - b.final.median;
      if (Math.abs(diff) > 1000) {
        html += `<p class="chat-comparison">Compared to baseline: <span class="${diff > 0 ? 'highlight-teal' : 'highlight-coral'}">${diff > 0 ? '+' : ''}${formatINRShort(diff)}</span> (${diff > 0 ? 'better' : 'worse'})</p>`;
      }
    }
    html += `</div>`;

    // 3. Risk Analysis
    html += `<div class="chat-section">`;
    html += `<div class="chat-section__header"><span class="chat-section__icon">⚠️</span> Risk Analysis</div>`;
    if (s.ruinProbability > 0) {
      html += `<p>• Ruin probability: <span class="highlight-coral">${s.ruinProbability.toFixed(1)}%</span>`;
      if (s.ruinWithin3Prob > 0) html += ` (${s.ruinWithin3Prob.toFixed(1)}% within 3 years)`;
      html += `</p>`;
    }
    if (s.final.p5 < 0) {
      html += `<p>• Worst-case ends in debt: <span class="highlight-coral">${formatINRShort(s.final.p5)}</span></p>`;
    }
    const riskScore = computeRiskScore(s);
    const riskInfo = getRiskLabel(riskScore);
    html += `<p>• Overall risk score: <span style="color:${riskInfo.color}">${riskScore}/100 (${riskInfo.label})</span></p>`;
    html += `</div>`;

    // 4. Behavioral Insight
    if (behavioralReport && behavioralReport.insights.length > 0) {
      const important = behavioralReport.insights.filter(i => i.severity !== 'info' || i.recommendation);
      if (important.length > 0) {
        html += `<div class="chat-section">`;
        html += `<div class="chat-section__header"><span class="chat-section__icon">🧠</span> Behavioral Insight</div>`;
        for (const insight of important.slice(0, 3)) {
          html += `<div class="chat-insight chat-insight--${insight.severity}">`;
          html += `<span class="chat-insight__icon">${insight.icon}</span>`;
          html += `<div><strong>${insight.title}</strong>: ${insight.message}`;
          if (insight.recommendation) html += `<br><em class="chat-insight__rec">${insight.recommendation}</em>`;
          html += `</div></div>`;
        }
        html += `</div>`;
      }
    }

    // 5. Decision Guidance
    html += `<div class="chat-section chat-section--decision">`;
    html += `<div class="chat-section__header"><span class="chat-section__icon">✅</span> Decision Guidance</div>`;
    html += getDecisionGuidance(s, b, profile, intent, riskScore);
    html += `</div>`;

    return html;
  }

  function getIntentDescription(intent) {
    switch (intent.intent) {
      case 'income_increase': return `Analyzing the impact of a <strong>${intent.params.percent}% salary increase</strong> on your financial trajectory.`;
      case 'job_loss': return `Simulating a <strong>job loss scenario</strong> with 6 months of zero income followed by re-employment at reduced pay.`;
      case 'start_business': return `Modeling a <strong>business startup</strong> scenario with high income volatility and initial investment costs.`;
      case 'career_switch': return `Evaluating a <strong>career transition</strong> — short-term income reduction with higher long-term growth potential.`;
      case 'expense_change': return `Analyzing how changing <strong>monthly expenses to ₹${intent.params.amount?.toLocaleString('en-IN')}</strong> affects your wealth trajectory.`;
      case 'expense_increase_general': return `Simulating a <strong>doubling of your monthly expenses</strong> and its long-term impact.`;
      case 'aggressive_investing': return `Testing an <strong>aggressive investment strategy</strong> with higher equity allocation (14% returns, 25% volatility).`;
      case 'conservative_investing': return `Modeling a <strong>conservative, capital-safe approach</strong> with fixed deposits and debt instruments.`;
      case 'buy_house': return `Analyzing the financial impact of <strong>buying a house</strong> with EMI payments and property appreciation.`;
      case 'salary_change': return `Simulation with <strong>updated salary</strong> of ₹${intent.params.amount?.toLocaleString('en-IN')}.`;
      case 'retirement_query': return `Evaluating feasibility of <strong>retiring at age ${intent.params.targetAge}</strong>.`;
      case 'savings_goal_query': return `Checking if you can reach <strong>${formatINRShort(intent.params.targetAmount)}</strong> in ${intent.params.years || 10} years.`;
      default: return `Running <strong>baseline analysis</strong> with your current financial profile.`;
    }
  }

  function getDecisionGuidance(s, b, profile, intent, riskScore) {
    const diff = s.final.median - b.final.median;
    let html = '';

    if (riskScore < 20 && diff >= 0) {
      html += `<div class="chat-verdict chat-verdict--safe">`;
      html += `<strong>✅ Safe Decision.</strong> Low risk (${riskScore}/100) with positive or neutral projected outcome. Proceed with standard precautions.`;
      html += `</div>`;
    } else if (riskScore < 45 && diff > 0) {
      html += `<div class="chat-verdict chat-verdict--moderate">`;
      html += `<strong>⚡ Moderate Risk, Positive Return.</strong> Projected +${formatINRShort(diff)} vs baseline. Manageable risk at ${riskScore}/100. Ensure 6-month emergency fund before proceeding.`;
      html += `</div>`;
    } else if (riskScore >= 45 && diff > 0) {
      html += `<div class="chat-verdict chat-verdict--high-upside">`;
      html += `<strong>🎲 High Risk, High Reward.</strong> Potential +${formatINRShort(diff)} upside but risk score is ${riskScore}/100. Only consider with 12+ months runway and clear exit strategy.`;
      html += `</div>`;
    } else if (diff < 0 && riskScore >= 45) {
      html += `<div class="chat-verdict chat-verdict--risky">`;
      html += `<strong>🚫 Risky Decision.</strong> Projects ${formatINRShort(Math.abs(diff))} less than baseline with risk score ${riskScore}/100. Financially difficult to justify.`;
      html += `</div>`;
    } else {
      html += `<div class="chat-verdict chat-verdict--neutral">`;
      html += `<strong>➡️ Neutral.</strong> Outcomes comparable to baseline. Risk at ${riskScore}/100. Non-financial factors should guide your decision.`;
      html += `</div>`;
    }

    return html;
  }

  function formatINRShort(value) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e7) return sign + '₹' + (abs / 1e7).toFixed(1) + 'Cr';
    if (abs >= 1e5) return sign + '₹' + (abs / 1e5).toFixed(1) + 'L';
    if (abs >= 1e3) return sign + '₹' + (abs / 1e3).toFixed(0) + 'K';
    return sign + '₹' + abs.toFixed(0);
  }

  function getUnknownIntentResponse() {
    return `<p>I couldn't parse a specific financial scenario from your question. Try asking something like:</p>
      <ul>
        <li>"What if I get a 30% raise?"</li>
        <li>"What if I start a business?"</li>
        <li>"What if my expenses become â‚¹50,000/month?"</li>
        <li>"Can I save â‚¹1 crore in 10 years?"</li>
      </ul>
      <p>I work best with clear financial what-if scenarios.</p>`;
  }

  function buildAiContext(intent, results, baselineResults, profile, scenario, behavioralReport) {
    const scenarioStats = results?.stats;
    const baselineStats = baselineResults?.stats;

    return {
      intent: intent ? {
        name: intent.intent,
        originalQuery: intent.originalQuery,
        assumptions: intent.assumptions || [],
        parameters: intent.params || {}
      } : null,
      profile: profile ? {
        age: profile.age,
        salary: profile.salary,
        savings: profile.savings,
        monthlyExpenses: profile.monthlyExpenses,
        goalAmount: profile.goalAmount
      } : null,
      scenario: scenario ? {
        id: scenario.id,
        name: scenario.name,
        riskLevel: scenario.riskLevel || 'baseline'
      } : null,
      simulation: scenarioStats ? {
        years: results.years,
        medianFinalWealth: scenarioStats.final.median,
        bestCaseFinalWealth: scenarioStats.final.p95,
        worstCaseFinalWealth: scenarioStats.final.p5,
        meanFinalWealth: scenarioStats.final.mean,
        goalProbability: scenarioStats.goalProbability,
        ruinProbability: scenarioStats.ruinProbability,
        ruinWithin3YearsProbability: scenarioStats.ruinWithin3Prob
      } : null,
      baselineComparison: baselineStats ? {
        medianFinalWealth: baselineStats.final.median,
        goalProbability: baselineStats.goalProbability,
        ruinProbability: baselineStats.ruinProbability
      } : null,
      behavioral: behavioralReport ? {
        healthScore: behavioralReport.healthScore,
        savingsRate: behavioralReport.savingsRate,
        emergencyMonths: behavioralReport.emergencyMonths,
        expenseRatio: behavioralReport.expenseRatio,
        keyInsights: (behavioralReport.insights || []).slice(0, 3).map((insight) => ({
          title: insight.title,
          severity: insight.severity,
          message: insight.message,
          recommendation: insight.recommendation || ''
        }))
      } : null
    };
  }

  // --- Suggested Prompts ---
  const SUGGESTED_PROMPTS = [
    'What if I get a 50% raise?',
    'What if I start a business?',
    'What if I buy a house?',
    'Can I save ₹1 crore in 10 years?',
    'What if I invest aggressively?',
    'What if I lose my job?',
    'What if expenses double?',
    'What if I switch careers?'
  ];

  function getRandomPrompts(count = 4) {
    const shuffled = [...SUGGESTED_PROMPTS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Generate contextual prompts based on simulation results and behavioral report
   */
  function getContextualPrompts(results, behavioralReport, count = 4) {
    if (!results || !results.stats) {
      return getRandomPrompts(count);
    }

    const s = results.stats;
    const contextual = [];

    // Based on ruin probability
    if (s.ruinProbability > 10) {
      contextual.push('How can I reduce my ruin risk?');
    }

    // Based on goal probability
    if (s.goalProbability < 40) {
      contextual.push('How much more do I need to save to reach my goal?');
      contextual.push('What if I invest aggressively?');
    } else if (s.goalProbability > 80) {
      contextual.push('Can I retire 5 years earlier?');
    }

    // Based on behavioral report
    if (behavioralReport) {
      if (behavioralReport.savingsRate < 20) {
        contextual.push('What if I cut expenses by 20%?');
      }
      if (behavioralReport.emergencyMonths < 6) {
        contextual.push('What if I lose my job?');
      }
      if (behavioralReport.expenseRatio > 60) {
        contextual.push(`What if expenses become ₹${Math.round(behavioralReport.expenseRatio * 0.7 / 100 * 66667).toLocaleString('en-IN')}/month?`);
      }
    }

    // Based on worst case
    if (s.final.p5 < 0) {
      contextual.push('What if I invest conservatively?');
    }

    // Scenario cloning prompts (always useful)
    contextual.push('Same scenario but with a 30% raise');

    // Deduplicate and fill remaining with random
    const unique = [...new Set(contextual)];
    if (unique.length < count) {
      const remaining = SUGGESTED_PROMPTS.filter(p => !unique.includes(p));
      const shuffled = remaining.sort(() => Math.random() - 0.5);
      unique.push(...shuffled.slice(0, count - unique.length));
    }

    return unique.slice(0, count);
  }

  function localEscapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPercent(value, digits = 1) {
    return `${Number(value || 0).toFixed(digits)}%`;
  }

  function getLocalProfileMetrics(profile) {
    if (!profile) return null;

    const annualExpenses = (profile.monthlyExpenses || 0) * 12;
    const taxRate = profile.taxRate || 0;
    const monthlyNetIncome = (profile.salary || 0) * (1 - taxRate) / 12;
    const monthlySurplus = monthlyNetIncome - (profile.monthlyExpenses || 0);
    const savingsRate = profile.salary > 0
      ? ((profile.salary - annualExpenses) / profile.salary) * 100
      : 0;
    const emergencyMonths = profile.monthlyExpenses > 0
      ? (profile.savings || 0) / profile.monthlyExpenses
      : 0;
    const expenseRatio = profile.salary > 0
      ? ((profile.monthlyExpenses || 0) / (profile.salary / 12)) * 100
      : 0;

    return {
      annualExpenses,
      monthlyNetIncome,
      monthlySurplus,
      savingsRate,
      emergencyMonths,
      expenseRatio
    };
  }

  function getTopLocalInsight(behavioralReport) {
    if (!behavioralReport?.insights?.length) return null;

    const score = { critical: 3, warning: 2, info: 1 };
    const ranked = [...behavioralReport.insights].sort((a, b) => {
      const severityDiff = (score[b.severity] || 0) - (score[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      return Number(Boolean(b.recommendation)) - Number(Boolean(a.recommendation));
    });

    return ranked[0] || null;
  }

  function estimateHouseBudget(profile) {
    if (!profile?.salary) return null;

    const monthlyNet = (profile.salary * (1 - (profile.taxRate || 0))) / 12;
    const affordableEmi = monthlyNet * 0.30;
    const annualRate = 8.5;
    const tenureYears = 20;
    const monthlyRate = (annualRate / 100) / 12;
    const totalMonths = tenureYears * 12;

    if (affordableEmi <= 0 || monthlyRate <= 0) return null;

    const factor = Math.pow(1 + monthlyRate, totalMonths);
    const loanAmount = affordableEmi * (factor - 1) / (monthlyRate * factor);

    return {
      affordableEmi,
      propertyBudget: loanAmount / 0.80
    };
  }

  function buildLocalHelpResponse(hasResults) {
    return [
      '<p>I can answer local questions even without a live model.</p>',
      '<ul>',
      '<li>"How am I doing overall?"</li>',
      '<li>"What should I improve first?"</li>',
      '<li>"What does goal probability mean?"</li>',
      '<li>"Am I saving enough?"</li>',
      '<li>"Can I afford a house?"</li>',
      '<li>"Explain the chart / ruin probability / median outcome"</li>',
      '</ul>',
      hasResults
        ? '<p>I will use your latest simulation context for the answer.</p>'
        : '<p>I will use the current input values in the form when there is no saved simulation yet.</p>'
    ].join('');
  }

  function buildLocalStatusResponse(profile, results, baselineResults, behavioralReport, scenario) {
    const s = results?.stats;
    if (!s) return getUnknownIntentResponse();

    const b = baselineResults?.stats || s;
    const metrics = getLocalProfileMetrics(profile);
    const topInsight = getTopLocalInsight(behavioralReport);
    let lead = 'Your plan looks mixed right now. There is some growth potential, but a few weak spots are holding it back.';

    if (s.goalProbability >= 75 && s.ruinProbability <= 10) {
      lead = 'Your current plan looks fairly healthy. The downside risk is contained and goal odds are decent.';
    } else if (s.goalProbability < 40 || s.ruinProbability > 20) {
      lead = 'Your plan looks financially tight right now. Cash-flow resilience is the main weakness.';
    }

    const comparison = scenario?.id && scenario.id !== 'baseline'
      ? `<p class="chat-comparison">Compared to baseline: ${s.final.median >= b.final.median ? '+' : '-'}${formatINRShort(Math.abs(s.final.median - b.final.median))}</p>`
      : '';

    return [
      '<div class="chat-section">',
      '<div class="chat-section__header"><span class="chat-section__icon">OVR</span> Overall View</div>',
      `<p>${localEscapeHtml(lead)}</p>`,
      '<div class="chat-outcomes">',
      `<div class="chat-outcome"><span class="chat-outcome__label">Median</span><span class="chat-outcome__value chat-outcome__value--gold">${formatINRShort(s.final.median)}</span></div>`,
      `<div class="chat-outcome"><span class="chat-outcome__label">Goal Odds</span><span class="chat-outcome__value ${s.goalProbability >= 50 ? 'chat-outcome__value--teal' : 'chat-outcome__value--coral'}">${formatPercent(s.goalProbability)}</span></div>`,
      `<div class="chat-outcome"><span class="chat-outcome__label">Ruin Risk</span><span class="chat-outcome__value ${s.ruinProbability <= 10 ? 'chat-outcome__value--teal' : 'chat-outcome__value--coral'}">${formatPercent(s.ruinProbability)}</span></div>`,
      `<div class="chat-outcome"><span class="chat-outcome__label">Emergency Fund</span><span class="chat-outcome__value ${metrics && metrics.emergencyMonths >= 6 ? 'chat-outcome__value--teal' : 'chat-outcome__value--coral'}">${metrics ? metrics.emergencyMonths.toFixed(1) : '0.0'} mo</span></div>`,
      '</div>',
      comparison,
      topInsight ? `<p>Main issue: <strong>${localEscapeHtml(topInsight.title)}</strong>. ${localEscapeHtml(topInsight.message)}</p>` : '',
      '</div>'
    ].join('');
  }

  function buildLocalAdviceResponse(profile, results, behavioralReport) {
    const s = results?.stats;
    const metrics = getLocalProfileMetrics(profile);
    const actions = [];

    if (metrics && metrics.emergencyMonths < 6) {
      actions.push(`Build emergency liquidity to at least 6 months. You are currently at ${metrics.emergencyMonths.toFixed(1)} months.`);
    }
    if (metrics && metrics.savingsRate < 20) {
      actions.push(`Raise your savings rate toward 20%+. Right now it is about ${metrics.savingsRate.toFixed(1)}%.`);
    }
    if (metrics && metrics.expenseRatio > 60) {
      actions.push(`Lower fixed spending. Roughly ${metrics.expenseRatio.toFixed(0)}% of gross income is already going to expenses.`);
    }
    if (s && s.goalProbability < 50) {
      actions.push('Improve goal odds by increasing investable surplus, extending the timeline, or reducing the target.');
    }
    if (s && s.ruinProbability > 10) {
      actions.push('Prioritize resilience before taking more risk. Cash runway is a better lever than chasing returns here.');
    }

    const recommendations = behavioralReport?.insights
      ?.filter(insight => insight.recommendation)
      .slice(0, 2)
      .map(insight => insight.recommendation) || [];

    recommendations.forEach((item) => {
      if (!actions.includes(item)) actions.push(item);
    });

    const finalActions = actions.slice(0, 4);

    if (!finalActions.length) {
      finalActions.push('Keep your current trajectory steady and review major expenses before taking on new commitments.');
      finalActions.push('Use scenario testing for large decisions like a house purchase, job switch, or higher-risk investing.');
    }

    return [
      '<div class="chat-section">',
      '<div class="chat-section__header"><span class="chat-section__icon">ADV</span> What To Improve</div>',
      '<ul>',
      finalActions.map(action => `<li>${localEscapeHtml(action)}</li>`).join(''),
      '</ul>',
      '</div>'
    ].join('');
  }

  function buildLocalGoalResponse(results) {
    const s = results?.stats;
    if (!s || !s.goalAmount) {
      return '<p>You have not set a target corpus yet. Add a goal amount in the form and I can judge the probability of reaching it.</p>';
    }

    let guidance = 'The goal is possible, but not comfortable. Small improvements in savings rate or timeline would help.';
    if (s.goalProbability >= 75) {
      guidance = 'You are broadly on track for the current target if your saving discipline holds.';
    } else if (s.goalProbability < 40) {
      guidance = 'The current path makes the goal a stretch. Income, savings rate, or the timeline likely need to change.';
    }

    return [
      '<div class="chat-section">',
      '<div class="chat-section__header"><span class="chat-section__icon">GOAL</span> Goal Feasibility</div>',
      `<p>Your current target is ${formatINRShort(s.goalAmount)}. The simulation puts the success probability at <strong>${formatPercent(s.goalProbability)}</strong>.</p>`,
      `<p>${localEscapeHtml(guidance)}</p>`,
      `<p>Median 10-year wealth is ${formatINRShort(s.final.median)}, with a downside case near ${formatINRShort(s.final.p5)}.</p>`,
      '</div>'
    ].join('');
  }

  function buildLocalRuinResponse(results) {
    const s = results?.stats;
    if (!s) return '<p>Ruin probability is the chance that savings hit zero or below at any point in the simulation horizon.</p>';

    let interpretation = 'That is a meaningful risk level and worth addressing before taking on more commitments.';
    if (s.ruinProbability <= 5) {
      interpretation = 'That is a relatively contained downside risk.';
    } else if (s.ruinProbability > 20) {
      interpretation = 'That is a high failure risk. Cash-flow resilience is the main problem, not just portfolio choice.';
    }

    return [
      '<div class="chat-section">',
      '<div class="chat-section__header"><span class="chat-section__icon">RISK</span> Ruin Probability</div>',
      `<p>Ruin probability means the chance that your savings go to zero or below at any point during the simulation horizon.</p>`,
      `<p>Your current estimate is <strong>${formatPercent(s.ruinProbability)}</strong>${s.ruinWithin3Prob > 0 ? `, with ${formatPercent(s.ruinWithin3Prob)} happening in the first 3 years` : ''}. ${localEscapeHtml(interpretation)}</p>`,
      '</div>'
    ].join('');
  }

  function buildLocalSavingsResponse(profile, behavioralReport) {
    const metrics = getLocalProfileMetrics(profile);
    if (!metrics) return '<p>I need your salary and monthly expenses to estimate your savings capacity.</p>';

    const monthlySurplusLabel = `${metrics.monthlySurplus >= 0 ? '' : '-'}${formatINRShort(Math.abs(metrics.monthlySurplus))}`;
    let interpretation = 'That is usable, but there is room to improve if your goals are ambitious.';

    if (metrics.savingsRate >= 20) {
      interpretation = 'That is a healthy base for long-term wealth building.';
    } else if (metrics.savingsRate < 10) {
      interpretation = 'That is too thin for most long-term goals and leaves little room for shocks.';
    }

    const recommendation = behavioralReport?.insights?.find(insight =>
      ['good_savings', 'low_savings', 'very_low_savings', 'negative_savings'].includes(insight.id)
    );

    return [
      '<div class="chat-section">',
      '<div class="chat-section__header"><span class="chat-section__icon">SAVE</span> Savings Capacity</div>',
      `<p>Your current savings rate is about <strong>${formatPercent(metrics.savingsRate)}</strong>.</p>`,
      `<p>After tax and current expenses, you have roughly <strong>${monthlySurplusLabel}/month</strong> of free cash flow before extra investing changes. ${localEscapeHtml(interpretation)}</p>`,
      recommendation?.recommendation ? `<p>${localEscapeHtml(recommendation.recommendation)}</p>` : '',
      '</div>'
    ].join('');
  }

  function buildLocalEmergencyResponse(profile) {
    const metrics = getLocalProfileMetrics(profile);
    if (!metrics) return '<p>I need your savings and monthly expenses to estimate your emergency fund runway.</p>';

    let guidance = 'That is workable, but still thinner than ideal.';
    if (metrics.emergencyMonths >= 6) {
      guidance = 'That is a solid buffer for most people.';
    } else if (metrics.emergencyMonths < 3) {
      guidance = 'That is a fragile buffer. One income shock could force debt or asset liquidation.';
    }

    return [
      '<div class="chat-section">',
      '<div class="chat-section__header"><span class="chat-section__icon">CASH</span> Emergency Fund</div>',
      `<p>Your liquid savings cover about <strong>${metrics.emergencyMonths.toFixed(1)} months</strong> of current expenses.</p>`,
      `<p>${localEscapeHtml(guidance)} A common benchmark is 6 months before taking on major risk.</p>`,
      '</div>'
    ].join('');
  }

  function buildLocalExpenseResponse(profile) {
    const metrics = getLocalProfileMetrics(profile);
    if (!metrics) return '<p>I need your salary and expenses to judge whether spending is too high.</p>';

    let guidance = 'Spending is starting to crowd out saving capacity.';
    if (metrics.expenseRatio <= 50) {
      guidance = 'Your spending load is fairly manageable.';
    } else if (metrics.expenseRatio > 70) {
      guidance = 'Spending is the main pressure point in your plan right now.';
    }

    return [
      '<div class="chat-section">',
      '<div class="chat-section__header"><span class="chat-section__icon">EXP</span> Spending Check</div>',
      `<p>Your monthly expense ratio is about <strong>${formatPercent(metrics.expenseRatio, 0)}</strong> of gross monthly income.</p>`,
      `<p>${localEscapeHtml(guidance)} Bringing that closer to 50-60% would improve flexibility.</p>`,
      '</div>'
    ].join('');
  }

  function buildLocalHouseResponse(profile) {
    const budget = estimateHouseBudget(profile);
    if (!budget) return '<p>I need your salary, tax rate, and current expenses to estimate an affordable home budget.</p>';

    return [
      '<div class="chat-section">',
      '<div class="chat-section__header"><span class="chat-section__icon">HOME</span> House Affordability</div>',
      `<p>A reasonable starting EMI is about <strong>${formatINRShort(budget.affordableEmi)}/month</strong>, assuming home costs stay near 30% of net monthly income.</p>`,
      `<p>At roughly 8.5% for 20 years, that points to a home budget around <strong>${formatINRShort(budget.propertyBudget)}</strong> with a 20% down payment.</p>`,
      `<p>This is only a first-pass affordability number. Existing debt, emergency fund strength, and other goals still matter.</p>`,
      '</div>'
    ].join('');
  }

  function buildLocalMetricExplanation(message, results, behavioralReport) {
    const clean = message.toLowerCase();
    const s = results?.stats;

    if (/(goal probability|chance of reaching|probability of reaching)/i.test(clean)) {
      return buildLocalGoalResponse(results);
    }

    if (/(ruin probability|run out of money|going broke|what does ruin mean)/i.test(clean)) {
      return buildLocalRuinResponse(results);
    }

    if (/(median|p50|most likely)/i.test(clean)) {
      return `<p>The median, or P50, is the middle outcome across all simulations. Half of simulated paths finish above it and half finish below it. In your current case, that median is ${s ? `<strong>${formatINRShort(s.final.median)}</strong>` : 'the central outcome'}.</p>`;
    }

    if (/(best case|worst case|p95|p5|percentile)/i.test(clean)) {
      if (!s) {
        return '<p>P95 is the optimistic top 5% outcome, and P5 is the stressed bottom 5% outcome. They show the spread around the plan rather than a guarantee.</p>';
      }
      return `<p>P95 is your optimistic tail at <strong>${formatINRShort(s.final.p95)}</strong>, while P5 is the stressed tail at <strong>${formatINRShort(s.final.p5)}</strong>. The wider the gap, the less predictable the plan.</p>`;
    }

    if (/(health score|financial health)/i.test(clean)) {
      if (!behavioralReport) {
        return '<p>The financial health score is a local score based on savings rate, emergency fund, expense ratio, goal feasibility, and downside risks.</p>';
      }
      return `<p>Your current health score is <strong>${behavioralReport.healthScore}/100</strong>. It is a local composite score based on savings rate, emergency buffer, expense load, and goal feasibility.</p>`;
    }

    return null;
  }

  function buildLocalChartResponse(results) {
    const s = results?.stats;
    if (!s) return '<p>The fan chart shows a range of simulated wealth paths, with darker middle bands representing more likely outcomes.</p>';

    return [
      '<div class="chat-section">',
      '<div class="chat-section__header"><span class="chat-section__icon">CHRT</span> Chart Meaning</div>',
      '<p>The fan chart is showing uncertainty, not one forecast. The middle line is the median path, and the outer bands show downside and upside tails.</p>',
      `<p>For your current numbers, the 10-year spread runs from about ${formatINRShort(s.final.p5)} in the stressed tail to ${formatINRShort(s.final.p95)} in the optimistic tail.</p>`,
      '</div>'
    ].join('');
  }

  function generateGeneralResponse(message, context = {}) {
    const clean = String(message || '').trim().toLowerCase();
    const profile = context.profile || null;
    const results = context.results || null;
    const baselineResults = context.baselineResults || results;
    const behavioralReport = context.behavioralReport || null;
    const scenario = context.scenario || { id: 'baseline', name: 'Current Scenario' };
    const hasResults = Boolean(results?.stats);

    if (!clean) {
      return buildLocalHelpResponse(hasResults);
    }

    if (/^(hi|hello|hey|help)\b|what can you do|how can you help/i.test(clean)) {
      return buildLocalHelpResponse(hasResults);
    }

    const metricExplanation = buildLocalMetricExplanation(clean, results, behavioralReport);
    if (metricExplanation) {
      return metricExplanation;
    }

    if (/(how am i doing|am i on track|where do i stand|overall|summary|review my finances|assess my plan|status)/i.test(clean)) {
      return buildLocalStatusResponse(profile, results, baselineResults, behavioralReport, scenario);
    }

    if (/(what should i do|what should i improve|how can i improve|next step|recommend|advice|what do you suggest|optimize)/i.test(clean)) {
      return buildLocalAdviceResponse(profile, results, behavioralReport);
    }

    if (/(goal|target|can i reach|will i reach)/i.test(clean)) {
      return buildLocalGoalResponse(results);
    }

    if (/(emergency fund|runway|buffer)/i.test(clean)) {
      return buildLocalEmergencyResponse(profile);
    }

    if (/(savings rate|save enough|saving enough|monthly save|surplus|free cash flow)/i.test(clean)) {
      return buildLocalSavingsResponse(profile, behavioralReport);
    }

    if (/(expense ratio|spending too much|expenses too high|cut expenses|reduce spending)/i.test(clean)) {
      return buildLocalExpenseResponse(profile);
    }

    if (/(afford.*house|afford.*home|home budget|house budget|buy a house|buying a house)/i.test(clean)) {
      return buildLocalHouseResponse(profile);
    }

    if (/(chart|graph|fan chart|visualization)/i.test(clean)) {
      return buildLocalChartResponse(results);
    }

    if (hasResults) {
      return [
        buildLocalStatusResponse(profile, results, baselineResults, behavioralReport, scenario),
        buildLocalAdviceResponse(profile, results, behavioralReport)
      ].join('');
    }

    return buildLocalHelpResponse(false);
  }

  return {
    detectIntent,
    buildScenarioFromIntent,
    buildClonedScenario,
    buildAiContext,
    generateChatResponse,
    generateGeneralResponse,
    getUnknownIntentResponse,
    getRandomPrompts,
    getContextualPrompts,
    formatINRShort,
    SUGGESTED_PROMPTS
  };
})();

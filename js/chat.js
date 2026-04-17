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

  return {
    detectIntent,
    buildScenarioFromIntent,
    buildAiContext,
    generateChatResponse,
    getUnknownIntentResponse,
    getRandomPrompts,
    formatINRShort,
    SUGGESTED_PROMPTS
  };
})();

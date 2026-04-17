/**
 * Behavioral Intelligence Engine
 * Detects patterns in user financial behavior and generates personalized insights
 */

const BehavioralEngine = (() => {
  const SEVERITY = { INFO: 'info', WARNING: 'warning', CRITICAL: 'critical' };

  /**
   * Analyze user profile and simulation results for behavioral patterns
   * @param {Object} profile - { age, salary, savings, monthlyExpenses, goalAmount }
   * @param {Object} results - simulation results
   * @param {Object} baselineResults - baseline simulation results
   * @param {Object} scenario - active scenario
   * @returns {Object} BehavioralReport
   */
  function analyze(profile, results, baselineResults, scenario) {
    const insights = [];

    // --- 1. Savings Rate Analysis ---
    const annualExpenses = profile.monthlyExpenses * 12;
    const savingsRate = ((profile.salary - annualExpenses) / profile.salary) * 100;

    if (savingsRate < 0) {
      insights.push({
        id: 'negative_savings',
        category: 'Savings Rate',
        icon: '🔴',
        severity: SEVERITY.CRITICAL,
        title: 'Negative Savings Rate',
        message: `You're spending more than you earn. Your annual expenses (${formatINR(annualExpenses)}) exceed your salary (${formatINR(profile.salary)}). This is unsustainable and leads to debt accumulation.`,
        metric: savingsRate.toFixed(1) + '%',
        recommendation: 'Reduce monthly expenses or increase income immediately. Target a positive savings rate of at least 20%.'
      });
    } else if (savingsRate < 10) {
      insights.push({
        id: 'very_low_savings',
        category: 'Savings Rate',
        icon: '🟠',
        severity: SEVERITY.WARNING,
        title: 'Very Low Savings Rate',
        message: `Your savings rate is only ${savingsRate.toFixed(1)}%. At this rate, wealth accumulation will be extremely slow. Most of your income is consumed by expenses.`,
        metric: savingsRate.toFixed(1) + '%',
        recommendation: 'Aim for a 20-30% savings rate. Even a 5% increase in savings rate can compound significantly over 10 years.'
      });
    } else if (savingsRate < 20) {
      insights.push({
        id: 'low_savings',
        category: 'Savings Rate',
        icon: '🟡',
        severity: SEVERITY.INFO,
        title: 'Below-Average Savings Rate',
        message: `Your savings rate of ${savingsRate.toFixed(1)}% is below the recommended 20%+ threshold for strong wealth building.`,
        metric: savingsRate.toFixed(1) + '%',
        recommendation: 'Consider automating savings. Increase savings rate by 2-3% each year to reach the 20% benchmark.'
      });
    } else {
      insights.push({
        id: 'good_savings',
        category: 'Savings Rate',
        icon: '🟢',
        severity: SEVERITY.INFO,
        title: 'Healthy Savings Rate',
        message: `Your savings rate of ${savingsRate.toFixed(1)}% is strong. You're building wealth efficiently.`,
        metric: savingsRate.toFixed(1) + '%',
        recommendation: null
      });
    }

    // --- 2. Emergency Fund Check ---
    const emergencyMonths = profile.savings / profile.monthlyExpenses;

    if (emergencyMonths < 3) {
      insights.push({
        id: 'no_emergency_fund',
        category: 'Emergency Fund',
        icon: '🚨',
        severity: SEVERITY.CRITICAL,
        title: 'Insufficient Emergency Fund',
        message: `Your savings cover only ${emergencyMonths.toFixed(1)} months of expenses. The recommended minimum is 6 months. Any income disruption could be financially devastating.`,
        metric: emergencyMonths.toFixed(1) + ' months',
        recommendation: 'Prioritize building an emergency fund of 6 months\' expenses before investing aggressively.'
      });
    } else if (emergencyMonths < 6) {
      insights.push({
        id: 'low_emergency_fund',
        category: 'Emergency Fund',
        icon: '⚠️',
        severity: SEVERITY.WARNING,
        title: 'Thin Emergency Buffer',
        message: `Your ${emergencyMonths.toFixed(1)}-month buffer is below the recommended 6-month minimum. Job loss or medical emergencies could deplete it quickly.`,
        metric: emergencyMonths.toFixed(1) + ' months',
        recommendation: 'Build to 6 months of expenses in a liquid account before taking on financial risk.'
      });
    }

    // --- 3. Expense-to-Income Ratio ---
    const expenseRatio = (profile.monthlyExpenses / (profile.salary / 12)) * 100;

    if (expenseRatio > 80) {
      insights.push({
        id: 'extreme_expense_ratio',
        category: 'Expense Ratio',
        icon: '💸',
        severity: SEVERITY.CRITICAL,
        title: 'Extremely High Expense Ratio',
        message: `${expenseRatio.toFixed(0)}% of your monthly income goes to expenses. You have almost no margin for savings or investment.`,
        metric: expenseRatio.toFixed(0) + '%',
        recommendation: 'Audit your expenses. Identify and cut non-essential spending to bring this below 60%.'
      });
    } else if (expenseRatio > 60) {
      insights.push({
        id: 'high_expense_ratio',
        category: 'Expense Ratio',
        icon: '📊',
        severity: SEVERITY.WARNING,
        title: 'High Expense Ratio',
        message: `${expenseRatio.toFixed(0)}% of income consumed by expenses. Limited room for wealth building.`,
        metric: expenseRatio.toFixed(0) + '%',
        recommendation: 'Target the 50/30/20 rule: 50% needs, 30% wants, 20% savings.'
      });
    }

    // --- 4. Goal Feasibility ---
    if (results && results.stats.goalAmount > 0) {
      const goalProb = results.stats.goalProbability;
      if (goalProb < 20) {
        insights.push({
          id: 'unrealistic_goal',
          category: 'Goal Achievement',
          icon: '🎯',
          severity: SEVERITY.CRITICAL,
          title: 'Goal Likely Unreachable',
          message: `Only ${goalProb.toFixed(1)}% probability of reaching your ${formatINR(results.stats.goalAmount)} goal. This target may be unrealistic given your current income and savings pattern.`,
          metric: goalProb.toFixed(0) + '% chance',
          recommendation: 'Either increase income/savings rate significantly, extend the time horizon, or set a more achievable target.'
        });
      } else if (goalProb < 40) {
        insights.push({
          id: 'difficult_goal',
          category: 'Goal Achievement',
          icon: '🎯',
          severity: SEVERITY.WARNING,
          title: 'Goal Is a Stretch',
          message: `${goalProb.toFixed(1)}% probability of reaching your goal. It's possible but requires favorable market conditions and consistent saving.`,
          metric: goalProb.toFixed(0) + '% chance',
          recommendation: 'Increase monthly savings by 10-15% or extend your timeline to improve probability above 50%.'
        });
      }
    }

    // --- 5. Lifestyle Inflation Risk ---
    if (scenario) {
      const incomeGrowth = (scenario.incomeGrowthMean || 0.06) * 100;
      const expenseInflation = (scenario.expenseInflationMean || 0.05) * 100;
      const gap = incomeGrowth - expenseInflation;

      if (gap <= 0) {
        insights.push({
          id: 'lifestyle_inflation',
          category: 'Lifestyle Inflation',
          icon: '📈',
          severity: SEVERITY.WARNING,
          title: 'Lifestyle Inflation Risk',
          message: `Your expense growth (${expenseInflation.toFixed(0)}%/yr) equals or exceeds income growth (${incomeGrowth.toFixed(0)}%/yr). Over time, your disposable income will shrink.`,
          metric: gap.toFixed(1) + '% gap',
          recommendation: 'Keep expense growth at least 2-3% below income growth to ensure increasing savings capacity.'
        });
      } else if (gap < 2) {
        insights.push({
          id: 'thin_growth_margin',
          category: 'Lifestyle Inflation',
          icon: '📉',
          severity: SEVERITY.INFO,
          title: 'Narrow Growth Margin',
          message: `Only a ${gap.toFixed(1)}% gap between income growth and expense inflation. Savings growth is slow.`,
          metric: gap.toFixed(1) + '% gap',
          recommendation: 'Widen this gap by controlling discretionary spending growth.'
        });
      }
    }

    // --- 6. Age-Adjusted Risk Assessment ---
    if (profile.age > 45 && scenario && (scenario.id === 'quit_job' || scenario.id === 'aggressive')) {
      insights.push({
        id: 'age_risk',
        category: 'Age Factor',
        icon: '⏳',
        severity: SEVERITY.WARNING,
        title: 'Higher Risk for Your Age',
        message: `At age ${profile.age}, high-risk strategies have less recovery time. A major loss in your 50s is harder to recover from than in your 20s.`,
        metric: `${65 - profile.age} yrs to retire`,
        recommendation: 'Consider a more balanced approach. Reduce equity allocation and maintain a larger emergency buffer.'
      });
    }

    // --- 7. Wealth-to-Income Ratio ---
    const wealthToIncome = profile.savings / profile.salary;
    const expectedRatio = Math.max(0.5, (profile.age - 25) * 0.15); // rough benchmark

    if (wealthToIncome < expectedRatio * 0.5 && profile.age > 30) {
      insights.push({
        id: 'behind_wealth',
        category: 'Wealth Building',
        icon: '📋',
        severity: SEVERITY.WARNING,
        title: 'Behind on Wealth Building',
        message: `Your savings (${formatINR(profile.savings)}) represent only ${(wealthToIncome * 100).toFixed(0)}% of your annual salary. At age ${profile.age}, a typical benchmark would be ${(expectedRatio * 100).toFixed(0)}%+ of annual income saved.`,
        metric: (wealthToIncome * 100).toFixed(0) + '% of salary',
        recommendation: 'Accelerate savings. Consider automating 20%+ of income into investments.'
      });
    }

    return {
      insights,
      summary: buildSummary(insights),
      healthScore: computeHealthScore(insights),
      savingsRate,
      emergencyMonths,
      expenseRatio
    };
  }

  function buildSummary(insights) {
    const critical = insights.filter(i => i.severity === SEVERITY.CRITICAL);
    const warnings = insights.filter(i => i.severity === SEVERITY.WARNING);

    if (critical.length > 0) {
      return `${critical.length} critical issue${critical.length > 1 ? 's' : ''} detected. Immediate action recommended.`;
    }
    if (warnings.length > 0) {
      return `${warnings.length} area${warnings.length > 1 ? 's' : ''} need${warnings.length === 1 ? 's' : ''} attention. Review behavioral insights below.`;
    }
    return 'Your financial behavior appears healthy. Keep it up.';
  }

  function computeHealthScore(insights) {
    let score = 100;
    for (const insight of insights) {
      if (insight.severity === SEVERITY.CRITICAL) score -= 25;
      else if (insight.severity === SEVERITY.WARNING) score -= 12;
      // INFO with positive message doesn't reduce
      else if (insight.recommendation) score -= 3;
    }
    return Math.max(0, Math.min(100, score));
  }

  function getHealthLabel(score) {
    if (score >= 80) return { label: 'Excellent', color: '#00d4aa', icon: '💚' };
    if (score >= 60) return { label: 'Good', color: '#4ade80', icon: '💛' };
    if (score >= 40) return { label: 'Needs Work', color: '#ffd93d', icon: '🟠' };
    if (score >= 20) return { label: 'Poor', color: '#ff9f43', icon: '🔴' };
    return { label: 'Critical', color: '#ff6b6b', icon: '🚨' };
  }

  function formatINR(value) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e7) return sign + '₹' + (abs / 1e7).toFixed(1) + ' Cr';
    if (abs >= 1e5) return sign + '₹' + (abs / 1e5).toFixed(1) + ' L';
    return sign + '₹' + abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  return { analyze, getHealthLabel, SEVERITY };
})();

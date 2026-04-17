/**
 * Predefined Financial Scenarios
 * Each scenario defines income overrides, return assumptions, and extra expenses
 */

const Scenarios = {
  baseline: {
    id: 'baseline',
    name: 'Continue Working',
    icon: '💼',
    description: 'Stay in your current job with normal salary growth and investment returns.',
    incomeGrowthMean: 0.06,
    incomeGrowthStd: 0.03,
    returnMean: 0.10,
    returnStd: 0.18,
    expenseInflationMean: 0.05,
    expenseInflationStd: 0.02,
    riskLevel: 'low',
    incomeOverride: null,
    extraAnnualExpense: null,
    wealthAdjustment: null
  },

  quit_job: {
    id: 'quit_job',
    name: 'Quit & Start Business',
    icon: '🚀',
    description: 'Leave your job to start a business. High risk, high potential reward.',
    incomeGrowthMean: 0.06,
    incomeGrowthStd: 0.03,
    returnMean: 0.10,
    returnStd: 0.18,
    expenseInflationMean: 0.06,
    expenseInflationStd: 0.03,
    riskLevel: 'high',

    incomeOverride: (baseSalary, year, ctx) => {
      // Year 1: zero income (building phase)
      if (year === 1) {
        return { income: 0, businessStarted: true };
      }

      // Year 2: 30% chance of some income, 70% still burning savings
      if (year === 2) {
        const r = Math.random();
        if (r < 0.3) {
          return { income: baseSalary * 0.3, businessStarted: true };
        }
        return { income: 0, businessStarted: true };
      }

      // Year 3+: Bimodal — business succeeds or fails
      const successProb = 0.35 + Math.min(year * 0.03, 0.15); // Increases slightly over time
      const r = Math.random();

      if (r < successProb) {
        // Success path: income grows significantly
        const growthFactor = 1 + (year - 2) * 0.25; // Compound success
        const businessIncome = baseSalary * growthFactor * (0.8 + Math.random() * 0.6);
        return { income: Math.max(0, businessIncome), businessStarted: true };
      } else if (r < successProb + 0.25) {
        // Moderate path: some income but less than salary
        return { income: baseSalary * (0.3 + Math.random() * 0.4), businessStarted: true };
      } else {
        // Struggle path: minimal income
        return { income: baseSalary * Math.random() * 0.2, businessStarted: true };
      }
    },

    extraAnnualExpense: (year, profile) => {
      // Business startup costs
      if (year === 1) return profile.salary * 0.15;
      if (year === 2) return profile.salary * 0.08;
      return 0;
    },

    wealthAdjustment: null
  },

  aggressive: {
    id: 'aggressive',
    name: 'Aggressive Investing',
    icon: '📈',
    description: 'Higher equity allocation. Better expected returns, more volatility.',
    incomeGrowthMean: 0.06,
    incomeGrowthStd: 0.03,
    returnMean: 0.14,     // Higher returns
    returnStd: 0.25,      // Much higher volatility
    expenseInflationMean: 0.05,
    expenseInflationStd: 0.02,
    riskLevel: 'medium-high',
    incomeOverride: null,
    extraAnnualExpense: null,
    wealthAdjustment: null
  },

  buy_house: {
    id: 'buy_house',
    name: 'Buy a House',
    icon: '🏠',
    description: 'Take a home loan. High monthly EMI but building equity in property.',
    incomeGrowthMean: 0.06,
    incomeGrowthStd: 0.03,
    returnMean: 0.10,
    returnStd: 0.18,
    expenseInflationMean: 0.05,
    expenseInflationStd: 0.02,
    riskLevel: 'medium',
    incomeOverride: null,

    extraAnnualExpense: (year, profile) => {
      // EMI: roughly 40% of monthly salary
      // Typical Indian home loan: 20 year term, 8.5% interest
      const monthlyEMI = profile.salary / 12 * 0.40;
      return monthlyEMI * 12;
    },

    wealthAdjustment: (year, profile) => {
      // Property appreciation: ~5-7% per year on original property value
      // Property value ≈ 5x annual salary (typical urban India)
      if (year === 1) return 0; // No immediate equity gain
      const propertyValue = profile.salary * 5;
      // Annual equity accumulation through principal repayment + appreciation
      const annualAppreciation = propertyValue * 0.02; // Net equity gain per year (conservative)
      return annualAppreciation;
    }
  },

  career_switch: {
    id: 'career_switch',
    name: 'Career Switch',
    icon: '🔄',
    description: 'Switch to a new field. Short-term salary cut, long-term higher growth.',
    incomeGrowthMean: 0.10,    // Higher growth after switch
    incomeGrowthStd: 0.05,
    returnMean: 0.10,
    returnStd: 0.18,
    expenseInflationMean: 0.05,
    expenseInflationStd: 0.02,
    riskLevel: 'medium',

    incomeOverride: (baseSalary, year, ctx) => {
      if (year === 1) {
        // Transition year: 60-80% of current salary
        const cut = 0.6 + Math.random() * 0.2;
        return { income: baseSalary * cut };
      }

      if (year === 2) {
        // Still ramping: 70-90%
        const recovery = 0.7 + Math.random() * 0.2;
        return { income: baseSalary * recovery };
      }

      // Year 3+: Accelerated growth in new field
      const growthFactor = Math.pow(1.10 + Math.random() * 0.05, year - 2);
      return { income: baseSalary * 0.85 * growthFactor };
    },

    extraAnnualExpense: (year, profile) => {
      // Training/upskilling costs in year 1
      if (year === 1) return profile.salary * 0.05;
      return 0;
    },

    wealthAdjustment: null
  },

  custom: {
    id: 'custom',
    name: 'Custom Scenario',
    icon: '⚙️',
    description: 'Define your own parameters for income change, returns, and expenses.',
    incomeGrowthMean: 0.06,
    incomeGrowthStd: 0.03,
    returnMean: 0.10,
    returnStd: 0.18,
    expenseInflationMean: 0.05,
    expenseInflationStd: 0.02,
    riskLevel: 'custom',
    incomeOverride: null,
    extraAnnualExpense: null,
    wealthAdjustment: null
  }
};

/**
 * Get a scenario with custom parameter overrides
 */
function getScenarioWithOverrides(scenarioId, overrides = {}) {
  const base = { ...Scenarios[scenarioId] };
  return { ...base, ...overrides };
}

/**
 * Compute a risk score (0-100) from simulation results
 */
function computeRiskScore(stats) {
  let score = 0;

  // Ruin probability contributes heavily
  score += stats.ruinProbability * 0.5;

  // Downside variance
  const downside = Math.max(0, stats.final.median - stats.final.p5);
  const upsideRatio = stats.final.median > 0
    ? downside / stats.final.median
    : 1;
  score += Math.min(upsideRatio * 20, 25);

  // Low goal probability
  score += Math.max(0, (100 - stats.goalProbability) * 0.15);

  // Short-term ruin risk
  score += stats.ruinWithin3Prob * 0.3;

  return Math.min(100, Math.round(score));
}

function getRiskLabel(score) {
  if (score < 20) return { label: 'Low Risk', class: 'low', color: '#00d4aa' };
  if (score < 45) return { label: 'Moderate Risk', class: 'medium', color: '#ffd93d' };
  if (score < 70) return { label: 'High Risk', class: 'high', color: '#ff9f43' };
  return { label: 'Very High Risk', class: 'extreme', color: '#ff6b6b' };
}

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
 * Build Buy a House scenario from user inputs
 */
function buildBuyHouseScenario(params) {
  const {
    propertyPrice = 5000000,
    downPayment = 1000000,
    interestRate = 8.5,
    tenureYears = 20,
    monthlyMaintenance = 3000
  } = params;

  const loanAmount = Math.max(0, propertyPrice - downPayment);
  const monthlyRate = (interestRate / 100) / 12;
  const totalMonths = tenureYears * 12;

  // EMI = P * r * (1+r)^n / ((1+r)^n - 1)
  let monthlyEMI = 0;
  if (loanAmount > 0 && monthlyRate > 0) {
    const factor = Math.pow(1 + monthlyRate, totalMonths);
    monthlyEMI = loanAmount * monthlyRate * factor / (factor - 1);
  }

  const annualEMI = monthlyEMI * 12;
  const annualMaintenance = monthlyMaintenance * 12;

  return {
    ...Scenarios.buy_house,
    _userParams: params,
    _computedEMI: monthlyEMI,

    extraAnnualExpense: (year, profile) => {
      // EMI only within loan tenure
      const emiCost = year <= tenureYears ? annualEMI : 0;
      return emiCost + annualMaintenance;
    },

    wealthAdjustment: (year, profile) => {
      if (year === 1) {
        // Down payment deducted (already part of savings reduction)
        return 0;
      }
      // Property appreciation: ~5% per year on original value (conservative net equity gain)
      const annualAppreciation = propertyPrice * 0.02;
      return annualAppreciation;
    }
  };
}

/**
 * Build Aggressive Investing scenario from user inputs
 */
function buildAggressiveScenario(params) {
  const {
    initialInvestment = 100000,
    monthlyInvestment = 10000,
    durationYears = 10,
    returnProfile = 'aggressive',
    crashBehavior = 'hold'
  } = params;

  // Map return profile to mean/std
  const profiles = {
    moderate:        { returnMean: 0.11, returnStd: 0.16 },
    aggressive:      { returnMean: 0.15, returnStd: 0.25 },
    very_aggressive: { returnMean: 0.20, returnStd: 0.32 }
  };

  const { returnMean, returnStd } = profiles[returnProfile] || profiles.aggressive;

  // Crash behavior modifiers applied via wealthAdjustment
  // "hold" = default (no modifier)
  // "sell" = during drawdowns, lock in losses (reduce wealth by extra %)
  // "invest_more" = during drawdowns, add extra investment (boost recovery)

  return {
    ...Scenarios.aggressive,
    returnMean,
    returnStd,
    riskLevel: returnProfile === 'very_aggressive' ? 'very-high' : 'medium-high',
    _userParams: params,

    wealthAdjustment: (year, profile) => {
      // Additional monthly investment over standard savings
      const extraAnnualInvestment = monthlyInvestment * 12;

      // Simulate crash behavior effect (stochastic)
      let crashModifier = 0;
      if (crashBehavior === 'sell') {
        // 20% chance of panic selling in any year → lose 5% of wealth
        if (Math.random() < 0.20) {
          crashModifier = -(profile.savings || 0) * 0.05;
        }
      } else if (crashBehavior === 'invest_more') {
        // 20% chance of a dip → add extra 50% of monthly investment that year
        if (Math.random() < 0.20) {
          crashModifier = monthlyInvestment * 6; // 6 months extra
        }
      }

      // Initial lump sum in year 1
      const lumpSum = year === 1 ? initialInvestment : 0;

      return extraAnnualInvestment + lumpSum + crashModifier;
    }
  };
}

/**
 * Build Career Switch scenario from user inputs
 */
function buildCareerSwitchScenario(params) {
  const {
    jobStability = 'medium',
    switchTimeYears = 1,
    expectedStartSalary = 600000,
    expectedGrowthRate = 12,
    incomeGapMonths = 3
  } = params;

  // Job stability affects income variance
  const stabilityVariance = {
    low:    0.10,  // ±10% annual income volatility
    medium: 0.05,  // ±5%
    high:   0.02   // ±2%
  };

  const incomeStd = stabilityVariance[jobStability] || 0.05;
  const growthRate = expectedGrowthRate / 100;
  const gapYears = incomeGapMonths / 12;
  const switchYears = Math.max(0.5, switchTimeYears);

  return {
    ...Scenarios.career_switch,
    incomeGrowthMean: growthRate,
    incomeGrowthStd: incomeStd,
    riskLevel: jobStability === 'low' ? 'high' : jobStability === 'high' ? 'low' : 'medium',
    _userParams: params,

    incomeOverride: (baseSalary, year, ctx) => {
      // Income gap period: zero income
      if (year <= gapYears) {
        return { income: 0 };
      }

      // Switch/ramp-up period
      const adjustedYear = year - gapYears;
      if (adjustedYear <= switchYears) {
        // Linear ramp from 0 to start salary
        const rampFraction = adjustedYear / switchYears;
        const rampedSalary = expectedStartSalary * rampFraction;
        const noise = 1 + (Math.random() - 0.5) * incomeStd * 2;
        return { income: Math.max(0, rampedSalary * noise) };
      }

      // Post-switch: grow from start salary at expected growth rate
      const yearsAfterSwitch = adjustedYear - switchYears;
      const grownSalary = expectedStartSalary * Math.pow(1 + growthRate, yearsAfterSwitch);
      const noise = 1 + (Math.random() - 0.5) * incomeStd * 2;
      return { income: Math.max(0, grownSalary * noise) };
    },

    extraAnnualExpense: (year, profile) => {
      // Upskilling cost in first year
      if (year === 1) return profile.salary * 0.05;
      return 0;
    }
  };
}

/**
 * Build Start a Business scenario from user inputs
 */
function buildBusinessScenario(params) {
  const {
    investmentAmount = 300000,
    businessRisk = 'medium',
    timeCommitment = 'full_time'
  } = params;

  // Risk level affects success probability distribution
  const riskProfiles = {
    low:    { baseSuccessProb: 0.50, incomeMultiplier: 0.8, startupCostMultiplier: 0.5 },
    medium: { baseSuccessProb: 0.35, incomeMultiplier: 1.0, startupCostMultiplier: 1.0 },
    high:   { baseSuccessProb: 0.20, incomeMultiplier: 1.5, startupCostMultiplier: 1.5 }
  };

  // Time commitment affects returns and speed
  const commitmentModifiers = {
    full_time: { incomeScale: 1.0, rampSpeed: 1.0 },
    part_time: { incomeScale: 0.4, rampSpeed: 0.5 }
  };

  const risk = riskProfiles[businessRisk] || riskProfiles.medium;
  const commitment = commitmentModifiers[timeCommitment] || commitmentModifiers.full_time;

  return {
    ...Scenarios.quit_job,
    riskLevel: businessRisk === 'high' ? 'very-high' : businessRisk === 'low' ? 'medium' : 'high',
    _userParams: params,

    incomeOverride: (baseSalary, year, ctx) => {
      const isPartTime = timeCommitment === 'part_time';
      const partTimeJobIncome = isPartTime ? baseSalary * 0.5 : 0;

      // Year 1: building phase
      if (year === 1) {
        return { income: partTimeJobIncome, businessStarted: true };
      }

      // Year 2: early traction
      if (year === 2) {
        const r = Math.random();
        const earlySuccessProb = risk.baseSuccessProb * 0.5 * commitment.rampSpeed;
        if (r < earlySuccessProb) {
          return { income: partTimeJobIncome + baseSalary * 0.3 * commitment.incomeScale, businessStarted: true };
        }
        return { income: partTimeJobIncome, businessStarted: true };
      }

      // Year 3+: bimodal outcome
      const successProb = risk.baseSuccessProb + Math.min(year * 0.03, 0.15);
      const r = Math.random();

      if (r < successProb) {
        // Success: income grows
        const growthFactor = 1 + (year - 2) * 0.25 * commitment.rampSpeed;
        const businessIncome = baseSalary * growthFactor * risk.incomeMultiplier * commitment.incomeScale;
        const noise = 0.8 + Math.random() * 0.6;
        return { income: Math.max(0, businessIncome * noise) + partTimeJobIncome, businessStarted: true };
      } else if (r < successProb + 0.25) {
        // Moderate
        return { income: baseSalary * (0.3 + Math.random() * 0.4) * commitment.incomeScale + partTimeJobIncome, businessStarted: true };
      } else {
        // Struggle
        return { income: baseSalary * Math.random() * 0.2 * commitment.incomeScale + partTimeJobIncome, businessStarted: true };
      }
    },

    extraAnnualExpense: (year, profile) => {
      if (year === 1) return investmentAmount * risk.startupCostMultiplier;
      if (year === 2) return investmentAmount * 0.2 * risk.startupCostMultiplier;
      return 0;
    },

    wealthAdjustment: null
  };
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

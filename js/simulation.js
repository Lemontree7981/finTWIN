/**
 * Monte Carlo Simulation Engine
 * Runs N simulations of financial trajectories over T years
 */

const SimulationEngine = (() => {
  // --- Random number generators ---

  /** Standard normal via Box-Muller */
  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /** Log-normal return for a given mean & std (annualized) */
  function logNormalReturn(mean, std) {
    // Convert arithmetic mean/std to log-normal parameters
    const mu = Math.log(1 + mean) - 0.5 * std * std;
    const sigma = std;
    return Math.exp(mu + sigma * randn()) - 1;
  }

  /** Normal with clamp */
  function normalClamped(mean, std, min, max) {
    const val = mean + std * randn();
    return Math.max(min, Math.min(max, val));
  }

  // --- Core simulation ---

  /**
   * Run a single simulation path
   * @param {Object} profile - { salary, savings, monthlyExpenses }
   * @param {Object} scenario - scenario definition from Scenarios module
   * @param {number} years - simulation horizon
   * @returns {number[]} wealth at end of each year (length = years+1, index 0 = initial)
   */
  function runSinglePath(profile, scenario, years) {
    const path = [profile.savings];
    let salary = profile.salary;
    let monthlyExpenses = profile.monthlyExpenses;
    let wealth = profile.savings;
    let isBusinessRunning = false;
    let businessStartYear = -1;

    for (let y = 1; y <= years; y++) {
      // --- Income ---
      let annualIncome;

      if (scenario.incomeOverride) {
        const result = scenario.incomeOverride(salary, y, {
          isBusinessRunning,
          businessStartYear,
          profile
        });
        annualIncome = result.income;
        if (result.businessStarted) {
          isBusinessRunning = true;
          if (businessStartYear < 0) businessStartYear = y;
        }
        // Original salary still grows for reference (career switch return etc.)
        salary *= (1 + normalClamped(
          scenario.incomeGrowthMean ?? 0.06,
          scenario.incomeGrowthStd ?? 0.03,
          -0.05, 0.20
        ));
      } else {
        // Normal salary growth
        const growth = normalClamped(
          scenario.incomeGrowthMean ?? 0.06,
          scenario.incomeGrowthStd ?? 0.03,
          -0.05, 0.20
        );
        salary *= (1 + growth);
        annualIncome = salary;
      }

      // --- Expenses ---
      const inflation = normalClamped(
        scenario.expenseInflationMean ?? 0.05,
        scenario.expenseInflationStd ?? 0.02,
        0.01, 0.12
      );
      monthlyExpenses *= (1 + inflation);

      let annualExpenses = monthlyExpenses * 12;

      // Scenario-specific extra expenses (like EMI)
      if (scenario.extraAnnualExpense) {
        annualExpenses += scenario.extraAnnualExpense(y, profile);
      }

      // --- Savings ---
      const netSavings = annualIncome - annualExpenses;

      // --- Investment returns on existing wealth ---
      const investReturn = logNormalReturn(
        scenario.returnMean ?? 0.10,
        scenario.returnStd ?? 0.18
      );

      // Wealth = previous wealth * (1 + return) + net savings this year
      wealth = wealth * (1 + investReturn) + netSavings;

      // Scenario-specific wealth adjustments (e.g., house equity)
      if (scenario.wealthAdjustment) {
        wealth += scenario.wealthAdjustment(y, profile);
      }

      // Floor: can't go below deeply negative (debt limit)
      wealth = Math.max(wealth, -(profile.salary * 2));

      path.push(wealth);
    }

    return path;
  }

  /**
   * Run full Monte Carlo simulation
   * @param {Object} profile - { age, salary, savings, monthlyExpenses, goalAmount }
   * @param {Object} scenario - scenario definition
   * @param {Object} [options] - { years: 10, runs: 1000 }
   * @returns {Object} simulation results
   */
  function simulate(profile, scenario, options = {}) {
    const years = options.years || 10;
    const runs = options.runs || 1000;
    const paths = [];

    for (let i = 0; i < runs; i++) {
      paths.push(runSinglePath(profile, scenario, years));
    }

    // --- Extract statistics ---
    const stats = extractStats(paths, years, profile.goalAmount || 0);

    return {
      paths,
      stats,
      years,
      runs,
      profile,
      scenario: scenario.id
    };
  }

  /**
   * Extract percentile statistics from simulation paths
   */
  function extractStats(paths, years, goalAmount) {
    const runs = paths.length;
    const yearlyStats = [];

    for (let y = 0; y <= years; y++) {
      const values = paths.map(p => p[y]).sort((a, b) => a - b);
      yearlyStats.push({
        year: y,
        p5:     percentile(values, 0.05),
        p10:    percentile(values, 0.10),
        p25:    percentile(values, 0.25),
        median: percentile(values, 0.50),
        p75:    percentile(values, 0.75),
        p90:    percentile(values, 0.90),
        p95:    percentile(values, 0.95),
        mean:   values.reduce((a, b) => a + b, 0) / values.length,
        min:    values[0],
        max:    values[values.length - 1]
      });
    }

    // Final year stats
    const finalValues = paths.map(p => p[years]).sort((a, b) => a - b);

    // Goal probability
    const goalReached = finalValues.filter(v => v >= goalAmount).length;
    const goalProbability = (goalReached / runs) * 100;

    // Ruin probability (savings <= 0 at any point)
    let ruinCount = 0;
    let ruinWithin3Years = 0;
    for (const path of paths) {
      let ruined = false;
      for (let y = 1; y <= years; y++) {
        if (path[y] <= 0) {
          ruined = true;
          if (y <= 3) ruinWithin3Years++;
          break;
        }
      }
      if (ruined) ruinCount++;
    }

    const ruinProbability = (ruinCount / runs) * 100;
    const ruinWithin3Prob = (ruinWithin3Years / runs) * 100;

    // Breakeven year (median crosses initial savings)
    const initialSavings = paths[0][0];
    let breakevenYear = null;
    for (let y = 1; y <= years; y++) {
      if (yearlyStats[y].median >= initialSavings) {
        breakevenYear = y;
        break;
      }
    }

    return {
      yearly: yearlyStats,
      final: {
        median: yearlyStats[years].median,
        p5: yearlyStats[years].p5,
        p95: yearlyStats[years].p95,
        p10: yearlyStats[years].p10,
        p90: yearlyStats[years].p90,
        mean: yearlyStats[years].mean,
        min: yearlyStats[years].min,
        max: yearlyStats[years].max
      },
      goalProbability,
      ruinProbability,
      ruinWithin3Prob,
      breakevenYear,
      goalAmount
    };
  }

  function percentile(sortedArr, p) {
    const idx = p * (sortedArr.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sortedArr[lower];
    return sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (idx - lower);
  }

  return { simulate, runSinglePath };
})();

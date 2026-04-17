/**
 * Planner Engine
 * Adds AI-native planning behaviors on top of the simulator:
 * - free-form life plan extraction
 * - natural-language dashboard controls
 * - session memory helpers
 * - reverse planning / goal seeking
 */

const PlannerEngine = (() => {
  const DEFAULTS = {
    homeInterestRate: 8.5,
    homeTenureYears: 20,
    homeMaintenanceMonthly: 4000,
    homeDownPaymentRatio: 0.20,
    childCostMonthly: 18000,
    childInflation: 0.08
  };

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseAmount(text) {
    if (!text) return null;

    const cleaned = String(text).toLowerCase().replace(/,/g, '').trim();
    const numeric = parseFloat(cleaned.replace(/[^\d.]/g, ''));

    if (!Number.isFinite(numeric)) return null;

    if (/(crore|cr)\b/.test(cleaned)) return numeric * 1e7;
    if (/(lakh|lac|lpa|lakhs)\b/.test(cleaned)) return numeric * 1e5;

    if (/\bl\b/.test(cleaned) && !/(ml|dl|cl)\b/.test(cleaned)) {
      return numeric * 1e5;
    }

    return numeric;
  }

  function parsePercent(text) {
    if (!text) return null;
    const value = parseFloat(String(text).replace(/[^\d.]/g, ''));
    return Number.isFinite(value) ? value : null;
  }

  function formatINRShort(value) {
    const abs = Math.abs(value || 0);
    const sign = value < 0 ? '-' : '';

    if (abs >= 1e7) return `${sign}Rs ${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
    if (abs >= 1e5) return `${sign}Rs ${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
    if (abs >= 1e3) return `${sign}Rs ${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
    return `${sign}Rs ${Math.round(abs)}`;
  }

  function formatPercent(value) {
    return `${(value || 0).toFixed(1)}%`;
  }

  function normalizeYearOffset(offset, fallback = 1) {
    if (!Number.isFinite(offset)) return fallback;
    return Math.max(1, Math.round(offset));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function annualNetIncome(profile) {
    return profile.salary * (1 - (profile.taxRate || 0));
  }

  function currentMonthlySurplus(profile) {
    return Math.max(0, (annualNetIncome(profile) - profile.monthlyExpenses * 12) / 12);
  }

  function computeEmi(loanAmount, annualRate, tenureYears) {
    const monthlyRate = (annualRate / 100) / 12;
    const totalMonths = tenureYears * 12;

    if (loanAmount <= 0 || monthlyRate <= 0 || totalMonths <= 0) return 0;

    const factor = Math.pow(1 + monthlyRate, totalMonths);
    return loanAmount * monthlyRate * factor / (factor - 1);
  }

  function loanAmountFromEmi(monthlyEmi, annualRate, tenureYears) {
    const monthlyRate = (annualRate / 100) / 12;
    const totalMonths = tenureYears * 12;

    if (monthlyEmi <= 0 || monthlyRate <= 0 || totalMonths <= 0) return 0;

    const factor = Math.pow(1 + monthlyRate, totalMonths);
    return monthlyEmi * (factor - 1) / (monthlyRate * factor);
  }

  function detectRiskProfile(text) {
    if (!text) return null;

    if (/(conservative|low[- ]risk|safe|capital[- ]preserving|fixed deposit|fd)/i.test(text)) {
      return 'conservative';
    }

    if (/(aggressive|high[- ]risk|equity-heavy|growth portfolio|all equity)/i.test(text)) {
      return 'aggressive';
    }

    if (/(balanced|moderate|mix of debt and equity)/i.test(text)) {
      return 'balanced';
    }

    return null;
  }

  function getRiskConfig(riskProfile) {
    switch (riskProfile) {
      case 'conservative':
        return { returnMean: 0.07, returnStd: 0.09, incomeGrowthMean: 0.06, riskLevel: 'low' };
      case 'aggressive':
        return { returnMean: 0.13, returnStd: 0.24, incomeGrowthMean: 0.07, riskLevel: 'medium-high' };
      default:
        return { returnMean: 0.10, returnStd: 0.18, incomeGrowthMean: 0.06, riskLevel: 'medium' };
    }
  }

  function extractTimeOffset(text) {
    if (!text) return null;
    const input = String(text).toLowerCase();

    if (/\bthis year\b/.test(input)) return 0;
    if (/\bnext year\b/.test(input)) return 1;
    if (/\bimmediately\b|\bnow\b|\bright away\b|\bsoon\b/.test(input)) return 0;

    const monthMatch = input.match(/(?:in|after)\s+(\d+(?:\.\d+)?)\s*months?/i);
    if (monthMatch) return parseFloat(monthMatch[1]) / 12;

    const yearMatch = input.match(/(?:in|after)\s+(\d+(?:\.\d+)?)\s*years?/i);
    if (yearMatch) return parseFloat(yearMatch[1]);

    return null;
  }

  function findEventYear(message, keywordPattern, fallback = 1) {
    const lower = String(message || '');
    const match = lower.match(new RegExp(`([^,.!?;]*${keywordPattern}[^,.!?;]*)`, 'i'));
    if (match) {
      const offset = extractTimeOffset(match[1]);
      if (offset !== null) return normalizeYearOffset(offset, fallback);
    }
    return normalizeYearOffset(extractTimeOffset(lower), fallback);
  }

  function detectGoalSeek(message, profile) {
    if (!message) return { matched: false };

    const amountMatch = message.match(/(?:want|need|target|reach|get to|build|save|have)\s+(?:about\s+)?(?:rs\.?\s*)?(\d[\d,.]*(?:\s*(?:lakh|lac|l|crore|cr))?)/i);
    const ageMatch = message.match(/(?:by|before|at)\s+age\s+(\d+)/i) || message.match(/(?:by|before|at)\s+(\d+)\s*(?:years?\s+old|yo)\b/i);
    const yearsMatch = message.match(/(?:in|within|over)\s+(\d+(?:\.\d+)?)\s*years?/i);

    const targetAmount = amountMatch ? parseAmount(amountMatch[1]) : null;
    const targetAge = ageMatch ? parseInt(ageMatch[1], 10) : null;
    const years = yearsMatch ? parseFloat(yearsMatch[1]) : (targetAge ? Math.max(1, targetAge - profile.age) : null);

    const wantsPlan = /(?:i want|i need|my goal|target|how do i reach|what do i need|save|build|retire)/i.test(message);
    const purchaseContext = /(?:house|home|flat|property|car|wedding)/i.test(message);
    const goalContext = /(?:goal|target|corpus|net worth|wealth|savings|retire|financial independence)/i.test(message);

    if (!targetAmount || !years || !wantsPlan || (purchaseContext && !goalContext)) {
      return { matched: false };
    }

    return {
      matched: true,
      targetAmount,
      targetAge,
      years: Math.max(1, Math.round(years)),
      riskProfile: detectRiskProfile(message)
    };
  }

  function extractPlanEvents(message, profile) {
    const events = [];
    const riskProfile = detectRiskProfile(message);

    if (/(?:buy|purchase|get)\s+(?:a\s+)?(?:house|home|flat|property)/i.test(message)) {
      const year = findEventYear(message, '(?:house|home|flat|property)', 2);
      const propertyMatch = message.match(/(?:house|home|flat|property)[^,.!?;]*(?:worth|for|costing|budget(?:ed)?\s+at|priced?\s+at)\s*(?:rs\.?\s*)?(\d[\d,.]*(?:\s*(?:lakh|lac|l|crore|cr))?)/i);
      const downPaymentMatch = message.match(/down payment[^,.!?;]*(?:of|at)\s*(?:rs\.?\s*)?(\d[\d,.]*(?:\s*(?:lakh|lac|l|crore|cr))?)/i);
      const propertyPrice = propertyMatch ? parseAmount(propertyMatch[1]) : Math.max(profile.salary * 5, profile.goalAmount * 0.7);
      const downPayment = downPaymentMatch ? parseAmount(downPaymentMatch[1]) : propertyPrice * DEFAULTS.homeDownPaymentRatio;

      events.push({
        type: 'house_purchase',
        year,
        propertyPrice,
        downPayment,
        interestRate: DEFAULTS.homeInterestRate,
        tenureYears: DEFAULTS.homeTenureYears,
        monthlyMaintenance: DEFAULTS.homeMaintenanceMonthly
      });
    }

    if (/(?:have|having|plan for)\s+(?:a\s+)?(?:kid|child|baby)|start(?:ing)?\s+(?:a\s+)?family/i.test(message)) {
      const year = findEventYear(message, '(?:kid|child|baby|family)', 3);
      events.push({
        type: 'child',
        year,
        monthlyCost: Math.max(DEFAULTS.childCostMonthly, profile.monthlyExpenses * 0.20)
      });
    }

    if (/(?:switch|change|move)\s+(?:jobs?|career|roles?)|career switch/i.test(message)) {
      const year = findEventYear(message, '(?:career|job|role)', 1);
      const salaryMatch = message.match(/(?:to|at)\s*(?:rs\.?\s*)?(\d[\d,.]*(?:\s*(?:lakh|lac|l|crore|cr|lpa))?)/i);
      events.push({
        type: 'career_switch',
        year,
        expectedSalary: salaryMatch ? parseAmount(salaryMatch[1]) : profile.salary * 0.95
      });
    }

    if (/(?:lose|lost)\s+(?:my\s+)?job|job loss|laid off|unemployed|retrenched/i.test(message)) {
      const year = findEventYear(message, '(?:job|laid off|unemployed|retrenched)', 1);
      const durationMatch = message.match(/for\s+(\d+)\s*months?/i);
      events.push({
        type: 'job_loss',
        year,
        durationMonths: durationMatch ? parseInt(durationMatch[1], 10) : 6
      });
    }

    if (/(?:retire|retirement)/i.test(message)) {
      const ageMatch = message.match(/(?:at|by|before)\s+age\s+(\d+)/i);
      if (ageMatch) {
        events.push({
          type: 'retirement',
          year: Math.max(1, parseInt(ageMatch[1], 10) - profile.age),
          targetAge: parseInt(ageMatch[1], 10)
        });
      }
    }

    const goal = detectGoalSeek(message, profile);

    return {
      events,
      goal: goal.matched ? goal : null,
      riskProfile
    };
  }

  function detectLifePlan(message, profile) {
    if (!message) return { matched: false };

    const extracted = extractPlanEvents(message, profile);
    const planningSignal = /(?:i want to|my plan|over the next|in \d+ years?|timeline|life plan|maybe)/i.test(message);
    const matched = extracted.events.length >= 2 || (planningSignal && extracted.events.length >= 1);

    if (!matched) {
      return { matched: false };
    }

    const events = extracted.events.sort((a, b) => a.year - b.year);
    const labels = events.map((event) => {
      if (event.type === 'house_purchase') return `house in year ${event.year}`;
      if (event.type === 'child') return `child costs from year ${event.year}`;
      if (event.type === 'career_switch') return `career switch in year ${event.year}`;
      if (event.type === 'job_loss') return `job loss in year ${event.year}`;
      if (event.type === 'retirement') return `retirement by age ${event.targetAge}`;
      return event.type;
    });

    return {
      matched: true,
      plan: {
        events,
        riskProfile: extracted.riskProfile,
        goal: extracted.goal,
        originalMessage: message
      },
      summary: labels
    };
  }

  function detectDashboardControl(message) {
    if (!message) return { matched: false };

    const updates = [];
    let scenarioSelection = null;
    let responseLabel = 'Updated assumptions';

    const salaryMatch = message.match(/(?:set|make|change|update|increase)\s+(?:my\s+)?(?:salary|income)[^0-9a-zA-Z]*(?:to|at)?\s*(?:rs\.?\s*)?(\d[\d,.]*(?:\s*(?:lakh|lac|l|crore|cr|lpa))?)/i);
    if (salaryMatch) {
      updates.push({ field: 'salary', value: parseAmount(salaryMatch[1]), label: `salary -> ${formatINRShort(parseAmount(salaryMatch[1]))}` });
    }

    const expenseMatch = message.match(/(?:set|make|change|update|increase|reduce|lower)\s+(?:my\s+)?(?:expenses|spending)[^0-9a-zA-Z]*(?:to|at)?\s*(?:rs\.?\s*)?(\d[\d,.]*(?:\s*(?:lakh|lac|l|crore|cr))?)/i);
    if (expenseMatch) {
      updates.push({ field: 'monthlyExpenses', value: parseAmount(expenseMatch[1]), label: `expenses -> ${formatINRShort(parseAmount(expenseMatch[1]))}/mo` });
    }

    const savingsMatch = message.match(/(?:set|make|change|update)\s+(?:my\s+)?(?:savings|cash|corpus)[^0-9a-zA-Z]*(?:to|at)?\s*(?:rs\.?\s*)?(\d[\d,.]*(?:\s*(?:lakh|lac|l|crore|cr))?)/i);
    if (savingsMatch) {
      updates.push({ field: 'savings', value: parseAmount(savingsMatch[1]), label: `savings -> ${formatINRShort(parseAmount(savingsMatch[1]))}` });
    }

    const goalMatch = message.match(/(?:set|make|change|update)\s+(?:my\s+)?goal[^0-9a-zA-Z]*(?:to|at)?\s*(?:rs\.?\s*)?(\d[\d,.]*(?:\s*(?:lakh|lac|l|crore|cr))?)/i);
    if (goalMatch) {
      updates.push({ field: 'goalAmount', value: parseAmount(goalMatch[1]), label: `goal -> ${formatINRShort(parseAmount(goalMatch[1]))}` });
    }

    const taxMatch = message.match(/(?:set|make|change|update)\s+(?:my\s+)?tax(?: rate)?[^0-9a-zA-Z]*(?:to|at)?\s*(\d+(?:\.\d+)?)\s*%/i);
    if (taxMatch) {
      updates.push({ field: 'taxRatePercent', value: parseFloat(taxMatch[1]), label: `tax -> ${taxMatch[1]}%` });
    }

    const inflationMatch = message.match(/(?:set|make|change|update|assume)\s+(?:expense\s+)?inflation[^0-9a-zA-Z]*(?:to|at)?\s*(\d+(?:\.\d+)?)\s*%/i);
    if (inflationMatch) {
      scenarioSelection = 'custom';
      updates.push({ field: 'customExpenseInflation', value: parseFloat(inflationMatch[1]), label: `inflation -> ${inflationMatch[1]}%` });
      responseLabel = 'Updated dashboard controls';
    }

    if (/(?:make|set|keep)\s+(?:this|my\s+portfolio|portfolio|investing)\s+(?:more\s+)?conservative/i.test(message)) {
      scenarioSelection = 'custom';
      updates.push({ field: 'customReturnMean', value: 7, label: 'expected return -> 7.0%' });
      updates.push({ field: 'customReturnStd', value: 9, label: 'volatility -> 9.0%' });
      responseLabel = 'Shifted to a conservative portfolio';
    }

    if (/(?:make|set|keep)\s+(?:this|my\s+portfolio|portfolio|investing)\s+(?:more\s+)?aggressive/i.test(message)) {
      scenarioSelection = 'custom';
      updates.push({ field: 'customReturnMean', value: 13, label: 'expected return -> 13.0%' });
      updates.push({ field: 'customReturnStd', value: 24, label: 'volatility -> 24.0%' });
      responseLabel = 'Shifted to an aggressive portfolio';
    }

    if (/(?:make|set)\s+(?:this|my\s+portfolio|portfolio|investing)\s+balanced/i.test(message)) {
      scenarioSelection = 'custom';
      updates.push({ field: 'customReturnMean', value: 10, label: 'expected return -> 10.0%' });
      updates.push({ field: 'customReturnStd', value: 18, label: 'volatility -> 18.0%' });
      responseLabel = 'Shifted to a balanced portfolio';
    }

    if (!updates.length && !scenarioSelection) {
      return { matched: false };
    }

    return {
      matched: true,
      updates,
      scenarioSelection,
      responseLabel
    };
  }

  function buildLifePlanScenario(plan, profile, memory = {}) {
    const riskProfile = plan.riskProfile || memory.riskProfile || 'balanced';
    const riskConfig = getRiskConfig(riskProfile);
    const houseEvent = plan.events.find((event) => event.type === 'house_purchase');
    const childEvents = plan.events.filter((event) => event.type === 'child');
    const careerSwitch = plan.events.find((event) => event.type === 'career_switch');
    const jobLoss = plan.events.find((event) => event.type === 'job_loss');
    const retirement = plan.events.find((event) => event.type === 'retirement');

    const maxEventYear = plan.events.reduce((max, event) => Math.max(max, event.year || 0), 0);
    const years = Math.max(10, maxEventYear + 4, retirement ? retirement.year : 0, plan.goal?.years || 0);

    let houseFinance = null;
    if (houseEvent) {
      const loanAmount = Math.max(0, houseEvent.propertyPrice - houseEvent.downPayment);
      const monthlyEmi = computeEmi(loanAmount, houseEvent.interestRate, houseEvent.tenureYears);
      houseFinance = {
        loanAmount,
        monthlyEmi,
        annualEmi: monthlyEmi * 12,
        annualMaintenance: houseEvent.monthlyMaintenance * 12
      };
    }

    const descriptionBits = [];
    if (houseEvent) descriptionBits.push(`house in year ${houseEvent.year}`);
    if (childEvents.length) descriptionBits.push(`family expenses from year ${childEvents[0].year}`);
    if (careerSwitch) descriptionBits.push(`career switch in year ${careerSwitch.year}`);
    if (jobLoss) descriptionBits.push(`income shock in year ${jobLoss.year}`);

    return {
      scenario: {
        ...Scenarios.baseline,
        id: 'planner_life_plan',
        name: 'AI Life Plan',
        description: descriptionBits.join(', ') || 'Composite plan',
        returnMean: riskConfig.returnMean,
        returnStd: riskConfig.returnStd,
        incomeGrowthMean: careerSwitch ? Math.max(riskConfig.incomeGrowthMean, 0.08) : riskConfig.incomeGrowthMean,
        riskLevel: riskConfig.riskLevel,
        expenseInflationMean: 0.05,
        _plannerMetadata: {
          riskProfile,
          events: plan.events,
          houseFinance
        },
        incomeOverride: (baseSalary, year) => {
          let income = baseSalary;

          if (jobLoss && year === jobLoss.year) {
            income *= Math.max(0, 1 - (jobLoss.durationMonths / 12));
          }

          if (careerSwitch) {
            if (year === careerSwitch.year) {
              income = Math.min(income * 0.80, careerSwitch.expectedSalary || income);
            } else if (year === careerSwitch.year + 1) {
              income = Math.max(careerSwitch.expectedSalary || income, income * 0.92);
            } else if (year > careerSwitch.year + 1) {
              const yearsAfterSwitch = year - careerSwitch.year - 1;
              const referenceSalary = careerSwitch.expectedSalary || income;
              income = referenceSalary * Math.pow(1.10, yearsAfterSwitch);
            }
          }

          if (retirement && year >= retirement.year) {
            income *= 0.20;
          }

          return { income: Math.max(0, income) };
        },
        extraAnnualExpense: (year) => {
          let extraExpense = 0;

          if (houseEvent && houseFinance && year >= houseEvent.year) {
            const houseYear = year - houseEvent.year + 1;
            const emiCost = houseYear <= houseEvent.tenureYears ? houseFinance.annualEmi : 0;
            extraExpense += emiCost + houseFinance.annualMaintenance;
          }

          childEvents.forEach((event) => {
            if (year >= event.year) {
              const childYear = year - event.year;
              extraExpense += event.monthlyCost * 12 * Math.pow(1 + DEFAULTS.childInflation, childYear);
            }
          });

          return extraExpense;
        },
        wealthAdjustment: (year) => {
          let adjustment = 0;

          if (houseEvent) {
            if (year === houseEvent.year) {
              adjustment -= houseEvent.downPayment;
            }
            if (year > houseEvent.year) {
              adjustment += houseEvent.propertyPrice * 0.025;
            }
          }

          return adjustment;
        }
      },
      simulationYears: years,
      assumptions: buildLifePlanAssumptions(plan, profile, riskProfile, houseFinance)
    };
  }

  function buildLifePlanAssumptions(plan, profile, riskProfile, houseFinance) {
    const assumptions = [`Risk stance: ${riskProfile}`];

    plan.events.forEach((event) => {
      if (event.type === 'house_purchase') {
        assumptions.push(`House purchase in year ${event.year} around ${formatINRShort(event.propertyPrice)} with down payment ${formatINRShort(event.downPayment)}`);
        if (houseFinance) assumptions.push(`Estimated EMI about ${formatINRShort(houseFinance.monthlyEmi)}/mo`);
      }
      if (event.type === 'child') {
        assumptions.push(`Family cost step-up starts in year ${event.year} at about ${formatINRShort(event.monthlyCost)}/mo`);
      }
      if (event.type === 'career_switch') {
        assumptions.push(`Career switch in year ${event.year} with a short income dip, then faster growth`);
      }
      if (event.type === 'job_loss') {
        assumptions.push(`Income shock in year ${event.year} for ${event.durationMonths} months`);
      }
      if (event.type === 'retirement') {
        assumptions.push(`Retirement income drops sharply after age ${event.targetAge}`);
      }
    });

    if (plan.goal?.targetAmount) {
      assumptions.push(`Working toward ${formatINRShort(plan.goal.targetAmount)} in about ${plan.goal.years} years`);
    }

    return assumptions;
  }

  function mergeMemory(currentMemory, patch) {
    const next = {
      goal: currentMemory?.goal || null,
      riskProfile: currentMemory?.riskProfile || null,
      plannedEvents: Array.isArray(currentMemory?.plannedEvents) ? [...currentMemory.plannedEvents] : [],
      controls: Object.assign({}, currentMemory?.controls || {})
    };

    if (!patch) return next;

    if (patch.goal) {
      next.goal = { ...patch.goal };
    }

    if (patch.riskProfile) {
      next.riskProfile = patch.riskProfile;
    }

    if (patch.controls) {
      Object.assign(next.controls, patch.controls);
    }

    if (Array.isArray(patch.plannedEvents)) {
      patch.plannedEvents.forEach((event) => {
        const key = `${event.type}:${event.year || event.targetAge || 0}`;
        if (!next.plannedEvents.some((existing) => `${existing.type}:${existing.year || existing.targetAge || 0}` === key)) {
          next.plannedEvents.push({ ...event });
        }
      });
      next.plannedEvents.sort((a, b) => (a.year || 0) - (b.year || 0));
    }

    return next;
  }

  function buildMemoryPatch(message, profile) {
    const patch = {};
    const riskProfile = detectRiskProfile(message);
    if (riskProfile) patch.riskProfile = riskProfile;

    const goal = detectGoalSeek(message, profile);
    if (goal.matched) {
      patch.goal = {
        label: `${formatINRShort(goal.targetAmount)} target`,
        targetAmount: goal.targetAmount,
        years: goal.years,
        targetAge: goal.targetAge || null
      };
    }

    const plan = detectLifePlan(message, profile);
    if (plan.matched) {
      patch.plannedEvents = plan.plan.events.map((event) => ({ ...event }));
      if (plan.plan.goal?.matched) {
        patch.goal = {
          label: `${formatINRShort(plan.plan.goal.targetAmount)} target`,
          targetAmount: plan.plan.goal.targetAmount,
          years: plan.plan.goal.years,
          targetAge: plan.plan.goal.targetAge || null
        };
      }
      if (plan.plan.riskProfile) {
        patch.riskProfile = plan.plan.riskProfile;
      }
    }

    const control = detectDashboardControl(message);
    if (control.matched) {
      patch.controls = {};
      control.updates.forEach((update) => {
        patch.controls[update.field] = update.value;
      });
      if (control.scenarioSelection === 'custom' && !patch.riskProfile) {
        if (control.updates.some((update) => update.field === 'customReturnMean' && update.value <= 7)) {
          patch.riskProfile = 'conservative';
        }
        if (control.updates.some((update) => update.field === 'customReturnMean' && update.value >= 13)) {
          patch.riskProfile = 'aggressive';
        }
      }
    }

    return patch;
  }

  function buildMemorySummary(memory) {
    if (!memory) return [];

    const summary = [];

    if (memory.goal?.targetAmount) {
      const timing = memory.goal.targetAge ? `by age ${memory.goal.targetAge}` : `in ${memory.goal.years}y`;
      summary.push(`Goal: ${formatINRShort(memory.goal.targetAmount)} ${timing}`);
    }

    if (memory.riskProfile) {
      summary.push(`Risk: ${memory.riskProfile}`);
    }

    (memory.plannedEvents || []).slice(0, 4).forEach((event) => {
      if (event.type === 'house_purchase') summary.push(`House in ${event.year}y`);
      if (event.type === 'child') summary.push(`Child in ${event.year}y`);
      if (event.type === 'career_switch') summary.push(`Career switch in ${event.year}y`);
      if (event.type === 'job_loss') summary.push(`Income shock in ${event.year}y`);
      if (event.type === 'retirement') summary.push(`Retire at ${event.targetAge}`);
    });

    return summary.slice(0, 6);
  }

  function getSuggestedPrompts(memory) {
    const prompts = [];

    if (memory?.goal?.targetAmount) {
      prompts.push('What monthly investing do I need for that goal?');
    } else {
      prompts.push('I want Rs 1 crore by age 40');
    }

    if (memory?.plannedEvents?.some((event) => event.type === 'house_purchase')) {
      prompts.push('What if I delay the house by 18 months?');
    } else {
      prompts.push('I want to buy a house in 2 years and switch jobs in 4 years');
    }

    if (memory?.riskProfile) {
      prompts.push('Would a balanced portfolio improve my odds?');
    } else {
      prompts.push('Make this a conservative portfolio');
    }

    prompts.push('Set inflation to 6%');

    return [...new Set(prompts)].slice(0, 4);
  }

  function estimateAffordableHomeBudget(profile) {
    const monthlyNet = annualNetIncome(profile) / 12;
    const affordableEmi = monthlyNet * 0.30;
    const loanAmount = loanAmountFromEmi(affordableEmi, DEFAULTS.homeInterestRate, DEFAULTS.homeTenureYears);
    const propertyBudget = loanAmount / (1 - DEFAULTS.homeDownPaymentRatio);
    return Math.max(0, propertyBudget);
  }

  function estimateEmergencyFundMonths(memory, request) {
    if (request?.years && request.years <= 5) return 9;

    const hasMajorStepUp = (memory?.plannedEvents || []).some((event) =>
      ['house_purchase', 'child', 'career_switch', 'job_loss'].includes(event.type)
    );

    if (hasMajorStepUp) return 9;
    if (memory?.riskProfile === 'aggressive') return 8;
    return 6;
  }

  function buildContributionScenario(baseScenario, extraMonthly) {
    return {
      ...baseScenario,
      id: `goal_seek_${Math.round(extraMonthly)}`,
      wealthAdjustment: (year, profile) => {
        const baseAdjustment = typeof baseScenario.wealthAdjustment === 'function'
          ? baseScenario.wealthAdjustment(year, profile)
          : 0;
        return baseAdjustment + extraMonthly * 12;
      }
    };
  }

  function simulateGoal(profile, targetAmount, years, riskProfile, extraMonthly) {
    const scenario = {
      ...Scenarios.baseline,
      ...getRiskConfig(riskProfile || 'balanced'),
      id: 'goal_seek_base'
    };
    const goalProfile = { ...profile, goalAmount: targetAmount };
    const runScenario = extraMonthly > 0 ? buildContributionScenario(scenario, extraMonthly) : scenario;

    return SimulationEngine.simulate(goalProfile, runScenario, { years, runs: 600 });
  }

  function buildGoalPlan(request, profile, memory = {}) {
    const riskProfile = request.riskProfile || memory.riskProfile || 'balanced';
    const baselineResults = simulateGoal(profile, request.targetAmount, request.years, riskProfile, 0);
    const currentSurplus = currentMonthlySurplus(profile);

    let low = 0;
    let high = Math.max(10000, currentSurplus || 10000);
    let highResults = simulateGoal(profile, request.targetAmount, request.years, riskProfile, high);
    let attempts = 0;

    while (highResults.stats.final.median < request.targetAmount && high < profile.salary && attempts < 8) {
      high *= 2;
      highResults = simulateGoal(profile, request.targetAmount, request.years, riskProfile, high);
      attempts += 1;
    }

    let requiredExtraMonthly = null;
    let targetResults = baselineResults;

    if (highResults.stats.final.median >= request.targetAmount) {
      for (let index = 0; index < 10; index += 1) {
        const midpoint = (low + high) / 2;
        const midResults = simulateGoal(profile, request.targetAmount, request.years, riskProfile, midpoint);

        if (midResults.stats.final.median >= request.targetAmount) {
          high = midpoint;
          highResults = midResults;
        } else {
          low = midpoint;
        }
      }

      requiredExtraMonthly = Math.ceil(high / 500) * 500;
      targetResults = simulateGoal(profile, request.targetAmount, request.years, riskProfile, requiredExtraMonthly);
    }

    const totalRequiredMonthly = requiredExtraMonthly === null
      ? null
      : currentSurplus + requiredExtraMonthly;

    const displayScenarioBase = {
      ...Scenarios.baseline,
      ...getRiskConfig(riskProfile),
      id: 'goal_seek_plan',
      name: requiredExtraMonthly === null ? 'Target Gap Plan' : 'Goal-Seeking Plan'
    };
    const displayScenario = requiredExtraMonthly === null
      ? displayScenarioBase
      : buildContributionScenario(displayScenarioBase, requiredExtraMonthly);
    displayScenario._goalSeek = {
      targetAmount: request.targetAmount,
      years: request.years,
      riskProfile,
      requiredExtraMonthly
    };

    return {
      request,
      riskProfile,
      baselineResults,
      targetResults,
      currentSurplus,
      requiredExtraMonthly,
      totalRequiredMonthly,
      affordableHomeBudget: estimateAffordableHomeBudget(profile),
      emergencyFundMonths: estimateEmergencyFundMonths(memory, request),
      displayScenario
    };
  }

  function identifyDominantLever(planRun) {
    const events = planRun?.scenarioResult?.scenario?._plannerMetadata?.events || [];
    if (events.some((event) => event.type === 'house_purchase')) return 'House timing and EMI size are the biggest levers.';
    if (events.some((event) => event.type === 'child')) return 'The expense step-up is the main drag, so buffer and savings rate matter most.';
    if (events.some((event) => event.type === 'career_switch' || event.type === 'job_loss')) {
      return 'Early income disruption is doing most of the damage, so runway is the key lever.';
    }
    return 'Savings rate is still the cleanest lever in this plan.';
  }

  function generateLifePlanResponse(chatRun, memory) {
    const stats = chatRun.scenarioResults.stats;
    const baseline = chatRun.baselineResults.stats;
    const meta = chatRun.scenarioResult.scenario._plannerMetadata || {};
    const memorySummary = buildMemorySummary(memory);
    const leverageText = identifyDominantLever(chatRun);

    const html = [];
    html.push('<div class="chat-section">');
    html.push('<div class="chat-section__header"><span class="chat-section__icon">AI</span> Extracted Plan</div>');
    html.push('<ul>');
    (meta.events || []).forEach((event) => {
      if (event.type === 'house_purchase') {
        html.push(`<li>Buy a house in year ${event.year} around ${escapeHtml(formatINRShort(event.propertyPrice))}</li>`);
      }
      if (event.type === 'child') {
        html.push(`<li>Family expenses begin in year ${event.year} at roughly ${escapeHtml(formatINRShort(event.monthlyCost))}/month</li>`);
      }
      if (event.type === 'career_switch') {
        html.push(`<li>Switch careers in year ${event.year} with a temporary salary dip</li>`);
      }
      if (event.type === 'job_loss') {
        html.push(`<li>Assume a ${event.durationMonths}-month job loss in year ${event.year}</li>`);
      }
      if (event.type === 'retirement') {
        html.push(`<li>Retire by age ${event.targetAge}</li>`);
      }
    });
    html.push('</ul>');
    if (memorySummary.length) {
      html.push(`<p class="chat-memory-note">Remembering: ${escapeHtml(memorySummary.join(' | '))}</p>`);
    }
    html.push('</div>');

    html.push('<div class="chat-section">');
    html.push('<div class="chat-section__header"><span class="chat-section__icon">MC</span> Scenario Outcome</div>');
    html.push('<div class="chat-outcomes">');
    html.push(`<div class="chat-outcome"><span class="chat-outcome__label">Median</span><span class="chat-outcome__value chat-outcome__value--gold">${escapeHtml(formatINRShort(stats.final.median))}</span></div>`);
    html.push(`<div class="chat-outcome"><span class="chat-outcome__label">Goal Odds</span><span class="chat-outcome__value ${stats.goalProbability >= 50 ? 'chat-outcome__value--teal' : 'chat-outcome__value--coral'}">${escapeHtml(formatPercent(stats.goalProbability))}</span></div>`);
    html.push(`<div class="chat-outcome"><span class="chat-outcome__label">Worst 5%</span><span class="chat-outcome__value chat-outcome__value--coral">${escapeHtml(formatINRShort(stats.final.p5))}</span></div>`);
    html.push(`<div class="chat-outcome"><span class="chat-outcome__label">Ruin Risk</span><span class="chat-outcome__value ${stats.ruinProbability <= 10 ? 'chat-outcome__value--teal' : 'chat-outcome__value--coral'}">${escapeHtml(formatPercent(stats.ruinProbability))}</span></div>`);
    html.push('</div>');
    html.push(`<p class="chat-comparison">Versus baseline: ${stats.final.median >= baseline.final.median ? '+' : '-'}${escapeHtml(formatINRShort(Math.abs(stats.final.median - baseline.final.median)))}</p>`);
    html.push('</div>');

    html.push('<div class="chat-section">');
    html.push('<div class="chat-section__header"><span class="chat-section__icon">-></span> Recommendation Engine</div>');
    html.push(`<p>${escapeHtml(leverageText)}</p>`);
    if (meta.houseFinance?.monthlyEmi) {
      html.push(`<p>Estimated EMI is about ${escapeHtml(formatINRShort(meta.houseFinance.monthlyEmi))}/month, so delaying the purchase or increasing the down payment would materially improve the odds.</p>`);
    } else if (stats.goalProbability < 50) {
      html.push('<p>Your plan is currently tight because fixed expenses rise faster than investable surplus. A higher savings rate or a later major expense would help most.</p>');
    } else {
      html.push('<p>The plan is reasonably resilient, but it still benefits from keeping liquidity high before the biggest event lands.</p>');
    }
    html.push('</div>');

    return html.join('');
  }

  function generateDashboardControlResponse(control, scenarioResults, baselineResults, scenario) {
    const stats = scenarioResults.stats;
    const baseline = baselineResults.stats;

    return [
      '<div class="chat-section">',
      '<div class="chat-section__header"><span class="chat-section__icon">CTRL</span> Applied Controls</div>',
      `<p>${escapeHtml(control.responseLabel)}.</p>`,
      `<ul>${control.updates.map((update) => `<li>${escapeHtml(update.label)}</li>`).join('')}</ul>`,
      '</div>',
      '<div class="chat-section">',
      '<div class="chat-section__header"><span class="chat-section__icon">MC</span> New Outlook</div>',
      `<p>${escapeHtml(scenario.name)} now projects a median of ${escapeHtml(formatINRShort(stats.final.median))} with ${escapeHtml(formatPercent(stats.goalProbability))} goal probability.</p>`,
      `<p class="chat-comparison">Compared with baseline: ${stats.final.median >= baseline.final.median ? '+' : '-'}${escapeHtml(formatINRShort(Math.abs(stats.final.median - baseline.final.median)))}</p>`,
      '</div>'
    ].join('');
  }

  function generateGoalPlanResponse(goalPlan) {
    const baseline = goalPlan.baselineResults.stats;
    const target = goalPlan.targetResults.stats;
    const html = [];

    html.push('<div class="chat-section">');
    html.push('<div class="chat-section__header"><span class="chat-section__icon">REV</span> Reverse Plan</div>');
    html.push(`<p>Target: ${escapeHtml(formatINRShort(goalPlan.request.targetAmount))} in ${goalPlan.request.years} years${goalPlan.request.targetAge ? ` (age ${goalPlan.request.targetAge})` : ''}.</p>`);
    html.push(`<p>Risk setting used: ${escapeHtml(goalPlan.riskProfile)}.</p>`);
    html.push('</div>');

    html.push('<div class="chat-section">');
    html.push('<div class="chat-section__header"><span class="chat-section__icon">MC</span> What The Simulator Says</div>');
    html.push(`<p>Current path: median ${escapeHtml(formatINRShort(baseline.final.median))}, goal odds ${escapeHtml(formatPercent(baseline.goalProbability))}.</p>`);

    if (goalPlan.requiredExtraMonthly === null) {
      html.push('<p>The target is not reachable with reasonable extra monthly investing alone under the current assumptions. You would need a combination of more time, lower expenses, or a smaller target.</p>');
    } else {
      html.push(`<p>Needed investable surplus: about ${escapeHtml(formatINRShort(goalPlan.totalRequiredMonthly))}/month total. That is ${escapeHtml(formatINRShort(goalPlan.requiredExtraMonthly))}/month more than your current surplus.</p>`);
      html.push(`<p>At that level, the median path reaches about ${escapeHtml(formatINRShort(target.final.median))} with ${escapeHtml(formatPercent(target.goalProbability))} goal probability.</p>`);
    }
    html.push('</div>');

    html.push('<div class="chat-section">');
    html.push('<div class="chat-section__header"><span class="chat-section__icon">PLAN</span> Action Plan</div>');
    html.push('<ul>');
    html.push(`<li>Next 3 months: build or protect an emergency fund of about ${goalPlan.emergencyFundMonths} months of expenses.</li>`);
    if (goalPlan.requiredExtraMonthly !== null) {
      html.push(`<li>Next 12 months: create an automatic investing plan that raises monthly investable surplus by about ${escapeHtml(formatINRShort(goalPlan.requiredExtraMonthly))}.</li>`);
    } else {
      html.push('<li>Next 12 months: cut fixed expenses or push the timeline out before increasing target risk.</li>');
    }
    html.push(`<li>Next 3 years: keep any home purchase budget near or below ${escapeHtml(formatINRShort(goalPlan.affordableHomeBudget))} so the target stays alive.</li>`);
    html.push('</ul>');
    html.push('</div>');

    return html.join('');
  }

  return {
    buildGoalPlan,
    buildGoalPlanResponse: generateGoalPlanResponse,
    buildLifePlanScenario,
    buildLifePlanResponse: generateLifePlanResponse,
    buildMemoryPatch,
    buildMemorySummary,
    detectDashboardControl,
    detectGoalSeek,
    detectLifePlan,
    generateDashboardControlResponse,
    getSuggestedPrompts,
    mergeMemory
  };
})();

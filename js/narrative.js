/**
 * Narrative Generator
 * Builds local, template-based analysis from simulation output.
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
   * Generate narrative from local simulation output.
   * @param {Object} results
   * @param {Object} baselineResults
   * @param {Object} profile
   * @param {Object} scenario
   * @returns {Promise<{ html: string, source: 'template' }>}
   */
  async function generate(results, baselineResults, profile, scenario) {
    const html = generateTemplate(results, baselineResults, profile, scenario);
    return { html, source: 'template' };
  }

  function generateTemplate(results, baselineResults, profile, scenario) {
    const s = results.stats;
    const b = baselineResults.stats;
    const years = results.years;

    let html = '';

    html += '<h3>📊 What Happens Financially</h3>';
    html += generateFinancialSummary(s, b, years, profile, scenario);

    html += '<h3>⚠️ Risks Involved</h3>';
    html += generateRiskAnalysis(s, b, profile, scenario);

    html += '<h3>🎯 Is This a Good Decision?</h3>';
    html += generateDecisionAnalysis(s, b, profile, scenario);

    return html;
  }

  function generateFinancialSummary(s, b, years, profile, scenario) {
    let html = '';
    const medianDiff = s.final.median - b.final.median;

    if (scenario.id === 'baseline') {
      html += `<p>If you continue on your current path for <strong>${years} years</strong>, `;
      html += `your median projected net worth reaches <span class="highlight-gold">${formatINR(s.final.median)}</span>. `;
      html += `In the best 5% of outcomes, you could accumulate up to <span class="highlight-teal">${formatINR(s.final.p95)}</span>. `;
      html += `In the worst 5%, it drops to <span class="highlight-coral">${formatINR(s.final.p5)}</span>.</p>`;

      html += `<p>This assumes your salary grows at roughly 6% per year, expenses inflate at ~5%, `;
      html += `and your investments return around 10% annually (with significant year-to-year volatility).</p>`;

      if (s.goalAmount > 0) {
        html += `<p>Your probability of reaching your goal of <strong>${formatINR(s.goalAmount)}</strong> is `;
        html += `<span class="${s.goalProbability >= 60 ? 'highlight-teal' : 'highlight-coral'}">${formatPercent(s.goalProbability)}</span>.</p>`;
      }
    } else {
      html += `<p>Under this scenario, your median net worth after <strong>${years} years</strong> is `;
      html += `<span class="highlight-gold">${formatINR(s.final.median)}</span>`;

      if (medianDiff > 0) {
        html += ` — that's <span class="highlight-teal">${formatINR(medianDiff)} more</span> than the baseline `;
        html += `(<span class="highlight-gold">${formatINR(b.final.median)}</span>).`;
      } else if (medianDiff < 0) {
        html += ` — that's <span class="highlight-coral">${formatINR(Math.abs(medianDiff))} less</span> than the baseline `;
        html += `(<span class="highlight-gold">${formatINR(b.final.median)}</span>).`;
      } else {
        html += ` — roughly the same as the baseline.`;
      }
      html += '</p>';

      html += `<p>The range of outcomes is wide: from <span class="highlight-coral">${formatINR(s.final.p5)}</span> `;
      html += `(worst 5%) to <span class="highlight-teal">${formatINR(s.final.p95)}</span> (best 5%).</p>`;

      if (s.goalAmount > 0) {
        const goalDiff = s.goalProbability - b.goalProbability;
        html += `<p>Your probability of reaching <strong>${formatINR(s.goalAmount)}</strong> is `;
        html += `<span class="${s.goalProbability >= 50 ? 'highlight-teal' : 'highlight-coral'}">${formatPercent(s.goalProbability)}</span>`;
        if (Math.abs(goalDiff) > 2) {
          html += ` (vs ${formatPercent(b.goalProbability)} with the baseline)`;
        }
        html += '.</p>';
      }
    }

    return html;
  }

  function generateRiskAnalysis(s, b, profile, scenario) {
    let html = '';
    const risks = [];

    if (s.ruinProbability > 0) {
      const severity = s.ruinProbability > 30 ? 'coral' : s.ruinProbability > 10 ? 'gold' : 'teal';
      risks.push({
        text: `In <span class="highlight-${severity}">${formatPercent(s.ruinProbability)}</span> of simulations, your savings hit zero at some point during the ${s.yearly.length - 1}-year period.`,
        severity: s.ruinProbability
      });
    }

    if (s.ruinWithin3Prob > 0) {
      risks.push({
        text: `<span class="highlight-coral">${formatPercent(s.ruinWithin3Prob)}</span> of simulations show you running out of savings within the first 3 years.`,
        severity: s.ruinWithin3Prob * 2
      });
    }

    if (s.final.p5 < 0) {
      risks.push({
        text: `In the worst 5% of outcomes, you end up in debt (net worth: <span class="highlight-coral">${formatINR(s.final.p5)}</span>).`,
        severity: 30
      });
    } else if (s.final.p5 < profile.savings) {
      risks.push({
        text: `In the worst 5% of outcomes, you end up with <em>less</em> than your current savings (<span class="highlight-coral">${formatINR(s.final.p5)}</span> vs ${formatINR(profile.savings)} today).`,
        severity: 15
      });
    }

    const scenarioRange = s.final.p95 - s.final.p5;
    const baselineRange = b.final.p95 - b.final.p5;
    if (scenario.id !== 'baseline' && scenarioRange > baselineRange * 1.3) {
      const ratio = (scenarioRange / baselineRange).toFixed(1);
      risks.push({
        text: `The range of outcomes is <strong>${ratio}x wider</strong> than the baseline — meaning much higher uncertainty.`,
        severity: 20
      });
    }

    if (scenario.id === 'quit_job') {
      const monthsRunway = profile.savings / profile.monthlyExpenses;
      risks.push({
        text: `Your current savings provide roughly <strong>${Math.floor(monthsRunway)} months</strong> of runway with zero income. ${monthsRunway < 12 ? '<span class="highlight-coral">This is below the recommended 12–18 months.</span>' : 'This provides a moderate buffer.'}`,
        severity: monthsRunway < 12 ? 40 : 10
      });
      risks.push({
        text: 'The <strong>main risk</strong> is income instability in the early years. Business income is highly unpredictable and bimodal — you either grow significantly or struggle.',
        severity: 25
      });
    } else if (scenario.id === 'buy_house') {
      risks.push({ text: 'A large EMI commitment reduces your monthly investable surplus significantly.', severity: 20 });
      risks.push({ text: 'Property is illiquid — you cannot easily convert it to cash in emergencies.', severity: 15 });
    } else if (scenario.id === 'aggressive') {
      risks.push({ text: 'Higher equity allocation means you can lose <strong>30–40% in a single bad year</strong>.', severity: 25 });
    } else if (scenario.id === 'career_switch') {
      risks.push({ text: 'The salary cut in years 1–2 reduces your savings rate at a critical time.', severity: 20 });
    }

    if (risks.length === 0) {
      html += `<p>This scenario carries <span class="highlight-teal">relatively low risk</span>.</p>`;
    } else {
      for (const risk of risks.sort((a, b) => b.severity - a.severity)) {
        html += `<p>• ${risk.text}</p>`;
      }
    }

    return html;
  }

  function generateDecisionAnalysis(s, b, profile, scenario) {
    let html = '';

    if (scenario.id === 'baseline') {
      html += `<p>This is your reference point.</p>`;
      html += `<div class="conclusion-box"><strong>Summary:</strong> On your current trajectory, your financial future looks `;
      if (s.final.median > profile.savings * 3) html += `reasonably strong.`;
      else if (s.final.median > profile.savings * 1.5) html += `moderate.`;
      else html += `tight. Consider increasing your savings rate.`;
      html += `</div>`;
      return html;
    }

    const medianDiff = s.final.median - b.final.median;
    const monthsRunway = profile.savings / profile.monthlyExpenses;

    if (medianDiff > 0 && s.ruinProbability < 10) {
      html += `<p>This scenario has a <span class="highlight-teal">favorable risk-reward profile</span>.</p>`;
      html += `<div class="conclusion-box"><strong>Conclusion:</strong> Reasonable to pursue with a 6-month emergency fund.</div>`;
    } else if (s.final.p95 > b.final.p95 && s.ruinProbability > 15) {
      html += `<p>This decision has <span class="highlight-teal">high upside</span> but <span class="highlight-coral">significant short-term risk</span>.</p>`;
      html += `<div class="${monthsRunway >= 12 ? 'conclusion-box' : 'warning-box'}">`;
      html += `<strong>Conclusion:</strong> Only consider with 12–18 months expenses saved (~${Math.floor(monthsRunway)} months currently).`;
      if (monthsRunway < 12) html += ` <span class="highlight-coral">Your current runway is insufficient.</span>`;
      html += `</div>`;
    } else if (medianDiff < 0 && s.ruinProbability > b.ruinProbability) {
      html += `<p>This scenario produces a <span class="highlight-coral">lower median outcome</span> and <span class="highlight-coral">higher risk</span>.</p>`;
      html += `<div class="warning-box"><strong>Conclusion:</strong> Financially difficult to justify. Weigh non-financial benefits against ~${formatINR(Math.abs(medianDiff))} cost.</div>`;
    } else {
      html += `<p>Outcomes roughly comparable to baseline, with trade-offs.</p>`;
      html += `<div class="conclusion-box"><strong>Conclusion:</strong> Moderate decision. Let non-financial factors guide you.</div>`;
    }

    return html;
  }

  return { generate, formatINR };
})();

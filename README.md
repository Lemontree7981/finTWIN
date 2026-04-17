# FinSim

Static Monte Carlo financial simulator for exploring 10-year wealth outcomes under different life and investing scenarios, with an AI-native planning layer on top.

## What It Does

- Runs 1,000 Monte Carlo simulations in the browser
- Compares baseline and alternate scenarios like quitting a job, buying a house, or switching careers
- Visualizes projected wealth ranges with a fan chart
- Generates local, template-based analysis with no external APIs or secrets required
- Extracts structured timelines from free-form life plans in chat
- Remembers goals, risk preferences, and major planned events during the session
- Supports natural-language dashboard controls such as salary, inflation, and portfolio changes
- Reverse-plans toward targets like "I want Rs 1 crore by age 40"

## Project Structure

- `index.html` contains the app shell
- `style.css` contains the UI styling
- `js/simulation.js` runs the Monte Carlo engine
- `js/scenarios.js` defines preset scenarios
- `js/charts.js` renders the chart output
- `js/narrative.js` builds the analysis panel from simulation results
- `js/planner.js` handles AI-style planning, memory, controls, and reverse planning
- `js/app.js` wires the UI together

## Run Locally

Open `index.html` in a browser.

If you want a local server instead:

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

## GitHub Ready

This version is still fully client-side, but the chat now supports an optional local config file:

- `js/config.js` holds the committed defaults
- `js/config.local.js` can hold your local API key and provider settings

Important:

- `js/config.local.js` is ignored by git
- Because this app runs in the browser, any key placed there is still visible to anyone who can open the app source
- If your provider blocks browser-side requests or you need stronger key protection, use a backend proxy instead

## AI-Native Chat Behaviors

The chat can now do more than rule-based what-if prompts:

- Convert multi-step plans such as "buy a house in 2 years, have a kid in 4 years, and switch jobs" into a composite simulation
- Remember session context like your target corpus, risk style, and major planned life events
- Accept direct controls like "set inflation to 6%" or "make this a conservative portfolio"
- Work backward from target goals and suggest a higher-level action plan

The remote model integration is still optional. If no API is configured, the planner runs locally in the browser using deterministic parsing plus the Monte Carlo engine.

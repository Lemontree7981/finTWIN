# FinSim

Static Monte Carlo financial simulator for exploring 10-year wealth outcomes under different life and investing scenarios.

## What It Does

- Runs 1,000 Monte Carlo simulations in the browser
- Compares baseline and alternate scenarios like quitting a job, buying a house, or switching careers
- Visualizes projected wealth ranges with a fan chart
- Generates local, template-based analysis with no external APIs or secrets required

## Project Structure

- `index.html` contains the app shell
- `style.css` contains the UI styling
- `js/simulation.js` runs the Monte Carlo engine
- `js/scenarios.js` defines preset scenarios
- `js/charts.js` renders the chart output
- `js/narrative.js` builds the analysis panel from simulation results
- `js/app.js` wires the UI together

## Run Locally

Open `index.html` in a browser.

If you want a local server instead:

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

## GitHub Ready

This version is fully client-side and does not include API keys, backend services, or external secret configuration.

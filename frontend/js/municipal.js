// municipal.js - Municipal Mode Hotspot Analysis, Bottleneck Inference & Budget Optimizer

let currentBottlenecksData = null;
let currentOptimizationResult = null;

function populateCriticalZones(zonesGeoJSON) {
  const container = document.getElementById('critical-zones-list');
  container.innerHTML = '';

  const features = [...zonesGeoJSON.features];
  features.sort((a, b) => (b.properties.flood_probability || 0) - (a.properties.flood_probability || 0));

  features.forEach(f => {
    const p = f.properties;
    const item = document.createElement('div');
    item.className = 'zone-item';
    item.title = `Click to zoom & inspect GIS risk details for ${p.name}`;
    
    item.onclick = () => {
      focusZoneOnMap(p.zone_id);
    };

    item.innerHTML = `
      <div>
        <div class="zi-name">📍 ${p.name} <span style="font-size: 0.72rem; color: #64748b;">(${p.zone_id})</span></div>
        <div class="zi-pop">Pop: ${p.population.toLocaleString()} • Elev: ${p.elevation}m</div>
      </div>
      <div class="risk-badge ${getRiskClass(p.flood_probability)}">
        ${p.flood_probability}%
      </div>
    `;
    container.appendChild(item);
  });
}

async function fetchBottlenecks() {
  try {
    const rainfall = currentRainfallLevel || 100;
    const resp = await fetch(`/api/bottlenecks?rainfall=${rainfall}`);
    const data = await resp.json();
    currentBottlenecksData = data;

    if (data.all_drains) {
      updateDrainsMap(data.all_drains);
    }

    if (data.top_bottleneck) {
      const top = data.top_bottleneck;
      document.getElementById('bm-drain-id').innerText = `${top.drain_name} (${top.drain_id})`;
      document.getElementById('bm-score').innerText = `${top.confidence} 🔴`;
      document.getElementById('bm-rec').innerText = `${top.recommendation} for Ward: ${top.ward}. (Click to zoom on map)`;

      const bBox = document.getElementById('bottleneck-summary-box');
      bBox.style.cursor = 'pointer';
      bBox.onclick = () => {
        focusBottleneckDrain(top.drain_id);
      };
    }
  } catch (err) {
    console.error("Error fetching bottlenecks:", err);
  }
}

function updateBudgetVal(val) {
  document.getElementById('budget-val-disp').innerText = `₹ ${val} Lakhs`;
}

async function runOptimization() {
  const budget = parseFloat(document.getElementById('budget-range').value);
  const rainfall = currentRainfallLevel || 100;

  try {
    const resp = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget_lakhs: budget, rainfall_24h_mm: rainfall })
    });
    const res = await resp.json();
    currentOptimizationResult = res;

    document.getElementById('optimizer-results').style.display = 'block';
    document.getElementById('opt-before-risk').innerText = `${res.zone_14_before_risk}%`;
    document.getElementById('opt-after-risk').innerText = `${res.zone_14_after_risk}%`;
    document.getElementById('opt-protected-pop').innerText = res.total_population_protected.toLocaleString();

    const planList = document.getElementById('action-plan-list');
    planList.innerHTML = '';

    res.recommended_actions.forEach((act, idx) => {
      const li = document.createElement('li');
      li.className = 'action-item';
      li.style.cursor = 'pointer';
      li.onclick = () => {
        focusZoneOnMap(act.target_zone);
      };
      
      li.innerHTML = `
        <span><strong>${idx + 1}. ${act.name}</strong></span>
        <span class="text-brown"><strong>₹ ${act.cost_lakhs} L</strong></span>
      `;
      planList.appendChild(li);
    });

    if (res.recommended_actions && res.recommended_actions.length > 0) {
      focusZoneOnMap(res.recommended_actions[0].target_zone);
    }
  } catch (err) {
    console.error("Error running budget optimization:", err);
  }
}

/* Top 1% Feature: Print / Export Official Action Plan PDF */
function printOfficialActionPlan() {
  if (!currentOptimizationResult) {
    alert("Please run the budget optimizer first.");
    return;
  }

  const res = currentOptimizationResult;
  const printWin = window.open('', '_blank');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Official Municipal Emergency Action Plan - Roorkee & Haridwar</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #0f172a; }
        .header { border-bottom: 3px solid #78350f; padding-bottom: 12px; margin-bottom: 24px; }
        .title { font-size: 22px; font-weight: 800; color: #78350f; margin: 0; }
        .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
        .meta-grid { display: flex; justify-content: space-between; background: #fef3c7; padding: 12px 18px; border-radius: 6px; margin-bottom: 24px; }
        .meta-item { font-size: 13px; }
        .meta-value { font-weight: 800; font-size: 16px; color: #78350f; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; font-size: 13px; }
        th { background: #f8fafc; font-weight: 700; color: #475569; }
        .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; pt: 12px; font-size: 11px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">OFFICIAL MUNICIPAL EMERGENCY ACTION PLAN</h1>
        <div class="subtitle">Roorkee & Haridwar Municipal Corporation • Flood Resilience Task Force</div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">Allocated Budget: <div class="meta-value">₹ ${res.budget_allocated_lakhs} Lakhs</div></div>
        <div class="meta-item">Optimized Expenditure: <div class="meta-value">₹ ${res.total_cost_lakhs} Lakhs</div></div>
        <div class="meta-item">Protected Population: <div class="meta-value">${res.total_population_protected.toLocaleString()} Citizens</div></div>
        <div class="meta-item">Solani Aqueduct Risk: <div class="meta-value">${res.zone_14_before_risk}% ➔ ${res.zone_14_after_risk}%</div></div>
      </div>

      <h3>RECOMMENDED INTERVENTION PLAN (Google OR-Tools Optimization)</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Intervention Action Item</th>
            <th>Target Ward / Zone</th>
            <th>Est. Cost</th>
            <th>Risk Reduction</th>
            <th>Citizens Protected</th>
          </tr>
        </thead>
        <tbody>
          ${res.recommended_actions.map((act, i) => `
            <tr>
              <td><strong>${i + 1}</strong></td>
              <td>${act.name}</td>
              <td>${act.target_zone}</td>
              <td>₹ ${act.cost_lakhs} L</td>
              <td>-${act.risk_reduction_pct}%</td>
              <td>${act.population_protected.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="margin-top: 24px; font-size: 13px; color: #475569;">
        <strong>Executive Summary:</strong> ${res.summary_text}
      </p>

      <div class="footer">
        Generated by DrainMind AI Platform • Authorized for Public Works & Emergency Response • ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `;

  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 500);
}

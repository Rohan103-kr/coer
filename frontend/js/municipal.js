// municipal.js - Municipal Mode Hotspot Analysis, Bottleneck Inference & Budget Optimizer

let currentBottlenecksData = null;

function populateCriticalZones(zonesGeoJSON) {
  const container = document.getElementById('critical-zones-list');
  container.innerHTML = '';

  const features = [...zonesGeoJSON.features];
  // Sort by flood probability descending
  features.sort((a, b) => (b.properties.flood_probability || 0) - (a.properties.flood_probability || 0));

  features.forEach(f => {
    const p = f.properties;
    const item = document.createElement('div');
    item.className = 'zone-item';
    item.title = `Click to zoom & inspect GIS risk details for ${p.name}`;
    
    // Explicit click handler to fly map to this ward
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

    // Render SWD drain channels on map
    if (data.all_drains) {
      updateDrainsMap(data.all_drains);
    }

    if (data.top_bottleneck) {
      const top = data.top_bottleneck;
      document.getElementById('bm-drain-id').innerText = `${top.drain_name} (${top.drain_id})`;
      document.getElementById('bm-score').innerText = `${top.confidence} 🔴`;
      document.getElementById('bm-rec').innerText = `${top.recommendation} for Ward: ${top.ward}. (Click to zoom on map)`;

      // Make bottleneck card interactive
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

    // Focus the highest priority target zone on optimization completion
    if (res.recommended_actions && res.recommended_actions.length > 0) {
      focusZoneOnMap(res.recommended_actions[0].target_zone);
    }
  } catch (err) {
    console.error("Error running budget optimization:", err);
  }
}

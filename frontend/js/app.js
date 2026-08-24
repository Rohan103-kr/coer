// app.js - CropPulse AI & DrainMind Platform State Orchestrator

let mandiChartInstance = null;
let currentAgriResult = null;

document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  
  // Initial CropPulse Analysis
  await runAgriAnalysis();

  // Lazy Init GIS Map if DrainMind tab is opened
  initMap();
});

function switchAgriTab(tabKey) {
  const tabs = ['advisor', 'selltiming', 'whatif', 'drainmind'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const panel = document.getElementById(`agri-panel-${t}`);
    if (btn && panel) {
      if (t === tabKey) {
        btn.classList.add('active');
        panel.classList.add('active');
      } else {
        btn.classList.remove('active');
        panel.classList.remove('active');
      }
    }
  });

  if (tabKey === 'selltiming') {
    const selectedCrop = document.getElementById('sell-crop-select').value;
    loadSellTimingChart(selectedCrop);
  } else if (tabKey === 'drainmind' && map) {
    setTimeout(() => { map.invalidateSize(); }, 200);
  }
}

/* 🌾 Crop-to-Market Recommendation Engine Handler */
async function runAgriAnalysis() {
  const loc = document.getElementById('agri-state').value;
  const land = parseFloat(document.getElementById('land-acres').value);
  const soil = document.getElementById('agri-soil').value;
  const water = document.getElementById('agri-water').value;
  const budget = parseFloat(document.getElementById('agri-budget').value);

  document.getElementById('header-loc-disp').innerText = `Region: ${loc}`;

  try {
    const resp = await fetch('/api/croppulse/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: loc,
        land_acres: land,
        soil_type: soil,
        water_access: water,
        budget_inr: budget
      })
    });

    const res = await resp.json();
    currentAgriResult = res;

    // Render Hero Recommended Crop Banner
    const rec = res.recommended_crop;
    document.getElementById('hero-crop-name').innerText = rec.crop.toUpperCase();
    document.getElementById('hero-decision-score').innerText = `Decision Score: ${rec.decision_score} / 100`;
    document.getElementById('hero-net-profit').innerText = `₹ ${rec.expected_profit.toLocaleString()}`;
    document.getElementById('hero-yield-val').innerText = `${rec.yield_per_acre} q/acre (${rec.total_yield_quintals} q)`;
    document.getElementById('hero-peak-price').innerText = `₹ ${rec.peak_mandi_price.toLocaleString()} / q`;
    document.getElementById('hero-sell-window').innerText = rec.peak_window;

    const rBadge = document.getElementById('hero-risk-badge');
    rBadge.innerText = `Weather Risk: ${rec.weather_risk}`;
    rBadge.className = `risk-badge ${getAgriRiskClass(rec.weather_risk)}`;

    // Render Matrix Table
    renderCropMatrixTable(res.crop_comparison);
  } catch (err) {
    console.error("Error running CropPulse analysis:", err);
  }
}

function renderCropMatrixTable(cropList) {
  const tbody = document.getElementById('crop-matrix-body');
  tbody.innerHTML = '';

  cropList.forEach(item => {
    const tr = document.createElement('tr');
    if (item.is_recommended) {
      tr.style.background = '#f0fdf4';
      tr.style.fontWeight = '600';
    }

    tr.innerHTML = `
      <td><strong>${item.crop} ${item.is_recommended ? '⭐' : ''}</strong></td>
      <td>${item.yield_per_acre} q/acre</td>
      <td>₹ ${item.total_cost.toLocaleString()}</td>
      <td>₹ ${item.peak_mandi_price.toLocaleString()} /q</td>
      <td>₹ ${item.total_revenue.toLocaleString()}</td>
      <td class="text-green"><strong>₹ ${item.expected_profit.toLocaleString()}</strong></td>
      <td><span class="risk-badge ${getAgriRiskClass(item.weather_risk)}">${item.weather_risk}</span></td>
      <td><strong>${item.decision_score}</strong> / 100</td>
      <td>
        <button class="btn btn-sm btn-outline-green" onclick="inspectCropTiming('${item.crop}')">
          📈 View Timing
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function inspectCropTiming(cropName) {
  document.getElementById('sell-crop-select').value = cropName;
  switchAgriTab('selltiming');
}

/* 📈 Sell Timing AI Chart Handler */
async function loadSellTimingChart(cropName) {
  try {
    const resp = await fetch(`/api/croppulse/sell-timing?crop=${cropName}`);
    const data = await resp.json();

    document.getElementById('st-window-disp').innerText = data.peak_window;
    document.getElementById('st-peak-price-disp').innerText = `₹ ${data.peak_expected_price.toLocaleString()} / q`;
    
    const baseP = data.base_price;
    const gain = data.peak_expected_price - baseP;
    document.getElementById('st-gain-disp').innerText = `+ ₹ ${gain.toLocaleString()} / q`;
    document.getElementById('st-advisory-note').innerText = data.recommendation_note;

    // Render Chart.js
    const ctx = document.getElementById('mandiPriceChart').getContext('2d');
    if (mandiChartInstance) {
      mandiChartInstance.destroy();
    }

    const labels = data.price_trajectory.map(d => d.month);
    const prices = data.price_trajectory.map(d => d.price);

    mandiChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `${cropName} Mandi Price Forecast (₹ / quintal)`,
          data: prices,
          borderColor: '#d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.12)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointBackgroundColor: '#d97706'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true }
        },
        scales: {
          y: {
            grid: { color: '#f1f5f9' }
          },
          x: {
            grid: { color: '#f1f5f9' }
          }
        }
      }
    });
  } catch (err) {
    console.error("Error loading sell timing chart:", err);
  }
}

/* 🔥 What-If Climate Simulator Handler */
async function onWhatIfSliderChange(val) {
  document.getElementById('sim-rain-disp').innerText = `${val} mm`;

  const loc = document.getElementById('agri-state').value;
  const land = parseFloat(document.getElementById('land-acres').value);
  const soil = document.getElementById('agri-soil').value;
  const water = document.getElementById('agri-water').value;
  const budget = parseFloat(document.getElementById('agri-budget').value);

  try {
    const resp = await fetch('/api/croppulse/what-if', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: loc,
        land_acres: land,
        soil_type: soil,
        water_access: water,
        budget_inr: budget,
        rainfall_mm: parseFloat(val)
      })
    });
    const res = await resp.json();

    const container = document.getElementById('whatif-impact-container');
    container.innerHTML = '';

    res.crop_comparison.slice(0, 3).forEach(crop => {
      const card = document.createElement('div');
      card.className = `wi-card ${crop.is_recommended ? 'recommended' : ''}`;
      card.innerHTML = `
        <div class="wi-title">
          <span>${crop.crop} ${crop.is_recommended ? '⭐' : ''}</span>
          <span style="font-size:0.8rem; color:#64748b;">Score: ${crop.decision_score}</span>
        </div>
        <div style="font-size:0.82rem; margin-bottom: 6px;">Yield: <strong>${crop.yield_per_acre} q/acre</strong></div>
        <div style="font-size:0.82rem; margin-bottom: 6px;">Peak Price: <strong>₹ ${crop.peak_mandi_price.toLocaleString()} /q</strong></div>
        <div style="font-size:1.1rem; font-weight:800; color:#15803d;">Profit: ₹ ${crop.expected_profit.toLocaleString()}</div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Error running what-if simulation:", err);
  }
}

/* 📄 Official PDF Farmer Report Exporter */
function exportFarmerReportPDF() {
  if (!currentAgriResult) {
    alert("Please run crop analysis first.");
    return;
  }

  const res = currentAgriResult;
  const printWin = window.open('', '_blank');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>CropPulse AI - Farmer Executive Advisory Report</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #0f172a; }
        .header { border-bottom: 3px solid #15803d; padding-bottom: 12px; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: 800; color: #15803d; margin: 0; }
        .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
        .hero-box { background: #f0fdf4; border: 2px solid #15803d; padding: 18px; border-radius: 8px; margin-bottom: 24px; }
        .hero-title { font-size: 20px; font-weight: 800; color: #15803d; margin: 0 0 8px 0; }
        .meta-grid { display: flex; justify-content: space-between; margin-top: 12px; }
        .meta-val { font-weight: 800; font-size: 16px; color: #15803d; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; font-size: 13px; }
        th { background: #f8fafc; font-weight: 700; color: #475569; }
        .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; pt: 12px; font-size: 11px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">🌾 CROPPULSE AI — FARMER CROP & MARKET ADVISORY</h1>
        <div class="subtitle">AgriTech Decision Intelligence Platform • Region: ${res.farmer_inputs.location}</div>
      </div>

      <div class="hero-box">
        <div style="font-size: 11px; font-weight: 800; color: #15803d;">RECOMMENDED CROP CHOICE</div>
        <h2 class="hero-title">${res.recommended_crop.crop} ⭐</h2>
        <div class="meta-grid">
          <div>Land Area: <strong>${res.farmer_inputs.land_acres} Acres</strong></div>
          <div>Expected Net Profit: <div class="meta-val">₹ ${res.recommended_crop.expected_profit.toLocaleString()}</div></div>
          <div>Peak Mandi Price: <div class="meta-val">₹ ${res.recommended_crop.peak_mandi_price.toLocaleString()} / q</div></div>
          <div>Optimal Selling Window: <strong>${res.recommended_crop.peak_window}</strong></div>
        </div>
      </div>

      <h3>CROP COMPARISON & RISK EVALUATION MATRIX</h3>
      <table>
        <thead>
          <tr>
            <th>Crop</th>
            <th>Expected Yield</th>
            <th>Total Cost</th>
            <th>Revenue</th>
            <th>Net Profit</th>
            <th>Risk Level</th>
            <th>Decision Score</th>
          </tr>
        </thead>
        <tbody>
          ${res.crop_comparison.map(c => `
            <tr>
              <td><strong>${c.crop} ${c.is_recommended ? '⭐' : ''}</strong></td>
              <td>${c.yield_per_acre} q/acre</td>
              <td>₹ ${c.total_cost.toLocaleString()}</td>
              <td>₹ ${c.total_revenue.toLocaleString()}</td>
              <td style="color:#15803d; font-weight:700;">₹ ${c.expected_profit.toLocaleString()}</td>
              <td>${c.weather_risk}</td>
              <td><strong>${c.decision_score}</strong> / 100</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        Generated by CropPulse AI • Agmarknet & OGD India Data Driven • ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `;

  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 500);
}

function getAgriRiskClass(riskStr) {
  if (riskStr === 'Low') return 'risk-low';
  if (riskStr === 'Medium') return 'risk-mod';
  return 'risk-high';
}

function openMetricsModal() {
  document.getElementById('metrics-modal').classList.add('active');
}

function closeMetricsModal(e) {
  document.getElementById('metrics-modal').classList.remove('active');
}

function speakAlert(text) {
  return;
}

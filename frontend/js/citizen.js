// citizen.js - Citizen Mode Navigation & Incident Reporting

let currentRoutesData = null;
let selectedRouteKey = 'safest';

function onRouteInputsChanged() {
  clearRouteLines();
  document.getElementById('route-results-container').style.display = 'none';
}

async function calculateRoute() {
  const origin = document.getElementById('route-origin').value;
  const dest = document.getElementById('route-dest').value;
  const rainfall = currentRainfallLevel || 100;

  try {
    const resp = await fetch(`/api/route?origin=${origin}&destination=${dest}&rainfall=${rainfall}`);
    const data = await resp.json();

    if (!resp.ok) {
      alert("No suitable path found between selected origin and destination.");
      return;
    }

    currentRoutesData = data.routes;
    renderRouteCards(currentRoutesData);
    selectRouteOption(selectedRouteKey);
  } catch (err) {
    console.error("Error calculating routes:", err);
  }
}

function renderRouteCards(routes) {
  const container = document.getElementById('route-results-container');
  container.style.display = 'flex';

  if (routes.fastest) {
    document.getElementById('fastest-time').innerText = `${routes.fastest.travel_time_min} mins`;
    document.getElementById('fastest-dist').innerText = `${routes.fastest.length_km} km`;
    const fRisk = document.getElementById('fastest-risk');
    fRisk.innerText = `Flood Risk: ${routes.fastest.avg_flood_risk}%`;
    fRisk.className = `risk-badge ${getRiskClass(routes.fastest.avg_flood_risk)}`;
  }

  if (routes.safest) {
    document.getElementById('safest-time').innerText = `${routes.safest.travel_time_min} mins`;
    document.getElementById('safest-dist').innerText = `${routes.safest.length_km} km`;
    const sRisk = document.getElementById('safest-risk');
    sRisk.innerText = `Flood Risk: ${routes.safest.avg_flood_risk}%`;
    sRisk.className = `risk-badge ${getRiskClass(routes.safest.avg_flood_risk)}`;
  }

  if (routes.balanced) {
    document.getElementById('balanced-time').innerText = `${routes.balanced.travel_time_min} mins`;
    document.getElementById('balanced-dist').innerText = `${routes.balanced.length_km} km`;
    const bRisk = document.getElementById('balanced-risk');
    bRisk.innerText = `Flood Risk: ${routes.balanced.avg_flood_risk}%`;
    bRisk.className = `risk-badge ${getRiskClass(routes.balanced.avg_flood_risk)}`;
  }
}

function selectRouteOption(modeKey) {
  selectedRouteKey = modeKey;
  
  ['fastest', 'safest', 'balanced'].forEach(k => {
    const card = document.getElementById(`card-${k}`);
    if (card) {
      if (k === modeKey) card.classList.add('selected');
      else card.classList.remove('selected');
    }
  });

  if (currentRoutesData && currentRoutesData[modeKey]) {
    const route = currentRoutesData[modeKey];
    let color = '#16a34a'; // Green for safest
    if (modeKey === 'fastest') color = '#dc2626'; // Red for fastest if risky
    else if (modeKey === 'balanced') color = '#0284c7'; // Blue for balanced
    
    drawRouteOnMap(route, color);
    
    // Top 1% Voice Navigation Feedback
    if (modeKey === 'safest') {
      speakAlert(`Safest route selected. Travel time is ${route.travel_time_min} minutes with low flood risk.`);
    } else if (modeKey === 'fastest' && route.avg_flood_risk > 50) {
      speakAlert(`Warning: Fastest route has high waterlogging risk of ${route.avg_flood_risk} percent.`);
    }
  }
}

function getRiskClass(riskVal) {
  if (riskVal <= 30) return 'risk-low';
  if (riskVal <= 60) return 'risk-mod';
  if (riskVal <= 80) return 'risk-high';
  return 'risk-crit';
}

// Incident Report Modal
function openReportModal() {
  document.getElementById('report-modal').classList.add('active');
}

function closeReportModal(e) {
  document.getElementById('report-modal').classList.remove('active');
}

async function submitIncidentReport() {
  const roadId = document.getElementById('report-road-id').value;
  const depthEl = document.querySelector('input[name="water_depth"]:checked');
  const passableEl = document.querySelector('input[name="passable"]:checked');

  const payload = {
    road_id: roadId,
    water_depth: depthEl ? depthEl.value : 'Medium',
    passable: passableEl ? (passableEl.value === 'yes') : false,
    latitude: 29.8649,
    longitude: 77.8965
  };

  try {
    const resp = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await resp.json();
    
    closeReportModal();
    speakAlert(`Incident report received for road ${roadId}. Road risk set to 95 percent. Recalculating routes.`);
    alert(`🚨 Incident report submitted! Road ${roadId} risk updated to 95%. Recalculating routes...`);
    
    // Add visual marker on map
    addIncidentMarker(29.8649, 77.8965, roadId, payload.water_depth);
    
    // Re-fetch roads and routes
    await fetchRoads();
    if (currentRoutesData) {
      calculateRoute();
    }
  } catch (err) {
    console.error("Error submitting report:", err);
  }
}

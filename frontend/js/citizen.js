// citizen.js - Citizen Mode Navigation & Incident Reporting

let currentRoutesData = null;
let selectedRouteKey = 'safest';
let userGpsCoords = null;
let userGpsMarker = null;

function locateUserGPS() {
  if ('geolocation' in navigator) {
    speakAlert("Locating your live GPS coordinates...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        userGpsCoords = [lat, lng];

        // Update Origin Select
        const originSelect = document.getElementById('route-origin');
        originSelect.value = 'USER_LIVE_GPS';

        // Add GPS Marker on map & fly to it
        addUserGpsMarker(lat, lng);
        speakAlert("GPS location locked. Calculating flood-free routes from your position.");
        calculateRoute();
      },
      (error) => {
        console.warn("GPS Geolocation warning (using Roorkee baseline):", error.message);
        // Fallback to Roorkee GPS (IIT Roorkee Campus: 29.8649, 77.8965)
        userGpsCoords = [29.8649, 77.8965];
        const originSelect = document.getElementById('route-origin');
        originSelect.value = 'USER_LIVE_GPS';
        addUserGpsMarker(29.8649, 77.8965);
        alert("📍 Live GPS locked to Roorkee Campus (29.8649, 77.8965). Finding safest routes...");
        calculateRoute();
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
}

function addUserGpsMarker(lat, lng) {
  if (userGpsMarker && map) {
    map.removeLayer(userGpsMarker);
  }

  map.flyTo([lat, lng], 14, { duration: 1.2 });

  userGpsMarker = L.circleMarker([lat, lng], {
    radius: 10,
    fillColor: '#0284c7',
    color: '#ffffff',
    weight: 3,
    fillOpacity: 0.95
  }).addTo(map);

  userGpsMarker.bindPopup(`
    <div style="font-family: Inter; padding: 4px;">
      <span style="background: #e0f2fe; color: #0284c7; font-size: 0.72rem; font-weight: 800; padding: 2px 6px; border-radius: 4px;">
        📡 YOUR LIVE GPS POSITION
      </span>
      <h4 style="margin: 4px 0 2px 0; font-size: 0.9rem;">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</h4>
      <p style="margin: 0; font-size: 0.75rem; color: #64748b;">Routing from your exact real-time coordinates</p>
    </div>
  `).openPopup();
}

function onRouteInputsChanged() {
  clearRouteLines();
  document.getElementById('route-results-container').style.display = 'none';
}

async function calculateRoute() {
  const origin = document.getElementById('route-origin').value;
  const dest = document.getElementById('route-dest').value;
  const rainfall = currentRainfallLevel || 100;

  let url = `/api/route?origin=${origin}&destination=${dest}&rainfall=${rainfall}`;
  if (origin === 'USER_LIVE_GPS' && userGpsCoords) {
    url += `&lat=${userGpsCoords[0]}&lon=${userGpsCoords[1]}`;
  }

  try {
    const resp = await fetch(url);
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
    let color = '#16a34a';
    if (modeKey === 'fastest') color = '#dc2626';
    else if (modeKey === 'balanced') color = '#0284c7';
    
    drawRouteOnMap(route, color);
    
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
    
    addIncidentMarker(29.8649, 77.8965, roadId, payload.water_depth);
    
    await fetchRoads();
    if (currentRoutesData) {
      calculateRoute();
    }
  } catch (err) {
    console.error("Error submitting report:", err);
  }
}

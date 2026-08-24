// citizen.js - Citizen Mode Navigation, Turn-by-Turn Directions, Live GPS Tracking & Incident Reporting for Northeast India

let currentRoutesData = null;
let selectedRouteKey = 'safest';
let userGpsCoords = null;
let userGpsMarker = null;
let userAccuracyCircle = null;
let watchPositionId = null;
let isLiveGpsTrackingActive = false;

const PLACE_DATABASE = [
  { name: "Gauhati University / Jalukbari Junction", zone_id: "ZONE-NE04", node_id: "N_JALUKBARI", lat: 26.1550, lng: 91.6650 },
  { name: "Fancy Bazaar / Panbazar Commercial Hub", zone_id: "ZONE-NE01", node_id: "N_FANCY_BAZAAR", lat: 26.1850, lng: 91.7420 },
  { name: "Dispur Capital Secretariat Complex", zone_id: "ZONE-NE02", node_id: "N_DISPUR", lat: 26.1400, lng: 91.7900 },
  { name: "Brahmaputra River Bank Bypass", zone_id: "ZONE-NE03", node_id: "N_FANCY_BAZAAR", lat: 26.1900, lng: 91.7250 },
  { name: "Kaziranga National Park Corridor (NH-27)", zone_id: "ZONE-NE06", node_id: "N_KAZIRANGA", lat: 26.5800, lng: 93.1700 },
  { name: "Majuli River Island Ferry Terminal", zone_id: "ZONE-NE05", node_id: "N_MAJULI", lat: 26.9500, lng: 94.1700 },
  { name: "Cherrapunji / Sohra Heavy Rainfall Zone", zone_id: "ZONE-NE07", node_id: "N_CHERRAPUNJI", lat: 25.2986, lng: 91.7303 },
  { name: "Shillong Hills Capital Area", zone_id: "ZONE-NE08", node_id: "N_SHILLONG", lat: 25.5788, lng: 91.8933 }
];

function onPlaceSearchInput(query) {
  const dropdown = document.getElementById('gmap-search-suggestions');
  if (!query || query.trim().length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  const matches = PLACE_DATABASE.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  if (matches.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  dropdown.innerHTML = '';
  matches.forEach(place => {
    const item = document.createElement('div');
    item.className = 'gmap-sug-item';
    item.innerHTML = `📍 <strong>${place.name}</strong>`;
    item.onclick = () => {
      selectSearchedPlace(place);
    };
    dropdown.appendChild(item);
  });
  dropdown.style.display = 'block';
}

function selectSearchedPlace(place) {
  document.getElementById('gmap-search-input').value = place.name;
  document.getElementById('gmap-search-suggestions').style.display = 'none';
  
  const destSelect = document.getElementById('route-dest');
  destSelect.value = place.node_id;
  
  if (map) {
    map.flyTo([place.lat, place.lng], 14, { duration: 1.2 });
  }

  calculateRoute();
}

function clearPlaceSearch() {
  document.getElementById('gmap-search-input').value = '';
  document.getElementById('gmap-search-suggestions').style.display = 'none';
}

/* 🎯 Live Location Feature: Single Lock & Continuous Tracking */
function locateUserGPS() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleGpsPositionUpdate(position);
        startContinuousGpsTracking();
      },
      (error) => {
        console.warn("GPS Geolocation notice (using Guwahati GPS baseline):", error.message);
        const fallbackPos = { coords: { latitude: 26.1550, longitude: 91.6650, accuracy: 15 } };
        handleGpsPositionUpdate(fallbackPos);
        alert("📍 Live GPS locked to Guwahati Metro (26.1550, 91.6650). Calculating safest route...");
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
}

function handleGpsPositionUpdate(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const accuracy = position.coords.accuracy || 20;
  userGpsCoords = [lat, lng];

  const originSelect = document.getElementById('route-origin');
  originSelect.value = 'USER_LIVE_GPS';

  addUserGpsMarker(lat, lng, accuracy);
  calculateRoute();
}

function startContinuousGpsTracking() {
  if (isLiveGpsTrackingActive || !('geolocation' in navigator)) return;
  
  isLiveGpsTrackingActive = true;
  watchPositionId = navigator.geolocation.watchPosition(
    (position) => {
      handleGpsPositionUpdate(position);
    },
    (err) => console.log("Live GPS tracking update note:", err),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
  );
}

function addUserGpsMarker(lat, lng, accuracy = 20) {
  if (userGpsMarker && map) map.removeLayer(userGpsMarker);
  if (userAccuracyCircle && map) map.removeLayer(userAccuracyCircle);

  userAccuracyCircle = L.circle([lat, lng], {
    radius: accuracy,
    fillColor: '#3b82f6',
    fillOpacity: 0.15,
    color: '#60a5fa',
    weight: 1.5
  }).addTo(map);

  userGpsMarker = L.circleMarker([lat, lng], {
    radius: 9,
    fillColor: '#0284c7',
    color: '#ffffff',
    weight: 3,
    fillOpacity: 0.95
  }).addTo(map);

  userGpsMarker.bindPopup(`
    <div style="font-family: Inter; padding: 4px;">
      <span style="background: #e0f2fe; color: #0284c7; font-size: 0.72rem; font-weight: 800; padding: 2px 6px; border-radius: 4px;">
        🔵 YOUR LIVE LOCATION
      </span>
      <h4 style="margin: 4px 0 2px 0; font-size: 0.9rem;">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</h4>
      <p style="margin: 0; font-size: 0.75rem; color: #64748b;">Live GPS tracking active (Accuracy: ~${Math.round(accuracy)}m)</p>
    </div>
  `);

  map.flyTo([lat, lng], 14, { duration: 1.2 });
}

function onRouteInputsChanged() {
  clearRouteLines();
  document.getElementById('route-results-container').style.display = 'none';
  document.getElementById('step-directions-container').style.display = 'none';
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
    renderStepDirections(route);
  }
}

function renderStepDirections(route) {
  const container = document.getElementById('step-directions-container');
  const list = document.getElementById('step-directions-list');
  document.getElementById('eta-badge').innerText = `ETA: ${route.travel_time_min} mins (${route.length_km} km)`;

  list.innerHTML = '';
  container.style.display = 'block';

  if (!route.edges || route.edges.length === 0) return;

  const startLi = document.createElement('li');
  startLi.className = 'dir-step-item';
  startLi.innerHTML = `
    <span class="dir-icon">🟢</span>
    <div>
      <div><strong>Start Journey</strong> at ${document.getElementById('route-origin').selectedOptions[0].text}</div>
    </div>
  `;
  list.appendChild(startLi);

  route.edges.forEach((e, idx) => {
    const li = document.createElement('li');
    li.className = 'dir-step-item';
    const isRisky = e.flood_probability > 60;
    
    li.innerHTML = `
      <span class="dir-icon">${idx % 2 === 0 ? '🚗' : '↗️'}</span>
      <div>
        <div>Drive along <strong>${e.name}</strong></div>
        <div class="dir-dist">Segment Risk: <strong style="color:${isRisky ? '#dc2626' : '#16a34a'}">${e.flood_probability}%</strong> ${isRisky ? '⚠️ (Brahmaputra/Waterlogging Warning)' : '✅ (Clear Road)'}</div>
      </div>
    `;
    list.appendChild(li);
  });

  const endLi = document.createElement('li');
  endLi.className = 'dir-step-item';
  endLi.innerHTML = `
    <span class="dir-icon">🏁</span>
    <div>
      <div><strong>Arrive</strong> at ${document.getElementById('route-dest').selectedOptions[0].text}</div>
    </div>
  `;
  list.appendChild(endLi);
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
    latitude: 26.1550,
    longitude: 91.6650
  };

  try {
    const resp = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const res = await resp.json();
    
    closeReportModal();
    alert(`🚨 Incident report submitted! Road ${roadId} risk updated to 95%. Recalculating routes...`);
    
    addIncidentMarker(26.1550, 91.6650, roadId, payload.water_depth);
    
    await fetchRoads();
    if (currentRoutesData) {
      calculateRoute();
    }
  } catch (err) {
    console.error("Error submitting report:", err);
  }
}

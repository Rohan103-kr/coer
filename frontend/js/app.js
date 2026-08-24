// app.js - Main Application Entrypoint & State Orchestrator for Roorkee & Haridwar

let currentZonesGeoJSON = null;
let isLiveWeatherActive = false;
let liveWeatherInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Lucide icons
  lucide.createIcons();

  // 2. Initialize Leaflet Map
  initMap();

  // 3. Fetch initial data for 100mm rainfall baseline
  await fetchZones(100);
  await fetchRoads(100);
  await fetchBottlenecks();
  
  // 4. Calculate default route
  calculateRoute();

  // 5. Connect WebSocket for live updates
  initWebSocket();
});

function switchMode(mode) {
  const citizenTab = document.getElementById('tab-citizen');
  const municipalTab = document.getElementById('tab-municipal');
  const citizenPanel = document.getElementById('panel-citizen');
  const municipalPanel = document.getElementById('panel-municipal');

  if (mode === 'citizen') {
    citizenTab.classList.add('active');
    municipalTab.classList.remove('active');
    citizenPanel.classList.add('active');
    municipalPanel.classList.remove('active');
    clearMunicipalHighlights();
    if (currentRoutesData && selectedRouteKey) {
      selectRouteOption(selectedRouteKey);
    }
  } else {
    municipalTab.classList.add('active');
    citizenTab.classList.remove('active');
    municipalPanel.classList.add('active');
    citizenPanel.classList.remove('active');
    
    clearRouteLines();
    
    // Focus top critical ward on entering Municipal Mode
    if (currentZonesGeoJSON && currentZonesGeoJSON.features && currentZonesGeoJSON.features.length > 0) {
      const topCritical = [...currentZonesGeoJSON.features].sort((a, b) => b.properties.flood_probability - a.properties.flood_probability)[0];
      if (topCritical) {
        focusZoneOnMap(topCritical.properties.zone_id);
      }
    }
    
    // Pre-run optimization on tab switch
    runOptimization();
  }
}

/* ML Model Performance Metrics Modal */
function openMetricsModal() {
  document.getElementById('metrics-modal').classList.add('active');
}

function closeMetricsModal(e) {
  document.getElementById('metrics-modal').classList.remove('active');
}

/* Voice Text-to-Speech Alert Helper */
function speakAlert(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

/* Live Weather Toggle Handler */
async function toggleLiveWeatherMode() {
  const liveBtn = document.getElementById('live-weather-btn');
  const liveBanner = document.getElementById('live-weather-card');
  const liveLabel = document.getElementById('live-mode-label');

  isLiveWeatherActive = !isLiveWeatherActive;

  if (isLiveWeatherActive) {
    liveBtn.classList.add('active');
    liveBanner.style.display = 'block';
    liveLabel.innerText = "LIVE WEATHER: ACTIVE";
    
    // Fetch live weather immediately
    await refreshLiveWeatherFeed();

    // Set polling interval every 60 seconds
    liveWeatherInterval = setInterval(refreshLiveWeatherFeed, 60000);
  } else {
    liveBtn.classList.remove('active');
    liveBanner.style.display = 'none';
    liveLabel.innerText = "LIVE WEATHER (Roorkee/Haridwar)";
    
    if (liveWeatherInterval) clearInterval(liveWeatherInterval);
    
    // Restore simulator rainfall value
    onRainfallSliderChange(document.getElementById('rainfall-slider').value);
  }
}

async function refreshLiveWeatherFeed() {
  try {
    const resp = await fetch('/api/live-weather');
    const weather = await resp.json();

    document.getElementById('live-rf-val').innerText = `${weather.rainfall_24h_mm} mm (24h)`;
    document.getElementById('live-temp-val').innerText = `${weather.temperature_c}°C (${weather.humidity_pct}%)`;
    document.getElementById('live-weather-desc').innerText = `Condition: ${weather.weather_description} • Wind: ${weather.wind_speed_kmh} km/h`;
    document.getElementById('live-station-time').innerText = `Roorkee-Haridwar Station • ${weather.timestamp.split('T')[1] || 'Just now'}`;

    // Update risk prediction with live rainfall value
    const liveRainfall = weather.rainfall_24h_mm;
    document.getElementById('sim-rain-val').innerText = `${liveRainfall} mm (LIVE)`;
    document.getElementById('current-rainfall-disp').innerText = `Live Rain: ${liveRainfall} mm`;

    await fetchZones(liveRainfall);
    await fetchRoads(liveRainfall);
    await fetchBottlenecks();
    if (currentRoutesData) {
      calculateRoute();
    }
  } catch (err) {
    console.error("Error refreshing live weather feed:", err);
  }
}

async function fetchZones(rainfall = 100) {
  try {
    const resp = await fetch(`/api/zones?rainfall=${rainfall}`);
    currentZonesGeoJSON = await resp.json();
    
    // Update Map Layer
    updateZonesMap(currentZonesGeoJSON);
    
    // Update Municipal Critical Hotspots List
    populateCriticalZones(currentZonesGeoJSON);

    // Compute City Average Risk
    const risks = currentZonesGeoJSON.features.map(f => f.properties.flood_probability || 0);
    const avgRisk = Math.round(risks.reduce((a, b) => a + b, 0) / (risks.length || 1));
    document.getElementById('city-avg-risk').innerText = `Avg Risk: ${avgRisk}%`;
  } catch (err) {
    console.error("Error fetching zones data:", err);
  }
}

async function fetchRoads(rainfall = 100) {
  try {
    const resp = await fetch(`/api/roads?rainfall=${rainfall}`);
    const roads = await resp.json();
    updateRoadsMap(roads);
  } catch (err) {
    console.error("Error fetching roads data:", err);
  }
}

/* Zone Detail & SHAP Explainable AI Modal */
let activeModalZoneProps = null;

function openZoneModal(props) {
  activeModalZoneProps = props;
  
  document.getElementById('modal-zone-id').innerText = props.zone_id;
  document.getElementById('modal-zone-name').innerText = props.name;
  document.getElementById('modal-ward-name').innerText = `${props.ward} • Roorkee/Haridwar Region`;
  
  const riskPct = document.getElementById('modal-risk-pct');
  riskPct.innerText = `${props.flood_probability}%`;
  riskPct.style.color = props.risk_color;

  document.getElementById('modal-rainfall-val').innerText = `${props.current_rainfall_mm || currentRainfallLevel} mm`;
  document.getElementById('modal-elev-val').innerText = `${props.elevation} m`;
  document.getElementById('modal-pop-val').innerText = props.population.toLocaleString();

  // Populate Explainable AI (SHAP Factors)
  const xaiContainer = document.getElementById('xai-bars');
  xaiContainer.innerHTML = '';

  if (props.explanations && props.explanations.length > 0) {
    props.explanations.forEach(item => {
      const barItem = document.createElement('div');
      barItem.className = 'xai-bar-item';
      barItem.innerHTML = `
        <div class="xai-bar-label">
          <span>${item.factor} (${item.value})</span>
          <span>${item.weight}% impact</span>
        </div>
        <div class="xai-bar-bg">
          <div class="xai-bar-fill" style="width: ${item.weight}%;"></div>
        </div>
      `;
      xaiContainer.appendChild(barItem);
    });
  }

  document.getElementById('zone-modal').classList.add('active');
}

function closeZoneModal(e) {
  document.getElementById('zone-modal').classList.remove('active');
}

function setAsRouteOriginFromModal() {
  if (activeModalZoneProps) {
    const originSelect = document.getElementById('route-origin');
    if (activeModalZoneProps.zone_id === 'ZONE-RK01') originSelect.value = 'N_IIT_ROORKEE';
    else if (activeModalZoneProps.zone_id === 'ZONE-RK02') originSelect.value = 'N_CIVIL_LINES';
    else if (activeModalZoneProps.zone_id === 'ZONE-RK03') originSelect.value = 'N_SOLANI_AQUEDUCT';
    else if (activeModalZoneProps.zone_id === 'ZONE-HW02') originSelect.value = 'N_JWALAPUR';
    
    closeZoneModal();
    switchMode('citizen');
    calculateRoute();
  }
}

/* WebSocket Connection */
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/live-updates`;
  
  try {
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      console.log("⚡ Live WebSocket Event Received:", event.data);
    };
  } catch (err) {
    console.log("WebSocket connect error (fallback active):", err);
  }
}

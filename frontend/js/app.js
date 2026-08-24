// app.js - Main Application Entrypoint & State Orchestrator for Northeast India

let currentZonesGeoJSON = null;
let isLiveWeatherActive = false;
let liveWeatherInterval = null;
let activeStationKey = 'guwahati';
let currentRoutesData = null;
let selectedRouteKey = 'safest';
let currentRainfallLevel = 100;

document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();

  // Initialize Leaflet Map
  initMap();

  // Fetch initial data for 100mm rainfall baseline
  await fetchZones(100);
  await fetchRoads(100);
  await fetchBottlenecks();
  
  // Calculate default route
  calculateRoute();

  // Connect WebSocket for live updates
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
    
    if (currentZonesGeoJSON && currentZonesGeoJSON.features && currentZonesGeoJSON.features.length > 0) {
      const topCritical = [...currentZonesGeoJSON.features].sort((a, b) => b.properties.flood_probability - a.properties.flood_probability)[0];
      if (topCritical) {
        focusZoneOnMap(topCritical.properties.zone_id);
      }
    }
    
    runOptimization();
  }
}

/* Northeast India Weather Station Selection Handler */
async function onStationChanged(stationKey) {
  activeStationKey = stationKey;
  if (isLiveWeatherActive) {
    await refreshLiveWeatherFeed(stationKey);
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
    
    await refreshLiveWeatherFeed(activeStationKey);

    liveWeatherInterval = setInterval(() => refreshLiveWeatherFeed(activeStationKey), 60000);
  } else {
    liveBtn.classList.remove('active');
    liveBanner.style.display = 'none';
    liveLabel.innerText = "LIVE WEATHER (Northeast India)";
    
    if (liveWeatherInterval) clearInterval(liveWeatherInterval);
    
    onRainfallSliderChange(document.getElementById('rainfall-slider').value);
  }
}

async function refreshLiveWeatherFeed(stationKey = 'guwahati') {
  try {
    const resp = await fetch(`/api/live-weather?station=${stationKey}`);
    const weather = await resp.json();

    document.getElementById('live-rf-val').innerText = `${weather.rainfall_24h_mm} mm (24h)`;
    document.getElementById('live-temp-val').innerText = `${weather.temperature_c}°C (${weather.humidity_pct}%)`;
    document.getElementById('live-weather-desc').innerText = `Condition: ${weather.weather_description} • Wind: ${weather.wind_speed_kmh} km/h`;
    document.getElementById('live-station-time').innerText = `${weather.location_name} Station • ${weather.timestamp.split('T')[1] || 'Just now'}`;

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

async function onRainfallSliderChange(val) {
  currentRainfallLevel = parseFloat(val);
  document.getElementById('sim-rain-val').innerText = `${val} mm`;
  document.getElementById('current-rainfall-disp').innerText = `Rainfall: ${val} mm`;

  await fetchZones(val);
  await fetchRoads(val);
  await fetchBottlenecks();
  calculateRoute();
}

async function startJudgeTour() {
  switchMode('citizen');
  document.getElementById('rainfall-slider').value = 150;
  onRainfallSliderChange(150);
  
  setTimeout(async () => {
    await calculateRoute();
    selectRouteOption('safest');
    
    setTimeout(() => {
      if (currentZonesGeoJSON && currentZonesGeoJSON.features && currentZonesGeoJSON.features[0]) {
        openZoneModal(currentZonesGeoJSON.features[0].properties);
      }
      
      setTimeout(() => {
        closeZoneModal();
        switchMode('municipal');
        runOptimization();
      }, 4000);
    }, 4000);
  }, 2000);
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

async function fetchZones(rainfall = 100) {
  try {
    const resp = await fetch(`/api/zones?rainfall=${rainfall}`);
    currentZonesGeoJSON = await resp.json();
    
    updateZonesMap(currentZonesGeoJSON);
    populateCriticalZones(currentZonesGeoJSON);

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

let activeModalZoneProps = null;

function openZoneModal(props) {
  activeModalZoneProps = props;
  
  document.getElementById('modal-zone-id').innerText = props.zone_id;
  document.getElementById('modal-zone-name').innerText = props.name;
  document.getElementById('modal-ward-name').innerText = `${props.ward} • Guwahati / Northeast Region`;
  
  const riskPct = document.getElementById('modal-risk-pct');
  riskPct.innerText = `${props.flood_probability}%`;
  riskPct.style.color = props.risk_color;

  document.getElementById('modal-rainfall-val').innerText = `${props.current_rainfall_mm || currentRainfallLevel} mm`;
  document.getElementById('modal-elev-val').innerText = `${props.elevation} m`;
  document.getElementById('modal-pop-val').innerText = props.population.toLocaleString();

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
    if (activeModalZoneProps.zone_id === 'ZONE-NE01') originSelect.value = 'N_FANCY_BAZAAR';
    else if (activeModalZoneProps.zone_id === 'ZONE-NE02') originSelect.value = 'N_DISPUR';
    else if (activeModalZoneProps.zone_id === 'ZONE-NE04') originSelect.value = 'N_JWALUKBARI';
    
    closeZoneModal();
    switchMode('citizen');
    calculateRoute();
  }
}

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

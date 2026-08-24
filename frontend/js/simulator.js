// simulator.js - Rainfall Simulator Slider Controller

let currentRainfallLevel = 100;
let simDebounceTimer = null;

function onRainfallSliderChange(val) {
  currentRainfallLevel = parseFloat(val);
  
  // Update header and simulator label displays immediately
  document.getElementById('sim-rain-val').innerText = `${val} mm`;
  document.getElementById('current-rainfall-disp').innerText = `Rainfall: ${val} mm`;

  // Debounce API calls for smooth slider performance
  clearTimeout(simDebounceTimer);
  simDebounceTimer = setTimeout(() => {
    refreshSimulation(currentRainfallLevel);
  }, 200);
}

async function refreshSimulation(rainfall) {
  console.log(`🌧️ Simulating ${rainfall} mm 24-hour rainfall scenario across Chennai...`);
  
  // 1. Refresh Zones GeoJSON
  await fetchZones(rainfall);

  // 2. Refresh Roads
  await fetchRoads(rainfall);

  // 3. Refresh Bottlenecks
  await fetchBottlenecks();

  // 4. Recalculate routes if active
  if (currentRoutesData) {
    calculateRoute();
  }
}

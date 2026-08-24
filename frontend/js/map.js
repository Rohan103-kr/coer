// map.js - Leaflet GIS Map Management for Roorkee & Haridwar DrainMind AI

let map = null;
let zonesLayer = null;
let roadsLayer = null;
let drainsLayer = null;
let routePolylines = [];
let incidentMarkers = [];
let municipalHighlightLayer = null;
let currentZonesData = null;
let currentDrainsData = [];

function initMap() {
  // Center map on Roorkee & Haridwar region (Uttarakhand)
  map = L.map('map', {
    center: [29.9000, 77.9800],
    zoom: 11,
    zoomControl: true
  });

  // Minimalist Light CartoDB Basemap
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
  }).addTo(map);

  municipalHighlightLayer = L.layerGroup().addTo(map);
  console.log("🗺️ Leaflet GIS Map Initialized for Roorkee & Haridwar Flood Resilience Platform");
}

function updateZonesMap(zonesGeoJSON) {
  currentZonesData = zonesGeoJSON;
  if (zonesLayer) {
    map.removeLayer(zonesLayer);
  }

  zonesLayer = L.geoJSON(zonesGeoJSON, {
    style: function (feature) {
      const risk = feature.properties.flood_probability || 0;
      let color = '#16a34a';
      if (risk > 80) color = '#dc2626';
      else if (risk > 60) color = '#f97316';
      else if (risk > 30) color = '#eab308';

      return {
        fillColor: color,
        weight: 1.8,
        opacity: 0.9,
        color: '#ffffff',
        fillOpacity: 0.5
      };
    },
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      feature._leafletLayer = layer;
      
      layer.on({
        mouseover: function (e) {
          layer.setStyle({ fillOpacity: 0.75, weight: 3 });
        },
        mouseout: function (e) {
          zonesLayer.resetStyle(layer);
        },
        click: function (e) {
          openZoneModal(p);
        }
      });

      layer.bindTooltip(`
        <div style="font-family: Inter; padding: 2px 4px;">
          <strong>${p.name} (${p.zone_id})</strong><br/>
          Elev: ${p.elevation}m | Risk: <strong style="color: ${p.risk_color};">${p.flood_probability}%</strong>
        </div>
      `, { sticky: true });
    }
  }).addTo(map);
}

function updateRoadsMap(roadsData) {
  if (roadsLayer) {
    map.removeLayer(roadsLayer);
  }

  const lines = [];
  roadsData.forEach(r => {
    const line = L.polyline([r.start_coords, r.end_coords], {
      color: r.status_color || '#94a3b8',
      weight: r.is_overridden ? 5 : 3,
      opacity: 0.85,
      dashArray: r.is_overridden ? '6, 6' : null
    });
    
    line.bindPopup(`
      <div style="font-family: Inter;">
        <strong>${r.name} (${r.road_id})</strong><br/>
        Length: ${r.length_km} km | Type: ${r.road_type}<br/>
        Segment Risk: <strong style="color: ${r.status_color}">${r.flood_probability}%</strong>
        ${r.is_overridden ? '<br/><span style="color: #dc2626; font-weight:700;">⚠️ Citizen Report Overridden</span>' : ''}
      </div>
    `);
    lines.push(line);
  });

  roadsLayer = L.layerGroup(lines).addTo(map);
}

function updateDrainsMap(drainsData) {
  currentDrainsData = drainsData;
  if (drainsLayer) {
    map.removeLayer(drainsLayer);
  }

  const drainLines = [];
  drainsData.forEach(d => {
    const score = d.bottleneck_score || 30;
    const color = score >= 70 ? '#78350f' : (score >= 40 ? '#b45309' : '#0284c7');
    
    const poly = L.polyline(d.coords, {
      color: color,
      weight: score >= 70 ? 5 : 3,
      opacity: 0.9,
      dashArray: score >= 70 ? '8, 8' : null
    });

    poly.bindPopup(`
      <div style="font-family: Inter; padding: 4px;">
        <strong style="color: ${color};">🌊 SWD Drain ${d.drain_id}: ${d.drain_name}</strong><br/>
        Ward: ${d.ward} | Capacity: ${d.design_capacity_m3s} m³/s<br/>
        Bottleneck Confidence: <strong>${d.confidence}</strong><br/>
        Recommendation: <em>${d.recommendation}</em>
      </div>
    `);

    drainLines.push(poly);
  });

  drainsLayer = L.layerGroup(drainLines).addTo(map);
}

// Fly to and highlight a specific ward when clicked in Municipal Hotspots list
function focusZoneOnMap(zoneId) {
  if (!currentZonesData) return;
  
  const feature = currentZonesData.features.find(f => f.properties.zone_id === zoneId);
  if (feature) {
    const p = feature.properties;
    const center = p.center;
    
    map.flyTo(center, 14, { duration: 1.2 });
    
    municipalHighlightLayer.clearLayers();
    
    // Draw pulsing highlight polygon
    const poly = L.polygon(feature.geometry.coordinates[0].map(c => [c[1], c[0]]), {
      color: '#dc2626',
      weight: 4,
      fillColor: '#dc2626',
      fillOpacity: 0.35
    }).addTo(municipalHighlightLayer);

    const popupContent = `
      <div style="font-family: Inter; min-width: 200px;">
        <div style="background: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; display: inline-block;">
          🔴 MUNICIPAL CRITICAL HOTSPOT
        </div>
        <h3 style="margin: 4px 0 2px 0; font-size: 1rem; color: #0f172a;">${p.name}</h3>
        <p style="margin: 0 0 8px 0; font-size: 0.78rem; color: #64748b;">${p.ward} • Pop: ${p.population.toLocaleString()}</p>
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 8px;">
          <span>Flood Risk: <strong style="color: ${p.risk_color};">${p.flood_probability}%</strong></span>
          <span>Elevation: <strong>${p.elevation}m</strong></span>
        </div>
        <button onclick="openZoneModal(activeModalZoneProps || ${JSON.stringify(p).replace(/"/g, '&quot;')})" style="width: 100%; padding: 6px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 0.8rem;">
          🔍 Inspect SHAP XAI Factors
        </button>
      </div>
    `;
    
    poly.bindPopup(popupContent).openPopup();
  }
}

// Fly to and highlight suspected bottleneck drain
function focusBottleneckDrain(drainId) {
  if (!currentDrainsData) return;
  const drain = currentDrainsData.find(d => d.drain_id === drainId || d.drain_name.includes(drainId));
  
  if (drain && drain.coords && drain.coords.length > 0) {
    const midPoint = drain.coords[0];
    map.flyTo(midPoint, 14, { duration: 1.2 });

    municipalHighlightLayer.clearLayers();

    const circle = L.circleMarker(midPoint, {
      radius: 12,
      fillColor: '#78350f',
      color: '#ffffff',
      weight: 3,
      fillOpacity: 0.95
    }).addTo(municipalHighlightLayer);

    circle.bindPopup(`
      <div style="font-family: Inter; padding: 4px;">
        <span style="background: #fef3c7; color: #78350f; font-weight: 800; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;">
          🚨 CRITICAL SWD BOTTLENECK
        </span>
        <h3 style="margin: 6px 0 2px 0; font-size: 0.95rem;">${drain.drain_name} (${drain.drain_id})</h3>
        <p style="font-size: 0.8rem; margin: 0 0 6px 0;">Ward: ${drain.ward} | Score: <strong style="color:#dc2626;">${drain.confidence}</strong></p>
        <p style="font-size: 0.75rem; color: #78350f; font-style: italic; margin: 0;">${drain.recommendation}</p>
      </div>
    `).openPopup();
  }
}

function drawRouteOnMap(routeData, modeColor = '#0284c7') {
  clearRouteLines();
  if (!routeData || !routeData.coordinates || routeData.coordinates.length === 0) return;

  const polyline = L.polyline(routeData.coordinates, {
    color: modeColor,
    weight: 6,
    opacity: 0.9,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);

  routePolylines.push(polyline);
  map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
}

function clearRouteLines() {
  routePolylines.forEach(l => map.removeLayer(l));
  routePolylines = [];
}

function clearMunicipalHighlights() {
  if (municipalHighlightLayer) {
    municipalHighlightLayer.clearLayers();
  }
}

function addIncidentMarker(lat, lng, roadId, depth) {
  const marker = L.circleMarker([lat, lng], {
    radius: 8,
    fillColor: '#dc2626',
    color: '#ffffff',
    weight: 2,
    fillOpacity: 0.9
  }).addTo(map);

  marker.bindPopup(`
    <div style="font-family: Inter;">
      <strong style="color:#dc2626;">🚨 Reported Waterlogging</strong><br/>
      Road: ${roadId}<br/>
      Depth: ${depth}
    </div>
  `).openPopup();

  incidentMarkers.push(marker);
}

// map.js - Leaflet GIS Map Management for Roorkee & Haridwar DrainMind AI

let map = null;
let currentTileLayer = null;
let tileLayers = {};
let zonesLayer = null;
let roadsLayer = null;
let drainsLayer = null;
let routePolylines = [];
let routeMarkers = [];
let incidentMarkers = [];
let municipalHighlightLayer = null;
let cityLabelMarkersGroup = null;
let currentZonesData = null;
let currentDrainsData = [];

function initMap() {
  // Center map on Roorkee & Haridwar region (Uttarakhand)
  map = L.map('map', {
    center: [29.9000, 77.9800],
    zoom: 11,
    zoomControl: true
  });

  // OpenStreetMap Standard Tiles
  tileLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  });

  tileLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'Esri'
  });

  tileLayers.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; CARTO'
  });

  currentTileLayer = tileLayers.osm;
  currentTileLayer.addTo(map);

  municipalHighlightLayer = L.layerGroup().addTo(map);
  cityLabelMarkersGroup = L.layerGroup().addTo(map);

  // Add prominent permanent City Label Markers
  addCityNameLabels();

  console.log("🗺️ Leaflet GIS Map Initialized for Roorkee & Haridwar Flood Resilience Platform");
}

function addCityNameLabels() {
  if (cityLabelMarkersGroup) {
    cityLabelMarkersGroup.clearLayers();
  }

  const roorkeeMarker = L.marker([29.8649, 77.8965], {
    icon: L.divIcon({
      className: 'city-name-badge badge-roorkee',
      html: '🏙️ ROORKEE CITY',
      iconSize: [120, 28],
      iconAnchor: [60, 14]
    })
  });

  const haridwarMarker = L.marker([29.9560, 78.1700], {
    icon: L.divIcon({
      className: 'city-name-badge badge-haridwar',
      html: '🏛️ HARIDWAR CITY',
      iconSize: [130, 28],
      iconAnchor: [65, 14]
    })
  });

  cityLabelMarkersGroup.addLayer(roorkeeMarker);
  cityLabelMarkersGroup.addLayer(haridwarMarker);
}

function switchBasemap(type) {
  if (tileLayers[type]) {
    map.removeLayer(currentTileLayer);
    currentTileLayer = tileLayers[type];
    currentTileLayer.addTo(map);

    document.querySelectorAll('.bm-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) {
      event.target.classList.add('active');
    }
  }
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
        weight: 1.0,
        opacity: 0.6,
        color: '#ffffff',
        fillOpacity: 0.25 // Clean subtle fill opacity to declutter map
      };
    },
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      feature._leafletLayer = layer;
      
      layer.on({
        mouseover: function (e) {
          layer.setStyle({ fillOpacity: 0.6, weight: 2 });
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
      color: r.status_color || '#cbd5e1',
      weight: r.is_overridden ? 4 : 2,
      opacity: 0.3, // Dim background roads so active route stands out sharply
      dashArray: r.is_overridden ? '6, 6' : null
    });
    
    line.bindPopup(`
      <div style="font-family: Inter;">
        <strong>${r.name} (${r.road_id})</strong><br/>
        Length: ${r.length_km} km | Segment Risk: <strong style="color: ${r.status_color}">${r.flood_probability}%</strong>
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
      weight: score >= 70 ? 4 : 2,
      opacity: 0.7,
      dashArray: score >= 70 ? '6, 6' : null
    });

    poly.bindPopup(`
      <div style="font-family: Inter; padding: 4px;">
        <strong style="color: ${color};">🌊 SWD Drain ${d.drain_id}: ${d.drain_name}</strong><br/>
        Ward: ${d.ward} | Bottleneck Confidence: <strong>${d.confidence}</strong>
      </div>
    `);

    drainLines.push(poly);
  });

  drainsLayer = L.layerGroup(drainLines).addTo(map);
}

// Clean Focused Route Drawing for Selected Locations Only
function drawRouteOnMap(routeData, modeColor = '#0284c7') {
  clearRouteLines();
  if (!routeData || !routeData.coordinates || routeData.coordinates.length === 0) return;

  // 1. Draw bold glowing active route polyline
  const polyline = L.polyline(routeData.coordinates, {
    color: modeColor,
    weight: 7,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);

  routePolylines.push(polyline);

  // 2. Add Start Marker (Origin) & End Marker (Destination)
  const startCoords = routeData.coordinates[0];
  const endCoords = routeData.coordinates[routeData.coordinates.length - 1];

  const startMarker = L.marker(startCoords, {
    icon: L.divIcon({
      className: 'route-node-pin pin-start',
      html: '🟢 START',
      iconSize: [80, 24],
      iconAnchor: [40, 12]
    })
  }).addTo(map);

  const endMarker = L.marker(endCoords, {
    icon: L.divIcon({
      className: 'route-node-pin pin-end',
      html: '🏁 END',
      iconSize: [70, 24],
      iconAnchor: [35, 12]
    })
  }).addTo(map);

  routeMarkers.push(startMarker);
  routeMarkers.push(endMarker);

  // 3. Zoom & fit map viewport tightly around selected route only
  map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
}

function clearRouteLines() {
  routePolylines.forEach(l => map.removeLayer(l));
  routePolylines = [];
  routeMarkers.forEach(m => map.removeLayer(m));
  routeMarkers = [];
}

function focusZoneOnMap(zoneId) {
  if (!currentZonesData) return;
  
  const feature = currentZonesData.features.find(f => f.properties.zone_id === zoneId);
  if (feature) {
    const p = feature.properties;
    const center = p.center;
    
    map.flyTo(center, 14, { duration: 1.2 });
    
    municipalHighlightLayer.clearLayers();
    
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

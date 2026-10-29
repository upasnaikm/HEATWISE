/**
 * HeatWise Geographical Heat Risk Map Controller
 * Real Leaflet GeoJSON mapping engine with district-level choropleth visualization and offline vector fallback.
 */

const HeatWiseGeoMap = {
  map: null,
  geoJsonLayer: null,
  currentIndicator: "max_temp_c", // "max_temp_c" | "humidity_pct" | "heat_illness_cases" | "candidate_alert"
  selectedDistrictId: "SYN_DIST_NORTH",
  isLeafletAvailable: false,
  offlineMode: false,

  METRIC_CONFIGS: {
    max_temp_c: {
      label: "Maximum Temperature",
      unit: "°C",
      explanation: "Evaluates ambient dry-bulb peak maximum temperature exposure across observation days.",
      colorStops: [
        { max: 32.0, color: "#e2e8f0", label: "<32°C (Mild)" },
        { max: 36.0, color: "#fef08a", label: "32–36°C (Moderate)" },
        { max: 40.0, color: "#fde047", label: "36–40°C (Warm)" },
        { max: 42.5, color: "#fb923c", label: "40–42.5°C (Yellow Caution)" },
        { max: 45.0, color: "#ea580c", label: "42.5–45°C (Orange Alert)" },
        { max: 99.0, color: "#dc2626", label: "≥45°C (Red Emergency)" }
      ]
    },
    humidity_pct: {
      label: "Relative Humidity",
      unit: "%",
      explanation: "Evaluates atmospheric moisture content moderating apparent Heat Index and evaporative cooling.",
      colorStops: [
        { max: 25.0, color: "#fef3c7", label: "<25% (Very Dry)" },
        { max: 40.0, color: "#fde68a", label: "25–40% (Semi-Arid)" },
        { max: 55.0, color: "#99f6e4", label: "40–55% (Moderate)" },
        { max: 70.0, color: "#2dd4bf", label: "55–70% (Elevated)" },
        { max: 80.0, color: "#0d9488", label: "70–80% (High Humid)" },
        { max: 100.0, color: "#065f46", label: "≥80% (Maritime Saturated)" }
      ]
    },
    heat_illness_cases: {
      label: "Hospital Heat-Illness Cases",
      unit: "cases",
      explanation: "Total recorded sentinel hospital admissions for acute heat exhaustion and heatstroke.",
      colorStops: [
        { max: 100, color: "#f1f5f9", label: "<100 cases (Minimal)" },
        { max: 400, color: "#ccfbf1", label: "100–400 (Low)" },
        { max: 800, color: "#fed7aa", label: "400–800 (Moderate)" },
        { max: 1400, color: "#fb923c", label: "800–1400 (Elevated)" },
        { max: 99999, color: "#dc2626", label: "≥1400 (Severe Surge)" }
      ]
    },
    candidate_alert: {
      label: "Candidate Alert Level",
      unit: "Category",
      explanation: "Empirical alert candidate derived from historical surge calibration. Marked for expert review only.",
      colorStops: [
        { code: "normal", color: "#f8fafc", label: "Baseline / Normal" },
        { code: "yellow", color: "#d97706", label: "Yellow Caution Tier" },
        { code: "orange", color: "#ea580c", label: "Orange Alert Tier" },
        { code: "red", color: "#dc2626", label: "Red Emergency Tier" },
        { code: "insufficient", color: "#94a3b8", label: "Insufficient Evidence" }
      ]
    }
  },

  init() {
    const container = document.getElementById("geomap");
    if (!container) return;

    this.bindEvents();
    this.selectedDistrictId = HeatWiseApp.state.activeDistrictId || "SYN_DIST_NORTH";

    // Test if Leaflet L is available
    if (typeof window.L !== "undefined" && window.L.map) {
      this.isLeafletAvailable = true;
      this.initLeafletMap(container);
    } else {
      this.isLeafletAvailable = false;
      this.initVectorFallback(container);
    }

    this.render();
  },

  bindEvents() {
    const btnTemp = document.getElementById("btnGeoMetricTemp");
    const btnHum = document.getElementById("btnGeoMetricHumidity");
    const btnCases = document.getElementById("btnGeoMetricCases");
    const btnAlert = document.getElementById("btnGeoMetricAlert");

    if (btnTemp) btnTemp.addEventListener("click", () => this.setIndicator("max_temp_c"));
    if (btnHum) btnHum.addEventListener("click", () => this.setIndicator("humidity_pct"));
    if (btnCases) btnCases.addEventListener("click", () => this.setIndicator("heat_illness_cases"));
    if (btnAlert) btnAlert.addEventListener("click", () => this.setIndicator("candidate_alert"));

    const btnLoad = document.getElementById("btnGeoLoadSelectedDistrict");
    if (btnLoad) {
      btnLoad.addEventListener("click", () => {
        if (this.selectedDistrictId) {
          if (this.selectedDistrictId.startsWith("UPLOAD_")) {
            HeatWiseApp.loadUploadedDistrict(this.selectedDistrictId.replace("UPLOAD_", ""));
          } else {
            HeatWiseApp.loadDistrict(this.selectedDistrictId);
          }
          const target = document.getElementById("syntheticDataBanner") || document.querySelector(".app-container");
          if (target) target.scrollIntoView({ behavior: "smooth" });
        }
      });
    }
  },

  initLeafletMap(container) {
    try {
      // Clear previous instance if any
      if (this.map) {
        this.map.remove();
        this.map = null;
      }

      this.map = L.map(container, {
        center: [22.8, 79.5],
        zoom: 5,
        minZoom: 4,
        maxZoom: 10,
        scrollWheelZoom: false,
        attributionControl: true
      });

      // Add CartoDB Positron / OSM tiles with failure detection
      const tileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19
      });

      tileLayer.on("tileerror", () => {
        const notice = document.getElementById("geomapOfflineNotice");
        if (notice) notice.classList.remove("hidden");
      });

      tileLayer.addTo(this.map);

      // Add GeoJSON Layer
      this.geoJsonLayer = L.geoJSON(HeatWiseGeoData.getGeoJSON(), {
        style: (feature) => this.getFeatureStyle(feature),
        onEachFeature: (feature, layer) => this.bindFeatureEvents(feature, layer)
      }).addTo(this.map);

    } catch (err) {
      console.warn("Leaflet map initialization encountered an error. Falling back to vector map.", err);
      this.isLeafletAvailable = false;
      this.initVectorFallback(container);
    }
  },

  initVectorFallback(container) {
    const notice = document.getElementById("geomapOfflineNotice");
    if (notice) {
      notice.textContent = "ℹ️ Running in Offline Vector Mode. Full interactive district heat analysis active.";
      notice.classList.remove("hidden");
    }
    this.renderVectorSvgMap(container);
  },

  setIndicator(metric) {
    this.currentIndicator = metric;

    // Update active button classes
    const buttons = [
      { id: "btnGeoMetricTemp", metric: "max_temp_c" },
      { id: "btnGeoMetricHumidity", metric: "humidity_pct" },
      { id: "btnGeoMetricCases", metric: "heat_illness_cases" },
      { id: "btnGeoMetricAlert", metric: "candidate_alert" }
    ];

    buttons.forEach(b => {
      const el = document.getElementById(b.id);
      if (el) {
        if (b.metric === metric) el.classList.add("active");
        else el.classList.remove("active");
      }
    });

    // Update explanation text
    const config = this.METRIC_CONFIGS[metric];
    const expEl = document.getElementById("geomapMetricExplain");
    if (expEl && config) expEl.textContent = config.explanation;

    this.render();
  },

  updateDateRange(startDate, endDate) {
    const labelEl = document.getElementById("geomapWindowLabel");
    if (labelEl) {
      if (startDate && endDate) labelEl.textContent = `${startDate} to ${endDate}`;
      else labelEl.textContent = "Full Season Window";
    }
    this.render();
  },

  highlightDistrict(districtId) {
    this.selectedDistrictId = districtId;
    if (this.isLeafletAvailable && this.geoJsonLayer) {
      this.geoJsonLayer.eachLayer(layer => {
        if (layer.feature) {
          const style = this.getFeatureStyle(layer.feature);
          layer.setStyle(style);
        }
      });

      // Pan to district center if geocoded
      const center = HeatWiseGeoData.getCenter(districtId);
      if (center && this.map) {
        this.map.panTo(center, { animate: true, duration: 0.8 });
      }
    } else {
      this.render();
    }

    this.inspectDistrict(districtId);
  },

  render() {
    this.renderLegend();

    // Check for non-geocoded uploaded districts
    this.checkNonGeocodedDistricts();

    if (this.isLeafletAvailable && this.geoJsonLayer) {
      this.geoJsonLayer.eachLayer(layer => {
        if (layer.feature) {
          const style = this.getFeatureStyle(layer.feature);
          layer.setStyle(style);
          this.updateLayerPopupAndTooltip(layer.feature, layer);
        }
      });
    } else {
      const container = document.getElementById("geomap");
      if (container) this.renderVectorSvgMap(container);
    }

    this.inspectDistrict(this.selectedDistrictId);
  },

  getDistrictMetrics(districtId) {
    let records = [];

    // Check if uploaded data mode is active
    if (HeatWiseApp.state.isUploadedData && HeatWiseApp.state.uploadedDistrictsMap) {
      const cleanId = districtId.replace("UPLOAD_", "");
      records = HeatWiseApp.state.uploadedDistrictsMap[cleanId] || HeatWiseApp.state.uploadedDistrictsMap[districtId] || [];
    } else {
      // Demo library
      const registry = (typeof ALL_SYNTHETIC_DISTRICTS !== "undefined")
        ? ALL_SYNTHETIC_DISTRICTS
        : (typeof EXPANDED_SYNTHETIC_DISTRICTS !== "undefined" && typeof SYNTHETIC_DISTRICTS !== "undefined")
          ? { ...EXPANDED_SYNTHETIC_DISTRICTS, ...SYNTHETIC_DISTRICTS }
          : (typeof SYNTHETIC_DISTRICTS !== "undefined" ? SYNTHETIC_DISTRICTS : {});
      
      const cleanId = districtId.replace("DEMO_", "");
      const d = registry[cleanId] || registry[districtId];
      if (d && d.records) records = d.records;
    }

    // Apply dashboard's active date filter
    const startVal = HeatWiseApp.state.startDate;
    const endVal = HeatWiseApp.state.endDate;
    if (startVal) records = records.filter(r => r.date >= startVal);
    if (endVal) records = records.filter(r => r.date <= endVal);

    const validTemps = records.map(r => r.max_temp_c).filter(v => typeof v === "number" && !isNaN(v));
    const validHIs = records.map(r => r.heat_index_c).filter(v => typeof v === "number" && !isNaN(v));
    const validHums = records.map(r => r.humidity_pct).filter(v => typeof v === "number" && !isNaN(v));
    const validCases = records.map(r => r.heat_illness_cases).filter(v => typeof v === "number" && !isNaN(v));

    const peakTemp = validTemps.length > 0 ? Math.max(...validTemps) : null;
    const meanTemp = validTemps.length > 0 ? (validTemps.reduce((a, b) => a + b, 0) / validTemps.length) : null;
    const meanHum = validHums.length > 0 ? (validHums.reduce((a, b) => a + b, 0) / validHums.length) : null;
    const totalCases = validCases.length > 0 ? validCases.reduce((a, b) => a + b, 0) : 0;
    const peakCases = validCases.length > 0 ? Math.max(...validCases) : 0;
    const peakHI = validHIs.length > 0 ? Math.max(...validHIs) : peakTemp;

    // Assess candidate alert category
    let candidateAlertTier = "normal";
    let candidateAlertLabel = "Normal / Baseline";
    let isInsufficient = records.length < 30;

    if (records.length >= 30) {
      if (peakTemp !== null) {
        if (peakTemp >= 45.0 || (peakHI !== null && peakHI >= 48.0)) {
          candidateAlertTier = "red";
          candidateAlertLabel = "Red Emergency Candidate (~45.0°C)";
        } else if (peakTemp >= 42.5 || (peakHI !== null && peakHI >= 44.0)) {
          candidateAlertTier = "orange";
          candidateAlertLabel = "Orange Alert Candidate (~43.0°C)";
        } else if (peakTemp >= 39.5) {
          candidateAlertTier = "yellow";
          candidateAlertLabel = "Yellow Caution Candidate (~40.5°C)";
        }
      }
    } else {
      candidateAlertTier = "insufficient";
      candidateAlertLabel = "Insufficient evidence to suggest a candidate.";
    }

    return {
      recordCount: records.length,
      peakTemp,
      meanTemp,
      meanHum,
      totalCases,
      peakCases,
      peakHI,
      candidateAlertTier,
      candidateAlertLabel,
      isInsufficient
    };
  },

  getFeatureStyle(feature) {
    if (feature.properties && feature.properties.is_context_boundary) {
      return {
        fillColor: "#e5ece9",
        weight: 1.5,
        opacity: 0.6,
        color: "#94a3b8",
        fillOpacity: 0.25,
        dashArray: "3, 3"
      };
    }

    const dId = feature.properties ? feature.properties.district_id : "";
    const metrics = this.getDistrictMetrics(dId);
    const isSelected = this.selectedDistrictId === dId;

    let fillColor = "#cbd5e1";

    if (this.currentIndicator === "max_temp_c") {
      const val = metrics.peakTemp;
      if (val !== null) {
        fillColor = this.getColorForStops(val, this.METRIC_CONFIGS.max_temp_c.colorStops);
      }
    } else if (this.currentIndicator === "humidity_pct") {
      const val = metrics.meanHum;
      if (val !== null) {
        fillColor = this.getColorForStops(val, this.METRIC_CONFIGS.humidity_pct.colorStops);
      }
    } else if (this.currentIndicator === "heat_illness_cases") {
      const val = metrics.totalCases;
      fillColor = this.getColorForStops(val, this.METRIC_CONFIGS.heat_illness_cases.colorStops);
    } else if (this.currentIndicator === "candidate_alert") {
      if (metrics.candidateAlertTier === "red") fillColor = "#dc2626";
      else if (metrics.candidateAlertTier === "orange") fillColor = "#ea580c";
      else if (metrics.candidateAlertTier === "yellow") fillColor = "#d97706";
      else if (metrics.candidateAlertTier === "insufficient") fillColor = "#94a3b8";
      else fillColor = "#f8fafc";
    }

    return {
      fillColor: fillColor,
      weight: isSelected ? 3.5 : 1.8,
      opacity: 1,
      color: isSelected ? "#0e2a22" : "#475569",
      fillOpacity: isSelected ? 0.90 : 0.72,
      dashArray: (this.currentIndicator === "candidate_alert" && metrics.candidateAlertTier === "insufficient") ? "4, 4" : null
    };
  },

  getColorForStops(val, stops) {
    for (let i = 0; i < stops.length; i++) {
      if (val <= stops[i].max) {
        return stops[i].color;
      }
    }
    return stops[stops.length - 1].color;
  },

  bindFeatureEvents(feature, layer) {
    if (feature.properties && feature.properties.is_context_boundary) {
      layer.bindTooltip("India Subcontinent Reference Outline", { sticky: true });
      return;
    }

    layer.on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({ weight: 4, color: "#ff6b4a", fillOpacity: 0.95 });
        l.bringToFront();
      },
      mouseout: (e) => {
        const l = e.target;
        const style = this.getFeatureStyle(feature);
        l.setStyle(style);
      },
      click: () => {
        const dId = feature.properties ? feature.properties.district_id : "";
        if (dId) {
          this.selectedDistrictId = dId;
          this.highlightDistrict(dId);
        }
      }
    });

    this.updateLayerPopupAndTooltip(feature, layer);
  },

  updateLayerPopupAndTooltip(feature, layer) {
    if (feature.properties && feature.properties.is_context_boundary) return;

    const dId = feature.properties.district_id;
    const name = feature.properties.name;
    const metrics = this.getDistrictMetrics(dId);
    const config = this.METRIC_CONFIGS[this.currentIndicator];

    let displayVal = "N/A";
    if (this.currentIndicator === "max_temp_c") {
      displayVal = metrics.peakTemp !== null ? `${metrics.peakTemp.toFixed(1)}°C` : "N/A";
    } else if (this.currentIndicator === "humidity_pct") {
      displayVal = metrics.meanHum !== null ? `${metrics.meanHum.toFixed(1)}%` : "N/A";
    } else if (this.currentIndicator === "heat_illness_cases") {
      displayVal = `${metrics.totalCases.toLocaleString()} admissions`;
    } else if (this.currentIndicator === "candidate_alert") {
      displayVal = metrics.candidateAlertLabel;
    }

    const tooltipContent = `<strong>${name}</strong><br/>${config.label}: <b>${displayVal}</b>`;
    layer.bindTooltip(tooltipContent, { sticky: true, className: "geomap-tooltip" });

    const popupContent = `
      <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
        <div style="font-weight: 800; font-size: 13px; color: #0e2a22;">${name}</div>
        <div style="color: #64748b; font-size: 11px;">${feature.properties.state} • ${feature.properties.zone}</div>
        <hr style="margin: 6px 0; border: none; border-top: 1px solid #e2e8f0;"/>
        <div>${config.label}: <strong style="color: #ea580c;">${displayVal}</strong></div>
        <div>Observations: <strong>${metrics.recordCount} days</strong></div>
        <div style="margin-top: 6px;">
          <button style="background: #0d9488; color: #ffffff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;"
                  onclick="HeatWiseApp.loadDistrict('${dId}')">
            Load District in Dashboard
          </button>
        </div>
      </div>
    `;
    layer.bindPopup(popupContent);
  },

  inspectDistrict(districtId) {
    const feature = HeatWiseGeoData.getDistrictFeature(districtId);
    const nameEl = document.getElementById("geoInspectName");
    const stateZoneEl = document.getElementById("geoInspectStateZone");
    const metricLabelEl = document.getElementById("geoInspectMetricLabel");
    const metricValEl = document.getElementById("geoInspectMetricValue");
    const metricSubEl = document.getElementById("geoInspectMetricSub");
    const meanTempEl = document.getElementById("geoInspectMeanTemp");
    const meanHumEl = document.getElementById("geoInspectMeanHum");
    const totalCasesEl = document.getElementById("geoInspectTotalCases");
    const peakCasesEl = document.getElementById("geoInspectPeakCases");
    const alertBadgeEl = document.getElementById("geoInspectAlertTierBadge");
    const candidateNoteEl = document.getElementById("geoInspectCandidateNote");
    const statusBadgeEl = document.getElementById("geoInspectStatusBadge");
    const provTitleEl = document.getElementById("geoInspectProvenanceTitle");
    const provTextEl = document.getElementById("geoInspectProvenanceText");

    const metrics = this.getDistrictMetrics(districtId);
    const config = this.METRIC_CONFIGS[this.currentIndicator];

    const dName = feature ? feature.properties.name : districtId;
    const dState = feature ? feature.properties.state : "Uploaded District";
    const dZone = feature ? feature.properties.zone : "Custom Climate";

    if (nameEl) nameEl.textContent = dName;
    if (stateZoneEl) stateZoneEl.textContent = `${dState} • ${dZone}`;

    if (metricLabelEl) metricLabelEl.textContent = config.label;
    if (metricSubEl) metricSubEl.textContent = config.explanation;

    let mainValStr = "--";
    if (this.currentIndicator === "max_temp_c") {
      mainValStr = metrics.peakTemp !== null ? `${metrics.peakTemp.toFixed(1)}°C` : "--.-°C";
    } else if (this.currentIndicator === "humidity_pct") {
      mainValStr = metrics.meanHum !== null ? `${metrics.meanHum.toFixed(1)}%` : "--.-%";
    } else if (this.currentIndicator === "heat_illness_cases") {
      mainValStr = metrics.totalCases.toLocaleString();
    } else if (this.currentIndicator === "candidate_alert") {
      mainValStr = metrics.candidateAlertLabel;
    }
    if (metricValEl) metricValEl.textContent = mainValStr;

    if (meanTempEl) meanTempEl.textContent = metrics.meanTemp !== null ? `${metrics.meanTemp.toFixed(1)}°C` : "--.-°C";
    if (meanHumEl) meanHumEl.textContent = metrics.meanHum !== null ? `${metrics.meanHum.toFixed(1)}%` : "--.-%";
    if (totalCasesEl) totalCasesEl.textContent = metrics.totalCases.toLocaleString();
    if (peakCasesEl) peakCasesEl.textContent = metrics.peakCases > 0 ? `${metrics.peakCases}/d` : "--";

    if (alertBadgeEl && candidateNoteEl) {
      if (metrics.isInsufficient) {
        alertBadgeEl.className = "badge-quality badge-degraded";
        alertBadgeEl.textContent = "Insufficient evidence to suggest a candidate.";
        candidateNoteEl.textContent = "Observation count is below the minimum 30-day baseline requirement. Per public-health protocols, alert levels are not suggested.";
      } else {
        alertBadgeEl.className = `badge-review badge-${metrics.candidateAlertTier === 'red' ? 'approved' : metrics.candidateAlertTier === 'orange' ? 'needs-review' : 'pending'}`;
        alertBadgeEl.textContent = metrics.candidateAlertLabel;
        candidateNoteEl.textContent = "Empirical candidate derived from 70% calibration window and tested on held-out 30% partition. For expert review — not an official alert threshold.";
      }
    }

    const isActive = (HeatWiseApp.state.activeDistrictId === districtId || HeatWiseApp.state.activeDistrictId === districtId.replace("UPLOAD_", ""));
    if (statusBadgeEl) {
      statusBadgeEl.innerHTML = isActive
        ? `<span class="zone-badge zone-teal">✓ Active In Dashboard</span>`
        : `<span class="zone-badge zone-gray">Click to Focus</span>`;
    }

    const isSynthetic = feature ? feature.properties.is_synthetic : true;
    if (provTitleEl && provTextEl) {
      if (isSynthetic) {
        provTitleEl.textContent = "⚠️ SYNTHETIC DEMO DATA";
        provTextEl.textContent = "Synthetically generated observations for prototype demonstration. Not real hospital patient counts or official alert levels.";
      } else {
        provTitleEl.textContent = "📁 USER UPLOADED DATASET";
        provTextEl.textContent = `Imported from custom file: ${HeatWiseApp.state.uploadedFilename || 'data.csv'}. Evaluated under standard epidemiological protocol.`;
      }
    }
  },

  checkNonGeocodedDistricts() {
    const warningBox = document.getElementById("geomapNonGeocodedWarning");
    const warningText = document.getElementById("geomapNonGeocodedText");
    if (!warningBox || !warningText) return;

    if (HeatWiseApp.state.isUploadedData && HeatWiseApp.state.uploadedDistrictsMap) {
      const uploadedIds = Object.keys(HeatWiseApp.state.uploadedDistrictsMap);
      const unmatched = uploadedIds.filter(id => !HeatWiseGeoData.isGeocoded(id));

      if (unmatched.length > 0) {
        warningText.innerHTML = `
          Uploaded district code(s) <strong>[${unmatched.join(", ")}]</strong> do not match bundled geographical coordinates.
          To maintain geographical integrity, non-matching districts are not fabricated on the map.
          Their summary statistics remain fully accessible in the overview cards and charts.
        `;
        warningBox.classList.remove("hidden");
        return;
      }
    }
    warningBox.classList.add("hidden");
  },

  renderLegend() {
    const container = document.getElementById("geomapLegendScale");
    if (!container) return;

    const config = this.METRIC_CONFIGS[this.currentIndicator];
    if (!config || !config.colorStops) return;

    container.innerHTML = "";
    config.colorStops.forEach(stop => {
      const item = document.createElement("div");
      item.className = "geomap-scale-item";
      item.innerHTML = `
        <span class="geomap-scale-chip" style="background: ${stop.color};"></span>
        <span class="geomap-scale-label">${stop.label}</span>
      `;
      container.appendChild(item);
    });
  },

  renderVectorSvgMap(container) {
    container.innerHTML = "";
    const svgWrap = document.createElement("div");
    svgWrap.style.width = "100%";
    svgWrap.style.height = "520px";
    svgWrap.style.position = "relative";
    svgWrap.style.background = "#eef4f1";
    svgWrap.style.borderRadius = "12px";
    svgWrap.style.overflow = "hidden";

    const features = HeatWiseGeoData.getGeoJSON().features;

    // Projection bounds for India [68, 8] to [97, 36]
    const minLng = 68.0, maxLng = 97.0;
    const minLat = 8.0, maxLat = 36.0;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 800 620");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");

    features.forEach(feat => {
      const isContext = feat.properties && feat.properties.is_context_boundary;
      const dId = feat.properties ? feat.properties.district_id : "";
      const metrics = this.getDistrictMetrics(dId);
      const isSelected = this.selectedDistrictId === dId;
      const style = this.getFeatureStyle(feat);

      if (feat.geometry && feat.geometry.coordinates) {
        const coords = feat.geometry.coordinates[0];
        const points = coords.map(pt => {
          const x = ((pt[0] - minLng) / (maxLng - minLng)) * 740 + 30;
          const y = (1.0 - ((pt[1] - minLat) / (maxLat - minLat))) * 560 + 30;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");

        const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon.setAttribute("points", points);
        polygon.setAttribute("fill", style.fillColor);
        polygon.setAttribute("stroke", isSelected ? "#0e2a22" : isContext ? "#94a3b8" : "#475569");
        polygon.setAttribute("stroke-width", isSelected ? "3.5" : isContext ? "1.5" : "1.8");
        polygon.setAttribute("stroke-opacity", isContext ? "0.6" : "1");
        polygon.setAttribute("fill-opacity", style.fillOpacity);
        if (style.dashArray) polygon.setAttribute("stroke-dasharray", style.dashArray);
        polygon.style.cursor = isContext ? "default" : "pointer";
        polygon.style.transition = "all 0.2s ease";

        if (!isContext) {
          polygon.onmouseenter = () => {
            polygon.setAttribute("stroke-width", "4");
            polygon.setAttribute("stroke", "#ff6b4a");
            polygon.setAttribute("fill-opacity", "0.95");
          };
          polygon.onmouseleave = () => {
            polygon.setAttribute("stroke-width", isSelected ? "3.5" : "1.8");
            polygon.setAttribute("stroke", isSelected ? "#0e2a22" : "#475569");
            polygon.setAttribute("fill-opacity", style.fillOpacity);
          };
          polygon.onclick = () => {
            this.selectedDistrictId = dId;
            this.highlightDistrict(dId);
          };

          // Label text
          if (feat.properties && feat.properties.center) {
            const cx = ((feat.properties.center[1] - minLng) / (maxLng - minLng)) * 740 + 30;
            const cy = (1.0 - ((feat.properties.center[0] - minLat) / (maxLat - minLat))) * 560 + 30;
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", cx.toFixed(1));
            text.setAttribute("y", cy.toFixed(1));
            text.setAttribute("font-size", "10px");
            text.setAttribute("font-weight", "800");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", "#0e2a22");
            text.textContent = feat.properties.name.split(" ")[0];
            svg.appendChild(polygon);
            svg.appendChild(text);
            return;
          }
        }
        svg.appendChild(polygon);
      }
    });

    svgWrap.appendChild(svg);
    container.appendChild(svgWrap);
  }
};

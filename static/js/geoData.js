/**
 * HeatWise Geographical Boundary Dataset for India & Local Observation Districts
 * GeoJSON FeatureCollection defining district-level boundaries for epidemiological heat mapping.
 */

const INDIA_GEO_METADATA = {
  country: "India",
  projection: "EPSG:4326 (WGS84)",
  attribution: "Survey of India administrative alignments & HeatWise Climate Archetypes",
  center: [22.8, 79.5],
  defaultZoom: 5
};

const INDIA_DISTRICTS_GEOJSON = {
  type: "FeatureCollection",
  features: [
    // 1. Ahmedabad District, Gujarat (Arid Extreme Dry Heat)
    {
      type: "Feature",
      id: "IND_GJ_AHM",
      properties: {
        district_id: "IND_GJ_AHM",
        name: "Ahmedabad",
        state: "Gujarat",
        zone: "Arid / Semi-Arid",
        climate_type: "Dry-Bulb Driven Extreme Heat",
        center: [23.0225, 72.5714],
        is_synthetic: true
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [72.05, 23.45], [72.45, 23.55], [72.85, 23.40], [73.05, 23.10],
          [72.95, 22.70], [72.60, 22.40], [72.15, 22.45], [71.85, 22.80],
          [71.90, 23.20], [72.05, 23.45]
        ]]
      }
    },

    // 2. Bhubaneswar (Khordha District), Odisha (Coastal Humid Heat Index Stress)
    {
      type: "Feature",
      id: "IND_OD_BHU",
      properties: {
        district_id: "IND_OD_BHU",
        name: "Bhubaneswar (Khordha)",
        state: "Odisha",
        zone: "Coastal Humid",
        climate_type: "High Relative Humidity Heat Stress",
        center: [20.2961, 85.8245],
        is_synthetic: true
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [85.40, 20.55], [85.90, 20.50], [86.15, 20.30], [86.20, 19.95],
          [85.85, 19.70], [85.45, 19.75], [85.15, 20.05], [85.20, 20.35],
          [85.40, 20.55]
        ]]
      }
    },

    // 3. Nagpur District, Maharashtra (Central Vidarbha Severe Inland Heat)
    {
      type: "Feature",
      id: "IND_MH_NAG",
      properties: {
        district_id: "IND_MH_NAG",
        name: "Nagpur",
        state: "Maharashtra",
        zone: "Central Vidarbha Inland",
        climate_type: "Prolonged Continental Heatwave",
        center: [21.1458, 79.0882],
        is_synthetic: true
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [78.60, 21.65], [79.25, 21.75], [79.60, 21.50], [79.75, 21.05],
          [79.55, 20.70], [79.00, 20.65], [78.50, 20.90], [78.45, 21.35],
          [78.60, 21.65]
        ]]
      }
    },

    // 4. Delhi Central / NCT Delhi (Northern Composite Urban Heat Island)
    {
      type: "Feature",
      id: "IND_DL_DEL",
      properties: {
        district_id: "IND_DL_DEL",
        name: "Delhi Central (NCR)",
        state: "Delhi NCR",
        zone: "Northern Composite",
        climate_type: "Dense Urban Heat Island & Dust Transition",
        center: [28.6139, 77.2090],
        is_synthetic: true
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [76.90, 28.85], [77.30, 28.85], [77.40, 28.55], [77.30, 28.38],
          [76.95, 28.40], [76.85, 28.60], [76.90, 28.85]
        ]]
      }
    },

    // 5. Sparse Demo District (Insufficient Data Guardrail Archetype)
    {
      type: "Feature",
      id: "IND_SPARSE_TEST",
      properties: {
        district_id: "IND_SPARSE_TEST",
        name: "Sparse Demo District",
        state: "Rajasthan Border Zone",
        zone: "Insufficient Data Demo",
        climate_type: "Data Sufficiency Guardrail Test Region",
        center: [26.9124, 75.7873],
        is_synthetic: true
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [75.25, 27.25], [76.10, 27.20], [76.20, 26.60], [75.80, 26.35],
          [75.15, 26.50], [75.10, 26.90], [75.25, 27.25]
        ]]
      }
    },

    // 6. North Valley Basin (Expanded 180-Day Fictional Arid Archetype)
    {
      type: "Feature",
      id: "SYN_DIST_NORTH",
      properties: {
        district_id: "SYN_DIST_NORTH",
        name: "North Valley Basin",
        state: "Fictional Semi-Arid Basin",
        zone: "Arid Extreme Heat",
        climate_type: "Semi-Arid Basin Extreme Heatwaves",
        center: [29.9038, 73.8772],
        is_synthetic: true
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [73.10, 30.30], [74.40, 30.25], [74.65, 29.50], [74.20, 29.10],
          [73.30, 29.15], [72.95, 29.70], [73.10, 30.30]
        ]]
      }
    },

    // 7. Coastal Haven (Expanded 180-Day Fictional Maritime Humid Archetype)
    {
      type: "Feature",
      id: "SYN_DIST_COAST",
      properties: {
        district_id: "SYN_DIST_COAST",
        name: "Coastal Haven",
        state: "Fictional Maritime Haven",
        zone: "Maritime Humid Stress",
        climate_type: "High Humidity & Moderate Temp Heat Index Spike",
        center: [15.4989, 73.8278],
        is_synthetic: true
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [73.50, 16.20], [74.20, 16.15], [74.35, 15.30], [74.15, 14.85],
          [73.65, 14.90], [73.40, 15.60], [73.50, 16.20]
        ]]
      }
    },

    // 8. Central Plateau (Expanded 180-Day Fictional Continental Plateau Archetype)
    {
      type: "Feature",
      id: "SYN_DIST_PLATEAU",
      properties: {
        district_id: "SYN_DIST_PLATEAU",
        name: "Central Plateau",
        state: "Fictional Continental Range",
        zone: "Continental Plateau Heat",
        climate_type: "Elevated Dry Terrain Summer Warming",
        center: [23.2599, 77.4126],
        is_synthetic: true
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [76.70, 24.10], [78.20, 24.00], [78.35, 23.10], [77.80, 22.65],
          [76.60, 22.75], [76.45, 23.40], [76.70, 24.10]
        ]]
      }
    },

    // 9. Upland Mild Basin (Expanded 180-Day Zero Held-Out Surges Archetype)
    {
      type: "Feature",
      id: "SYN_DIST_MILD",
      properties: {
        district_id: "SYN_DIST_MILD",
        name: "Upland Mild Basin",
        state: "Fictional Upland Basin",
        zone: "Zero Held-Out Surges Demo",
        climate_type: "Temperate Elevation Baseline (Event-Detection N/A*)",
        center: [11.4102, 76.6950],
        is_synthetic: true
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [76.20, 11.95], [77.20, 11.90], [77.30, 11.15], [76.90, 10.85],
          [76.25, 10.95], [76.05, 11.50], [76.20, 11.95]
        ]]
      }
    },

    // 10. Contextual Background Subcontinent Outline of India
    {
      type: "Feature",
      id: "INDIA_OUTLINE",
      properties: {
        district_id: "INDIA_OUTLINE",
        name: "India National Boundary Context",
        is_context_boundary: true
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [74.0, 35.5], [78.5, 35.5], [80.5, 31.0], [81.5, 30.0],
          [88.5, 27.5], [89.0, 26.5], [92.0, 27.8], [97.0, 28.0],
          [96.0, 24.0], [93.5, 22.5], [91.5, 22.0], [89.0, 22.0],
          [87.0, 21.5], [85.5, 19.5], [83.0, 17.5], [80.2, 13.0],
          [79.8, 9.8], [77.5, 8.1], [76.5, 9.5], [74.8, 13.0],
          [73.5, 16.0], [72.8, 19.0], [72.5, 21.0], [68.8, 23.5],
          [70.5, 24.5], [71.0, 27.5], [74.5, 32.5], [74.0, 35.5]
        ]]
      }
    }
  ]
};

// District geo-lookup helper
const HeatWiseGeoData = {
  getGeoJSON() {
    return INDIA_DISTRICTS_GEOJSON;
  },

  getDistrictFeature(districtId) {
    return INDIA_DISTRICTS_GEOJSON.features.find(f => f.properties && f.properties.district_id === districtId);
  },

  isGeocoded(districtId) {
    return !!this.getDistrictFeature(districtId);
  },

  getCenter(districtId) {
    const feat = this.getDistrictFeature(districtId);
    if (feat && feat.properties && feat.properties.center) {
      return feat.properties.center;
    }
    return [22.8, 79.5]; // Default center of India
  }
};

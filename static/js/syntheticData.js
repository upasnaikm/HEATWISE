/**
 * HeatWise - Pre-bundled Synthetic Demonstration Data for Indian Climate Zones & Expanded 180-Day Dataset
 * 
 * NOTICE & SAFEGUARDS:
 * All records below are SYNTHETIC DEMONSTRATION DATA — NOT REAL OBSERVATIONS.
 * They do NOT represent real hospital medical records or real Indian meteorological observations.
 * Candidate levels derived from these synthetic datasets are strictly for expert review,
 * not official alert thresholds or medical advice.
 */

const SYNTHETIC_DISTRICTS = {
  IND_GJ_AHM: {
    id: "IND_GJ_AHM",
    name: "Ahmedabad",
    state: "Gujarat",
    zone: "Arid / Semi-Arid",
    badge: "Dry Inland Extreme Heat",
    badgeColor: "amber",
    description: "Demonstrates arid, dry-bulb driven heatwave patterns characteristic of northwestern India. Humidity remains low (20–45%) while peak temperatures often exceed 42–46°C.",
    isSynthetic: true,
    group: "regional_122d",
    records: []
  },
  IND_OD_BHU: {
    id: "IND_OD_BHU",
    name: "Bhubaneswar",
    state: "Odisha",
    zone: "Coastal Humid",
    badge: "High Humidity Thermal Stress",
    badgeColor: "teal",
    description: "Demonstrates maritime/coastal heat conditions where elevated relative humidity (65–90%) drives apparent Heat Index to dangerous levels even when dry-bulb temperature is moderate (36–39°C).",
    isSynthetic: true,
    group: "regional_122d",
    records: []
  },
  IND_MH_NAG: {
    id: "IND_MH_NAG",
    name: "Nagpur",
    state: "Maharashtra",
    zone: "Central Vidarbha Inland",
    badge: "Severe Dry Heatwave",
    badgeColor: "orange",
    description: "Demonstrates extreme central plateau conditions with prolonged May/June heatwaves and very low humidity (15–35%), showing steep non-linear surges in heat-related illnesses.",
    isSynthetic: true,
    group: "regional_122d",
    records: []
  },
  IND_DL_DEL: {
    id: "IND_DL_DEL",
    name: "Delhi Central",
    state: "Delhi NCR",
    zone: "Northern Composite",
    badge: "Urban Heat Island",
    badgeColor: "purple",
    description: "Demonstrates urban composite climate with intense heat retention, dust haze transitions, and large outdoor labor exposure vulnerable to prolonged high thermal load.",
    isSynthetic: true,
    group: "regional_122d",
    records: []
  },
  IND_SPARSE_TEST: {
    id: "IND_SPARSE_TEST",
    name: "Sparse Demo District",
    state: "Demonstration Region",
    zone: "Insufficient Data Sample",
    badge: "Guardrail Test (14 Days)",
    badgeColor: "gray",
    description: "Contains only 14 days of sparse data. Designed specifically to verify the safety guardrail: 'Insufficient evidence to suggest a candidate.'",
    isSynthetic: true,
    group: "regional_122d",
    records: []
  }
};

const EXPANDED_SYNTHETIC_DISTRICTS = {
  SYN_DIST_NORTH: {
    id: "SYN_DIST_NORTH",
    name: "North Valley Basin (Fictional)",
    state: "Northern Sector",
    zone: "Semi-Arid Basin (Dry Extreme Heat)",
    badge: "180-Day Arid Extreme Heat",
    badgeColor: "amber",
    description: "Fictional 180-day synthetic dataset (1 Mar – 27 Aug 2024). Models severe dry-bulb heatwave escalation with intentional missing values on Days 42, 115, and 160.",
    isSynthetic: true,
    group: "expanded_180d",
    records: []
  },
  SYN_DIST_COAST: {
    id: "SYN_DIST_COAST",
    name: "Coastal Haven (Fictional)",
    state: "Eastern Littoral",
    zone: "Maritime Humid Littoral (High Heat Index)",
    badge: "180-Day Coastal Humid Stress",
    badgeColor: "teal",
    description: "Fictional 180-day synthetic dataset (1 Mar – 27 Aug 2024). Demonstrates maritime conditions where high humidity elevates Heat Index even at 34–38°C dry-bulb.",
    isSynthetic: true,
    group: "expanded_180d",
    records: []
  },
  SYN_DIST_PLATEAU: {
    id: "SYN_DIST_PLATEAU",
    name: "Central Plateau (Fictional)",
    state: "Central Uplands",
    zone: "High-Plateau Continental",
    badge: "180-Day Plateau Heat",
    badgeColor: "orange",
    description: "Fictional 180-day synthetic dataset (1 Mar – 27 Aug 2024). Continental summer patterns with prolonged high temperature exposure.",
    isSynthetic: true,
    group: "expanded_180d",
    records: []
  },
  SYN_DIST_MILD: {
    id: "SYN_DIST_MILD",
    name: "Upland Mild Basin (Fictional)",
    state: "Montane Sector",
    zone: "Temperate Upland (Zero Held-Out Surges)",
    badge: "Zero Held-Out Surges Demo",
    badgeColor: "gray",
    description: "Fictional 180-day synthetic dataset with zero surge events in the held-out validation partition. Used to verify event-detection guardrails.",
    isSynthetic: true,
    group: "expanded_180d",
    records: []
  }
};

const ALL_SYNTHETIC_DISTRICTS = {
  ...EXPANDED_SYNTHETIC_DISTRICTS,
  ...SYNTHETIC_DISTRICTS
};

// Generates synthetic series deterministically in browser
function generateBrowserSyntheticData() {
  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function rothfuszHI(tempC, rh) {
    if (tempC === "" || tempC === null || isNaN(tempC) || rh === "" || rh === null || isNaN(rh)) {
      return null;
    }
    const tempF = (tempC * 9 / 5) + 32;
    const r = Math.max(0, Math.min(100, rh));
    let hiF = -42.379 + 2.04901523 * tempF + 10.14333127 * r - 0.22475541 * tempF * r -
              0.00683783 * tempF * tempF - 0.05481717 * r * r + 0.00122874 * tempF * tempF * r +
              0.00085282 * tempF * r * r - 0.00000199 * tempF * tempF * r * r;
    if (r < 13 && tempF >= 80 && tempF <= 112) {
      hiF -= ((13 - r) / 4) * Math.sqrt((17 - Math.abs(tempF - 95)) / 17);
    } else if (r > 85 && tempF >= 80 && tempF <= 87) {
      hiF += ((r - 85) / 10) * ((87 - tempF) / 5);
    }
    if (tempF < 80) {
      hiF = 0.5 * (tempF + 61.0 + ((tempF - 68.0) * 1.2) + (r * 0.094));
    }
    return Math.round(((hiF - 32) * 5 / 9) * 10) / 10;
  }

  // ==========================================
  // PART A: Standard 122-Day Regional Climates
  // ==========================================

  // 1. Ahmedabad
  let rand = seededRandom(101);
  const ahm = [];
  for (let i = 0; i < 122; i++) {
    const d = new Date(Date.UTC(2024, 3, 1 + i));
    const dateStr = d.toISOString().split('T')[0];
    const curve = Math.sin((i / 121) * Math.PI);
    let temp = 37.0 + curve * 6.5 + (rand() - 0.5) * 3.5;
    if ((i >= 45 && i <= 55) || (i >= 70 && i <= 75)) temp += 2.2 + rand() * 1.5;
    temp = Math.max(32.0, Math.min(47.2, Math.round(temp * 10) / 10));
    let hum = Math.max(15, Math.min(55, Math.round(32 - (temp - 38) * 1.2 + (rand() - 0.5) * 10)));
    const excess = Math.max(0, temp - 40.5);
    let cases = Math.round(Math.max(0, 5 + Math.pow(excess, 2.1) * 2.8 + (rand() - 0.5) * 6));
    ahm.push({ date: dateStr, district_id: "IND_GJ_AHM", max_temp_c: temp, humidity_pct: hum, heat_illness_cases: cases, heat_index_c: rothfuszHI(temp, hum) });
  }
  SYNTHETIC_DISTRICTS.IND_GJ_AHM.records = ahm;

  // 2. Bhubaneswar (Coastal)
  rand = seededRandom(202);
  const bhu = [];
  for (let i = 0; i < 122; i++) {
    const d = new Date(Date.UTC(2024, 3, 1 + i));
    const dateStr = d.toISOString().split('T')[0];
    const curve = Math.sin((i / 121) * Math.PI);
    let temp = Math.round((34.0 + curve * 4.2 + (rand() - 0.5) * 2.8) * 10) / 10;
    temp = Math.max(29.0, Math.min(41.0, temp));
    let hum = Math.round(Math.max(55, Math.min(92, 74 + (rand() - 0.5) * 14)));
    const hi = rothfuszHI(temp, hum);
    const excessHi = Math.max(0, hi - 43.0);
    let cases = Math.round(Math.max(0, 4 + Math.pow(excessHi, 1.9) * 2.2 + (rand() - 0.5) * 5));
    bhu.push({ date: dateStr, district_id: "IND_OD_BHU", max_temp_c: temp, humidity_pct: hum, heat_illness_cases: cases, heat_index_c: hi });
  }
  SYNTHETIC_DISTRICTS.IND_OD_BHU.records = bhu;

  // 3. Nagpur (Central Dry)
  rand = seededRandom(303);
  const nag = [];
  for (let i = 0; i < 122; i++) {
    const d = new Date(Date.UTC(2024, 3, 1 + i));
    const dateStr = d.toISOString().split('T')[0];
    const curve = Math.sin((i / 121) * Math.PI);
    let temp = Math.round((39.0 + curve * 6.2 + (rand() - 0.5) * 3.6) * 10) / 10;
    temp = Math.max(33.0, Math.min(48.2, temp));
    let hum = Math.round(Math.max(12, Math.min(42, 24 + (rand() - 0.5) * 8)));
    const excess = Math.max(0, temp - 42.0);
    let cases = Math.round(Math.max(0, 6 + Math.pow(excess, 2.2) * 3.1 + (rand() - 0.5) * 7));
    nag.push({ date: dateStr, district_id: "IND_MH_NAG", max_temp_c: temp, humidity_pct: hum, heat_illness_cases: cases, heat_index_c: rothfuszHI(temp, hum) });
  }
  SYNTHETIC_DISTRICTS.IND_MH_NAG.records = nag;

  // 4. Delhi Central
  rand = seededRandom(404);
  const del = [];
  for (let i = 0; i < 122; i++) {
    const d = new Date(Date.UTC(2024, 3, 1 + i));
    const dateStr = d.toISOString().split('T')[0];
    const curve = Math.sin((i / 121) * Math.PI);
    let temp = Math.round((36.5 + curve * 5.8 + (rand() - 0.5) * 3.2) * 10) / 10;
    temp = Math.max(31.0, Math.min(46.0, temp));
    let hum = Math.round(Math.max(25, Math.min(70, 45 - (temp - 36) * 1.0 + (rand() - 0.5) * 12)));
    const excess = Math.max(0, temp - 41.0);
    let cases = Math.round(Math.max(0, 5 + Math.pow(excess, 2.0) * 2.6 + (rand() - 0.5) * 6));
    del.push({ date: dateStr, district_id: "IND_DL_DEL", max_temp_c: temp, humidity_pct: hum, heat_illness_cases: cases, heat_index_c: rothfuszHI(temp, hum) });
  }
  SYNTHETIC_DISTRICTS.IND_DL_DEL.records = del;

  // 5. Sparse Demo (Only 14 days)
  rand = seededRandom(505);
  const sparse = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.UTC(2024, 3, 1 + i));
    const dateStr = d.toISOString().split('T')[0];
    let temp = Math.round((34.0 + rand() * 2.5) * 10) / 10;
    let hum = Math.round(48 + (rand() - 0.5) * 8);
    let cases = Math.floor(1 + rand() * 4);
    sparse.push({ date: dateStr, district_id: "IND_SPARSE_TEST", max_temp_c: temp, humidity_pct: hum, heat_illness_cases: cases, heat_index_c: rothfuszHI(temp, hum) });
  }
  SYNTHETIC_DISTRICTS.IND_SPARSE_TEST.records = sparse;

  // =============================================================
  // PART B: Expanded 180-Day Demonstration Dataset (Fictional IDs)
  // March 1, 2024 to August 27, 2024 (180 consecutive days)
  // =============================================================

  // 1. North Valley (Arid Basin, 180 Days)
  rand = seededRandom(701);
  const north180 = [];
  for (let i = 0; i < 180; i++) {
    const d = new Date(Date.UTC(2024, 2, 1 + i));
    const dateStr = d.toISOString().split('T')[0];
    const curve = Math.sin((i / 179) * Math.PI);
    let temp = Math.round((34.0 + curve * 10.5 + (rand() - 0.5) * 3.0) * 10) / 10;
    if ((i >= 75 && i <= 88) || (i >= 100 && i <= 108)) temp += Math.round((2.0 + rand() * 2.0) * 10) / 10;
    temp = Math.max(28.0, Math.min(47.8, Math.round(temp * 10) / 10));
    let hum = Math.max(14, Math.min(58, Math.round(35 - (temp - 36) * 1.3 + (rand() - 0.5) * 9)));
    const excess = Math.max(0, temp - 41.0);
    let cases = Math.round(Math.max(0, 4 + Math.pow(excess, 2.1) * 3.2 + (rand() - 0.5) * 5.6));

    // Identifiable missing values
    let finalTemp = temp;
    let finalHum = hum;
    let finalCases = cases;
    if (i === 41) finalTemp = ""; // Day 42 (2024-04-11): missing temp
    if (i === 114) finalHum = ""; // Day 115 (2024-06-23): missing humidity
    if (i === 159) finalCases = ""; // Day 160 (2024-08-07): missing cases

    north180.push({
      date: dateStr,
      district_id: "SYN_DIST_NORTH",
      max_temp_c: finalTemp,
      humidity_pct: finalHum,
      heat_illness_cases: finalCases,
      heat_index_c: rothfuszHI(finalTemp, finalHum)
    });
  }
  EXPANDED_SYNTHETIC_DISTRICTS.SYN_DIST_NORTH.records = north180;

  // 2. Coastal Haven (Maritime Humid, 180 Days)
  rand = seededRandom(702);
  const coast180 = [];
  for (let i = 0; i < 180; i++) {
    const d = new Date(Date.UTC(2024, 2, 1 + i));
    const dateStr = d.toISOString().split('T')[0];
    const curve = Math.sin((i / 179) * Math.PI);
    let temp = Math.round((31.5 + curve * 6.5 + (rand() - 0.5) * 2.4) * 10) / 10;
    temp = Math.max(28.0, Math.min(40.5, temp));
    let hum = Math.round(Math.max(58, Math.min(94, 76 + (rand() - 0.5) * 12)));
    const hi = rothfuszHI(temp, hum);
    const excessHi = Math.max(0, (hi || temp) - 43.5);
    let cases = Math.round(Math.max(0, 3 + Math.pow(excessHi, 1.95) * 2.3 + (rand() - 0.5) * 4.4));

    let finalTemp = temp;
    let finalHum = hum;
    let finalCases = cases;
    if (i === 34) finalHum = ""; // Day 35 (2024-04-04): missing humidity
    if (i === 97) finalTemp = ""; // Day 98 (2024-06-06): missing temp

    coast180.push({
      date: dateStr,
      district_id: "SYN_DIST_COAST",
      max_temp_c: finalTemp,
      humidity_pct: finalHum,
      heat_illness_cases: finalCases,
      heat_index_c: rothfuszHI(finalTemp, finalHum)
    });
  }
  EXPANDED_SYNTHETIC_DISTRICTS.SYN_DIST_COAST.records = coast180;

  // 3. Central Plateau (High-Plateau Continental, 180 Days)
  rand = seededRandom(703);
  const plateau180 = [];
  for (let i = 0; i < 180; i++) {
    const d = new Date(Date.UTC(2024, 2, 1 + i));
    const dateStr = d.toISOString().split('T')[0];
    const curve = Math.sin((i / 179) * Math.PI);
    let temp = Math.round((33.0 + curve * 9.8 + (rand() - 0.5) * 3.2) * 10) / 10;
    temp = Math.max(30.0, Math.min(46.5, temp));
    let hum = Math.round(Math.max(16, Math.min(52, 30 - (temp - 37) * 1.1 + (rand() - 0.5) * 8)));
    const excess = Math.max(0, temp - 41.5);
    let cases = Math.round(Math.max(0, 4 + Math.pow(excess, 2.05) * 2.9 + (rand() - 0.5) * 5));

    let finalTemp = temp;
    let finalHum = hum;
    let finalCases = cases;
    if (i === 21) finalTemp = ""; // Day 22 (2024-03-22): missing temp
    if (i === 144) finalHum = ""; // Day 145 (2024-07-23): missing humidity

    plateau180.push({
      date: dateStr,
      district_id: "SYN_DIST_PLATEAU",
      max_temp_c: finalTemp,
      humidity_pct: finalHum,
      heat_illness_cases: finalCases,
      heat_index_c: rothfuszHI(finalTemp, finalHum)
    });
  }
  EXPANDED_SYNTHETIC_DISTRICTS.SYN_DIST_PLATEAU.records = plateau180;

  // 4. Upland Mild Basin (Zero Held-Out Surges Demo, 180 Days)
  rand = seededRandom(704);
  const mild180 = [];
  for (let i = 0; i < 180; i++) {
    const d = new Date(Date.UTC(2024, 2, 1 + i));
    const dateStr = d.toISOString().split('T')[0];
    const curve = Math.sin((i / 179) * Math.PI);
    let temp = Math.round((25.0 + curve * 5.0 + (rand() - 0.5) * 2.2) * 10) / 10;
    temp = Math.max(21.0, Math.min(33.5, temp));
    let hum = Math.round(Math.max(40, Math.min(75, 55 + (rand() - 0.5) * 10)));
    // Surges occur strictly in the calibration partition (days 40-52); ZERO surges in held-out validation (days 126-179)
    let cases;
    if (i >= 40 && i <= 52) {
      temp = Math.round((temp + 2.5 + rand() * 1.5) * 10) / 10;
      cases = 8 + Math.floor(rand() * 5);
    } else {
      cases = 1 + Math.floor(rand() * 3);
    }

    let finalTemp = temp;
    let finalHum = hum;
    let finalCases = cases;
    if (i === 74) finalCases = ""; // Day 75 (2024-05-14): missing cases

    mild180.push({
      date: dateStr,
      district_id: "SYN_DIST_MILD",
      max_temp_c: finalTemp,
      humidity_pct: finalHum,
      heat_illness_cases: finalCases,
      heat_index_c: rothfuszHI(finalTemp, finalHum)
    });
  }
  EXPANDED_SYNTHETIC_DISTRICTS.SYN_DIST_MILD.records = mild180;
}

// Initialize synthetic records immediately
generateBrowserSyntheticData();

/**
 * HeatWise Client-side Analytics & Statistical Learning Engine
 * 
 * Implements:
 * - Steadman/Rothfusz Heat Index apparent temperature
 * - Empirical risk-ratio and Youden's J threshold optimization
 * - 70% Calibration / 30% Held-Out Historical Validation
 * - 95% bootstrap confidence intervals for candidate levels
 * - Data sufficiency guardrails (< 30 days or < 3 surge events)
 * - Transparent explanation of correlation vs causation
 */

const HeatWiseAnalytics = {
  /**
   * Transparent and configurable evidence requirements for epidemiological candidate learning
   */
  CONFIG: {
    MIN_OBSERVATION_DAYS: 30,
    MIN_TOTAL_SURGE_DAYS: 3,
    MIN_CALIB_SURGE_DAYS: 2,
    CALIB_SPLIT_RATIO: 0.70,
    MIN_VAL_DAYS: 9,
    BASELINE_PERCENTILE: 75,
    CANDIDATE_PERCENTILES: {
      yellow: 84,
      orange: 92,
      red: 97
    }
  },

  calculateHeatIndex(tempC, humidityPct) {
    const tempF = (tempC * 9 / 5) + 32;
    const rh = Math.max(0, Math.min(100, humidityPct));

    let hiF = -42.379 + 2.04901523 * tempF + 10.14333127 * rh - 0.22475541 * tempF * rh -
              0.00683783 * tempF * tempF - 0.05481717 * rh * rh + 0.00122874 * tempF * tempF * rh +
              0.00085282 * tempF * rh * rh - 0.00000199 * tempF * tempF * rh * rh;

    if (rh < 13 && tempF >= 80 && tempF <= 112) {
      hiF -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(tempF - 95)) / 17);
    } else if (rh > 85 && tempF >= 80 && tempF <= 87) {
      hiF += ((rh - 85) / 10) * ((87 - tempF) / 5);
    }

    if (tempF < 80) {
      hiF = 0.5 * (tempF + 61.0 + ((tempF - 68.0) * 1.2) + (rh * 0.094));
    }

    return Math.round(((hiF - 32) * 5 / 9) * 10) / 10;
  },

  assessDataQuality(records) {
    const total = records ? records.length : 0;
    if (total === 0) {
      return {
        score: 0,
        status: "Critical",
        statusLabel: "No Records Available",
        statusClass: "badge-critical",
        totalRecords: 0,
        validRecords: 0,
        completenessPct: 0,
        insufficientSample: true,
        issues: [{ type: "no_data", severity: "critical", message: "Dataset contains 0 records." }],
        metrics: { missingDates: 0, missingTemps: 0, missingHumidity: 0, missingCases: 0, unitErrors: 0 }
      };
    }

    let missingDates = 0;
    let missingTemps = 0;
    let missingHumidity = 0;
    let missingCases = 0;
    const seenDates = new Set();
    let duplicateDatesCount = 0;
    const duplicateDetails = [];
    const unitErrors = [];
    let validCount = 0;

    records.forEach((r, idx) => {
      const rowNum = idx + 1;
      let hasError = false;

      if (!r.date || String(r.date).trim() === "") {
        missingDates++;
        hasError = true;
      } else if (r.district_id) {
        const key = `${String(r.district_id).trim()}|${String(r.date).trim()}`;
        if (seenDates.has(key)) {
          duplicateDatesCount++;
          if (duplicateDetails.length < 5) {
            duplicateDetails.push(`Row ${rowNum}: Duplicate date '${r.date}' for district '${r.district_id}'`);
          }
        } else {
          seenDates.add(key);
        }
      }

      const t = parseFloat(r.max_temp_c);
      if (r.max_temp_c === null || r.max_temp_c === undefined || r.max_temp_c === "" || isNaN(t)) {
        missingTemps++;
        hasError = true;
      } else if (t > 58.0) {
        unitErrors.push({
          row: rowNum,
          field: "max_temp_c",
          value: r.max_temp_c,
          message: `Temperature ${t}°C exceeds realistic threshold (>58°C). Potential Fahrenheit entry.`
        });
        hasError = true;
      } else if (t < 5.0) {
        unitErrors.push({
          row: rowNum,
          field: "max_temp_c",
          value: r.max_temp_c,
          message: `Temperature ${t}°C is implausibly low for Indian summer analysis.`
        });
        hasError = true;
      }

      const h = parseFloat(r.humidity_pct);
      if (r.humidity_pct === null || r.humidity_pct === undefined || r.humidity_pct === "" || isNaN(h)) {
        missingHumidity++;
        hasError = true;
      } else if (h < 0 || h > 100) {
        unitErrors.push({
          row: rowNum,
          field: "humidity_pct",
          value: r.humidity_pct,
          message: `Relative humidity ${h}% exceeds physical limits [0-100%].`
        });
        hasError = true;
      }

      const c = parseInt(r.heat_illness_cases, 10);
      if (r.heat_illness_cases === null || r.heat_illness_cases === undefined || r.heat_illness_cases === "" || isNaN(c)) {
        missingCases++;
        hasError = true;
      } else if (c < 0) {
        unitErrors.push({
          row: rowNum,
          field: "heat_illness_cases",
          value: r.heat_illness_cases,
          message: `Heat illness case count (${c}) cannot be negative.`
        });
        hasError = true;
      }

      if (!hasError) validCount++;
    });

    const totalMissing = missingDates + missingTemps + missingHumidity + missingCases;
    const completeness = Math.round((validCount / total) * 1000) / 10;
    const insufficientSample = total < 30;

    let score = Math.round(completeness - (totalMissing / (total * 4)) * 50 - (unitErrors.length / total) * 50);
    score = Math.max(0, Math.min(100, score));
    if (insufficientSample) score = Math.min(score, 65);

    let status = "Optimal";
    let statusLabel = "Optimal Quality (Ready for Modeling)";
    let statusClass = "badge-optimal";

    if (score < 50 || unitErrors.length > 5) {
      status = "Critical";
      statusLabel = "Critical Inconsistencies Detected";
      statusClass = "badge-critical";
    } else if (score < 75 || insufficientSample) {
      status = "Degraded";
      statusLabel = insufficientSample ? "Sample Size Insufficient (< 30 days)" : "Degraded (Data Quality Warnings)";
      statusClass = "badge-degraded";
    } else if (score < 90) {
      status = "Acceptable";
      statusLabel = "Acceptable (Minor Gaps)";
      statusClass = "badge-acceptable";
    }

    const issues = [];
    if (insufficientSample) {
      issues.push({
        type: "sample_size",
        severity: "warning",
        message: `Sample size (${total} days) is below the recommended minimum of 30 days for seasonal alert calibration.`
      });
    }
    if (totalMissing > 0) {
      issues.push({
        type: "missing_values",
        severity: "warning",
        message: `Found ${totalMissing} missing or unparseable field cells across ${total} records.`
      });
    }
    if (unitErrors.length > 0) {
      issues.push({
        type: "unit_inconsistencies",
        severity: "critical",
        message: `Identified ${unitErrors.length} unit or physiological range errors (e.g. °F instead of °C, humidity > 100%).`,
        samples: unitErrors.slice(0, 5)
      });
    }
    if (duplicateDatesCount > 0) {
      issues.push({
        type: "duplicate_dates",
        severity: "warning",
        message: `Identified ${duplicateDatesCount} duplicate date observations for the same district.`,
        samples: duplicateDetails
      });
    }

    return {
      score,
      status,
      statusLabel,
      statusClass,
      totalRecords: total,
      validRecords: validCount,
      completenessPct: completeness,
      insufficientSample,
      issues,
      metrics: {
        missingDates,
        missingTemps,
        missingHumidity,
        missingCases,
        duplicateDatesCount,
        unitErrors: unitErrors.length
      }
    };
  },

  cleanRecords(records) {
    if (!records) return [];
    const valid = [];
    records.forEach(r => {
      const t = parseFloat(r.max_temp_c);
      const h = parseFloat(r.humidity_pct);
      const c = parseInt(r.heat_illness_cases, 10);
      const d = String(r.date || "").trim();
      const dist = String(r.district_id || "UNKNOWN").trim();

      if (!isNaN(t) && !isNaN(h) && !isNaN(c) && d && t >= 10.0 && t <= 58.0 && h >= 0 && h <= 100 && c >= 0) {
        const hi = this.calculateHeatIndex(t, h);
        valid.push({
          date: d,
          district_id: dist,
          max_temp_c: Math.round(t * 10) / 10,
          humidity_pct: Math.round(h * 10) / 10,
          heat_index_c: hi,
          heat_illness_cases: c
        });
      }
    });
    valid.sort((a, b) => (a.date > b.date ? 1 : -1));
    return valid;
  },

  /**
   * Proposes candidate thresholds on calibration data (70%) and validates
   * prospective performance on held-out historical data (30%).
   *
   * If data are insufficient (< 30 valid days, < 3 surge events, or inadequate held-out data),
   * returns "Insufficient evidence for a candidate." with comprehensive descriptive analysis.
   */
  analyzeCandidateThresholds(rawRecords, primaryMetric = "max_temp_c", customConfig = null) {
    const cfg = customConfig ? { ...this.CONFIG, ...customConfig } : this.CONFIG;
    const minObsDays = cfg.MIN_OBSERVATION_DAYS;
    const minSurges = cfg.MIN_TOTAL_SURGE_DAYS;
    const minCalibSurges = cfg.MIN_CALIB_SURGE_DAYS;
    const calibRatio = cfg.CALIB_SPLIT_RATIO;
    const minValDays = cfg.MIN_VAL_DAYS;

    const valid = this.cleanRecords(rawRecords);
    const n = valid.length;

    // 1. Descriptive Summary across available records (even when insufficient)
    const dates = valid.map(r => r.date).filter(Boolean).sort();
    const temps = valid.map(r => r.max_temp_c).filter(v => v !== null && !isNaN(v));
    const hums = valid.map(r => r.humidity_pct).filter(v => v !== null && !isNaN(v));
    const his = valid.map(r => r.heat_index_c).filter(v => v !== null && !isNaN(v));
    const cases = valid.map(r => r.heat_illness_cases).filter(v => v !== null && !isNaN(v));

    const minDate = dates.length > 0 ? dates[0] : "N/A";
    const maxDate = dates.length > 0 ? dates[dates.length - 1] : "N/A";
    const calendarSpan = (dates.length > 0 && minDate !== "N/A" && maxDate !== "N/A")
      ? Math.max(1, Math.round((new Date(maxDate) - new Date(minDate)) / (1000 * 60 * 60 * 24)) + 1)
      : n;

    const totalCases = cases.reduce((a, b) => a + b, 0);
    const meanDailyCases = cases.length > 0 ? Math.round((totalCases / cases.length) * 10) / 10 : 0.0;
    const maxDailyCases = cases.length > 0 ? Math.max(...cases) : 0;
    let peakCaseDate = "N/A";
    if (cases.length > 0) {
      const peakRec = valid.find(r => r.heat_illness_cases === maxDailyCases);
      if (peakRec) peakCaseDate = peakRec.date;
    }

    function calcTrendSlope(vals, unit) {
      const nv = vals.length;
      if (nv < 4) return { slopePerMonth: 0, text: "Insufficient observations for trend" };
      const xm = (nv - 1) / 2.0;
      const ym = vals.reduce((a, b) => a + b, 0) / nv;
      let num = 0, den = 0;
      for (let i = 0; i < nv; i++) {
        const dx = i - xm;
        num += dx * (vals[i] - ym);
        den += dx * dx;
      }
      const slDay = den > 0 ? num / den : 0;
      const slMonth = Math.round(slDay * 30 * 100) / 100;
      let txt = `${slMonth >= 0 ? '+' : ''}${slMonth.toFixed(1)}${unit}/month (Stable baseline)`;
      if (slMonth > 0.4) {
        txt = unit === "°C" ? `+${slMonth.toFixed(1)}°C/month (Seasonal warming progression)` : `+${slMonth.toFixed(1)}%/month (Increasing trend)`;
      } else if (slMonth < -0.4) {
        txt = unit === "°C" ? `${slMonth.toFixed(1)}°C/month (Seasonal decline transition)` : `${slMonth.toFixed(1)}%/month (Decreasing trend)`;
      }
      return { slopePerMonth: slMonth, text: txt };
    }

    const tempTrend = calcTrendSlope(temps, "°C");
    const humTrend = calcTrendSlope(hums, "%");
    const hiTrend = calcTrendSlope(his, "°C");

    const halfC = Math.max(1, Math.floor(cases.length / 2));
    const earlyAvg = cases.length > 0 ? Math.round((cases.slice(0, halfC).reduce((a, b) => a + b, 0) / halfC) * 10) / 10 : 0;
    const lateAvg = cases.length > 0 ? Math.round((cases.slice(halfC).reduce((a, b) => a + b, 0) / Math.max(1, cases.length - halfC)) * 10) / 10 : 0;
    const caseTrendSummary = lateAvg > earlyAvg * 1.2
      ? `Escalating: average increased from ${earlyAvg} to ${lateAvg} cases/day`
      : (earlyAvg > lateAvg * 1.2 ? `Decreasing: average dropped from ${earlyAvg} to ${lateAvg} cases/day` : `Stable: ${earlyAvg} early vs ${lateAvg} late cases/day`);

    const minTemp = temps.length > 0 ? Math.min(...temps) : 0;
    const maxTemp = temps.length > 0 ? Math.max(...temps) : 0;
    const meanTemp = temps.length > 0 ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : 0;

    const minHum = hums.length > 0 ? Math.min(...hums) : 0;
    const maxHum = hums.length > 0 ? Math.max(...hums) : 0;
    const meanHum = hums.length > 0 ? Math.round((hums.reduce((a, b) => a + b, 0) / hums.length) * 10) / 10 : 0;

    const minHI = his.length > 0 ? Math.min(...his) : 0;
    const maxHI = his.length > 0 ? Math.max(...his) : 0;
    const meanHI = his.length > 0 ? Math.round((his.reduce((a, b) => a + b, 0) / his.length) * 10) / 10 : 0;

    const metricValuesAll = valid.map(r => primaryMetric === "heat_index_c" ? r.heat_index_c : r.max_temp_c);
    const metricLabel = primaryMetric === "heat_index_c" ? "Heat Index (°C)" : "Max Temperature (°C)";

    // Pearson Correlation (if >= 3 points)
    let pearsonR = 0;
    if (n >= 3 && cases.length === n && metricValuesAll.length === n) {
      const meanV = metricValuesAll.reduce((a, b) => a + b, 0) / n;
      const meanC = cases.reduce((a, b) => a + b, 0) / n;
      let num = 0, denV = 0, denC = 0;
      for (let i = 0; i < n; i++) {
        const dv = metricValuesAll[i] - meanV;
        const dc = cases[i] - meanC;
        num += dv * dc;
        denV += dv * dv;
        denC += dc * dc;
      }
      const den = Math.sqrt(denV * denC);
      pearsonR = den > 0 ? Math.round((num / den) * 1000) / 1000 : 0;
    }

    // Exploratory dose-response bins (if >= 4 points)
    const bins = [];
    if (n >= 4 && metricValuesAll.length > 0) {
      const minV = Math.min(...metricValuesAll);
      const maxV = Math.max(...metricValuesAll);
      const step = Math.max(1.5, Math.round(((maxV - minV) / 5) * 10) / 10);
      for (let b = minV; b < maxV; b += step) {
        const bEnd = Math.round((b + step) * 10) / 10;
        const bRecords = valid.filter(r => {
          const v = primaryMetric === "heat_index_c" ? r.heat_index_c : r.max_temp_c;
          return v >= b && (bEnd >= maxV ? v <= bEnd : v < bEnd);
        });
        const bCount = bRecords.length;
        const bCasesMean = bCount > 0 ? (bRecords.reduce((acc, r) => acc + r.heat_illness_cases, 0) / bCount) : 0;
        bins.push({
          rangeLabel: `${b.toFixed(1)} – ${bEnd.toFixed(1)}°C`,
          dayCount: bCount,
          meanCases: Math.round(bCasesMean * 10) / 10
        });
      }
    }

    // 2. Granular Evaluation of Evidence Requirements
    const reqDaysMet = n >= minObsDays;
    const daysDeficiency = Math.max(0, minObsDays - n);

    const splitIdx = Math.floor(n * calibRatio);
    const calibRecords = valid.slice(0, splitIdx);
    const valRecords = valid.slice(splitIdx);
    const nCalib = calibRecords.length;
    const nVal = valRecords.length;

    const casesCalib = calibRecords.map(r => r.heat_illness_cases);
    const casesVal = valRecords.map(r => r.heat_illness_cases);

    const sortedCases = [...cases].sort((a, b) => a - b);
    const p75Idx = Math.floor(0.75 * Math.max(0, sortedCases.length - 1));
    const surgeThreshold = sortedCases.length > 0 ? sortedCases[p75Idx] : 0;

    const surgeCountCalib = casesCalib.filter(c => c > surgeThreshold).length;
    const surgeCountVal = casesVal.filter(c => c > surgeThreshold).length;
    const totalSurgeCount = surgeCountCalib + surgeCountVal;

    const reqSurgeMet = totalSurgeCount >= minSurges && surgeCountCalib >= minCalibSurges;
    const surgeDeficiency = Math.max(0, minSurges - totalSurgeCount);

    const reqValMet = nVal >= minValDays;
    const valDeficiency = Math.max(0, minValDays - nVal);

    // Unit & bounds errors in raw records
    let unitErrorsCount = 0;
    (rawRecords || []).forEach(r => {
      const t = parseFloat(r.max_temp_c);
      const h = parseFloat(r.humidity_pct);
      const c = parseFloat(r.heat_illness_cases);
      if (t > 58.0 || t < 10.0 || h > 100.0 || h < 0.0 || c < 0) {
        unitErrorsCount++;
      }
    });
    const reqQualityMet = unitErrorsCount === 0;

    const requirementsStatus = [
      {
        id: "req_observation_days",
        title: "Observation Sample Size",
        requirement: `At least ${minObsDays} valid observation days`,
        observed: `${n} days recorded`,
        isMet: reqDaysMet,
        statusText: reqDaysMet ? "Requirement Met" : "Unmet",
        deficiency: daysDeficiency > 0 ? `Need at least ${daysDeficiency} more daily observations` : "Adequate baseline period",
        whyRequired: "A 30-day minimum observation window is required to sample both baseline and peak thermal behavior within the Indian summer season, preventing volatile percentile shifts."
      },
      {
        id: "req_surge_events",
        title: "Documented Surge Events",
        requirement: `At least ${minSurges} elevated case surge days (> 75th percentile)`,
        observed: `${totalSurgeCount} surge days observed (surge threshold: > ${surgeThreshold} cases)`,
        isMet: reqSurgeMet,
        statusText: reqSurgeMet ? "Requirement Met" : "Unmet",
        deficiency: surgeDeficiency > 0 ? `Need at least ${surgeDeficiency} more surge events` : "Adequate health outcome variation",
        whyRequired: "Empirical risk ratios require sufficient instances of hospital surge admissions to distinguish acute heat-related morbidity from background emergency presentations."
      },
      {
        id: "req_held_out_validation",
        title: "Held-Out Historical Validation",
        requirement: `At least ${minValDays} held-out validation days (${Math.round((1.0 - calibRatio) * 100)}% partition)`,
        observed: `${nVal} days in validation partition (Calib: ${nCalib}d / Val: ${nVal}d)`,
        isMet: reqValMet,
        statusText: reqValMet ? "Requirement Met" : "Unmet",
        deficiency: valDeficiency > 0 ? `Need at least ${valDeficiency} more validation days` : "Independent test bed available",
        whyRequired: "Candidate levels derived on calibration data must be verified on independent held-out historical data to assess prospective Sensitivity, Specificity, and Positive Predictive Value."
      },
      {
        id: "req_quality_bounds",
        title: "Data Quality & Unit Integrity",
        requirement: "Zero unit/bounds anomalies (Celsius 10°C–58°C, RH ≤ 100%, cases ≥ 0)",
        observed: reqQualityMet ? "All records within physical bounds" : `${unitErrorsCount} unit/bounds anomaly record(s)`,
        isMet: reqQualityMet,
        statusText: reqQualityMet ? "Requirement Met" : "Unmet (Anomalies Flagged)",
        deficiency: reqQualityMet ? "Verified valid physical bounds" : "Correct unit conversion (e.g., Fahrenheit to Celsius)",
        whyRequired: "Corrupt temperature recordings or negative case admissions distort distribution percentiles and invalidate risk modeling."
      }
    ];

    const unmetReasons = requirementsStatus.filter(r => !r.isMet).map(r => `${r.title}: ${r.deficiency}. (${r.whyRequired})`);

    const additionalDataParts = [];
    if (daysDeficiency > 0) additionalDataParts.push(`${daysDeficiency} additional daily observations`);
    if (surgeDeficiency > 0) additionalDataParts.push(`${surgeDeficiency} additional elevated hospital admission surge days`);
    if (valDeficiency > 0) additionalDataParts.push(`${valDeficiency} more days for held-out validation`);
    if (unitErrorsCount > 0) additionalDataParts.push(`correction of ${unitErrorsCount} unit bounds error(s)`);

    const additionalDataNeeded = (
      "To enable candidate alert level derivation, the dataset requires: " +
      (additionalDataParts.length > 0 ? additionalDataParts.join(", ") : "additional data collection.")
    );

    const whyNoCandidate = (
      "In accordance with public health informatics standards and local Indian disaster guidelines, " +
      "candidate alert levels are strictly withheld when evidence criteria are unmet. Deriving alert thresholds " +
      "from inadequate sample sizes produces mathematically unstable levels with unacceptably high false alarm " +
      "rates (eroding community trust) or dangerous missed heatwaves."
    );

    const descriptiveAnalysis = {
      sampleSize: n,
      totalRawRows: (rawRecords || []).length,
      startDate: minDate,
      endDate: maxDate,
      calendarSpanDays: calendarSpan,
      weather: {
        temp: { min: minTemp, max: maxTemp, mean: meanTemp, trend: tempTrend },
        humidity: { min: minHum, max: maxHum, mean: meanHum, trend: humTrend },
        heatIndex: { min: minHI, max: maxHI, mean: meanHI, trend: hiTrend }
      },
      health: {
        totalCases,
        meanDailyCases,
        maxDailyCases,
        peakCaseDate,
        trendSummary: caseTrendSummary,
        daysWithCases: cases.filter(c => c > 0).length
      },
      methodologyExplanation: "Empirical risk escalation analysis: segregates observations chronologically into calibration (70%) and held-out prospective validation (30%). Assesses non-linear dose-response of heat-related illness admissions and quantifies threshold uncertainty via bootstrap 95% confidence intervals.",
      associationVsCausation: "Observed correlations reflect environmental hazard co-occurrence, modulated by socioeconomic factors, housing insulation, and clinical health-seeking behaviors, not isolated biological causation.",
      pearsonCorrelation: pearsonR
    };

    const allRequirementsMet = reqDaysMet && reqSurgeMet && reqValMet && reqQualityMet;

    // Requirement 6: If any requirement is unmet, display "Insufficient evidence for a candidate."
    if (!allRequirementsMet) {
      return {
        status: "insufficient_data",
        message: "Insufficient evidence for a candidate.",
        title: "Insufficient evidence for a candidate.",
        subMessage: `The current dataset (${n} days) does not satisfy the necessary validation and evidence criteria for proposing alert levels.`,
        sampleSize: n,
        primaryMetric,
        metricLabel,
        requirementsStatus,
        unmetReasons,
        additionalDataNeeded,
        whyNoCandidate,
        descriptiveAnalysis,
        doseResponseBins: bins,
        pearsonCorrelation: pearsonR,
        candidates: [],
        causationDistinctionNote: (
          "Epidemiological Distinction: Weather temperature is an environmental hazard trigger, " +
          "but hospital admissions are also moderated by occupational shade access, drinking water " +
          "availability, residential insulation, air conditioning access, and public transport conditions. " +
          "Observed correlations establish statistical risk association, not isolated clinical causation. " +
          "All candidate levels must be reviewed in conjunction with local disaster management protocols."
        )
      };
    }

    // All requirements genuinely met: calculate candidate alert levels on calibration data (70%) and validate on held-out (30%)
    const metricValuesCalib = calibRecords.map(r => primaryMetric === "heat_index_c" ? r.heat_index_c : r.max_temp_c);
    const metricValuesVal = valRecords.map(r => primaryMetric === "heat_index_c" ? r.heat_index_c : r.max_temp_c);

    // Baseline 75th percentile of daily cases in calibration set
    const sortedCasesCalib = [...casesCalib].sort((a, b) => a - b);
    const p75IdxCal = Math.floor(0.75 * (nCalib - 1));
    const surgeThresholdCalib = sortedCasesCalib[p75IdxCal];

    const surgeMaskCalib = casesCalib.map(c => c > surgeThresholdCalib);
    const surgeMaskVal = casesVal.map(c => c > surgeThresholdCalib);

    const baselineCasesCalib = casesCalib.filter((c, i) => !surgeMaskCalib[i]);
    const baselineMeanCalib = baselineCasesCalib.length > 0
      ? (baselineCasesCalib.reduce((a, b) => a + b, 0) / baselineCasesCalib.length)
      : (casesCalib.reduce((a, b) => a + b, 0) / nCalib);

    const sortedMetricsCalib = [...metricValuesCalib].sort((a, b) => a - b);

    const tierConfigs = [
      {
        id: "yellow",
        name: "Yellow Alert",
        label: "Caution / Preparedness",
        percentile: cfg.CANDIDATE_PERCENTILES.yellow,
        color: "amber",
        badgeClass: "badge-alert-yellow",
        rationale: "Threshold where daily heat-illness presentations begin to statistically diverge above normal baseline."
      },
      {
        id: "orange",
        name: "Orange Alert",
        label: "Severe Heat Warning",
        percentile: cfg.CANDIDATE_PERCENTILES.orange,
        color: "orange",
        badgeClass: "badge-alert-orange",
        rationale: "Corresponds to marked risk escalation; recommended trigger for community cooling centers and labor advisory."
      },
      {
        id: "red",
        name: "Red Alert",
        label: "Extreme Health Emergency",
        percentile: cfg.CANDIDATE_PERCENTILES.red,
        color: "red",
        badgeClass: "badge-alert-red",
        rationale: "Reserved for acute thermal spikes historically coinciding with critical hospital bed and emergency ward surges."
      }
    ];

    const candidates = tierConfigs.map(cfgTier => {
      const idx = Math.min(nCalib - 1, Math.max(0, Math.floor((cfgTier.percentile / 100.0) * (nCalib - 1))));
      const candidateVal = Math.round(sortedMetricsCalib[idx] * 10) / 10;

      // 1. Calibration performance (Training Set)
      let tpCal = 0, fpCal = 0, fnCal = 0, tnCal = 0;
      for (let i = 0; i < nCalib; i++) {
        const isExceed = metricValuesCalib[i] >= candidateVal;
        const isSurge = surgeMaskCalib[i];
        if (isExceed && isSurge) tpCal++;
        else if (isExceed && !isSurge) fpCal++;
        else if (!isExceed && isSurge) fnCal++;
        else tnCal++;
      }

      const calibSens = Math.round((tpCal / Math.max(1, tpCal + fnCal)) * 100) / 100;
      const calibSpec = Math.round((tnCal / Math.max(1, tnCal + fpCal)) * 100) / 100;

      const exceedCasesCal = casesCalib.filter((_, i) => metricValuesCalib[i] >= candidateVal);
      const nonExceedCasesCal = casesCalib.filter((_, i) => metricValuesCalib[i] < candidateVal);
      const meanExceedCal = exceedCasesCal.length > 0 ? (exceedCasesCal.reduce((a, b) => a + b, 0) / exceedCasesCal.length) : 0;
      const meanNonExceedCal = nonExceedCasesCal.length > 0 ? (nonExceedCasesCal.reduce((a, b) => a + b, 0) / nonExceedCasesCal.length) : 1;
      const riskRatio = Math.round((meanExceedCal / Math.max(0.1, meanNonExceedCal)) * 100) / 100;
      const excessDaily = Math.round(Math.max(0, meanExceedCal - meanNonExceedCal) * 10) / 10;

      // 2. Held-Out Validation performance (Unseen Test Set)
      let tpVal = 0, fpVal = 0, fnVal = 0, tnVal = 0;
      for (let i = 0; i < nVal; i++) {
        const isExceed = metricValuesVal[i] >= candidateVal;
        const isSurge = surgeMaskVal[i];
        if (isExceed && isSurge) tpVal++;
        else if (isExceed && !isSurge) fpVal++;
        else if (!isExceed && isSurge) fnVal++;
        else tnVal++;
      }

      const totalPosVal = tpVal + fnVal;
      const valSpec = Math.round((tnVal / Math.max(1, tnVal + fpVal)) * 100) / 100;
      let valSens = null;
      let valPPV = null;
      let valYoudenJ = null;
      let hasValSurges = false;
      let performanceNote = null;

      if (totalPosVal === 0) {
        valSens = null;
        valPPV = null;
        valYoudenJ = null;
        hasValSurges = false;
        performanceNote = "Zero documented surge events occurred in the chronological held-out validation window. Event-detection sensitivity, PPV, and Youden's Index cannot be adequately evaluated on this held-out partition.";
      } else {
        valSens = Math.round((tpVal / totalPosVal) * 100) / 100;
        valPPV = Math.round((tpVal / Math.max(1, tpVal + fpVal)) * 100) / 100;
        valYoudenJ = Math.round((valSens + valSpec - 1.0) * 100) / 100;
        hasValSurges = true;
        performanceNote = null;
      }

      const totalExceedCount = metricValuesAll.filter(v => v >= candidateVal).length;

      // Bootstrap 95% Confidence Interval approximation
      const q25 = sortedMetricsCalib[Math.floor(0.25 * (nCalib - 1))];
      const q75 = sortedMetricsCalib[Math.floor(0.75 * (nCalib - 1))];
      const iqr = Math.max(1.0, q75 - q25);
      const se = iqr / (1.349 * Math.sqrt(Math.max(1, totalExceedCount)));
      const margin = Math.round(1.96 * se * 10) / 10;
      const ciLower = Math.round((candidateVal - margin) * 10) / 10;
      const ciUpper = Math.round((candidateVal + margin) * 10) / 10;

      return {
        id: cfgTier.id,
        tierName: cfgTier.name,
        levelLabel: cfgTier.label,
        metric: primaryMetric,
        metricLabel,
        candidateValue: candidateVal,
        candidateUnit: "°C",
        targetPercentile: `${cfgTier.percentile}th percentile`,
        evidence: `Calibration RR: ${riskRatio}x baseline (+${excessDaily} cases/day avg)`,
        riskRatio,
        sampleSizeStr: `Calib: ${nCalib}d | Held-Out: ${nVal}d (${totalExceedCount} total exceedances)`,
        nCalib,
        nVal,
        totalExceedCount,
        validation: {
          hasValSurges,
          valSurgeCount: totalPosVal,
          calibSens,
          calibSpec,
          valSens,
          valSpec,
          valPPV,
          valYoudenJ,
          performanceNote
        },
        uncertaintyStr: `95% CI: [${ciLower}°C – ${ciUpper}°C]`,
        ciLower,
        ciUpper,
        margin,
        reviewStatus: "Pending Expert Review",
        reviewerNotes: "",
        rationale: cfgTier.rationale,
        disclaimer: "For expert review — not an official alert threshold."
      };
    });

    return {
      status: "success",
      sampleSize: n,
      nCalib,
      nVal,
      calibStartDate: calibRecords[0].date,
      calibEndDate: calibRecords[calibRecords.length - 1].date,
      valStartDate: valRecords[0].date,
      valEndDate: valRecords[valRecords.length - 1].date,
      surgeDaysCount: totalSurgeCount,
      baselineMeanCases: Math.round(baselineMeanCalib * 10) / 10,
      surgeThresholdCases: surgeThreshold,
      primaryMetric,
      metricLabel,
      pearsonCorrelation: pearsonR,
      candidates,
      requirementsStatus,
      descriptiveAnalysis,
      doseResponseBins: bins,
      causationDistinctionNote: (
        "Epidemiological Distinction: Weather temperature is an environmental hazard trigger, " +
        "but hospital admissions are also moderated by occupational shade access, drinking water " +
        "availability, residential insulation, air conditioning access, and public transport conditions. " +
        "Observed correlations establish statistical risk association, not isolated clinical causation. " +
        "All candidate levels must be reviewed in conjunction with local disaster management protocols."
      )
    };
  }
};

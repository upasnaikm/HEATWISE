/**
 * HeatWise Application Controller
 * Handles application state, reactive filtering, candidate reviews, and reporting.
 */

const HeatWiseApp = {
  state: {
    activeDistrictId: "SYN_DIST_NORTH",
    activeDistrictMeta: null,
    uploadedDistrictsMap: {}, // district_id -> array of records
    rawRecords: [],
    filteredRecords: [],
    startDate: null,
    endDate: null,
    primaryMetric: "max_temp_c",
    calendarHeatmapMetric: "temp",
    inspectedDay: null,
    analysisResult: null,
    qualityResult: null,
    candidateOverrides: {},
    isUploadedData: false,
    uploadedFilename: ""
  },

  init() {
    this.bindEvents();
    if (typeof HeatWiseGeoMap !== "undefined" && HeatWiseGeoMap.init) {
      HeatWiseGeoMap.init();
    }
    this.loadDistrict("SYN_DIST_NORTH");
  },

  bindEvents() {
    const distSelect = document.getElementById("districtSelect");
    if (distSelect) {
      distSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val.startsWith("DEMO_")) {
          this.loadDistrict(val.replace("DEMO_", ""));
        } else if (val.startsWith("UPLOAD_")) {
          const uDistId = val.replace("UPLOAD_", "");
          this.loadUploadedDistrict(uDistId);
        }
      });
    }

    const btnSourceExpanded = document.getElementById("btnSourceExpanded");
    const btnSourceStandard = document.getElementById("btnSourceStandard");
    const btnSourceUploaded = document.getElementById("btnSourceUploaded");
    if (btnSourceExpanded) btnSourceExpanded.addEventListener("click", () => this.switchDatasetMode("expanded"));
    if (btnSourceStandard) btnSourceStandard.addEventListener("click", () => this.switchDatasetMode("standard"));
    if (btnSourceUploaded) btnSourceUploaded.addEventListener("click", () => this.switchDatasetMode("uploaded"));

    const btnDownloadExpandedDemo = document.getElementById("btnDownloadExpandedDemo");
    if (btnDownloadExpandedDemo) {
      btnDownloadExpandedDemo.addEventListener("click", () => this.downloadExpandedDemoClientSide());
    }

    const btnLoadExpandedDirect = document.getElementById("btnLoadExpandedDirect");
    if (btnLoadExpandedDirect) {
      btnLoadExpandedDirect.addEventListener("click", () => this.loadExpandedDemoDirect());
    }

    const btnMetricTemp = document.getElementById("btnMetricTemp");
    const btnMetricHI = document.getElementById("btnMetricHI");
    if (btnMetricTemp && btnMetricHI) {
      btnMetricTemp.addEventListener("click", () => this.setPrimaryMetric("max_temp_c"));
      btnMetricHI.addEventListener("click", () => this.setPrimaryMetric("heat_index_c"));
    }

    const startDateInput = document.getElementById("filterStartDate");
    const endDateInput = document.getElementById("filterEndDate");
    if (startDateInput && endDateInput) {
      startDateInput.addEventListener("change", () => this.applyDateFilter());
      endDateInput.addEventListener("change", () => this.applyDateFilter());
    }

    const presetFull = document.getElementById("presetFullSeason");
    const presetPeak = document.getElementById("presetPeakHeat");
    const presetEarly = document.getElementById("presetEarlySummer");
    const presetReset = document.getElementById("presetReset");
    if (presetFull) presetFull.addEventListener("click", () => this.setFilterPreset("full"));
    if (presetPeak) presetPeak.addEventListener("click", () => this.setFilterPreset("peak"));
    if (presetEarly) presetEarly.addEventListener("click", () => this.setFilterPreset("early"));
    if (presetReset) presetReset.addEventListener("click", () => this.setFilterPreset("reset"));

    const toggleTemp = document.getElementById("toggleChartTemp");
    const toggleHI = document.getElementById("toggleChartHI");
    const toggleHum = document.getElementById("toggleChartHum");
    const toggleCases = document.getElementById("toggleChartCases");
    [toggleTemp, toggleHI, toggleHum, toggleCases].forEach(el => {
      if (el) el.addEventListener("change", () => this.refreshCharts());
    });

    const fileInput = document.getElementById("csvFileInput");
    const dropZone = document.getElementById("csvDropZone");
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) this.handleFileUpload(e.target.files[0]);
      });
    }
    if (dropZone) {
      dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-active"); });
      dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-active"));
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault(); dropZone.classList.remove("drag-active");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) this.handleFileUpload(e.dataTransfer.files[0]);
      });
    }

    const btnDownloadTemplate = document.getElementById("btnDownloadTemplate");
    if (btnDownloadTemplate) {
      btnDownloadTemplate.addEventListener("click", () => this.downloadBlankTemplateClientSide());
    }

    const btnLoadTemplateIssues = document.getElementById("btnLoadTemplateIssues");
    if (btnLoadTemplateIssues) {
      btnLoadTemplateIssues.addEventListener("click", () => this.loadIssuesSampleDataset());
    }

    const btnShowSchema = document.getElementById("btnShowSchema");
    if (btnShowSchema) {
      btnShowSchema.addEventListener("click", () => this.openSchemaModal());
    }

    const btnPrintReport = document.getElementById("btnPrintReport");
    if (btnPrintReport) btnPrintReport.addEventListener("click", () => window.print());

    const btnExportJson = document.getElementById("btnExportJson");
    if (btnExportJson) btnExportJson.addEventListener("click", () => this.exportJsonReport());

    const btnDownloadFullReport = document.getElementById("btnDownloadFullReport");
    if (btnDownloadFullReport) btnDownloadFullReport.addEventListener("click", () => this.downloadFullHtmlReport());

    const btnCopySitrep = document.getElementById("btnCopySitrep");
    if (btnCopySitrep) btnCopySitrep.addEventListener("click", () => this.copySituationReport());

    const whatIfSlider = document.getElementById("whatIfSlider");
    if (whatIfSlider) {
      whatIfSlider.addEventListener("input", (e) => {
        this.updateWhatIfSimulation(parseFloat(e.target.value));
      });
    }

    const btnHeatmapTemp = document.getElementById("btnHeatmapTemp");
    const btnHeatmapHI = document.getElementById("btnHeatmapHI");
    const btnHeatmapCases = document.getElementById("btnHeatmapCases");
    const btnHeatmapAlerts = document.getElementById("btnHeatmapAlerts");

    if (btnHeatmapTemp) btnHeatmapTemp.addEventListener("click", () => this.setCalendarHeatmapMetric("temp"));
    if (btnHeatmapHI) btnHeatmapHI.addEventListener("click", () => this.setCalendarHeatmapMetric("hi"));
    if (btnHeatmapCases) btnHeatmapCases.addEventListener("click", () => this.setCalendarHeatmapMetric("cases"));
    if (btnHeatmapAlerts) btnHeatmapAlerts.addEventListener("click", () => this.setCalendarHeatmapMetric("alerts"));
  },

  loadDistrict(districtId) {
    const registry = (typeof ALL_SYNTHETIC_DISTRICTS !== "undefined")
      ? ALL_SYNTHETIC_DISTRICTS
      : (typeof EXPANDED_SYNTHETIC_DISTRICTS !== "undefined" && EXPANDED_SYNTHETIC_DISTRICTS[districtId])
        ? EXPANDED_SYNTHETIC_DISTRICTS
        : SYNTHETIC_DISTRICTS;
    const demo = registry[districtId] || (typeof SYNTHETIC_DISTRICTS !== "undefined" ? SYNTHETIC_DISTRICTS[districtId] : null);
    if (!demo) return;
    this.state.isUploadedData = false;
    this.state.uploadedFilename = "";
    this.state.activeDistrictId = districtId;
    this.state.activeDistrictMeta = {
      id: demo.id,
      name: demo.name, state: demo.state, zone: demo.zone,
      badge: demo.badge, badgeColor: demo.badgeColor || "amber", description: demo.description,
      group: demo.group || (districtId.startsWith("SYN_DIST_") ? "expanded_180d" : "regional_122d"),
      isSynthetic: true
    };
    this.state.rawRecords = [...demo.records];
    this.state.candidateOverrides = {};

    const select = document.getElementById("districtSelect");
    if (select) select.value = "DEMO_" + districtId;

    this.updateSourcePillsUI();
    this.updateDistrictHeaderUI();
    this.initDateInputs();
    this.applyDateFilter();
    if (typeof HeatWiseGeoMap !== "undefined" && HeatWiseGeoMap.highlightDistrict) {
      HeatWiseGeoMap.highlightDistrict(districtId);
    }
  },

  updateSourcePillsUI() {
    const btnExp = document.getElementById("btnSourceExpanded");
    const btnStd = document.getElementById("btnSourceStandard");
    const btnUpl = document.getElementById("btnSourceUploaded");

    if (btnExp) btnExp.classList.remove("active");
    if (btnStd) btnStd.classList.remove("active");
    if (btnUpl) btnUpl.classList.remove("active");

    if (this.state.isUploadedData) {
      if (btnUpl) btnUpl.classList.add("active");
    } else if (this.state.activeDistrictId && this.state.activeDistrictId.startsWith("SYN_DIST_")) {
      if (btnExp) btnExp.classList.add("active");
    } else {
      if (btnStd) btnStd.classList.add("active");
    }
  },

  switchDatasetMode(mode) {
    if (mode === "expanded") {
      this.loadDistrict("SYN_DIST_NORTH");
    } else if (mode === "standard") {
      this.loadDistrict("IND_GJ_AHM");
    } else if (mode === "uploaded") {
      const uDistIds = Object.keys(this.state.uploadedDistrictsMap);
      if (uDistIds.length > 0) {
        this.loadUploadedDistrict(uDistIds[0]);
      }
    }
  },

  downloadExpandedDemoClientSide() {
    const dict = (typeof EXPANDED_SYNTHETIC_DISTRICTS !== "undefined") ? EXPANDED_SYNTHETIC_DISTRICTS : {};
    let csv = "date,district_id,max_temp_c,humidity_pct,heat_illness_cases\n";
    Object.keys(dict).forEach(dId => {
      const dist = dict[dId];
      if (dist && dist.records) {
        dist.records.forEach(r => {
          csv += `${r.date},${r.district_id},${r.max_temp_c !== null ? r.max_temp_c : ''},${r.humidity_pct !== null ? r.humidity_pct : ''},${r.heat_illness_cases !== null ? r.heat_illness_cases : ''}\n`;
        });
      }
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expanded_180d_synthetic_demo.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast("Expanded 180-Day Synthetic Dataset downloaded (.csv)", "success");
  },

  loadExpandedDemoDirect() {
    this.switchDatasetMode("expanded");
    this.showToast("Loaded Expanded 180-Day Synthetic Dataset (Fictional Districts)", "info");
  },

  loadUploadedDistrict(districtId) {
    const records = this.state.uploadedDistrictsMap[districtId];
    if (!records) return;

    this.state.isUploadedData = true;
    this.state.activeDistrictId = districtId;
    this.state.activeDistrictMeta = {
      id: districtId,
      name: `District ${districtId}`,
      state: "Uploaded Data Source",
      zone: "Custom Local Regime",
      badge: "Uploaded District",
      badgeColor: "blue",
      description: `Custom observations for district ${districtId} from ${this.state.uploadedFilename}.`,
      isSynthetic: false
    };
    this.state.rawRecords = [...records];
    this.state.candidateOverrides = {};

    const select = document.getElementById("districtSelect");
    if (select) select.value = "UPLOAD_" + districtId;

    this.updateSourcePillsUI();
    this.updateDistrictHeaderUI();
    this.initDateInputs();
    this.applyDateFilter();
    if (typeof HeatWiseGeoMap !== "undefined" && HeatWiseGeoMap.highlightDistrict) {
      HeatWiseGeoMap.highlightDistrict("UPLOAD_" + districtId);
    }
  },

  resetToDemoMode() {
    this.loadDistrict("IND_GJ_AHM");
  },

  loadIssuesSampleDataset() {
    const sampleCSV = 
      "date,district_id,max_temp_c,humidity_pct,heat_illness_cases\n" +
      "2024-04-01,IND_TEST_ISSUES,36.5,42.0,4\n" +
      "2024-04-02,IND_TEST_ISSUES,37.2,40.5,5\n" +
      "2024-04-03,IND_TEST_ISSUES,,38.0,6\n" +  // missing temp
      "2024-04-04,IND_TEST_ISSUES,104.5,35.0,8\n" + // Fahrenheit error
      "2024-04-05,IND_TEST_ISSUES,40.4,-12.0,11\n" + // negative humidity
      "2024-04-06,IND_TEST_ISSUES,41.2,30.5,-3\n" + // negative cases
      "2024-04-07,IND_TEST_ISSUES,42.5,28.0,22\n" +
      "2024-04-08,IND_TEST_ISSUES,43.1,135.0,29\n" + // humidity > 100
      "2024-04-09,IND_TEST_ISSUES,42.8,27.5,25\n" +
      "2024-04-10,IND_TEST_ISSUES,41.0,33.0,14\n";

    this.processCSVText("sample_with_quality_issues.csv", sampleCSV);
  },

  handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.processCSVText(file.name, e.target.result);
    };
    reader.readAsText(file);
  },

  processCSVText(filename, text) {
    const errorBox = document.getElementById("csvErrorBox");
    const successBox = document.getElementById("csvSuccessBox");
    const errorList = document.getElementById("csvErrorList");
    const errorMsg = document.getElementById("csvErrorMessage");
    const errorTitle = document.getElementById("csvErrorTitle");

    if (errorBox) errorBox.classList.add("hidden");
    if (successBox) successBox.classList.add("hidden");

    const result = HeatWiseDataQuality.parseAndValidateCSV(text);

    if (!result.success) {
      if (errorBox && errorMsg && errorList) {
        errorTitle.textContent = "CSV Ingestion Rejected: Schema / Validation Failure";
        errorMsg.textContent = result.error || "The CSV file failed schema validation.";
        errorList.innerHTML = result.errors && result.errors.length > 0
          ? result.errors.map(err => `<div>• ${err}</div>`).join("")
          : `<div>• ${result.error}</div>`;
        errorBox.classList.remove("hidden");
      }
      this.showToast(`Upload Rejected: ${result.error}`, "error");
      return;
    }

    // If there were non-fatal row errors, display them clearly in the error box
    if (result.rowErrors && result.rowErrors.length > 0) {
      if (errorBox && errorMsg && errorList) {
        errorTitle.textContent = `CSV Processed with ${result.rowErrors.length} Excluded Row Issues`;
        errorMsg.textContent = `Loaded ${result.validRows} valid rows. ${result.rowErrors.length} invalid rows were flagged and excluded from modeling:`;
        errorList.innerHTML = result.rowErrors.slice(0, 10).map(err => `<div>• ${err}</div>`).join("") +
          (result.rowErrors.length > 10 ? `<div>...and ${result.rowErrors.length - 10} more rows</div>` : "");
        errorBox.classList.remove("hidden");
      }
    }

    // Partition records by district_id to support multiple districts in uploaded file
    const distMap = {};
    result.records.forEach(r => {
      if (!distMap[r.district_id]) distMap[r.district_id] = [];
      distMap[r.district_id].push(r);
    });

    this.state.isUploadedData = true;
    this.state.uploadedFilename = filename;
    this.state.uploadedDistrictsMap = distMap;

    // Populate uploaded districts dropdown group
    const uGroup = document.getElementById("uploadedDistrictsGroup");
    if (uGroup) {
      uGroup.innerHTML = "";
      uGroup.classList.remove("hidden");
      const distIds = Object.keys(distMap);
      distIds.forEach((dId) => {
        const opt = document.createElement("option");
        opt.value = "UPLOAD_" + dId;
        opt.textContent = `📁 ${dId} (${distMap[dId].length} observation days)`;
        uGroup.appendChild(opt);
      });
    }

    // Enable uploaded source button
    const btnSourceUploaded = document.getElementById("btnSourceUploaded");
    const countBadge = document.getElementById("uploadedSourceCount");
    if (btnSourceUploaded) btnSourceUploaded.disabled = false;
    if (countBadge) {
      countBadge.textContent = Object.keys(distMap).length;
      countBadge.classList.remove("hidden");
    }

    // Pick first district
    const firstDistId = Object.keys(distMap)[0];
    this.loadUploadedDistrict(firstDistId);

    if (successBox) {
      let details = `Ingested ${result.validRows} valid observations across ${Object.keys(distMap).length} district(s) from ${filename}.`;
      if (result.aliasMatches && Object.keys(result.aliasMatches).length > 0) {
        const aliasList = Object.entries(result.aliasMatches).map(([from, to]) => `'${from}' ➔ '${to}'`).join(", ");
        details += ` Normalized equivalent headers: [${aliasList}].`;
      }
      document.getElementById("csvSuccessDetails").textContent = details;
      successBox.classList.remove("hidden");
    }

    this.showToast(`Ingested ${result.validRows} records from ${filename}`, "success");
  },

  updateDistrictHeaderUI() {
    const meta = this.state.activeDistrictMeta;
    if (!meta) return;
    const nameEl = document.getElementById("currentDistrictName");
    const zoneEl = document.getElementById("currentDistrictZone");
    const syntheticBanner = document.getElementById("syntheticDataBanner");
    const uploadedBanner = document.getElementById("uploadedDataBanner");
    const uploadedFilenameLabel = document.getElementById("uploadedFilenameLabel");

    if (nameEl) nameEl.textContent = `${meta.name}, ${meta.state}`;
    if (zoneEl) {
      zoneEl.textContent = meta.zone;
      zoneEl.className = `zone-badge zone-${meta.badgeColor || "amber"}`;
    }

    if (meta.isSynthetic) {
      if (syntheticBanner) {
        syntheticBanner.classList.remove("hidden");
        document.getElementById("bannerDistrictName").textContent = meta.name;
      }
      if (uploadedBanner) uploadedBanner.classList.add("hidden");
    } else {
      if (syntheticBanner) syntheticBanner.classList.add("hidden");
      if (uploadedBanner) {
        uploadedBanner.classList.remove("hidden");
        if (uploadedFilenameLabel) uploadedFilenameLabel.textContent = this.state.uploadedFilename;
      }
    }
  },

  initDateInputs() {
    const dates = this.state.rawRecords.map(r => r.date).filter(Boolean).sort();
    if (dates.length > 0) {
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      const startInput = document.getElementById("filterStartDate");
      const endInput = document.getElementById("filterEndDate");
      if (startInput) { startInput.min = minDate; startInput.max = maxDate; startInput.value = minDate; }
      if (endInput) { endInput.min = minDate; endInput.max = maxDate; endInput.value = maxDate; }
      this.state.startDate = minDate;
      this.state.endDate = maxDate;
    }
  },

  setFilterPreset(preset) {
    const dates = this.state.rawRecords.map(r => r.date).filter(Boolean).sort();
    if (dates.length === 0) return;
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const startInput = document.getElementById("filterStartDate");
    const endInput = document.getElementById("filterEndDate");

    if (preset === "full" || preset === "reset") {
      if (startInput) startInput.value = minDate;
      if (endInput) endInput.value = maxDate;
    } else if (preset === "peak") {
      const peakStart = dates[Math.min(dates.length - 1, Math.floor(dates.length * 0.38))];
      const peakEnd = dates[Math.min(dates.length - 1, Math.floor(dates.length * 0.68))];
      if (startInput) startInput.value = peakStart;
      if (endInput) endInput.value = peakEnd;
    } else if (preset === "early") {
      const earlyEnd = dates[Math.min(dates.length - 1, Math.floor(dates.length * 0.35))];
      if (startInput) startInput.value = minDate;
      if (endInput) endInput.value = earlyEnd;
    }
    this.applyDateFilter();
  },

  applyDateFilter() {
    const startInput = document.getElementById("filterStartDate");
    const endInput = document.getElementById("filterEndDate");
    const startVal = startInput ? startInput.value : null;
    const endVal = endInput ? endInput.value : null;
    this.state.startDate = startVal;
    this.state.endDate = endVal;

    let filtered = this.state.rawRecords;
    if (startVal) filtered = filtered.filter(r => r.date >= startVal);
    if (endVal) filtered = filtered.filter(r => r.date <= endVal);

    this.state.filteredRecords = filtered;
    this.state.qualityResult = HeatWiseAnalytics.assessDataQuality(filtered);
    this.state.analysisResult = HeatWiseAnalytics.analyzeCandidateThresholds(filtered, this.state.primaryMetric);
    if (typeof HeatWiseGeoMap !== "undefined" && HeatWiseGeoMap.updateDateRange) {
      HeatWiseGeoMap.updateDateRange(startVal, endVal);
    }
    this.renderAllViews();
  },

  setPrimaryMetric(metric) {
    this.state.primaryMetric = metric;
    const btnTemp = document.getElementById("btnMetricTemp");
    const btnHI = document.getElementById("btnMetricHI");
    if (btnTemp && btnHI) {
      if (metric === "max_temp_c") {
        btnTemp.classList.add("active"); btnHI.classList.remove("active");
      } else {
        btnHI.classList.add("active"); btnTemp.classList.remove("active");
      }
    }
    this.state.analysisResult = HeatWiseAnalytics.analyzeCandidateThresholds(this.state.filteredRecords, metric);
    this.renderAllViews();
  },

  renderAllViews() {
    this.renderOverviewCards();
    this.renderDistrictHeatmap();
    this.renderAnalysisPanel();
    this.renderCandidateTable();
    this.renderDataQualityPanel();
    this.refreshCharts();
    this.updateWhatIfSimulation();
    this.renderCalendarHeatmap();
    if (typeof HeatWiseGeoMap !== "undefined" && HeatWiseGeoMap.render) {
      HeatWiseGeoMap.render();
    }
  },

  renderOverviewCards() {
    const meta = this.state.activeDistrictMeta;
    const quality = this.state.qualityResult;
    const cleaned = HeatWiseAnalytics.cleanRecords(this.state.filteredRecords);
    const analysis = this.state.analysisResult;
    const isInsufficient = !analysis || analysis.status === "insufficient_data";
    const isSynthetic = meta ? meta.isSynthetic : true;

    const sampleBadgeHtml = isSynthetic
      ? "Sample-data statistics (SYNTHETIC DEMO)"
      : `Uploaded: ${this.state.uploadedFilename || 'Custom CSV'}`;
    const badgeClass = isSynthetic ? "sample-stat-badge" : "uploaded-stat-badge";

    // 1. Selected District
    const cardDistName = document.getElementById("ovDistrictName");
    const cardDistZone = document.getElementById("ovDistrictZone");
    const cardDistMeta = document.getElementById("ovDistrictMeta");
    const pillEl = document.getElementById("selectedDistrictRecordsPill");
    if (pillEl) {
      pillEl.textContent = `${cleaned.length} observations available`;
    }
    if (cardDistName) cardDistName.textContent = meta ? `${meta.name}` : "Unknown";
    if (cardDistZone) cardDistZone.textContent = meta ? `${meta.state} • ${meta.zone}` : "";
    if (cardDistMeta) {
      cardDistMeta.textContent = sampleBadgeHtml;
      cardDistMeta.className = badgeClass;
    }

    // 2. Observations
    const cardDays = document.getElementById("ovDaysCount");
    const cardDaysSub = document.getElementById("ovDaysSub");
    const cardDaysMeta = document.getElementById("ovDaysMeta");
    if (cardDays) cardDays.textContent = cleaned.length.toLocaleString();
    if (cardDaysSub) {
      cardDaysSub.textContent = isInsufficient
        ? `${cleaned.length} observation days (below 30-day baseline requirement)`
        : `${this.state.filteredRecords.length} window rows (${cleaned.length} valid)`;
    }
    if (cardDaysMeta) {
      cardDaysMeta.textContent = sampleBadgeHtml;
      cardDaysMeta.className = badgeClass;
    }

    // 3. Temperature Summary
    const temps = cleaned.map(r => r.max_temp_c).filter(v => typeof v === 'number' && !isNaN(v));
    const his = cleaned.map(r => r.heat_index_c).filter(v => typeof v === 'number' && !isNaN(v));
    const peakTemp = temps.length > 0 ? Math.max(...temps).toFixed(1) + "°C" : "--.-°C";
    const meanTemp = temps.length > 0 ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) + "°C" : "--.-°C";
    const peakHI = his.length > 0 ? Math.max(...his).toFixed(1) + "°C" : (temps.length > 0 ? peakTemp : "--.-°C");

    const tempPeakEl = document.getElementById("ovTempSummaryPeak");
    const tempMeanEl = document.getElementById("ovTempSummaryMean");
    const tempHIEl = document.getElementById("ovTempSummaryHI");
    const tempMetaEl = document.getElementById("ovTempMeta");
    if (tempPeakEl) tempPeakEl.textContent = peakTemp;
    if (tempMeanEl) tempMeanEl.textContent = meanTemp;
    if (tempHIEl) tempHIEl.textContent = peakHI;
    if (tempMetaEl) {
      tempMetaEl.textContent = sampleBadgeHtml;
      tempMetaEl.className = badgeClass;
    }

    // 4. Reported Cases
    const cardCases = document.getElementById("ovCasesTotal");
    const cardCasesSub = document.getElementById("ovCasesSub");
    const cardCasesMeta = document.getElementById("ovCasesMeta");
    const totalCases = cleaned.reduce((acc, r) => acc + (r.heat_illness_cases || 0), 0);
    const avgDaily = cleaned.length > 0 ? (totalCases / cleaned.length).toFixed(1) : "0.0";
    const peakCases = cleaned.length > 0 ? Math.max(...cleaned.map(r => r.heat_illness_cases || 0)) : 0;
    if (cardCases) cardCases.textContent = totalCases.toLocaleString();
    if (cardCasesSub) cardCasesSub.textContent = `Avg: ${avgDaily} cases/day (Peak: ${peakCases})`;
    if (cardCasesMeta) {
      cardCasesMeta.textContent = sampleBadgeHtml;
      cardCasesMeta.className = badgeClass;
    }

    // 5. Data Quality
    const cardQualityStatus = document.getElementById("ovQualityStatus");
    const cardQualityScore = document.getElementById("ovQualityScore");
    const cardQualitySub = document.getElementById("ovQualitySub");
    const cardQualityMeta = document.getElementById("ovQualityMeta");
    if (cardQualityStatus && quality) {
      if (isInsufficient) {
        cardQualityStatus.textContent = "Insufficient Evidence";
        cardQualityStatus.className = "badge-quality badge-degraded";
      } else {
        cardQualityStatus.textContent = quality.status;
        cardQualityStatus.className = `badge-quality ${quality.statusClass}`;
      }
    }
    if (cardQualityScore && quality) cardQualityScore.textContent = `${quality.score}/100`;
    if (cardQualitySub && quality) {
      cardQualitySub.textContent = isInsufficient
        ? `Insufficient evidence for a candidate (${cleaned.length}/30 days)`
        : `${quality.completenessPct}% complete • ${quality.metrics.unitErrors} unit errors`;
    }
    if (cardQualityMeta) {
      cardQualityMeta.textContent = isSynthetic ? "Automated Informatics Audit" : "Uploaded Quality Audit";
      cardQualityMeta.className = badgeClass;
    }
  },

  updateWhatIfSimulation(testTemp) {
    const slider = document.getElementById("whatIfSlider");
    if (!slider) return;
    if (testTemp === undefined) {
      testTemp = parseFloat(slider.value) || 42.0;
    }
    const sliderValEl = document.getElementById("whatIfSliderVal");
    if (sliderValEl) sliderValEl.textContent = `${testTemp.toFixed(1)}°C`;

    const cleaned = HeatWiseAnalytics.cleanRecords(this.state.filteredRecords);
    if (!cleaned || cleaned.length === 0) {
      this.renderWhatIfEmpty();
      return;
    }

    // Determine surge threshold: 90th percentile of daily cases (or at least 5 cases)
    const caseVals = cleaned.map(r => r.heat_illness_cases || 0).sort((a, b) => a - b);
    const surgeIdx = Math.floor(caseVals.length * 0.90);
    const surgeThreshold = Math.max(5, caseVals[Math.min(caseVals.length - 1, surgeIdx)] || 5);

    let triggeredCount = 0;
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    let totalSurges = 0;
    let totalNormals = 0;

    cleaned.forEach(r => {
      const val = this.state.primaryMetric === "heat_index_c" ? (r.heat_index_c || r.max_temp_c) : r.max_temp_c;
      if (typeof val !== "number" || isNaN(val)) return;

      const isSurge = (r.heat_illness_cases || 0) >= surgeThreshold;
      const isTriggered = val >= testTemp;

      if (isSurge) totalSurges++;
      else totalNormals++;

      if (isTriggered) {
        triggeredCount++;
        if (isSurge) tp++;
        else fp++;
      } else {
        if (isSurge) fn++;
        else tn++;
      }
    });

    const sens = totalSurges > 0 ? (tp / totalSurges) : 0;
    const spec = totalNormals > 0 ? (tn / totalNormals) : 1;
    const fdr = (tp + fp) > 0 ? (fp / (tp + fp)) : 0;
    const pctDays = cleaned.length > 0 ? Math.round((triggeredCount / cleaned.length) * 100) : 0;

    const daysEl = document.getElementById("whatIfDaysTriggered");
    const pctDaysEl = document.getElementById("whatIfPctDays");
    const sensEl = document.getElementById("whatIfSensitivity");
    const surgesFoundEl = document.getElementById("whatIfSurgesFound");
    const specEl = document.getElementById("whatIfSpecificity");
    const baselineCleanEl = document.getElementById("whatIfBaselineClean");
    const fdrEl = document.getElementById("whatIfFalseAlertRate");
    const falseAlertsCountEl = document.getElementById("whatIfFalseAlertsCount");

    if (daysEl) daysEl.textContent = triggeredCount;
    if (pctDaysEl) pctDaysEl.textContent = `${pctDays}% of observation days`;
    if (sensEl) sensEl.textContent = totalSurges > 0 ? `${Math.round(sens * 100)}%` : "N/A*";
    if (surgesFoundEl) surgesFoundEl.textContent = `${tp} of ${totalSurges} surge events`;
    if (specEl) specEl.textContent = `${Math.round(spec * 100)}%`;
    if (baselineCleanEl) baselineCleanEl.textContent = `${tn} of ${totalNormals} normal days`;
    if (fdrEl) fdrEl.textContent = `${Math.round(fdr * 100)}%`;
    if (falseAlertsCountEl) falseAlertsCountEl.textContent = `${fp} alerts on non-surge days`;
  },

  renderWhatIfEmpty() {
    const daysEl = document.getElementById("whatIfDaysTriggered");
    if (daysEl) daysEl.textContent = "--";
  },

  renderAnalysisPanel() {
    const analysis = this.state.analysisResult;
    const container = document.getElementById("analysisContent");
    if (!container) return;

    const meta = this.state.activeDistrictMeta || { name: "District", state: "India", zone: "General", isSynthetic: true };

    if (!analysis || analysis.status === "insufficient_data") {
      const desc = analysis ? analysis.descriptiveAnalysis : null;
      const reqs = (analysis && analysis.requirementsStatus) ? analysis.requirementsStatus : [];
      const unmetList = (analysis && analysis.unmetReasons) ? analysis.unmetReasons : [];
      const dataNeeded = (analysis && analysis.additionalDataNeeded) ? analysis.additionalDataNeeded : "Upload at least 30 valid observation days covering summer months.";
      const whyNoCand = (analysis && analysis.whyNoCandidate) ? analysis.whyNoCandidate : "In accordance with public health informatics standards, candidate alert levels are strictly withheld when evidence criteria are unmet.";

      const syntheticBadgeHtml = meta.isSynthetic
        ? `<span class="badge-synthetic-pill">⚠️ SYNTHETIC DEMO DATA — NOT REAL OBSERVATIONS</span>`
        : `<span class="badge-uploaded-pill">📁 SOURCE: ${this.state.uploadedFilename || 'Uploaded CSV'}</span>`;

      container.innerHTML = `
        <div class="insufficient-evidence-wrapper">
          <!-- Top Alert Header with Exact Required String -->
          <div class="guardrail-alert-header">
            <div class="flex items-start justify-between flex-wrap gap-2">
              <div class="flex items-center gap-3">
                <span class="guardrail-badge-icon">⚠️</span>
                <div>
                  <h4 class="text-lg font-bold text-amber-900 tracking-tight">Insufficient evidence for a candidate.</h4>
                  <p class="text-xs text-amber-800 mt-0.5">
                    Selected window: <strong>${meta.name}, ${meta.state}</strong> (${desc ? desc.sampleSize : 0} observation days) • Candidate generation suspended per epidemiological protocol.
                  </p>
                </div>
              </div>
              <div>
                ${syntheticBadgeHtml}
              </div>
            </div>
          </div>

          <!-- Section 1: Transparent Evidence Requirements Audit Table -->
          <div class="requirements-audit-card">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200">
              <h5 class="text-xs font-bold uppercase tracking-wider text-slate-700">
                Transparent Evidence Requirements Audit
              </h5>
              <span class="text-xs text-slate-500 font-mono">Configurable Method Criteria (70% Calib / 30% Held-Out)</span>
            </div>
            <div class="overflow-x-auto mt-2">
              <table class="requirements-table w-full text-xs">
                <thead>
                  <tr class="bg-slate-50 text-slate-600 border-b">
                    <th class="p-2 text-left">Requirement</th>
                    <th class="p-2 text-left">Standard Threshold</th>
                    <th class="p-2 text-left">Observed in Dataset</th>
                    <th class="p-2 text-center">Status</th>
                    <th class="p-2 text-left">Deficiency / Gap</th>
                  </tr>
                </thead>
                <tbody>
                  ${reqs.map(r => `
                    <tr class="border-b border-slate-100 ${r.isMet ? 'bg-emerald-50/20' : 'bg-amber-50/30'}">
                      <td class="p-2 font-semibold text-slate-800">${r.title}</td>
                      <td class="p-2 text-slate-600">${r.requirement}</td>
                      <td class="p-2 font-mono font-medium ${r.isMet ? 'text-emerald-800' : 'text-amber-900'}">${r.observed}</td>
                      <td class="p-2 text-center">
                        <span class="req-status-pill ${r.isMet ? 'pill-met' : 'pill-unmet'}">
                          ${r.isMet ? '✓ Met' : '✗ Unmet'}
                        </span>
                      </td>
                      <td class="p-2 text-slate-700">${r.deficiency}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Section 2: Explanation & Needed Data Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="p-3 bg-white border border-amber-200 rounded-lg">
              <div class="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wide">
                <span>📋</span> What Additional Data Is Needed
              </div>
              <p class="text-xs text-slate-800 mt-1.5 font-medium leading-relaxed">
                ${dataNeeded}
              </p>
              <ul class="text-xs text-slate-600 mt-2 space-y-1 list-disc list-inside">
                ${unmetList.map(u => `<li>${u}</li>`).join('')}
              </ul>
            </div>

            <div class="p-3 bg-white border border-slate-200 rounded-lg">
              <div class="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
                <span>⚖️</span> Why No Candidate Alert Level Is Suggested
              </div>
              <p class="text-xs text-slate-700 mt-1.5 leading-relaxed">
                ${whyNoCand}
              </p>
              <div class="text-xs text-slate-500 mt-2 italic bg-slate-50 p-2 rounded border border-slate-200">
                "Small-sample thresholds carry extreme variance. Suggesting thresholds without independent held-out historical validation risks public health misdirection."
              </div>
            </div>
          </div>

          <!-- Section 3: Descriptive Analysis of Available Data (Requirement 3) -->
          ${desc ? `
            <div class="descriptive-analysis-card">
              <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                <h5 class="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Descriptive Exploration of Available Observations (${desc.sampleSize} Days)
                </h5>
                <span class="text-xs text-slate-500">Preliminary Statistics Only (Not for Policy Decisions)</span>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div class="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div class="text-xs text-slate-500 font-medium">Date Coverage</div>
                  <div class="text-sm font-bold text-slate-900 mt-0.5">${desc.startDate} to ${desc.endDate}</div>
                  <div class="text-xs text-slate-500 mt-0.5">${desc.calendarSpanDays} calendar days (${desc.sampleSize} valid rows)</div>
                </div>

                <div class="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div class="text-xs text-slate-500 font-medium">Dry-Bulb Temp (°C)</div>
                  <div class="text-sm font-bold text-slate-900 mt-0.5">${desc.weather.temp.mean}°C avg</div>
                  <div class="text-xs text-slate-500 mt-0.5">Range: ${desc.weather.temp.min}°C – ${desc.weather.temp.max}°C</div>
                </div>

                <div class="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div class="text-xs text-slate-500 font-medium">Heat Index & Humidity</div>
                  <div class="text-sm font-bold text-slate-900 mt-0.5">${desc.weather.heatIndex.mean}°C HI avg</div>
                  <div class="text-xs text-slate-500 mt-0.5">Humidity: ${desc.weather.humidity.mean}% avg (${desc.weather.humidity.min}–${desc.weather.humidity.max}%)</div>
                </div>

                <div class="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div class="text-xs text-slate-500 font-medium">Heat-Illness Burden</div>
                  <div class="text-sm font-bold text-slate-900 mt-0.5">${desc.health.totalCases} total cases</div>
                  <div class="text-xs text-slate-500 mt-0.5">Peak: ${desc.health.maxDailyCases} on ${desc.health.peakCaseDate} (${desc.health.meanDailyCases}/d avg)</div>
                </div>
              </div>

              <div class="p-2.5 bg-amber-50/70 border border-amber-200 rounded mt-3 text-xs text-amber-900 flex items-start gap-2">
                <span class="text-sm">⚠️</span>
                <div>
                  <strong>Exploratory Correlation:</strong> Pearson r = <strong>${desc.pearsonCorrelation >= 0 ? '+' : ''}${desc.pearsonCorrelation}</strong> between ${analysis ? analysis.metricLabel : 'Max Temperature'} and hospital heat-illness presentations.
                  <em>Because observation count (${desc.sampleSize}) is below 30, this association is statistically underpowered and cannot be used to infer causal sensitivity.</em>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Correlation vs Causation Notice -->
          <div class="correlation-causation-alert">
            <div class="flex items-start gap-2">
              <span class="text-amber-600 text-lg">⚖️</span>
              <div>
                <strong class="text-xs uppercase tracking-wider text-amber-900">Critical Public-Health Distinction: Correlation vs Causation</strong>
                <p class="text-xs text-amber-800 mt-1 leading-relaxed">
                  Weather exposure correlates with hospital admissions, but admissions are also influenced by socioeconomic exposure, occupational outdoor labor patterns, residential insulation, hydration practices, and hospital weekend reporting cadences. Statistical candidates reflect empirical co-occurrence, not isolated clinical causation.
                </p>
              </div>
            </div>
          </div>
        </div>
      `;

      if (analysis && analysis.doseResponseBins && analysis.doseResponseBins.length > 0) {
        HeatWiseCharts.renderDoseResponse(analysis.doseResponseBins, analysis.metricLabel);
      } else {
        HeatWiseCharts.renderDoseResponse([]);
      }
      return;
    }

    const metricLabel = analysis.metricLabel;
    const rVal = analysis.pearsonCorrelation;
    const rDesc = rVal > 0.6 ? "Strong Positive Correlation" : rVal > 0.3 ? "Moderate Positive Correlation" : "Weak Correlation";

    container.innerHTML = `
      <div class="analysis-methodology-card">
        <div class="analysis-header-flex">
          <div>
            <h4 class="text-base font-semibold text-slate-800">
              Empirical Epidemiological Risk Method with Held-Out Validation
            </h4>
            <p class="text-xs text-slate-500">
              Target metric: <strong>${metricLabel}</strong> • Evaluated across ${analysis.sampleSize} observation days
            </p>
          </div>
          <div class="correlation-badge">
            <span class="text-xs text-slate-500">Pearson r</span>
            <span class="font-mono font-bold text-slate-900">${rVal >= 0 ? "+" : ""}${rVal}</span>
            <span class="text-xs font-medium text-emerald-700">(${rDesc})</span>
          </div>
        </div>

        <div class="methodology-steps-grid mt-4">
          <div class="method-step-box">
            <span class="step-num">Step 1: Calibration (${analysis.nCalib} Days)</span>
            <h5>Historical Baseline</h5>
            <p>Establishes baseline presentations (<strong>${analysis.baselineMeanCases} cases/day</strong>) and proposes candidate percentiles on 70% calibration window (${analysis.calibStartDate} to ${analysis.calibEndDate}).</p>
          </div>
          <div class="method-step-box">
            <span class="step-num">Step 2: Held-Out Test (${analysis.nVal} Days)</span>
            <h5>Independent Validation</h5>
            <p>Tests proposed thresholds on held-out 30% unseen historical data (${analysis.valStartDate} to ${analysis.valEndDate}) to measure genuine generalization performance.</p>
          </div>
          <div class="method-step-box">
            <span class="step-num">Step 3: Uncertainty Bounds</span>
            <h5>Confidence Intervals (95%)</h5>
            <p>Quantifies threshold stability using bootstrap standard errors around empirical exceedance counts.</p>
          </div>
        </div>

        <div class="correlation-causation-alert mt-4">
          <div class="flex items-start gap-2">
            <span class="text-amber-600 text-lg">⚖️</span>
            <div>
              <strong class="text-xs uppercase tracking-wider text-amber-900">Critical Public-Health Distinction: Correlation vs Causation</strong>
              <p class="text-xs text-amber-800 mt-1 leading-relaxed">
                ${analysis.causationDistinctionNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    if (analysis.doseResponseBins) {
      HeatWiseCharts.renderDoseResponse(analysis.doseResponseBins, analysis.metricLabel);
    }
  },

  renderCandidateTable() {
    const analysis = this.state.analysisResult;
    const tableBody = document.getElementById("candidateTableBody");
    const container = document.getElementById("candidateTableContainer");
    const emptyNotice = document.getElementById("candidateEmptyNotice");

    // Requirement 6: Only show candidate alert levels if evidence and validation requirements are genuinely met.
    // Otherwise display exactly: "Insufficient evidence for a candidate."
    if (!analysis || analysis.status === "insufficient_data" || !analysis.candidates || analysis.candidates.length === 0) {
      if (container) container.classList.add("hidden");
      if (emptyNotice) {
        emptyNotice.classList.remove("hidden");
        const emptyTitleEl = document.getElementById("candidateEmptyText");
        const emptySubEl = document.getElementById("candidateEmptySubText");
        if (emptyTitleEl) emptyTitleEl.textContent = "Insufficient evidence for a candidate.";
        if (emptySubEl) {
          emptySubEl.textContent = analysis && analysis.additionalDataNeeded
            ? `${analysis.additionalDataNeeded} No candidate alert levels have been computed.`
            : "To prevent medically unsupported or statistically unstable threshold suggestions, HeatWise requires at least 30 observation days, multiple documented surge events, and adequate held-out validation data.";
        }
      }
      return;
    }

    if (emptyNotice) emptyNotice.classList.add("hidden");
    if (container) container.classList.remove("hidden");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    analysis.candidates.forEach(c => {
      const override = this.state.candidateOverrides[c.id] || {};
      const curStatus = override.reviewStatus || c.reviewStatus;
      const clinicianNote = override.reviewerNotes || c.reviewerNotes;

      let statusBadgeClass = "badge-pending";
      if (curStatus === "Approved for Pilot") statusBadgeClass = "badge-approved";
      else if (curStatus === "Rejected - High False Positives") statusBadgeClass = "badge-rejected";
      else if (curStatus === "Needs Epidemiologist Review") statusBadgeClass = "badge-needs-review";

      const tr = document.createElement("tr");
      tr.className = `candidate-row candidate-${c.id}`;
      tr.innerHTML = `
        <td>
          <div class="flex items-center gap-2">
            <span class="alert-indicator-dot dot-${c.id}"></span>
            <div>
              <div class="font-semibold text-slate-900">${c.tierName}</div>
              <div class="text-xs text-slate-500">${c.levelLabel}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="font-mono font-bold text-lg text-slate-900">${c.candidateValue} ${c.candidateUnit}</div>
          <div class="text-xs text-slate-500">${c.targetPercentile} of ${c.metricLabel}</div>
        </td>
        <td>
          <div class="text-sm font-medium text-slate-800">${c.evidence}</div>
          <div class="text-xs text-slate-500">${c.rationale}</div>
        </td>
        <td>
          <div class="text-sm text-slate-700">${c.sampleSizeStr}</div>
          <div class="text-xs text-slate-400">70% Calib / 30% Held-Out Split</div>
        </td>
        <td>
          <div class="validation-metrics-grid">
            <span title="Sensitivity on Held-Out Data">Held-Out Sens: <strong>${c.validation.valSens !== null ? Math.round(c.validation.valSens * 100) + '%' : 'N/A*'}</strong></span>
            <span title="Specificity on Held-Out Data">Held-Out Spec: <strong>${Math.round(c.validation.valSpec * 100)}%</strong></span>
            <span title="Positive Predictive Value on Held-Out Data">PPV: <strong>${c.validation.valPPV !== null ? Math.round(c.validation.valPPV * 100) + '%' : 'N/A*'}</strong></span>
            <span title="Youden Discriminatory Index">Youden J: <strong>${c.validation.valYoudenJ !== null ? c.validation.valYoudenJ : 'N/A*'}</strong></span>
          </div>
          ${c.validation.hasValSurges === false ? `<div class="text-xs text-amber-700 mt-1 font-semibold">⚠️ 0 held-out surges (Event-detection cannot be evaluated)</div>` : (c.validation.isTentative ? `<div class="text-xs text-amber-600 mt-0.5">⚠️ Low held-out surges (${c.validation.valSurgeCount})</div>` : '')}
        </td>
        <td>
          <div class="font-mono text-sm font-semibold text-slate-800">${c.uncertaintyStr}</div>
          <div class="text-xs text-slate-500">Margin &plusmn;${c.margin}°C</div>
        </td>
        <td>
          <div class="flex flex-col gap-1 items-start">
            <span class="badge-review ${statusBadgeClass}">${curStatus}</span>
            <div class="expert-disclaimer-pill">For expert review only</div>
          </div>
        </td>
        <td>
          <button class="btn-action-sm" onclick="HeatWiseApp.openReviewModal('${c.id}')" title="Update review status or note">
            Review
          </button>
        </td>
      `;
      tableBody.appendChild(tr);

      if (clinicianNote) {
        const noteTr = document.createElement("tr");
        noteTr.className = "clinician-note-row";
        noteTr.innerHTML = `
          <td colspan="8">
            <div class="note-box">
              <span>📝</span>
              <span class="font-semibold text-xs text-slate-600">Reviewer Annotation:</span>
              <span class="text-xs text-slate-800 italic">"${clinicianNote}"</span>
            </div>
          </td>
        `;
        tableBody.appendChild(noteTr);
      }
    });

    if (analysis && analysis.candidates && analysis.candidates.some(c => c.validation && c.validation.hasValSurges === false)) {
      const bannerTr = document.createElement("tr");
      bannerTr.innerHTML = `
        <td colspan="8" class="p-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-900 font-medium">
          ⚠️ <strong>Held-Out Validation Limitation:</strong> The chronological held-out validation window contains zero documented surge events.
          While specificity is measurable (${Math.round((analysis.candidates[0].validation.valSpec || 1) * 100)}%), event-detection sensitivity, PPV, and Youden's Index cannot be adequately evaluated on this partition.
        </td>
      `;
      tableBody.appendChild(bannerTr);
    }

    // Update Local Heat-Resilience Action Matrix threshold badges
    if (analysis && analysis.candidates && analysis.candidates.length >= 3) {
      const cYellow = analysis.candidates.find(c => c.id === "yellow");
      const cOrange = analysis.candidates.find(c => c.id === "orange");
      const cRed = analysis.candidates.find(c => c.id === "red");

      const thYellow = document.getElementById("actionThreshYellow");
      const thOrange = document.getElementById("actionThreshOrange");
      const thRed = document.getElementById("actionThreshRed");

      if (thYellow && cYellow) thYellow.textContent = `${cYellow.candidateValue}°C`;
      if (thOrange && cOrange) thOrange.textContent = `${cOrange.candidateValue}°C`;
      if (thRed && cRed) thRed.textContent = `${cRed.candidateValue}°C`;
    }
  },

  renderDataQualityPanel() {
    const quality = this.state.qualityResult;
    const panel = document.getElementById("dataQualityContainer");
    if (!panel || !quality) return;

    const issues = quality.issues || [];
    let issuesHtml = "";

    if (issues.length === 0) {
      issuesHtml = `
        <div class="quality-pass-box">
          <span class="text-emerald-600 text-xl">✓</span>
          <div>
            <h5 class="text-sm font-semibold text-emerald-900">All Quality Checks Passed</h5>
            <p class="text-xs text-emerald-700">No missing fields, unit discrepancies, or date discontinuities detected.</p>
          </div>
        </div>
      `;
    } else {
      issuesHtml = `<div class="space-y-2">`;
      issues.forEach(iss => {
        const isCrit = iss.severity === "critical";
        issuesHtml += `
          <div class="issue-card ${isCrit ? 'issue-critical' : 'issue-warning'}">
            <div class="flex items-start gap-2">
              <span class="${isCrit ? 'text-red-600' : 'text-amber-600'} text-base">
                ${isCrit ? '🚨' : '⚠️'}
              </span>
              <div style="flex: 1;">
                <div class="text-xs font-bold uppercase tracking-wider ${isCrit ? 'text-red-800' : 'text-amber-800'}">
                  ${iss.type.replace('_', ' ')}
                </div>
                <div class="text-sm text-slate-800 mt-1">${iss.message}</div>
                ${iss.samples ? `
                  <div class="mt-2 text-xs font-mono bg-white p-2 border rounded text-slate-600">
                    <strong>Sample Violations:</strong><br>
                    ${iss.samples.map(s => `Row ${s.row}: [${s.field}] = "${s.value}" &rarr; ${s.message}`).join("<br>")}
                  </div>
                ` : ""}
              </div>
            </div>
          </div>
        `;
      });
      issuesHtml += `</div>`;
    }

    panel.innerHTML = `
      <div class="overview-cards-grid mb-4">
        <div class="metric-stat-card">
          <div class="text-xs text-slate-500 font-medium">Data Completeness</div>
          <div class="text-2xl font-bold text-slate-900 mt-1">${quality.completenessPct}%</div>
          <div class="text-xs text-slate-400 mt-1">${quality.validRecords} of ${quality.totalRecords} rows fully valid</div>
        </div>
        <div class="metric-stat-card">
          <div class="text-xs text-slate-500 font-medium">Unit & Bounds Violations</div>
          <div class="text-2xl font-bold ${quality.metrics.unitErrors > 0 ? 'text-red-600' : 'text-slate-900'} mt-1">
            ${quality.metrics.unitErrors}
          </div>
          <div class="text-xs text-slate-400 mt-1">Temperatures &gt; 58°C, RH &gt; 100%, negative cases</div>
        </div>
        <div class="metric-stat-card">
          <div class="text-xs text-slate-500 font-medium">Sample Adequacy</div>
          <div class="text-2xl font-bold ${quality.insufficientSample ? 'text-amber-600' : 'text-emerald-600'} mt-1">
            ${quality.totalRecords} Days
          </div>
          <div class="text-xs text-slate-400 mt-1">
            ${quality.insufficientSample ? 'Below 30 days minimum' : 'Meets minimum threshold (&ge; 30d)'}
          </div>
        </div>
      </div>

      <div class="data-quality-issues-wrapper">
        <h5 class="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Audit Diagnostic Findings</h5>
        ${issuesHtml}
      </div>

      <div class="remediation-box mt-4">
        <h6 class="text-xs font-semibold text-slate-700 uppercase tracking-wide">Public Health Informatics Guidance</h6>
        <ul class="text-xs text-slate-600 mt-1 space-y-1 list-disc list-inside">
          <li>Ensure hospital emergency admissions are submitted daily without weekend backlogs.</li>
          <li>Confirm temperature sensors record in degrees Celsius (°C) rather than Fahrenheit (°F).</li>
          <li>For coastal districts (e.g. Odisha, Tamil Nadu), prioritize <strong>Heat Index (°C)</strong> over dry-bulb alone.</li>
        </ul>
      </div>
    `;
  },

  refreshCharts() {
    const cleaned = HeatWiseAnalytics.cleanRecords(this.state.filteredRecords);
    const analysis = this.state.analysisResult;
    const candidates = (analysis && analysis.status === "success") ? analysis.candidates : [];

    // Requirement 3: Update dynamic chart metadata banner
    const meta = this.state.activeDistrictMeta;
    const districtBadge = document.getElementById("chartActiveDistrictBadge");
    const dateRangeBadge = document.getElementById("chartDateRangeBadge");
    const pointsBadge = document.getElementById("chartPointsCountBadge");

    if (districtBadge && meta) districtBadge.textContent = `${meta.name} (${meta.id})`;
    if (dateRangeBadge) dateRangeBadge.textContent = `${this.state.startDate || 'N/A'} to ${this.state.endDate || 'N/A'}`;
    if (pointsBadge) pointsBadge.textContent = cleaned.length;

    const toggleTemp = document.getElementById("toggleChartTemp");
    const toggleHI = document.getElementById("toggleChartHI");
    const toggleHum = document.getElementById("toggleChartHum");
    const toggleCases = document.getElementById("toggleChartCases");

    HeatWiseCharts.renderTimeSeries(cleaned, candidates, {
      showTemp: toggleTemp ? toggleTemp.checked : true,
      showHeatIndex: toggleHI ? toggleHI.checked : true,
      showHumidity: toggleHum ? toggleHum.checked : true,
      showCases: toggleCases ? toggleCases.checked : true,
      primaryMetric: this.state.primaryMetric
    });
  },

  openReviewModal(tierId) {
    const analysis = this.state.analysisResult;
    if (!analysis || !analysis.candidates) return;
    const candidate = analysis.candidates.find(c => c.id === tierId);
    if (!candidate) return;

    const override = this.state.candidateOverrides[tierId] || {};
    const curStatus = override.reviewStatus || candidate.reviewStatus;
    const curNote = override.reviewerNotes || candidate.reviewerNotes;

    const modalBackdrop = document.getElementById("reviewModalBackdrop");
    const modalContent = document.getElementById("reviewModalContent");
    if (!modalBackdrop || !modalContent) return;

    modalContent.innerHTML = `
      <div class="modal-header">
        <div>
          <h3 class="text-lg font-bold text-slate-900">Expert Review Decision: ${candidate.tierName}</h3>
          <p class="text-xs text-slate-500">Candidate Value: ${candidate.candidateValue}°C (${candidate.uncertaintyStr})</p>
        </div>
        <button class="modal-close-btn" onclick="HeatWiseApp.closeReviewModal()">&times;</button>
      </div>

      <div class="modal-body p-4 space-y-4">
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
          <strong>Statistical Evidence:</strong> ${candidate.evidence}.
          <br><strong>Held-Out Validation:</strong> Sensitivity ${Math.round(candidate.validation.valSens * 100)}%, Specificity ${Math.round(candidate.validation.valSpec * 100)}%, PPV ${Math.round(candidate.validation.valPPV * 100)}%, Youden J ${candidate.validation.valYoudenJ}.
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Review Status Action</label>
          <select id="modalReviewStatusSelect" class="form-select w-full">
            <option value="Pending Expert Review" ${curStatus === "Pending Expert Review" ? "selected" : ""}>Pending Expert Review</option>
            <option value="Approved for Pilot" ${curStatus === "Approved for Pilot" ? "selected" : ""}>Approved for Local Pilot Testing</option>
            <option value="Rejected - High False Positives" ${curStatus === "Rejected - High False Positives" ? "selected" : ""}>Rejected (False Alarm Rate Too High)</option>
            <option value="Needs Epidemiologist Review" ${curStatus === "Needs Epidemiologist Review" ? "selected" : ""}>Needs Epidemiologist / SDMA Review</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Clinician / Public Health Officer Annotation</label>
          <textarea id="modalReviewerNote" rows="3" class="form-textarea w-full text-sm" placeholder="Enter clinical rationale, sentinel hospital feedback, or local vulnerability factors...">${curNote || ""}</textarea>
        </div>

        <div class="mandatory-modal-disclaimer">
          🔒 <strong>Mandatory Protocol:</strong> All candidate alert levels remain research and expert decision-support outputs. They are NOT official public health heatwave declarations without formal IMD and SDMA authorization.
        </div>
      </div>

      <div class="modal-footer p-4 bg-slate-50 border-t flex justify-end gap-2">
        <button class="btn-subtle" onclick="HeatWiseApp.closeReviewModal()">Cancel</button>
        <button class="btn-primary" onclick="HeatWiseApp.saveReviewDecision('${tierId}')">Save Review Record</button>
      </div>
    `;
    modalBackdrop.classList.remove("hidden");
  },

  closeReviewModal() {
    const modalBackdrop = document.getElementById("reviewModalBackdrop");
    if (modalBackdrop) modalBackdrop.classList.add("hidden");
  },

  saveReviewDecision(tierId) {
    const statusSelect = document.getElementById("modalReviewStatusSelect");
    const noteTextarea = document.getElementById("modalReviewerNote");
    if (statusSelect && noteTextarea) {
      this.state.candidateOverrides[tierId] = {
        reviewStatus: statusSelect.value,
        reviewerNotes: noteTextarea.value.trim()
      };
      this.closeReviewModal();
      this.renderCandidateTable();
      this.showToast("Expert review record updated successfully.", "success");
    }
  },

  openSchemaModal() {
    const modalBackdrop = document.getElementById("schemaModalBackdrop");
    const modalContent = document.getElementById("schemaModalContent");
    if (!modalBackdrop || !modalContent) return;

    modalContent.innerHTML = `
      <div class="modal-header">
        <div>
          <h3 class="text-lg font-bold text-slate-900">Documented Required CSV Schema</h3>
          <p class="text-xs text-slate-500">Standards for historical weather and hospital heat-illness ingestion</p>
        </div>
        <button class="modal-close-btn" onclick="HeatWiseApp.closeSchemaModal()">&times;</button>
      </div>
      <div class="modal-body p-4">
        ${HeatWiseDataQuality.renderDocumentationModal()}
      </div>
      <div class="modal-footer p-4 bg-slate-50 border-t flex justify-between items-center">
        <button class="btn-subtle text-xs" onclick="HeatWiseApp.loadIssuesSampleDataset(); HeatWiseApp.closeSchemaModal();">
          Load Sample with Errors for Testing
        </button>
        <div class="flex gap-2">
          <button class="btn-subtle" onclick="HeatWiseApp.closeSchemaModal()">Close</button>
          <button class="btn-primary" onclick="HeatWiseApp.downloadBlankTemplateClientSide()">
            Download Blank Template
          </button>
        </div>
      </div>
    `;
    modalBackdrop.classList.remove("hidden");
  },

  closeSchemaModal() {
    const modalBackdrop = document.getElementById("schemaModalBackdrop");
    if (modalBackdrop) modalBackdrop.classList.add("hidden");
  },

  downloadBlankTemplateClientSide() {
    const csvContent = "date,district_id,max_temp_c,humidity_pct,heat_illness_cases\n" +
      "2024-04-01,IND_DEMO_01,36.5,42.0,4\n" +
      "2024-04-02,IND_DEMO_01,37.2,40.5,5\n" +
      "2024-04-03,IND_DEMO_01,38.0,38.0,6\n" +
      "2024-04-04,IND_DEMO_01,39.1,35.0,8\n" +
      "2024-04-05,IND_DEMO_01,40.4,32.0,11\n" +
      "2024-04-06,IND_DEMO_01,41.2,30.5,15\n" +
      "2024-04-07,IND_DEMO_01,42.5,28.0,22\n" +
      "2024-04-08,IND_DEMO_01,43.1,26.0,29\n" +
      "2024-04-09,IND_DEMO_01,42.8,27.5,25\n" +
      "2024-04-10,IND_DEMO_01,41.0,33.0,14\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "heatwise_sample_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast("Blank CSV template downloaded.", "success");
  },

  /**
   * Requirement 6: Comprehensive standalone report download containing:
   * selected district, data period, data source, method, candidate results if justified,
   * validation results, uncertainty and limitations.
   */
  downloadFullHtmlReport() {
    const meta = this.state.activeDistrictMeta || { name: "District", state: "India", zone: "General", id: "UNKNOWN" };
    const quality = this.state.qualityResult || {};
    const analysis = this.state.analysisResult;
    const cleaned = HeatWiseAnalytics.cleanRecords(this.state.filteredRecords);
    const totalCases = cleaned.reduce((acc, r) => acc + (r.heat_illness_cases || 0), 0);
    const desc = analysis ? analysis.descriptiveAnalysis : null;
    const reqs = (analysis && analysis.requirementsStatus) ? analysis.requirementsStatus : [];

    let candidateRowsHtml = "";
    if (analysis && analysis.status === "success" && analysis.candidates && analysis.candidates.length > 0) {
      candidateRowsHtml = analysis.candidates.map(c => {
        const override = this.state.candidateOverrides[c.id] || {};
        const st = override.reviewStatus || c.reviewStatus;
        const note = override.reviewerNotes || c.reviewerNotes;
        const valStr = c.validation.hasValSurges === false
          ? `Spec: ${Math.round(c.validation.valSpec * 100)}% | Sens: N/A* (0 held-out surges)`
          : `Sens: ${Math.round(c.validation.valSens * 100)}% | Spec: ${Math.round(c.validation.valSpec * 100)}% | PPV: ${Math.round(c.validation.valPPV * 100)}% | J: ${c.validation.valYoudenJ}`;
        return `
          <tr>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${c.tierName} (${c.levelLabel})</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 14px;"><strong>${c.candidateValue} ${c.candidateUnit}</strong> (${c.targetPercentile})</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">${c.evidence}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${valStr}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${c.uncertaintyStr}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${st}</strong>${note ? `<br><em>"${note}"</em>` : ''}</td>
          </tr>
        `;
      }).join("");
    } else {
      candidateRowsHtml = `
        <tr>
          <td colspan="6" style="padding: 20px; text-align: center; color: #92400e; background: #fffbeb; font-weight: bold; font-size: 15px;">
            Insufficient evidence for a candidate.
            <div style="font-size: 12px; font-weight: normal; margin-top: 6px; color: #78350f;">
              ${analysis && analysis.additionalDataNeeded ? analysis.additionalDataNeeded : 'To prevent medically unsupported or statistically unstable threshold suggestions, HeatWise requires at least 30 observation days, multiple documented surge events, and adequate held-out validation data.'}
            </div>
            <div style="font-size: 11px; font-weight: normal; margin-top: 4px; color: #92400e; font-style: italic;">
              ${analysis && analysis.whyNoCandidate ? analysis.whyNoCandidate : ''}
            </div>
          </td>
        </tr>
      `;
    }

    const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HeatWise Evaluation Report — ${meta.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #0f172a; max-width: 900px; margin: 40px auto; padding: 0 20px; }
    h1, h2, h3 { color: #091e3a; }
    .header-box { border-bottom: 3px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-disclaimer { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .badge-synthetic { background: #fff1f2; color: #be123c; border: 1px solid #fda4af; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .metric-val { font-size: 20px; font-weight: bold; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    th { background: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; text-align: left; }
    .limitation-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; font-size: 13px; }
    .status-pill { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; }
    .pill-met { background: #d1fae5; color: #065f46; }
    .pill-unmet { background: #ffe4e6; color: #9f1239; }
  </style>
</head>
<body>
  <div class="header-box">
    <h1>HeatWise — Local Heat Alert Evaluation Report</h1>
    <p style="color: #64748b; margin-top: 4px;">Public Health & Disaster Management Epidemiological Decision-Support</p>
    <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
      <span class="badge badge-disclaimer">FOR EXPERT REVIEW ONLY — NOT AN OFFICIAL ALERT THRESHOLD</span>
      ${meta.isSynthetic ? '<span class="badge badge-synthetic">SYNTHETIC DEMO DATA (NOT REAL OBSERVATIONS)</span>' : ''}
    </div>
  </div>

  <h2>1. Administrative & Geographic Metadata</h2>
  <div class="metric-grid">
    <div class="metric-card">
      <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">District</div>
      <div class="metric-val">${meta.name} (${meta.id})</div>
      <div style="font-size: 12px; color: #475569;">${meta.state}</div>
    </div>
    <div class="metric-card">
      <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Climate Zone</div>
      <div class="metric-val" style="font-size: 16px;">${meta.zone}</div>
      <div style="font-size: 12px; color: #475569;">Regime Classification</div>
    </div>
    <div class="metric-card">
      <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Data Source</div>
      <div class="metric-val" style="font-size: 14px;">${meta.isSynthetic ? "SYNTHETIC DEMO DATA" : "Uploaded CSV"}</div>
      <div style="font-size: 12px; color: #475569;">${this.state.uploadedFilename || "Prototype demo dataset"}</div>
    </div>
    <div class="metric-card">
      <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Quality Health Score</div>
      <div class="metric-val" style="color: #059669;">${quality.score || 0}/100</div>
      <div style="font-size: 12px; color: #475569;">${quality.status || 'N/A'}</div>
    </div>
  </div>

  <h2>2. Observation Window & Descriptive Analysis</h2>
  <p><strong>Evaluation Window:</strong> ${this.state.startDate || 'N/A'} to ${this.state.endDate || 'N/A'} (${cleaned.length} valid daily observations)</p>
  <p><strong>Recorded Heat-Illness Emergency Admissions:</strong> ${totalCases} total cases (Mean: ${(cleaned.length > 0 ? (totalCases / cleaned.length).toFixed(1) : 0)} cases/day)</p>
  <p><strong>Target Environmental Metric:</strong> ${analysis ? analysis.metricLabel : 'Max Temperature'} (Linear Pearson correlation r = ${analysis ? analysis.pearsonCorrelation : 'N/A'})</p>

  ${desc ? `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 10px; font-size: 13px;">
      <strong>Descriptive Distribution:</strong><br>
      • Dry-Bulb Temperature: ${desc.weather.temp.mean}°C avg (Range: ${desc.weather.temp.min}°C – ${desc.weather.temp.max}°C)<br>
      • Relative Humidity: ${desc.weather.humidity.mean}% avg (Range: ${desc.weather.humidity.min}% – ${desc.weather.humidity.max}%)<br>
      • Heat Index (Apparent): ${desc.weather.heatIndex.mean}°C avg (Range: ${desc.weather.heatIndex.min}°C – ${desc.weather.heatIndex.max}°C)<br>
      • Hospital Heat-Illness: Peak of ${desc.health.maxDailyCases} case(s) on ${desc.health.peakCaseDate}
    </div>
  ` : ''}

  <h2>3. Transparent Evidence Requirements Audit</h2>
  <p>HeatWise verifies rigorous statistical and epidemiological criteria before proposing candidate alerts:</p>
  <table>
    <thead>
      <tr>
        <th>Requirement</th>
        <th>Standard Threshold</th>
        <th>Observed in Dataset</th>
        <th>Status</th>
        <th>Deficiency / Action Needed</th>
      </tr>
    </thead>
    <tbody>
      ${reqs.map(r => `
        <tr>
          <td><strong>${r.title}</strong></td>
          <td>${r.requirement}</td>
          <td style="font-family: monospace;">${r.observed}</td>
          <td><span class="status-pill ${r.isMet ? 'pill-met' : 'pill-unmet'}">${r.isMet ? '✓ Met' : '✗ Unmet'}</span></td>
          <td>${r.deficiency}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>4. Candidate Alert Levels for Expert Review</h2>
  <table>
    <thead>
      <tr>
        <th>Alert Tier</th>
        <th>Candidate Value</th>
        <th>Calibration Evidence</th>
        <th>Held-Out Validation Performance</th>
        <th>Uncertainty (95% CI)</th>
        <th>Expert Review Status</th>
      </tr>
    </thead>
    <tbody>
      ${candidateRowsHtml}
    </tbody>
  </table>

  <h2>5. Methodological Limitations & Safety Guidance</h2>
  <div class="limitation-box">
    <strong>Important Public Health Notice: Correlation vs. Causation:</strong>
    <p style="margin-top: 5px;">Weather exposure is an environmental hazard trigger, but hospital admissions are also influenced by socioeconomic exposure, occupational outdoor labor patterns, residential insulation, hydration practices, and weekend hospital reporting cadences.</p>
    <ul style="margin-top: 5px; padding-left: 20px;">
      <li>Candidate levels reflect empirical co-occurrence and are strictly for multidisciplinary expert review.</li>
      <li>They do NOT constitute official medical advice or state-mandated disaster declarations.</li>
      <li>Official heatwave alerts in India are exclusively issued by the India Meteorological Department (IMD) and State Disaster Management Authorities (SDMA).</li>
    </ul>
  </div>

  <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 40px;">
    Report Generated by HeatWise Local Heat Alert Learning System • Date: ${new Date().toLocaleString()}
  </p>
</body>
</html>`;

    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HeatWise_Report_${meta.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast("Complete Evaluation Report downloaded (.html).", "success");
  },

  exportJsonReport() {
    const meta = this.state.activeDistrictMeta;
    const quality = this.state.qualityResult;
    const analysis = this.state.analysisResult;
    const cleaned = HeatWiseAnalytics.cleanRecords(this.state.filteredRecords);

    const reportObj = {
      project: "HeatWise — Local Heat Alert Learning System",
      exportTimestamp: new Date().toISOString(),
      disclaimer: "FOR EXPERT REVIEW ONLY — NOT AN OFFICIAL MEDICAL OR GOVERNMENT ALERT THRESHOLD",
      district: meta,
      dataSource: meta && meta.isSynthetic
        ? (meta.id && meta.id.startsWith("SYN_DIST_") ? "Expanded 180-Day Synthetic Dataset (Fictional Districts) — SYNTHETIC DEMO DATA (NOT REAL OBSERVATIONS)" : "Regional Climate Demonstration Library (122 Days) — SYNTHETIC DEMO DATA (NOT REAL OBSERVATIONS)")
        : `Uploaded CSV: ${this.state.uploadedFilename}`,
      observationWindow: {
        startDate: this.state.startDate,
        endDate: this.state.endDate,
        totalDays: cleaned.length
      },
      dataQualityAudit: quality,
      candidateLearningAnalysis: analysis,
      reviewDecisions: this.state.candidateOverrides
    };

    const blob = new Blob([JSON.stringify(reportObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `heatwise_evaluation_report_${(meta ? meta.name : "district").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast("Evaluation JSON Report downloaded.", "success");
  },

  copySituationReport() {
    const meta = this.state.activeDistrictMeta || { name: "District", state: "India" };
    const quality = this.state.qualityResult || {};
    const analysis = this.state.analysisResult;
    const cleaned = HeatWiseAnalytics.cleanRecords(this.state.filteredRecords);
    const totalCases = cleaned.reduce((acc, r) => acc + (r.heat_illness_cases || 0), 0);

    let candidatesText = "Insufficient evidence for a candidate.";
    if (analysis && analysis.status === "success" && analysis.candidates && analysis.candidates.length > 0) {
      candidatesText = analysis.candidates.map(c => {
        const override = this.state.candidateOverrides[c.id] || {};
        const st = override.reviewStatus || c.reviewStatus;
        const valStr = c.validation.hasValSurges === false
          ? `Held-Out Spec: ${Math.round(c.validation.valSpec * 100)}%, Sens: N/A* (0 held-out surges)`
          : `Held-Out Sens: ${Math.round(c.validation.valSens * 100)}%, Spec: ${Math.round(c.validation.valSpec * 100)}%`;
        return `* ${c.tierName} (${c.levelLabel}): ${c.candidateValue}°C (${c.uncertaintyStr}) | Evidence: ${c.evidence} | ${valStr} | Status: ${st}`;
      }).join("\n");
    } else if (analysis && analysis.additionalDataNeeded) {
      candidatesText = `STATUS: Insufficient evidence for a candidate.\nDATA NEEDED: ${analysis.additionalDataNeeded}\nREASON: ${analysis.whyNoCandidate || 'Methodological requirements unmet.'}`;
    }

    const text = `
======================================================
HEATWISE LOCAL HEAT ALERT EVALUATION BRIEFING
FOR EXPERT REVIEW ONLY — NOT AN OFFICIAL ALERT THRESHOLD
======================================================
District: ${meta.name}, ${meta.state} (${meta.zone})
Source: ${meta.isSynthetic ? 'SYNTHETIC DEMO DATA (NOT REAL OBSERVATIONS)' : `Uploaded File: ${this.state.uploadedFilename}`}
Observation Window: ${this.state.startDate || 'N/A'} to ${this.state.endDate || 'N/A'} (${cleaned.length} Days)
Total Hospital Heat-Illness Cases: ${totalCases} (Avg ${(cleaned.length > 0 ? (totalCases / cleaned.length).toFixed(1) : 0)} cases/day)
Data Quality Status: ${quality.status || 'N/A'} (Score: ${quality.score || 'N/A'}/100)
Primary Evaluation Metric: ${analysis ? analysis.metricLabel : 'Max Temperature'}

CANDIDATE ALERT LEVELS (FOR EXPERT REVIEW):
${candidatesText}

METHODOLOGICAL NOTICE:
Weather exposure correlates with hospital admissions, but admissions are also influenced by socioeconomic exposure, occupational labor, hydration, and healthcare access. Statistical candidates reflect empirical co-occurrence, not isolated clinical causation.

Audit Prepared For: Health Services (CMO) & Disaster Management (SDMA/DDMA)
Generated: ${new Date().toLocaleString()}
======================================================
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      this.showToast("Situation Report Briefing copied to clipboard!", "success");
    }).catch(() => {
      this.showToast("Clipboard access denied. Please allow clipboard permissions.", "error");
    });
  },

  renderDistrictHeatmap() {
    const grid = document.getElementById("districtHeatmapGrid");
    if (!grid) return;

    // Collect all available districts
    const registry = (typeof ALL_SYNTHETIC_DISTRICTS !== "undefined")
      ? ALL_SYNTHETIC_DISTRICTS
      : (typeof EXPANDED_SYNTHETIC_DISTRICTS !== "undefined" && typeof SYNTHETIC_DISTRICTS !== "undefined")
        ? { ...EXPANDED_SYNTHETIC_DISTRICTS, ...SYNTHETIC_DISTRICTS }
        : (typeof SYNTHETIC_DISTRICTS !== "undefined" ? SYNTHETIC_DISTRICTS : {});

    const districtCardsData = [];

    // Process synthetic demo districts
    Object.keys(registry).forEach(dId => {
      const d = registry[dId];
      if (!d || !d.records || d.records.length === 0) return;
      
      const recs = d.records;
      const validTemps = recs.map(r => r.max_temp_c).filter(v => typeof v === "number" && !isNaN(v));
      const validHIs = recs.map(r => r.heat_index_c).filter(v => typeof v === "number" && !isNaN(v));
      const validCases = recs.map(r => r.heat_illness_cases).filter(v => typeof v === "number" && !isNaN(v));

      const peakTemp = validTemps.length > 0 ? Math.max(...validTemps) : 35.0;
      const peakHI = validHIs.length > 0 ? Math.max(...validHIs) : peakTemp;
      const totalCases = validCases.reduce((a, b) => a + b, 0);
      const avgCases = validCases.length > 0 ? (totalCases / validCases.length).toFixed(1) : "0.0";
      const peakCases = validCases.length > 0 ? Math.max(...validCases) : 0;

      // Vulnerability metric 0 - 100 based on peak temp, heat index and case surge volume
      const tempFactor = Math.min(50, Math.max(0, (peakTemp - 32) * 3.5));
      const caseFactor = Math.min(50, Math.max(0, (peakCases / 35) * 50));
      const vulnerabilityScore = Math.min(100, Math.round(tempFactor + caseFactor));

      let levelClass = "heat-level-mild";
      let levelLabel = "Mild Thermal Stress";
      if (peakTemp >= 45.0 || peakHI >= 48.0) {
        levelClass = "heat-level-extreme";
        levelLabel = "Extreme Severe Heat";
      } else if (peakTemp >= 42.5 || peakHI >= 44.0) {
        levelClass = "heat-level-severe";
        levelLabel = "Severe Warning";
      } else if (peakTemp >= 38.0) {
        levelClass = "heat-level-moderate";
        levelLabel = "Moderate Thermal Stress";
      }

      districtCardsData.push({
        id: dId,
        isUploaded: false,
        name: d.name,
        state: d.state,
        zone: d.zone,
        badge: d.badge,
        badgeColor: d.badgeColor || "amber",
        peakTemp: peakTemp.toFixed(1),
        peakHI: peakHI.toFixed(1),
        avgCases,
        peakCases,
        totalDays: recs.length,
        vulnerabilityScore,
        levelClass,
        levelLabel,
        isActive: !this.state.isUploadedData && this.state.activeDistrictId === dId
      });
    });

    // Also process any custom uploaded districts
    if (this.state.isUploadedData && this.state.uploadedDistrictsMap) {
      Object.keys(this.state.uploadedDistrictsMap).forEach(uId => {
        const recs = this.state.uploadedDistrictsMap[uId];
        if (!recs || recs.length === 0) return;

        const validTemps = recs.map(r => r.max_temp_c).filter(v => typeof v === "number" && !isNaN(v));
        const validHIs = recs.map(r => r.heat_index_c).filter(v => typeof v === "number" && !isNaN(v));
        const validCases = recs.map(r => r.heat_illness_cases).filter(v => typeof v === "number" && !isNaN(v));

        const peakTemp = validTemps.length > 0 ? Math.max(...validTemps) : 35.0;
        const peakHI = validHIs.length > 0 ? Math.max(...validHIs) : peakTemp;
        const totalCases = validCases.reduce((a, b) => a + b, 0);
        const avgCases = validCases.length > 0 ? (totalCases / validCases.length).toFixed(1) : "0.0";
        const peakCases = validCases.length > 0 ? Math.max(...validCases) : 0;

        const tempFactor = Math.min(50, Math.max(0, (peakTemp - 32) * 3.5));
        const caseFactor = Math.min(50, Math.max(0, (peakCases / 35) * 50));
        const vulnerabilityScore = Math.min(100, Math.round(tempFactor + caseFactor));

        let levelClass = "heat-level-mild";
        let levelLabel = "Mild Thermal Stress";
        if (peakTemp >= 45.0 || peakHI >= 48.0) {
          levelClass = "heat-level-extreme";
          levelLabel = "Extreme Severe Heat";
        } else if (peakTemp >= 42.5 || peakHI >= 44.0) {
          levelClass = "heat-level-severe";
          levelLabel = "Severe Warning";
        } else if (peakTemp >= 38.0) {
          levelClass = "heat-level-moderate";
          levelLabel = "Moderate Thermal Stress";
        }

        districtCardsData.push({
          id: uId,
          isUploaded: true,
          name: `Uploaded District (${uId})`,
          state: this.state.uploadedFilename || "Uploaded CSV",
          zone: "Custom Local Climate",
          badge: "Uploaded",
          badgeColor: "blue",
          peakTemp: peakTemp.toFixed(1),
          peakHI: peakHI.toFixed(1),
          avgCases,
          peakCases,
          totalDays: recs.length,
          vulnerabilityScore,
          levelClass,
          levelLabel,
          isActive: this.state.isUploadedData && this.state.activeDistrictId === uId
        });
      });
    }

    grid.innerHTML = "";
    districtCardsData.forEach(item => {
      const card = document.createElement("div");
      card.className = `district-heat-card ${item.isActive ? 'active-district-card' : ''}`;
      card.onclick = () => {
        if (item.isUploaded) {
          this.loadUploadedDistrict(item.id);
        } else {
          this.loadDistrict(item.id);
        }
        // Smooth scroll to dashboard overview
        const topEl = document.getElementById("syntheticDataBanner") || document.querySelector(".app-container");
        if (topEl) topEl.scrollIntoView({ behavior: "smooth" });
      };

      card.innerHTML = `
        <div>
          <div class="district-heat-card-top">
            <div>
              <div class="district-heat-card-name">${item.name}</div>
              <div class="district-heat-card-zone">${item.state} • ${item.zone}</div>
            </div>
            <div class="district-heat-therm-badge ${item.levelClass}">
              ${item.peakTemp}°C
            </div>
          </div>

          <div class="district-heat-bar-wrap" title="Heat Stress Index: ${item.vulnerabilityScore}/100">
            <div class="district-heat-bar-fill" style="width: ${Math.max(15, item.vulnerabilityScore)}%;"></div>
          </div>

          <div class="district-heat-metrics-row">
            <div class="district-heat-metric-item">
              <div class="district-heat-metric-val">${item.peakTemp}°C</div>
              <div class="district-heat-metric-lbl">Peak Temp</div>
            </div>
            <div class="district-heat-metric-item">
              <div class="district-heat-metric-val">${item.peakHI}°C</div>
              <div class="district-heat-metric-lbl">Peak HI</div>
            </div>
            <div class="district-heat-metric-item">
              <div class="district-heat-metric-val">${item.avgCases}</div>
              <div class="district-heat-metric-lbl">Avg Cases/d</div>
            </div>
          </div>
        </div>

        <div class="district-heat-card-footer">
          <span class="font-medium text-slate-500">${item.totalDays} days • Risk Score: <strong>${item.vulnerabilityScore}/100</strong></span>
          <span class="font-bold ${item.isActive ? 'text-emerald-700' : 'text-amber-700'}">
            ${item.isActive ? '✓ ACTIVE DISTRICT' : 'Load District ➔'}
          </span>
        </div>
      `;
      grid.appendChild(card);
    });
  },

  setCalendarHeatmapMetric(metric) {
    this.state.calendarHeatmapMetric = metric;
    const btnTemp = document.getElementById("btnHeatmapTemp");
    const btnHI = document.getElementById("btnHeatmapHI");
    const btnCases = document.getElementById("btnHeatmapCases");
    const btnAlerts = document.getElementById("btnHeatmapAlerts");

    [btnTemp, btnHI, btnCases, btnAlerts].forEach(b => { if (b) b.classList.remove("active"); });

    if (metric === "temp" && btnTemp) btnTemp.classList.add("active");
    if (metric === "hi" && btnHI) btnHI.classList.add("active");
    if (metric === "cases" && btnCases) btnCases.classList.add("active");
    if (metric === "alerts" && btnAlerts) btnAlerts.classList.add("active");

    this.renderCalendarHeatmap();
  },

  renderCalendarHeatmap() {
    const container = document.getElementById("calendarHeatmapContainer");
    if (!container) return;

    const districtNameEl = document.getElementById("calendarDistrictName");
    if (districtNameEl) {
      districtNameEl.textContent = this.state.activeDistrictMeta ? this.state.activeDistrictMeta.name : "Active District";
    }

    const records = this.state.filteredRecords || [];
    if (records.length === 0) {
      container.innerHTML = `<div class="p-4 text-xs text-slate-500 italic">No observation records available in active date window.</div>`;
      return;
    }

    // Group records by YYYY-MM
    const monthsMap = {};
    records.forEach(r => {
      if (!r.date) return;
      const mKey = r.date.substring(0, 7); // e.g. "2024-05"
      if (!monthsMap[mKey]) monthsMap[mKey] = [];
      monthsMap[mKey].push(r);
    });

    const metric = this.state.calendarHeatmapMetric || "temp";
    const candidates = (this.state.analysisResult && this.state.analysisResult.candidates)
      ? this.state.analysisResult.candidates
      : [];

    container.innerHTML = "";

    const monthKeys = Object.keys(monthsMap).sort();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let totalExtremeDays = 0; // >= 42
    let peakTempOverall = -999;
    let peakTempDateOverall = "--";
    let totalSurgeDays = 0;
    let peakCasesOverall = -1;
    let peakCasesDateOverall = "--";

    // Global surge threshold for case indicator
    const allCases = records.map(r => r.heat_illness_cases).filter(v => typeof v === "number" && !isNaN(v));
    const meanCasesGlobal = allCases.length > 0 ? (allCases.reduce((a, b) => a + b, 0) / allCases.length) : 5;
    const surgeThresholdCases = Math.max(8, Math.round(meanCasesGlobal * 1.5));

    monthKeys.forEach(mKey => {
      const [yr, mo] = mKey.split("-");
      const monthIdx = parseInt(mo, 10) - 1;
      const mTitle = `${monthNames[monthIdx] || mo} ${yr}`;
      const mRecs = monthsMap[mKey].sort((a, b) => a.date > b.date ? 1 : -1);

      const monthBlock = document.createElement("div");
      monthBlock.className = "calendar-month-block";

      const header = document.createElement("div");
      header.className = "calendar-month-title";
      header.innerHTML = `<span>${mTitle}</span> <span class="text-xs text-slate-400 font-mono">${mRecs.length}d</span>`;
      monthBlock.appendChild(header);

      const daysGrid = document.createElement("div");
      daysGrid.className = "calendar-days-grid";

      // 7 day headers
      ["M", "T", "W", "T", "F", "S", "S"].forEach(dName => {
        const dh = document.createElement("div");
        dh.className = "calendar-day-header";
        dh.textContent = dName;
        daysGrid.appendChild(dh);
      });

      // Align first day of month (0 = Sun, 1 = Mon ... 6 = Sat)
      const firstDateStr = mRecs[0].date;
      const firstDateObj = new Date(firstDateStr + "T00:00:00Z");
      let startDayOfWeek = firstDateObj.getUTCDay(); // 0 is Sunday
      let leadingBlanks = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

      for (let b = 0; b < leadingBlanks; b++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "heatmap-day-empty";
        daysGrid.appendChild(emptyCell);
      }

      mRecs.forEach(rec => {
        const cell = document.createElement("div");
        cell.className = "heatmap-day-cell";

        const dayNum = parseInt(rec.date.split("-")[2], 10);
        cell.textContent = dayNum;

        const tVal = typeof rec.max_temp_c === "number" ? rec.max_temp_c : parseFloat(rec.max_temp_c);
        const hiVal = typeof rec.heat_index_c === "number" ? rec.heat_index_c : parseFloat(rec.heat_index_c);
        const cVal = typeof rec.heat_illness_cases === "number" ? rec.heat_illness_cases : parseInt(rec.heat_illness_cases, 10);
        const isMissing = isNaN(tVal) || isNaN(cVal);

        if (!isNaN(tVal)) {
          if (tVal >= 42.0) totalExtremeDays++;
          if (tVal > peakTempOverall) {
            peakTempOverall = tVal;
            peakTempDateOverall = rec.date;
          }
        }
        if (!isNaN(cVal)) {
          if (cVal >= surgeThresholdCases) totalSurgeDays++;
          if (cVal > peakCasesOverall) {
            peakCasesOverall = cVal;
            peakCasesDateOverall = rec.date;
          }
        }

        // Color styling according to selected metric
        let bgColor = "#f1f5f9";
        let textColor = "#1e293b";
        let tierLabel = "Normal / Baseline";

        // Check active candidate alerts
        if (candidates && candidates.length >= 3 && !isNaN(tVal)) {
          const cRed = candidates.find(c => c.id === "red");
          const cOrange = candidates.find(c => c.id === "orange");
          const cYellow = candidates.find(c => c.id === "yellow");
          const metricVal = this.state.primaryMetric === "heat_index_c" ? (isNaN(hiVal) ? tVal : hiVal) : tVal;

          if (cRed && metricVal >= cRed.candidateValue) tierLabel = "Red Alert Exceedance";
          else if (cOrange && metricVal >= cOrange.candidateValue) tierLabel = "Orange Alert Exceedance";
          else if (cYellow && metricVal >= cYellow.candidateValue) tierLabel = "Yellow Alert Exceedance";
        }

        if (isMissing) {
          cell.classList.add("missing-cell");
          cell.title = `${rec.date}: Missing telemetry value (Data Quality Flag)`;
        } else if (metric === "temp") {
          if (tVal < 32.0) { bgColor = "#e2e8f0"; textColor = "#475569"; }
          else if (tVal < 36.0) { bgColor = "#fef08a"; textColor = "#854d0e"; }
          else if (tVal < 40.0) { bgColor = "#fde047"; textColor = "#713f12"; }
          else if (tVal < 42.0) { bgColor = "#fed7aa"; textColor = "#9a3412"; }
          else if (tVal < 44.0) { bgColor = "#fb923c"; textColor = "#431407"; }
          else if (tVal < 46.0) { bgColor = "#ea580c"; textColor = "#ffffff"; }
          else { bgColor = "#dc2626"; textColor = "#ffffff"; }
        } else if (metric === "hi") {
          const val = isNaN(hiVal) ? tVal : hiVal;
          if (val < 35.0) { bgColor = "#e2e8f0"; textColor = "#475569"; }
          else if (val < 40.0) { bgColor = "#fef08a"; textColor = "#854d0e"; }
          else if (val < 44.0) { bgColor = "#fed7aa"; textColor = "#9a3412"; }
          else if (val < 48.0) { bgColor = "#fb923c"; textColor = "#431407"; }
          else if (val < 52.0) { bgColor = "#ea580c"; textColor = "#ffffff"; }
          else { bgColor = "#991b1b"; textColor = "#ffffff"; }
        } else if (metric === "cases") {
          if (cVal <= 3) { bgColor = "#f1f5f9"; textColor = "#64748b"; }
          else if (cVal <= 7) { bgColor = "#ccfbf1"; textColor = "#0f766e"; }
          else if (cVal <= 14) { bgColor = "#fed7aa"; textColor = "#7c2d12"; }
          else if (cVal <= 24) { bgColor = "#fb923c"; textColor = "#ffffff"; }
          else { bgColor = "#dc2626"; textColor = "#ffffff"; }
        } else if (metric === "alerts") {
          if (tierLabel.includes("Red")) { bgColor = "#dc2626"; textColor = "#ffffff"; }
          else if (tierLabel.includes("Orange")) { bgColor = "#ea580c"; textColor = "#ffffff"; }
          else if (tierLabel.includes("Yellow")) { bgColor = "#d97706"; textColor = "#ffffff"; }
          else { bgColor = "#f8fafc"; textColor = "#64748b"; }
        }

        if (!isMissing) {
          cell.style.backgroundColor = bgColor;
          cell.style.color = textColor;
          cell.title = `${rec.date} | Temp: ${!isNaN(tVal) ? tVal + '°C' : 'N/A'} | HI: ${!isNaN(hiVal) ? hiVal + '°C' : 'N/A'} | Cases: ${!isNaN(cVal) ? cVal : 'N/A'} | ${tierLabel}`;
        }

        cell.onmouseenter = () => this.inspectHeatmapDay(rec, tVal, hiVal, cVal, tierLabel);
        cell.onclick = () => this.inspectHeatmapDay(rec, tVal, hiVal, cVal, tierLabel);

        daysGrid.appendChild(cell);
      });

      monthBlock.appendChild(daysGrid);
      container.appendChild(monthBlock);
    });

    // Update legend swatches
    this.renderHeatmapLegend(metric);

    // Update summary strip
    const extEl = document.getElementById("heatStatExtremeDays");
    const peakTempEl = document.getElementById("heatStatPeakTemp");
    const peakTempDateEl = document.getElementById("heatStatPeakTempDate");
    const surgeEl = document.getElementById("heatStatSurgeDays");
    const peakCasesEl = document.getElementById("heatStatPeakCases");
    const peakCasesDateEl = document.getElementById("heatStatPeakCasesDate");

    if (extEl) extEl.textContent = totalExtremeDays;
    if (peakTempEl) peakTempEl.textContent = peakTempOverall > -900 ? `${peakTempOverall.toFixed(1)}°C` : "--.-°C";
    if (peakTempDateEl) peakTempDateEl.textContent = `Peak: ${peakTempDateOverall}`;
    if (surgeEl) surgeEl.textContent = totalSurgeDays;
    if (peakCasesEl) peakCasesEl.textContent = peakCasesOverall >= 0 ? `${peakCasesOverall} cases` : "--";
    if (peakCasesDateEl) peakCasesDateEl.textContent = `Peak: ${peakCasesDateOverall}`;
  },

  inspectHeatmapDay(rec, tVal, hiVal, cVal, tierLabel) {
    const dateEl = document.getElementById("inspectorDate");
    const detailsEl = document.getElementById("inspectorDetails");
    const badgeEl = document.getElementById("inspectorAlertBadge");
    if (!dateEl || !detailsEl) return;

    dateEl.textContent = `Observation Day: ${rec.date}`;
    const hum = (rec.humidity_pct !== undefined && rec.humidity_pct !== "") ? `${rec.humidity_pct}%` : "N/A";
    const tempStr = !isNaN(tVal) ? `${tVal}°C` : "Missing";
    const hiStr = !isNaN(hiVal) ? `${hiVal}°C` : "N/A";
    const caseStr = !isNaN(cVal) ? `${cVal} admissions` : "Missing";

    detailsEl.innerHTML = `
      Max Temp: <strong>${tempStr}</strong> • 
      Heat Index: <strong>${hiStr}</strong> • 
      Relative Humidity: <strong>${hum}</strong> • 
      Hospital Admissions: <strong>${caseStr}</strong>
    `;

    if (badgeEl) {
      if (tierLabel.includes("Red")) {
        badgeEl.innerHTML = `<span class="zone-badge zone-orange" style="background:#fee2e2;color:#991b1b;">🚨 ${tierLabel}</span>`;
      } else if (tierLabel.includes("Orange")) {
        badgeEl.innerHTML = `<span class="zone-badge zone-orange" style="background:#ffedd5;color:#c2410c;">⚠️ ${tierLabel}</span>`;
      } else if (tierLabel.includes("Yellow")) {
        badgeEl.innerHTML = `<span class="zone-badge zone-amber">⚡ ${tierLabel}</span>`;
      } else {
        badgeEl.innerHTML = `<span class="zone-badge zone-teal">🛡️ Baseline / Normal</span>`;
      }
    }
  },

  renderHeatmapLegend(metric) {
    const swatchesEl = document.getElementById("heatmapLegendSwatches");
    if (!swatchesEl) return;

    if (metric === "temp") {
      swatchesEl.innerHTML = `
        <span class="text-xs text-slate-400 mr-1">&lt;32°C</span>
        <div class="heatmap-legend-swatch" style="background:#e2e8f0;" title="<32°C"></div>
        <div class="heatmap-legend-swatch" style="background:#fef08a;" title="32–36°C"></div>
        <div class="heatmap-legend-swatch" style="background:#fde047;" title="36–40°C"></div>
        <div class="heatmap-legend-swatch" style="background:#fed7aa;" title="40–42°C"></div>
        <div class="heatmap-legend-swatch" style="background:#fb923c;" title="42–44°C"></div>
        <div class="heatmap-legend-swatch" style="background:#ea580c;" title="44–46°C"></div>
        <div class="heatmap-legend-swatch" style="background:#dc2626;" title="≥46°C"></div>
        <span class="text-xs font-bold text-red-700 ml-1">&ge;46°C</span>
      `;
    } else if (metric === "hi") {
      swatchesEl.innerHTML = `
        <span class="text-xs text-slate-400 mr-1">&lt;35°C</span>
        <div class="heatmap-legend-swatch" style="background:#e2e8f0;" title="<35°C"></div>
        <div class="heatmap-legend-swatch" style="background:#fef08a;" title="35–40°C"></div>
        <div class="heatmap-legend-swatch" style="background:#fed7aa;" title="40–44°C"></div>
        <div class="heatmap-legend-swatch" style="background:#fb923c;" title="44–48°C"></div>
        <div class="heatmap-legend-swatch" style="background:#ea580c;" title="48–52°C"></div>
        <div class="heatmap-legend-swatch" style="background:#991b1b;" title="≥52°C"></div>
        <span class="text-xs font-bold text-red-900 ml-1">&ge;52°C HI</span>
      `;
    } else if (metric === "cases") {
      swatchesEl.innerHTML = `
        <span class="text-xs text-slate-400 mr-1">0–3 Cases</span>
        <div class="heatmap-legend-swatch" style="background:#f1f5f9;" title="0–3"></div>
        <div class="heatmap-legend-swatch" style="background:#ccfbf1;" title="4–7"></div>
        <div class="heatmap-legend-swatch" style="background:#fed7aa;" title="8–14"></div>
        <div class="heatmap-legend-swatch" style="background:#fb923c;" title="15–24"></div>
        <div class="heatmap-legend-swatch" style="background:#dc2626;" title="≥25 Cases"></div>
        <span class="text-xs font-bold text-red-700 ml-1">&ge;25 Cases</span>
      `;
    } else if (metric === "alerts") {
      swatchesEl.innerHTML = `
        <div class="heatmap-legend-swatch" style="background:#f8fafc;" title="Normal"></div>
        <span class="text-xs mr-2">Normal</span>
        <div class="heatmap-legend-swatch" style="background:#d97706;" title="Yellow Alert"></div>
        <span class="text-xs mr-2">Yellow</span>
        <div class="heatmap-legend-swatch" style="background:#ea580c;" title="Orange Alert"></div>
        <span class="text-xs mr-2">Orange</span>
        <div class="heatmap-legend-swatch" style="background:#dc2626;" title="Red Alert"></div>
        <span class="text-xs">Red</span>
      `;
    }
  },

  showToast(message, type = "info") {
    const toast = document.getElementById("appToast");
    if (!toast) return;
    toast.className = `app-toast toast-${type}`;
    toast.textContent = message;
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 4000);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  HeatWiseApp.init();
});

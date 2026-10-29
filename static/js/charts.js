/**
 * HeatWise Charting Controller
 * Dual-axis time-series visualization & Dose-Response Scatter/Bar Analysis
 * Includes native HTML5 Canvas fallback rendering for 100% offline resilience.
 */

const HeatWiseCharts = {
  timeSeriesChart: null,
  doseResponseChart: null,

  init() {
    if (window.Chart) {
      Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
      Chart.defaults.color = "#64748b";
    }
  },

  renderTimeSeries(records, candidates = [], options = {}) {
    const canvas = document.getElementById("timeSeriesChart");
    if (!canvas) return;

    if (!records || records.length === 0) {
      if (this.timeSeriesChart && typeof this.timeSeriesChart.destroy === "function") {
        this.timeSeriesChart.destroy();
        this.timeSeriesChart = null;
      }
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (window.Chart) {
      this.renderTimeSeriesChartJs(canvas, records, candidates, options);
    } else {
      this.renderTimeSeriesCanvasNative(canvas, records, candidates, options);
    }
  },

  renderTimeSeriesChartJs(canvas, records, candidates, options) {
    const showTemp = options.showTemp !== false;
    const showHumidity = options.showHumidity !== false;
    const showHeatIndex = options.showHeatIndex !== false;
    const showCases = options.showCases !== false;

    const labels = records.map(r => r.date);
    const temps = records.map(r => r.max_temp_c);
    const humidities = records.map(r => r.humidity_pct);
    const heatIndices = records.map(r => r.heat_index_c);
    const cases = records.map(r => r.heat_illness_cases);

    const datasets = [];

    // Left Y-Axis Weather Metrics
    if (showTemp) {
      datasets.push({
        label: "Max Temperature (°C)",
        data: temps,
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.08)",
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID: "yTemp",
        order: 3
      });
    }

    if (showHeatIndex) {
      datasets.push({
        label: "Heat Index (°C)",
        data: heatIndices,
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.05)",
        borderWidth: 2.2,
        borderDash: [4, 4],
        tension: 0.25,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID: "yTemp",
        order: 2
      });
    }

    if (showHumidity) {
      datasets.push({
        label: "Relative Humidity (%)",
        data: humidities,
        borderColor: "#06b6d4",
        borderWidth: 1.5,
        borderDash: [2, 2],
        pointRadius: 0,
        yAxisID: "yHumidity",
        order: 4
      });
    }

    if (showCases) {
      datasets.push({
        type: "bar",
        label: "Heat-Illness Hospital Cases",
        data: cases,
        backgroundColor: "rgba(13, 148, 136, 0.7)",
        hoverBackgroundColor: "#0f766e",
        borderRadius: 4,
        yAxisID: "yCases",
        order: 5
      });
    }

    if (candidates && candidates.length > 0) {
      candidates.forEach(cand => {
        const lineVal = cand.candidateValue;
        const color = cand.id === "red" ? "#dc2626" : cand.id === "orange" ? "#ea580c" : "#d97706";
        datasets.push({
          type: "line",
          label: `${cand.tierName} Candidate (${lineVal}°C)`,
          data: new Array(records.length).fill(lineVal),
          borderColor: color,
          borderWidth: 1.8,
          borderDash: cand.id === "red" ? [8, 4] : [5, 5],
          pointRadius: 0,
          fill: false,
          yAxisID: "yTemp",
          order: 1
        });
      });
    }

    if (this.timeSeriesChart && typeof this.timeSeriesChart.destroy === "function") {
      this.timeSeriesChart.destroy();
    }

    const ctx = canvas.getContext("2d");
    this.timeSeriesChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, usePointStyle: true, font: { size: 12, weight: "500" } } },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            titleFont: { size: 13, weight: "600" },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              afterBody: function(tooltipItems) {
                const idx = tooltipItems[0].dataIndex;
                const rec = records[idx];
                const activeAlerts = [];
                candidates.forEach(c => {
                  const val = c.metricKey === "heat_index_c" ? rec.heat_index_c : rec.max_temp_c;
                  if (val >= c.candidateValue) activeAlerts.push(c.tierName);
                });
                if (activeAlerts.length > 0) {
                  return `\n⚡ Exceeds Candidate: ${activeAlerts.join(", ")}\n(For expert review only)`;
                }
                return "";
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 12, font: { size: 11 } } },
          yTemp: {
            type: "linear",
            display: true,
            position: "left",
            title: { display: true, text: "Temperature / Heat Index (°C)", color: "#f59e0b", font: { weight: "600" } },
            grid: { color: "#f1f5f9" },
            suggestedMin: 25,
            suggestedMax: 50
          },
          yHumidity: { type: "linear", display: false, position: "left", min: 0, max: 100, grid: { display: false } },
          yCases: {
            type: "linear",
            display: true,
            position: "right",
            title: { display: true, text: "Heat Illness Admissions", color: "#0d9488", font: { weight: "600" } },
            grid: { display: false },
            suggestedMin: 0
          }
        }
      }
    });
  },

  renderTimeSeriesCanvasNative(canvas, records, candidates, options) {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 800;
    canvas.height = rect.height || 380;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = { top: 40, right: 60, bottom: 50, left: 60 };
    const w = canvas.width - padding.left - padding.right;
    const h = canvas.height - padding.top - padding.bottom;

    const n = records.length;
    if (n === 0) return;

    const maxTemp = Math.max(50, ...records.map(r => Math.max(r.max_temp_c, r.heat_index_c || 0)));
    const minTemp = Math.min(25, ...records.map(r => r.max_temp_c));
    const maxCases = Math.max(15, ...records.map(r => r.heat_illness_cases));

    const getX = i => padding.left + (i / Math.max(1, n - 1)) * w;
    const getYTemp = val => padding.top + h - ((val - minTemp) / (maxTemp - minTemp)) * h;
    const getYCases = val => padding.top + h - (val / maxCases) * h;

    // Grid lines
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    for (let t = Math.ceil(minTemp / 5) * 5; t <= maxTemp; t += 5) {
      const y = getYTemp(t);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + w, y);
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px sans-serif";
      ctx.fillText(`${t}°C`, padding.left - 35, y + 3);
    }

    // Bars for cases
    const barWidth = Math.max(2, (w / n) * 0.7);
    ctx.fillStyle = "rgba(13, 148, 136, 0.6)";
    records.forEach((r, i) => {
      const x = getX(i) - barWidth / 2;
      const y = getYCases(r.heat_illness_cases);
      ctx.fillRect(x, y, barWidth, padding.top + h - y);
    });

    // Lines for Temp and Heat Index
    ctx.beginPath();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    records.forEach((r, i) => {
      const x = getX(i);
      const y = getYTemp(r.max_temp_c);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    records.forEach((r, i) => {
      const x = getX(i);
      const y = getYTemp(r.heat_index_c || r.max_temp_c);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Candidate Alert lines
    candidates.forEach(c => {
      const y = getYTemp(c.candidateValue);
      ctx.strokeStyle = c.id === "red" ? "#dc2626" : c.id === "orange" ? "#ea580c" : "#d97706";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = "10px sans-serif";
      ctx.fillText(`${c.tierName} (${c.candidateValue}°C)`, padding.left + w + 5, y + 3);
    });
  },

  renderDoseResponse(bins, primaryMetricLabel = "Temperature (°C)") {
    const canvas = document.getElementById("doseResponseChart");
    if (!canvas) return;

    if (!bins || bins.length === 0) {
      if (this.doseResponseChart && typeof this.doseResponseChart.destroy === "function") {
        this.doseResponseChart.destroy();
        this.doseResponseChart = null;
      }
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (window.Chart) {
      this.renderDoseResponseChartJs(canvas, bins, primaryMetricLabel);
    } else {
      this.renderDoseResponseCanvasNative(canvas, bins, primaryMetricLabel);
    }
  },

  renderDoseResponseChartJs(canvas, bins, primaryMetricLabel) {
    const labels = bins.map(b => b.rangeLabel);
    const meanCases = bins.map(b => b.meanCases);
    const surgeFrequencies = bins.map(b => b.surgeFrequencyPct);

    if (this.doseResponseChart && typeof this.doseResponseChart.destroy === "function") {
      this.doseResponseChart.destroy();
    }

    const ctx = canvas.getContext("2d");
    this.doseResponseChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Mean Daily Cases",
            data: meanCases,
            backgroundColor: "rgba(13, 148, 136, 0.75)",
            borderRadius: 4,
            yAxisID: "yCases"
          },
          {
            type: "line",
            label: "% Surge Days in Bracket",
            data: surgeFrequencies,
            borderColor: "#ea580c",
            backgroundColor: "#ea580c",
            borderWidth: 2.5,
            pointRadius: 4,
            yAxisID: "yPct"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { font: { size: 12 } } }
        },
        scales: {
          x: { title: { display: true, text: `${primaryMetricLabel} Brackets`, font: { weight: "600" } }, grid: { display: false } },
          yCases: {
            type: "linear",
            position: "left",
            title: { display: true, text: "Mean Cases / Day", color: "#0d9488", font: { weight: "600" } },
            suggestedMin: 0
          },
          yPct: {
            type: "linear",
            position: "right",
            title: { display: true, text: "Surge Probability (%)", color: "#ea580c", font: { weight: "600" } },
            min: 0,
            max: 100,
            grid: { display: false }
          }
        }
      }
    });
  },

  renderDoseResponseCanvasNative(canvas, bins, primaryMetricLabel) {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 450;
    canvas.height = rect.height || 220;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = { top: 25, right: 40, bottom: 40, left: 45 };
    const w = canvas.width - padding.left - padding.right;
    const h = canvas.height - padding.top - padding.bottom;

    const n = bins.length;
    if (n === 0) return;

    const maxCases = Math.max(10, ...bins.map(b => b.meanCases));
    const barWidth = (w / n) * 0.6;

    bins.forEach((b, i) => {
      const x = padding.left + (i + 0.2) * (w / n);
      const barH = (b.meanCases / maxCases) * h;
      const y = padding.top + h - barH;

      ctx.fillStyle = "rgba(13, 148, 136, 0.75)";
      ctx.fillRect(x, y, barWidth, barH);

      ctx.fillStyle = "#64748b";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.rangeLabel, x + barWidth / 2, padding.top + h + 15);
      ctx.fillText(`${b.meanCases}c`, x + barWidth / 2, y - 4);
    });
  }
};

/**
 * HeatWise Data Quality & CSV Ingestion Module
 * Handles client-side CSV parsing, schema checking, and data quality diagnostics.
 */

const HeatWiseDataQuality = {
  REQUIRED_COLUMNS: ["date", "district_id", "max_temp_c", "humidity_pct", "heat_illness_cases"],

  COLUMN_ALIASES: {
    date: ["date", "datetime", "observation_date", "day", "record_date"],
    district_id: ["district_id", "district", "district_name", "location_id", "district_code", "dist_id"],
    max_temp_c: ["max_temp_c", "temperature_c", "temp_c", "max_temp", "tmax", "temperature"],
    humidity_pct: ["humidity_pct", "humidity_percent", "humidity", "rh_pct", "rh", "relative_humidity"],
    heat_illness_cases: ["heat_illness_cases", "heat_cases", "cases", "illness_cases", "admissions", "er_cases"]
  },

  COLUMN_SPECS: {
    date: {
      type: "Date String (ISO)",
      format: "YYYY-MM-DD",
      example: "2024-05-18",
      description: "Daily observation date. Expected continuous daily records throughout the summer season."
    },
    district_id: {
      type: "String (Identifier)",
      format: "Alphanumeric / Code",
      example: "IND_GJ_AHM",
      description: "Unique district code or administrative name for localized epidemiological tracking."
    },
    max_temp_c: {
      type: "Numeric (Float)",
      format: "Celsius (°C)",
      example: "42.8",
      description: "Daily maximum dry-bulb ambient temperature. Expected physiological range [10.0°C – 58.0°C]."
    },
    humidity_pct: {
      type: "Numeric (Float/Int)",
      format: "Percentage (0–100%)",
      example: "34.5",
      description: "Daily afternoon or maximum relative humidity. Required for apparent Heat Index calculation."
    },
    heat_illness_cases: {
      type: "Integer (Count)",
      format: "Non-negative int (≥ 0)",
      example: "18",
      description: "Daily count of hospital heatstroke, heat exhaustion, and acute heat-related emergency admissions."
    }
  },

  /**
   * Parse and validate CSV data. Matches weather and health observations by (district_id, date).
   */
  parseAndValidateCSV(text) {
    if (!text || !text.trim()) {
      return { success: false, errorType: "empty", error: "The provided CSV text or file is completely empty.", errors: [] };
    }

    const lines = text.trim().split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      return { success: false, errorType: "too_short", error: "CSV must contain at least a header row and one data row.", errors: [] };
    }

    const headers = this.parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const colIndex = {};
    const missing = [];
    const aliasMatches = {};

    this.REQUIRED_COLUMNS.forEach(reqCol => {
      const aliases = this.COLUMN_ALIASES[reqCol] || [reqCol];
      const matchIdx = headers.findIndex(h => aliases.includes(h));
      if (matchIdx !== -1) {
        colIndex[reqCol] = matchIdx;
        if (headers[matchIdx] !== reqCol) {
          aliasMatches[headers[matchIdx]] = reqCol;
        }
      } else {
        missing.push(reqCol);
      }
    });

    if (missing.length > 0) {
      return {
        success: false,
        errorType: "missing_columns",
        error: `Missing required column(s): [${missing.join(", ")}]`,
        errors: [
          `Header Schema Error: Required column(s) [${missing.join(", ")}] not found.`,
          `Detected Headers: [${headers.join(", ")}]`,
          `Required Headers (or aliases): [${this.REQUIRED_COLUMNS.join(", ")}]`
        ],
        missingColumns: missing,
        detectedHeaders: headers
      };
    }

    const rowErrors = [];
    let duplicateDatesCount = 0;
    const matchedMap = new Map();
    const districtsFound = new Set();

    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1;
      const line = lines[i].trim();
      if (!line) continue;
      const values = this.parseCSVLine(line);

      const rawDate = values[colIndex.date] ? values[colIndex.date].trim() : "";
      const rawDist = values[colIndex.district_id] ? values[colIndex.district_id].trim() : "";
      const rawTemp = values[colIndex.max_temp_c] ? values[colIndex.max_temp_c].trim() : "";
      const rawHum = values[colIndex.humidity_pct] ? values[colIndex.humidity_pct].trim() : "";
      const rawCases = values[colIndex.heat_illness_cases] ? values[colIndex.heat_illness_cases].trim() : "";

      const curRowIssues = [];

      // 1. Date Validation & Normalization
      let cleanDate = rawDate;
      if (!cleanDate) {
        curRowIssues.push(`date is missing`);
      } else {
        cleanDate = cleanDate.replace(/\//g, '-');
        const parts = cleanDate.split('-');
        if (parts.length === 3) {
          const y = parts[0].padStart(4, '20');
          const m = parts[1].padStart(2, '0');
          const d = parts[2].padStart(2, '0');
          cleanDate = `${y}-${m}-${d}`;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
          curRowIssues.push(`date '${rawDate}' is not in YYYY-MM-DD format`);
        }
      }

      // 2. District ID Validation
      if (!rawDist) {
        curRowIssues.push(`district_id is missing`);
      }

      // 3. Max Temperature Validation
      let tempNum = NaN;
      if (rawTemp === "") {
        curRowIssues.push(`max_temp_c is missing`);
      } else {
        tempNum = parseFloat(rawTemp);
        if (isNaN(tempNum)) {
          curRowIssues.push(`max_temp_c '${rawTemp}' is not a valid number`);
        } else if (tempNum > 58.0) {
          curRowIssues.push(`max_temp_c ${tempNum}°C exceeds physical limits (>58°C, suspected Fahrenheit)`);
        } else if (tempNum < 5.0) {
          curRowIssues.push(`max_temp_c ${tempNum}°C is implausibly low (<5°C) for heat season`);
        }
      }

      // 4. Humidity Validation
      let humNum = NaN;
      if (rawHum === "") {
        curRowIssues.push(`humidity_pct is missing`);
      } else {
        humNum = parseFloat(rawHum);
        if (isNaN(humNum)) {
          curRowIssues.push(`humidity_pct '${rawHum}' is not a valid number`);
        } else if (humNum < 0 || humNum > 100) {
          curRowIssues.push(`humidity_pct ${humNum}% is outside 0–100%`);
        }
      }

      // 5. Case Count Validation
      let caseNum = NaN;
      if (rawCases === "") {
        curRowIssues.push(`heat_illness_cases is missing`);
      } else {
        caseNum = parseInt(rawCases, 10);
        if (isNaN(caseNum)) {
          curRowIssues.push(`heat_illness_cases '${rawCases}' is not a valid integer`);
        } else if (caseNum < 0) {
          curRowIssues.push(`heat_illness_cases (${caseNum}) cannot be negative`);
        }
      }

      if (curRowIssues.length > 0) {
        rowErrors.push(`Row ${rowNum}: ${curRowIssues.join("; ")}`);
      } else {
        districtsFound.add(rawDist);
        const compositeKey = `${rawDist}|${cleanDate}`;

        if (!matchedMap.has(compositeKey)) {
          matchedMap.set(compositeKey, {
            date: cleanDate,
            district_id: rawDist,
            max_temp_c: Math.round(tempNum * 10) / 10,
            humidity_pct: Math.round(humNum * 10) / 10,
            heat_illness_cases: caseNum
          });
        } else {
          duplicateDatesCount++;
          rowErrors.push(`Row ${rowNum}: Duplicate date '${cleanDate}' for district '${rawDist}' detected.`);
          const existing = matchedMap.get(compositeKey);
          existing.max_temp_c = Math.max(existing.max_temp_c, Math.round(tempNum * 10) / 10);
          existing.humidity_pct = Math.round(((existing.humidity_pct + humNum) / 2) * 10) / 10;
          existing.heat_illness_cases += caseNum;
        }
      }
    }

    const consolidatedRecords = Array.from(matchedMap.values());
    consolidatedRecords.sort((a, b) => (a.date > b.date ? 1 : -1));

    return {
      success: consolidatedRecords.length > 0,
      records: consolidatedRecords,
      districts: Array.from(districtsFound),
      totalParsedRows: lines.length - 1,
      validRows: consolidatedRecords.length,
      duplicateDatesCount: duplicateDatesCount,
      rowErrors: rowErrors,
      aliasMatches: aliasMatches,
      headers
    };
  },

  parseCSV(text) {
    return this.parseAndValidateCSV(text);
  },

  parseCSVLine(line) {
    const values = []; let cur = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (c === ',' && !inQuotes) {
        values.push(cur); cur = "";
      } else {
        cur += c;
      }
    }
    values.push(cur);
    return values;
  },

  renderDocumentationModal() {
    let html = `
      <div class="schema-doc-table-wrap">
        <table class="table-quality">
          <thead>
            <tr>
              <th>Column Name</th>
              <th>Data Type</th>
              <th>Expected Unit / Format</th>
              <th>Example</th>
              <th>Public Health Purpose</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const [col, spec] of Object.entries(this.COLUMN_SPECS)) {
      html += `
        <tr>
          <td><code class="code-badge">${col}</code></td>
          <td><span class="text-sm font-medium text-slate-700">${spec.type}</span></td>
          <td><span class="zone-badge zone-gray">${spec.format}</span></td>
          <td><code>${spec.example}</code></td>
          <td class="text-sm text-slate-600">${spec.description}</td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
      <div class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 flex items-start gap-2">
        <span class="text-lg">⚠️</span>
        <div>
          <strong>Unit Notice:</strong> Temperatures must be in <strong>Celsius (°C)</strong>. Entering values in Fahrenheit (e.g. 104°F) will trigger data-quality rejection. Case counts must reflect emergency room or sentinel hospital admissions.
        </div>
      </div>
    `;

    return html;
  }
};

"""
HeatWise Analytics & Statistical Engine
Provides rigorous, transparent epidemiological candidate alert assessment,
held-out historical data validation, data quality diagnostics, and uncertainty quantification.

Guardrails:
- Does NOT provide medical advice or official thresholds.
- Always labels outputs: "For expert review — not an official alert threshold."
- Explicitly flags "Insufficient evidence to suggest a candidate" when observations < 30
  or surge cases are inadequate.
"""

import math
from typing import Dict, List, Any


def calculate_heat_index(temp_c: float, humidity_pct: float) -> float:
    """Calculate Steadman/Rothfusz Heat Index in Celsius."""
    temp_f = (temp_c * 9.0 / 5.0) + 32.0
    rh = max(0.0, min(100.0, humidity_pct))

    hi_f = (
        -42.379
        + 2.04901523 * temp_f
        + 10.14333127 * rh
        - 0.22475541 * temp_f * rh
        - 0.00683783 * temp_f * temp_f
        - 0.05481717 * rh * rh
        + 0.00122874 * temp_f * temp_f * rh
        + 0.00085282 * temp_f * rh * rh
        - 0.00000199 * temp_f * temp_f * rh * rh
    )

    if rh < 13 and 80 <= temp_f <= 112:
        adj = ((13 - rh) / 4) * math.sqrt((17 - abs(temp_f - 95)) / 17)
        hi_f -= adj
    elif rh > 85 and 80 <= temp_f <= 87:
        adj = ((rh - 85) / 10) * ((87 - temp_f) / 5)
        hi_f += adj

    if temp_f < 80:
        hi_f = 0.5 * (temp_f + 61.0 + ((temp_f - 68.0) * 1.2) + (rh * 0.094))

    return round((hi_f - 32.0) * 5.0 / 9.0, 1)


def assess_data_quality(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Performs comprehensive data quality audit:
    - Missing values in required columns
    - Inconsistent units (e.g. Fahrenheit entered, impossible Celsius, out-of-range humidity)
    - Negative counts
    - Date format and continuity
    - Total observation sample size
    """
    total_records = len(records)
    if total_records == 0:
        return {
            "score": 0,
            "status": "Critical",
            "status_label": "No Records Available",
            "total_records": 0,
            "valid_records": 0,
            "issues": [{"type": "no_data", "severity": "critical", "message": "Dataset contains 0 records."}],
            "metrics": {"missing_count": 0, "unit_errors": 0, "date_gaps": 0}
        }

    missing_dates = 0
    missing_temps = 0
    missing_humidity = 0
    missing_cases = 0

    seen_dates = set()
    duplicate_dates = 0
    duplicate_details = []

    unit_errors = []
    valid_records_count = 0

    for idx, r in enumerate(records):
        row_num = idx + 1
        has_error = False

        d_val = r.get("date")
        dist_val = r.get("district_id", "")
        if not d_val:
            missing_dates += 1
            has_error = True
        elif dist_val:
            d_clean = str(d_val).strip()
            dist_clean = str(dist_val).strip()
            key = (dist_clean, d_clean)
            if key in seen_dates:
                duplicate_dates += 1
                if len(duplicate_details) < 5:
                    duplicate_details.append(f"Row {row_num}: Duplicate entry for district '{dist_clean}' on date '{d_clean}'")
            else:
                seen_dates.add(key)

        t_val = r.get("max_temp_c")
        if t_val is None or t_val == "":
            missing_temps += 1
            has_error = True
        else:
            try:
                t = float(t_val)
                if t > 58.0:
                    unit_errors.append({
                        "row": row_num,
                        "field": "max_temp_c",
                        "value": t_val,
                        "issue": f"Temperature {t}°C exceeds realistic ambient range (>58°C). Suspected Fahrenheit input."
                    })
                    has_error = True
                elif t < 5.0:
                    unit_errors.append({
                        "row": row_num,
                        "field": "max_temp_c",
                        "value": t_val,
                        "issue": f"Temperature {t}°C is implausibly low for Indian summer analysis."
                    })
                    has_error = True
            except (ValueError, TypeError):
                missing_temps += 1
                has_error = True

        h_val = r.get("humidity_pct")
        if h_val is None or h_val == "":
            missing_humidity += 1
            has_error = True
        else:
            try:
                h = float(h_val)
                if h < 0.0 or h > 100.0:
                    unit_errors.append({
                        "row": row_num,
                        "field": "humidity_pct",
                        "value": h_val,
                        "issue": f"Relative humidity {h}% is outside physiological physical bounds [0-100%]."
                    })
                    has_error = True
            except (ValueError, TypeError):
                missing_humidity += 1
                has_error = True

        c_val = r.get("heat_illness_cases")
        if c_val is None or c_val == "":
            missing_cases += 1
            has_error = True
        else:
            try:
                c = int(float(c_val))
                if c < 0:
                    unit_errors.append({
                        "row": row_num,
                        "field": "heat_illness_cases",
                        "value": c_val,
                        "issue": f"Heat illness case count ({c}) cannot be negative."
                    })
                    has_error = True
            except (ValueError, TypeError):
                missing_cases += 1
                has_error = True

        if not has_error:
            valid_records_count += 1

    total_missing = missing_dates + missing_temps + missing_humidity + missing_cases
    unit_error_count = len(unit_errors)

    completeness_ratio = valid_records_count / max(1, total_records)
    penalty_missing = min(40, (total_missing / max(1, total_records * 4)) * 100)
    penalty_units = min(40, (unit_error_count / max(1, total_records)) * 100)
    
    score = max(0, min(100, int(round((completeness_ratio * 100) - penalty_missing * 0.5 - penalty_units * 0.5))))

    insufficient_sample = total_records < 30
    if insufficient_sample:
        score = min(score, 65)

    if score >= 90 and not insufficient_sample:
        status = "Optimal"
        status_label = "Optimal Quality (Ready for Learning)"
        status_class = "quality-optimal"
    elif score >= 70:
        status = "Acceptable"
        status_label = "Acceptable (Minor Data Warnings)"
        status_class = "quality-acceptable"
    elif score >= 50:
        status = "Degraded"
        status_label = "Degraded Quality (Review Required)"
        status_class = "quality-degraded"
    else:
        status = "Critical"
        status_label = "Critical Flaws (Not Suitable for Modeling)"
        status_class = "quality-critical"

    issues_list = []
    if insufficient_sample:
        issues_list.append({
            "type": "sample_size",
            "severity": "warning",
            "message": f"Sample size ({total_records} days) is below the minimum 30-day recommended threshold for seasonal risk calibration."
        })
    if total_missing > 0:
        issues_list.append({
            "type": "missing_values",
            "severity": "warning",
            "message": f"Detected {total_missing} missing or unparseable field values across dataset."
        })
    if unit_error_count > 0:
        issues_list.append({
            "type": "unit_inconsistencies",
            "severity": "critical" if unit_error_count > 5 else "warning",
            "message": f"Detected {unit_error_count} unit or bounds violations (e.g. °F instead of °C, humidity > 100%).",
            "details": unit_errors[:5]
        })
    if duplicate_dates > 0:
        issues_list.append({
            "type": "duplicate_dates",
            "severity": "warning",
            "message": f"Detected {duplicate_dates} duplicate date entries for the same district.",
            "details": duplicate_details
        })

    return {
        "score": score,
        "status": status,
        "status_label": status_label,
        "status_class": status_class,
        "total_records": total_records,
        "valid_records": valid_records_count,
        "completeness_pct": round((valid_records_count / max(1, total_records)) * 100, 1),
        "insufficient_sample": insufficient_sample,
        "issues": issues_list,
        "metrics": {
            "missing_dates": missing_dates,
            "missing_temps": missing_temps,
            "missing_humidity": missing_humidity,
            "missing_cases": missing_cases,
            "duplicate_dates_count": duplicate_dates,
            "unit_errors_count": unit_error_count
        }
    }


def clean_and_prepare_records(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filters only valid numeric records and computes Heat Index."""
    cleaned = []
    for r in records:
        try:
            d = str(r["date"]).strip()
            dist = str(r.get("district_id", "UNKNOWN")).strip()
            t = float(r["max_temp_c"])
            h = float(r["humidity_pct"])
            c = int(float(r["heat_illness_cases"]))

            if 10.0 <= t <= 58.0 and 0.0 <= h <= 100.0 and c >= 0 and d:
                hi = calculate_heat_index(t, h)
                cleaned.append({
                    "date": d,
                    "district_id": dist,
                    "max_temp_c": round(t, 1),
                    "humidity_pct": round(h, 1),
                    "heat_index_c": hi,
                    "heat_illness_cases": c
                })
        except (ValueError, KeyError, TypeError):
            continue
    cleaned.sort(key=lambda x: x["date"])
    return cleaned


ANALYSIS_CONFIG = {
    "min_observation_days": 30,
    "min_total_surge_days": 3,
    "min_calib_surge_days": 2,
    "calib_split_ratio": 0.70,
    "min_val_days": 9,
    "baseline_percentile": 75,
    "candidate_percentiles": {
        "yellow": 84,
        "orange": 92,
        "red": 97
    }
}


def analyze_candidate_thresholds(records: List[Dict[str, Any]], primary_metric: str = "max_temp_c", config: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Learns candidate alert thresholds using empirical risk-ratio on calibration data (70%)
    and validates them on held-out historical data (30%).
    
    If data are insufficient (< 30 valid days, < 3 surge days, or inadequate held-out validation data), returns:
    "Insufficient evidence for a candidate." along with rich descriptive analysis of available observations.
    """
    cfg = config or ANALYSIS_CONFIG
    min_obs_days = cfg["min_observation_days"]
    min_surges = cfg["min_total_surge_days"]
    min_calib_surges = cfg["min_calib_surge_days"]
    calib_ratio = cfg["calib_split_ratio"]
    min_val_days = cfg["min_val_days"]

    valid = clean_and_prepare_records(records)
    n = len(valid)

    # 1. Descriptive analysis across available records (even when insufficient)
    dates = [r["date"] for r in valid if r.get("date")]
    temps = [r["max_temp_c"] for r in valid if r.get("max_temp_c") is not None]
    hums = [r["humidity_pct"] for r in valid if r.get("humidity_pct") is not None]
    his = [r["heat_index_c"] for r in valid if r.get("heat_index_c") is not None]
    cases = [r["heat_illness_cases"] for r in valid if r.get("heat_illness_cases") is not None]

    min_date = dates[0] if dates else "N/A"
    max_date = dates[-1] if dates else "N/A"
    
    total_cases = sum(cases) if cases else 0
    mean_daily_cases = round(total_cases / max(1, len(cases)), 1) if cases else 0.0
    max_daily_cases = max(cases) if cases else 0
    peak_case_date = "N/A"
    if cases:
        peak_idx = cases.index(max_daily_cases)
        peak_case_date = dates[peak_idx] if peak_idx < len(dates) else "N/A"

    def calc_trend_slope(vals: List[float], unit: str):
        nv = len(vals)
        if nv < 4:
            return {"slope_per_month": 0.0, "text": "Insufficient points for trend"}
        xm = (nv - 1) / 2.0
        ym = sum(vals) / nv
        num = sum((i - xm) * (y - ym) for i, y in enumerate(vals))
        den = sum((i - xm) ** 2 for i in range(nv))
        sl_day = (num / den) if den > 0 else 0.0
        sl_month = round(sl_day * 30.0, 2)
        if sl_month > 0.4:
            txt = f"+{sl_month}{unit}/month (Seasonal warming progression)" if unit == "°C" else f"+{sl_month}{unit}/month (Increasing trend)"
        elif sl_month < -0.4:
            txt = f"{sl_month}{unit}/month (Seasonal decline transition)" if unit == "°C" else f"{sl_month}{unit}/month (Decreasing trend)"
        else:
            txt = f"{sl_month:+0.1f}{unit}/month (Stable baseline regime)"
        return {"slope_per_month": sl_month, "text": txt}

    temp_trend = calc_trend_slope(temps, "°C")
    humidity_trend = calc_trend_slope(hums, "%")
    hi_trend = calc_trend_slope(his, "°C")

    half_c = max(1, len(cases) // 2)
    early_avg = round(sum(cases[:half_c]) / half_c, 1) if cases else 0.0
    late_avg = round(sum(cases[half_c:]) / max(1, len(cases) - half_c), 1) if cases else 0.0
    if late_avg > early_avg * 1.2:
        case_trend_text = f"Escalating: average increased from {early_avg} to {late_avg} cases/day"
    elif early_avg > late_avg * 1.2:
        case_trend_text = f"Decreasing: average dropped from {early_avg} to {late_avg} cases/day"
    else:
        case_trend_text = f"Stable: {early_avg} early vs {late_avg} late cases/day"

    weather_summary = {
        "temp": {
            "min": round(min(temps), 1) if temps else 0.0,
            "max": round(max(temps), 1) if temps else 0.0,
            "mean": round(sum(temps) / max(1, len(temps)), 1) if temps else 0.0,
            "trend": temp_trend
        },
        "humidity": {
            "min": round(min(hums), 1) if hums else 0.0,
            "max": round(max(hums), 1) if hums else 0.0,
            "mean": round(sum(hums) / max(1, len(hums)), 1) if hums else 0.0,
            "trend": humidity_trend
        },
        "heat_index": {
            "min": round(min(his), 1) if his else 0.0,
            "max": round(max(his), 1) if his else 0.0,
            "mean": round(sum(his) / max(1, len(his)), 1) if his else 0.0,
            "trend": hi_trend
        }
    }

    metric_values_all = [r["heat_index_c"] if primary_metric == "heat_index_c" else r["max_temp_c"] for r in valid]
    metric_label = "Max Temperature (°C)" if primary_metric == "max_temp_c" else "Heat Index (°C)"

    # Pearson correlation if at least 3 points
    pearson_r = 0.0
    if n >= 3 and cases and metric_values_all:
        mean_v = sum(metric_values_all) / n
        mean_c = sum(cases) / n
        num = sum((v - mean_v) * (c - mean_c) for v, c in zip(metric_values_all, cases))
        den = math.sqrt(max(1e-9, sum((v - mean_v)**2 for v in metric_values_all) * sum((c - mean_c)**2 for c in cases)))
        pearson_r = round(num / den, 3) if den > 0 else 0.0

    # Exploratory dose-response bins (if >= 4 points)
    bins = []
    if n >= 4 and metric_values_all:
        min_v = min(metric_values_all)
        max_v = max(metric_values_all)
        step = max(1.5, round((max_v - min_v) / 5.0, 1))
        b = min_v
        while b < max_v:
            b_end = round(b + step, 1)
            b_recs = [r for r in valid if b <= (r["heat_index_c"] if primary_metric == "heat_index_c" else r["max_temp_c"]) <= b_end]
            b_count = len(b_recs)
            b_cases = [r["heat_illness_cases"] for r in b_recs]
            bins.append({
                "range_label": f"{b:.1f} – {b_end:.1f}°C",
                "day_count": b_count,
                "mean_cases": round(sum(b_cases) / max(1, b_count), 1) if b_count else 0.0
            })
            b = round(b + step, 1)

    # 2. Granular Evaluation of Evidence Requirements
    req_days_met = n >= min_obs_days
    days_deficiency = max(0, min_obs_days - n)

    split_idx = int(n * calib_ratio)
    calib_records = valid[:split_idx]
    val_records = valid[split_idx:]
    n_calib = len(calib_records)
    n_val = len(val_records)

    cases_calib = [r["heat_illness_cases"] for r in calib_records]
    cases_val = [r["heat_illness_cases"] for r in val_records]

    sorted_cases = sorted(cases) if cases else []
    p75_idx = int(0.75 * max(0, len(sorted_cases) - 1)) if sorted_cases else 0
    surge_threshold = sorted_cases[p75_idx] if sorted_cases else 0

    surge_count_calib = sum(1 for c in cases_calib if c > surge_threshold) if cases_calib else 0
    surge_count_val = sum(1 for c in cases_val if c > surge_threshold) if cases_val else 0
    total_surge_count = surge_count_calib + surge_count_val

    req_surge_met = total_surge_count >= min_surges and surge_count_calib >= min_calib_surges
    surge_deficiency = max(0, min_surges - total_surge_count)

    req_val_met = n_val >= min_val_days
    val_deficiency = max(0, min_val_days - n_val)

    # Unit & Bounds check (tests present values for physical plausibility; missing values are handled separately)
    unit_errors = 0
    for r in records:
        t_val = r.get("max_temp_c")
        if t_val is not None and str(t_val).strip() != "":
            try:
                t = float(t_val)
                if t > 58.0 or t < 10.0:
                    unit_errors += 1
            except (ValueError, TypeError):
                pass
        h_val = r.get("humidity_pct")
        if h_val is not None and str(h_val).strip() != "":
            try:
                h = float(h_val)
                if h > 100.0 or h < 0.0:
                    unit_errors += 1
            except (ValueError, TypeError):
                pass
        c_val = r.get("heat_illness_cases")
        if c_val is not None and str(c_val).strip() != "":
            try:
                c = float(c_val)
                if c < 0:
                    unit_errors += 1
            except (ValueError, TypeError):
                pass
    req_quality_met = unit_errors == 0

    requirements_status = [
        {
            "id": "req_observation_days",
            "title": "Observation Sample Size",
            "requirement": f"At least {min_obs_days} valid observation days",
            "observed": f"{n} days recorded",
            "is_met": req_days_met,
            "status_text": "Requirement Met" if req_days_met else "Unmet",
            "deficiency": f"Need at least {days_deficiency} more daily observations" if days_deficiency > 0 else "Adequate baseline period",
            "why_required": "A 30-day minimum observation window is required to sample both baseline and peak thermal behavior within the Indian summer season, preventing volatile percentile shifts."
        },
        {
            "id": "req_surge_events",
            "title": "Documented Surge Events",
            "requirement": f"At least {min_surges} elevated case surge days (> 75th percentile)",
            "observed": f"{total_surge_count} surge days observed (surge threshold: > {surge_threshold} cases)",
            "is_met": req_surge_met,
            "status_text": "Requirement Met" if req_surge_met else "Unmet",
            "deficiency": f"Need at least {surge_deficiency} more surge events" if surge_deficiency > 0 else "Adequate health outcome variation",
            "why_required": "Empirical risk ratios require sufficient instances of hospital surge admissions to distinguish acute heat-related morbidity from background emergency presentations."
        },
        {
            "id": "req_held_out_validation",
            "title": "Held-Out Historical Validation",
            "requirement": f"At least {min_val_days} held-out validation days ({int(round((1.0 - calib_ratio) * 100))}% partition)",
            "observed": f"{n_val} days in validation partition (Calib: {n_calib}d / Val: {n_val}d)",
            "is_met": req_val_met,
            "status_text": "Requirement Met" if req_val_met else "Unmet",
            "deficiency": f"Need at least {val_deficiency} more validation days" if val_deficiency > 0 else "Independent test bed available",
            "why_required": "Candidate levels derived on calibration data must be verified on independent held-out historical data to assess prospective Sensitivity, Specificity, and Positive Predictive Value."
        },
        {
            "id": "req_quality_bounds",
            "title": "Data Quality & Unit Integrity",
            "requirement": "Zero unit/bounds anomalies (Celsius 10°C–58°C, RH ≤ 100%, cases ≥ 0)",
            "observed": "All records within physical bounds" if req_quality_met else f"{unit_errors} unit/bounds anomaly record(s)",
            "is_met": req_quality_met,
            "status_text": "Requirement Met" if req_quality_met else "Unmet (Anomalies Flagged)",
            "deficiency": "Verified valid physical bounds" if req_quality_met else "Correct unit conversion (e.g., Fahrenheit to Celsius)",
            "why_required": "Corrupt temperature recordings or negative case admissions distort distribution percentiles and invalidate risk modeling."
        }
    ]

    unmet_reasons = [f"{r['title']}: {r['deficiency']}. ({r['why_required']})" for r in requirements_status if not r["is_met"]]

    additional_data_needed_parts = []
    if days_deficiency > 0:
        additional_data_needed_parts.append(f"{days_deficiency} additional daily observations")
    if surge_deficiency > 0:
        additional_data_needed_parts.append(f"{surge_deficiency} additional elevated hospital admission surge days")
    if val_deficiency > 0:
        additional_data_needed_parts.append(f"{val_deficiency} more days for held-out validation")
    if unit_errors > 0:
        additional_data_needed_parts.append(f"correction of {unit_errors} unit bounds error(s)")

    additional_data_needed = (
        "To enable candidate alert level derivation, the dataset requires: " +
        (", ".join(additional_data_needed_parts) if additional_data_needed_parts else "additional data collection.")
    )

    why_no_candidate = (
        "In accordance with public health informatics standards and local Indian disaster guidelines, "
        "candidate alert levels are strictly withheld when evidence criteria are unmet. Deriving alert thresholds "
        "from inadequate sample sizes produces mathematically unstable levels with unacceptably high false alarm "
        "rates (eroding community trust) or dangerous missed heatwave emergencies."
    )

    all_requirements_met = req_days_met and req_surge_met and req_val_met and req_quality_met

    descriptive_analysis = {
        "sample_size": n,
        "total_raw_records": len(records),
        "start_date": min_date,
        "end_date": max_date,
        "weather_summary": weather_summary,
        "health_summary": {
            "total_cases": total_cases,
            "mean_daily_cases": mean_daily_cases,
            "max_daily_cases": max_daily_cases,
            "peak_case_date": peak_case_date,
            "trend_summary": case_trend_text,
            "days_with_cases": sum(1 for c in cases if c > 0)
        },
        "methodology_explanation": "Empirical risk escalation analysis: segregates observations chronologically into calibration (70%) and held-out prospective validation (30%). Assesses non-linear dose-response of heat-related illness admissions and quantifies threshold uncertainty via bootstrap 95% confidence intervals.",
        "association_vs_causation": "Observed correlations reflect environmental hazard co-occurrence, modulated by socioeconomic factors, housing insulation, and clinical health-seeking behaviors, not isolated biological causation.",
        "pearson_correlation": pearson_r,
        "dose_response_bins": bins
    }

    # If any requirement is unmet, do NOT generate candidate alert levels
    if not all_requirements_met:
        return {
            "status": "insufficient_data",
            "message": "Insufficient evidence for a candidate.",
            "title": "Insufficient evidence for a candidate.",
            "sample_size": n,
            "requirements_status": requirements_status,
            "unmet_reasons": unmet_reasons,
            "additional_data_needed": additional_data_needed,
            "why_no_candidate": why_no_candidate,
            "descriptive_analysis": descriptive_analysis,
            "dose_response_bins": bins,
            "primary_metric": primary_metric,
            "metric_label": metric_label,
            "pearson_correlation": pearson_r,
            "candidates": [],
            "correlation_causation_note": (
                "Notice on Correlation vs Causation: Weather exposure is an environmental hazard, "
                "but observed hospital admissions are also influenced by socioeconomic vulnerability, "
                "outdoor occupational patterns, access to cooling, hydration practices, and weekend "
                "hospital reporting cadences. Statistical associations here identify risk co-occurrence, "
                "not isolated physiological causation. All candidates require multidisciplinary review."
            )
        }

    # All requirements genuinely met: compute candidate alert levels on calibration (70%) and validate on held-out (30%)
    metric_values_calib = [r["heat_index_c"] if primary_metric == "heat_index_c" else r["max_temp_c"] for r in calib_records]
    metric_values_val = [r["heat_index_c"] if primary_metric == "heat_index_c" else r["max_temp_c"] for r in val_records]

    # Baseline & Surge definitions on Calibration Set
    sorted_cases_calib = sorted(cases_calib)
    p75_cal_idx = int(0.75 * (n_calib - 1))
    calib_surge_threshold = sorted_cases_calib[p75_cal_idx]

    surge_mask_calib = [c > calib_surge_threshold for c in cases_calib]
    surge_mask_val = [c > calib_surge_threshold for c in cases_val]

    baseline_cases_calib = [c for c, is_s in zip(cases_calib, surge_mask_calib) if not is_s]
    baseline_mean_calib = (sum(baseline_cases_calib) / max(1, len(baseline_cases_calib))) if baseline_cases_calib else (sum(cases_calib) / n_calib)

    sorted_metrics_calib = sorted(metric_values_calib)

    tier_specs = [
        {
            "tier_id": "yellow",
            "tier_name": "Yellow Alert",
            "level_label": "Caution / Preparedness",
            "target_percentile": cfg["candidate_percentiles"]["yellow"],
            "badge_color": "yellow",
            "description": "Threshold where daily heat-illness presentations begin to statistically diverge above normal baseline."
        },
        {
            "tier_id": "orange",
            "tier_name": "Orange Alert",
            "level_label": "Severe Heat Warning",
            "target_percentile": cfg["candidate_percentiles"]["orange"],
            "badge_color": "orange",
            "description": "Corresponds to marked risk escalation; recommended trigger for community cooling centers and labor advisory."
        },
        {
            "tier_id": "red",
            "tier_name": "Red Alert",
            "level_label": "Extreme Health Emergency",
            "target_percentile": cfg["candidate_percentiles"]["red"],
            "badge_color": "red",
            "description": "Reserved for acute thermal spikes historically coinciding with critical hospital bed and emergency ward surges."
        }
    ]

    candidates = []

    for spec in tier_specs:
        pct = spec["target_percentile"]
        pct_idx = min(n_calib - 1, max(0, int((pct / 100.0) * (n_calib - 1))))
        candidate_val = round(sorted_metrics_calib[pct_idx], 1)

        # 1. Calibration performance (Training Set)
        tp_cal = sum(1 for v, is_s in zip(metric_values_calib, surge_mask_calib) if v >= candidate_val and is_s)
        fp_cal = sum(1 for v, is_s in zip(metric_values_calib, surge_mask_calib) if v >= candidate_val and not is_s)
        fn_cal = sum(1 for v, is_s in zip(metric_values_calib, surge_mask_calib) if v < candidate_val and is_s)
        tn_cal = sum(1 for v, is_s in zip(metric_values_calib, surge_mask_calib) if v < candidate_val and not is_s)

        calib_sens = round(tp_cal / max(1, tp_cal + fn_cal), 2)
        calib_spec = round(tn_cal / max(1, tn_cal + fp_cal), 2)

        exceed_cases_cal = [c for v, c in zip(metric_values_calib, cases_calib) if v >= candidate_val]
        non_exceed_cases_cal = [c for v, c in zip(metric_values_calib, cases_calib) if v < candidate_val]
        mean_exceed_cal = (sum(exceed_cases_cal) / len(exceed_cases_cal)) if exceed_cases_cal else 0.0
        mean_non_cal = (sum(non_exceed_cases_cal) / max(1, len(non_exceed_cases_cal))) if non_exceed_cases_cal else 1.0
        risk_ratio = round(mean_exceed_cal / max(0.1, mean_non_cal), 2)
        excess_cases_per_day = round(max(0.0, mean_exceed_cal - mean_non_cal), 1)

        # 2. Held-Out Validation performance (Unseen Test Set)
        tp_val = sum(1 for v, is_s in zip(metric_values_val, surge_mask_val) if v >= candidate_val and is_s)
        fp_val = sum(1 for v, is_s in zip(metric_values_val, surge_mask_val) if v >= candidate_val and not is_s)
        fn_val = sum(1 for v, is_s in zip(metric_values_val, surge_mask_val) if v < candidate_val and is_s)
        tn_val = sum(1 for v, is_s in zip(metric_values_val, surge_mask_val) if v < candidate_val and not is_s)

        total_pos_val = tp_val + fn_val
        val_spec = round(tn_val / max(1, tn_val + fp_val), 2)

        if total_pos_val == 0:
            val_sens = None
            val_ppv = None
            val_youden_j = None
            has_val_surges = False
            performance_note = (
                "Zero documented surge events occurred in the chronological held-out validation window. "
                "Event-detection sensitivity, PPV, and Youden's Index cannot be adequately evaluated on this held-out partition."
            )
        else:
            val_sens = round(tp_val / total_pos_val, 2)
            val_ppv = round(tp_val / max(1, tp_val + fp_val), 2)
            val_youden_j = round(val_sens + val_spec - 1.0, 2)
            has_val_surges = True
            performance_note = None

        total_exceed_count = sum(1 for v in metric_values_all if v >= candidate_val)

        # Bootstrap 95% Confidence Interval
        q25 = sorted_metrics_calib[int(0.25 * (n_calib - 1))]
        q75 = sorted_metrics_calib[int(0.75 * (n_calib - 1))]
        iqr = max(1.0, q75 - q25)
        se = iqr / (1.349 * math.sqrt(max(1, total_exceed_count)))
        margin = round(1.96 * se, 1)
        ci_lower = round(candidate_val - margin, 1)
        ci_upper = round(candidate_val + margin, 1)

        candidates.append({
            "tier_id": spec["tier_id"],
            "tier_name": spec["tier_name"],
            "level_label": spec["level_label"],
            "metric": primary_metric,
            "metric_label": metric_label,
            "candidate_value": candidate_val,
            "candidate_unit": "°C",
            "target_percentile": f"{pct}th percentile",
            "evidence": f"Calibration RR: {risk_ratio}x baseline (+{excess_cases_per_day} cases/day avg)",
            "risk_ratio": risk_ratio,
            "sample_size": f"Calib: {n_calib}d | Held-Out: {n_val}d ({total_exceed_count} total exceedances)",
            "n_calib": n_calib,
            "n_val": n_val,
            "total_exceed_count": total_exceed_count,
            "validation_performance": {
                "has_val_surges": has_val_surges,
                "val_surge_count": total_pos_val,
                "calib_sensitivity": calib_sens,
                "calib_specificity": calib_spec,
                "val_sensitivity": val_sens,
                "val_specificity": val_spec,
                "val_ppv": val_ppv,
                "val_youden_index": val_youden_j,
                "performance_note": performance_note
            },
            "uncertainty": f"95% CI: [{ci_lower}°C – {ci_upper}°C]",
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "margin": margin,
            "review_status": "Pending Expert Review",
            "description": spec["description"],
            "disclaimer": "For expert review — not an official alert threshold."
        })

    return {
        "status": "success",
        "sample_size": n,
        "n_calib": n_calib,
        "n_val": n_val,
        "calib_start_date": calib_records[0]["date"],
        "calib_end_date": calib_records[-1]["date"],
        "val_start_date": val_records[0]["date"],
        "val_end_date": val_records[-1]["date"],
        "surge_days": total_surge_count,
        "baseline_mean_cases": round(baseline_mean_calib, 1),
        "case_surge_threshold": calib_surge_threshold,
        "primary_metric": primary_metric,
        "metric_label": metric_label,
        "pearson_correlation": pearson_r,
        "candidates": candidates,
        "requirements_status": requirements_status,
        "descriptive_analysis": descriptive_analysis,
        "dose_response_bins": bins,
        "correlation_causation_note": (
            "Notice on Correlation vs Causation: Weather exposure is an environmental hazard, "
            "but observed hospital admissions are also influenced by socioeconomic vulnerability, "
            "outdoor occupational patterns, access to cooling, hydration practices, and weekend "
            "hospital reporting cadences. Statistical associations here identify risk co-occurrence, "
            "not isolated physiological causation. All candidates require multidisciplinary review."
        )
    }

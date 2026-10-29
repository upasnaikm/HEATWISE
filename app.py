"""
HeatWise — Local Heat Alert Learning Dashboard
Flask Application and REST API
"""

import os
import csv
import io
import json
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from analytics import calculate_heat_index, assess_data_quality, analyze_candidate_thresholds, clean_and_prepare_records
from synthetic_generator import generate_district_dataset, EXPANDED_DISTRICTS, export_expanded_demo_csv

app = Flask(__name__, static_folder="static", template_folder="templates")

# Ensure expanded demo CSV exists on disk
export_expanded_demo_csv()

# In-memory store of pre-generated synthetic demonstration datasets
DEMO_DISTRICTS = {
    "IND_GJ_AHM": {
        "id": "IND_GJ_AHM",
        "name": "Ahmedabad",
        "state": "Gujarat",
        "zone": "Arid / Semi-Arid",
        "badge": "Dry Extreme Heat",
        "notes": "Classic dry-bulb driven heatwave zone (Ahmedabad Heat Action Plan pioneer region).",
        "records": generate_district_dataset("IND_GJ_AHM", "ahmedabad_arid", 122, seed=101)
    },
    "IND_OD_BHU": {
        "id": "IND_OD_BHU",
        "name": "Bhubaneswar",
        "state": "Odisha",
        "zone": "Coastal Humid",
        "badge": "High Humidity Stress",
        "notes": "Coastal regime where high humidity amplifies Heat Index even at moderate temperatures (36-39°C).",
        "records": generate_district_dataset("IND_OD_BHU", "bhubaneswar_coastal", 122, seed=202)
    },
    "IND_MH_NAG": {
        "id": "IND_MH_NAG",
        "name": "Nagpur",
        "state": "Maharashtra",
        "zone": "Central Vidarbha Inland",
        "badge": "Severe Inland Heatwave",
        "notes": "Central plateau experiencing prolonged heatwaves with peak temperatures exceeding 45°C.",
        "records": generate_district_dataset("IND_MH_NAG", "nagpur_inland", 122, seed=303)
    },
    "IND_DL_DEL": {
        "id": "IND_DL_DEL",
        "name": "Delhi Central",
        "state": "Delhi NCR",
        "zone": "Northern Composite",
        "badge": "Urban Heat Island",
        "notes": "Intense urban heat island with high density outdoor labor exposure and dust-storm transitions.",
        "records": generate_district_dataset("IND_DL_DEL", "delhi_composite", 122, seed=404)
    },
    "IND_SPARSE_TEST": {
        "id": "IND_SPARSE_TEST",
        "name": "Sparse Demo (Insufficient Data)",
        "state": "Test Region",
        "zone": "Insufficient Data Demo",
        "badge": "Data Guardrail Test",
        "notes": "Only 14 days of sparse data. Designed to demonstrate the 'Insufficient evidence to suggest a candidate' safety guardrail.",
        "records": generate_district_dataset("IND_SPARSE_TEST", "sparse_demo", 14, seed=505)
    }
}

ALL_DISTRICTS = {**EXPANDED_DISTRICTS, **DEMO_DISTRICTS}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/districts", methods=["GET"])
def get_districts():
    """Returns list of demonstration districts and their metadata."""
    summary = []
    for d_id, info in ALL_DISTRICTS.items():
        summary.append({
            "id": d_id,
            "name": info["name"],
            "state": info["state"],
            "zone": info["zone"],
            "badge": info["badge"],
            "badge_color": info.get("badge_color", "amber"),
            "notes": info["notes"],
            "record_count": len(info["records"]),
            "group": "expanded_180d" if d_id.startswith("SYN_DIST_") else "regional_122d",
            "is_synthetic_demo": True
        })
    return jsonify({"districts": summary})


@app.route("/api/data/<district_id>", methods=["GET"])
def get_district_data(district_id):
    """Returns records for a specific demo district."""
    if district_id not in ALL_DISTRICTS:
        return jsonify({"error": f"District '{district_id}' not found in demo library."}), 404
    
    info = ALL_DISTRICTS[district_id]
    return jsonify({
        "district": {
            "id": info["id"],
            "name": info["name"],
            "state": info["state"],
            "zone": info["zone"],
            "badge": info["badge"],
            "badge_color": info.get("badge_color", "amber"),
            "notes": info["notes"],
            "is_synthetic_demo": True,
            "synthetic_disclaimer": "SYNTHETIC DEMO DATA — NOT REAL OBSERVATIONS. Research and prototype demonstration only."
        },
        "records": info["records"]
    })


@app.route("/api/validate_csv", methods=["POST"])
def validate_csv_endpoint():
    """Parses and validates uploaded CSV content."""
    csv_text = ""
    filename = "uploaded.csv"

    if "file" in request.files:
        file = request.files["file"]
        if file.filename:
            filename = file.filename
            csv_text = file.read().decode("utf-8", errors="replace")
    elif request.is_json:
        csv_text = request.json.get("csv_text", "")
        filename = request.json.get("filename", "pasted.csv")
    else:
        csv_text = request.data.decode("utf-8", errors="replace")

    if not csv_text.strip():
        return jsonify({"error": "No CSV content provided."}), 400

    # Parse CSV with column alias support
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames:
        return jsonify({
            "status": "error",
            "message": "Empty or invalid CSV file format."
        }), 400

    alias_map = {
        "date": ["date", "datetime", "observation_date", "day", "record_date"],
        "district_id": ["district_id", "district", "district_name", "location_id", "district_code", "dist_id"],
        "max_temp_c": ["max_temp_c", "temperature_c", "temp_c", "max_temp", "tmax", "temperature"],
        "humidity_pct": ["humidity_pct", "humidity_percent", "humidity", "rh_pct", "rh", "relative_humidity"],
        "heat_illness_cases": ["heat_illness_cases", "heat_cases", "cases", "illness_cases", "admissions", "er_cases"]
    }

    fieldnames_clean = {c.strip().lower(): c for c in reader.fieldnames}
    col_mapping = {}
    missing_cols = []
    alias_matches = {}

    for req_col, aliases in alias_map.items():
        matched = False
        for a in aliases:
            if a in fieldnames_clean:
                col_mapping[req_col] = fieldnames_clean[a]
                if a != req_col:
                    alias_matches[a] = req_col
                matched = True
                break
        if not matched:
            missing_cols.append(req_col)

    if missing_cols:
        return jsonify({
            "status": "schema_error",
            "message": f"CSV is missing required columns: {', '.join(sorted(missing_cols))}",
            "required_columns": list(alias_map.keys()),
            "detected_columns": list(reader.fieldnames)
        }), 422

    # Map records to normalized keys
    records = []
    for row in reader:
        rec = {
            "date": row[col_mapping["date"]].strip(),
            "district_id": row[col_mapping["district_id"]].strip(),
            "max_temp_c": row[col_mapping["max_temp_c"]].strip(),
            "humidity_pct": row[col_mapping["humidity_pct"]].strip(),
            "heat_illness_cases": row[col_mapping["heat_illness_cases"]].strip()
        }
        records.append(rec)

    # Perform quality audit
    quality = assess_data_quality(records)
    cleaned = clean_and_prepare_records(records)

    return jsonify({
        "status": "success",
        "filename": filename,
        "total_rows": len(records),
        "valid_rows": len(cleaned),
        "alias_matches": alias_matches,
        "quality_report": quality,
        "records": cleaned
    })


@app.route("/api/analyze", methods=["POST"])
def analyze_endpoint():
    """Runs empirical alert learning on the provided record subset."""
    data = request.get_json(force=True, silent=True) or {}
    records = data.get("records", [])
    primary_metric = data.get("metric", "max_temp_c")

    if not records:
        return jsonify({"error": "No records supplied for analysis."}), 400

    result = analyze_candidate_thresholds(records, primary_metric=primary_metric)
    return jsonify(result)


@app.route("/api/download/template", methods=["GET"])
def download_template():
    """Serves the standard CSV template."""
    path = os.path.join(app.static_folder, "templates", "sample_template.csv")
    return send_file(path, as_attachment=True, download_name="heatwise_sample_template.csv", mimetype="text/csv")


@app.route("/api/download/issues_template", methods=["GET"])
def download_issues_template():
    """Serves sample CSV with intentional quality flaws."""
    path = os.path.join(app.static_folder, "templates", "sample_with_quality_issues.csv")
    return send_file(path, as_attachment=True, download_name="sample_with_quality_issues.csv", mimetype="text/csv")


@app.route("/api/download/expanded_demo", methods=["GET"])
def download_expanded_demo():
    """Serves the expanded 180-day multi-district synthetic demonstration dataset CSV."""
    path = os.path.join(app.static_folder, "templates", "expanded_180d_synthetic_demo.csv")
    if not os.path.exists(path):
        export_expanded_demo_csv(path)
    return send_file(path, as_attachment=True, download_name="expanded_180d_synthetic_demo.csv", mimetype="text/csv")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n========================================================")
    print(f"  HeatWise — Local Heat Alert Learning Dashboard")
    print(f"  Indian Public Health & Disaster Management System")
    print(f"  Starting local server at http://127.0.0.1:{port}")
    print(f"========================================================\n")
    app.run(host="0.0.0.0", port=port, debug=True)

"""
Unit tests for HeatWise Analytics, Guardrails, and Held-Out Validation Logic.
"""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analytics import calculate_heat_index, assess_data_quality, analyze_candidate_thresholds
from synthetic_generator import generate_district_dataset, EXPANDED_DISTRICTS


class TestHeatWiseAnalytics(unittest.TestCase):

    def test_heat_index_calculation(self):
        # Known test point: 35C (95F), 60% humidity -> high heat index > 43C
        hi = calculate_heat_index(35.0, 60.0)
        self.assertGreater(hi, 43.0)
        self.assertLess(hi, 55.0)

        # Mild temperature
        hi_mild = calculate_heat_index(24.0, 50.0)
        self.assertAlmostEqual(hi_mild, 24.0, delta=2.5)

    def test_data_quality_assessment(self):
        # Clean dataset
        clean_records = generate_district_dataset("IND_GJ_AHM", "ahmedabad_arid", days=60, seed=1)
        res_clean = assess_data_quality(clean_records)
        self.assertIn(res_clean["status"], ["Optimal", "Acceptable"])
        self.assertEqual(res_clean["valid_records"], 60)
        self.assertFalse(res_clean["insufficient_sample"])

        # Dataset with missing & unit errors
        dirty_records = [
            {"date": "2024-04-01", "district_id": "TEST", "max_temp_c": 38.0, "humidity_pct": 40.0, "heat_illness_cases": 5},
            {"date": "2024-04-02", "district_id": "TEST", "max_temp_c": 105.0, "humidity_pct": 30.0, "heat_illness_cases": 6},  # Fahrenheit!
            {"date": "2024-04-03", "district_id": "TEST", "max_temp_c": None, "humidity_pct": 35.0, "heat_illness_cases": 8},  # Missing temp
            {"date": "2024-04-04", "district_id": "TEST", "max_temp_c": 40.0, "humidity_pct": 120.0, "heat_illness_cases": 10}, # Humidity > 100%
            {"date": "2024-04-05", "district_id": "TEST", "max_temp_c": 41.0, "humidity_pct": 25.0, "heat_illness_cases": -2}, # Negative cases
        ]
        res_dirty = assess_data_quality(dirty_records)
        self.assertIn(res_dirty["status"], ["Degraded", "Critical"])
        self.assertGreater(res_dirty["metrics"]["unit_errors_count"], 0)
        self.assertTrue(res_dirty["insufficient_sample"])

    def test_insufficient_data_guardrail(self):
        # Generate only 14 days of sparse data
        sparse_records = generate_district_dataset("SPARSE", "sparse_demo", days=14, seed=42)
        analysis = analyze_candidate_thresholds(sparse_records)
        
        self.assertEqual(analysis["status"], "insufficient_data")
        # Requirement 6: Must display exactly "Insufficient evidence for a candidate."
        self.assertEqual(analysis["message"], "Insufficient evidence for a candidate.")
        self.assertEqual(len(analysis["candidates"]), 0)
        
        # Requirement 3: Must still return descriptive analysis
        self.assertIn("descriptive_analysis", analysis)
        desc = analysis["descriptive_analysis"]
        self.assertEqual(desc["sample_size"], 14)
        self.assertIn("weather_summary", desc)
        self.assertIn("health_summary", desc)
        self.assertGreater(desc["health_summary"]["total_cases"], 0)

        # Requirement 4: Must explain unmet requirements and additional data needed
        self.assertIn("requirements_status", analysis)
        self.assertIn("unmet_reasons", analysis)
        self.assertIn("additional_data_needed", analysis)
        self.assertIn("why_no_candidate", analysis)
        self.assertGreater(len(analysis["unmet_reasons"]), 0)

    def test_candidate_threshold_evaluation_with_held_out_validation(self):
        # 122 days of Ahmedabad data
        records = generate_district_dataset("IND_GJ_AHM", "ahmedabad_arid", days=122, seed=101)
        analysis = analyze_candidate_thresholds(records, primary_metric="max_temp_c")

        self.assertEqual(analysis["status"], "success")
        self.assertEqual(len(analysis["candidates"]), 3)
        self.assertGreater(analysis["n_calib"], 0)
        self.assertGreater(analysis["n_val"], 0)
        self.assertEqual(analysis["n_calib"] + analysis["n_val"], 122)

        yellow = analysis["candidates"][0]
        orange = analysis["candidates"][1]
        red = analysis["candidates"][2]

        self.assertEqual(yellow["tier_name"], "Yellow Alert")
        self.assertEqual(orange["tier_name"], "Orange Alert")
        self.assertEqual(red["tier_name"], "Red Alert")

        # Increasing thresholds
        self.assertLessEqual(yellow["candidate_value"], orange["candidate_value"])
        self.assertLessEqual(orange["candidate_value"], red["candidate_value"])

        # Held-out validation metrics must be present
        for c in analysis["candidates"]:
            self.assertEqual(c["disclaimer"], "For expert review — not an official alert threshold.")
            self.assertIn("CI:", c["uncertainty"])
            self.assertIn("val_sensitivity", c["validation_performance"])
            self.assertIn("val_specificity", c["validation_performance"])
            self.assertIn("val_ppv", c["validation_performance"])
            self.assertIn("val_youden_index", c["validation_performance"])

        # Correlation vs causation note must be present
        self.assertIn("Correlation vs Causation", analysis["correlation_causation_note"])

    def test_expanded_180d_synthetic_dataset(self):
        # Verify expanded dataset structure: 4 fictional districts, 180 days each
        self.assertIn("SYN_DIST_NORTH", EXPANDED_DISTRICTS)
        self.assertIn("SYN_DIST_COAST", EXPANDED_DISTRICTS)
        self.assertIn("SYN_DIST_PLATEAU", EXPANDED_DISTRICTS)
        self.assertIn("SYN_DIST_MILD", EXPANDED_DISTRICTS)

        north_recs = EXPANDED_DISTRICTS["SYN_DIST_NORTH"]["records"]
        self.assertEqual(len(north_recs), 180)
        self.assertEqual(north_recs[0]["date"], "2024-03-01")
        self.assertEqual(north_recs[-1]["date"], "2024-08-27")

        # Verify identifiable missing values
        dq = assess_data_quality(north_recs)
        self.assertGreater(dq["metrics"]["missing_temps"] + dq["metrics"]["missing_humidity"] + dq["metrics"]["missing_cases"], 0)
        self.assertIn(dq["status"], ["Optimal", "Acceptable"])

        # Running analysis on valid cleaned subset yields candidates
        res = analyze_candidate_thresholds(north_recs, primary_metric="max_temp_c")
        self.assertEqual(res["status"], "success")
        self.assertEqual(len(res["candidates"]), 3)
        self.assertEqual(res["sample_size"], 177) # 180 minus 3 rows with missing values

    def test_zero_held_out_surges_handling(self):
        # Test mild district where held-out validation has 0 surge events
        mild_recs = EXPANDED_DISTRICTS["SYN_DIST_MILD"]["records"]
        res = analyze_candidate_thresholds(mild_recs, primary_metric="max_temp_c")
        self.assertEqual(res["status"], "success")
        for cand in res["candidates"]:
            val_perf = cand["validation_performance"]
            if not val_perf["has_val_surges"]:
                self.assertIsNone(val_perf["val_sensitivity"])
                self.assertIsNotNone(val_perf["performance_note"])
                self.assertIn("Zero documented surge events", val_perf["performance_note"])
                self.assertIn("cannot be adequately evaluated", val_perf["performance_note"])

    def test_duplicate_dates_audit(self):
        records = [
            {"date": "2024-04-01", "district_id": "DIST_A", "max_temp_c": 38.0, "humidity_pct": 40.0, "heat_illness_cases": 5},
            {"date": "2024-04-01", "district_id": "DIST_A", "max_temp_c": 39.0, "humidity_pct": 38.0, "heat_illness_cases": 3}, # Duplicate!
            {"date": "2024-04-02", "district_id": "DIST_A", "max_temp_c": 40.0, "humidity_pct": 35.0, "heat_illness_cases": 7},
        ]
        dq = assess_data_quality(records)
        self.assertEqual(dq["metrics"]["duplicate_dates_count"], 1)
        dup_issue = next((iss for iss in dq["issues"] if iss["type"] == "duplicate_dates"), None)
        self.assertIsNotNone(dup_issue)

    def test_trend_metrics_descriptive_analysis(self):
        records = generate_district_dataset("IND_GJ_AHM", "ahmedabad_arid", days=60, seed=10)
        res = analyze_candidate_thresholds(records)
        desc = res["descriptive_analysis"]
        self.assertIn("trend", desc["weather_summary"]["temp"])
        self.assertIn("trend", desc["weather_summary"]["humidity"])
        self.assertIn("trend_summary", desc["health_summary"])
        self.assertIn("methodology_explanation", desc)
        self.assertIn("association_vs_causation", desc)


    def test_heatmap_seasonal_coverage_and_scaling(self):
        # Verify that records have valid calendar months for seasonal heatmap matrix
        north_recs = EXPANDED_DISTRICTS["SYN_DIST_NORTH"]["records"]
        months = set(r["date"][:7] for r in north_recs)
        # Should cover 6 months: March (03) through August (08)
        self.assertEqual(len(months), 6)
        self.assertIn("2024-03", months)
        self.assertIn("2024-08", months)

        # Verify heat values fall within expected heatmap bounds
        valid_temps = [r["max_temp_c"] for r in north_recs if isinstance(r["max_temp_c"], (int, float))]
        self.assertGreater(max(valid_temps), 42.0) # Confirms extreme heat detection
        self.assertLess(min(valid_temps), 35.0)


if __name__ == "__main__":
    unittest.main()

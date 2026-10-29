"""
API and Integration Tests for HeatWise Flask Backend
"""

import unittest
import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app


class TestHeatWiseAPI(unittest.TestCase):

    def setUp(self):
        self.client = app.test_client()

    def test_index_page(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        html = response.data.decode("utf-8")
        self.assertIn("HeatWise", html)
        self.assertIn("Local Heat Alert Learning System", html)
        self.assertIn("For expert review — not an official alert threshold", html)
        self.assertIn("Insufficient evidence for a candidate", html)

    def test_get_districts(self):
        response = self.client.get("/api/districts")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn("districts", data)
        self.assertGreaterEqual(len(data["districts"]), 5)

    def test_get_district_data(self):
        response = self.client.get("/api/data/IND_GJ_AHM")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["district"]["name"], "Ahmedabad")
        self.assertTrue(data["district"]["is_synthetic_demo"])
        self.assertIn("records", data)
        self.assertEqual(len(data["records"]), 122)

    def test_validate_csv_clean(self):
        csv_data = "date,district_id,max_temp_c,humidity_pct,heat_illness_cases\n2024-04-01,IND_TEST,38.5,35.0,7\n2024-04-02,IND_TEST,39.2,33.0,9\n"
        response = self.client.post("/api/validate_csv", data=csv_data, content_type="text/csv")
        self.assertEqual(response.status_code, 200)
        res = json.loads(response.data)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["total_rows"], 2)

    def test_validate_csv_aliases(self):
        # Test alias headers: district, temperature_c, humidity_percent, heat_cases
        csv_data = "date,district,temperature_c,humidity_percent,heat_cases\n2024-04-01,IND_TEST_ALIAS,39.5,42.0,11\n"
        response = self.client.post("/api/validate_csv", data=csv_data, content_type="text/csv")
        self.assertEqual(response.status_code, 200)
        res = json.loads(response.data)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["total_rows"], 1)
        self.assertIn("district", res["alias_matches"])
        self.assertIn("temperature_c", res["alias_matches"])

    def test_validate_csv_missing_columns(self):
        bad_csv = "date,max_temp_c\n2024-04-01,38.5\n"
        response = self.client.post("/api/validate_csv", data=bad_csv, content_type="text/csv")
        self.assertEqual(response.status_code, 422)
        res = json.loads(response.data)
        self.assertEqual(res["status"], "schema_error")

    def test_download_template(self):
        response = self.client.get("/api/download/template")
        self.assertEqual(response.status_code, 200)
        content = response.data.decode("utf-8")
        self.assertIn("date,district_id,max_temp_c,humidity_pct,heat_illness_cases", content)
        response.close()

    def test_download_expanded_demo(self):
        response = self.client.get("/api/download/expanded_demo")
        self.assertEqual(response.status_code, 200)
        content = response.data.decode("utf-8")
        self.assertIn("SYN_DIST_NORTH", content)
        self.assertIn("SYN_DIST_COAST", content)
        self.assertIn("SYN_DIST_PLATEAU", content)
        self.assertIn("SYN_DIST_MILD", content)
        response.close()

    def test_get_expanded_district_data(self):
        response = self.client.get("/api/data/SYN_DIST_NORTH")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["district"]["name"], "North Valley Basin (Fictional)")
        self.assertTrue(data["district"]["is_synthetic_demo"])
        self.assertEqual(len(data["records"]), 180)



if __name__ == "__main__":
    unittest.main()

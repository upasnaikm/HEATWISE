import unittest
import sys
import os

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, base_dir)

from app import app

class TestGeomapSmoke(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_root_serves_geomap_components(self):
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        html = res.data.decode('utf-8')

        required_strings = [
            "Geographical Heat Risk Map",
            "leaflet.css",
            "leaflet.js",
            "geoData.js",
            "geomap.js",
            'id="geomap"',
            'id="btnGeoMetricTemp"',
            'id="btnGeoMetricHumidity"',
            'id="btnGeoMetricCases"',
            'id="btnGeoMetricAlert"',
            'id="geomapLegendScale"',
            'id="geomapNonGeocodedWarning"',
            'id="geomapInspectorCard"',
            "SYNTHETIC DEMO DATA",
            "For expert review"
        ]

        for s in required_strings:
            self.assertIn(s, html, f"Missing required string in rendered template: {s}")

    def test_standalone_index_has_geomap(self):
        index_path = os.path.join(base_dir, "index.html")
        with open(index_path, "r", encoding="utf-8") as f:
            html = f.read()

        required_strings = [
            "Geographical Heat Risk Map",
            "leaflet.css",
            "leaflet.js",
            'id="geomap"',
            'id="btnGeoMetricTemp"',
            'id="btnGeoMetricHumidity"',
            'id="btnGeoMetricCases"',
            'id="btnGeoMetricAlert"',
            'id="geomapLegendScale"',
            'HeatWiseGeoData',
            'HeatWiseGeoMap'
        ]

        for s in required_strings:
            self.assertIn(s, html, f"Missing in standalone index.html: {s}")

if __name__ == "__main__":
    unittest.main()

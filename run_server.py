"""
HeatWise Server Launcher
Runs the Flask application on port 5000.
"""

import sys
import os

# Ensure current directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n========================================================")
    print(f"  HeatWise — Local Heat Alert Learning Dashboard")
    print(f"  Indian Public Health & Disaster Management System")
    print(f"  Running at http://127.0.0.1:{port}")
    print(f"========================================================\n")
    app.run(host="127.0.0.1", port=port, debug=False)

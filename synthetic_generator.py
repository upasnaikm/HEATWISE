"""
HeatWise - Data Generation & Statistical Baseline Utility
Generates realistic, clearly labeled synthetic meteorological and heat-illness counts
for demonstration and testing of the HeatWise Public Health Dashboard.

NOTICE & SAFEGUARDS:
All generated datasets are SYNTHETIC DEMONSTRATION DATA — NOT REAL OBSERVATIONS.
They do NOT represent actual Indian weather, real hospital emergency records,
or documented historical surge events. They must never be used to claim real-world
medical thresholds or official heatwave alerts.
"""

import math
import random
import os
import csv
from datetime import date, timedelta


def calculate_heat_index_c(temp_c: float, humidity_pct: float) -> float:
    """Calculate Steadman/Rothfusz Heat Index in Celsius."""
    temp_f = (temp_c * 9.0 / 5.0) + 32.0
    rh = max(0.0, min(100.0, humidity_pct))

    # Rothfusz regression
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


def generate_district_dataset(district_id: str, profile: str, days: int = 122, seed: int = 42):
    """
    Generates standard synthetic daily observation records (122-day regional climates).
    """
    random.seed(seed)
    records = []
    start_date = date(2024, 4, 1)

    for i in range(days):
        cur_date = start_date + timedelta(days=i)
        season_curve = math.sin((i / max(1, days)) * math.pi)

        if profile == 'ahmedabad_arid':
            base_temp = 37.0 + season_curve * 6.5
            temp_noise = random.gauss(0, 1.6)
            max_temp = round(base_temp + temp_noise, 1)
            if 45 <= i <= 55 or 70 <= i <= 75:
                max_temp += random.uniform(1.8, 3.2)
            max_temp = round(max(32.0, min(47.5, max_temp)), 1)
            humidity = round(max(15.0, min(55.0, 32.0 - (max_temp - 38.0) * 1.2 + random.gauss(0, 5))), 1)

            excess = max(0.0, max_temp - 40.5)
            cases = int(max(0, 5 + (excess ** 2.1) * 2.8 + random.gauss(0, 3)))

        elif profile == 'bhubaneswar_coastal':
            base_temp = 34.0 + season_curve * 4.2
            max_temp = round(max(29.0, min(41.5, base_temp + random.gauss(0, 1.3))), 1)
            humidity = round(max(55.0, min(92.0, 74.0 + random.gauss(0, 6.5))), 1)
            hi = calculate_heat_index_c(max_temp, humidity)
            excess_hi = max(0.0, hi - 43.0)
            cases = int(max(0, 4 + (excess_hi ** 1.9) * 2.2 + random.gauss(0, 2.5)))

        elif profile == 'nagpur_inland':
            base_temp = 39.0 + season_curve * 6.0
            max_temp = round(max(33.0, min(48.2, base_temp + random.gauss(0, 1.8))), 1)
            humidity = round(max(12.0, min(42.0, 24.0 + random.gauss(0, 4.0))), 1)
            excess = max(0.0, max_temp - 42.0)
            cases = int(max(0, 6 + (excess ** 2.2) * 3.1 + random.gauss(0, 3.5)))

        elif profile == 'delhi_composite':
            base_temp = 36.5 + season_curve * 5.8
            max_temp = round(max(31.0, min(46.0, base_temp + random.gauss(0, 1.5))), 1)
            humidity = round(max(25.0, min(70.0, 45.0 - (max_temp - 36.0) * 1.0 + random.gauss(0, 7.0))), 1)
            excess = max(0.0, max_temp - 41.0)
            cases = int(max(0, 5 + (excess ** 2.0) * 2.6 + random.gauss(0, 3.0)))

        elif profile == 'sparse_demo':
            max_temp = round(34.0 + random.uniform(0.5, 3.0), 1)
            humidity = round(50.0 + random.uniform(-5, 5), 1)
            cases = random.randint(1, 4)

        else:
            max_temp = 35.0
            humidity = 50.0
            cases = 5

        records.append({
            "date": cur_date.isoformat(),
            "district_id": district_id,
            "max_temp_c": max_temp,
            "humidity_pct": humidity,
            "heat_illness_cases": cases,
        })

    return records


def generate_expanded_180d_district(district_id: str, profile: str, seed: int = 707):
    """
    Generates 180 consecutive calendar days (2024-03-01 to 2024-08-27) for a fictional district.
    Injects a small number of clearly identifiable missing values for data-quality auditing.
    """
    random.seed(seed)
    records = []
    start_date = date(2024, 3, 1)  # 180 days: March 1, 2024 to August 27, 2024
    days = 180

    for i in range(days):
        cur_date = start_date + timedelta(days=i)
        # Seasonal warming curve peaking in late May / June (around day 80-105)
        summer_phase = math.sin((i / max(1, days)) * math.pi)

        if profile == 'fictional_north_arid':
            # Semi-arid valley: dry heat, high peak temps, low humidity
            base_temp = 34.0 + summer_phase * 10.5
            temp_noise = random.gauss(0, 1.5)
            max_temp = round(base_temp + temp_noise, 1)
            # Simulated heatwave waves in late May and early June
            if 75 <= i <= 88 or 100 <= i <= 108:
                max_temp += random.uniform(2.0, 4.0)
            max_temp = round(max(28.0, min(47.8, max_temp)), 1)
            humidity = round(max(14.0, min(58.0, 35.0 - (max_temp - 36.0) * 1.3 + random.gauss(0, 4.5))), 1)
            excess = max(0.0, max_temp - 41.0)
            cases = int(max(0, 4 + (excess ** 2.1) * 3.2 + random.gauss(0, 2.8)))

            # Insert identifiable missing values
            if i == 41:  # Day 42 (2024-04-11): missing max_temp_c
                max_temp = ""
            elif i == 114:  # Day 115 (2024-06-23): missing humidity_pct
                humidity = ""
            elif i == 159:  # Day 160 (2024-08-07): missing heat_illness_cases
                cases = ""

        elif profile == 'fictional_coastal_humid':
            # Maritime littoral: moderate dry-bulb (31-39C), high humidity (62-92%), high Heat Index
            base_temp = 31.5 + summer_phase * 6.5
            max_temp = round(max(28.0, min(40.5, base_temp + random.gauss(0, 1.2))), 1)
            humidity = round(max(58.0, min(94.0, 76.0 + random.gauss(0, 6.0))), 1)
            hi = calculate_heat_index_c(max_temp, humidity)
            excess_hi = max(0.0, hi - 43.5)
            cases = int(max(0, 3 + (excess_hi ** 1.95) * 2.3 + random.gauss(0, 2.2)))

            # Insert identifiable missing values
            if i == 34:  # Day 35 (2024-04-04): missing humidity
                humidity = ""
            elif i == 97:  # Day 98 (2024-06-06): missing temperature
                max_temp = ""

        elif profile == 'fictional_central_plateau':
            # Continental plateau: high dry-bulb, moderate humidity, pronounced early summer
            base_temp = 33.0 + summer_phase * 9.8
            max_temp = round(max(30.0, min(46.5, base_temp + random.gauss(0, 1.6))), 1)
            humidity = round(max(16.0, min(52.0, 30.0 - (max_temp - 37.0) * 1.1 + random.gauss(0, 4.0))), 1)
            excess = max(0.0, max_temp - 41.5)
            cases = int(max(0, 4 + (excess ** 2.05) * 2.9 + random.gauss(0, 2.5)))

            # Insert identifiable missing values
            if i == 21:  # Day 22 (2024-03-22): missing temperature
                max_temp = ""
            elif i == 144:  # Day 145 (2024-07-23): missing humidity
                humidity = ""

        elif profile == 'fictional_mild_upland':
            # Temperate upland: moderate temps (23-35C)
            # Surges occur strictly in the calibration partition (days 40-52); ZERO surges in held-out validation (days 126-179)
            base_temp = 25.0 + summer_phase * 5.5
            max_temp = round(max(21.0, min(35.5, base_temp + random.gauss(0, 1.1))), 1)
            humidity = round(max(40.0, min(75.0, 55.0 + random.gauss(0, 5.0))), 1)
            if 40 <= i <= 52:
                max_temp = round(max_temp + random.uniform(2.5, 4.0), 1)
                cases = random.randint(8, 12)
            else:
                cases = random.randint(1, 3)

            # Insert identifiable missing values
            if i == 74:  # Day 75 (2024-05-14): missing cases
                cases = ""

        else:
            max_temp = 32.0
            humidity = 50.0
            cases = 4

        records.append({
            "date": cur_date.isoformat(),
            "district_id": district_id,
            "max_temp_c": max_temp,
            "humidity_pct": humidity,
            "heat_illness_cases": cases,
        })

    return records


# Expanded 180-Day Demonstration Library (Fictional Districts)
EXPANDED_DISTRICTS = {
    "SYN_DIST_NORTH": {
        "id": "SYN_DIST_NORTH",
        "name": "North Valley Basin (Fictional)",
        "state": "Northern Sector",
        "zone": "Semi-Arid Basin (Dry Extreme Heat)",
        "badge": "180-Day Arid Extreme Heat",
        "badge_color": "amber",
        "notes": "Fictional 180-day synthetic dataset (1 Mar – 27 Aug 2024). Models severe dry-bulb heatwave escalation with intentional missing values on Days 42, 115, and 160.",
        "records": generate_expanded_180d_district("SYN_DIST_NORTH", "fictional_north_arid", seed=701)
    },
    "SYN_DIST_COAST": {
        "id": "SYN_DIST_COAST",
        "name": "Coastal Haven (Fictional)",
        "state": "Eastern Littoral",
        "zone": "Maritime Humid Littoral (High Heat Index)",
        "badge": "180-Day Coastal Humid Stress",
        "badge_color": "teal",
        "notes": "Fictional 180-day synthetic dataset (1 Mar – 27 Aug 2024). Demonstrates maritime conditions where high humidity elevates Heat Index even at 34–38°C dry-bulb.",
        "records": generate_expanded_180d_district("SYN_DIST_COAST", "fictional_coastal_humid", seed=702)
    },
    "SYN_DIST_PLATEAU": {
        "id": "SYN_DIST_PLATEAU",
        "name": "Central Plateau (Fictional)",
        "state": "Central Uplands",
        "zone": "High-Plateau Continental",
        "badge": "180-Day Plateau Heat",
        "badge_color": "orange",
        "notes": "Fictional 180-day synthetic dataset (1 Mar – 27 Aug 2024). Continental summer patterns with prolonged high temperature exposure.",
        "records": generate_expanded_180d_district("SYN_DIST_PLATEAU", "fictional_central_plateau", seed=703)
    },
    "SYN_DIST_MILD": {
        "id": "SYN_DIST_MILD",
        "name": "Upland Mild Basin (Fictional)",
        "state": "Montane Sector",
        "zone": "Temperate Upland (Zero Held-Out Surges)",
        "badge": "Zero Held-Out Surges Demo",
        "badge_color": "gray",
        "notes": "Fictional 180-day synthetic dataset with zero surge events in the held-out validation partition. Used to verify event-detection guardrails.",
        "records": generate_expanded_180d_district("SYN_DIST_MILD", "fictional_mild_upland", seed=704)
    }
}


def export_expanded_demo_csv(output_path: str = None) -> str:
    """Exports the 180-day multi-district synthetic demo dataset to CSV format."""
    if not output_path:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        output_path = os.path.join(base_dir, "static", "templates", "expanded_180d_synthetic_demo.csv")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "district_id", "max_temp_c", "humidity_pct", "heat_illness_cases"])
        for d_id, info in EXPANDED_DISTRICTS.items():
            for rec in info["records"]:
                writer.writerow([
                    rec["date"],
                    rec["district_id"],
                    rec["max_temp_c"],
                    rec["humidity_pct"],
                    rec["heat_illness_cases"]
                ])
    return output_path


if __name__ == "__main__":
    csv_file = export_expanded_demo_csv()
    print(f"Exported expanded 180-day synthetic dataset to {csv_file}")
    total_recs = sum(len(info["records"]) for info in EXPANDED_DISTRICTS.values())
    print(f"Total synthetic records: {total_recs} across {len(EXPANDED_DISTRICTS)} fictional districts.")

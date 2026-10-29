"""
Synchronizes standalone index.html with:
1. static/css/styles.css (embedded in <style>)
2. templates/index.html (HTML layout and components)
3. static/js/*.js (embedded in <script>)
"""
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
tpl_path = os.path.join(base_dir, "templates", "index.html")
css_path = os.path.join(base_dir, "static", "css", "styles.css")
index_path = os.path.join(base_dir, "index.html")

with open(tpl_path, "r", encoding="utf-8") as f:
    tpl_html = f.read()

with open(css_path, "r", encoding="utf-8") as f:
    css_content = f.read()

js_files = [
    "syntheticData.js",
    "analytics.js",
    "charts.js",
    "dataQuality.js",
    "geoData.js",
    "geomap.js",
    "app.js"
]

modules = []
for js_file in js_files:
    file_path = os.path.join(base_dir, "static", "js", js_file)
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        diff = content.count("{") - content.count("}")
        print(f"File {js_file}: braces diff = {diff}")
        modules.append(f"  /* --- EMBEDDED MODULE: {js_file} --- */\n" + content)

full_js = "\n\n".join(modules)

# Extract body content from templates/index.html
# Between <body> and <!-- Scripts -->
body_start = tpl_html.find("<body>") + len("<body>")
scripts_start = tpl_html.find("<!-- Scripts -->")
body_content = tpl_html[body_start:scripts_start].strip()

standalone_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HeatWise — Local Heat Alert Learning Dashboard</title>
  
  <!-- Inter & Mono Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  
  <!-- Chart.js CDN (with native Canvas fallback engine for 100% offline resilience) -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

  <!-- Leaflet CDN for Geographical Heat Risk Map (with automatic offline vector fallback) -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <style>
{css_content}
  </style>
</head>
<body>

{body_content}

  <script>
{full_js}
  </script>
</body>
</html>
"""

with open(index_path, "w", encoding="utf-8") as f:
    f.write(standalone_html)

print("index.html fully synchronized with template, CSS, and modular scripts!")

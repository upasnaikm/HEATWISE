"""
Validator script to verify JavaScript syntax, bracket balance, DOM IDs referenced vs defined in HTML.
Checks both standalone index.html and templates/index.html + static/js/app.js.
"""

import re
import os

root_dir = os.path.dirname(os.path.dirname(__file__))

# 1. Check index.html (standalone mode)
index_html_path = os.path.join(root_dir, "index.html")
with open(index_html_path, "r", encoding="utf-8") as f:
    html = f.read()

js_blocks = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)
assert len(js_blocks) >= 1, "No inline script found in index.html"
js = js_blocks[0]

html_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html))
js_referenced_ids = set(re.findall(r'getElementById\(["\']([^"\']+)["\']\)', js))

allowed_dynamic = {
    "appToast", "modalReviewStatusSelect", "modalReviewerNote",
    "csvFileInput", "optUploadedFile", "bannerDistrictName",
    "uploadedFilenameLabel", "currentDistrictName", "currentDistrictZone",
    "csvSuccessDetails", "csvErrorMessage", "csvErrorList", "csvErrorTitle"
}
missing_in_html = (js_referenced_ids - html_ids) - allowed_dynamic

print(f"[Standalone index.html] HTML IDs: {len(html_ids)}, JS IDs referenced: {len(js_referenced_ids)}")
assert len(missing_in_html) == 0, f"Missing IDs in standalone index.html: {missing_in_html}"

braces = js.count('{') - js.count('}')
parens = js.count('(') - js.count(')')
brackets = js.count('[') - js.count(']')
assert braces == 0, f"Braces mismatch in index.html: {braces}"
assert parens == 0, f"Parens mismatch in index.html: {parens}"
assert brackets == 0, f"Brackets mismatch in index.html: {brackets}"

# 2. Check templates/index.html + static/js/app.js (Flask mode)
tpl_path = os.path.join(root_dir, "templates", "index.html")
app_js_path = os.path.join(root_dir, "static", "js", "app.js")

with open(tpl_path, "r", encoding="utf-8") as f:
    tpl_html = f.read()

with open(app_js_path, "r", encoding="utf-8") as f:
    app_js = f.read()

tpl_ids = set(re.findall(r'id=["\']([^"\']+)["\']', tpl_html))
app_js_referenced_ids = set(re.findall(r'getElementById\(["\']([^"\']+)["\']\)', app_js))
missing_in_tpl = (app_js_referenced_ids - tpl_ids) - allowed_dynamic

print(f"[Flask templates/index.html] Template IDs: {len(tpl_ids)}, app.js IDs referenced: {len(app_js_referenced_ids)}")
assert len(missing_in_tpl) == 0, f"Missing IDs in templates/index.html: {missing_in_tpl}"

app_braces = app_js.count('{') - app_js.count('}')
app_parens = app_js.count('(') - app_js.count(')')
app_brackets = app_js.count('[') - app_js.count(']')
assert app_braces == 0, f"Braces mismatch in app.js: {app_braces}"
assert app_parens == 0, f"Parens mismatch in app.js: {app_parens}"
assert app_brackets == 0, f"Brackets mismatch in app.js: {app_brackets}"

print("\nALL INLINE AND MODULAR JS/DOM CHECKS PASSED PERFECTLY!")

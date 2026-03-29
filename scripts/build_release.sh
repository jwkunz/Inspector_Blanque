#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(tr -d '[:space:]' < "${ROOT_DIR}/VERSION")"
if [[ -z "${VERSION}" ]]; then
  echo "VERSION file is empty." >&2
  exit 1
fi

VERSION_TAG="${VERSION//./_}"
DIST_DIR="${ROOT_DIR}/dist"
OUTPUT_FILE="${DIST_DIR}/Inspector_Blanque_v${VERSION_TAG}_single_file.html"

mkdir -p "${DIST_DIR}"
find "${DIST_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

python3 - "${ROOT_DIR}" "${OUTPUT_FILE}" <<'PY'
import base64
import json
import mimetypes
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
output_file = pathlib.Path(sys.argv[2])


def read_text(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def data_url(path: pathlib.Path) -> str:
    mime_type, _ = mimetypes.guess_type(path.name)
    if not mime_type:
        mime_type = "application/octet-stream"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


index_html = read_text(root / "index.html")
styles_css = read_text(root / "styles.css")
app_js = read_text(root / "app.js")
chess_js = read_text(root / "vendor/chess/chess.js")
stockfish_js = read_text(root / "vendor/stockfish/stockfish-18-lite-single.js")
stockfish_wasm_url = data_url(root / "vendor/stockfish/stockfish-18-lite-single.wasm")

logo_paths = [
    root / "Inspector_Blanque_logo.png",
    root / "Inspector_Blanque.png",
]
logo_urls = [data_url(path) for path in logo_paths if path.exists()]
primary_logo_url = logo_urls[0] if logo_urls else ""
fallback_logo_urls = logo_urls[1:] if len(logo_urls) > 1 else []

piece_paths = {
    "./vendor/pieces/cburnett/Chess_plt45.svg": root / "vendor/pieces/cburnett/Chess_plt45.svg",
    "./vendor/pieces/cburnett/Chess_nlt45.svg": root / "vendor/pieces/cburnett/Chess_nlt45.svg",
    "./vendor/pieces/cburnett/Chess_blt45.svg": root / "vendor/pieces/cburnett/Chess_blt45.svg",
    "./vendor/pieces/cburnett/Chess_rlt45.svg": root / "vendor/pieces/cburnett/Chess_rlt45.svg",
    "./vendor/pieces/cburnett/Chess_qlt45.svg": root / "vendor/pieces/cburnett/Chess_qlt45.svg",
    "./vendor/pieces/cburnett/Chess_klt45.svg": root / "vendor/pieces/cburnett/Chess_klt45.svg",
    "./vendor/pieces/cburnett/Chess_pdt45.svg": root / "vendor/pieces/cburnett/Chess_pdt45.svg",
    "./vendor/pieces/cburnett/Chess_ndt45.svg": root / "vendor/pieces/cburnett/Chess_ndt45.svg",
    "./vendor/pieces/cburnett/Chess_bdt45.svg": root / "vendor/pieces/cburnett/Chess_bdt45.svg",
    "./vendor/pieces/cburnett/Chess_rdt45.svg": root / "vendor/pieces/cburnett/Chess_rdt45.svg",
    "./vendor/pieces/cburnett/Chess_qdt45.svg": root / "vendor/pieces/cburnett/Chess_qdt45.svg",
    "./vendor/pieces/cburnett/Chess_kdt45.svg": root / "vendor/pieces/cburnett/Chess_kdt45.svg",
}

for original_path, resolved_path in piece_paths.items():
    app_js = app_js.replace(original_path, data_url(resolved_path))

if primary_logo_url:
    index_html = index_html.replace('./Inspector_Blanque_logo.png', primary_logo_url)
    app_js = app_js.replace('./Inspector_Blanque_logo.png', primary_logo_url)

for fallback_name, fallback_url in (
    ("./Inspector_Blanque.png", fallback_logo_urls[0] if fallback_logo_urls else primary_logo_url),
):
    app_js = app_js.replace(fallback_name, fallback_url)

app_js = re.sub(
    r'^import\s+\{\s*Chess,\s*validateFen\s*\}\s+from\s+"\.\/vendor\/chess\/chess\.js";\n',
    "",
    app_js,
    count=1,
    flags=re.MULTILINE,
)
app_js = app_js.replace(
    'const ENGINE_PATH = "./vendor/stockfish/stockfish-18-lite-single.js";',
    'const ENGINE_PATH = window.__INSPECTOR_STOCKFISH_WORKER_URL__;',
)

chess_js = re.sub(r"\nexport\s+\{[^}]+\};\s*$", "\n", chess_js, flags=re.MULTILINE)
chess_js = re.sub(r"\n//# sourceMappingURL=.*\n?$", "\n", chess_js, flags=re.MULTILINE)

inline_module = f"""
const stockfishSource = {json.dumps(stockfish_js)};
const stockfishWasmDataUrl = {json.dumps(stockfish_wasm_url)};
const stockfishWorkerBlob = new Blob([stockfishSource], {{ type: "application/javascript" }});
const stockfishWorkerBaseUrl = URL.createObjectURL(stockfishWorkerBlob);
window.__INSPECTOR_STOCKFISH_WORKER_URL__ = `${{stockfishWorkerBaseUrl}}#${{encodeURIComponent(stockfishWasmDataUrl)}},worker`;
window.addEventListener("pagehide", () => {{
  try {{
    URL.revokeObjectURL(stockfishWorkerBaseUrl);
  }} catch (_error) {{
  }}
}});

{chess_js}
{app_js}
""".strip()

inline_module = inline_module.replace("</script>", "<\\/script>")
styles_css = styles_css.replace("</style>", "<\\/style>")

index_html = index_html.replace(
    '<link rel="stylesheet" href="styles.css" />',
    f"<style>\n{styles_css}\n</style>",
)
index_html = index_html.replace(
    '<script type="module" src="app.js"></script>',
    f'<script type="module">\n{inline_module}\n</script>',
)

output_file.write_text(index_html, encoding="utf-8")
PY

echo "Built ${OUTPUT_FILE}"

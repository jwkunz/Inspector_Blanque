#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(tr -d '[:space:]' < "${ROOT_DIR}/VERSION")"
if [[ -z "${VERSION}" ]]; then
  echo "VERSION file is empty." >&2
  exit 1
fi

VERSION_TAG="${VERSION//./_}"
RELEASE_BASENAME="Inspector_Blanque_v${VERSION_TAG}"
DIST_DIR="${ROOT_DIR}/dist"
STAGE_DIR="${DIST_DIR}/${RELEASE_BASENAME}"
ZIP_PATH="${DIST_DIR}/${RELEASE_BASENAME}.zip"

rm -rf "${STAGE_DIR}" "${ZIP_PATH}"
mkdir -p "${STAGE_DIR}"

cp "${ROOT_DIR}/index.html" "${STAGE_DIR}/Inspector_Blanque.html"
cp "${ROOT_DIR}/styles.css" "${STAGE_DIR}/"
cp "${ROOT_DIR}/app.js" "${STAGE_DIR}/"
cp "${ROOT_DIR}/README.md" "${STAGE_DIR}/"
cp "${ROOT_DIR}/MIT_LICENSE.txt" "${STAGE_DIR}/"
cp "${ROOT_DIR}/VERSION" "${STAGE_DIR}/"

if [[ -f "${ROOT_DIR}/Inspector_Blanque.png" ]]; then
  cp "${ROOT_DIR}/Inspector_Blanque.png" "${STAGE_DIR}/"
fi
if [[ -f "${ROOT_DIR}/Inspector_Blanque_logo.png" ]]; then
  cp "${ROOT_DIR}/Inspector_Blanque_logo.png" "${STAGE_DIR}/"
fi

cp -R "${ROOT_DIR}/vendor" "${STAGE_DIR}/vendor"

if command -v zip >/dev/null 2>&1; then
  (
    cd "${DIST_DIR}"
    zip -qr "${RELEASE_BASENAME}.zip" "${RELEASE_BASENAME}"
  )
else
  python3 - <<PY
import pathlib
import zipfile

dist = pathlib.Path(${DIST_DIR@Q})
base = ${RELEASE_BASENAME@Q}
zip_path = pathlib.Path(${ZIP_PATH@Q})
root = dist / base

with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for p in root.rglob('*'):
        if p.is_file():
            zf.write(p, p.relative_to(dist))
PY
fi

echo "Built ${ZIP_PATH}"

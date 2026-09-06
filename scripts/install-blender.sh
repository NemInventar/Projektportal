#!/usr/bin/env bash
# Installerer Blender i den midlertidige web-session-container.
#
# Hvorfor: containeren er tom hver gang en Claude Code-websession starter,
# så Blender skal hentes forfra. Scriptet er idempotent — er Blender der
# allerede, gør det ingenting.
#
# Kør manuelt:  bash scripts/install-blender.sh
# Kører automatisk via SessionStart-hooken i .claude/settings.json.
set -euo pipefail

VERSION="4.5.13"                 # LTS — supporteres til 2027
SERIES="4.5"
SHA256="da4e69b06b75b9e642d106496c50e7e240218b411d2f6e18271c1d1d819cef91"
PREFIX="/opt/blender"
TARBALL="blender-${VERSION}-linux-x64.tar.xz"
URL="https://download.blender.org/release/Blender${SERIES}/${TARBALL}"

if [ -x "${PREFIX}/blender" ]; then
  echo "Blender ${VERSION} er der allerede — springer over."
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

echo "Henter Blender ${VERSION} (ca. 360 MB)..."
curl -fsSL --retry 3 --retry-delay 2 -o "${TMP}/${TARBALL}" "${URL}"

echo "${SHA256}  ${TMP}/${TARBALL}" | sha256sum -c -

echo "Pakker ud til ${PREFIX}..."
mkdir -p "${PREFIX}"
tar -xf "${TMP}/${TARBALL}" -C "${PREFIX}" --strip-components=1
ln -sf "${PREFIX}/blender" /usr/local/bin/blender

"${PREFIX}/blender" --version | head -1

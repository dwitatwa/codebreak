#!/usr/bin/env bash
# codebreak installer for Linux.
# Usage: curl -fsSL https://raw.githubusercontent.com/dwitatwa/codebreak/main/install.sh | bash
set -euo pipefail

REPO="dwitatwa/codebreak"
INSTALL_DIR="${CODEBREAK_INSTALL_DIR:-$HOME/.local/bin}"

os="$(uname -s)"
arch="$(uname -m)"
if [ "$os" != "Linux" ]; then
  echo "Unsupported OS: $os (this installer supports Linux; Windows uses install.ps1)" >&2
  exit 1
fi
case "$arch" in
  x86_64|amd64) arch_target="x64" ;;
  aarch64|arm64) arch_target="arm64" ;;
  *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
esac

asset="codebreak-${os_target}-${arch_target}"
echo "→ Downloading ${asset} from github.com/${REPO} ..."

download_url="$(
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep -o "https://[^\"]*/${asset}\"" \
    | head -1 \
    | sed 's/"$//'
)"
if [ -z "${download_url}" ]; then
  echo "No release found for ${asset}. Check https://github.com/${REPO}/releases" >&2
  exit 1
fi

tmp_file="$(mktemp /tmp/codebreak.XXXXXX)"
curl -fSL --progress-bar -o "$tmp_file" "$download_url"
chmod +x "$tmp_file"

mkdir -p "$INSTALL_DIR"
mv "$tmp_file" "${INSTALL_DIR}/codebreak"

case ":$PATH:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    echo ""
    echo "⚠ ${INSTALL_DIR} is not in your PATH. Add this to ~/.bashrc or ~/.zshrc:"
    echo "    export PATH=\"\$PATH:${INSTALL_DIR}\""
    ;;
esac

echo ""
echo "✓ codebreak installed at ${INSTALL_DIR}/codebreak"
echo "  Try: codebreak doctor"

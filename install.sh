#!/usr/bin/env bash
# codebreak installer for Linux.
# Usage: curl -fsSL https://raw.githubusercontent.com/dwitatwa/codebreak/main/install.sh | bash
#
# Private repo? Authenticate first (`gh auth login`) or export GH_TOKEN=<pat>
# so this script can access the release.
set -euo pipefail

REPO="dwitatwa/codebreak"
INSTALL_DIR="${CODEBREAK_INSTALL_DIR:-$HOME/.local/bin}"

os="$(uname -s)"
arch="$(uname -m)"
if [ "$os" != "Linux" ]; then
  echo "Unsupported OS: $os (this installer supports Linux; Windows uses install.ps1)" >&2
  exit 1
fi
os_target="linux"
case "$arch" in
  x86_64|amd64) arch_target="x64" ;;
  aarch64|arm64) arch_target="arm64" ;;
  *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
esac

asset="codebreak-${os_target}-${arch_target}"
tmp_file="$(mktemp /tmp/codebreak.XXXXXX)"

# Preferred path: gh CLI (required for private repos, simplest for public ones)
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "→ Downloading ${asset} from github.com/${REPO} (via gh) ..."
  gh release download --repo "$REPO" --pattern "$asset" --output "$tmp_file" --clobber
else
  # Public-repo fallback: plain curl against the latest release
  echo "→ Downloading ${asset} from github.com/${REPO} ..."
  download_url="$(
    curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep -o "browser_download_url\": \"[^\"]*/${asset}\"" \
      | head -1 \
      | sed 's/.*: "//; s/"$//'
  )"
  if [ -z "${download_url}" ]; then
    echo "No release found for ${asset}." >&2
    echo "If ${REPO} is private, authenticate first: gh auth login" >&2
    exit 1
  fi
  curl -fsSL --progress-bar -o "$tmp_file" "$download_url"
fi

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

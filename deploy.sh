#!/usr/bin/env bash
# One-shot deploy: GitHub (private repo) + Vercel (production).
# CLIs (gh, vercel) are already installed. This will open your browser to log in
# the first time — that's the only step that must be done by you.
set -e

REPO_NAME="${1:-mst-golf-crm}"
VISIBILITY="${2:---private}"   # pass --public to make it public

# Make sure the Vercel CLI (installed under ~/.hermes/node) is on PATH.
export PATH="$HOME/.hermes/node/bin:$PATH"

cd "$(dirname "$0")"

echo "▶ 1/2  GitHub"
if ! gh auth status >/dev/null 2>&1; then
  echo "   logging in to GitHub (browser will open)…"
  gh auth login
fi
if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin main
else
  gh repo create "$REPO_NAME" "$VISIBILITY" --source=. --remote=origin --push
fi
echo "   ✓ pushed to GitHub"

echo "▶ 2/2  Vercel"
echo "   (log in if prompted; accept the detected settings — vercel.json is preconfigured)"
vercel --prod

echo "✅ Done. Your live URL is shown above."

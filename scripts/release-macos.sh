#!/usr/bin/env bash
# Builds a signed and notarized Jot.app (plus a DMG to share) and checks that macOS accepts it.
#
# Reads the signing settings from ~/.jot-signing.env (or the file in $JOT_SIGNING_ENV), kept outside this repo:
#
#   export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
#   export APPLE_TEAM_ID="TEAMID"
#   export APPLE_ID="you@example.com"
#   export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # app-specific password from account.apple.com
#   export TAURI_SIGNING_PRIVATE_KEY="$HOME/.tauri/jot-updater.key"   # signs updates; Jot only installs updates signed with it
#   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="…"
#
# Release notes for the update prompt can be passed as JOT_RELEASE_NOTES="…".
#
# Usage: bun run app:release                                      (this Mac's architecture)
#        bun run app:release -- --target universal-apple-darwin   (Apple silicon + Intel)
set -euo pipefail

signing_env_file="${JOT_SIGNING_ENV:-$HOME/.jot-signing.env}"
repository_root="$(cd "$(dirname "$0")/.." && pwd)"

fail() {
  echo "error: $1" >&2
  exit 1
}

[[ -f "$signing_env_file" ]] || fail "No signing settings at $signing_env_file. See the note at the top of this script."
set -a
# shellcheck source=/dev/null
source "$signing_env_file"
set +a

for variable in APPLE_SIGNING_IDENTITY APPLE_TEAM_ID APPLE_ID APPLE_PASSWORD TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PASSWORD; do
  [[ -n "${!variable:-}" ]] || fail "$variable isn't set in $signing_env_file."
done

# Signing needs the certificate (with its private key) in the Keychain, not just its name.
installed_identities="$(security find-identity -v -p codesigning)"
if ! grep -qF "\"$APPLE_SIGNING_IDENTITY\"" <<<"$installed_identities"; then
  # The certificate is named after the team's account holder, which may not be the name you expect.
  same_team_identity="$(sed -nE "s/.*\"(Developer ID Application: .*\($APPLE_TEAM_ID\))\"/\1/p" <<<"$installed_identities" | head -n 1)"
  if [[ -n "$same_team_identity" ]]; then
    fail "\"$APPLE_SIGNING_IDENTITY\" isn't in your Keychain, but this certificate for team $APPLE_TEAM_ID is:
       \"$same_team_identity\"
       Set APPLE_SIGNING_IDENTITY in $signing_env_file to that exact name."
  fi
  fail "\"$APPLE_SIGNING_IDENTITY\" isn't in your Keychain. Create it in Xcode → Settings → Accounts →
       Manage Certificates → + → Developer ID Application (signed in to the account for team $APPLE_TEAM_ID)."
fi

# A --target build lands in its own folder under target/.
target_directory="release"
arguments=("$@")
for index in "${!arguments[@]}"; do
  if [[ "${arguments[$index]}" == "--target" ]]; then
    target_directory="${arguments[$((index + 1))]}/release"
  fi
done

echo "Signing as: $APPLE_SIGNING_IDENTITY"
cd "$repository_root"
bun run app:build -- --bundles app,dmg "$@"

bundle_directory="$repository_root/src-tauri/target/$target_directory/bundle"
app_path="$bundle_directory/macos/Jot.app"

echo
echo "Checking the signature, notarization and stapled ticket…"
codesign --verify --deep --strict "$app_path"
spctl --assess --type execute --verbose=2 "$app_path"
xcrun stapler validate "$app_path"

# Tauri notarizes the app but not the DMG around it; notarize that too so it opens cleanly when downloaded.
dmg_path="$(ls "$bundle_directory"/dmg/*.dmg)"
echo
echo "Notarizing the DMG…"
xcrun notarytool submit "$dmg_path" --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD" --wait
xcrun stapler staple "$dmg_path"
spctl --assess --type open --context context:primary-signature --verbose=2 "$dmg_path"

# latest.json tells installed copies of Jot about this version (see plugins.updater in tauri.conf.json).
version="$(sed -nE 's/^  "version": "([^"]+)".*/\1/p' "$repository_root/src-tauri/tauri.conf.json")"
update_archive="$bundle_directory/macos/Jot.app.tar.gz"
update_url="https://github.com/jimmiefriberg/jot/releases/download/v$version/Jot.app.tar.gz"
platforms="\"darwin-aarch64\": { \"signature\": \"$(cat "$update_archive.sig")\", \"url\": \"$update_url\" }"
if [[ "$target_directory" == universal-apple-darwin/* ]]; then
  platforms="$platforms, \"darwin-x86_64\": { \"signature\": \"$(cat "$update_archive.sig")\", \"url\": \"$update_url\" }"
fi
release_notes="${JOT_RELEASE_NOTES:-}"
cat >"$bundle_directory/latest.json" <<JSON
{
  "version": "$version",
  "notes": $(printf '%s' "$release_notes" | python3 -c 'import json, sys; print(json.dumps(sys.stdin.read()))'),
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": { $platforms }
}
JSON

echo
echo "Done. Install: cp -R \"$app_path\" /Applications/"
echo "Share:   $dmg_path"
echo "Publish: gh release create v$version \"$dmg_path\" \"$update_archive\" \"$bundle_directory/latest.json\" --title \"Jot $version\" --notes \"…\""

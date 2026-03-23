# Vesti Release Metadata Directory

This tracked directory now keeps only the minimal public metadata that is safe to sync to `main`:

- latest checksum
- latest manifest snapshot
- latest file list snapshot

Release bundles and older mirrored artifacts are retained locally under the ignored directory
`vesti-release/_local/`.

## Current public baseline

- Version: `v1.2.0-rc.7`
- Source commit: `7804262cd3304cc2cbf95a7693c1b6e5df2f7ab2`
- Built at: `2026-03-08 13:45:00 +08:00`

## Public release truth

1. GitHub Releases remain the official attachment surface.
2. CI packaging remains the provenance path through `.github/workflows/extension-package.yml`.
3. This directory is metadata-only and should not grow back into a mirrored artifact store.
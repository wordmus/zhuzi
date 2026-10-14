---
name: auto-asset-pipeline
description: "Run the local /Users/lidechi/Documents/Github/auto-asset pipeline for source-image generation, repair/outpainting, detection proposals, and game-ready sprite/mask/metadata export. Use when the user asks for auto-asset, source image to sprites, game asset extraction or segmentation, APIMart GPT Image 2 generation or repair, Florence-2/SAM2 local proposals, or validation of an auto-asset run."
---

# Auto Asset Pipeline

Use this skill to operate the local `auto-asset` CLI without losing the contract boundary between model proposals and exported assets.

## Operating Rules

- Work from `/Users/lidechi/Documents/Github/auto-asset`.
- Run `git status --short` before making any repo edits; preserve unrelated user changes.
- Treat `work/<run>/detections.json` as the stable handoff file. Always create or inspect it before `extract`.
- Use `.venv` for prompt planning, APIMart generation/repair, mock runs, tests, and metadata inspection.
- Use `.venv-vision` for `--backend local` if it exists. Prefer `PYTHONPATH=/Users/lidechi/Documents/Github/auto-asset/src .venv-vision/bin/python -m auto_asset.cli ...`.
- Do not use system Python for setup.
- Do not overwrite exports unless the user explicitly asks for replacement. Add `--overwrite` only then.
- Do not silently switch a requested real/local run to `mock`; report missing dependencies or ask before producing a non-real run.

## Route The Request

Choose the narrowest flow that matches the user input:

| User starts with | Run |
| --- | --- |
| Text requirement and no source image | `plan-prompt`, then `generate-source`, then `propose`, then `extract` |
| Existing source image and object list | `propose --mode prompted`, then `extract` |
| Existing source image and prompt plan/object list | `propose --mode auto`, then `extract` |
| Need both automatic and prompted proposal sources | `propose --mode hybrid`, then `extract` |
| Damaged, cropped, or incomplete source image | `repair-source`, then rerun `propose`, then `extract` |
| Contract or test scaffolding only | `propose --backend mock`, then optional `extract` smoke test |

Prompts are required for `auto`, `prompted`, and `hybrid`. If the user gives abstract targets, convert them to visual nouns before proposing: use terms like `sticky note`, `printed page`, `paper sheet`, `poster`, `audio card`, `pdf card`, `lamp`, or `radio` instead of broad labels like `cards` or `documents`.

## Preflight

From the repo:

```bash
git status --short
.venv/bin/python --version
.venv/bin/auto-asset --help
```

If `.venv` is missing:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
```

For real local vision, check `.venv-vision` before installing:

```bash
.venv-vision/bin/python - <<'PY'
import cv2, numpy, torch, transformers
import sam2
print("vision ok")
PY
```

If `.venv-vision` is missing and the user needs real local extraction:

```bash
python3 -m venv .venv-vision
.venv-vision/bin/python -m pip install -e '.[dev,vision]'
```

APIMart generation or repair requires `APIMART_API_KEY`; check it before debugging model code.

## Standard Commands

Plan from text:

```bash
.venv/bin/auto-asset plan-prompt \
  --requirement "<source image requirement>" \
  --objects "object one,object two" \
  --out output/<run>/prompt-plan.json
```

Generate a source image:

```bash
.venv/bin/auto-asset generate-source \
  --plan output/<run>/prompt-plan.json \
  --out output/<run>/source.png
```

Repair or outpaint:

```bash
.venv/bin/auto-asset repair-source \
  --image /abs/path/to/source.png \
  --mask /abs/path/to/mask.png \
  --prompt "<repair instruction>" \
  --out output/<run>/repaired.png
```

```bash
.venv/bin/auto-asset repair-source \
  --image /abs/path/to/source.png \
  --expand "160,0,160,0" \
  --prompt "<outpainting instruction>" \
  --out output/<run>/outpainted.png
```

Real proposal:

```bash
PYTHONPATH=/Users/lidechi/Documents/Github/auto-asset/src \
.venv-vision/bin/python -m auto_asset.cli propose \
  --image /abs/path/to/source.png \
  --backend local \
  --mode auto \
  --prompts "object one,object two" \
  --out work/<run>/detections.json
```

Mock contract proposal:

```bash
.venv/bin/auto-asset propose \
  --image /abs/path/to/source.png \
  --backend mock \
  --mode prompted \
  --prompts "object one,object two" \
  --out work/<run>/detections.json
```

Extract:

```bash
.venv/bin/auto-asset extract \
  --image /abs/path/to/source.png \
  --detections work/<run>/detections.json \
  --out exports/<run>
```

## Output Contract

A successful export contains:

- `exports/<run>/sprites/`
- `exports/<run>/masks/`
- `exports/<run>/thumbnails/`
- `exports/<run>/review_overlay.jpg`
- `exports/<run>/preview_contact_sheet.jpg`
- `exports/<run>/metadata.json`

`metadata.json` is the count source for exported assets. Inspect it before reporting completion.

## Detections Schema

When reading or repairing `detections.json`, preserve:

- `schema_version: "1.0"`
- non-empty `source`
- `prompts` as a list of strings
- unique detection `id` values
- per detection: `id`, `label`, `confidence`, `bbox_xyxy`, and `mask`
- `mask.type` as `bbox` or `polygon`
- bboxes inside image bounds with non-empty area
- polygon masks with at least three in-bounds points

After hand edits, run extraction again instead of editing exported files first.

## Validation

Run the full repo tests after code or contract changes:

```bash
.venv/bin/python -m pytest
```

For a CLI-only run, validate by checking:

```bash
test -f work/<run>/detections.json
test -d exports/<run>/sprites
test -d exports/<run>/masks
test -d exports/<run>/thumbnails
test -f exports/<run>/review_overlay.jpg
test -f exports/<run>/preview_contact_sheet.jpg
test -f exports/<run>/metadata.json
```

## Failure Ladder

1. Check that the source image exists and is the image used for proposal and extraction.
2. Check that prompts are non-empty and visual enough for localization.
3. Re-run `propose`; do not skip straight to `extract` after changing images, prompts, or repairs.
4. For local backend failures, verify `.venv-vision` imports `torch`, `transformers`, `numpy`, `cv2`, and `sam2`.
5. Confirm `transformers>=4.46.0,<4.50.0`, plus `einops` and `timm`.
6. For APIMart failures, verify `APIMART_API_KEY`, then inspect the JSON printed by `generate-source` or `repair-source`.
7. If output exists, decide whether to choose a fresh run name or rerun with explicit `--overwrite`.

## Report Back

Include:

- source image path
- prompt list or prompt plan path
- detection JSON path
- export directory
- APIMart generation/repair status and saved image path, if used
- backend and mode used
- environment used: `.venv` or `.venv-vision`
- exported asset count from `metadata.json`
- validation command and result
- any dependency, existing-output, or contract issue that needs user action

#!/usr/bin/env python3
"""Audit JSON data dependencies for the vocabulary DB migration.

This script is intentionally read-only. It scans the repo for direct references
to current vocabulary JSON artifacts so migration work can keep runtime,
validation, and curation paths explicit.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCAN_DIRS = ("app", "components", "lib", "scripts")
TARGETS = (
    "public/data/vocab_13000.json",
    "public/data/tranches.json",
    "public/data/popular_verbs_300.json",
    "public/data/chunks",
)
ABSOLUTE_DATA_RE = re.compile(r"/Users/[^\s\"'`]+/nihongo-vocab-trainer/public/data/[^\s\"'`]+")


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return ""


def classify(path: Path, text: str) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel.startswith("app/") or rel.startswith("lib/") or rel.startswith("components/"):
        return "runtime-build"
    if "validate" in path.name:
        return "validation"
    if "generate" in path.name or "split" in path.name:
        return "generator"
    if "apply" in path.name or "refine" in path.name or "normalize" in path.name or "translate" in path.name:
        return "writer"
    if "curate" in path.name or "complete" in path.name or "ensure" in path.name:
        return "curation"
    return "script"


def references_for(text: str) -> list[str]:
    refs = [target for target in TARGETS if target in text]
    if "vocab_13000.json" in text and "public/data/vocab_13000.json" not in refs:
        refs.append("vocab_13000.json")
    if "tranches.json" in text and "public/data/tranches.json" not in refs:
        refs.append("tranches.json")
    if "popular_verbs_300.json" in text and "public/data/popular_verbs_300.json" not in refs:
        refs.append("popular_verbs_300.json")
    if "public/data/chunks" in text and "public/data/chunks" not in refs:
        refs.append("public/data/chunks")
    return sorted(set(refs))


def main() -> None:
    items = []
    for directory in SCAN_DIRS:
        base = ROOT / directory
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.suffix not in {".ts", ".tsx", ".js", ".py"}:
                continue
            text = read_text(path)
            refs = references_for(text)
            absolute_paths = sorted(set(ABSOLUTE_DATA_RE.findall(text)))
            if not refs and not absolute_paths:
                continue
            items.append(
                {
                    "path": path.relative_to(ROOT).as_posix(),
                    "category": classify(path, text),
                    "references": refs,
                    "absolute_data_paths": absolute_paths,
                }
            )

    summary = {
        "total_files": len(items),
        "by_category": {},
        "legacy_absolute_path_files": [
            item["path"] for item in items if item["absolute_data_paths"]
        ],
    }
    for item in items:
        summary["by_category"][item["category"]] = summary["by_category"].get(item["category"], 0) + 1

    print(json.dumps({"summary": summary, "items": items}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

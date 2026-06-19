#!/usr/bin/env python3
"""Validate generated related-word candidate JSONL artifacts."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHUNKS_DIR = ROOT / "public" / "data" / "chunks"


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_runtime_vocab() -> dict[int, dict]:
    entries = {}
    files = sorted(
        CHUNKS_DIR.glob("vocab_chunk_*.json"),
        key=lambda path: int(path.stem.split("_")[-1]),
    )
    for path in files:
        for entry in json.loads(path.read_text(encoding="utf-8")):
            entries[entry["id"]] = entry
    return entries


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: validate_related_candidates.py related_candidates.jsonl")

    path = Path(sys.argv[1])
    if not path.exists():
        fail(f"{path} does not exist")

    vocab = load_runtime_vocab()
    run_ids = set()
    candidate_count = 0
    seen_rank_keys = set()
    seen_target_keys = set()

    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            fail(f"line {line_number} is invalid JSON: {exc}")

        row_type = row.get("type")
        if row_type == "candidate_run":
            runtime_versions = row.get("runtime_versions")
            if row.get("artifact_schema_version", 1) >= 2 and not isinstance(runtime_versions, dict):
                fail(f"line {line_number} candidate_run missing runtime_versions")
            if isinstance(runtime_versions, dict) and (
                not runtime_versions.get("fastembed") or not runtime_versions.get("numpy")
            ):
                fail(f"line {line_number} candidate_run has incomplete runtime_versions")
            run_ids.add(row.get("run_id"))
            continue
        if row_type != "related_word_candidate":
            fail(f"line {line_number} has unknown type {row_type!r}")

        candidate_count += 1
        run_id = row.get("run_id")
        source_id = row.get("source_vocab_id")
        target_id = row.get("target_vocab_id")
        rank = row.get("rank")
        method = row.get("method")
        score = row.get("similarity_score")

        if not run_id:
            fail(f"line {line_number} missing run_id")
        if source_id == target_id:
            fail(f"line {line_number} creates self-link for id {source_id}")
        if source_id not in vocab:
            fail(f"line {line_number} source_vocab_id {source_id} not found")
        target = vocab.get(target_id)
        if not target:
            fail(f"line {line_number} target_vocab_id {target_id} not found")
        if not isinstance(score, (int, float)) or score < 0 or score > 1:
            fail(f"line {line_number} similarity_score must be 0..1")
        if not isinstance(rank, int) or rank <= 0:
            fail(f"line {line_number} rank must be positive integer")
        if row.get("target_word") != target.get("word"):
            fail(f"line {line_number} target_word is stale for target {target_id}")
        if row.get("target_reading") != target.get("reading"):
            fail(f"line {line_number} target_reading is stale for target {target_id}")
        if row.get("target_meaning") != target.get("meaning"):
            fail(f"line {line_number} target_meaning is stale for target {target_id}")
        if not isinstance(row.get("reason_json"), dict):
            fail(f"line {line_number} reason_json must be object")
        if not isinstance(row.get("filters_matched_json"), list):
            fail(f"line {line_number} filters_matched_json must be list")

        rank_key = (run_id, source_id, rank)
        if rank_key in seen_rank_keys:
            fail(f"line {line_number} duplicated rank key {rank_key}")
        seen_rank_keys.add(rank_key)

        target_key = (run_id, source_id, target_id, method)
        if target_key in seen_target_keys:
            fail(f"line {line_number} duplicated target key {target_key}")
        seen_target_keys.add(target_key)

    if not run_ids:
        fail("candidate artifact missing candidate_run header")
    if candidate_count == 0:
        fail("candidate artifact has no candidates")

    print(json.dumps({"ok": True, "run_count": len(run_ids), "candidate_count": candidate_count}, indent=2))


if __name__ == "__main__":
    main()

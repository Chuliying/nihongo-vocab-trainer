#!/usr/bin/env python3
"""Generate reviewable related-word candidates with local FastEmbed.

This is an offline, non-mutating dry-run for T05 of the vocab DB migration. It
reads the current runtime chunk corpus, embeds entries locally, and writes
candidate rows to scratch for human review. It does not modify JSON data or DB
tables.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHUNKS_DIR = ROOT / "public" / "data" / "chunks"
DEFAULT_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
DEFAULT_OUT = ROOT / "scratch" / "vocab-db-migration" / "related_candidates.sample.jsonl"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--limit", type=int, default=100, help="number of source entries to process; 0 means all")
    parser.add_argument("--candidate-pool-limit", type=int, default=1000, help="candidate pool size; 0 means all")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--source", choices=("runtime-chunks",), default="runtime-chunks")
    return parser.parse_args()


def load_runtime_vocab() -> list[dict]:
    files = sorted(
        CHUNKS_DIR.glob("vocab_chunk_*.json"),
        key=lambda path: int(path.stem.split("_")[-1]),
    )
    entries = []
    for path in files:
        entries.extend(json.loads(path.read_text(encoding="utf-8")))
    return entries


def embedding_text(entry: dict) -> str:
    example = entry.get("example") or {}
    verb_info = entry.get("verb_info") or {}
    parts = [
        f"word: {entry.get('word', '')}",
        f"reading: {entry.get('reading', '')}",
        f"meaning zh-TW: {entry.get('meaning', '')}",
        f"part of speech: {entry.get('part_of_speech', '')}",
        f"jlpt: {entry.get('jlpt_level', '')}",
        f"example ja: {example.get('japanese', '')}",
        f"example zh-TW: {example.get('chinese', '')}",
    ]
    if verb_info:
        parts.append(f"verb type: {verb_info.get('verb_type', '')}")
    return "\n".join(parts)


def normalize(vector) -> list[float]:
    values = [float(item) for item in vector]
    norm = math.sqrt(sum(item * item for item in values))
    if norm == 0:
        return values
    return [item / norm for item in values]


def dot(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def reason_for(source: dict, target: dict, score: float) -> dict:
    source_pos = set(str(source.get("part_of_speech", "")).split("・"))
    target_pos = set(str(target.get("part_of_speech", "")).split("・"))
    return {
        "similarity": round(score, 6),
        "shared_part_of_speech": sorted(source_pos & target_pos),
        "source_jlpt": source.get("jlpt_level"),
        "target_jlpt": target.get("jlpt_level"),
    }


def is_candidate(source: dict, target: dict) -> tuple[bool, list[str]]:
    filters = []
    if source["id"] == target["id"]:
        return False, ["self-link"]
    if source.get("word") == target.get("word") and source.get("reading") == target.get("reading"):
        return False, ["duplicate-word-reading"]
    source_pos = set(str(source.get("part_of_speech", "")).split("・"))
    target_pos = set(str(target.get("part_of_speech", "")).split("・"))
    if source_pos & target_pos:
        filters.append("shared-pos")
    if source.get("jlpt_level") == target.get("jlpt_level"):
        filters.append("same-jlpt")
    if abs(int(source.get("tranche_id", 0)) - int(target.get("tranche_id", 0))) <= 1:
        filters.append("nearby-tranche")
    return True, filters


def main() -> int:
    args = parse_args()
    try:
        from fastembed import TextEmbedding
    except ImportError:
        print("ERROR: fastembed is not installed. Run: python3 -m pip install --user fastembed", file=sys.stderr)
        return 2

    vocab = load_runtime_vocab()
    if args.limit and args.limit > 0:
        sources = vocab[: args.limit]
    else:
        sources = vocab
    candidate_pool = vocab[: args.candidate_pool_limit] if args.candidate_pool_limit > 0 else vocab

    texts = [embedding_text(entry) for entry in candidate_pool]
    text_hash = hashlib.sha256("\n---\n".join(texts).encode("utf-8")).hexdigest()
    model = TextEmbedding(model_name=args.model)
    vectors = [normalize(vector) for vector in model.embed(texts)]
    dimensions = len(vectors[0]) if vectors else 0

    run_id = str(uuid.uuid4())
    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = ROOT / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)

    candidate_count = 0
    with out_path.open("w", encoding="utf-8") as handle:
        header = {
            "type": "candidate_run",
            "run_id": run_id,
            "source": args.source,
            "method": "fastembed-cosine",
            "provider": "fastembed",
            "model": args.model,
            "dimensions": dimensions,
            "embedding_text_hash": text_hash,
            "top_k": args.top_k,
            "source_count": len(sources),
            "candidate_pool_count": len(candidate_pool),
            "corpus_count": len(vocab),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        handle.write(json.dumps(header, ensure_ascii=False) + "\n")

        for source_index, source in enumerate(sources):
            if source_index >= len(candidate_pool):
                break
            scored = []
            for target_index, target in enumerate(candidate_pool):
                ok, filters = is_candidate(source, target)
                if not ok:
                    continue
                score = dot(vectors[source_index], vectors[target_index])
                scored.append((score, target, filters))
            scored.sort(key=lambda item: item[0], reverse=True)
            for rank, (score, target, filters) in enumerate(scored[: args.top_k], start=1):
                row = {
                    "type": "related_word_candidate",
                    "run_id": run_id,
                    "source_vocab_id": source["id"],
                    "target_vocab_id": target["id"],
                    "rank": rank,
                    "similarity_score": round(score, 6),
                    "method": "fastembed-cosine",
                    "status": "proposed",
                    "source_word": source.get("word"),
                    "target_word": target.get("word"),
                    "target_reading": target.get("reading"),
                    "target_meaning": target.get("meaning"),
                    "reason_json": reason_for(source, target, score),
                    "filters_matched_json": filters,
                }
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
                candidate_count += 1

    print(
        json.dumps(
            {
                "run_id": run_id,
                "out": str(out_path.relative_to(ROOT)),
                "source_count": len(sources),
                "candidate_pool_count": len(candidate_pool),
                "corpus_count": len(vocab),
                "candidate_count": candidate_count,
                "model": args.model,
                "dimensions": dimensions,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

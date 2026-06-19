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
import importlib.metadata
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHUNKS_DIR = ROOT / "public" / "data" / "chunks"
DEFAULT_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
DEFAULT_OUT = ROOT / "scratch" / "vocab-db-migration" / "related_candidates.sample.jsonl"


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--limit", type=int, default=100, help="number of source entries to process; 0 means all")
    parser.add_argument("--candidate-pool-limit", type=int, default=1000, help="candidate pool size; 0 means all")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--score-batch-size", type=int, default=256)
    parser.add_argument(
        "--allow-cross-pos",
        action="store_true",
        help="allow candidates without a shared part-of-speech token",
    )
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


def pos_tokens(entry: dict) -> set[str]:
    return {
        token.strip()
        for token in str(entry.get("part_of_speech", "")).split("・")
        if token.strip()
    }


def reason_for(source: dict, target: dict, score: float) -> dict:
    source_pos = pos_tokens(source)
    target_pos = pos_tokens(target)
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
    source_pos = pos_tokens(source)
    target_pos = pos_tokens(target)
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
        import numpy as np
    except ImportError:
        print(
            "ERROR: dependencies are missing. Create .venv and install fastembed numpy there.",
            file=sys.stderr,
        )
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
    vectors = np.asarray(list(model.embed(texts)), dtype=np.float32)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    vectors = np.divide(vectors, norms, out=np.zeros_like(vectors), where=norms != 0)
    dimensions = int(vectors.shape[1]) if vectors.size else 0
    indices_by_pos: dict[str, set[int]] = {}
    for target_index, target in enumerate(candidate_pool):
        for token in pos_tokens(target):
            indices_by_pos.setdefault(token, set()).add(target_index)

    run_id = str(uuid.uuid4())
    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = ROOT / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)

    candidate_count = 0
    with out_path.open("w", encoding="utf-8") as handle:
        header = {
            "type": "candidate_run",
            "artifact_schema_version": 2,
            "run_id": run_id,
            "source": args.source,
            "method": "fastembed-cosine",
            "provider": "fastembed",
            "model": args.model,
            "runtime_versions": {
                "fastembed": importlib.metadata.version("fastembed"),
                "numpy": np.__version__,
            },
            "dimensions": dimensions,
            "embedding_text_hash": text_hash,
            "embedding_text_version": "word-reading-meaning-pos-jlpt-example-v1",
            "top_k": args.top_k,
            "filters_json": {
                "self_link": "exclude",
                "duplicate_word_reading": "exclude",
                "shared_part_of_speech": "optional" if args.allow_cross_pos else "required",
            },
            "source_count": len(sources),
            "candidate_pool_count": len(candidate_pool),
            "corpus_count": len(vocab),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        handle.write(json.dumps(header, ensure_ascii=False) + "\n")

        source_count = min(len(sources), len(candidate_pool))
        batch_size = max(1, args.score_batch_size)
        for batch_start in range(0, source_count, batch_size):
            batch_end = min(batch_start + batch_size, source_count)
            score_matrix = vectors[batch_start:batch_end] @ vectors.T
            for batch_offset, source_index in enumerate(range(batch_start, batch_end)):
                source = sources[source_index]
                scores = score_matrix[batch_offset]
                if args.allow_cross_pos:
                    eligible_indices = np.arange(len(candidate_pool), dtype=np.int32)
                else:
                    eligible = set()
                    for token in pos_tokens(source):
                        eligible.update(indices_by_pos.get(token, ()))
                    eligible_indices = np.fromiter(eligible, dtype=np.int32)
                if eligible_indices.size == 0:
                    continue
                eligible_scores = scores[eligible_indices]
                candidate_limit = min(eligible_indices.size, args.top_k + 2)
                partition = np.argpartition(eligible_scores, -candidate_limit)[-candidate_limit:]
                partition = partition[np.argsort(eligible_scores[partition])[::-1]]
                top_indices = eligible_indices[partition]
                selected = []
                for target_index in top_indices:
                    target = candidate_pool[int(target_index)]
                    ok, filters = is_candidate(source, target)
                    if not ok:
                        continue
                    selected.append((float(scores[target_index]), target, filters))
                    if len(selected) == args.top_k:
                        break
                for rank, (score, target, filters) in enumerate(selected, start=1):
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
                "out": display_path(out_path),
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

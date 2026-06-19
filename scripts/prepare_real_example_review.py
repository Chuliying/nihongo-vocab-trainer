#!/usr/bin/env python3
"""Prepare a deterministic review batch from enriched real-example candidates."""
import argparse
import json
from pathlib import Path


def read_jsonl(path):
    with Path(path).open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def candidate_rank(candidate):
    has_cmn = bool(candidate.get("cmn_translations"))
    human_reading = candidate.get("reading_status", "").startswith("tatoeba_human")
    return (
        0 if has_cmn and human_reading else 1 if has_cmn else 2 if human_reading else 3,
        candidate.get("score", 9999),
        candidate["sentence_id"],
    )


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--candidates",
        default="scratch/cleanup_pipeline/real_example_candidates.enriched.jsonl",
    )
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--risk", help="optional exact risk_bucket filter")
    parser.add_argument(
        "--out",
        default="scratch/cleanup_pipeline/real_example_review_batch.jsonl",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    if args.offset < 0 or args.limit <= 0:
        raise ValueError("offset must be non-negative and limit positive")
    rows = [
        row
        for row in read_jsonl(args.candidates)
        if row.get("candidates")
        and (not args.risk or row.get("risk_bucket") == args.risk)
    ]
    selected = rows[args.offset : args.offset + args.limit]
    output = []
    for row in selected:
        candidate = min(row["candidates"], key=candidate_rank)
        sources = candidate.get("cmn_translations", [])
        preferred_source = next(
            (
                source
                for source in sources
                if source.get("script_hint") == "traditional_likely"
            ),
            sources[0] if sources else None,
        )
        output.append(
            {
                "id": row["id"],
                "word": row["word"],
                "reading": row["reading"],
                "risk_bucket": row["risk_bucket"],
                "original_example": row["original_example"],
                "sentence_id": candidate["sentence_id"],
                "j": candidate["japanese"],
                "r": candidate["reading"],
                "reading_status": candidate["reading_status"],
                "cmn_sources": sources,
                "c": preferred_source["text"] if preferred_source else "",
                "translation_status": (
                    "source_draft_requires_review"
                    if preferred_source
                    else "translation_required"
                ),
                "reading_reviewed": False,
                "translation_reviewed": False,
                "reviewed": False,
            }
        )
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        for row in output:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(
        json.dumps(
            {
                "out": str(out_path),
                "offset": args.offset,
                "risk": args.risk,
                "rows": len(output),
                "with_cmn_source": sum(bool(row["cmn_sources"]) for row in output),
                "with_human_reading": sum(
                    row["reading_status"].startswith("tatoeba_human") for row in output
                ),
                "reviewed": 0,
                "applied": 0,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

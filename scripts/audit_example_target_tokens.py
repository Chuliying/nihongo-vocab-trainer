#!/usr/bin/env python3
"""Audit whether each example contains the vocab target as a real token/lemma."""
import argparse
import importlib.util
import json
from datetime import date
from pathlib import Path

import fugashi

SCRIPT = Path(__file__).with_name("select_real_examples.py")
SPEC = importlib.util.spec_from_file_location("select_real_examples", SCRIPT)
SELECTOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SELECTOR)

DEFAULT_OUT = Path("scratch/cleanup_pipeline/example_target_status.json")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    return parser.parse_args()


def main():
    args = parse_args()
    tagger = fugashi.Tagger()
    status = {}
    exact = 0
    missing = 0
    for entry in SELECTOR.load_chunks():
        sentence = (entry.get("example") or {}).get("japanese") or ""
        target = {
            "word": entry.get("word") or "",
            "reading": entry.get("reading") or "",
            "part_of_speech": entry.get("part_of_speech") or "",
        }
        matched = [
            {
                "surface": token.surface,
                "lemma": SELECTOR.token_lemma(token),
                "reading": SELECTOR.token_reading(token),
            }
            for token in tagger(sentence)
            if SELECTOR.token_matches_target(token, target)
        ]
        has_token_match = bool(matched)
        exact += int(has_token_match)
        missing += int(not has_token_match)
        status[str(entry["id"])] = {
            "token_match": has_token_match,
            "matches": matched[:3],
        }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(
            {
                "generated_at": str(date.today()),
                "summary": {"entries": len(status), "token_match": exact, "missing": missing},
                "status": status,
            },
            fh,
            ensure_ascii=False,
        )
    print(
        json.dumps(
            {
                "out": str(out_path),
                "entries": len(status),
                "token_match": exact,
                "missing": missing,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

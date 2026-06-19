#!/usr/bin/env python3
"""Validate Tatoeba candidate artifacts without applying them."""
import argparse
import importlib.util
import json
from pathlib import Path

import fugashi

SCRIPT = Path(__file__).with_name("select_real_examples.py")
SPEC = importlib.util.spec_from_file_location("select_real_examples", SCRIPT)
SELECTOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SELECTOR)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate_file")
    return parser.parse_args()


def main():
    args = parse_args()
    tagger = fugashi.Tagger()
    errors = []
    rows = []
    with Path(args.candidate_file).open(encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            if not line.strip():
                continue
            try:
                rows.append((line_no, json.loads(line)))
            except json.JSONDecodeError as error:
                errors.append(f"line {line_no}: invalid JSON: {error}")

    seen_ids = set()
    candidate_count = 0
    for line_no, row in rows:
        row_id = row.get("id")
        if row_id in seen_ids:
            errors.append(f"line {line_no}: duplicate vocab id {row_id}")
        seen_ids.add(row_id)
        target = {
            "word": row.get("word", ""),
            "reading": row.get("reading", ""),
            "part_of_speech": row.get("part_of_speech", ""),
        }
        candidates = row.get("candidates")
        if not isinstance(candidates, list):
            errors.append(f"line {line_no}: candidates must be a list")
            continue
        if row.get("status") == "proposed" and not candidates:
            errors.append(f"line {line_no}: proposed row has no candidates")
        if row.get("status") == "fallback_required" and candidates:
            errors.append(f"line {line_no}: fallback row unexpectedly has candidates")
        sentence_ids = set()
        for candidate in candidates:
            candidate_count += 1
            sentence_id = candidate.get("sentence_id")
            if not isinstance(sentence_id, int) or sentence_id <= 0:
                errors.append(f"line {line_no}: invalid sentence_id")
            if sentence_id in sentence_ids:
                errors.append(f"line {line_no}: duplicate sentence_id {sentence_id}")
            sentence_ids.add(sentence_id)
            if candidate.get("license") != SELECTOR.SOURCE_LICENSE:
                errors.append(f"line {line_no}: missing expected license")
            if candidate.get("reading_status") not in {
                "machine_generated_requires_review",
                "tatoeba_human_transcription_requires_review",
            }:
                errors.append(f"line {line_no}: reading must remain review-required")
            sentence = candidate.get("japanese", "")
            tokens = list(tagger(sentence))
            if not any(SELECTOR.token_matches_target(token, target) for token in tokens):
                errors.append(
                    f"line {line_no}: sentence {sentence_id} has no exact token/lemma match"
                )
            if SELECTOR.KANJI.search(candidate.get("reading", "")):
                errors.append(f"line {line_no}: reading contains kanji")
            for translation in candidate.get("cmn_translations", []):
                if (
                    translation.get("status")
                    != "source_translation_requires_traditional_review"
                ):
                    errors.append(
                        f"line {line_no}: linked Chinese must remain review-required"
                    )

    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print(
        json.dumps(
            {
                "ok": True,
                "rows": len(rows),
                "candidates": candidate_count,
                "applied": 0,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

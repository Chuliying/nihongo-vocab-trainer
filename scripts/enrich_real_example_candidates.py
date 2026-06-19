#!/usr/bin/env python3
"""Enrich Tatoeba candidates with direct Chinese links and human transcriptions.

The output remains a candidate artifact. Chinese source sentences are references
only and always require Traditional Chinese review before apply.
"""
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

DEFAULT_CANDIDATES = Path("scratch/cleanup_pipeline/real_example_candidates.jsonl")
DEFAULT_OUT = Path("scratch/cleanup_pipeline/real_example_candidates.enriched.jsonl")
DEFAULT_LINKS = Path("scratch/tatoeba/links.csv")
DEFAULT_CMN = Path("scratch/tatoeba/cmn_sentences.tsv")
DEFAULT_TRANSCRIPTIONS = Path("scratch/tatoeba/transcriptions.csv")

# This is deliberately a hint, not a validator. cmn contains both scripts.
SIMPLIFIED_ONLY = set(
    "这为么们个来时会说话对还进过发后里没见从让给着种样点开关问间车书东门"
    "体国学爱长现头应动实当边无气电号台网虽与将于仅几"
)
TRADITIONAL_ONLY = set(
    "這為麼們個來時會說話對還進過發後裡沒見從讓給著種樣點開關問間車書東門"
    "體國學愛長現頭應動實當邊無氣電號臺網雖與將於僅幾"
)
TRANSCRIPTION_BRACKET = re.compile(r"\[([^\]]+)\]")


def read_jsonl(path):
    with Path(path).open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def kata_to_hira(text):
    return "".join(
        chr(ord(char) - 0x60) if "ァ" <= char <= "ヶ" else char
        for char in (text or "")
    )


def transcription_to_reading(text):
    """Convert Tatoeba Hrkt notation: [場所|ば|しょ] -> ばしょ."""

    def replace(match):
        parts = match.group(1).split("|")
        return "".join(parts[1:]) if len(parts) > 1 else parts[0]

    return kata_to_hira(TRANSCRIPTION_BRACKET.sub(replace, text))


def script_hint(text):
    simplified = any(char in SIMPLIFIED_ONLY for char in text)
    traditional = any(char in TRADITIONAL_ONLY for char in text)
    if simplified and traditional:
        return "mixed"
    if simplified:
        return "simplified_likely"
    if traditional:
        return "traditional_likely"
    return "unknown"


def load_cmn(path):
    result = {}
    with Path(path).open(encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t", 2)
            if len(parts) == 3 and parts[1] == "cmn":
                result[int(parts[0])] = parts[2]
    return result


def load_linked_cmn(links_path, source_ids, cmn_by_id):
    linked = defaultdict(set)
    cmn_ids = set(cmn_by_id)
    with Path(links_path).open(encoding="utf-8") as fh:
        for line in fh:
            left, right = line.rstrip("\n").split("\t", 1)
            left_id = int(left)
            right_id = int(right)
            if left_id in source_ids and right_id in cmn_ids:
                linked[left_id].add(right_id)
            if right_id in source_ids and left_id in cmn_ids:
                linked[right_id].add(left_id)
    return linked


def load_transcriptions(path, source_ids):
    result = {}
    with Path(path).open(encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t", 4)
            if len(parts) != 5:
                continue
            sentence_id = int(parts[0])
            if sentence_id not in source_ids or parts[1] != "jpn" or parts[2] != "Hrkt":
                continue
            # Keep the first community transcription deterministically.
            result.setdefault(
                sentence_id,
                {
                    "reading": transcription_to_reading(parts[4]),
                    "author": parts[3],
                    "raw": parts[4],
                },
            )
    return result


def enrich(rows, linked_cmn, cmn_by_id, transcriptions):
    stats = {
        "rows": len(rows),
        "candidates": 0,
        "with_direct_cmn": 0,
        "with_human_reading": 0,
        "fully_sourced": 0,
    }
    for row in rows:
        for candidate in row.get("candidates", []):
            stats["candidates"] += 1
            sentence_id = candidate["sentence_id"]
            transcription = transcriptions.get(sentence_id)
            if transcription:
                candidate["reading"] = transcription["reading"]
                candidate["reading_status"] = "tatoeba_human_transcription_requires_review"
                candidate["reading_attribution"] = {
                    "author": transcription["author"],
                    "raw": transcription["raw"],
                }
                stats["with_human_reading"] += 1
            translation_rows = []
            for translation_id in sorted(linked_cmn.get(sentence_id, set())):
                text = cmn_by_id[translation_id]
                translation_rows.append(
                    {
                        "sentence_id": translation_id,
                        "text": text,
                        "script_hint": script_hint(text),
                        "status": "source_translation_requires_traditional_review",
                        "source_url": f"https://tatoeba.org/en/sentences/show/{translation_id}",
                    }
                )
            candidate["cmn_translations"] = translation_rows
            if translation_rows:
                stats["with_direct_cmn"] += 1
            if translation_rows and transcription:
                stats["fully_sourced"] += 1
    return stats


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", default=str(DEFAULT_CANDIDATES))
    parser.add_argument("--links", default=str(DEFAULT_LINKS))
    parser.add_argument("--cmn", default=str(DEFAULT_CMN))
    parser.add_argument("--transcriptions", default=str(DEFAULT_TRANSCRIPTIONS))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    return parser.parse_args()


def main():
    args = parse_args()
    rows = read_jsonl(args.candidates)
    source_ids = {
        candidate["sentence_id"]
        for row in rows
        for candidate in row.get("candidates", [])
    }
    cmn_by_id = load_cmn(args.cmn)
    linked_cmn = load_linked_cmn(args.links, source_ids, cmn_by_id)
    transcriptions = load_transcriptions(args.transcriptions, source_ids)
    stats = enrich(rows, linked_cmn, cmn_by_id, transcriptions)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    stats["out"] = str(out_path)
    stats["direct_cmn_coverage"] = (
        round(stats["with_direct_cmn"] / stats["candidates"], 4)
        if stats["candidates"]
        else 0
    )
    stats["human_reading_coverage"] = (
        round(stats["with_human_reading"] / stats["candidates"], 4)
        if stats["candidates"]
        else 0
    )
    stats["applied"] = 0
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

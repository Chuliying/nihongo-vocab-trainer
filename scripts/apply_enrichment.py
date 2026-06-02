#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import pykakasi


VOCAB_PATH = Path("public/data/vocab_13000.json")
ENRICHMENT_DIR = Path("public/data/enrichment")


def to_kana(text: str) -> str:
    kakasi = pykakasi.kakasi()
    return "".join(part["hira"] for part in kakasi.convert(text))


def main() -> None:
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    by_id = {entry["id"]: entry for entry in vocab}

    files = sorted(ENRICHMENT_DIR.glob("batch_*.json"))
    if not files:
        print("No enrichment files found.")
        return

    applied = 0
    for path in files:
        items = json.loads(path.read_text(encoding="utf-8"))
        for item in items:
            if "word" not in item or "reading" not in item:
                raise SystemExit(
                    f"{path}: enrichment records must include word and reading for the 13,000-word dataset"
                )
            entry = by_id.get(item["id"])
            if not entry:
                raise SystemExit(f"{path}: unknown id {item['id']}")
            if entry["word"] != item["word"] or entry["reading"] != item["reading"]:
                raise SystemExit(
                    f"{path}: id {item['id']} is {entry['word']}／{entry['reading']}, "
                    f"not {item['word']}／{item['reading']}"
                )
            entry["meaning"] = item["meaning"]
            entry["example"] = {
                "japanese": item["example"]["japanese"],
                "reading": to_kana(item["example"]["japanese"]),
                "chinese": item["example"]["chinese"],
            }
            entry["source"]["example"] = "LLM curated"
            entry.setdefault("_quality", {})["meaning_source"] = "LLM curated"
            entry.setdefault("_quality", {})["example_source"] = "LLM curated"
            applied += 1

    VOCAB_PATH.write_text(json.dumps(vocab, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Applied {applied} enrichment records from {len(files)} files.")


if __name__ == "__main__":
    main()

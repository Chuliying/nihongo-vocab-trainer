#!/usr/bin/env python3
import json
import re
import sys
from collections import Counter
from pathlib import Path


REQUIRED_FIELDS = {
    "id",
    "word",
    "reading",
    "part_of_speech",
    "jlpt_level",
    "tranche_id",
    "frequency_rank",
    "meaning",
    "example",
    "verb_info",
    "related",
    "source",
}

VERB_FIELDS = {
    "verb_type",
    "dictionary_form",
    "masu_form",
    "te_form",
    "ta_form",
    "nai_form",
    "potential_form",
    "passive_form",
    "causative_form",
    "imperative_form",
    "conditional_form",
    "volitional_form",
}


def fail(message: str) -> None:
    print(f"ERROR: {message}")
    sys.exit(1)


def has_ascii_letters(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]", text))


def load_json(path: Path):
    try:
      return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
      fail(f"{path} is not valid JSON: {exc}")


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: validate_vocab.py vocab_10000.json tranches.json")

    vocab_path = Path(sys.argv[1])
    tranches_path = Path(sys.argv[2])
    vocab = load_json(vocab_path)
    tranches = load_json(tranches_path)

    if not isinstance(vocab, list):
        fail("vocab must be a list")
    if not isinstance(tranches, list):
        fail("tranches must be a list")

    tranche_ids = {item["id"] for item in tranches}
    ids = []
    word_keys = []
    tranche_counts = Counter()

    for entry in vocab:
        missing = REQUIRED_FIELDS - set(entry)
        if missing:
            fail(f"word id {entry.get('id')} missing fields: {sorted(missing)}")

        ids.append(entry["id"])
        word_keys.append((entry["word"], entry["reading"]))

        if entry["tranche_id"] not in tranche_ids:
            fail(f"word id {entry['id']} has unknown tranche_id {entry['tranche_id']}")
        tranche_counts[entry["tranche_id"]] += 1

        example = entry["example"]
        for key in ("japanese", "reading", "chinese"):
            if not example.get(key):
                fail(f"word id {entry['id']} example.{key} is empty")
        if has_ascii_letters(entry["meaning"]):
            fail(f"word id {entry['id']} meaning contains ASCII letters: {entry['meaning'][:80]}")
        if has_ascii_letters(example["chinese"]):
            fail(f"word id {entry['id']} example.chinese contains ASCII letters")
        if entry["word"] not in example["japanese"]:
            fail(f"word id {entry['id']} example.japanese does not contain target word")
        if entry["source"].get("example") == "generated fallback":
            fail(f"word id {entry['id']} still uses generated fallback")

        pos_tokens = set(entry["part_of_speech"].split("・"))
        if "動詞" in pos_tokens:
            if not entry["verb_info"]:
                fail(f"word id {entry['id']} is a verb but verb_info is missing")
            missing_verb = VERB_FIELDS - set(entry["verb_info"])
            if missing_verb:
                fail(f"word id {entry['id']} verb_info missing fields: {sorted(missing_verb)}")

    duplicated_ids = [item for item, count in Counter(ids).items() if count > 1]
    if duplicated_ids:
        fail(f"duplicated ids: {duplicated_ids[:10]}")

    duplicated_words = [item for item, count in Counter(word_keys).items() if count > 1]
    if duplicated_words:
        fail(f"duplicated word + reading pairs: {duplicated_words[:10]}")

    if len(vocab) != 10000:
        print(f"WARN: dataset has {len(vocab)} entries; production target is 10000.")

    for tranche in tranches:
        count = tranche_counts[tranche["id"]]
        if len(vocab) == 10000 and count != 1000:
            fail(f"tranche {tranche['id']} has {count} entries; expected 1000")
        if len(vocab) != 10000:
            print(f"WARN: tranche {tranche['id']} has {count} seed entries; production target is 1000.")

    print("OK: schema validation passed")


if __name__ == "__main__":
    main()

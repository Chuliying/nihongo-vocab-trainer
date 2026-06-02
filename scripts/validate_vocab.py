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
    "quality_score",
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


def example_contains_word(word: str, sentence: str) -> bool:
    """The example should show the headword, but natural sentences use
    conjugated forms (住む → 住んでいます, 洗う → 洗いました). Accept either the
    exact word, or — for words written with kanji — its leading kanji stem,
    which conjugation preserves."""
    if word in sentence:
        return True
    stem = re.match(r"^[一-鿿々]+", word)
    return bool(stem) and stem.group(0) in sentence


def load_json(path: Path):
    try:
      return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
      fail(f"{path} is not valid JSON: {exc}")


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: validate_vocab.py vocab_13000.json tranches.json")

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
        if not example_contains_word(entry["word"], example["japanese"]):
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

    target_size = len(tranches) * 1000
    if len(vocab) != target_size:
        fail(f"dataset has {len(vocab)} entries; expected {target_size}.")

    for tranche in tranches:
        count = tranche_counts[tranche["id"]]
        if count != 1000:
            fail(f"tranche {tranche['id']} has {count} entries; expected 1000")

    validate_popular_verbs(vocab)
    print("OK: schema validation passed")


def validate_popular_verbs(vocab) -> None:
    path = Path("public/data/popular_verbs_300.json")
    if not path.exists():
        return
    verbs = load_json(path)
    vocab_by_id = {entry["id"]: entry for entry in vocab}
    if len(verbs) != 300:
        fail(f"popular verbs list has {len(verbs)} entries; expected 300")
    ranks = [item["rank"] for item in verbs]
    if ranks != list(range(1, 301)):
        fail("popular verbs ranks must be 1..300")
    ids = [item["id"] for item in verbs]
    if len(set(ids)) != 300:
        fail("popular verbs contains duplicate ids")
    if any(item["frequency_rank"] <= 0 for item in verbs):
        fail("popular verbs frequency_rank must be positive")
    for item in verbs:
        entry = vocab_by_id.get(item["id"])
        if not entry:
            fail(f"popular verb id {item['id']} not found in vocab")
        if "動詞" not in entry["part_of_speech"].split("・"):
            fail(f"popular verb id {item['id']} is not a verb")
        if not entry.get("verb_info"):
            fail(f"popular verb id {item['id']} is missing verb_info")
        if item["frequency_rank"] != entry["frequency_rank"]:
            fail(f"popular verb id {item['id']} has mismatched frequency_rank")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Select reviewable Tatoeba examples for low-value vocabulary rows.

This script only creates candidates. It never writes runtime chunks.

Safety properties:
- matches a fugashi token surface/lemma, never a raw substring;
- records Tatoeba sentence IDs and CC-BY attribution;
- rejects sensitive content and common advanced/archaic grammar;
- uses a hard N4/N5-oriented kanji threshold;
- emits multiple ranked candidates so translation/review can choose safely.

Run:
  .venv/bin/python scripts/select_real_examples.py --limit 100 --top-k 3
  .venv/bin/python scripts/select_real_examples.py --ids 12,34 --out /tmp/examples.jsonl
"""
import argparse
import json
import os
import re
from collections import defaultdict
from pathlib import Path

import fugashi

CHUNK_DIR = Path("public/data/chunks")
MANIFEST = Path("scratch/cleanup_pipeline/cleanup_manifest.json")
TATOEBA = Path("scratch/tatoeba/jpn_sentences.tsv")
DEFAULT_OUT = Path("scratch/cleanup_pipeline/real_example_candidates.jsonl")

SOURCE_NAME = "Tatoeba Japanese sentences"
SOURCE_LICENSE = "CC-BY 2.0 FR"
SOURCE_URL = "https://tatoeba.org"

SENSITIVE = re.compile(
    r"(コンドーム|セックス|排卵|妊娠|殺人|自殺|流血|戦争|兵器|裸|愛人|麻薬|"
    r"犯罪|逮捕|強姦|暴力|睾丸|膣|射精|乳首|ポルノ|拷問)"
)
ADVANCED_OR_ARCHAIC = re.compile(
    r"(ざるを得ない|ずにはいられない|わけにはいかない|に違いない|にほかならない|"
    r"かねない|かねる|ものの|ながらも|にもかかわらず|べからず|まじき|"
    r"如何なる|せしめ|たるもの|なりけり|であろう|のである)"
)
KANJI = re.compile(r"[一-鿿々]")
KANA_ONLY = re.compile(r"^[ぁ-ゟァ-ヿー]+$")
PUNCT_ONLY = re.compile(r"^[\s。、！？!?「」『』（）()…・，,.]+$")


def kata_to_hira(text):
    return "".join(
        chr(ord(char) - 0x60) if "ァ" <= char <= "ヶ" else char
        for char in (text or "")
    )


def load_chunks():
    rows = []
    for file_path in sorted(
        CHUNK_DIR.glob("vocab_chunk_*.json"),
        key=lambda item: int(re.search(r"\d+", item.name).group()),
    ):
        with file_path.open(encoding="utf-8") as fh:
            rows.extend(json.load(fh))
    return rows


def level_kanji_sets(rows):
    n45 = set()
    n3 = set()
    for entry in rows:
        target = n45 if entry.get("jlpt_level") in ("N5", "N4") else n3
        if entry.get("jlpt_level") not in ("N5", "N4", "N3"):
            continue
        for char in entry.get("word") or "":
            if KANJI.match(char):
                target.add(char)
    return n45, n3


def load_targets(rows_by_id, ids=None, limit=None):
    with MANIFEST.open(encoding="utf-8") as fh:
        manifest = json.load(fh)
    selected = []
    wanted = set(ids or [])
    for row in manifest["rows"]:
        if "low_value_example" not in row.get("issues", []):
            continue
        if wanted and row["id"] not in wanted:
            continue
        entry = rows_by_id[row["id"]]
        selected.append(
            {
                "id": entry["id"],
                "word": entry.get("word") or "",
                "reading": entry.get("reading") or "",
                "jlpt_level": entry.get("jlpt_level"),
                "part_of_speech": entry.get("part_of_speech"),
                "risk_bucket": row.get("risk_bucket"),
                "original_example": entry.get("example") or {},
            }
        )
        if limit and len(selected) >= limit:
            break
    missing = wanted - {row["id"] for row in selected}
    if missing:
        raise ValueError(
            "IDs are absent from the current low_value_example queue: "
            + ",".join(str(value) for value in sorted(missing))
        )
    return selected


def token_value(token, name):
    value = getattr(token.feature, name, None)
    return "" if value in (None, "*") else str(value)


def token_reading(token):
    return kata_to_hira(token_value(token, "kana"))


def token_lemma(token):
    for name in ("lemma", "orthBase", "orth"):
        value = token_value(token, name)
        if value:
            return value
    return token.surface


def token_pos(token):
    return token_value(token, "pos1")


def target_pos_compatible(token, target):
    target_pos = target.get("part_of_speech") or ""
    coarse = token_pos(token)
    if not coarse:
        return True
    expected = [
        label
        for label in (
            "動詞",
            "名詞",
            "副詞",
            "形容詞",
            "助詞",
            "助動詞",
            "接続詞",
            "感動詞",
            "連体詞",
            "代名詞",
        )
        if label in target_pos
    ]
    return not expected or coarse in expected


def token_matches_target(token, target):
    """Exact token/lemma matching, including naturally inflected verbs."""
    word = target["word"]
    surface = token.surface
    lemma = token_lemma(token)
    orth_base = token_value(token, "orthBase")
    if lemma == word:
        return True
    if orth_base == word:
        return target_pos_compatible(token, target)
    if surface == word:
        return target_pos_compatible(token, target)
    # Permit only orthographic hiragana/katakana normalization. Token reading is NOT
    # a matcher: it confuses kana homophones such as 問う「とう」 and とうに.
    return bool(
        word
        and KANA_ONLY.fullmatch(word)
        and KANA_ONLY.fullmatch(surface)
        and kata_to_hira(surface) == kata_to_hira(word)
        and target_pos_compatible(token, target)
    )


def sentence_reading(tokens):
    output = []
    unknown = 0
    for token in tokens:
        reading = token_reading(token)
        if reading:
            output.append(reading)
        else:
            output.append(token.surface)
            if KANJI.search(token.surface):
                unknown += 1
    return "".join(output), unknown


# Optional ultra-loose overrides (0/None => use the default loose values). Set via CLI.
LOOSE_MAX_LEN = 0
LOOSE_MAX_OUTSIDE_N45 = 0
LOOSE_MAX_TOKENS = 0
LOOSE_MAX_COMMAS = 0


def candidate_score(sentence, tokens, target, n45_kanji, n3_kanji, loose=False):
    # loose mode (user-approved, 2026-06-28): for FALLBACK rows with no exact-level
    # Tatoeba match, relax length/difficulty/clause caps. Reading is still 100% human
    # furigana (enrich step) and a Chinese translation is supplied, so a slightly
    # longer/harder real sentence stays usable; SENSITIVE/ADVANCED/punct gates KEPT.
    max_len = (LOOSE_MAX_LEN if LOOSE_MAX_LEN else 42) if loose else 28
    max_outside_n45 = (LOOSE_MAX_OUTSIDE_N45 if LOOSE_MAX_OUTSIDE_N45 else 5) if loose else 2
    max_tokens = (LOOSE_MAX_TOKENS if LOOSE_MAX_TOKENS else 18) if loose else 14
    max_commas = (LOOSE_MAX_COMMAS if LOOSE_MAX_COMMAS else 2) if loose else 1
    if SENSITIVE.search(sentence) or ADVANCED_OR_ARCHAIC.search(sentence):
        return None
    if not sentence.endswith(("。", "！", "？")):
        return None
    if len(sentence) < 4 or len(sentence) > max_len:
        return None
    if sentence.count("、") + sentence.count("，") > max_commas:
        return None

    target_kanji = {char for char in target["word"] if KANJI.match(char)}
    sentence_kanji = {char for char in sentence if KANJI.match(char)}
    outside_n45 = sentence_kanji - n45_kanji - target_kanji
    outside_n3 = outside_n45 - n3_kanji
    if loose:
        if len(outside_n45) > max_outside_n45:
            return None
    elif len(outside_n45) > max_outside_n45 or outside_n3:
        return None

    lexical_tokens = [
        token for token in tokens if not PUNCT_ONLY.fullmatch(token.surface)
    ]
    if len(lexical_tokens) > max_tokens:
        return None

    clause_penalty = (
        sentence.count("、") * 8
        + sum(sentence.count(mark) for mark in ("けれど", "ながら", "ので", "のに")) * 5
    )
    return len(sentence) + len(outside_n45) * 8 + clause_penalty


def parse_tatoeba_line(line):
    parts = line.rstrip("\n").split("\t", 2)
    if len(parts) != 3 or parts[1] != "jpn" or not parts[2]:
        return None
    return {"sentence_id": int(parts[0]), "sentence": parts[2]}


def generate_candidates(targets, rows, top_k, loose=False):
    tagger = fugashi.Tagger()
    n45_kanji, n3_kanji = level_kanji_sets(rows)
    by_word = defaultdict(list)
    by_kana_surface = defaultdict(list)
    for target in targets:
        by_word[target["word"]].append(target)
        if KANA_ONLY.fullmatch(target["word"]):
            by_kana_surface[kata_to_hira(target["word"])].append(target)

    results = {target["id"]: [] for target in targets}
    with TATOEBA.open(encoding="utf-8") as fh:
        for line in fh:
            parsed = parse_tatoeba_line(line)
            if not parsed:
                continue
            sentence = parsed["sentence"]
            loose_cap = LOOSE_MAX_LEN if LOOSE_MAX_LEN else 42
            if len(sentence) > (loose_cap if loose else 28) or SENSITIVE.search(sentence):
                continue
            tokens = list(tagger(sentence))
            matched_ids = set()
            for token in tokens:
                possible = by_word.get(token.surface, [])
                lemma = token_lemma(token)
                if lemma != token.surface:
                    possible = possible + by_word.get(lemma, [])
                # Kana entries can match an orthographic variant by exact token reading.
                reading = token_reading(token)
                if KANA_ONLY.fullmatch(token.surface):
                    possible = possible + by_kana_surface.get(kata_to_hira(token.surface), [])
                for target in possible:
                    if target["id"] in matched_ids or not token_matches_target(token, target):
                        continue
                    score = candidate_score(
                        sentence, tokens, target, n45_kanji, n3_kanji, loose=loose
                    )
                    if score is None:
                        continue
                    reading_text, unknown_reading_tokens = sentence_reading(tokens)
                    if unknown_reading_tokens:
                        continue
                    matched_ids.add(target["id"])
                    results[target["id"]].append(
                        {
                            "sentence_id": parsed["sentence_id"],
                            "japanese": sentence,
                            "reading": reading_text,
                            "reading_status": "machine_generated_requires_review",
                            "score": score,
                            "matched_surface": token.surface,
                            "matched_lemma": lemma,
                            "source": SOURCE_NAME,
                            "source_url": f"{SOURCE_URL}/en/sentences/show/{parsed['sentence_id']}",
                            "license": SOURCE_LICENSE,
                        }
                    )

    output = []
    for target in targets:
        ranked = sorted(
            results[target["id"]],
            key=lambda item: (item["score"], len(item["japanese"]), item["sentence_id"]),
        )
        deduped = []
        seen = set()
        for candidate in ranked:
            if candidate["japanese"] in seen:
                continue
            seen.add(candidate["japanese"])
            deduped.append(candidate)
            if len(deduped) >= top_k:
                break
        output.append(
            {
                **target,
                "candidate_count": len(ranked),
                "candidates": deduped,
                "status": "proposed" if deduped else "fallback_required",
            }
        )
    return output


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=str(MANIFEST))
    parser.add_argument("--corpus", default=str(TATOEBA))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--limit", type=int)
    parser.add_argument("--top-k", type=int, default=3)
    parser.add_argument("--ids", help="comma-separated vocab IDs")
    parser.add_argument("--loose", action="store_true", help="relax length/difficulty/clause caps for fallback rows")
    parser.add_argument("--max-len", type=int, default=0, help="ultra-loose: override loose max sentence length")
    parser.add_argument("--max-outside-n45", type=int, default=0, help="ultra-loose: override loose out-of-level kanji cap")
    parser.add_argument("--max-tokens", type=int, default=0, help="ultra-loose: override loose token cap")
    parser.add_argument("--max-commas", type=int, default=0, help="ultra-loose: override loose comma cap")
    return parser.parse_args()


def main():
    global MANIFEST, TATOEBA, LOOSE_MAX_LEN, LOOSE_MAX_OUTSIDE_N45, LOOSE_MAX_TOKENS, LOOSE_MAX_COMMAS
    args = parse_args()
    LOOSE_MAX_LEN = args.max_len
    LOOSE_MAX_OUTSIDE_N45 = args.max_outside_n45
    LOOSE_MAX_TOKENS = args.max_tokens
    LOOSE_MAX_COMMAS = args.max_commas
    if args.limit is not None and args.limit <= 0:
        raise ValueError("--limit must be positive")
    if args.top_k <= 0:
        raise ValueError("--top-k must be positive")
    MANIFEST = Path(args.manifest)
    TATOEBA = Path(args.corpus)
    ids = (
        [int(value.strip()) for value in args.ids.split(",") if value.strip()]
        if args.ids
        else None
    )

    rows = load_chunks()
    rows_by_id = {row["id"]: row for row in rows}
    targets = load_targets(rows_by_id, ids=ids, limit=args.limit)
    candidates = generate_candidates(targets, rows, args.top_k, loose=args.loose)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        for row in candidates:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")

    proposed = sum(row["status"] == "proposed" for row in candidates)
    print(
        json.dumps(
            {
                "out": str(out_path),
                "targets": len(candidates),
                "proposed": proposed,
                "fallback_required": len(candidates) - proposed,
                "coverage": round(proposed / len(candidates), 4) if candidates else 0,
                "applied": 0,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

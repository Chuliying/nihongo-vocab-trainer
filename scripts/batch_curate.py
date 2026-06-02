#!/usr/bin/env python3
"""
Batch curation pipeline using Claude Haiku for generation + Sonnet for review.

Usage:
  # Dry run - just extract and show the batch
  python3 scripts/batch_curate.py --status needs_review --batch-size 50 --dry-run

  # Process a batch with Haiku, validate, write back
  python3 scripts/batch_curate.py --status needs_review --batch-size 50

  # Process all needs_review entries
  python3 scripts/batch_curate.py --status needs_review --all

Requires: pip install anthropic
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path

VOCAB_PATH = Path("public/data/vocab_13000.json")
TEMPLATE_PATTERNS = [
    "という言葉が出ました",
    "について話しました",
    "の使い方を説明しました",
    "日記に",
    "必要な時に",
    "日常生活で",
    "短い文で",
    "を確認しました",
    "を使った文",
    "ことがあります",
]

HAIKU_SYSTEM = """あなたは日本語教材データの品質改善アシスタントです。
与えられたJSONの単語データの釈義と例文を、初中級学習者向けに自然で分かりやすく書き直してください。

厳守事項：
1. 入力と同じ数のJSONアイテムを出力する
2. id・word・reading・part_of_speech・jlpt_level・tranche_id・frequency_rankは変更禁止
3. 変更可能: meaning, example.japanese, example.reading, example.chinese, quality_score
4. meaningは繁體中文（日本語の原語のみはNG）
5. example.japaneseは日本人が自然に使う短い文（8〜20文字）
6. 例文は必ず目標のwordを含む（動詞は活用形可）
7. 禁止例文パターン:「〇〇という言葉が出ました」「〇〇について話しました」「の使い方を説明しました」「日記に〇〇を使った」「必要な時に」「日常生活で」「短い文で〇〇を確認」
8. example.readingは平仮名（漢字禁止・外来語はカタカナ可）
9. example.chineseは自然な繁體中文
10. quality_score: 動詞なら"verb_curated"、その他"curated"
11. マークダウン・説明文なし。JSONアレイのみ出力"""

SONNET_REVIEW_SYSTEM = """あなたは日本語教材データのQAレビュアーです。
以下のJSONアレイを確認し、問題のある項目のidとその問題点を指摘してください。

チェック項目:
- example.japaneseが自然な日本語か
- example.readingに漢字が含まれていないか
- example.chineseが自然な繁體中文か
- meaningが繁體中文で適切か
- 例文が目標のwordを含むか（活用形OK）
- 禁止テンプレートを使っていないか

問題があればJSON形式で: [{"id": 123, "issue": "問題の説明"}]
問題なければ: []
説明文なし、JSONのみ出力"""


def load_data():
    return json.loads(VOCAB_PATH.read_text(encoding="utf-8"))


def save_data(data):
    VOCAB_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def has_template(sentence):
    return any(p in sentence for p in TEMPLATE_PATTERNS)


def validate_batch_output(original, result):
    """Validate Haiku output. Returns list of error strings."""
    errors = []
    orig_by_id = {e["id"]: e for e in original}

    if len(result) != len(original):
        errors.append(f"Count mismatch: got {len(result)}, expected {len(original)}")
        return errors

    for r in result:
        eid = r.get("id")
        if eid not in orig_by_id:
            errors.append(f"Unknown id: {eid}")
            continue
        o = orig_by_id[eid]

        if r.get("word") != o["word"]:
            errors.append(f"id={eid}: word changed")
        if r.get("reading") != o["reading"]:
            errors.append(f"id={eid}: reading changed")

        meaning = r.get("meaning", "")
        if not meaning:
            errors.append(f"id={eid}: empty meaning")
        if meaning == r.get("word") or meaning == r.get("reading"):
            errors.append(f"id={eid}: meaning equals word/reading")
        if re.search(r"[a-zA-Z]", meaning):
            errors.append(f"id={eid}: ASCII letters in meaning")

        ex = r.get("example", {})
        jp = ex.get("japanese", "")
        if not jp:
            errors.append(f"id={eid}: empty example.japanese")
        if has_template(jp):
            errors.append(f"id={eid}: template pattern in example.japanese")
        if "這個詞" in ex.get("chinese", ""):
            errors.append(f"id={eid}: placeholder in example.chinese")
        if re.search(r"[一-鿿]", ex.get("reading", "")):
            errors.append(f"id={eid}: kanji in example.reading")

        qs = r.get("quality_score", "")
        if qs not in ("curated", "verb_curated"):
            errors.append(f"id={eid}: bad quality_score={qs}")

    return errors


def apply_results(data, results):
    """Write validated Haiku results back into the main dataset."""
    result_by_id = {r["id"]: r for r in results}
    updated = 0
    for entry in data:
        if entry["id"] in result_by_id:
            r = result_by_id[entry["id"]]
            entry["meaning"] = r["meaning"]
            entry["example"] = r["example"]
            entry["quality_score"] = r["quality_score"]
            if "_quality" in entry:
                entry["_quality"]["quality_score"] = r["quality_score"]
                entry["_quality"]["example_source"] = "haiku_curated"
                entry["_quality"]["meaning_source"] = "haiku_curated"
            updated += 1
    return updated


def pick_batch(data, status, batch_size, skip=0):
    """Pick next batch of entries with the given quality_score."""
    candidates = [v for v in data if v.get("quality_score") == status]
    return candidates[skip : skip + batch_size]


def call_haiku(batch):
    import anthropic

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    payload = json.dumps(batch, ensure_ascii=False)
    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=8000,
        system=HAIKU_SYSTEM,
        messages=[{"role": "user", "content": payload}],
    )
    text = message.content[0].text.strip()
    # Strip markdown fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def call_sonnet_review(batch):
    import anthropic

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    payload = json.dumps(batch, ensure_ascii=False)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=SONNET_REVIEW_SYSTEM,
        messages=[{"role": "user", "content": payload}],
    )
    text = message.content[0].text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", default="needs_review",
                        choices=["needs_review", "meaning_translated", "rule_completed"])
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--skip", type=int, default=0,
                        help="Skip first N candidates (to resume from offset)")
    parser.add_argument("--all", action="store_true",
                        help="Process all candidates (loops until done)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print batch info without calling API")
    parser.add_argument("--no-review", action="store_true",
                        help="Skip Sonnet review pass")
    args = parser.parse_args()

    if not args.dry_run and "ANTHROPIC_API_KEY" not in os.environ:
        print("ERROR: Set ANTHROPIC_API_KEY environment variable")
        sys.exit(1)

    data = load_data()
    skip = args.skip

    while True:
        batch = pick_batch(data, args.status, args.batch_size, skip)
        if not batch:
            print(f"No more {args.status} entries to process.")
            break

        print(f"\n{'='*60}")
        print(f"Batch: {args.status} | skip={skip} | size={len(batch)}")
        print(f"IDs: {[e['id'] for e in batch]}")

        if args.dry_run:
            for e in batch[:3]:
                print(f"  {e['id']} {e['word']} | {e.get('meaning','')[:30]}")
            print(f"  ... ({len(batch)} total)")
            break

        # Call Haiku
        print("Calling Haiku...")
        try:
            results = call_haiku(batch)
        except Exception as ex:
            print(f"Haiku failed: {ex}")
            sys.exit(1)

        # Validate
        errors = validate_batch_output(batch, results)
        if errors:
            print(f"VALIDATION FAILED ({len(errors)} errors):")
            for e in errors:
                print(f"  {e}")
            print("Skipping this batch.")
            skip += args.batch_size
            if not args.all:
                break
            continue

        # Sonnet review (optional)
        if not args.no_review:
            print("Sonnet review...")
            try:
                issues = call_sonnet_review(results)
                if issues:
                    print(f"Sonnet flagged {len(issues)} issues:")
                    for iss in issues:
                        print(f"  id={iss['id']}: {iss['issue']}")
                else:
                    print("Sonnet: all OK")
            except Exception as ex:
                print(f"Sonnet review failed (non-fatal): {ex}")

        # Apply
        n = apply_results(data, results)
        save_data(data)
        print(f"Applied {n} updates. Saved.")

        skip += args.batch_size
        if not args.all:
            break

    # Final stats
    from collections import Counter
    qs = Counter(v.get("quality_score") for v in data)
    curated = qs["curated"] + qs["verb_curated"]
    print(f"\nCurrent curated: {curated}/13000")
    print(f"Remaining: needs_review={qs['needs_review']}, meaning_translated={qs['meaning_translated']}")


if __name__ == "__main__":
    main()

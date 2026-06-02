#!/usr/bin/env python3
"""Normalize display meanings for learner-facing cards.

The dataset keeps part of speech in `part_of_speech`, so `meaning` should not
repeat internal labels such as "助詞:" or "副詞:". This pass strips those labels
from entries and related-word summaries while keeping the actual explanation.
"""
from __future__ import annotations

import json
import re
from pathlib import Path


VOCAB_PATH = Path("public/data/vocab_13000.json")
POPULAR_VERBS_PATH = Path("public/data/popular_verbs_300.json")

DISPLAY_PREFIX_RE = re.compile(
    r"^(?:"
    r"助詞|助動詞|接續詞|接続詞|接續助詞|接続助詞|副詞|名詞|動詞|"
    r"形容詞|形容動詞|感動詞|表現|代名詞|連體詞|連体詞|接尾詞|否定|"
    r"文法形式|活用・口語形式"
    r")[:：]"
)


def strip_display_prefix(text: str) -> str:
    text = text.strip()
    while True:
        cleaned = DISPLAY_PREFIX_RE.sub("", text).strip()
        if cleaned == text:
            return cleaned
        text = cleaned


def safe_display_meaning(entry: dict, text: str) -> str:
    cleaned = strip_display_prefix(text)
    if cleaned in {entry.get("word"), entry.get("reading")}:
        word = entry.get("word", "")
        pos = entry.get("part_of_speech", "")
        if "助詞" in pos or "助動詞" in pos or "接続詞" in pos or "接續詞" in pos:
            return "文法功能、需人工確認"
        if "副詞" in pos:
            return "副詞用法、需人工確認"
        if "動詞" in pos:
            return "動作、需人工確認"
        if len(word) <= 2 or re.fullmatch(r"[ぁ-ゟ゠-ヿー・]+", word):
            return "活用片段、需人工確認"
        return "詞義需人工確認"
    return cleaned


def main() -> None:
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    changed = 0
    for entry in vocab:
        cleaned = safe_display_meaning(entry, entry.get("meaning", ""))
        if cleaned != entry.get("meaning", ""):
            entry["meaning"] = cleaned
            entry.setdefault("_quality", {})["meaning_display_normalized"] = True
            changed += 1
        for related in entry.get("related", []):
            cleaned_related = strip_display_prefix(str(related.get("meaning", "")))
            if cleaned_related != related.get("meaning", ""):
                related["meaning"] = cleaned_related
                changed += 1

    VOCAB_PATH.write_text(json.dumps(vocab, ensure_ascii=False, indent=2), encoding="utf-8")

    popular_changed = 0
    if POPULAR_VERBS_PATH.exists():
        popular = json.loads(POPULAR_VERBS_PATH.read_text(encoding="utf-8"))
        for item in popular:
            cleaned = strip_display_prefix(item.get("meaning", ""))
            if cleaned != item.get("meaning", ""):
                item["meaning"] = cleaned
                popular_changed += 1
        POPULAR_VERBS_PATH.write_text(json.dumps(popular, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Normalized {changed} vocab display meanings; {popular_changed} popular verb meanings.")


if __name__ == "__main__":
    main()

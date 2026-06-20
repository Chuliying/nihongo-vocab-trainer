#!/usr/bin/env python3
"""Advisory QA scanner for a reviewed real-example checkpoint JSONL.

Deterministic-but-advisory: it FLAGS rows the parent agent should look at before
applying. It does NOT auto-reject (the apply gate is the hard backstop). Catches
the failure modes seen across iterations 032-034:

  - non-kana-in-r        Cyrillic/Latin mojibake or kanji leaking into the reading
  - english-in-c         untranslated Latin words left in the Chinese translation
  - simplified-in-c      Simplified-only characters in the Traditional Chinese
  - sensitive/morbid     death/violence/crime/etc. content unsuitable for learners

Benign metaphor compounds (必死 "desperate effort", 苦戦 "struggle", 殺到 "flood")
are allow-listed so the sensitive scan does not drown in false positives.

Usage: python scripts/scan_real_example_checkpoint.py <checkpoint.jsonl>
Exit 0 always (advisory). Prints a JSON summary + the flagged rows per category.
"""
import json
import re
import sys

# Reading must be kana + Japanese punctuation/brackets/spaces only.
KANA_OK = re.compile(r"[぀-ゟ゠-ヿーー、。！？・「」『』（）　\s]")

# Latin letters in the Chinese translation (untranslated words).
LATIN_IN_C = re.compile(r"[A-Za-z]")

# Simplified-only characters that should not appear in Traditional Chinese.
SIMPLIFIED = re.compile(
    r"[这个们说话东车书国对开关闭间题见觉际级别认识门马鸟鱼龙习写让飞机营养医选举观读单语爱聋报]"
)

# Sensitive / morbid kanji. Compounds in ALLOW are benign metaphors and skipped.
SENSITIVE = re.compile(
    r"死|殺|棺|墓|葬|霊|呪|地獄|悪魔|血|戦|銃|刀|剣|毒|癌|腫瘍|遺体|遺骨|拳銃|軍|兵|"
    r"爆弾|テロ|麻薬|薬物|犯罪|逮捕|刑務|自殺|誘拐|人質|射撃|性的|裸|暴力|奴隷|拷問|"
    r"強盗|強姦|売春|賭博|出血"
)
ALLOW = ("必死", "苦戦", "殺到", "苦心", "決死", "戦略", "戦術", "挑戦", "作戦", "血液型")


def main():
    if len(sys.argv) < 2:
        print("usage: scan_real_example_checkpoint.py <checkpoint.jsonl>", file=sys.stderr)
        return 2
    rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
    flags = {"non_kana_in_r": [], "english_in_c": [], "simplified_in_c": [], "sensitive": []}
    for d in rows:
        rid, r, c, j = d.get("id"), d.get("r", ""), d.get("c", ""), d.get("j", "")
        off = [ch for ch in r if not KANA_OK.match(ch)]
        if off:
            flags["non_kana_in_r"].append({"id": rid, "off": "".join(sorted(set(off))), "r": r})
        if LATIN_IN_C.search(c):
            flags["english_in_c"].append({"id": rid, "c": c})
        if SIMPLIFIED.search(c):
            flags["simplified_in_c"].append({"id": rid, "c": c})
        if SENSITIVE.search(j):
            j_stripped = j
            for a in ALLOW:
                j_stripped = j_stripped.replace(a, "")
            if SENSITIVE.search(j_stripped):
                flags["sensitive"].append({"id": rid, "j": j})
    summary = {"rows": len(rows), **{k: len(v) for k, v in flags.items()}}
    print(json.dumps(summary, ensure_ascii=False))
    for cat, items in flags.items():
        if items:
            print(f"--- {cat} ({len(items)}) ---")
            for it in items:
                print("  " + json.dumps(it, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())

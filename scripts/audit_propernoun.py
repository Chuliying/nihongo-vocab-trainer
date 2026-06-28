#!/usr/bin/env python3
"""Deterministic proper-noun detector for the real-example cheap flow (0 token).

Problem (iter080/081): the corpus has NO 固有名詞 POS value and no proper-noun
_quality flag, so the real-example selector kept pulling place/surname entries
(鳥取/金沢/函館/盛岡/伊豆/立花/水戸/目黒...). Tatoeba sentences then use them AS
proper nouns, and the hard constraint forbids the cheap model touching proper/place
names — so they had to be dropped by eyeball (the dominant ~40% review waste).

This script flags such entries deterministically using jamdict (.venv):
  proper-noun-likely  ==  has >=1 JMnedict name  AND  has NO common-priority JMdict
                          sense (no pri tag on any kanji/kana form).

Validated on the iter080/081 contamination set: excludes 鳥取/金沢/函館/盛岡/伊豆/
立花/水戸/目黒 (place/surname) while KEEPING 日本/東京/母子/撤廃/遊園 (legit common
nouns, incl. ones in 常用名詞500). Known miss: 青木 (kept — it also means evergreen,
carries a common pri tag); acceptable residual for spot-review.

Usage:
  .venv/bin/python scripts/audit_propernoun.py words.jsonl   # lines: {"id":N,"word":"..."}
  echo '{"id":1,"word":"鳥取"}' | .venv/bin/python scripts/audit_propernoun.py -
Output (jsonl): {"id":N,"word":"...","proper_noun":true|false,"names":K,"common":bool}
"""
import json
import sys

import jamdict

_jam = jamdict.Jamdict()


def _has_common_pri(word: str) -> bool:
    r = _jam.lookup(word)
    for e in r.entries:
        for k in (e.kanji_forms or []):
            if getattr(k, "pri", None):
                return True
        for rd in (e.kana_forms or []):
            if getattr(rd, "pri", None):
                return True
    return False


def classify(word: str):
    r = _jam.lookup(word)
    names = len(r.names)
    common = _has_common_pri(word)
    return {"proper_noun": names > 0 and not common, "names": names, "common": common}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.stdin if sys.argv[1] == "-" else open(sys.argv[1], encoding="utf-8")
    out = []
    for line in src:
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        info = classify(row["word"])
        out.append({"id": row.get("id"), "word": row["word"], **info})
    excluded = sum(1 for r in out if r["proper_noun"])
    for r in out:
        print(json.dumps(r, ensure_ascii=False))
    print(json.dumps({"_summary": {"total": len(out), "proper_noun_excluded": excluded}}, ensure_ascii=False), file=sys.stderr)


if __name__ == "__main__":
    main()

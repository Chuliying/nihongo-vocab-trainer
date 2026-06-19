#!/usr/bin/env python3
"""Prototype: pick a natural N4/N5 example sentence for a word from the Tatoeba
Japanese corpus (CC-BY), instead of LLM-generating one.

Difficulty oracle is built from our own corpus: the set of kanji used by N5/N4
entries = "kanji a learner at this level has seen". A candidate sentence is scored
by length, out-of-level kanji, clause complexity, and an appropriateness blocklist.
Reading (furigana) is generated offline with fugashi+unidic-lite.

This is a SELECTION prototype (no translation/apply yet) to prove sentence quality.
Run: .venv/bin/python scripts/select_real_examples.py [n_sample]
"""
import json
import os
import re
import sys

import fugashi

CHUNK_DIR = "public/data/chunks"
TATOEBA = "scratch/tatoeba/jpn_sentences.tsv"

BLOCK = re.compile(
    r"(コンドーム|性|セックス|排卵|妊娠|殺|死|血|戦争|兵器|裸|愛人|麻薬|犯罪|逮捕|強姦|暴力|睾|膣|射精|乳首)"
)
KANA = re.compile(r"^[ぁ-ゟァ-ヿー]+$")
KANJI = re.compile(r"[一-鿿々]")


def load_chunks():
    rows = []
    for f in sorted(os.listdir(CHUNK_DIR)):
        if re.match(r"^vocab_chunk_\d+\.json$", f):
            with open(os.path.join(CHUNK_DIR, f), encoding="utf-8") as fh:
                rows.extend(json.load(fh))
    return rows


def level_kanji_set(rows):
    """Kanji seen in N5/N4 (+ N3 as buffer) vocabulary = in-level kanji."""
    ok = set()
    for e in rows:
        if e.get("jlpt_level") in ("N5", "N4", "N3"):
            for ch in (e.get("word") or ""):
                if KANJI.match(ch):
                    ok.add(ch)
    return ok


def load_short_sentences():
    sents = []
    with open(TATOEBA, encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 3 and parts[2]:
                s = parts[2]
                if len(s) <= 24:
                    sents.append(s)
    return sents


def score(sentence, level_kanji):
    if BLOCK.search(sentence):
        return None
    n = len(sentence)
    out_of_level = sum(1 for ch in sentence if KANJI.match(ch) and ch not in level_kanji)
    commas = sentence.count("、") + sentence.count("，")
    if not sentence.endswith("。"):
        return None
    # lower is better
    return n + out_of_level * 6 + commas * 8


def reading_of(tagger, sentence):
    out = []
    for w in tagger(sentence):
        kana = getattr(w.feature, "kana", None)
        if kana and kana != "*":
            # convert katakana reading to hiragana
            out.append("".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in kana))
        else:
            out.append(w.surface)
    return "".join(out)


def main():
    n_sample = int(sys.argv[1]) if len(sys.argv) > 1 else 15
    rows = load_chunks()
    level_kanji = level_kanji_set(rows)
    sents = load_short_sentences()
    tagger = fugashi.Tagger()

    words = json.load(open("/tmp/lve_words.json", encoding="utf-8"))
    # spread the sample across the list
    step = max(1, len(words) // n_sample)
    sample = words[::step][:n_sample]

    for it in sample:
        w = it["w"]
        cands = [s for s in sents if w in s]
        scored = [(score(s, level_kanji), s) for s in cands]
        scored = [(sc, s) for sc, s in scored if sc is not None]
        scored.sort(key=lambda x: x[0])
        if scored:
            best = scored[0][1]
            print(f"{w}({it['r']})  [{len(cands)} cands, best={scored[0][0]}]")
            print(f"   ja: {best}")
            print(f"   yomi: {reading_of(tagger, best)}")
        else:
            print(f"{w}({it['r']})  [{len(cands)} raw cands -> 0 passed filter] FALLBACK to LLM")
        print()


if __name__ == "__main__":
    main()

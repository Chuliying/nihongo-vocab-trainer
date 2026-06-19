#!/usr/bin/env python3
"""L1 gloss homophone audit (0 model token).

The legacy pipeline matched JMdict by reading only, so some entries inherited the
English gloss of the WRONG same-reading homophone (e.g. ちょうど -> furniture instead
of "exactly"). This script uses jamdict + JMdict priority tags to detect those
entries deterministically and emit the correct top-priority sense for each.

Output: JSON { generated_at, summary, flagged: [ {id, word, reading, meaning,
current_gloss, corrupt_sense, correct_gloss, correct_pos} ] }

Run: .venv/bin/python scripts/audit_gloss_homophone.py [out.json]
"""
import json
import os
import re
import sys
from datetime import date

from jamdict import Jamdict

CHUNK_DIR = "public/data/chunks"
PRI_HIGH = {"ichi1", "news1", "spec1", "gai1"}


def load_entries():
    entries = []
    for f in sorted(os.listdir(CHUNK_DIR)):
        if not re.match(r"^vocab_chunk_\d+\.json$", f):
            continue
        with open(os.path.join(CHUNK_DIR, f), encoding="utf-8") as fh:
            for e in json.load(fh):
                entries.append(e)
    return entries


def pri_rank(entry):
    tags = []
    for k in entry.kanji_forms:
        tags += list(getattr(k, "pri", []) or [])
    for k in entry.kana_forms:
        tags += list(getattr(k, "pri", []) or [])
    if any(t in PRI_HIGH for t in tags):
        return 3
    if any(t.startswith("nf") or t in ("news2", "spec2") for t in tags):
        return 2
    if tags:
        return 1
    return 0


def norm(s):
    return re.sub(r"[^a-z ]", "", s.lower())


def entry_gloss_set(entry):
    out = set()
    for s in entry.senses:
        for g in s.gloss:
            out.add(norm(g.text))
    return out


def top_entry(entries):
    return max(entries, key=pri_rank)


def gloss_texts(entry, limit=4):
    out = []
    for s in entry.senses:
        for g in s.gloss:
            out.append(g.text)
            if len(out) >= limit:
                return out
    return out


def pos_of(entry):
    for s in entry.senses:
        if s.pos:
            return list(s.pos)
    return []


def has_kanji(s):
    return bool(re.search(r"[一-龯々]", s or ""))


def own_entry(entries, word, reading):
    """The JMdict entry that THIS word denotes.

    A word with kanji is disambiguated by its kanji (十 vs 住 both read じゅう); match
    the entry whose kanji form == word and whose readings include `reading`. A
    kana-only word has no kanji to pin it, so fall back to reading match — that is
    the genuinely ambiguous homophone case.
    """
    if has_kanji(word):
        cands = [e for e in entries
                 if any(k.text == word for k in e.kanji_forms)
                 and any(k.text == reading for k in e.kana_forms)]
        if cands:
            return cands[0], True  # kanji-pinned, unambiguous
        return None, True
    # kana-only word
    cands = [e for e in entries if any(k.text == reading for k in e.kana_forms)]
    return (cands, False)


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/gloss_homophone_audit.json"
    jam = Jamdict()
    entries = load_entries()
    summary = {
        "checked": 0,
        "no_jmdict": 0,
        "kanji_pinned_ok": 0,
        "kanji_pinned_gloss_from_other_entry_FLAG": 0,
        "kana_only_gloss_from_lower_pri_FLAG": 0,
        "gloss_from_correct_or_top": 0,
        "gloss_unmatched": 0,
        "own_entry_not_found": 0,
    }
    flagged = []
    status_map = {}  # id -> {status, correct_gloss?}

    def set_status(rid, status, correct=None):
        status_map[str(rid)] = {"status": status}
        if correct is not None:
            status_map[str(rid)]["jmdict_senses"] = correct

    for row in entries:
        g = (row.get("_quality") or {}).get("gloss_en") or []
        if not g:
            set_status(row["id"], "no_gloss")
            continue
        summary["checked"] += 1
        reading = row.get("reading") or ""
        word = row.get("word") or ""
        key = reading or word
        try:
            r = jam.lookup(key)
        except Exception:
            continue
        all_ents = [e for e in r.entries if any(k.text == reading for k in e.kana_forms)] or r.entries
        if not all_ents:
            summary["no_jmdict"] += 1
            set_status(row["id"], "no_jmdict")
            continue
        gnorm = set(norm(x) for x in g)
        own, kanji_pinned = own_entry(all_ents, word, reading)

        if kanji_pinned:
            if own is None:
                summary["own_entry_not_found"] += 1
                set_status(row["id"], "own_entry_not_found")
                continue
            true_gloss_set = entry_gloss_set(own)
            if gnorm & true_gloss_set:
                summary["kanji_pinned_ok"] += 1  # gloss is from the right (kanji) entry
                set_status(row["id"], "jmdict_verified")
                continue
            # gloss does NOT match this word's own entry; did it come from another homophone?
            other = [e for e in all_ents if e is not own and (gnorm & entry_gloss_set(e))]
            if other:
                summary["kanji_pinned_gloss_from_other_entry_FLAG"] += 1
                set_status(row["id"], "homophone_suspect", gloss_texts(own))
                flagged.append({
                    "id": row["id"], "word": word, "reading": reading,
                    "meaning": row.get("meaning"), "current_gloss": g,
                    "correct_gloss": gloss_texts(own), "correct_pos": pos_of(own),
                    "kind": "kanji_pinned",
                })
            else:
                summary["gloss_unmatched"] += 1
                set_status(row["id"], "gloss_unmatched")
            continue

        # kana-only: genuine homophone ambiguity, use priority
        ents = own  # list
        matched = [(len(gnorm & entry_gloss_set(e)), pri_rank(e), e) for e in ents]
        matched = [m for m in matched if m[0] > 0]
        if not matched:
            summary["gloss_unmatched"] += 1
            set_status(row["id"], "gloss_unmatched")
            continue
        best = max(m[0] for m in matched)
        src_pri = max(m[1] for m in matched if m[0] == best)
        top_pri = max(pri_rank(e) for e in ents)
        if len(ents) > 1 and src_pri < top_pri:
            summary["kana_only_gloss_from_lower_pri_FLAG"] += 1
            top = top_entry(ents)
            set_status(row["id"], "homophone_suspect", gloss_texts(top))
            flagged.append({
                "id": row["id"], "word": word, "reading": reading,
                "meaning": row.get("meaning"), "current_gloss": g,
                "correct_gloss": gloss_texts(top), "correct_pos": pos_of(top),
                "kind": "kana_only",
            })
        else:
            summary["gloss_from_correct_or_top"] += 1
            set_status(row["id"], "jmdict_verified")

    out = {
        "generated_at": str(date.today()),
        "summary": summary,
        "flagged": flagged,
    }
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
    status_path = os.path.join(os.path.dirname(out_path) or ".", "gloss_status.json")
    with open(status_path, "w", encoding="utf-8") as fh:
        json.dump({"generated_at": str(date.today()), "status": status_map}, fh, ensure_ascii=False)
    counts = {}
    for v in status_map.values():
        counts[v["status"]] = counts.get(v["status"], 0) + 1
    print(json.dumps({"out": out_path, "status_map": status_path,
                      "summary": summary, "flagged_count": len(flagged),
                      "status_counts": counts}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

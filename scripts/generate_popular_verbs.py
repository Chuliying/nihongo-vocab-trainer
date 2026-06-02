#!/usr/bin/env python3
import json
from pathlib import Path


VOCAB_PATH = Path("public/data/vocab_13000.json")
OUTPUT_PATH = Path("public/data/popular_verbs_300.json")
TARGET = 300

LEARNING_PRIORITY = [
    ("する", "する"), ("来る", "くる"), ("行く", "いく"), ("見る", "みる"), ("聞く", "きく"),
    ("食べる", "たべる"), ("飲む", "のむ"), ("書く", "かく"), ("読む", "よむ"), ("話す", "はなす"),
    ("言う", "いう"), ("使う", "つかう"), ("作る", "つくる"), ("思う", "おもう"), ("知る", "しる"),
    ("分かる", "わかる"), ("帰る", "かえる"), ("買う", "かう"), ("待つ", "まつ"), ("会う", "あう"),
    ("起きる", "おきる"), ("寝る", "ねる"), ("働く", "はたらく"), ("歩く", "あるく"), ("走る", "はしる"),
    ("止まる", "とまる"), ("休む", "やすむ"), ("遊ぶ", "あそぶ"), ("立つ", "たつ"), ("座る", "すわる"),
    ("入る", "はいる"), ("出る", "でる"), ("乗る", "のる"), ("降りる", "おりる"), ("開ける", "あける"),
    ("閉める", "しめる"), ("洗う", "あらう"), ("着る", "きる"), ("借りる", "かりる"), ("貸す", "かす"),
    ("返す", "かえす"), ("教える", "おしえる"), ("習う", "ならう"), ("覚える", "おぼえる"), ("忘れる", "わすれる"),
    ("探す", "さがす"), ("見つける", "みつける"), ("始める", "はじめる"), ("終わる", "おわる"), ("続ける", "つづける"),
    ("止める", "とめる"), ("直す", "なおす"), ("払う", "はらう"), ("送る", "おくる"), ("受ける", "うける"),
    ("渡す", "わたす"), ("渡る", "わたる"), ("曲がる", "まがる"), ("並ぶ", "ならぶ"), ("並べる", "ならべる"),
    ("急ぐ", "いそぐ"), ("手伝う", "てつだう"), ("持つ", "もつ"), ("呼ぶ", "よぶ"), ("選ぶ", "えらぶ"),
    ("出す", "だす"), ("生きる", "いきる"), ("残す", "のこす"), ("取る", "とる")
]


def main() -> None:
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    verbs = [
        entry
        for entry in vocab
        if "動詞" in entry["part_of_speech"].split("・") and entry.get("verb_info")
    ]
    by_key = {(entry["word"], entry["reading"]): entry for entry in verbs}
    selected = []
    used = set()
    for word, reading in LEARNING_PRIORITY:
        entry = by_key.get((word, reading))
        if entry and entry["id"] not in used:
            selected.append(entry)
            used.add(entry["id"])
    for entry in sorted(verbs, key=lambda entry: entry["frequency_rank"]):
        if entry["id"] in used:
            continue
        selected.append(entry)
        used.add(entry["id"])
        if len(selected) >= TARGET:
            break
    if len(selected) != TARGET:
        raise SystemExit(f"Expected {TARGET} verbs, found {len(selected)}")

    payload = [
        {
            "rank": index,
            "id": entry["id"],
            "word": entry["word"],
            "reading": entry["reading"],
            "meaning": entry["meaning"],
            "frequency_rank": entry["frequency_rank"],
            "tranche_id": entry["tranche_id"],
            "jlpt_level": entry["jlpt_level"],
            "verb_type": entry["verb_info"]["verb_type"],
            "rank_source": "learning_priority" if (entry["word"], entry["reading"]) in LEARNING_PRIORITY else "frequency_backfill",
        }
        for index, entry in enumerate(selected, start=1)
    ]
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(payload)} popular verbs to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

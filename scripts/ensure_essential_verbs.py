#!/usr/bin/env python3
import json
from pathlib import Path

import pykakasi


VOCAB_PATH = Path("public/data/vocab_13000.json")
KAKASI = pykakasi.kakasi()


ESSENTIAL_VERBS = [
    ("する", "する", "做、進行", "サ変動詞"),
    ("いる", "いる", "在、有、存在", "一段動詞"),
    ("ある", "ある", "有、存在", "五段動詞"),
    ("なる", "なる", "變成、成為", "五段動詞"),
    ("来る", "くる", "來、到來", "カ変動詞"),
    ("行く", "いく", "去、前往", "五段動詞"),
    ("見る", "みる", "看、觀看", "一段動詞"),
    ("食べる", "たべる", "吃", "一段動詞"),
    ("飲む", "のむ", "喝", "五段動詞"),
    ("聞く", "きく", "聽、詢問", "五段動詞"),
    ("書く", "かく", "寫", "五段動詞"),
    ("読む", "よむ", "讀、閱讀", "五段動詞"),
    ("話す", "はなす", "說話、交談", "五段動詞"),
    ("言う", "いう", "說、表達", "五段動詞"),
    ("使う", "つかう", "使用", "五段動詞"),
    ("作る", "つくる", "製作、做", "五段動詞"),
    ("思う", "おもう", "想、認為", "五段動詞"),
    ("知る", "しる", "知道、得知", "五段動詞"),
    ("帰る", "かえる", "回去、回家", "五段動詞"),
    ("買う", "かう", "買", "五段動詞"),
    ("待つ", "まつ", "等待", "五段動詞"),
    ("会う", "あう", "見面、遇見", "五段動詞"),
    ("起きる", "おきる", "起床、發生", "一段動詞"),
    ("寝る", "ねる", "睡覺", "一段動詞"),
    ("働く", "はたらく", "工作、勞動", "五段動詞"),
    ("歩く", "あるく", "走路、步行", "五段動詞"),
    ("走る", "はしる", "跑、行駛", "五段動詞"),
    ("分かる", "わかる", "懂、明白", "五段動詞"),
    ("遊ぶ", "あそぶ", "玩、遊玩", "五段動詞"),
    ("休む", "やすむ", "休息、請假", "五段動詞"),
    ("立つ", "たつ", "站立", "五段動詞"),
    ("座る", "すわる", "坐", "五段動詞"),
    ("開ける", "あける", "打開", "一段動詞"),
    ("閉める", "しめる", "關上", "一段動詞"),
    ("入る", "はいる", "進入", "五段動詞"),
    ("出る", "でる", "出來、離開", "一段動詞"),
    ("乗る", "のる", "搭乘", "五段動詞"),
    ("降りる", "おりる", "下車、下來", "一段動詞"),
    ("洗う", "あらう", "洗", "五段動詞"),
    ("着る", "きる", "穿", "一段動詞"),
    ("借りる", "かりる", "借入", "一段動詞"),
    ("貸す", "かす", "借出", "五段動詞"),
    ("返す", "かえす", "歸還", "五段動詞"),
    ("教える", "おしえる", "教、告訴", "一段動詞"),
    ("習う", "ならう", "學習", "五段動詞"),
    ("覚える", "おぼえる", "記住、學會", "一段動詞"),
    ("忘れる", "わすれる", "忘記", "一段動詞"),
    ("探す", "さがす", "尋找", "五段動詞"),
    ("見つける", "みつける", "找到、發現", "一段動詞"),
    ("始める", "はじめる", "開始", "一段動詞"),
    ("終わる", "おわる", "結束", "五段動詞"),
    ("続ける", "つづける", "繼續", "一段動詞"),
    ("止める", "とめる", "停止、阻止", "一段動詞"),
    ("直す", "なおす", "修理、改正", "五段動詞"),
    ("払う", "はらう", "支付", "五段動詞"),
    ("送る", "おくる", "寄送、送行", "五段動詞"),
    ("受ける", "うける", "接受、參加", "一段動詞"),
    ("渡す", "わたす", "交給、渡過", "五段動詞"),
    ("渡る", "わたる", "渡過、穿越", "五段動詞"),
    ("曲がる", "まがる", "轉彎、彎曲", "五段動詞"),
    ("並ぶ", "ならぶ", "排隊、並列", "五段動詞"),
    ("並べる", "ならべる", "排列", "一段動詞"),
    ("急ぐ", "いそぐ", "趕快、著急", "五段動詞"),
    ("手伝う", "てつだう", "幫忙", "五段動詞"),
    ("持つ", "もつ", "拿、持有", "五段動詞"),
]


def to_kana(text: str) -> str:
    return "".join(part["hira"] for part in KAKASI.convert(text))


def godan_forms(word: str, reading: str):
    stem = word[:-1]
    ending = reading[-1]
    table = {
        "う": ("います", "って", "った", "わない", "える", "われる", "わせる", "え", "えば", "おう"),
        "く": ("きます", "いて", "いた", "かない", "ける", "かれる", "かせる", "け", "けば", "こう"),
        "ぐ": ("ぎます", "いで", "いだ", "がない", "げる", "がれる", "がせる", "げ", "げば", "ごう"),
        "す": ("します", "して", "した", "さない", "せる", "される", "させる", "せ", "せば", "そう"),
        "つ": ("ちます", "って", "った", "たない", "てる", "たれる", "たせる", "て", "てば", "とう"),
        "ぬ": ("にます", "んで", "んだ", "なない", "ねる", "なれる", "なせる", "ね", "ねば", "のう"),
        "ぶ": ("びます", "んで", "んだ", "ばない", "べる", "ばれる", "ばせる", "べ", "べば", "ぼう"),
        "む": ("みます", "んで", "んだ", "まない", "める", "まれる", "ませる", "め", "めば", "もう"),
        "る": ("ります", "って", "った", "らない", "れる", "られる", "らせる", "れ", "れば", "ろう"),
    }
    masu, te, ta, nai, potential, passive, causative, imperative, conditional, volitional = table[ending]
    if reading == "いく":
        te, ta = "って", "った"
    return {
        "masu_form": f"{stem}{masu}",
        "te_form": f"{stem}{te}",
        "ta_form": f"{stem}{ta}",
        "nai_form": f"{stem}{nai}",
        "potential_form": f"{stem}{potential}",
        "passive_form": f"{stem}{passive}",
        "causative_form": f"{stem}{causative}",
        "imperative_form": f"{stem}{imperative}",
        "conditional_form": f"{stem}{conditional}",
        "volitional_form": f"{stem}{volitional}",
    }


def verb_info(word, reading, verb_type):
    if verb_type == "サ変動詞":
        forms = {
            "masu_form": "します",
            "te_form": "して",
            "ta_form": "した",
            "nai_form": "しない",
            "potential_form": "できる",
            "passive_form": "される",
            "causative_form": "させる",
            "imperative_form": "しろ",
            "conditional_form": "すれば",
            "volitional_form": "しよう",
        }
    elif verb_type == "カ変動詞":
        forms = {
            "masu_form": "来ます",
            "te_form": "来て",
            "ta_form": "来た",
            "nai_form": "来ない",
            "potential_form": "来られる",
            "passive_form": "来られる",
            "causative_form": "来させる",
            "imperative_form": "来い",
            "conditional_form": "来れば",
            "volitional_form": "来よう",
        }
    elif verb_type == "一段動詞":
        stem = word[:-1]
        forms = {
            "masu_form": f"{stem}ます",
            "te_form": f"{stem}て",
            "ta_form": f"{stem}た",
            "nai_form": f"{stem}ない",
            "potential_form": f"{stem}られる",
            "passive_form": f"{stem}られる",
            "causative_form": f"{stem}させる",
            "imperative_form": f"{stem}ろ",
            "conditional_form": f"{stem}れば",
            "volitional_form": f"{stem}よう",
        }
    else:
        forms = godan_forms(word, reading)
    return {
        "verb_type": verb_type,
        "dictionary_form": word,
        **forms,
        "notes": "基礎動詞優先表補入，已按常用規則產生。"
    }


def make_entry(template, word, reading, meaning, verb_type):
    example_jp = f"「{word}」は日常会話でよく使う動詞です。"
    return {
        **template,
        "word": word,
        "reading": reading,
        "part_of_speech": "動詞",
        "meaning": meaning,
        "example": {
            "japanese": example_jp,
            "reading": to_kana(example_jp),
            "chinese": f"「{word}」是日常會話中常用的動詞。"
        },
        "verb_info": verb_info(word, reading, verb_type),
        "related": [],
        "source": {
            "dictionary": "JMdict / EDRDG + essential verb insertion",
            "example": "verb curated",
            "frequency": "learning-priority essential verb"
        },
        "_quality": {
            "meaning_source": "verb curated",
            "example_source": "verb curated",
            "frequency_source": "learning-priority essential verb",
            "jlpt_source": "rank heuristic; JLPT official vocabulary lists are not published",
            "quality_score": "verb_curated"
        },
        "quality_score": "verb_curated"
    }


def main():
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    essential_by_key = {
        (word, reading): (meaning, verb_type)
        for word, reading, meaning, verb_type in ESSENTIAL_VERBS
    }

    for entry in vocab:
        key = (entry["word"], entry["reading"])
        if key not in essential_by_key:
            continue
        meaning, verb_type = essential_by_key[key]
        entry["part_of_speech"] = "動詞"
        entry["meaning"] = meaning
        entry["verb_info"] = verb_info(entry["word"], entry["reading"], verb_type)
        entry["quality_score"] = "verb_curated"
        entry.setdefault("_quality", {})["quality_score"] = "verb_curated"
        entry.setdefault("_quality", {})["meaning_source"] = "verb curated"
        entry.setdefault("_quality", {})["example_source"] = "verb curated"

    existing = {(e["word"], e["reading"]) for e in vocab}
    missing = [item for item in ESSENTIAL_VERBS if (item[0], item[1]) not in existing]

    if missing:
        replace_indices = list(range(len(vocab) - 1, len(vocab) - 1 - len(missing), -1))
        replace_indices.reverse()
        for idx, (word, reading, meaning, verb_type) in zip(replace_indices, missing):
            template = vocab[idx]
            vocab[idx] = make_entry(template, word, reading, meaning, verb_type)

    essential_keys = {(word, reading) for word, reading, _meaning, _verb_type in ESSENTIAL_VERBS}
    essential_entries = []
    other_entries = []
    used_keys = set()
    for word, reading, _meaning, _verb_type in ESSENTIAL_VERBS:
        for entry in vocab:
            if (entry["word"], entry["reading"]) == (word, reading) and (word, reading) not in used_keys:
                essential_entries.append(entry)
                used_keys.add((word, reading))
                break
    for entry in vocab:
        if (entry["word"], entry["reading"]) in used_keys:
            continue
        other_entries.append(entry)

    foundation_head = other_entries[:25]
    foundation_tail = other_entries[25:]
    vocab = foundation_head + essential_entries + foundation_tail

    for index, entry in enumerate(vocab, start=1):
        entry["id"] = index
        entry["frequency_rank"] = index
        entry["tranche_id"] = ((index - 1) // 1000) + 1
        entry["jlpt_level"] = "N5" if index <= 1000 else "N4" if index <= 2500 else "N3" if index <= 5000 else "N2" if index <= 8000 else "N1"

    VOCAB_PATH.write_text(json.dumps(vocab, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Inserted {len(missing)} essential verbs and promoted {len(essential_entries)} essentials.")


if __name__ == "__main__":
    main()

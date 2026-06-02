#!/usr/bin/env python3
"""Generate the production-shaped 10,000-word vocabulary dataset.

Input:
- public/data/raw/JMdict.gz from EDRDG.

Output:
- public/data/vocab_10000.json
- public/data/tranches.json is kept separately by the app.

This generator is deliberately deterministic. It uses JMdict priority tags for
ranking, converts examples to kana with pykakasi, and creates generated fallback
examples where an open example sentence is not yet matched.
"""

from __future__ import annotations

import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Any

try:
    import pykakasi
except ImportError:
    print("pykakasi is required. Install with: python3 -m pip install pykakasi")
    raise


RAW_JMDICT = Path("public/data/raw/JMdict.gz")
OUTPUT = Path("public/data/vocab_10000.json")
TARGET_SIZE = 10000

POS_MAP = [
    ("noun", "名詞"),
    ("proper noun", "名詞"),
    ("pronoun", "代名詞"),
    ("Godan verb", "動詞"),
    ("Ichidan verb", "動詞"),
    ("Nidan verb", "動詞"),
    ("Yodan verb", "動詞"),
    ("Kuru verb", "動詞"),
    ("Suru verb", "サ変動詞"),
    ("su verb", "サ変動詞"),
    ("adjective (keiyoushi)", "形容詞"),
    ("adjectival nouns", "形容動詞"),
    ("pre-noun adjectival", "連体詞"),
    ("adverb", "副詞"),
    ("conjunction", "接続詞"),
    ("interjection", "感動詞"),
    ("particle", "助詞"),
    ("auxiliary verb", "助動詞"),
    ("auxiliary adjective", "補助形容詞"),
    ("expression", "表現"),
]

JLPT_BY_RANK = [
    (1000, "N5"),
    (2500, "N4"),
    (5000, "N3"),
    (8000, "N2"),
    (TARGET_SIZE, "N1"),
]

COMMON_GLOSS_ZH = {
    "safety": "安全",
    "security": "安全、保障",
    "since": "自從、以來",
    "henceforth": "從此以後",
    "ever since": "從那時起",
    "committee": "委員會",
    "commission": "委員會、委託",
    "board": "委員會、董事會",
    "panel": "小組、面板",
    "committee member": "委員",
    "chairperson (of a committee)": "委員長",
    "chair": "主席、椅子",
    "chairman": "主席",
    "chairwoman": "女主席",
    "opinion": "意見",
    "view": "看法",
    "comment": "評論、意見",
    "significance": "意義",
    "sense": "意思、感覺",
    "person": "人",
    "people": "人們",
    "friend": "朋友",
    "family": "家人",
    "work": "工作",
    "job": "工作",
    "study": "學習",
    "school": "學校",
    "teacher": "老師",
    "student": "學生",
    "time": "時間",
    "day": "日子",
    "today": "今天",
    "tomorrow": "明天",
    "yesterday": "昨天",
    "morning": "早上",
    "night": "夜晚",
    "food": "食物",
    "water": "水",
    "money": "錢",
    "book": "書",
    "language": "語言",
    "Japanese": "日語",
    "China": "中國",
    "Chinese": "中文",
    "Japan": "日本",
    "place": "地方",
    "thing": "事物",
    "matter": "事情",
    "meaning": "意思",
    "reason": "理由",
    "way": "方法",
    "road": "道路",
    "voice": "聲音",
    "sound": "聲音",
    "heart": "心",
    "feeling": "感覺",
    "idea": "想法",
    "news": "新聞",
    "society": "社會",
    "country": "國家",
    "city": "城市",
    "house": "房子",
    "room": "房間",
    "car": "車",
    "train": "電車",
    "station": "車站",
    "to go": "去",
    "to come": "來",
    "to do": "做",
    "to make": "製作",
    "to see": "看見",
    "to look": "看",
    "to read": "閱讀",
    "to write": "書寫",
    "to speak": "說話",
    "to say": "說",
    "to hear": "聽見",
    "to listen": "聽",
    "to eat": "吃",
    "to drink": "喝",
    "to buy": "買",
    "to sell": "賣",
    "to know": "知道",
    "to understand": "理解",
    "to think": "思考",
    "to feel": "感覺",
    "to use": "使用",
    "to wait": "等待",
    "to meet": "見面",
    "to begin": "開始",
    "to end": "結束",
    "new": "新的",
    "old": "舊的",
    "good": "好的",
    "bad": "不好的",
    "big": "大的",
    "small": "小的",
    "long": "長的",
    "short": "短的",
    "hot": "熱的",
    "cold": "冷的",
    "easy": "容易的",
    "difficult": "困難的",
    "important": "重要的",
    "necessary": "必要的",
    "beautiful": "美麗的",
    "interesting": "有趣的",
    "fun": "有趣",
}


def kana_converter():
    kakasi = pykakasi.kakasi()
    return kakasi


KAKASI = kana_converter()


def to_kana(text: str) -> str:
    parts = KAKASI.convert(text)
    return "".join(part["hira"] for part in parts)


def priority_score(pris: list[str], sequence_index: int) -> tuple[int, int]:
    score = 1_000_000
    for pri in pris:
        if pri.startswith("news1"):
            score = min(score, 10_000)
        elif pri.startswith("ichi1"):
            score = min(score, 12_000)
        elif pri.startswith("spec1"):
            score = min(score, 16_000)
        elif pri.startswith("gai1"):
            score = min(score, 18_000)
        elif pri.startswith("news2"):
            score = min(score, 30_000)
        elif pri.startswith("ichi2"):
            score = min(score, 32_000)
        elif pri.startswith("spec2"):
            score = min(score, 36_000)
        elif pri.startswith("gai2"):
            score = min(score, 38_000)
        elif pri.startswith("nf"):
            number = re.sub(r"\D", "", pri)
            if number:
                score = min(score, 1000 + int(number) * 100)
    return score, sequence_index


def map_pos(raw_pos: list[str]) -> str:
    mapped: list[str] = []
    for pos in raw_pos:
        for needle, label in POS_MAP:
            if needle in pos and label not in mapped:
                mapped.append(label)
    if not mapped:
        mapped.append("未分類")
    if "動詞" in mapped and "サ変動詞" in mapped:
        mapped.remove("サ変動詞")
    return "・".join(mapped[:3])


def has_only_cjk_word(word: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", word)) and not re.search(r"[\u3040-\u30ff]", word)


def meaning_from_glosses(word: str, glosses: list[str]) -> str:
    translated = []
    if has_only_cjk_word(word):
        translated.append(word)
    for gloss in glosses[:4]:
        clean = re.sub(r"\s+", " ", gloss).strip()
        key = clean.strip(";").strip()
        zh = COMMON_GLOSS_ZH.get(key)
        if not zh:
            lower = key.lower()
            zh = COMMON_GLOSS_ZH.get(lower)
        if not zh and lower.startswith("to "):
            zh = COMMON_GLOSS_ZH.get(lower)
        translated.append(zh or key)
    return "、".join(dict.fromkeys(translated))


def jlpt_for_rank(rank: int) -> str:
    for max_rank, level in JLPT_BY_RANK:
        if rank <= max_rank:
            return level
    return "未標記"


def generated_example(word: str, pos: str, meaning: str) -> dict[str, str]:
    first_meaning = meaning.split("、")[0]
    pos_tokens = set(pos.split("・"))
    if "動詞" in pos_tokens:
        japanese = f"今日は「{word}」という動詞を練習しました。"
        chinese = f"今天練習了「{word}」這個動詞。"
    elif "形容詞" in pos_tokens or "形容動詞" in pos_tokens:
        japanese = f"この言葉は「{first_meaning}」という意味です。"
        chinese = f"這個詞的意思是「{first_meaning}」。"
    else:
        japanese = f"この「{word}」について勉強しました。"
        chinese = f"我學習了關於「{word}」的內容。"
    return {
        "japanese": japanese,
        "reading": to_kana(japanese),
        "chinese": chinese,
    }


def verb_group(word: str, reading: str, raw_pos: list[str]) -> str:
    joined = " ".join(raw_pos)
    if "Ichidan" in joined:
        return "一段動詞"
    if "Kuru" in joined or reading == "くる":
        return "カ変動詞"
    if "Suru" in joined or reading == "する" or word.endswith("する"):
        return "サ変動詞"
    return "五段動詞"


def conjugate_godan(word: str, reading: str) -> dict[str, str]:
    ending = reading[-1]
    stem = word[:-1]
    maps = {
        "う": ("い", "って", "った", "わ", "える", "われる", "わせる", "え", "えば", "おう"),
        "く": ("き", "いて", "いた", "か", "ける", "かれる", "かせる", "け", "けば", "こう"),
        "ぐ": ("ぎ", "いで", "いだ", "が", "げる", "がれる", "がせる", "げ", "げば", "ごう"),
        "す": ("し", "して", "した", "さ", "せる", "される", "させる", "せ", "せば", "そう"),
        "つ": ("ち", "って", "った", "た", "てる", "たれる", "たせる", "て", "てば", "とう"),
        "ぬ": ("に", "んで", "んだ", "な", "ねる", "なれる", "なせる", "ね", "ねば", "のう"),
        "ぶ": ("び", "んで", "んだ", "ば", "べる", "ばれる", "ばせる", "べ", "べば", "ぼう"),
        "む": ("み", "んで", "んだ", "ま", "める", "まれる", "ませる", "め", "めば", "もう"),
        "る": ("り", "って", "った", "ら", "れる", "られる", "らせる", "れ", "れば", "ろう"),
    }
    masu, te, ta, nai, potential, passive, causative, imperative, conditional, volitional = maps.get(
        ending, ("", "て", "た", "", "できる", "される", "させる", "", "れば", "よう")
    )
    if reading == "いく":
        te, ta = "って", "った"
    return {
        "masu_form": f"{stem}{masu}ます",
        "te_form": f"{stem}{te}",
        "ta_form": f"{stem}{ta}",
        "nai_form": f"{stem}{nai}ない",
        "potential_form": f"{stem}{potential}",
        "passive_form": f"{stem}{passive}",
        "causative_form": f"{stem}{causative}",
        "imperative_form": f"{stem}{imperative}",
        "conditional_form": f"{stem}{conditional}",
        "volitional_form": f"{stem}{volitional}",
    }


def verb_info(word: str, reading: str, raw_pos: list[str], pos: str) -> dict[str, str] | None:
    if "動詞" not in pos:
        return None
    group = verb_group(word, reading, raw_pos)
    if group == "一段動詞" and word.endswith("る"):
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
    elif group == "サ変動詞":
        base = word[:-2] if word.endswith("する") else ""
        forms = {
            "masu_form": f"{base}します",
            "te_form": f"{base}して",
            "ta_form": f"{base}した",
            "nai_form": f"{base}しない",
            "potential_form": f"{base}できる",
            "passive_form": f"{base}される",
            "causative_form": f"{base}させる",
            "imperative_form": f"{base}しろ",
            "conditional_form": f"{base}すれば",
            "volitional_form": f"{base}しよう",
        }
    elif group == "カ変動詞":
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
    else:
        forms = conjugate_godan(word, reading)
    return {
        "verb_type": group,
        "dictionary_form": word,
        **forms,
        "notes": "由 JMdict 詞性與規則自動產生，正式版可再人工抽查。",
    }


def choose_word(kebs: list[str], readings: list[str]) -> tuple[str, str]:
    if kebs:
        return kebs[0], readings[0]
    return readings[0], readings[0]


def parse_jmdict() -> list[dict[str, Any]]:
    if not RAW_JMDICT.exists():
        raise SystemExit(f"Missing {RAW_JMDICT}. Download JMdict.gz first.")

    candidates: list[dict[str, Any]] = []
    seen_words: set[tuple[str, str]] = set()

    with gzip.open(RAW_JMDICT, "rb") as source:
        context = ET.iterparse(source, events=("end",))
        for sequence_index, (_event, elem) in enumerate(context):
            if elem.tag != "entry":
                continue
            kebs = [node.text for node in elem.findall("k_ele/keb") if node.text]
            readings = [node.text for node in elem.findall("r_ele/reb") if node.text]
            if not readings:
                elem.clear()
                continue
            word, reading = choose_word(kebs, readings)
            if len(word) > 12 or re.search(r"[A-Za-z]", word):
                elem.clear()
                continue
            key = (word, reading)
            if key in seen_words:
                elem.clear()
                continue
            seen_words.add(key)

            pri = [
                node.text
                for node in list(elem.findall("k_ele/ke_pri")) + list(elem.findall("r_ele/re_pri"))
                if node.text
            ]
            senses = elem.findall("sense")
            raw_pos: list[str] = []
            glosses: list[str] = []
            for sense in senses:
                for node in sense.findall("pos"):
                    if node.text and node.text not in raw_pos:
                        raw_pos.append(node.text)
                for node in sense.findall("gloss"):
                    lang = node.attrib.get("{http://www.w3.org/XML/1998/namespace}lang")
                    if node.text and (lang is None or lang == "eng"):
                        glosses.append(node.text)
            if not glosses:
                elem.clear()
                continue

            score, order = priority_score(pri, sequence_index)
            pos = map_pos(raw_pos)
            candidates.append(
                {
                    "word": word,
                    "reading": reading,
                    "part_of_speech": pos,
                    "raw_pos": raw_pos,
                    "glosses": glosses,
                    "score": score,
                    "order": order,
                    "priority": pri,
                }
            )
            elem.clear()

    candidates.sort(key=lambda item: (item["score"], item["order"]))
    return candidates[:TARGET_SIZE]


def build_related(entries: list[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
    by_pos: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in entries:
        primary_pos = entry["part_of_speech"].split("・")[0]
        by_pos[primary_pos].append(entry)

    related: dict[int, list[dict[str, Any]]] = {}
    for index, entry in enumerate(entries):
        primary_pos = entry["part_of_speech"].split("・")[0]
        pool = by_pos[primary_pos]
        items = []
        for candidate in pool:
            if candidate["id"] == entry["id"]:
                continue
            items.append(
                {
                    "word": candidate["word"],
                    "reading": candidate["reading"],
                    "meaning": candidate["meaning"].split("、")[0],
                    "target_id": candidate["id"],
                }
            )
            if len(items) >= 2:
                break
        related[entry["id"]] = items
    return related


def main() -> None:
    entries = parse_jmdict()
    if len(entries) < TARGET_SIZE:
        raise SystemExit(f"Only found {len(entries)} entries; expected {TARGET_SIZE}")

    output_entries: list[dict[str, Any]] = []
    for index, item in enumerate(entries, start=1):
        meaning = meaning_from_glosses(item["word"], item["glosses"])
        tranche_id = ((index - 1) // 1000) + 1
        example = generated_example(item["word"], item["part_of_speech"], meaning)
        entry = {
            "id": index,
            "word": item["word"],
            "reading": item["reading"],
            "part_of_speech": item["part_of_speech"],
            "jlpt_level": jlpt_for_rank(index),
            "tranche_id": tranche_id,
            "frequency_rank": index,
            "meaning": meaning,
            "example": example,
            "verb_info": verb_info(item["word"], item["reading"], item["raw_pos"], item["part_of_speech"]),
            "related": [],
            "source": {
                "dictionary": "JMdict / EDRDG",
                "example": "generated fallback",
                "frequency": "JMdict priority tags"
            },
            "_quality": {
                "gloss_en": item["glosses"][:4],
                "priority": item["priority"][:4],
                "frequency_source": "JMdict priority tags, not BCCWJ",
                "jlpt_source": "rank heuristic; JLPT official vocabulary lists are not published",
            },
        }
        output_entries.append(entry)

    related = build_related(output_entries)
    for entry in output_entries:
        entry["related"] = related[entry["id"]]

    OUTPUT.write_text(json.dumps(output_entries, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(output_entries)} entries to {OUTPUT}")


if __name__ == "__main__":
    main()

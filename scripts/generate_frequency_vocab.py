#!/usr/bin/env python3
from __future__ import annotations

import gzip
import json
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Any

import pykakasi
from wordfreq import top_n_list


RAW_JMDICT = Path("public/data/raw/JMdict.gz")
OUTPUT = Path("public/data/vocab_13000.json")
TARGET_SIZE = 13000

KAKASI = pykakasi.kakasi()

POS_MAP = [
    ("noun", "名詞"),
    ("proper noun", "名詞"),
    ("pronoun", "代名詞"),
    ("Godan verb", "動詞"),
    ("Ichidan verb", "動詞"),
    ("Kuru verb", "動詞"),
    ("Suru verb", "サ変動詞"),
    ("adjective (keiyoushi)", "形容詞"),
    ("adjectival nouns", "形容動詞"),
    ("pre-noun adjectival", "連体詞"),
    ("adverb", "副詞"),
    ("conjunction", "接続詞"),
    ("interjection", "感動詞"),
    ("particle", "助詞"),
    ("auxiliary verb", "助動詞"),
    ("expression", "表現"),
]

SKIP_TOKENS = {
    "た", "し", "な", "ん", "れ", "う", "い", "さ", "お", "き", "せ", "わ", "え",
    "まし", "なっ", "だっ", "あっ", "思っ", "言っ", "でき", "くれ", "あり",
    "ー"
}

PARTICLE_KEEP = {"の", "に", "は", "が", "を", "で", "と", "も", "か", "へ", "から", "まで", "より"}

BASIC_SINGLE_KANJI_KEEP = {
    "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "百", "千", "万", "円",
    "日", "月", "火", "水", "木", "金", "土", "年", "時", "分", "人", "子", "女", "男",
    "上", "下", "中", "外", "右", "左", "前", "後", "東", "西", "南", "北", "本", "目",
    "口", "手", "足", "耳", "山", "川", "空", "雨", "花",
}

PREFERRED_KANA_GLOSSES = {
    "する": ["to do", "to carry out"],
    "いる": ["to be (of animate objects)", "to exist"],
    "ある": ["to be", "to exist"],
    "なる": ["to become", "to get"],
    "これ": ["this", "this one"],
    "それ": ["that", "it"],
    "てる": ["to be ...-ing"],
}

COMMON_GLOSS_ZH = {
    "person": "人",
    "people": "人們",
    "thing": "事物",
    "matter": "事情",
    "time": "時間",
    "day": "日子",
    "year": "年",
    "month": "月",
    "Japan": "日本",
    "Japanese": "日語",
    "to do": "做、進行",
    "to go": "去、前往",
    "to come": "來",
    "to see": "看見",
    "to look": "看",
    "to listen": "聽",
    "to hear": "聽見",
    "to say": "說",
    "to think": "想、認為",
    "to know": "知道",
    "to use": "使用",
    "to make": "製作",
    "good": "好的",
    "not": "不、沒有",
    "one": "一個",
    "right": "右、右邊",
    "left": "左、左邊",
    "inside": "裡面",
    "outside": "外面",
    "before": "以前、前面",
    "after": "之後",
    "friend": "朋友",
    "family": "家人",
    "work": "工作",
    "study": "學習",
    "school": "學校",
    "book": "書",
    "money": "錢",
    "food": "食物",
    "water": "水",
    "music": "音樂",
    "movie": "電影",
}


def to_kana(text: str) -> str:
    return "".join(part["hira"] for part in KAKASI.convert(text))


def has_cjk(text: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", text))


def is_bad_token(token: str) -> bool:
    if token in PARTICLE_KEEP:
        return False
    if token in SKIP_TOKENS:
        return True
    if re.fullmatch(r"[0-9０-９]+", token):
        return True
    if len(token) == 1 and re.fullmatch(r"[\u3040-\u309f]", token):
        return True
    return False


def is_single_cjk_word(word: str) -> bool:
    return bool(re.fullmatch(r"[\u4e00-\u9fff]", word))


def should_skip_frequency_entry(entry: dict[str, Any]) -> bool:
    word = entry["word"]
    if is_single_cjk_word(word) and word not in BASIC_SINGLE_KANJI_KEEP:
        return True
    return False


def select_best_match(token: str, matches: list[dict[str, Any]]) -> dict[str, Any]:
    preferred_glosses = PREFERRED_KANA_GLOSSES.get(token)
    if preferred_glosses:
        preferred = [
            entry for entry in matches
            if any(gloss.lower().startswith(needle) for gloss in entry["glosses"] for needle in preferred_glosses)
        ]
        if preferred:
            return sorted(preferred, key=lambda entry: entry["priority_sort"])[0]

    def key(entry: dict[str, Any]) -> tuple[int, tuple[int, int]]:
        if entry["word"] == token:
            surface_score = 0
        elif token == entry["reading"] and not is_single_cjk_word(entry["word"]):
            surface_score = 1
        elif token in entry["all_keys"]:
            surface_score = 2
        else:
            surface_score = 3
        return surface_score, entry["priority_sort"]

    return sorted(matches, key=key)[0]


def display_word_for_token(token: str | None, entry: dict[str, Any]) -> str:
    if token and re.fullmatch(r"[\u3040-\u30ffー]+", token) and token == entry["reading"]:
        return token
    return entry["word"]


def priority_score(pris: list[str], sequence_index: int) -> tuple[int, int]:
    score = 1_000_000
    for pri in pris:
        if pri.startswith("nf"):
            number = re.sub(r"\D", "", pri)
            if number:
                score = min(score, 1000 + int(number) * 100)
        elif pri.startswith("news1"):
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
    return score, sequence_index


def map_pos(raw_pos: list[str]) -> str:
    mapped = []
    for pos in raw_pos:
        for needle, label in POS_MAP:
            if needle in pos and label not in mapped:
                mapped.append(label)
    return "・".join(mapped[:3]) if mapped else "未分類"


def clean_gloss(gloss: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"\([^)]*\)", "", gloss)).strip(" ;,")


def meaning(word: str, glosses: list[str]) -> str:
    out = []
    if has_cjk(word):
        out.append(word)
    for gloss in glosses[:5]:
        clean = clean_gloss(gloss)
        zh = COMMON_GLOSS_ZH.get(clean) or COMMON_GLOSS_ZH.get(clean.lower())
        if zh:
            for part in zh.split("、"):
                if part not in out:
                    out.append(part)
    if not out:
        out.append(f"{word}這個詞")
    return "、".join(out[:3])


def jlpt_for_rank(rank: int) -> str:
    if rank <= 1000:
        return "N5"
    if rank <= 2500:
        return "N4"
    if rank <= 5000:
        return "N3"
    if rank <= 9000:
        return "N2"
    return "N1"


def parse_jmdict():
    entries = []
    index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen_seq = set()
    with gzip.open(RAW_JMDICT, "rb") as source:
        for sequence_index, (_event, elem) in enumerate(ET.iterparse(source, events=("end",))):
            if elem.tag != "entry":
                continue
            ent_seq = elem.findtext("ent_seq") or str(sequence_index)
            if ent_seq in seen_seq:
                elem.clear()
                continue
            seen_seq.add(ent_seq)
            kebs = [node.text for node in elem.findall("k_ele/keb") if node.text]
            readings = [node.text for node in elem.findall("r_ele/reb") if node.text]
            if not readings:
                elem.clear()
                continue
            raw_pos = []
            glosses = []
            for sense in elem.findall("sense"):
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
            pri = [node.text for node in list(elem.findall("k_ele/ke_pri")) + list(elem.findall("r_ele/re_pri")) if node.text]
            words = kebs or readings
            word = words[0]
            if len(word) > 16:
                elem.clear()
                continue
            entry = {
                "ent_seq": ent_seq,
                "word": word,
                "reading": readings[0],
                "all_keys": list(dict.fromkeys(words + readings)),
                "part_of_speech": map_pos(raw_pos),
                "raw_pos": raw_pos,
                "glosses": glosses,
                "priority": pri,
                "priority_sort": priority_score(pri, sequence_index),
            }
            entries.append(entry)
            for key in entry["all_keys"]:
                index[key].append(entry)
            elem.clear()
    return entries, index


def verb_info(word: str, reading: str, pos: str):
    if "動詞" not in pos.split("・"):
        return None
    # Keep verb forms conservative for generated common-word pass.
    return {
        "verb_type": "一段動詞" if word.endswith("る") else "五段動詞",
        "dictionary_form": word,
        "masu_form": f"{word}ます",
        "te_form": f"{word}て",
        "ta_form": f"{word}た",
        "nai_form": f"{word}ない",
        "potential_form": f"{word}ことができる",
        "passive_form": f"{word}られる",
        "causative_form": f"{word}させる",
        "imperative_form": word,
        "conditional_form": f"{word}なら",
        "volitional_form": f"{word}よう",
        "notes": "頻率主導生成資料；動詞變化可再由精修腳本覆蓋。"
    }


def example(word: str, pos: str, meaning_text: str):
    primary = meaning_text.split("、")[0]
    pos_tokens = set(pos.split("・"))
    seed = len(word) + len(pos) + len(meaning_text)

    def pick(items):
        return items[seed % len(items)]

    if len(word) == 1 and re.search(r"[\u4e00-\u9fff]", word):
        jp, zh = pick([
            (f"辞書で「{word}」という字を調べました。", f"我在字典裡查了「{word}」這個字。"),
            (f"今日は「{word}」という漢字を覚えました。", f"今天記住了「{word}」這個漢字。"),
            (f"本の中で「{word}」という字を見ました。", f"在書裡看到了「{word}」這個字。"),
        ])
    elif "動詞" in pos_tokens:
        jp, zh = pick([
            (f"授業で「{word}」の使い方を練習しました。", f"在課堂上練習了「{primary}」的用法。"),
            (f"日記に「{word}」を使った文を書きました。", f"在日記裡寫了使用「{primary}」的句子。"),
            (f"友達と「{word}」の例文を作りました。", f"和朋友一起造了「{primary}」的例句。"),
        ])
    elif "助詞" in pos_tokens or "助動詞" in pos_tokens:
        jp, zh = pick([
            (f"「{word}」は文の中でよく使います。", f"「{word}」常在句子中使用。"),
            (f"短い文で「{word}」の使い方を確認しました。", f"用短句確認了「{word}」的用法。"),
            (f"作文で「{word}」を正しく使いたいです。", f"我想在作文裡正確使用「{word}」。"),
        ])
    else:
        jp, zh = pick([
            (f"授業で「{word}」について話しました。", f"在課堂上討論了「{primary}」。"),
            (f"本の中で「{word}」という言葉を見ました。", f"在書裡看到了「{primary}」這個詞。"),
            (f"辞書で「{word}」を調べました。", f"在字典裡查了「{primary}」。"),
            (f"会話の中で「{word}」という言葉が出ました。", f"對話中出現了「{primary}」這個詞。"),
        ])
    return {"japanese": jp, "reading": to_kana(jp), "chinese": zh}


def build_related(selected):
    by_pos = defaultdict(list)
    for entry in selected:
        by_pos[entry["part_of_speech"].split("・")[0]].append(entry)
    for entry in selected:
        pool = by_pos[entry["part_of_speech"].split("・")[0]]
        rel = []
        for item in pool:
            if item["id"] == entry["id"]:
                continue
            rel.append({
                "word": item["word"],
                "reading": item["reading"],
                "meaning": item["meaning"].split("、")[0],
                "target_id": item["id"],
            })
            if len(rel) == 2:
                break
        entry["related"] = rel


def main():
    entries, index = parse_jmdict()
    selected_raw = []
    used_seq = set()
    used_word_reading = set()

    for token in top_n_list("ja", 120000):
        if is_bad_token(token):
            continue
        matches = index.get(token)
        if not matches:
            continue
        entry = select_best_match(token, matches)
        if should_skip_frequency_entry(entry):
            continue
        if entry["ent_seq"] in used_seq:
            continue
        display_word = display_word_for_token(token, entry)
        word_key = (display_word, entry["reading"])
        if word_key in used_word_reading:
            continue
        used_seq.add(entry["ent_seq"])
        used_word_reading.add(word_key)
        selected_raw.append((entry, f"wordfreq token:{token}", token))
        if len(selected_raw) >= TARGET_SIZE:
            break

    if len(selected_raw) < TARGET_SIZE:
        for entry in sorted(entries, key=lambda e: e["priority_sort"]):
            if entry["ent_seq"] in used_seq or is_bad_token(entry["word"]):
                continue
            word_key = (entry["word"], entry["reading"])
            if word_key in used_word_reading:
                continue
            used_seq.add(entry["ent_seq"])
            used_word_reading.add(word_key)
            selected_raw.append((entry, "JMdict priority backfill", None))
            if len(selected_raw) >= TARGET_SIZE:
                break

    output = []
    for rank, (entry, freq_source, token) in enumerate(selected_raw[:TARGET_SIZE], start=1):
        display_word = display_word_for_token(token, entry)
        m = meaning(display_word, entry["glosses"])
        pos = entry["part_of_speech"]
        out = {
            "id": rank,
            "word": display_word,
            "reading": entry["reading"],
            "part_of_speech": pos,
            "jlpt_level": jlpt_for_rank(rank),
            "tranche_id": ((rank - 1) // 1000) + 1,
            "frequency_rank": rank,
            "meaning": m,
            "example": example(display_word, pos, m),
            "verb_info": verb_info(display_word, entry["reading"], pos),
            "related": [],
            "source": {
                "dictionary": "JMdict / EDRDG",
                "example": "completed simple example",
                "frequency": freq_source,
            },
            "_quality": {
                "gloss_en": entry["glosses"][:4],
                "priority": entry["priority"][:4],
                "meaning_source": "rule completed",
                "example_source": "rule completed",
                "frequency_source": freq_source,
                "jlpt_source": "rank heuristic; JLPT official vocabulary lists are not published",
                "quality_score": "rule_completed",
            },
            "quality_score": "rule_completed",
        }
        output.append(out)

    build_related(output)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(output)} frequency-led entries to {OUTPUT}")


if __name__ == "__main__":
    main()

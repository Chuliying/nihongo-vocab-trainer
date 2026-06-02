#!/usr/bin/env python3
"""Complete all vocabulary entries with non-empty Traditional Chinese
meanings and simple learner-friendly examples.

This is a deterministic completion pass. It keeps manually curated enrichment
records when present, and fills the rest with conservative learner examples.
The generated examples use several sentence frames so the dataset does not
collapse into a single dictionary-note pattern.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pykakasi
from opencc import OpenCC


VOCAB_PATH = Path("public/data/vocab_13000.json")
KAKASI = pykakasi.kakasi()
OPENCC = OpenCC("s2t")

GLOSS_ZH = {
    "safety": "安全",
    "security": "安全保障",
    "since": "自從、以來",
    "henceforth": "從此以後",
    "ever since": "自那時以來",
    "committee member": "委員",
    "committee": "委員會",
    "commission": "委員會",
    "board": "委員會",
    "panel": "小組",
    "chairperson (of a committee)": "委員長",
    "chair": "主席",
    "chairman": "主席",
    "chairwoman": "主席",
    "opinion": "意見",
    "view": "看法",
    "comment": "意見",
    "meaning": "意思",
    "significance": "意義",
    "sense": "意思",
    "maintenance": "維持",
    "preservation": "保存",
    "improvement": "改善",
    "violation": "違反",
    "offense": "違反",
    "offence": "違反",
    "breach": "違反",
    "medical treatment": "醫療",
    "medical care": "醫療照護",
    "one": "一個",
    "for one thing": "其中一點",
    "only": "只有",
    "January": "一月",
    "general": "一般",
    "universal": "普遍",
    "ordinary": "普通",
    "average": "平均",
    "number one": "第一",
    "first": "第一",
    "first place": "第一名",
    "best": "最好",
    "one part": "一部分",
    "one portion": "一部分",
    "one section": "一部分",
    "one way": "一方、方向",
    "right": "右",
    "right-hand side": "右邊",
    "right hand": "右手",
    "exercise": "運動",
    "physical training": "體能訓練",
    "workout": "運動",
    "sports": "運動",
    "influence": "影響",
    "effect": "影響",
    "impact": "影響",
    "movie": "電影",
    "film": "電影",
    "motion picture": "電影",
    "assistance": "援助",
    "aid": "援助",
    "support": "支援",
    "Europe": "歐洲",
    "music": "音樂",
    "price": "價格",
    "value": "價值",
    "cost": "成本",
    "participation": "參加",
    "affiliation": "加盟",
    "possible": "可能",
    "potential": "可能性",
    "possibility": "可能性",
    "chance": "機會",
    "likelihood": "可能性",
    "probability": "可能性",
    "summer": "夏天",
    "family": "家人",
    "person": "人",
    "people": "人們",
    "friend": "朋友",
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
    "food": "食物",
    "water": "水",
    "money": "錢",
    "book": "書",
    "language": "語言",
    "Japanese": "日語",
    "Japan": "日本",
    "place": "地方",
    "thing": "事物",
    "matter": "事情",
    "reason": "理由",
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
}


def to_kana(text: str) -> str:
    return "".join(part["hira"] for part in KAKASI.convert(text))


def has_ascii(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]", text))


def cjk_base(word: str) -> str:
    if re.search(r"[\u4e00-\u9fff]", word):
        return OPENCC.convert(word)
    return ""


def clean_english_gloss(gloss: str) -> str:
    gloss = re.sub(r"\([^)]*\)", "", gloss).strip()
    gloss = re.sub(r"\s+", " ", gloss)
    return gloss.strip(" ;,")


def zh_from_glosses(entry: dict) -> list[str]:
    result: list[str] = []
    quality = entry.get("_quality", {})
    for gloss in quality.get("gloss_en", [])[:6]:
        clean = clean_english_gloss(gloss)
        for part in re.split(r";|,", clean):
            part = part.strip()
            if not part:
                continue
            zh = GLOSS_ZH.get(part) or GLOSS_ZH.get(part.lower())
            if zh and zh not in result:
                result.append(zh)
    return result


def complete_meaning(entry: dict) -> str:
    if entry.get("source", {}).get("example") == "LLM curated" and entry.get("meaning") and not has_ascii(entry["meaning"]):
        return entry["meaning"]

    meanings: list[str] = []
    base = cjk_base(entry["word"])
    if base:
        meanings.append(base)
    for zh in zh_from_glosses(entry):
        for part in zh.split("、"):
            if part and part not in meanings:
                meanings.append(part)

    if not meanings:
        pos = entry["part_of_speech"].split("・")[0]
        if pos == "動詞":
            meanings.append(f"{entry['word']}的動作")
        elif pos in {"形容詞", "形容動詞"}:
            meanings.append(f"{entry['word']}的狀態")
        elif pos == "副詞":
            meanings.append(f"{entry['word']}的語氣")
        else:
            meanings.append(f"{entry['word']}這個詞")

    return "、".join(meanings[:3])


def simple_example(entry: dict, meaning: str) -> dict:
    if entry.get("source", {}).get("example") == "LLM curated":
        example = entry["example"]
        return {
            "japanese": example["japanese"],
            "reading": to_kana(example["japanese"]),
            "chinese": example["chinese"],
        }

    word = entry["word"]
    primary = meaning.split("、")[0]
    pos_tokens = set(entry["part_of_speech"].split("・"))
    frame_seed = entry["id"] + len(word) + len(entry.get("reading", ""))

    def pick(items: list[tuple[str, str]]) -> tuple[str, str]:
        return items[frame_seed % len(items)]

    if len(word) == 1 and re.search(r"[\u4e00-\u9fff]", word):
        japanese, chinese = pick([
            (f"辞書で「{word}」という字を調べました。", f"我在字典裡查了「{word}」這個字。"),
            (f"先生が黒板に「{word}」を書きました。", f"老師在黑板上寫了「{word}」。"),
            (f"今日は「{word}」という漢字を覚えました。", f"今天記住了「{word}」這個漢字。"),
            (f"本の中で「{word}」という字を見ました。", f"在書裡看到了「{word}」這個字。"),
        ])
    elif "助詞" in pos_tokens:
        japanese, chinese = pick([
            (f"「{word}」は文の中でよく使います。", f"「{word}」常在句子中使用。"),
            (f"短い文で「{word}」の使い方を確認しました。", f"用短句確認了「{word}」的用法。"),
            (f"先生は「{word}」を使った例を出しました。", f"老師舉了使用「{word}」的例子。"),
            (f"作文で「{word}」を正しく使いたいです。", f"我想在作文裡正確使用「{word}」。"),
        ])
    elif "助動詞" in pos_tokens:
        japanese, chinese = pick([
            (f"会話で「{word}」を自然に使いました。", f"在會話中自然地使用了「{word}」。"),
            (f"「{word}」を入れると文が丁寧になります。", f"加入「{word}」後句子會變得禮貌。"),
            (f"練習問題で「{word}」の形を確認しました。", f"在練習題中確認了「{word}」的形式。"),
        ])
    elif "動詞" in pos_tokens:
        japanese, chinese = pick([
            (f"授業で「{word}」の使い方を練習しました。", f"在課堂上練習了「{primary}」的用法。"),
            (f"日記に「{word}」を使った文を書きました。", f"在日記裡寫了使用「{primary}」的句子。"),
            (f"友達と「{word}」の例文を作りました。", f"和朋友一起造了「{primary}」的例句。"),
            (f"先生に「{word}」の使い方を聞きました。", f"向老師請教了「{primary}」的用法。"),
        ])
    elif "形容詞" in pos_tokens or "形容動詞" in pos_tokens:
        japanese, chinese = pick([
            (f"先生は「{word}」を使って短い文を作りました。", f"老師用「{primary}」造了短句。"),
            (f"会話で「{word}」という表現を聞きました。", f"在會話中聽到了「{primary}」這個說法。"),
            (f"作文に「{word}」を入れると表現が自然です。", f"作文裡加入「{primary}」會讓表達更自然。"),
            (f"今日は「{word}」の反対の意味も勉強しました。", f"今天也學了「{primary}」的相反意思。"),
        ])
    elif "副詞" in pos_tokens:
        japanese, chinese = pick([
            (f"会話の中で「{word}」を使いました。", f"在會話中使用了「{primary}」。"),
            (f"「{word}」を入れると文の感じが変わります。", f"加入「{primary}」後句子的感覺會改變。"),
            (f"作文で「{word}」を自然に使いたいです。", f"我想在作文裡自然地使用「{primary}」。"),
            (f"先生は「{word}」の使う場面を説明しました。", f"老師說明了「{primary}」的使用場合。"),
        ])
    elif "接続詞" in pos_tokens:
        japanese, chinese = pick([
            (f"二つの文をつなぐ時に「{word}」を使います。", f"連接兩個句子時會使用「{primary}」。"),
            (f"作文で「{word}」を使って文を続けました。", f"在作文中用「{primary}」接續句子。"),
            (f"先生は「{word}」の後に続く文を直しました。", f"老師修改了「{primary}」後面接的句子。"),
        ])
    elif "感動詞" in pos_tokens:
        japanese, chinese = pick([
            (f"友達は驚いて「{word}」と言いました。", f"朋友驚訝地說了「{primary}」。"),
            (f"会話の始めに「{word}」を使いました。", f"在對話開頭使用了「{primary}」。"),
            (f"「{word}」は気持ちを表す時に使います。", f"「{primary}」用在表達心情的時候。"),
        ])
    elif "表現" in pos_tokens:
        japanese, chinese = pick([
            (f"会話で「{word}」という表現を使いました。", f"在會話中使用了「{primary}」這個表達。"),
            (f"先生は「{word}」の自然な言い方を教えました。", f"老師教了「{primary}」的自然說法。"),
            (f"友達に「{word}」の意味を聞きました。", f"向朋友詢問了「{primary}」的意思。"),
        ])
    else:
        japanese, chinese = pick([
            (f"授業で「{word}」について話しました。", f"在課堂上討論了「{primary}」。"),
            (f"本の中で「{word}」という言葉を見ました。", f"在書裡看到了「{primary}」這個詞。"),
            (f"ニュースで「{word}」という言葉を聞きました。", f"在新聞裡聽到了「{primary}」這個詞。"),
            (f"友達と「{word}」のことを話しました。", f"和朋友聊到了「{primary}」。"),
            (f"先生は「{word}」の使い方を説明しました。", f"老師說明了「{primary}」的用法。"),
            (f"日記に「{word}」を使った文を書きました。", f"在日記裡寫了使用「{primary}」的句子。"),
            (f"辞書で「{word}」を調べました。", f"在字典裡查了「{primary}」。"),
            (f"会話の中で「{word}」という言葉が出ました。", f"對話中出現了「{primary}」這個詞。"),
        ])

    return {
        "japanese": japanese,
        "reading": to_kana(japanese),
        "chinese": chinese,
    }


def main() -> None:
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    completed = 0
    for entry in vocab:
        meaning = complete_meaning(entry)
        entry["meaning"] = meaning
        entry["example"] = simple_example(entry, meaning)
        if entry["source"]["example"] != "LLM curated":
            entry["source"]["example"] = "completed simple example"
            entry.setdefault("_quality", {})["meaning_source"] = "rule completed"
            entry.setdefault("_quality", {})["example_source"] = "rule completed"
        completed += 1

    VOCAB_PATH.write_text(json.dumps(vocab, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Completed {completed} entries.")


if __name__ == "__main__":
    main()

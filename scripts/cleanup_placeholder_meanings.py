#!/usr/bin/env python3
"""Clean placeholder meanings across the 13,000-word dataset.

This pass is intentionally narrower than complete_dataset.py: it only touches
entries whose meaning still contains placeholder markers such as "這個詞" or
"的動作". It preserves existing curated entries and upgrades the remaining
rule-completed placeholders using JMdict gloss hints plus conservative examples.
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

PLACEHOLDER_MARKERS = ("這個詞", "的動作", "的狀態", "的語氣")

EXACT_GLOSS_ZH = {
    "size": "尺寸、大小",
    "style": "風格、樣式",
    "band": "樂團、帶子",
    "free": "自由、免費",
    "main": "主要、主體",
    "i wonder": "不知道、是否",
    "even": "甚至、連…也",
    "so": "所以、那麼",
    "soon": "快要、差不多",
    "i see": "原來如此",
    "although": "雖然",
    "though": "雖然",
    "to win": "獲勝、贏",
    "opening": "開幕、開店",
    "nightclub": "夜店、俱樂部",
    "sports club": "運動俱樂部",
    "star": "明星、星星",
    "list": "清單、列表",
    "i'm sorry": "對不起、抱歉",
    "my apologies": "對不起、抱歉",
    "is it?": "是嗎、是不是",
    "drumming": "咚咚作響",
    "item": "物品、項目",
    "color": "顏色",
    "colour": "顏色",
    "gas": "瓦斯、氣體",
    "ball": "球",
    "race": "比賽、競賽",
    "oh!": "哎呀、啊",
    "oh": "啊、哎呀",
    "certainly": "一定、務必",
    "without fail": "一定、務必",
    "to get used to": "習慣、適應",
    "album": "相簿、專輯",
    "character": "角色、性格",
    "key": "鑰匙、關鍵、按鍵",
    "file": "檔案、文件夾",
    "base": "基礎、基地",
    "mark": "標記、記號",
    "radio": "收音機、廣播",
    "hello": "你好、午安",
    "for a moment": "暫時、一會兒",
    "very": "非常、很",
    "extremely": "非常、極度",
    "but": "但是、不過",
    "however": "但是、不過",
    "account": "帳號、帳戶",
    "energy": "能量、精力",
    "real": "真實、現實",
    "realistic": "真實的、現實的",
    "rule": "規則",
    "how": "如何、怎麼",
    "in what way": "如何、以什麼方式",
    "difficult to ...": "難以…、不容易…",
    "exactly": "正是、確實",
    "finally": "終於",
    "at last": "終於",
    "case": "情況、盒子",
    "stage": "舞台、階段",
    "back": "背面、後方",
    "underpants": "內褲",
    "pants": "褲子",
    "business": "商業、工作",
    "program": "節目、程式、計畫",
    "programme": "節目、計畫",
    "release": "發行、發布",
    "interrogative sentence-ending particle expressing doubt": "表疑問或遲疑的句尾助詞",
    "those": "那些",
    "they": "他們、那些",
    "by no means": "絕不、怎麼可能",
    "never!": "絕不、怎麼可能",
    "illustration": "插圖、插畫",
    "picture": "圖畫、照片",
    "shirt": "襯衫、上衣",
    "story": "故事",
    "zero": "零",
    "dance": "舞蹈",
    "dancing": "跳舞、舞蹈",
    "bar": "酒吧、橫桿",
    "bed": "床",
    "ok": "可以、好的",
    "rich in ...": "濃厚、富含…",
    "cruel": "殘酷、過分",
    "heartless": "殘酷、無情",
    "block": "區塊、積木",
    "or": "或者",
    "clear": "清楚、通關",
    "transparent": "透明",
    "project": "專案、計畫",
    "robot": "機器人",
    "that sort of": "那樣的",
    "that kind of": "那樣的",
    "various": "各式各樣",
    "a variety of": "各式各樣",
    "as if": "好像、彷彿",
    "as though": "好像、彷彿",
    "internet": "網際網路",
    "tie": "領帶、平手",
    "dam": "水壩",
    "video": "影片、錄影",
    "mistake": "錯誤、失誤",
    "error": "錯誤",
    "he": "那傢伙、他",
    "she": "那傢伙、她",
    "recommendation": "推薦、建議",
    "advice": "建議",
    "question": "問題、詢問",
    "query": "問題、查詢",
    "to do something in readiness for": "先做好、預先做",
    "hey": "喂、嘿",
    "yo": "喂、嘿",
    "inn": "旅館",
    "hotel": "飯店、旅館",
    "kiss": "親吻",
    "timing": "時機、時間點",
    "tweet": "推文",
    "twitter post": "推文",
    "digital": "數位",
    "date": "約會、日期",
    "ticket": "票、門票",
    "pool": "游泳池",
    "pooling": "共同出資、集中資源",
    "park": "公園",
    "office worker": "上班族、公司職員",
    "credit card": "信用卡",
    "seminar": "研討會、講座",
    "festival": "祭典、活動",
    "basketball": "籃球",
    "volleyball": "排球",
    "sandwich": "三明治",
    "cookie": "餅乾",
    "sauce": "醬汁",
    "glass": "玻璃、杯子",
    "paper": "紙、論文",
    "diamond": "鑽石",
    "report": "報告",
    "update": "更新",
    "communication": "溝通、通訊",
    "technology": "技術、科技",
    "mechanism": "機制、結構",
    "location": "地點、位置",
    "graphics": "圖像、圖形",
    "plastic": "塑膠",
    "helicopter": "直升機",
    "contact": "聯絡、接觸",
    "flag": "旗幟、標記",
    "amateur": "業餘、初學者",
    "forum": "論壇",
    "positive": "正面、積極",
    "assistant": "助手、助理",
    "company": "公司",
    "motivation": "動機、幹勁",
    "scarf": "圍巾",
}

KEYWORD_ZH = [
    ("swimming", "游泳"),
    ("pool", "游泳池"),
    ("ticket", "票、門票"),
    ("card", "卡片、卡"),
    ("game", "遊戲"),
    ("anime", "動畫"),
    ("site", "網站"),
    ("account", "帳號"),
    ("program", "程式、節目"),
    ("project", "專案"),
    ("engine", "引擎"),
    ("debut", "首次亮相、出道"),
    ("robot", "機器人"),
    ("internet", "網際網路"),
    ("business", "商業、工作"),
    ("shirt", "襯衫"),
    ("bed", "床"),
    ("dance", "舞蹈"),
    ("zero", "零"),
    ("color", "顏色"),
    ("list", "清單"),
    ("file", "檔案"),
    ("radio", "收音機、廣播"),
    ("rule", "規則"),
    ("story", "故事"),
    ("energy", "能量"),
    ("key", "鑰匙、關鍵"),
    ("character", "角色"),
    ("album", "相簿、專輯"),
    ("illustration", "插畫"),
    ("video", "影片"),
    ("date", "約會、日期"),
    ("kiss", "親吻"),
    ("tweet", "推文"),
    ("timing", "時機"),
    ("hotel", "飯店、旅館"),
    ("park", "公園"),
    ("shop", "商店"),
    ("leader", "領導者"),
    ("manager", "經理、管理者"),
    ("office", "辦公室"),
    ("worker", "工作者"),
    ("happy", "開心、幸福"),
    ("bad", "不好、糟糕"),
    ("good", "好、良好"),
    ("hard", "困難、辛苦"),
    ("quickly", "快速地"),
    ("suddenly", "突然"),
    ("clearly", "清楚地"),
    ("really", "真的、非常"),
    ("possibly", "可能、也許"),
    ("probably", "大概、可能"),
    ("perhaps", "也許、可能"),
    ("rather", "反而、相當"),
    ("soon", "快要、差不多"),
    ("finally", "終於"),
    ("hello", "你好"),
    ("sorry", "對不起、抱歉"),
    ("thank you", "謝謝"),
]

FUNCTION_WORDS = {
    "かしら": ("助詞:是否、會不會(女性語氣或自問)", "明日は晴れるかしら。", "明天會不會放晴呢？"),
    "すら": ("助詞:甚至、連…也", "忙しくて昼ご飯すら食べられませんでした。", "忙到連午餐都沒吃。"),
    "そこで": ("接續詞:於是、因此", "雨が降りました。そこで、予定を変えました。", "下雨了，於是改了計畫。"),
    "そろそろ": ("副詞:差不多、快要", "そろそろ帰りましょう。", "差不多該回去了。"),
    "なるほど": ("感動詞:原來如此", "なるほど、そういう意味ですね。", "原來如此，是那個意思啊。"),
    "ものの": ("接續助詞:雖然…但是", "準備したものの、試合は中止になりました。", "雖然準備好了，但比賽取消了。"),
    "ごめんなさい": ("表現:對不起、抱歉", "遅れてごめんなさい。", "遲到了，對不起。"),
    "どんどん": ("副詞:不斷地、快速地", "日本語がどんどん上手になっています。", "日語正在不斷進步。"),
    "こんにちは": ("感動詞:你好、午安", "こんにちは、元気ですか。", "你好，你好嗎？"),
    "しばらく": ("副詞:一會兒、暫時", "しばらくここで待ちます。", "暫時在這裡等。"),
    "ただし": ("接續詞:但是、但有條件", "参加できます。ただし、予約が必要です。", "可以參加，但是需要預約。"),
    "どうして": ("副詞:為什麼、怎麼會", "どうして遅れたのですか。", "為什麼遲到了？"),
    "にくい": ("接尾詞:難以…、不容易…", "この説明は少し分かりにくいです。", "這個說明有點難懂。"),
    "まさに": ("副詞:正是、確實", "これはまさに私が探していた本です。", "這正是我在找的書。"),
    "まさか": ("副詞・感動詞:不會吧、怎麼可能", "まさか彼が来るとは思いませんでした。", "沒想到他竟然會來。"),
    "それで": ("接續詞:所以、因此", "電車が止まりました。それで、遅れました。", "電車停駛了，所以遲到了。"),
    "まずは": ("副詞:首先、先從…", "まずは水を飲んでください。", "首先請先喝水。"),
    "もしくは": ("接續詞:或者", "電話、もしくはメールで連絡してください。", "請用電話或電子郵件聯絡。"),
    "まるで": ("副詞:好像、彷彿", "まるで夢のようです。", "簡直像夢一樣。"),
    "おすすめ": ("名詞:推薦、建議", "この店は友達のおすすめです。", "這家店是朋友推薦的。"),
}

KATAKANA_EXAMPLES = {
    "プール": ("游泳池", "夏休みにプールへ行きました。", "暑假去了游泳池。"),
    "チケット": ("票、門票", "映画のチケットを買いました。", "買了電影票。"),
    "ゲーム": ("遊戲", "友達とゲームをしました。", "和朋友玩了遊戲。"),
    "アニメ": ("動畫", "日本のアニメが好きです。", "我喜歡日本動畫。"),
    "サイト": ("網站", "このサイトでニュースを読みます。", "在這個網站看新聞。"),
    "サイズ": ("尺寸、大小", "このシャツはサイズが合いません。", "這件襯衫尺寸不合。"),
    "スタイル": ("風格、樣式", "彼女の服のスタイルが好きです。", "我喜歡她的穿衣風格。"),
    "チケット": ("票、門票", "コンサートのチケットを予約しました。", "預約了演唱會門票。"),
    "アルバム": ("相簿、專輯", "旅行の写真をアルバムに入れました。", "把旅行照片放進相簿。"),
    "キャラクター": ("角色", "このキャラクターは子どもに人気です。", "這個角色很受孩子歡迎。"),
    "ファイル": ("檔案、文件夾", "大事なファイルを保存しました。", "儲存了重要檔案。"),
    "ラジオ": ("收音機、廣播", "朝、ラジオを聞きます。", "早上聽廣播。"),
    "ルール": ("規則", "ゲームのルールを確認しました。", "確認了遊戲規則。"),
    "アカウント": ("帳號", "新しいアカウントを作りました。", "建立了新帳號。"),
    "ビジネス": ("商業、工作", "ビジネスのメールを書きました。", "寫了商務郵件。"),
    "プログラム": ("程式、節目", "新しいプログラムを使っています。", "正在使用新的程式。"),
    "インターネット": ("網際網路", "インターネットで調べました。", "在網路上查了。"),
    "プロジェクト": ("專案", "新しいプロジェクトが始まりました。", "新的專案開始了。"),
    "ロボット": ("機器人", "工場でロボットが働いています。", "機器人在工廠工作。"),
}


def to_kana(text: str) -> str:
    return "".join(part["hira"] for part in KAKASI.convert(text))


def has_placeholder(text: str) -> bool:
    return any(marker in text for marker in PLACEHOLDER_MARKERS)


def clean_chinese_example(text: str) -> str:
    text = text.replace("這個詞。", "這個說法。")
    text = text.replace("這個詞」這個詞", "這個說法」")
    text = text.replace("這個詞", "說法")
    text = text.replace("這個動作", "這個動作")
    return text


def clean_gloss(gloss: str) -> str:
    gloss = re.sub(r"\([^)]*\)", "", gloss).strip()
    gloss = re.sub(r"\s+", " ", gloss)
    return gloss.strip(" ;,").lower()


def gloss_candidates(entry: dict) -> list[str]:
    out = []
    for gloss in entry.get("_quality", {}).get("gloss_en", [])[:8]:
        clean = clean_gloss(gloss)
        if clean:
            out.append(clean)
            out.extend(part.strip() for part in re.split(r";|,", clean) if part.strip())
    return list(dict.fromkeys(out))


def meaning_from_gloss(entry: dict) -> str | None:
    for gloss in gloss_candidates(entry):
        if gloss in EXACT_GLOSS_ZH:
            return EXACT_GLOSS_ZH[gloss]
        for needle, zh in KEYWORD_ZH:
            if needle in gloss:
                return zh
    return None


def cjk_base(word: str) -> str | None:
    if re.search(r"[\u4e00-\u9fff]", word):
        return OPENCC.convert(word)
    return None


def curated_entry(entry: dict) -> tuple[str, str, str, str]:
    word = entry["word"]
    pos_tokens = set(entry["part_of_speech"].split("・"))

    if word in FUNCTION_WORDS:
        meaning, jp, zh = FUNCTION_WORDS[word]
        return meaning, jp, zh, "curated"
    if word in KATAKANA_EXAMPLES:
        meaning, jp, zh = KATAKANA_EXAMPLES[word]
        return meaning, jp, zh, "curated"

    meaning = meaning_from_gloss(entry) or cjk_base(word)
    if not meaning:
        if "副詞" in pos_tokens:
            meaning = f"副詞:{word}"
        elif "助詞" in pos_tokens or "助動詞" in pos_tokens or "接続詞" in pos_tokens:
            meaning = f"文法形式:{word}"
        elif "感動詞" in pos_tokens:
            meaning = f"感嘆表現:{word}"
        elif "動詞" in pos_tokens:
            meaning = f"動詞:{word}"
        elif "形容詞" in pos_tokens or "形容動詞" in pos_tokens:
            meaning = f"形容表現:{word}"
        else:
            meaning = word

    if "副詞" in pos_tokens:
        jp = f"会話で「{word}」を使うことがあります。"
        zh = f"會話中有時會使用「{meaning}」。"
    elif "助詞" in pos_tokens or "助動詞" in pos_tokens or "接続詞" in pos_tokens:
        jp = f"短い文で「{word}」の働きを確認しました。"
        zh = f"用短句確認了「{meaning}」的作用。"
    elif "感動詞" in pos_tokens:
        jp = f"友達は「{word}」と言いました。"
        zh = f"朋友說了「{meaning}」。"
    elif "動詞" in pos_tokens:
        jp = f"必要な時に{word}ことがあります。"
        zh = f"有時會做「{meaning}」這個動作。"
    elif "形容詞" in pos_tokens or "形容動詞" in pos_tokens:
        jp = f"会話で「{word}」という表現を聞きました。"
        zh = f"在會話中聽到了「{meaning}」這個表現。"
    elif re.search(r"[\u30a0-\u30ff]", word):
        jp = f"日常生活で{word}を使うことがあります。"
        zh = f"日常生活中有時會使用「{meaning}」。"
    else:
        jp = f"日常会話で「{word}」という言葉を聞くことがあります。"
        zh = f"日常會話中有時會聽到「{meaning}」這個說法。"

    return meaning, jp, zh, "needs_review"


def main() -> None:
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    cleaned = 0
    curated = 0
    for entry in vocab:
        if not has_placeholder(entry.get("meaning", "")):
            continue
        meaning, jp, zh, quality_score = curated_entry(entry)
        entry["meaning"] = meaning
        entry["example"] = {
            "japanese": jp,
            "reading": to_kana(jp),
            "chinese": zh,
        }
        entry["quality_score"] = quality_score
        entry["source"]["example"] = quality_score
        q = entry.setdefault("_quality", {})
        q["quality_score"] = quality_score
        q["meaning_source"] = "placeholder cleanup"
        q["example_source"] = "placeholder cleanup"
        cleaned += 1
        if quality_score == "curated":
            curated += 1

    by_id = {entry["id"]: entry for entry in vocab}
    related_cleaned = 0
    chinese_cleaned = 0
    for entry in vocab:
        chinese = entry.get("example", {}).get("chinese", "")
        cleaned_chinese = clean_chinese_example(chinese)
        if cleaned_chinese != chinese:
            entry["example"]["chinese"] = cleaned_chinese
            chinese_cleaned += 1
        for related in entry.get("related", []):
            target = by_id.get(related.get("target_id"))
            if not target:
                continue
            new_meaning = target["meaning"].split("、")[0]
            if related.get("meaning") != new_meaning:
                related["meaning"] = new_meaning
                related_cleaned += 1

    VOCAB_PATH.write_text(json.dumps(vocab, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Cleaned {cleaned} placeholder entries ({curated} curated, {cleaned - curated} needs_review).")
    print(f"Cleaned {related_cleaned} related meanings and {chinese_cleaned} Chinese examples.")


if __name__ == "__main__":
    main()

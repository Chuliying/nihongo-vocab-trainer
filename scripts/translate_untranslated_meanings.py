#!/usr/bin/env python3
"""Translate untranslated meaning fields from JMdict English glosses.

This fixes entries where the "Chinese" meaning is still just the Japanese
headword/reading, e.g. 実に -> 実に or チケット -> チケット.  The source of truth
remains JMdict; the translator only converts the stored English gloss hints to
Traditional Chinese.
"""
from __future__ import annotations

import json
import re
import os
import time
from pathlib import Path

from opencc import OpenCC

try:
    from deep_translator import GoogleTranslator
except ImportError as exc:  # pragma: no cover - convenience for local runs
    raise SystemExit("Install deep-translator first: python3 -m pip install deep-translator") from exc


VOCAB_PATH = Path("public/data/vocab_13000.json")
POPULAR_VERBS_PATH = Path("public/data/popular_verbs_300.json")
CACHE_PATH = Path("public/data/enrichment/meaning_zh_cache.json")
OPENCC = OpenCC("s2t")

TRANSLATOR = GoogleTranslator(source="en", target="zh-TW")
USE_GOOGLE = os.environ.get("USE_GOOGLE_TRANSLATE") == "1"

EXACT_WORD_MEANINGS = {
    "人": "人、某類人",
    "年": "年、年齡",
    "月": "月亮、月份",
    "中": "裡面、中間、之中",
    "日本": "日本",
    "自分": "自己、自身",
    "前": "前面、以前、前一個",
    "時間": "時間、小時",
    "目": "眼睛、目光、順序",
    "分": "部分、份量、程度",
    "円": "日圓、圓形",
    "後": "後面、之後",
    "二": "二、兩個",
    "三": "三、三個",
    "十": "十、十個",
    "七": "七、七個",
    "百": "百、一百",
    "千": "千、一千",
    "万": "萬、一萬",
    "好き": "喜歡、喜好",
    "良い": "好、良好",
    "上": "上方、上面",
    "必要": "必要、需要",
    "同じ": "相同、一樣",
    "問題": "問題、題目",
    "手": "手、方法",
    "場合": "情況、場合",
    "子": "孩子、小孩",
    "男": "男人、男性",
    "女": "女人、女性",
    "女性": "女性、女人",
    "男性": "男性、男人",
    "東京": "東京",
    "大阪": "大阪",
    "山形": "山形縣、山形市；山形形狀",
    "実に": "實在、非常、確實",
    "実際": "實際、事實",
    "一緒": "一起、一同",
    "多く": "許多、大量",
    "使用": "使用、運用",
    "お願い": "請求、拜託",
    "最近": "最近、近來",
    "少し": "一點、少量",
    "時代": "時代、年代",
    "子供": "孩子、小孩",
    "名前": "名字、姓名",
    "無料": "免費",
    "最後": "最後、結尾",
    "方法": "方法、方式",
    "理由": "理由、原因",
    "相手": "對方、對手",
    "企業": "企業、公司",
    "利用": "利用、使用",
    "存在": "存在",
    "現在": "現在、目前",
    "以外": "以外、除了…之外",
    "水": "水",
    "事件": "事件、案件",
    "普通": "普通、一般",
    "発売": "發售、上市",
    "簡単": "簡單、容易",
    "絶対": "絕對、一定",
    "確認": "確認、查證",
    "開催": "舉辦、召開",
    "今回": "這次、本次",
    "全部": "全部、全體",
    "個人": "個人",
    "外": "外面、外部",
    "早く": "早點、快點",
    "結婚": "結婚",
    "生活": "生活",
    "人気": "人氣、受歡迎",
    "公開": "公開、開放",
    "理解": "理解、了解",
    "全て": "全部、所有",
    "対応": "應對、對應",
    "放送": "播出、廣播",
    "活動": "活動、行動",
    "登場": "登場、出現",
    "販売": "販售、銷售",
    "大変": "非常、辛苦、嚴重",
    "完全": "完全、完整",
    "技術": "技術、科技",
    "説明": "說明、解釋",
    "発表": "發表、公布",
    "攻撃": "攻擊",
    "自身": "自身、自己",
    "部分": "部分",
    "電話": "電話、通話",
    "予定": "預定、計畫",
    "全員": "全員、所有人",
    "口": "嘴巴、入口",
    "登録": "登錄、註冊",
    "確か": "確實、大概",
    "紹介": "介紹",
    "花": "花",
    "機能": "功能",
    "設定": "設定",
    "調査": "調查",
    "重要": "重要",
    "人生": "人生",
    "目的": "目的、目標",
    "自由": "自由",
    "記事": "文章、報導",
    "開始": "開始",
    "開発": "開發",
    "テレビ": "電視、電視節目",
    "ネット": "網路、網際網路",
    "イベント": "活動、事件",
    "システム": "系統、制度",
    "チーム": "隊伍、團隊",
    "アプリ": "應用程式",
    "データ": "資料、數據",
    "メール": "電子郵件、訊息",
    "リンク": "連結",
    "ブログ": "部落格",
    "ポイント": "重點、點數",
    "タイプ": "類型、種類",
    "カード": "卡片、卡",
    "シリーズ": "系列",
    "ライブ": "現場演出、直播",
    "まとめ": "整理、摘要",
    "イメージ": "印象、形象",
    "レベル": "等級、水準",
    "デザイン": "設計",
}

GLOSS_FIXES = {
    "Yamagata": "山形",
    "city": "市",
    "prefecture": "縣",
    "really": "真的、確實",
    "truly": "真正地、確實",
    "very": "非常、很",
    "extremely": "極其、非常",
    "exceedingly": "非常、極度",
    "year": "年",
    "age": "年齡",
    "moon": "月亮",
    "month": "月份",
    "inside": "裡面",
    "interior": "內部",
    "among": "之中",
    "within": "範圍內",
    "Japan": "日本",
    "Tokyo": "東京",
    "Osaka": "大阪",
    "person": "人",
    "woman": "女人、女性",
    "man": "男人、男性",
    "child": "孩子、小孩",
    "good": "好、良好",
    "necessary": "必要、需要",
    "same": "相同、一樣",
    "question": "問題、題目",
    "problem": "問題",
    "hand": "手",
    "time": "時間",
    "hour": "小時",
    "part": "部分",
    "portion": "部分、份量",
    "share": "份額",
    "yen": "日圓",
    "circle": "圓形",
    "behind": "後面",
    "after": "之後",
    "case": "情況、案例",
    "situation": "情況、狀況",
    "method": "方法",
    "way": "方式、方法",
    "reason": "理由、原因",
    "company": "公司",
    "use": "使用、利用",
    "existence": "存在",
    "present": "現在、目前",
    "except": "除了…之外",
    "water": "水",
    "event": "事件、活動",
    "normal": "普通、一般",
    "sale": "販售、銷售",
    "simple": "簡單",
    "easy": "容易",
    "absolutely": "絕對地",
    "confirmation": "確認",
    "holding": "舉辦、召開",
    "all": "全部",
    "individual": "個人",
    "outside": "外面、外部",
    "early": "早、提早",
    "marriage": "結婚、婚姻",
    "life": "生活、人生",
    "popularity": "人氣、受歡迎",
    "public": "公開、公眾",
    "understanding": "理解",
    "activity": "活動",
    "appearance": "出現、外觀",
    "technology": "技術、科技",
    "explanation": "說明、解釋",
    "announcement": "發表、公告",
    "attack": "攻擊",
    "self": "自己、自身",
    "phone": "電話",
    "plan": "計畫、預定",
    "flower": "花",
    "function": "功能",
    "setting": "設定",
    "investigation": "調查",
    "important": "重要",
    "purpose": "目的",
    "freedom": "自由",
    "article": "文章、報導",
    "start": "開始",
    "development": "開發、發展",
    "end": "結束、結尾",
    "change": "變更、變化",
    "return": "返回、歸還",
    "you": "你、對方",
    "establishment": "設立、建立",
    "model": "模型、模特兒、模式",
    "trouble": "麻煩、問題",
    "order": "順序、命令",
    "reply": "回覆、回答",
    "call": "呼叫、通話、拜訪",
    "head": "頭、首位、負責人",
    "control": "控制、管理",
    "agreement": "同意、協議",
    "notice": "通知、注意",
    "defense": "防衛、防守",
    "fall": "下降、跌落",
    "application": "申請、應用",
    "opening": "開幕、開放、開始",
    "selection": "選擇、選拔",
    "departure": "出發、離開",
    "addition": "追加、增加",
    "duty": "責任、義務",
    "damage": "損害、傷害",
    "operation": "操作、運轉",
    "protection": "保護",
    "preparation": "準備",
    "treatment": "治療、處理",
    "composition": "構成、組成",
    "we": "我們",
    "promotion": "促進、宣傳、升遷",
    "doubt": "疑問、懷疑",
    "combination": "組合、結合",
    "master": "主人、高手、師傅",
    "consideration": "考慮、體貼",
    "transfer": "轉移、轉讓、調動",
    "last": "最後、上一個",
    "woman": "女人、女性",
    "man": "男人、男性",
    "beginning": "開始、開頭",
    "container": "容器、收納物",
    "nonexistent": "不存在、沒有",
    "companion": "同伴、對象",
    "reality": "實際、現實",
    "outside": "外面、外部",
    "what kind of": "什麼樣的",
    "such": "那樣的、這類的",
    "seven": "七、七個",
    "system": "系統、制度",
    "introduction": "介紹、導入",
    "area": "地區、範圍",
    "series": "系列",
    "big": "大的、巨大",
    "difference": "差異、不同",
    "action": "行動、動作",
    "really": "真的、確實",
    "accident": "事故、意外",
    "near": "附近、接近",
    "contract": "契約、合約",
    "interest": "興趣、關心",
    "lively": "有精神、活潑",
    "target": "對象、目標",
    "trial": "試驗、嘗試",
    "report": "報告、通報",
    "they": "他們",
    "flow": "流動、流程",
    "indication": "表示、指示",
    "mistake": "錯誤、失誤",
    "letter": "文字、信件",
    "most": "最多、最",
    "tree": "樹、樹木",
    "making": "製作、形成",
    "drink": "飲品、飲用",
    "rate": "比例、費率",
    "happiness": "幸福、快樂",
    "contribution": "投稿、貢獻",
    "set": "一組、套裝、設定",
    "memory": "記憶",
    "rise": "上升、提高",
    "gun": "槍、砲",
    "reaction": "反應",
    "material": "材料、素材",
    "earth": "地球、土地",
    "top": "頂端、第一",
    "reading": "閱讀、讀法",
    "battle": "戰鬥、比賽",
    "lovely": "可愛、迷人",
    "completion": "完成",
    "direction": "方向、指導",
    "magic": "魔法、魔術",
    "opposition": "反對、對立",
    "line": "線、隊伍",
    "publication": "刊登、出版",
    "class": "班級、等級",
    "play": "遊玩、演奏、比賽",
    "taking": "取得、拿取",
    "continuation": "延續、繼續",
    "course": "課程、路線",
    "small": "小的、細小",
    "guidance": "指導、引導",
    "peace": "和平",
    "proposal": "提案、建議",
    "inspection": "檢查、檢驗",
    "back": "背後、後方",
    "rule": "規則、支配",
    "restoration": "恢復、修復",
    "rest": "休息、剩餘",
    "base": "基礎、基地",
    "death": "死亡",
    "lesson": "課程、教訓",
    "look": "一看、外觀",
    "expansion": "擴大、擴張",
    "connection": "連接、關聯",
    "neighbourhood": "附近、鄰近地區",
    "neighborhood": "附近、鄰近地區",
    "field": "領域、場地",
    "construction": "建設、建築",
    "residence": "住宅、居住",
    "outward appearance": "外觀、外表",
    "baby": "嬰兒",
    "weather": "天氣",
    "foundation": "基礎、基金會",
    "declaration": "宣言、聲明",
    "form": "形式、形狀",
    "favorite": "喜愛、最愛",
    "ring": "戒指、環",
    "writing": "書寫、文章",
    "private": "私人、民間",
    "route": "路線、途徑",
    "collection": "收集、收藏",
    "will": "意志、幹勁",
    "creation": "創作、創造",
    "visit": "拜訪、造訪",
    "tool": "工具",
    "injury": "受傷、傷害",
    "light": "輕、光",
    "association": "交往、聯想、組織",
    "payment": "支付、付款",
    "pressure": "壓力",
    "to raise": "提高、養育、引起",
    "process": "過程、程序",
    "respect": "尊重、敬意",
    "naming": "命名、指名",
    "director": "董事、負責人",
    "pure": "純粹、純正",
    "running": "跑步、運行",
    "youth": "青春、青年",
    "obstruction": "妨礙、阻礙",
    "source": "來源、出處",
    "moving": "搬家、移動",
    "threat": "威脅",
    "progress": "進展、進步",
    "supplement": "補充",
    "plain": "樸素、平原",
    "face": "臉、面子",
    "to spread": "擴散、傳開",
    "abuse": "虐待、濫用",
    "captain": "隊長、船長",
    "trade": "交易、貿易",
    "stop": "停止",
    "grandfather": "祖父",
    "close": "接近、親密",
    "removal": "移除、撤除",
    "taste": "味道、品味",
    "quick": "快速",
    "colouring": "著色、色彩",
    "coloring": "著色、色彩",
    "punishment": "處罰、懲罰",
    "substitution": "替代、置換",
}


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def clean_gloss(gloss: str) -> str:
    gloss = re.sub(r"\([^)]*\)", "", gloss)
    gloss = re.sub(r"\s+", " ", gloss)
    return gloss.strip(" ;,")


def gloss_text(entry: dict) -> str:
    glosses = [clean_gloss(g) for g in entry.get("_quality", {}).get("gloss_en", [])[:5]]
    glosses = [g for g in glosses if g]
    return "; ".join(dict.fromkeys(glosses))


def is_untranslated(entry: dict) -> bool:
    meaning = entry.get("meaning", "")
    return (
        meaning in {entry.get("word"), entry.get("reading")}
        or bool(re.fullmatch(r"[ぁ-ゟ゠-ヿー・]+", meaning))
    )


def has_duplicate_meaning_parts(entry: dict) -> bool:
    parts = [part for part in entry.get("meaning", "").split("、") if part]
    return len(parts) != len(set(parts))


def should_repair(entry: dict) -> bool:
    return (
        is_untranslated(entry)
        or entry["word"] in EXACT_WORD_MEANINGS
        or has_duplicate_meaning_parts(entry)
    )


def fallback_from_gloss(text: str) -> str | None:
    parts = []
    lower = text.lower()
    for en, zh in GLOSS_FIXES.items():
        if en.lower() in lower and zh not in parts:
            parts.append(zh)
        if len(parts) >= 3:
            break
    if parts:
        return "、".join(parts)
    return None


def normalize_zh(text: str) -> str:
    text = OPENCC.convert(text)
    text = text.replace("；", "、").replace(";", "、")
    text = text.replace("，", "、").replace(",", "、")
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"、{2,}", "、", text).strip("、。；; ")
    text = text.replace("（例如測試）", "")
    text = text.replace("（例如：測試）", "")
    parts = [part for part in text.split("、") if part]
    text = "、".join(dict.fromkeys(parts))
    return text


def translate_gloss(text: str, cache: dict[str, str]) -> str | None:
    if not text:
        return None
    rule_based = fallback_from_gloss(text)
    if rule_based:
        cache.setdefault(text, rule_based)
        return rule_based
    if text in cache:
        return normalize_zh(cache[text])
    if not USE_GOOGLE:
        return None
    try:
        translated = TRANSLATOR.translate(text)
        translated = normalize_zh(translated)
    except Exception:
        translated = ""
    if not translated or re.search(r"[A-Za-z]", translated):
        translated = fallback_from_gloss(text) or translated
    if translated:
        cache[text] = translated
        if len(cache) % 100 == 0:
            save_json(CACHE_PATH, cache)
        time.sleep(0.04)
        return translated
    return None


def fallback_meaning(entry: dict) -> str:
    pos = entry.get("part_of_speech", "")
    if "動詞" in pos:
        return "動作、行為"
    if "副詞" in pos:
        return "副詞用法"
    if "形容詞" in pos or "形容動詞" in pos:
        return "性質、狀態"
    if "助詞" in pos or "助動詞" in pos or "接続詞" in pos:
        return "文法功能"
    if "感動詞" in pos:
        return "感嘆、應答"
    return "名詞概念"


def sync_related(vocab: list[dict]) -> int:
    by_id = {entry["id"]: entry for entry in vocab}
    changed = 0
    for entry in vocab:
        for related in entry.get("related", []):
            target = by_id.get(related.get("target_id"))
            if not target:
                continue
            new_meaning = target.get("meaning", "").split("、")[0]
            if new_meaning and related.get("meaning") != new_meaning:
                related["meaning"] = new_meaning
                changed += 1
    return changed


def sync_popular_verbs(vocab: list[dict]) -> int:
    if not POPULAR_VERBS_PATH.exists():
        return 0
    by_id = {entry["id"]: entry for entry in vocab}
    verbs = load_json(POPULAR_VERBS_PATH, [])
    changed = 0
    for item in verbs:
        entry = by_id.get(item.get("id"))
        if not entry:
            continue
        if item.get("meaning") != entry.get("meaning"):
            item["meaning"] = entry.get("meaning")
            changed += 1
    if changed:
        save_json(POPULAR_VERBS_PATH, verbs)
    return changed


def main() -> None:
    vocab = load_json(VOCAB_PATH, [])
    cache = load_json(CACHE_PATH, {})
    changed = 0
    fallback = 0
    for entry in vocab:
        if not should_repair(entry):
            continue
        old = entry["meaning"]
        gloss = gloss_text(entry)
        meaning = EXACT_WORD_MEANINGS.get(entry["word"])
        if not meaning:
            meaning = translate_gloss(gloss, cache)
        if not meaning or meaning in {entry["word"], entry["reading"]} or re.search(r"[A-Za-z]", meaning):
            meaning = fallback_meaning(entry)
            fallback += 1
        entry["meaning"] = normalize_zh(meaning)
        if entry["quality_score"] == "rule_completed":
            entry["quality_score"] = "meaning_translated"
        q = entry.setdefault("_quality", {})
        q["meaning_source"] = "jmdict gloss zh translation"
        q["meaning_previous"] = old
        changed += 1

    related_changed = sync_related(vocab)
    popular_changed = sync_popular_verbs(vocab)
    save_json(VOCAB_PATH, vocab)
    save_json(CACHE_PATH, cache)
    print(f"Translated {changed} untranslated meanings; fallback={fallback}.")
    print(f"Synced {related_changed} related meanings and {popular_changed} popular verb meanings.")


if __name__ == "__main__":
    main()

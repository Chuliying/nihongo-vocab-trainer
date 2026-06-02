#!/usr/bin/env python3
"""Hand-curated Traditional-Chinese meanings + grammar/usage example sentences
for Tranche 1 grammar words and high-frequency words.

Mirrors scripts/refine_popular_verbs.py: a word-keyed table of
(meaning, japanese_example, chinese_example). Readings for the example are
generated with pykakasi. Curated entries are marked quality_score="curated".

Existing verb_curated entries (the popular-verb set) are left untouched.
Run again any time after adding more words; it is idempotent.
"""
import json
import re
from pathlib import Path

import pykakasi


VOCAB_PATH = Path("public/data/vocab_13000.json")
KAKASI = pykakasi.kakasi()


def example_has_headword(word: str, sentence: str) -> bool:
    """Mirror validate_vocab.example_contains_word: accept the exact word or,
    for kanji words, its leading kanji stem (conjugation preserves it)."""
    if word in sentence:
        return True
    stem = re.match(r"^[一-鿿々]+", word)
    return bool(stem) and stem.group(0) in sentence

# word -> (meaning_zh_Hant, example_japanese, example_chinese)
CURATED: dict[str, tuple[str, str, str]] = {
    # ── 助詞・助動詞・文法詞 (function words) ──
    "に": ("助詞:表時間、地點或對象(在、向、給)", "毎朝七時に起きます。", "每天早上七點起床。"),
    "は": ("助詞:標示句子的主題(…是…)", "私は台湾人です。", "我是台灣人。"),
    "が": ("助詞:標示主語", "雨が降っています。", "正在下雨。"),
    "を": ("助詞:標示動作的受詞(把…)", "毎日日本語を勉強します。", "每天學習日語。"),
    "で": ("助詞:表地點或手段(在、用、搭)", "バスで会社へ行きます。", "搭公車去公司。"),
    "と": ("助詞:和、與;引用「…と言う」", "友達と映画を見ます。", "和朋友看電影。"),
    "も": ("助詞:也、都", "私も行きます。", "我也要去。"),
    "か": ("助詞:表疑問(嗎、呢)", "これは何ですか。", "這是什麼?"),
    "ない": ("否定:不、沒有(動詞・形容詞的否定形)", "今日は時間がない。", "今天沒有時間。"),
    "です": ("助動詞:是(禮貌的斷定)", "彼は先生です。", "他是老師。"),
    "ます": ("助動詞:接在動詞後表示禮貌", "毎日運動します。", "每天運動。"),
    "こと": ("名詞:事情;將動詞名詞化(…的事)", "好きなことを続けます。", "持續做喜歡的事。"),
    "てる": ("「…ている」的口語縮約:正在…、…著", "今、何してるの。", "你現在在做什麼?"),
    "いい": ("形容詞:好的、良好的", "今日はいい天気です。", "今天是好天氣。"),
    "この": ("連體詞:這個(後接名詞)", "この本はとても面白い。", "這本書非常有趣。"),
    "その": ("連體詞:那個(後接名詞)", "その話は本当ですか。", "那件事是真的嗎?"),
    "あの": ("連體詞:那個(較遠,後接名詞)", "あの店はおいしい。", "那家店很好吃。"),
    "そう": ("那樣;聽說、好像(傳聞・樣態)", "明日は雨だそうです。", "聽說明天會下雨。"),
    "って": ("助詞(口語):叫做…;聽說…", "田中さんって優しい人です。", "田中先生是個溫柔的人。"),
    "たら": ("助詞:如果…的話(假定)", "駅に着いたら電話します。", "到了車站就打電話。"),
    "けど": ("接續助詞:雖然…但是", "高いけど、これを買います。", "雖然貴,但我要買這個。"),
    "から": ("助詞:從…(起點);因為…", "九時から授業が始まる。", "從九點開始上課。"),
    "まで": ("助詞:到…為止", "駅まで歩きます。", "走路到車站。"),
    "より": ("助詞:比…(比較)", "今日は昨日より暑い。", "今天比昨天熱。"),
    "これ": ("代名詞:這、這個(東西)", "これは私のかばんです。", "這是我的包包。"),
    "それ": ("代名詞:那、那個(東西)", "それを取ってください。", "請把那個拿給我。"),
    "よう": ("樣子;好像;打算(意向)", "雨が降るようです。", "好像要下雨了。"),
    "じゃ": ("「では」的口語:那麼;不是…", "じゃ、また明日ね。", "那麼,明天見囉。"),
    "ながら": ("助詞:一邊…一邊…", "音楽を聞きながら勉強する。", "一邊聽音樂一邊讀書。"),
    "でも": ("可是、不過;就連…也", "疲れた。でも、頑張る。", "雖然累,可是我會努力。"),

    # ── 高頻動詞 (common verbs, T1 rank ~60-90 block) ──
    "洗う": ("洗、清洗", "毎晩、お皿を洗う。", "每天晚上洗碗。"),
    "着る": ("穿(上半身衣物)", "寒いのでコートを着る。", "因為冷所以穿大衣。"),
    "借りる": ("借入、租借", "図書館で本を借りる。", "在圖書館借書。"),
    "貸す": ("借出、出借", "友達にペンを貸す。", "把筆借給朋友。"),
    "返す": ("歸還", "借りた本を返す。", "歸還借來的書。"),
    "教える": ("教;告訴", "学生に日本語を教える。", "教學生日語。"),
    "習う": ("學習(向人學)", "学校で日本語を習う。", "在學校學日語。"),
    "覚える": ("記住、學會", "新しい単語を覚える。", "記住新的單字。"),
    "忘れる": ("忘記", "すぐに人の名前を忘れる。", "很快就忘記別人的名字。"),
    "探す": ("尋找", "なくした鍵を探す。", "找遺失的鑰匙。"),
    "見つける": ("找到、發現", "いい店を見つける。", "找到一家不錯的店。"),
    "始める": ("開始(及物)", "毎日運動を始める。", "開始每天運動。"),
    "終わる": ("結束、完成", "もうすぐ授業が終わる。", "課程快結束了。"),
    "続ける": ("持續、繼續", "毎日勉強を続ける。", "每天持續學習。"),
    "止める": ("停止;戒掉", "ここに車を止める。", "把車停在這裡。"),
    "直す": ("修理;改正", "間違いを直す。", "改正錯誤。"),
    "払う": ("支付", "コンビニで料金を払う。", "在便利商店付費。"),
    "送る": ("寄送;送行", "友達にメールを送る。", "寄電子郵件給朋友。"),
    "受ける": ("接受;受到;應考", "来週、試験を受ける。", "下週要參加考試。"),
    "住む": ("居住", "東京に住んでいます。", "我住在東京。"),
    "決める": ("決定", "旅行の日を決める。", "決定旅行的日子。"),
    "選ぶ": ("選擇", "好きな色を選ぶ。", "選擇喜歡的顏色。"),
    "持つ": ("拿、持有", "かばんを持つ。", "拿著包包。"),

    # ── 高頻形容詞 (common adjectives) ──
    "悪い": ("壞的、不好的", "今日は天気が悪い。", "今天天氣不好。"),
    "大きい": ("大的", "大きい荷物を持つ。", "拿著很大的行李。"),
    "小さい": ("小的", "小さい声で話す。", "用小聲說話。"),
    "新しい": ("新的", "新しい靴を買った。", "買了新鞋。"),
    "古い": ("舊的、古老的", "この建物は古い。", "這棟建築很舊。"),
    "高い": ("高的;貴的", "この店は値段が高い。", "這家店價格很貴。"),
    "安い": ("便宜的", "この店は安いです。", "這家店很便宜。"),
    "多い": ("(數量)多的", "週末は人が多い。", "週末人很多。"),
    "少ない": ("(數量)少的", "今月は仕事が少ない。", "這個月工作很少。"),
}


def to_kana(text: str) -> str:
    return "".join(part["hira"] for part in KAKASI.convert(text))


def main() -> None:
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))

    # First entry per word within Tranche 1
    t1_by_word: dict[str, dict] = {}
    for entry in vocab:
        if entry["tranche_id"] == 1 and entry["word"] not in t1_by_word:
            t1_by_word[entry["word"]] = entry

    # Sanity: every example must contain its headword's dictionary form,
    # matching scripts/validate_vocab.py's rule.
    bad = [w for w, (_, jp, _) in CURATED.items() if not example_has_headword(w, jp)]
    if bad:
        raise SystemExit(f"example does not contain headword: {', '.join(bad)}")

    applied = 0
    not_found = []
    for word, (meaning, jp, zh) in CURATED.items():
        entry = t1_by_word.get(word)
        if entry is None:
            not_found.append(word)
            continue
        # This table is authoritative for the words it lists; always apply.
        entry["meaning"] = meaning
        entry["example"] = {
            "japanese": jp,
            "reading": to_kana(jp),
            "chinese": zh,
        }
        entry["quality_score"] = "curated"
        entry["source"]["example"] = "curated"
        q = entry.setdefault("_quality", {})
        q["quality_score"] = "curated"
        q["meaning_source"] = "hand curated (T1)"
        q["example_source"] = "hand curated (T1)"
        applied += 1

    VOCAB_PATH.write_text(
        json.dumps(vocab, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Curated {applied} Tranche-1 entries.")
    if not_found:
        print(f"Not found in Tranche 1 (skipped): {', '.join(not_found)}")


if __name__ == "__main__":
    main()

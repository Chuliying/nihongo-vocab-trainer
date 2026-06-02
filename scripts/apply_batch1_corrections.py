#!/usr/bin/env python3
"""Apply batch 1 corrections to T1 template sentences (entries 0-49)."""
import json, sys, copy

CORRECTIONS = {
    109: {
        "meaning": "因為、所以（表原因的助詞）",
        "example": {"japanese": "雨なので、傘を持っていきます。", "reading": "あめなので、かさをもっていきます。", "chinese": "因為下雨，所以帶了傘。"},
        "quality_score": "curated",
    },
    112: {
        "meaning": "（ます形語尾）請…（禮貌邀請語尾）",
        "example": {"japanese": "いらっしゃいませ。", "reading": "いらっしゃいませ。", "chinese": "歡迎光臨。"},
        "quality_score": "curated",
    },
    133: {
        "meaning": "…們（表複數的後綴）",
        "example": {"japanese": "私たちは日本語を勉強しています。", "reading": "わたしたちはにほんごをべんきょうしています。", "chinese": "我們正在學習日語。"},
        "quality_score": "curated",
    },
    150: {
        "meaning": "（です的連用形，用於でした・でしょう）",
        "example": {"japanese": "昨日は晴れでした。", "reading": "きのうははれでした。", "chinese": "昨天是晴天。"},
        "quality_score": "curated",
    },
    157: {
        "meaning": "（おる的連用形）在、存在（謙遜語）",
        "example": {"japanese": "現在担当者がおりません。", "reading": "げんざいたんとうしゃがおりません。", "chinese": "現在負責人不在。"},
        "quality_score": "curated",
    },
    171: {
        "meaning": "（しよう的口語縮略）…吧、試試看",
        "example": {"japanese": "どうしよ、財布を忘れた。", "reading": "どうしよ、さいふをわすれた。", "chinese": "怎麼辦，忘了帶錢包。"},
        "quality_score": "curated",
    },
    183: {
        "meaning": "情況、場合",
        "example": {"japanese": "緊急の場合は119番に電話してください。", "reading": "きんきゅうのばあいはひゃくじゅうきゅうばんにでんわしてください。", "chinese": "緊急情況請撥打119。"},
        "quality_score": "curated",
    },
    193: {
        "meaning": "太…了、過度（接在動詞或形容詞後）",
        "example": {"japanese": "昨日は食べすぎてしまいました。", "reading": "きのうはたべすぎてしまいました。", "chinese": "昨天吃太多了。"},
        "quality_score": "curated",
    },
    196: {
        "meaning": "去、前往",
        "example": {"japanese": "学校へいきます。", "reading": "がっこうへいきます。", "chinese": "去學校。"},
        "quality_score": "verb_curated",
    },
    197: {
        "meaning": "做、幹、進行",
        "example": {"japanese": "宿題をやりました。", "reading": "しゅくだいをやりました。", "chinese": "做完作業了。"},
        "quality_score": "verb_curated",
    },
    203: {
        "meaning": "（ましょう的口語縮略）…吧",
        "example": {"japanese": "早く行きましょ、遅刻するよ。", "reading": "はやくいきましょ、ちこくするよ。", "chinese": "快點走吧，要遲到了。"},
        "quality_score": "curated",
    },
    213: {
        "meaning": "（ございます的語幹）有、在（最敬語）",
        "example": {"japanese": "ありがとうございます。", "reading": "ありがとうございます。", "chinese": "非常感謝。"},
        "quality_score": "curated",
    },
    242: {
        "meaning": "帳單、賒賬、記帳",
        "example": {"japanese": "つけで払ってもいいですか。", "reading": "つけではらってもいいですか。", "chinese": "可以記帳嗎？"},
        "quality_score": "curated",
    },
    247: {
        "meaning": "不行、不可以（用於いけない等否定表現）",
        "example": {"japanese": "いけない、バスに乗り遅れた。", "reading": "いけない、バスにのりおくれた。", "chinese": "糟了，趕不上公車了。"},
        "quality_score": "curated",
    },
    248: {
        "meaning": "磨損、擦傷",
        "example": {"japanese": "転んで手にすれができた。", "reading": "ころんでてにすれができた。", "chinese": "跌倒後手上磨破了。"},
        "quality_score": "curated",
    },
    268: {
        "meaning": "賭注、賭博",
        "example": {"japanese": "かけに負けてお金を失った。", "reading": "かけにまけておかねをうしなった。", "chinese": "賭輸了，損失了錢。"},
        "quality_score": "curated",
    },
    269: {
        "meaning": "（てしまう的口語縮略）做完了、不小心做了",
        "example": {"japanese": "宿題を忘れちゃった。", "reading": "しゅくだいをわすれちゃった。", "chinese": "不小心忘了帶作業。"},
        "quality_score": "curated",
    },
    270: {
        "meaning": "理應、應該（表預期或推測）",
        "example": {"japanese": "彼女はもう来るはずです。", "reading": "かのじょはもうくるはずです。", "chinese": "她應該快要來了。"},
        "quality_score": "curated",
    },
    271: {
        "meaning": "好像…、聽說…（傳聞推測）；像樣的",
        "example": {"japanese": "明日は雨らしいです。", "reading": "あしたはあめらしいです。", "chinese": "聽說明天會下雨。"},
        "quality_score": "curated",
    },
    286: {
        "meaning": "對吧、是吧（表尋求認同的語氣助詞）",
        "example": {"japanese": "いい天気ですね。", "reading": "いいてんきですね。", "chinese": "天氣真好呢。"},
        "quality_score": "curated",
    },
    295: {
        "meaning": "哦（驚嘆詞，表驚訝或讚嘆）",
        "example": {"japanese": "ほう、それは知らなかった。", "reading": "ほう、それはしらなかった。", "chinese": "哦，這個我不知道。"},
        "quality_score": "curated",
    },
    304: {
        "meaning": "沒有、不可",
        "example": {"japanese": "砂糖なしのコーヒーをください。", "reading": "さとうなしのコーヒーをください。", "chinese": "請給我不加糖的咖啡。"},
        "quality_score": "curated",
    },
    311: {
        "meaning": "教導、教誨、教義",
        "example": {"japanese": "先生の教えを大切にしています。", "reading": "せんせいのおしえをたいせつにしています。", "chinese": "珍視老師的教導。"},
        "quality_score": "curated",
    },
    314: {
        "meaning": "圓圈；正確（○×題目的正確符號）",
        "example": {"japanese": "テストの答えに○をつけました。", "reading": "テストのこたえに○をつけました。", "chinese": "在考卷答案上畫了圓圈。"},
        "quality_score": "curated",
    },
    315: {
        "meaning": "不、不是（否定回答）",
        "example": {"japanese": "いいえ、違います。", "reading": "いいえ、ちがいます。", "chinese": "不，不對。"},
        "quality_score": "curated",
    },
    318: {
        "meaning": "第一次、初次",
        "example": {"japanese": "初めて日本に来ました。", "reading": "はじめてにほんにきました。", "chinese": "第一次來日本。"},
        "quality_score": "curated",
    },
    321: {
        "meaning": "…啦…啦（表列舉的助詞，帶感嘆語氣）",
        "example": {"japanese": "宿題やら料理やらで忙しい。", "reading": "しゅくだいやらりょうりやらでいそがしい。", "chinese": "忙著作業啦、煮飯啦之類的。"},
        "quality_score": "curated",
    },
    324: {
        "meaning": "什麼樣的、哪種",
        "example": {"japanese": "どんな音楽が好きですか。", "reading": "どんなおんがくがすきですか。", "chinese": "你喜歡什麼樣的音樂？"},
        "quality_score": "curated",
    },
    325: {
        "meaning": "在…（書面語場所助詞）",
        "example": {"japanese": "会議は東京にて行われます。", "reading": "かいぎはとうきょうにておこなわれます。", "chinese": "會議將在東京舉行。"},
        "quality_score": "curated",
    },
    326: {
        "meaning": "由於、因為、藉由（表原因或手段）",
        "example": {"japanese": "台風により電車が止まりました。", "reading": "たいふうによりでんしゃがとまりました。", "chinese": "由於颱風，電車停駛了。"},
        "quality_score": "curated",
    },
    328: {
        "meaning": "人氣、受歡迎",
        "example": {"japanese": "このお店はとても人気があります。", "reading": "このおみせはとてもにんきがあります。", "chinese": "這家店非常受歡迎。"},
        "quality_score": "curated",
    },
    332: {
        "meaning": "乞求、懇請（向他人請求）",
        "example": {"japanese": "許しをこいました。", "reading": "ゆるしをこいました。", "chinese": "懇求原諒。"},
        "quality_score": "verb_curated",
    },
    342: {
        "meaning": "活動、行動",
        "example": {"japanese": "ボランティア活動に参加しました。", "reading": "ボランティアかつどうにさんかしました。", "chinese": "參加了志工活動。"},
        "quality_score": "curated",
    },
    346: {
        "meaning": "正是…（表強調的助詞）",
        "example": {"japanese": "努力こそが成功の鍵です。", "reading": "どりょくこそがせいこうのかぎです。", "chinese": "努力正是成功的關鍵。"},
        "quality_score": "curated",
    },
    347: {
        "meaning": "當然、一定（表肯定語氣的助詞）",
        "example": {"japanese": "行くとも、もちろんです。", "reading": "いくとも、もちろんです。", "chinese": "當然去，理所當然。"},
        "quality_score": "curated",
    },
    355: {
        "meaning": "責任、過失、原因（帶負面含義）",
        "example": {"japanese": "風邪は雨に濡れたせいです。", "reading": "かぜはあめにぬれたせいです。", "chinese": "感冒是被雨淋到的緣故。"},
        "quality_score": "curated",
    },
    356: {
        "meaning": "那樣的、那種",
        "example": {"japanese": "そういう話は初めて聞きました。", "reading": "そういうはなしははじめてきました。", "chinese": "那樣的事我是第一次聽說。"},
        "quality_score": "curated",
    },
    359: {
        "meaning": "錢、金錢",
        "example": {"japanese": "お金を財布に入れました。", "reading": "おかねをさいふにいれました。", "chinese": "把錢放進了錢包。"},
        "quality_score": "curated",
    },
    361: {
        "meaning": "哪個（疑問指示連體詞）",
        "example": {"japanese": "どの本が読みたいですか。", "reading": "どのほんがよみたいですか。", "chinese": "你想讀哪本書？"},
        "quality_score": "curated",
    },
    372: {
        "meaning": "新聞報導、新聞",
        "example": {"japanese": "毎朝テレビでニュースを見ます。", "reading": "まいあさテレビでニュースをみます。", "chinese": "每天早上看電視新聞。"},
        "quality_score": "curated",
    },
    373: {
        "meaning": "認真的、不開玩笑（口語）",
        "example": {"japanese": "まじで？それは知らなかった。", "reading": "まじで？それはしらなかった。", "chinese": "真的嗎？我不知道這件事。"},
        "quality_score": "curated",
    },
    381: {
        "meaning": "介紹、引薦",
        "example": {"japanese": "友達を紹介してもらいました。", "reading": "ともだちをしょうかいしてもらいました。", "chinese": "請朋友幫我介紹了。"},
        "quality_score": "curated",
    },
    391: {
        "meaning": "必須…（なければならない的口語縮略）",
        "example": {"japanese": "早く寝なきゃ。", "reading": "はやくねなきゃ。", "chinese": "得快點睡覺了。"},
        "quality_score": "curated",
    },
    399: {
        "meaning": "開始、開端",
        "example": {"japanese": "試合の開始時間は午後三時です。", "reading": "しあいのかいしじかんはごごさんじです。", "chinese": "比賽開始時間是下午三點。"},
        "quality_score": "curated",
    },
    402: {
        "meaning": "對吧、是吧（ね的延長語氣）",
        "example": {"japanese": "いい天気だねー。", "reading": "いいてんきだねー。", "chinese": "天氣真好呢。"},
        "quality_score": "curated",
    },
    403: {
        "meaning": "不打算…、大概不會…（否定推量助動詞）",
        "example": {"japanese": "こんな失敗は二度とするまい。", "reading": "こんなしっぱいはにどとするまい。", "chinese": "絕對不會再犯這種錯了。"},
        "quality_score": "curated",
    },
    405: {
        "meaning": "影響",
        "example": {"japanese": "天気が体に影響を与えます。", "reading": "てんきがからだにえいきょうをあたえます。", "chinese": "天氣會影響身體。"},
        "quality_score": "curated",
    },
    407: {
        "meaning": "男性、男人",
        "example": {"japanese": "その男性は医者です。", "reading": "そのだんせいはいしゃです。", "chinese": "那位男性是醫生。"},
        "quality_score": "curated",
    },
    408: {
        "meaning": "房間",
        "example": {"japanese": "部屋を掃除しました。", "reading": "へやをそうじしました。", "chinese": "打掃了房間。"},
        "quality_score": "curated",
    },
    411: {
        "meaning": "喂！嘿！（呼叫他人的感動詞）",
        "example": {"japanese": "おい、ちょっと待ってくれ。", "reading": "おい、ちょっとまってくれ。", "chinese": "喂，等一下。"},
        "quality_score": "curated",
    },
}

def apply_corrections(data, corrections):
    corrected = 0
    for entry in data:
        eid = entry.get("id")
        if eid in corrections:
            c = corrections[eid]
            entry["meaning"] = c["meaning"]
            entry["example"] = c["example"]
            entry["quality_score"] = c["quality_score"]
            if "_quality" in entry:
                entry["_quality"]["quality_score"] = c["quality_score"]
                entry["_quality"]["example_source"] = "curated"
                entry["_quality"]["meaning_source"] = "curated"
            corrected += 1
    return corrected

def validate(data, corrections):
    errors = []
    ids_in_data = {e["id"] for e in data}
    for eid in corrections:
        if eid not in ids_in_data:
            errors.append(f"ID {eid} not found in data")
    for entry in data:
        eid = entry.get("id")
        if eid in corrections:
            if not entry.get("meaning"):
                errors.append(f"ID {eid}: empty meaning")
            ex = entry.get("example", {})
            if not ex.get("japanese"):
                errors.append(f"ID {eid}: empty example.japanese")
            if not ex.get("chinese"):
                errors.append(f"ID {eid}: empty example.chinese")
            if entry.get("quality_score") not in ("curated", "verb_curated"):
                errors.append(f"ID {eid}: bad quality_score {entry.get('quality_score')}")
    return errors

if __name__ == "__main__":
    path = "/Users/liying.chu/nihongo-vocab-trainer/public/data/vocab_13000.json"
    with open(path) as f:
        data = json.load(f)

    n = apply_corrections(data, CORRECTIONS)
    errors = validate(data, CORRECTIONS)
    if errors:
        print("VALIDATION ERRORS:")
        for e in errors:
            print(" ", e)
        sys.exit(1)

    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Applied {n} corrections. Saved.")

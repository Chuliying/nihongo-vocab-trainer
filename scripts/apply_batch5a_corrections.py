#!/usr/bin/env python3
"""T1 remaining batch 5a: IDs 97-310"""
import json, sys

CORRECTIONS = {
    97: {"meaning": "中間、裡面；中（漢字用字）", "example": {"japanese": "箱の中に何が入っていますか。", "reading": "はこのなかになにがはいっていますか。", "chinese": "箱子裡面放了什麼？"}, "quality_score": "curated"},
    104: {"meaning": "時候、時間", "example": {"japanese": "子供の時、よく公園で遊びました。", "reading": "こどものとき、よくこうえんであそびました。", "chinese": "小時候經常在公園玩。"}, "quality_score": "curated"},
    113: {"meaning": "自己、本身", "example": {"japanese": "自分で料理を作りました。", "reading": "じぶんでりょうりをつくりました。", "chinese": "自己做了料理。"}, "quality_score": "curated"},
    116: {"meaning": "前面；之前", "example": {"japanese": "ご飯の前に手を洗います。", "reading": "ごはんのまえにてをあらいます。", "chinese": "吃飯前洗手。"}, "quality_score": "curated"},
    122: {"meaning": "眼睛；序號（〜目）", "example": {"japanese": "目が痛いので病院に行きました。", "reading": "めがいたいのでびょういんにいきました。", "chinese": "眼睛痛，所以去了醫院。"}, "quality_score": "curated"},
    126: {"meaning": "部分；分鐘；身分", "example": {"japanese": "今、3時30分です。", "reading": "いま、さんじさんじゅっぷんです。", "chinese": "現在是3點30分。"}, "quality_score": "curated"},
    128: {"meaning": "日元（日本貨幣）；圓形", "example": {"japanese": "このペンは100円です。", "reading": "このペンはひゃくえんです。", "chinese": "這支筆100日元。"}, "quality_score": "curated"},
    129: {"meaning": "後面；之後", "example": {"japanese": "仕事の後で映画を見ます。", "reading": "しごとのあとでえいがをみます。", "chinese": "工作後看電影。"}, "quality_score": "curated"},
    134: {"meaning": "二、2", "example": {"japanese": "リンゴが二つあります。", "reading": "リンゴがふたつあります。", "chinese": "有兩個蘋果。"}, "quality_score": "curated"},
    135: {"meaning": "喜歡的", "example": {"japanese": "私は音楽が好きです。", "reading": "わたしはおんがくがすきです。", "chinese": "我喜歡音樂。"}, "quality_score": "curated"},
    136: {"meaning": "好的、良好的", "example": {"japanese": "今日は天気が良いですね。", "reading": "きょうはてんきがよいですね。", "chinese": "今天天氣真好。"}, "quality_score": "curated"},
    138: {"meaning": "上面、上方", "example": {"japanese": "机の上に本があります。", "reading": "つくえのうえにほんがあります。", "chinese": "桌子上有書。"}, "quality_score": "curated"},
    139: {"meaning": "想法、思考", "example": {"japanese": "良い考えが浮かびました。", "reading": "よいかんがえがうかびました。", "chinese": "想到了好主意。"}, "quality_score": "curated"},
    140: {"meaning": "感覺、感受", "example": {"japanese": "怖い感じがします。", "reading": "こわいかんじがします。", "chinese": "有一種恐怖的感覺。"}, "quality_score": "curated"},
    141: {"meaning": "必要的、需要的", "example": {"japanese": "傘が必要です。", "reading": "かさがひつようです。", "chinese": "需要雨傘。"}, "quality_score": "curated"},
    144: {"meaning": "萬（一萬）", "example": {"japanese": "このカメラは5万円です。", "reading": "このカメラはごまんえんです。", "chinese": "這台相機五萬日元。"}, "quality_score": "curated"},
    146: {"meaning": "世界、全球", "example": {"japanese": "世界中に友達がいます。", "reading": "せかいじゅうにともだちがいます。", "chinese": "世界各地都有朋友。"}, "quality_score": "curated"},
    160: {"meaning": "相同的、一樣的", "example": {"japanese": "私と同じ服を着ています。", "reading": "わたしとおなじふくをきています。", "chinese": "穿著和我一樣的衣服。"}, "quality_score": "curated"},
    162: {"meaning": "還、仍然；尚未", "example": {"japanese": "宿題がまだ終わっていません。", "reading": "しゅくだいがまだおわっていません。", "chinese": "作業還沒做完。"}, "quality_score": "curated"},
    172: {"meaning": "三、3", "example": {"japanese": "三人で旅行しました。", "reading": "さんにんでりょこうしました。", "chinese": "三個人一起旅行了。"}, "quality_score": "curated"},
    173: {"meaning": "關係、關聯", "example": {"japanese": "二人の関係はとても良いです。", "reading": "ふたりのかんけいはとてもよいです。", "chinese": "兩個人的關係非常好。"}, "quality_score": "curated"},
    178: {"meaning": "今天；現今（こんにち）", "example": {"japanese": "今日は何曜日ですか。", "reading": "きょうはなんようびですか。", "chinese": "今天是星期幾？"}, "quality_score": "curated"},
    179: {"meaning": "真的、確實地", "example": {"japanese": "本当に嬉しいです。", "reading": "ほんとうにうれしいです。", "chinese": "真的很開心。"}, "quality_score": "curated"},
    181: {"meaning": "以上、超過；就這樣（結束）", "example": {"japanese": "18歳以上でないと入れません。", "reading": "じゅうはっさいいじょうでないとはいれません。", "chinese": "未滿18歲不得入場。"}, "quality_score": "curated"},
    182: {"meaning": "可能的、可行的", "example": {"japanese": "明日参加することは可能ですか。", "reading": "あしたさんかすることはかのうですか。", "chinese": "明天參加可以嗎？"}, "quality_score": "curated"},
    185: {"meaning": "孩子、小孩", "example": {"japanese": "あの子はとてもかわいいです。", "reading": "あのこはとてもかわいいです。", "chinese": "那個孩子非常可愛。"}, "quality_score": "curated"},
    186: {"meaning": "錢、金錢；金屬", "example": {"japanese": "お金が足りません。", "reading": "おかねがたりません。", "chinese": "錢不夠。"}, "quality_score": "curated"},
    189: {"meaning": "男性、男人", "example": {"japanese": "あの男はとても背が高いです。", "reading": "あのおとこはとてもせがたかいです。", "chinese": "那個男人個子很高。"}, "quality_score": "curated"},
    195: {"meaning": "女性、女人", "example": {"japanese": "あの女の人は先生です。", "reading": "あのおんなのひとはせんせいです。", "chinese": "那位女性是老師。"}, "quality_score": "curated"},
    199: {"meaning": "放入、裝入（入れる的連用形）；容器", "example": {"japanese": "バッグにお弁当を入れました。", "reading": "バッグにおべんとうをいれました。", "chinese": "把便當放進包包裡了。"}, "quality_score": "curated"},
    200: {"meaning": "想要的、希望擁有的", "example": {"japanese": "新しいパソコンが欲しいです。", "reading": "あたらしいパソコンがほしいです。", "chinese": "想要新的電腦。"}, "quality_score": "curated"},
    201: {"meaning": "沒有、不存在（形容詞形式）", "example": {"japanese": "財布が無いことに気づきました。", "reading": "さいふがないことにきづきました。", "chinese": "發現錢包不見了。"}, "quality_score": "curated"},
    205: {"meaning": "女性、女人", "example": {"japanese": "その女性は有名な作家です。", "reading": "そのじょせいはゆうめいなさっかです。", "chinese": "那位女性是著名的作家。"}, "quality_score": "curated"},
    218: {"meaning": "結果、後果", "example": {"japanese": "試験の結果が出ました。", "reading": "しけんのけっかがでました。", "chinese": "考試結果出來了。"}, "quality_score": "curated"},
    221: {"meaning": "照片、相片", "example": {"japanese": "旅行で写真をたくさん撮りました。", "reading": "りょこうでしゃしんをたくさんとりました。", "chinese": "旅行時拍了很多照片。"}, "quality_score": "curated"},
    222: {"meaning": "參加、加入", "example": {"japanese": "マラソン大会に参加しました。", "reading": "マラソンたいかいにさんかしました。", "chinese": "參加了馬拉松大賽。"}, "quality_score": "curated"},
    223: {"meaning": "請求、拜託", "example": {"japanese": "お願い、助けてください。", "reading": "おねがい、たすけてください。", "chinese": "拜託你，請幫幫我。"}, "quality_score": "curated"},
    236: {"meaning": "孩子、小孩", "example": {"japanese": "子供が公園で遊んでいます。", "reading": "こどもがこうえんであそんでいます。", "chinese": "孩子們在公園玩耍。"}, "quality_score": "curated"},
    241: {"meaning": "免費的", "example": {"japanese": "このアプリは無料でダウンロードできます。", "reading": "このアプリはむりょうでダウンロードできます。", "chinese": "這個應用程式可以免費下載。"}, "quality_score": "curated"},
    244: {"meaning": "地點、場所", "example": {"japanese": "待ち合わせの場所を教えてください。", "reading": "まちあわせのばしょをおしえてください。", "chinese": "請告訴我集合地點。"}, "quality_score": "curated"},
    245: {"meaning": "最後、結尾", "example": {"japanese": "最後のページを読みました。", "reading": "さいごのページをよみました。", "chinese": "讀了最後一頁。"}, "quality_score": "curated"},
    249: {"meaning": "第一、最", "example": {"japanese": "一番好きな食べ物はラーメンです。", "reading": "いちばんすきなたべものはラーメンです。", "chinese": "最喜歡的食物是拉麵。"}, "quality_score": "curated"},
    250: {"meaning": "日式高湯；出手（出す的連用形）", "example": {"japanese": "みそ汁は出しで作ります。", "reading": "みそしるはだしでつくります。", "chinese": "味噌湯是用高湯做的。"}, "quality_score": "curated"},
    252: {"meaning": "沒關係、沒問題", "example": {"japanese": "大丈夫ですか、けがしましたか。", "reading": "だいじょうぶですか、けがしましたか。", "chinese": "你還好嗎，有受傷嗎？"}, "quality_score": "curated"},
    253: {"meaning": "話語、詞彙；語言", "example": {"japanese": "優しい言葉をかけてもらいました。", "reading": "やさしいことばをかけてもらいました。", "chinese": "收到了溫柔的話語。"}, "quality_score": "curated"},
    254: {"meaning": "電影", "example": {"japanese": "今夜、映画を見に行きます。", "reading": "こんや、えいがをみにいきます。", "chinese": "今晚去看電影。"}, "quality_score": "curated"},
    260: {"meaning": "對方、夥伴", "example": {"japanese": "相手の気持ちを考えましょう。", "reading": "あいてのきもちをかんがえましょう。", "chinese": "想想對方的感受吧。"}, "quality_score": "curated"},
    261: {"meaning": "面子、虛榮", "example": {"japanese": "見栄を張るのはよくないです。", "reading": "みえをはるのはよくないです。", "chinese": "愛面子是不好的。"}, "quality_score": "curated"},
    264: {"meaning": "作品（藝術、文學等）", "example": {"japanese": "彼女の作品は世界中で人気があります。", "reading": "かのじょのさくひんはせかいじゅうでにんきがあります。", "chinese": "她的作品在全世界很受歡迎。"}, "quality_score": "curated"},
    265: {"meaning": "影片、動態影像", "example": {"japanese": "面白い動画を見ました。", "reading": "おもしろいどうがをみました。", "chinese": "看了有趣的影片。"}, "quality_score": "curated"},
    266: {"meaning": "開始、起初", "example": {"japanese": "始めから説明してください。", "reading": "はじめからせつめいしてください。", "chinese": "請從頭開始說明。"}, "quality_score": "curated"},
    267: {"meaning": "她；女朋友", "example": {"japanese": "彼女は毎日運動しています。", "reading": "かのじょはまいにちうんどうしています。", "chinese": "她每天都在運動。"}, "quality_score": "curated"},
    272: {"meaning": "企業、公司", "example": {"japanese": "大きな企業に就職しました。", "reading": "おおきなきぎょうにしゅうしょくしました。", "chinese": "進入了大公司工作。"}, "quality_score": "curated"},
    273: {"meaning": "利用、使用", "example": {"japanese": "図書館を利用して本を借りました。", "reading": "としょかんをりようしてほんをかりました。", "chinese": "利用圖書館借了書。"}, "quality_score": "curated"},
    276: {"meaning": "勉強、無理；不可能", "example": {"japanese": "無理をしないでください。", "reading": "むりをしないでください。", "chinese": "請不要勉強自己。"}, "quality_score": "curated"},
    277: {"meaning": "現在、目前", "example": {"japanese": "現在、仕事をしています。", "reading": "げんざい、しごとをしています。", "chinese": "現在在工作。"}, "quality_score": "curated"},
    280: {"meaning": "水、冷水", "example": {"japanese": "水を一杯ください。", "reading": "みずをいっぱいください。", "chinese": "請給我一杯水。"}, "quality_score": "curated"},
    284: {"meaning": "正如…；街道、大路", "example": {"japanese": "地図の通りに行ってください。", "reading": "ちずのとおりにいってください。", "chinese": "請按照地圖走。"}, "quality_score": "curated"},
    288: {"meaning": "學校", "example": {"japanese": "学校まで歩いて10分です。", "reading": "がっこうまであるいてじゅっぷんです。", "chinese": "步行到學校要10分鐘。"}, "quality_score": "curated"},
    289: {"meaning": "最高的、最棒的", "example": {"japanese": "このラーメンは最高においしい。", "reading": "このラーメンはさいこうにおいしい。", "chinese": "這碗拉麵最好吃了。"}, "quality_score": "curated"},
    290: {"meaning": "狀態、狀況", "example": {"japanese": "体の状態が良くないです。", "reading": "からだのじょうたいがよくないです。", "chinese": "身體狀況不太好。"}, "quality_score": "curated"},
    292: {"meaning": "發售、上市", "example": {"japanese": "新しいスマホが発売されました。", "reading": "あたらしいスマホがはつばいされました。", "chinese": "新型智慧手機上市了。"}, "quality_score": "curated"},
    293: {"meaning": "簡單的、容易的", "example": {"japanese": "この料理は簡単に作れます。", "reading": "このりょうりはかんたんにつくれます。", "chinese": "這道料理很容易做。"}, "quality_score": "curated"},
    300: {"meaning": "感覺、心情", "example": {"japanese": "気持ちが落ち着きました。", "reading": "きもちがおちつきました。", "chinese": "心情平靜下來了。"}, "quality_score": "curated"},
    301: {"meaning": "確認、核實", "example": {"japanese": "もう一度確認してください。", "reading": "もういちどかくにんしてください。", "chinese": "請再確認一次。"}, "quality_score": "curated"},
    309: {"meaning": "個人", "example": {"japanese": "これは個人の意見です。", "reading": "これはこじんのいけんです。", "chinese": "這是個人的意見。"}, "quality_score": "curated"},
    310: {"meaning": "外面、戶外", "example": {"japanese": "外は寒いので、コートを着てください。", "reading": "そとはさむいので、コートをきてください。", "chinese": "外面很冷，請穿外套。"}, "quality_score": "curated"},
}

def apply(data, corrections):
    n = 0
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
            n += 1
    return n

if __name__ == "__main__":
    path = "public/data/vocab_13000.json"
    with open(path) as f: data = json.load(f)
    n = apply(data, CORRECTIONS)
    with open(path, "w") as f: json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Applied {n} corrections.")

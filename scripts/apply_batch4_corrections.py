#!/usr/bin/env python3
"""Apply batch 4 (final) corrections to T1 template sentences."""
import json, sys

CORRECTIONS = {
    817: {"meaning": "（いらっしゃるの語幹）敬語的「在・去・來」", "example": {"japanese": "いらっしゃいませ、どうぞお入りください。", "reading": "いらっしゃいませ、どうぞおはいりください。", "chinese": "歡迎光臨，請進。"}, "quality_score": "curated"},
    818: {"meaning": "間隔、每隔（〜おきに）；放置（置き的連用形）", "example": {"japanese": "一時間おきにバスが来ます。", "reading": "いちじかんおきにバスがきます。", "chinese": "每隔一小時有一班公車。"}, "quality_score": "curated"},
    819: {"meaning": "這些（複數指示代名詞）", "example": {"japanese": "これらの本は全部読みました。", "reading": "これらのほんはぜんぶよみました。", "chinese": "這些書都讀過了。"}, "quality_score": "curated"},
    820: {"meaning": "什麼樣的、怎樣的", "example": {"japanese": "どういう意味ですか。", "reading": "どういういみですか。", "chinese": "是什麼意思？"}, "quality_score": "curated"},
    822: {"meaning": "軟體；柔和的、溫和的", "example": {"japanese": "このソフトは使いやすいです。", "reading": "このソフトはつかいやすいです。", "chinese": "這個軟體很容易使用。"}, "quality_score": "curated"},
    829: {"meaning": "成長、發展", "example": {"japanese": "子供の成長を見るのが楽しみです。", "reading": "こどものせいちょうをみるのがたのしみです。", "chinese": "看著孩子成長很開心。"}, "quality_score": "curated"},
    832: {"meaning": "機關、機構；引擎", "example": {"japanese": "政府機関で働いています。", "reading": "せいふきかんではたらいています。", "chinese": "在政府機關工作。"}, "quality_score": "curated"},
    837: {"meaning": "我（第一人稱代名詞）", "example": {"japanese": "わたしは学生です。", "reading": "わたしはがくせいです。", "chinese": "我是學生。"}, "quality_score": "curated"},
    847: {"meaning": "變化、改變", "example": {"japanese": "季節が変わると気温が変化します。", "reading": "きせつがかわるときおんがへんかします。", "chinese": "季節更替時氣溫會有變化。"}, "quality_score": "curated"},
    852: {"meaning": "聽（聞く的連用形）；聽力", "example": {"japanese": "聞きやすい声で話してください。", "reading": "ききやすいこえではなしてください。", "chinese": "請用清晰的聲音說話。"}, "quality_score": "curated"},
    856: {"meaning": "附著；接觸；點燃；就位（就く）", "example": {"japanese": "電気がつきました。", "reading": "でんきがつきました。", "chinese": "燈亮了。"}, "quality_score": "verb_curated"},
    857: {"meaning": "如…之類的（列舉的表現）", "example": {"japanese": "犬や猫といったペットが好きです。", "reading": "いぬやねこといったペットがすきです。", "chinese": "喜歡狗狗和貓咪之類的寵物。"}, "quality_score": "curated"},
    858: {"meaning": "在…中（書面語表場所的正式表現）", "example": {"japanese": "日本における教育は大切です。", "reading": "にほんにおけるきょういくはたいせつです。", "chinese": "在日本的教育是很重要的。"}, "quality_score": "curated"},
    859: {"meaning": "收到、得到（もらう的連用形）；もらい泣き（被感染落淚）", "example": {"japanese": "もらい泣きしてしまいました。", "reading": "もらいなきしてしまいました。", "chinese": "被感染哭了起來。"}, "quality_score": "curated"},
    860: {"meaning": "原創的、獨特的（英語original的借詞）", "example": {"japanese": "オリジナルのデザインを作りました。", "reading": "オリジナルのデザインをつくりました。", "chinese": "設計了原創的設計。"}, "quality_score": "curated"},
    863: {"meaning": "Do（音階的第一音）；ド（片假名字母）", "example": {"japanese": "ドレミファソラシドと歌います。", "reading": "ドレミファソラシドとうたいます。", "chinese": "唱do re mi fa so la si do。"}, "quality_score": "curated"},
    869: {"meaning": "條件、要件", "example": {"japanese": "この仕事の条件は何ですか。", "reading": "このしごとのじょうけんはなんですか。", "chinese": "這份工作的條件是什麼？"}, "quality_score": "curated"},
    874: {"meaning": "觀光、旅遊", "example": {"japanese": "京都に観光に行きました。", "reading": "きょうとにかんこうにいきました。", "chinese": "去京都觀光了。"}, "quality_score": "curated"},
    876: {"meaning": "但是、雖然…但（表逆接的連接詞）", "example": {"japanese": "行きたいけれど、時間がありません。", "reading": "いきたいけれど、じかんがありません。", "chinese": "雖然想去，但是沒有時間。"}, "quality_score": "curated"},
    880: {"meaning": "Re（音階的第二音）；レ（片假名字母）", "example": {"japanese": "ドからレへ音が上がります。", "reading": "ドからレへおとがあがります。", "chinese": "音從Do升到Re。"}, "quality_score": "curated"},
    886: {"meaning": "種類、類型", "example": {"japanese": "日本語には三種類の文字があります。", "reading": "にほんごにはさんしゅるいのもじがあります。", "chinese": "日語有三種文字。"}, "quality_score": "curated"},
    887: {"meaning": "附近、周邊；命中、被選中", "example": {"japanese": "この辺りに郵便局がありますか。", "reading": "このあたりにゆうびんきょくがありますか。", "chinese": "這附近有郵局嗎？"}, "quality_score": "curated"},
    888: {"meaning": "幾個；幾歲", "example": {"japanese": "りんごがいくつありますか。", "reading": "りんごがいくつありますか。", "chinese": "有幾個蘋果？"}, "quality_score": "curated"},
    891: {"meaning": "請…（禮貌命令形，接在動詞ます形後）", "example": {"japanese": "早く寝なさい。", "reading": "はやくねなさい。", "chinese": "快去睡覺。"}, "quality_score": "curated"},
    901: {"meaning": "投票、選舉", "example": {"japanese": "選挙で投票しました。", "reading": "せんきょでとうひょうしました。", "chinese": "在選舉中投了票。"}, "quality_score": "curated"},
    902: {"meaning": "旅行、旅遊", "example": {"japanese": "来年、海外旅行に行く予定です。", "reading": "らいねん、かいがいりょこうにいくよていです。", "chinese": "計畫明年去海外旅行。"}, "quality_score": "curated"},
    903: {"meaning": "機會、時機", "example": {"japanese": "良い機会なので、挑戦してみます。", "reading": "よいきかいなので、ちょうせんしてみます。", "chinese": "既然是好機會，就挑戰看看。"}, "quality_score": "curated"},
    907: {"meaning": "離開（離れる的連用形）；獨立建築", "example": {"japanese": "故郷を離れて10年が経ちました。", "reading": "ふるさとをはなれてじゅうねんがたちました。", "chinese": "離開家鄉已經10年了。"}, "quality_score": "curated"},
    908: {"meaning": "奇怪的；有趣的、好笑的", "example": {"japanese": "この話はとてもおかしいです。", "reading": "このはなしはとてもおかしいです。", "chinese": "這個故事非常好笑。"}, "quality_score": "curated"},
    909: {"meaning": "早安（早上的問候語）", "example": {"japanese": "おはようございます。", "reading": "おはようございます。", "chinese": "早安。"}, "quality_score": "curated"},
    910: {"meaning": "恭喜！祝賀！", "example": {"japanese": "誕生日おめでとう！", "reading": "たんじょうびおめでとう！", "chinese": "生日快樂！"}, "quality_score": "curated"},
    911: {"meaning": "拿取；拍攝；採取（とる有多種意思）", "example": {"japanese": "写真を撮りましょう。", "reading": "しゃしんをとりましょう。", "chinese": "來拍張照片吧。"}, "quality_score": "verb_curated"},
    915: {"meaning": "嗨（精神亢奮）；「是」的輕鬆說法", "example": {"japanese": "ハイ、わかりました。", "reading": "ハイ、わかりました。", "chinese": "好，我明白了。"}, "quality_score": "curated"},
    919: {"meaning": "勝利、獲勝", "example": {"japanese": "チームが試合で勝利しました。", "reading": "チームがしあいでしょうりしました。", "chinese": "隊伍在比賽中獲勝了。"}, "quality_score": "curated"},
    927: {"meaning": "螢幕、畫面", "example": {"japanese": "スマホの画面が割れました。", "reading": "スマホのがめんがわれました。", "chinese": "智慧型手機的螢幕裂了。"}, "quality_score": "curated"},
    931: {"meaning": "複數、多個", "example": {"japanese": "複数の方法を試してみました。", "reading": "ふくすうのほうほうをためしてみました。", "chinese": "嘗試了多種方法。"}, "quality_score": "curated"},
    935: {"meaning": "託…的福、多虧了…", "example": {"japanese": "皆のおかげで成功しました。", "reading": "みんなのおかげでせいこうしました。", "chinese": "多虧大家才成功了。"}, "quality_score": "curated"},
    936: {"meaning": "哦！啊！（表驚訝的感動詞）", "example": {"japanese": "おっ、久しぶりだね。", "reading": "おっ、ひさしぶりだね。", "chinese": "哦，好久不見。"}, "quality_score": "curated"},
    937: {"meaning": "看吧！看！（見る的命令形）；帝代（みよ）", "example": {"japanese": "みんな、みよ！あそこに虹が出ている。", "reading": "みんな、みよ！あそこにはにじがでている。", "chinese": "大家看！那裡出現了彩虹。"}, "quality_score": "curated"},
    944: {"meaning": "股份有限公司", "example": {"japanese": "彼は大きな株式会社に勤めています。", "reading": "かれはおおきなかぶしきがいしゃにつとめています。", "chinese": "他在一家大型股份有限公司工作。"}, "quality_score": "curated"},
    947: {"meaning": "學生、學員", "example": {"japanese": "生徒たちが熱心に勉強しています。", "reading": "せいとたちがねっしんにべんきょうしています。", "chinese": "學生們認真地學習著。"}, "quality_score": "curated"},
    949: {"meaning": "練習、訓練", "example": {"japanese": "毎日ピアノを練習しています。", "reading": "まいにちピアノをれんしゅうしています。", "chinese": "每天練習鋼琴。"}, "quality_score": "curated"},
    950: {"meaning": "給（給別人）；舉起；油炸（〜てあげる）", "example": {"japanese": "友達にプレゼントをあげました。", "reading": "ともだちにプレゼントをあげました。", "chinese": "給了朋友禮物。"}, "quality_score": "verb_curated"},
    952: {"meaning": "…的感覺、像是…（表感覺的接尾詞）", "example": {"japanese": "彼はちょっと子供っぽいですね。", "reading": "かれはちょっとこどもっぽいですね。", "chinese": "他有點像小孩呢。"}, "quality_score": "curated"},
    961: {"meaning": "會場、活動場地", "example": {"japanese": "コンサートの会場は満員でした。", "reading": "コンサートのかいじょうはまんいんでした。", "chinese": "音樂會的會場座無虛席。"}, "quality_score": "curated"},
    980: {"meaning": "黑色；黑咖啡；不良（口語）", "example": {"japanese": "ブラックコーヒーをよく飲みます。", "reading": "ブラックコーヒーをよくのみます。", "chinese": "經常喝黑咖啡。"}, "quality_score": "curated"},
    990: {"meaning": "感覺、感受", "example": {"japanese": "この布は手触りの感覚がいいです。", "reading": "このぬのはてざわりのかんかくがいいです。", "chinese": "這塊布的觸感很好。"}, "quality_score": "curated"},
    991: {"meaning": "指導、帶領", "example": {"japanese": "先生が丁寧に指導してくれました。", "reading": "せんせいがていねいにしどうしてくれました。", "chinese": "老師耐心地指導了我。"}, "quality_score": "curated"},
    994: {"meaning": "橫濱（日本神奈川縣城市）", "example": {"japanese": "横浜は港町として有名です。", "reading": "よこはまはみなとまちとしてゆうめいです。", "chinese": "橫濱以港口城市聞名。"}, "quality_score": "curated"},
    995: {"meaning": "現代、當代", "example": {"japanese": "現代の生活はとても便利です。", "reading": "げんだいのせいかつはとてもべんりです。", "chinese": "現代生活非常便利。"}, "quality_score": "curated"},
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

if __name__ == "__main__":
    path = "/Users/liying.chu/nihongo-vocab-trainer/public/data/vocab_13000.json"
    with open(path) as f:
        data = json.load(f)
    n = apply_corrections(data, CORRECTIONS)
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Applied {n} corrections. Saved.")

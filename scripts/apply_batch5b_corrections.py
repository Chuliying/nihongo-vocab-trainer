#!/usr/bin/env python3
"""T1 remaining batch 5b: IDs 312-540"""
import json

CORRECTIONS = {
    312: {"meaning": "快點、早點（副詞）", "example": {"japanese": "早く帰りなさい。", "reading": "はやくかえりなさい。", "chinese": "快點回家。"}, "quality_score": "curated"},
    317: {"meaning": "一個、一件", "example": {"japanese": "りんごを一つ買いました。", "reading": "りんごをひとつかいました。", "chinese": "買了一個蘋果。"}, "quality_score": "curated"},
    320: {"meaning": "生活、日常生活", "example": {"japanese": "一人暮らしの生活に慣れました。", "reading": "ひとりぐらしのせいかつになれました。", "chinese": "習慣了一個人的生活。"}, "quality_score": "curated"},
    322: {"meaning": "不行、沒用", "example": {"japanese": "それは駄目です、やめてください。", "reading": "それはだめです、やめてください。", "chinese": "那樣不行，請停止。"}, "quality_score": "curated"},
    327: {"meaning": "只有、僅限（書面語）", "example": {"japanese": "会員のみ入場できます。", "reading": "かいいんのみにゅうじょうできます。", "chinese": "僅限會員入場。"}, "quality_score": "curated"},
    336: {"meaning": "內容", "example": {"japanese": "メールの内容を確認しました。", "reading": "メールのないようをかくにんしました。", "chinese": "確認了電子郵件的內容。"}, "quality_score": "curated"},
    339: {"meaning": "女孩、女生", "example": {"japanese": "その女の子はとてもかわいいです。", "reading": "そのおんなのこはとてもかわいいです。", "chinese": "那個女孩非常可愛。"}, "quality_score": "curated"},
    340: {"meaning": "對應、應對", "example": {"japanese": "問題に素早く対応しました。", "reading": "もんだいにすばやくたいおうしました。", "chinese": "迅速應對了問題。"}, "quality_score": "curated"},
    341: {"meaning": "廣播、播出", "example": {"japanese": "人気番組が放送されました。", "reading": "にんきばんぐみがほうそうされました。", "chinese": "熱門節目播出了。"}, "quality_score": "curated"},
    349: {"meaning": "非常、很；辛苦的、嚴重的", "example": {"japanese": "引っ越しは大変でした。", "reading": "ひっこしはたいへんでした。", "chinese": "搬家很辛苦。"}, "quality_score": "curated"},
    352: {"meaning": "特別是、尤其", "example": {"japanese": "特に魚料理が好きです。", "reading": "とくにさかなりょうりがすきです。", "chinese": "特別喜歡魚類料理。"}, "quality_score": "curated"},
    357: {"meaning": "只有、淨是…；剛剛（才做了）", "example": {"japanese": "彼はゲームばかりしています。", "reading": "かれはゲームばかりしています。", "chinese": "他淨是在玩遊戲。"}, "quality_score": "curated"},
    362: {"meaning": "七、7", "example": {"japanese": "七時に起きました。", "reading": "しちじにおきました。", "chinese": "七點起床了。"}, "quality_score": "curated"},
    369: {"meaning": "部分、某些", "example": {"japanese": "この部分がよくわかりません。", "reading": "このぶぶんがよくわかりません。", "chinese": "這個部分不太懂。"}, "quality_score": "curated"},
    374: {"meaning": "預定、計畫", "example": {"japanese": "週末に旅行の予定があります。", "reading": "しゅうまつにりょこうのよていがあります。", "chinese": "週末有旅行的計畫。"}, "quality_score": "curated"},
    375: {"meaning": "全員、所有成員", "example": {"japanese": "全員が集合しました。", "reading": "ぜんいんがしゅうごうしました。", "chinese": "所有人都集合了。"}, "quality_score": "curated"},
    376: {"meaning": "嘴巴、開口", "example": {"japanese": "口を大きく開けてください。", "reading": "くちをおおきくあけてください。", "chinese": "請把嘴巴張大。"}, "quality_score": "curated"},
    378: {"meaning": "明天", "example": {"japanese": "明日また来てください。", "reading": "あしたまたきてください。", "chinese": "明天請再來。"}, "quality_score": "curated"},
    379: {"meaning": "登錄、註冊", "example": {"japanese": "無料で会員登録できます。", "reading": "むりょうでかいいんとうろくできます。", "chinese": "可以免費註冊會員。"}, "quality_score": "curated"},
    380: {"meaning": "確實的；好像是…（模糊記憶）", "example": {"japanese": "確か、昨日も来ていましたね。", "reading": "たしか、きのうもきていましたね。", "chinese": "好像昨天也有來吧。"}, "quality_score": "curated"},
    382: {"meaning": "花、花朵", "example": {"japanese": "公園に花が咲いています。", "reading": "こうえんにはながさいています。", "chinese": "公園裡開著花。"}, "quality_score": "curated"},
    387: {"meaning": "調查、調查研究", "example": {"japanese": "市場調査を行いました。", "reading": "しじょうちょうさをおこないました。", "chinese": "進行了市場調查。"}, "quality_score": "curated"},
    388: {"meaning": "重要的、重大的", "example": {"japanese": "健康は重要なことです。", "reading": "けんこうはじゅうようなことです。", "chinese": "健康是很重要的事。"}, "quality_score": "curated"},
    392: {"meaning": "對…、對於…（表對象）", "example": {"japanese": "先生に対して失礼なことを言いました。", "reading": "せんせいにたいしてしつれいなことをいいました。", "chinese": "對老師說了失禮的話。"}, "quality_score": "curated"},
    396: {"meaning": "目的、目標", "example": {"japanese": "旅行の目的は観光です。", "reading": "りょこうのもくてきはかんこうです。", "chinese": "旅行的目的是觀光。"}, "quality_score": "curated"},
    397: {"meaning": "自由的、不受拘束的", "example": {"japanese": "自由な時間が好きです。", "reading": "じゆうなじかんがすきです。", "chinese": "喜歡自由的時間。"}, "quality_score": "curated"},
    398: {"meaning": "文章、新聞報導", "example": {"japanese": "新聞の記事を読みました。", "reading": "しんぶんのきじをよみました。", "chinese": "讀了報紙的文章。"}, "quality_score": "curated"},
    400: {"meaning": "開發、研發", "example": {"japanese": "新しい技術を開発しています。", "reading": "あたらしいぎじゅつをかいはつしています。", "chinese": "正在開發新技術。"}, "quality_score": "curated"},
    404: {"meaning": "家人、家族", "example": {"japanese": "家族で夕食を食べました。", "reading": "かぞくでゆうしょくをたべました。", "chinese": "和家人一起吃了晚飯。"}, "quality_score": "curated"},
    406: {"meaning": "政府", "example": {"japanese": "政府が新しい法律を作りました。", "reading": "せいふがあたらしいほうりつをつくりました。", "chinese": "政府制定了新法律。"}, "quality_score": "curated"},
    409: {"meaning": "限定、限量", "example": {"japanese": "数量限定の商品です。", "reading": "すうりょうげんていのしょうひんです。", "chinese": "這是數量限定的商品。"}, "quality_score": "curated"},
    414: {"meaning": "地區、區域", "example": {"japanese": "この地域は静かでいいです。", "reading": "このちいきはしずかでいいです。", "chinese": "這個地區很安靜，很好。"}, "quality_score": "curated"},
    424: {"meaning": "強的、有力的", "example": {"japanese": "彼はとても強い選手です。", "reading": "かれはとてもつよいせんしゅです。", "chinese": "他是非常強的選手。"}, "quality_score": "curated"},
    428: {"meaning": "以前、從前", "example": {"japanese": "以前はここに川がありました。", "reading": "いぜんはここにかわがありました。", "chinese": "以前這裡有條河。"}, "quality_score": "curated"},
    429: {"meaning": "安全的", "example": {"japanese": "安全に気をつけて運転してください。", "reading": "あんぜんにきをつけてうんてんしてください。", "chinese": "請注意安全駕駛。"}, "quality_score": "curated"},
    433: {"meaning": "腳、腿", "example": {"japanese": "足が痛くて歩けません。", "reading": "あしがいたくてあるけません。", "chinese": "腳痛得走不了路。"}, "quality_score": "curated"},
    436: {"meaning": "夜露、露水（夜晚形成的）", "example": {"japanese": "草の上に夜露がついています。", "reading": "くさのうえによつゆがついています。", "chinese": "草地上沾著夜露。"}, "quality_score": "curated"},
    443: {"meaning": "大的（連體詞形式）", "example": {"japanese": "大きな犬が走っています。", "reading": "おおきないぬがはしっています。", "chinese": "一隻大狗在奔跑。"}, "quality_score": "curated"},
    444: {"meaning": "重要的；珍惜的", "example": {"japanese": "体が一番大事です。", "reading": "からだがいちばんだいじです。", "chinese": "身體是最重要的。"}, "quality_score": "curated"},
    445: {"meaning": "每天、每日", "example": {"japanese": "毎日日本語を勉強しています。", "reading": "まいにちにほんごをべんきょうしています。", "chinese": "每天都在學日語。"}, "quality_score": "curated"},
    446: {"meaning": "結束、終了", "example": {"japanese": "試合が終了しました。", "reading": "しあいがしゅうりょうしました。", "chinese": "比賽結束了。"}, "quality_score": "curated"},
    448: {"meaning": "音樂", "example": {"japanese": "音楽を聴きながら勉強します。", "reading": "おんがくをききながらべんきょうします。", "chinese": "一邊聽音樂一邊學習。"}, "quality_score": "curated"},
    457: {"meaning": "期待、期望", "example": {"japanese": "試合の結果をとても期待しています。", "reading": "しあいのけっかをとてもきたいしています。", "chinese": "非常期待比賽的結果。"}, "quality_score": "curated"},
    458: {"meaning": "醫院", "example": {"japanese": "熱があるので病院に行きます。", "reading": "ねつがあるのでびょういんにいきます。", "chinese": "因為發燒，所以去醫院。"}, "quality_score": "curated"},
    459: {"meaning": "相當、頗；可以了（婉拒）", "example": {"japanese": "今日は結構疲れました。", "reading": "きょうはけっこうつかれました。", "chinese": "今天相當累。"}, "quality_score": "curated"},
    460: {"meaning": "行動、行為", "example": {"japanese": "早めに行動することが大切です。", "reading": "はやめにこうどうすることがたいせつです。", "chinese": "及早行動是很重要的。"}, "quality_score": "curated"},
    465: {"meaning": "歷史", "example": {"japanese": "日本の歴史を勉強しています。", "reading": "にほんのれきしをべんきょうしています。", "chinese": "正在學習日本歷史。"}, "quality_score": "curated"},
    471: {"meaning": "蠢的、笨的；傻瓜", "example": {"japanese": "そんな馬鹿なことをしないでください。", "reading": "そんなばかなことをしないでください。", "chinese": "請不要做那麼蠢的事。"}, "quality_score": "curated"},
    473: {"meaning": "一部分、部分", "example": {"japanese": "この事実は一部の人しか知りません。", "reading": "このじじつはいちぶのひとしかしりません。", "chinese": "這個事實只有部分人知道。"}, "quality_score": "curated"},
    474: {"meaning": "其實、說實在的", "example": {"japanese": "実は、彼女が好きです。", "reading": "じつは、かのじょがすきです。", "chinese": "其實，我喜歡她。"}, "quality_score": "curated"},
    475: {"meaning": "最終、最後的", "example": {"japanese": "最終決定は明日です。", "reading": "さいしゅうけっていはあしたです。", "chinese": "最終決定是明天。"}, "quality_score": "curated"},
    476: {"meaning": "樂趣、期待", "example": {"japanese": "旅行がとても楽しみです。", "reading": "りょこうがとてもたのしみです。", "chinese": "非常期待旅行。"}, "quality_score": "curated"},
    477: {"meaning": "海外、國外", "example": {"japanese": "来年、海外留学をする予定です。", "reading": "らいねん、かいがいりゅうがくをするよていです。", "chinese": "計畫明年出國留學。"}, "quality_score": "curated"},
    480: {"meaning": "警察", "example": {"japanese": "事故があって警察が来ました。", "reading": "じこがあってけいさつがきました。", "chinese": "發生事故後警察來了。"}, "quality_score": "curated"},
    481: {"meaning": "追加、增加", "example": {"japanese": "注文に料理を追加しました。", "reading": "ちゅうもんにりょうりをついかしました。", "chinese": "在訂單上追加了料理。"}, "quality_score": "curated"},
    483: {"meaning": "相關、關聯", "example": {"japanese": "これは仕事に関連した資料です。", "reading": "これはしごとにかんれんしたしりょうです。", "chinese": "這是與工作相關的資料。"}, "quality_score": "curated"},
    484: {"meaning": "叫做…、所謂…（口語）", "example": {"japanese": "これって何っていう花ですか。", "reading": "これってなんっていうはなですか。", "chinese": "這叫什麼花呢？"}, "quality_score": "curated"},
    486: {"meaning": "服務；免費贈品", "example": {"japanese": "このホテルのサービスは最高です。", "reading": "このホテルのサービスはさいこうです。", "chinese": "這家飯店的服務很棒。"}, "quality_score": "curated"},
    488: {"meaning": "全國", "example": {"japanese": "全国から参加者が集まりました。", "reading": "ぜんこくからさんかしゃがあつまりました。", "chinese": "全國各地的參加者聚集了。"}, "quality_score": "curated"},
    489: {"meaning": "希望、願望", "example": {"japanese": "医者になる希望があります。", "reading": "いしゃになるきぼうがあります。", "chinese": "有成為醫生的願望。"}, "quality_score": "curated"},
    490: {"meaning": "可怕的、恐怖的", "example": {"japanese": "その映画はとても怖かったです。", "reading": "そのえいがはとてもこわかったです。", "chinese": "那部電影非常恐怖。"}, "quality_score": "curated"},
    491: {"meaning": "教育", "example": {"japanese": "子供の教育はとても大切です。", "reading": "こどものきょういくはとてもたいせつです。", "chinese": "孩子的教育非常重要。"}, "quality_score": "curated"},
    492: {"meaning": "特別的、特殊的", "example": {"japanese": "今日は特別な日です。", "reading": "きょうはとくべつなひです。", "chinese": "今天是特別的一天。"}, "quality_score": "curated"},
    493: {"meaning": "節目（廣播、電視）", "example": {"japanese": "好きな番組が始まりました。", "reading": "すきなばんぐみがはじまりました。", "chinese": "喜歡的節目開始了。"}, "quality_score": "curated"},
    495: {"meaning": "有趣的、好玩的", "example": {"japanese": "この本はとても面白いです。", "reading": "このほんはとてもおもしろいです。", "chinese": "這本書非常有趣。"}, "quality_score": "curated"},
    498: {"meaning": "之後、那之後", "example": {"japanese": "その後、どうなりましたか。", "reading": "そのご、どうなりましたか。", "chinese": "那之後怎麼樣了？"}, "quality_score": "curated"},
    501: {"meaning": "事故、意外", "example": {"japanese": "道路で事故がありました。", "reading": "どうろでじこがありました。", "chinese": "路上發生了事故。"}, "quality_score": "curated"},
    503: {"meaning": "完全不…（接否定）；非常（口語肯定）", "example": {"japanese": "全然わかりません。", "reading": "ぜんぜんわかりません。", "chinese": "完全不懂。"}, "quality_score": "curated"},
    504: {"meaning": "千、1000", "example": {"japanese": "千円札を持っています。", "reading": "せんえんさつをもっています。", "chinese": "身上帶著千元紙鈔。"}, "quality_score": "curated"},
    509: {"meaning": "是的、對（比はい稍正式或驚訝）", "example": {"japanese": "ええ、そうです。", "reading": "ええ、そうです。", "chinese": "是的，沒錯。"}, "quality_score": "curated"},
    517: {"meaning": "專業、專門領域", "example": {"japanese": "彼の専門は医学です。", "reading": "かれのせんもんはいがくです。", "chinese": "他的專業是醫學。"}, "quality_score": "curated"},
    520: {"meaning": "影像、畫面", "example": {"japanese": "テレビで映像を見ました。", "reading": "テレビでえいぞうをみました。", "chinese": "在電視上看了影像。"}, "quality_score": "curated"},
    523: {"meaning": "發現", "example": {"japanese": "新しい星が発見されました。", "reading": "あたらしいほしがはっけんされました。", "chinese": "發現了新星。"}, "quality_score": "curated"},
    525: {"meaning": "給予（与える的連用形）", "example": {"japanese": "子供に良い教育を与えたいです。", "reading": "こどもによいきょういくをあたえたいです。", "chinese": "想給孩子良好的教育。"}, "quality_score": "curated"},
    526: {"meaning": "主義、信念", "example": {"japanese": "彼は平和主義者です。", "reading": "かれはへいわしゅぎしゃです。", "chinese": "他是和平主義者。"}, "quality_score": "curated"},
    527: {"meaning": "演出、出演", "example": {"japanese": "有名な俳優が出演しました。", "reading": "ゆうめいなはいゆうがしゅつえんしました。", "chinese": "著名演員出演了。"}, "quality_score": "curated"},
    529: {"meaning": "最大的、最大限度", "example": {"japanese": "これが最大の問題です。", "reading": "これがさいだいのもんだいです。", "chinese": "這是最大的問題。"}, "quality_score": "curated"},
    532: {"meaning": "各種各樣的、許多", "example": {"japanese": "色々な食べ物を試しました。", "reading": "いろいろなたべものをためしました。", "chinese": "嘗試了各種食物。"}, "quality_score": "curated"},
    533: {"meaning": "笑點（故事的妙點）；落下（落ちる的連用形）", "example": {"japanese": "その話の落ちが面白かったです。", "reading": "そのはなしのおちがおもしろかったです。", "chinese": "那個故事的笑點很有趣。"}, "quality_score": "curated"},
    536: {"meaning": "今年", "example": {"japanese": "今年は新しいことを始めます。", "reading": "ことしはあたらしいことをはじめます。", "chinese": "今年要開始做新的事情。"}, "quality_score": "curated"},
    540: {"meaning": "合約、契約", "example": {"japanese": "新しい契約を結びました。", "reading": "あたらしいけいやくをむすびました。", "chinese": "簽訂了新合約。"}, "quality_score": "curated"},
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

#!/usr/bin/env python3
"""Apply batch 3 corrections to T1 template sentences (entries 101-155)."""
import json, sys

CORRECTIONS = {
    623: {"meaning": "答案、回答", "example": {"japanese": "テストの答えを書きました。", "reading": "テストのこたえをかきました。", "chinese": "在考卷上寫了答案。"}, "quality_score": "curated"},
    628: {"meaning": "現在、剛才（今的讀法）", "example": {"japanese": "いまどこにいますか。", "reading": "いまどこにいますか。", "chinese": "你現在在哪裡？"}, "quality_score": "curated"},
    629: {"meaning": "放置、擺放；預先做好（〜ておく）", "example": {"japanese": "荷物をここに置いておきます。", "reading": "にもつをここにおいておきます。", "chinese": "把行李放在這裡。"}, "quality_score": "verb_curated"},
    634: {"meaning": "中心、核心", "example": {"japanese": "東京は日本の中心です。", "reading": "とうきょうはにほんのちゅうしんです。", "chinese": "東京是日本的中心。"}, "quality_score": "curated"},
    636: {"meaning": "比例、割；割り算（除法）", "example": {"japanese": "割り勘にしましょう。", "reading": "わりかんにしましょう。", "chinese": "我們各付各的吧。"}, "quality_score": "curated"},
    646: {"meaning": "運營、管理", "example": {"japanese": "このサイトの運営は大変です。", "reading": "このサイトのうんえいはたいへんです。", "chinese": "這個網站的運營很辛苦。"}, "quality_score": "curated"},
    653: {"meaning": "營業、業務", "example": {"japanese": "このお店は24時間営業しています。", "reading": "このおみせはにじゅうよじかんえいぎょうしています。", "chinese": "這家店24小時營業。"}, "quality_score": "curated"},
    664: {"meaning": "材料、話題；笑料（口語）", "example": {"japanese": "そのねたは面白いですね。", "reading": "そのねたはおもしろいですね。", "chinese": "那個梗真有趣。"}, "quality_score": "curated"},
    670: {"meaning": "大會、賽事", "example": {"japanese": "水泳大会に出場しました。", "reading": "すいえいたいかいにしゅつじょうしました。", "chinese": "參加了游泳比賽。"}, "quality_score": "curated"},
    675: {"meaning": "記憶、回憶", "example": {"japanese": "子供の頃の記憶は薄いです。", "reading": "こどものころのきおくはうすいです。", "chinese": "小時候的記憶很模糊。"}, "quality_score": "curated"},
    679: {"meaning": "勞動、工作", "example": {"japanese": "労働時間が長すぎます。", "reading": "ろうどうじかんがながすぎます。", "chinese": "工作時間太長了。"}, "quality_score": "curated"},
    688: {"meaning": "上升、增加；上傳（英語up的借詞）", "example": {"japanese": "給料がアップしました。", "reading": "きゅうりょうがアップしました。", "chinese": "薪水提升了。"}, "quality_score": "curated"},
    689: {"meaning": "癌症；槍（英語gun的借詞）", "example": {"japanese": "ガンの早期発見が大切です。", "reading": "ガンのそうきはっけんがたいせつです。", "chinese": "癌症的早期發現很重要。"}, "quality_score": "curated"},
    690: {"meaning": "電視劇、戲劇", "example": {"japanese": "毎週このドラマを見ています。", "reading": "まいしゅうこのドラマをみています。", "chinese": "每週都在看這部電視劇。"}, "quality_score": "curated"},
    691: {"meaning": "預約、預訂", "example": {"japanese": "レストランを予約しました。", "reading": "レストランをよやくしました。", "chinese": "預約了餐廳。"}, "quality_score": "curated"},
    697: {"meaning": "日語、日本語", "example": {"japanese": "日本語を毎日練習しています。", "reading": "にほんごをまいにちれんしゅうしています。", "chinese": "每天練習日語。"}, "quality_score": "curated"},
    698: {"meaning": "本人、當事人", "example": {"japanese": "本人が直接来てください。", "reading": "ほんにんがちょくせつきてください。", "chinese": "請本人親自來。"}, "quality_score": "curated"},
    706: {"meaning": "很多、滿滿的；一杯（一個杯子）", "example": {"japanese": "テーブルに食べ物がいっぱいあります。", "reading": "テーブルにたべものがいっぱいあります。", "chinese": "桌上有好多食物。"}, "quality_score": "curated"},
    707: {"meaning": "收到、得到；請（〜してもらう）", "example": {"japanese": "友達にプレゼントをもらいました。", "reading": "ともだちにプレゼントをもらいました。", "chinese": "從朋友那裡收到了禮物。"}, "quality_score": "verb_curated"},
    710: {"meaning": "京都（日本古都）", "example": {"japanese": "京都で古いお寺を見ました。", "reading": "きょうとでふるいおてらをみました。", "chinese": "在京都參觀了古老的寺廟。"}, "quality_score": "curated"},
    714: {"meaning": "地球", "example": {"japanese": "地球温暖化が問題になっています。", "reading": "ちきゅうおんだんかがもんだいになっています。", "chinese": "地球暖化成了一大問題。"}, "quality_score": "curated"},
    715: {"meaning": "實施、執行", "example": {"japanese": "新しい制度が実施されました。", "reading": "あたらしいせいどがじっしされました。", "chinese": "新制度被實施了。"}, "quality_score": "curated"},
    719: {"meaning": "哎？咦？（表驚訝的感動詞）", "example": {"japanese": "えっ、本当ですか。", "reading": "えっ、ほんとうですか。", "chinese": "哎？是真的嗎？"}, "quality_score": "curated"},
    721: {"meaning": "（關西方言）不是嗎、じゃないか", "example": {"japanese": "そんなこと知らんやん。", "reading": "そんなことしらんやん。", "chinese": "那種事我才不知道呢。"}, "quality_score": "curated"},
    722: {"meaning": "好！行了！（表決心或同意的感動詞）", "example": {"japanese": "よし、がんばろう！", "reading": "よし、がんばろう！", "chinese": "好！加油！"}, "quality_score": "curated"},
    725: {"meaning": "ン（片假名字母；口語「の」的縮略）", "example": {"japanese": "どんな気持ちだったん？", "reading": "どんなきもちだったん？", "chinese": "當時是什麼感覺呢？"}, "quality_score": "curated"},
    726: {"meaning": "人們、眾人", "example": {"japanese": "人々が広場に集まりました。", "reading": "ひとびとがひろばにあつまりました。", "chinese": "人們聚集在廣場上。"}, "quality_score": "curated"},
    730: {"meaning": "國民、人民", "example": {"japanese": "国民の意見を尊重します。", "reading": "こくみんのいけんをそんちょうします。", "chinese": "尊重國民的意見。"}, "quality_score": "curated"},
    731: {"meaning": "總統", "example": {"japanese": "アメリカ大統領が来日しました。", "reading": "アメリカだいとうりょうがらいにちしました。", "chinese": "美國總統訪問了日本。"}, "quality_score": "curated"},
    734: {"meaning": "少女、女孩", "example": {"japanese": "その少女は花を持っていました。", "reading": "そのしょうじょははなをもっていました。", "chinese": "那個少女手持著花。"}, "quality_score": "curated"},
    739: {"meaning": "花費（時間・金錢）；掛、懸掛", "example": {"japanese": "駅まで10分かかります。", "reading": "えきまでじゅっぷんかかります。", "chinese": "到車站需要10分鐘。"}, "quality_score": "verb_curated"},
    745: {"meaning": "取（取る・取って的縮略形）", "example": {"japanese": "棚から本を取って読みました。", "reading": "たなからほんをとってよみました。", "chinese": "從書架上拿出書來讀了。"}, "quality_score": "curated"},
    746: {"meaning": "合在一起、配合；調整", "example": {"japanese": "時間を合わせて会いましょう。", "reading": "じかんをあわせてあいましょう。", "chinese": "調整時間見個面吧。"}, "quality_score": "curated"},
    747: {"meaning": "兒子", "example": {"japanese": "息子は今年大学に入りました。", "reading": "むすこはことしだいがくにはいりました。", "chinese": "兒子今年考上了大學。"}, "quality_score": "curated"},
    750: {"meaning": "消費、消耗", "example": {"japanese": "電力の消費を減らす努力をしています。", "reading": "でんりょくのしょうひをへらすどりょくをしています。", "chinese": "正在努力減少電力消耗。"}, "quality_score": "curated"},
    756: {"meaning": "讀法；讀音；閱讀", "example": {"japanese": "この漢字の読みがわかりません。", "reading": "このかんじのよみがわかりません。", "chinese": "不知道這個漢字的讀法。"}, "quality_score": "curated"},
    758: {"meaning": "通常、平常", "example": {"japanese": "通常は朝6時に起きます。", "reading": "つうじょうはあさろくじにおきます。", "chinese": "通常早上6點起床。"}, "quality_score": "curated"},
    761: {"meaning": "…來著？（確認或回憶的語氣助詞）", "example": {"japanese": "彼の名前は何だったっけ。", "reading": "かれのなまえはなんだったっけ。", "chinese": "他的名字是什麼來著？"}, "quality_score": "curated"},
    762: {"meaning": "或者、或是（書面語連接詞）", "example": {"japanese": "電話またはメールで連絡してください。", "reading": "でんわまたはメールでれんらくしてください。", "chinese": "請用電話或電子郵件聯絡。"}, "quality_score": "curated"},
    763: {"meaning": "哎呀！唉！（感嘆詞，表驚嘆或無奈）", "example": {"japanese": "やれやれ、また遅刻した。", "reading": "やれやれ、またちこくした。", "chinese": "哎呀，又遲到了。"}, "quality_score": "curated"},
    764: {"meaning": "停留、順道去；靠近（よる有多種意思）", "example": {"japanese": "帰りにコンビニに寄ります。", "reading": "かえりにコンビニによります。", "chinese": "回家途中順道去便利商店。"}, "quality_score": "verb_curated"},
    766: {"meaning": "性別；性行為（英語sex的借詞）", "example": {"japanese": "性教育ではセックスについて学びます。", "reading": "せいきょういくではセックスについてまなびます。", "chinese": "性教育中會學習有關性的知識。"}, "quality_score": "curated"},
    769: {"meaning": "ヽ（片假名重複符號）", "example": {"japanese": "ヽは繰り返しを表す記号です。", "reading": "ヽはくりかえしをあらわすきごうです。", "chinese": "ヽ是表示重複的符號。"}, "quality_score": "curated"},
    770: {"meaning": "作業、工作、操作", "example": {"japanese": "今日の作業はもうすぐ終わります。", "reading": "きょうのさぎょうはもうすぐおわります。", "chinese": "今天的工作快要完成了。"}, "quality_score": "curated"},
    771: {"meaning": "國家", "example": {"japanese": "国家の安全を守るのは大切です。", "reading": "こっかのあんぜんをまもるのはたいせつです。", "chinese": "維護國家安全很重要。"}, "quality_score": "curated"},
    772: {"meaning": "多數、大量", "example": {"japanese": "多数の人が会場に集まりました。", "reading": "たすうのひとがかいじょうにあつまりました。", "chinese": "大批人群聚集在會場。"}, "quality_score": "curated"},
    775: {"meaning": "祭典、節慶", "example": {"japanese": "夏祭りでゆかたを着ました。", "reading": "なつまつりでゆかたをきました。", "chinese": "在夏日祭典上穿了浴衣。"}, "quality_score": "curated"},
    779: {"meaning": "乳房（口語）；母乳", "example": {"japanese": "赤ちゃんはおっぱいをよく飲みます。", "reading": "あかちゃんはおっぱいをよくのみます。", "chinese": "嬰兒經常吃母乳。"}, "quality_score": "curated"},
    780: {"meaning": "…的樣子、…的方式；隔了…（久違的）", "example": {"japanese": "三年ぶりに友達に会いました。", "reading": "さんねんぶりにともだちにあいました。", "chinese": "睽違三年再次見到了朋友。"}, "quality_score": "curated"},
    783: {"meaning": "方法、方式；辦法", "example": {"japanese": "仕方がないので諦めました。", "reading": "しかたがないのであきらめました。", "chinese": "沒有辦法，只好放棄了。"}, "quality_score": "curated"},
    786: {"meaning": "限制、制約", "example": {"japanese": "スピード制限を守って運転してください。", "reading": "スピードせいげんをまもってうんてんしてください。", "chinese": "請遵守速度限制駕駛。"}, "quality_score": "curated"},
    790: {"meaning": "完成、完工", "example": {"japanese": "作文が完成しました。", "reading": "さくぶんがかんせいしました。", "chinese": "作文完成了。"}, "quality_score": "curated"},
    806: {"meaning": "大量、大批", "example": {"japanese": "大量のゴミが出ました。", "reading": "たいりょうのゴミがでました。", "chinese": "產生了大量垃圾。"}, "quality_score": "curated"},
    807: {"meaning": "委員", "example": {"japanese": "彼は学級委員に選ばれました。", "reading": "かれはがっきゅういいんにえらばれました。", "chinese": "他被選為班級委員。"}, "quality_score": "curated"},
    816: {"meaning": "魔法、魔術", "example": {"japanese": "魔法使いが出てくる映画が好きです。", "reading": "まほうつかいがでてくるえいががすきです。", "chinese": "喜歡有魔法師出場的電影。"}, "quality_score": "curated"},
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

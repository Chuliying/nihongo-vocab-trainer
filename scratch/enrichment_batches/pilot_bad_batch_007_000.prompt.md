# Vocabulary enrichment batch pilot_bad_batch_007_000

Rewrite each JSONL row into one output JSON object per line.

Goal:
- Make the Traditional Chinese meaning accurate.
- Make the Japanese example natural, realistic, and usable by a Japanese speaker.
- Keep the Japanese grammar around JLPT N4/N5 level whenever the word allows it.

Rules:
- Preserve `id` exactly. Do not add, remove, or reorder ids.
- Use `quality_issues` to decide what to fix.
- If only the meaning is bad and the existing example is natural and uses the target word correctly, you may keep the example.
- If `missing_target_word` or `low_value_example` is present, rewrite the example.
- Return Traditional Chinese in `meaning` and `example.chinese`.
- Keep `meaning` concise: usually 1-4 Traditional Chinese glosses separated by `、`.
- Do not copy English glosses into Traditional Chinese fields.
- Do not use placeholder meanings such as `名詞概念`, `文法形式`, `副詞用法`, or `需人工確認`.
- The Japanese example must naturally use the target word, not talk about the word itself.
- Avoid meta examples like `日本語でXの意味を理解しました`, `Xについて話しました`, `Xを使うことがあります`, or `Xの例文を作りました`.
- Keep examples beginner/intermediate friendly unless the word itself is advanced.
- `example.reading` should be the kana reading of the Japanese sentence, preserving katakana loanwords where natural.

Output schema per line:
```json
{"id":1,"meaning":"...","example":{"japanese":"...","reading":"...","chinese":"..."}}
```

Input JSONL:
```jsonl
{"id":1189,"word":"お話","reading":"おはなし","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"図書館で気になっていた本をやっと見つけました。","reading":"としょかんできになっていたほんをやっとみつけました。","chinese":"在圖書館終於找到了一直在找的書。"},"gloss_en":["story","tale","talk","discussion"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1190,"word":"かね","reading":"かね","part_of_speech":"助詞","jlpt_level":"N4","meaning":"表疑問或遲疑的句尾助詞","example":{"japanese":"来週のバイトのシフトを店長に提出しました。","reading":"らいしゅうのばいとのしふとをてんちょうにていしゅつしました。","chinese":"向店長提交了下週打工的班表。"},"gloss_en":["interrogative sentence-ending particle expressing doubt"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1191,"word":"それら","reading":"それら","part_of_speech":"名詞・代名詞","jlpt_level":"N4","meaning":"那些","example":{"japanese":"授業中はいつも先生の話をよく聞いています。","reading":"じゅぎょうちゅうはいつもせんせいのはなしをよくきいています。","chinese":"上課時總是認真聽老師講課。"},"gloss_en":["those","they"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1192,"word":"ちょうど","reading":"ちょうど","part_of_speech":"名詞","jlpt_level":"N4","meaning":"使用、利用","example":{"japanese":"週末は映画を見ながら、のんびりと過ごしました。","reading":"しゅうまつはえいがをみながら、のんびりとすごしました。","chinese":"週末一邊看電影，一邊悠閒地度過。"},"gloss_en":["household items","furniture","furnishings","fixtures"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1201,"word":"ベッド","reading":"ベッド","part_of_speech":"名詞","jlpt_level":"N4","meaning":"床","example":{"japanese":"毎朝コーヒーを飲んでから仕事を始めるのが日課です。","reading":"まいあさこーひーをのんでからしごとをはじめるのがにっかです。","chinese":"每天早上喝完咖啡再開始工作是我的日常慣例。"},"gloss_en":["bed"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1202,"word":"ラーメン","reading":"ラーメン","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"新しいカメラで旅行先の写真をたくさん撮りました。","reading":"あたらしいかめらでりょこうさきのしゃしんをたくさんとりました。","chinese":"用新相機在旅遊地拍了很多照片。"},"gloss_en":["rigid frame"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
{"id":1203,"word":"一体","reading":"いったい","part_of_speech":"副詞・名詞","jlpt_level":"N4","meaning":"一體","example":{"japanese":"同僚とランチを食べながら、仕事のことを話しました。","reading":"どうりょうとらんちをたべながら、しごとのことをはなしました。","chinese":"和同事一邊吃午餐，一邊聊工作的事。"},"gloss_en":["(what) the heck","(why) in the world","(who) on earth","(where) the hell"],"quality_issues":["missing_target_word"]}
{"id":1204,"word":"午後","reading":"ごご","part_of_speech":"名詞・副詞","jlpt_level":"N4","meaning":"之後","example":{"japanese":"今年は記録的な寒い冬で、雪が多かったです。","reading":"ことしはきろくてきなさむいふゆで、ゆきがおおかったです。","chinese":"今年是創紀錄的寒冬，雪下得很多。"},"gloss_en":["afternoon","p.m."],"quality_issues":["missing_target_word"]}
{"id":1205,"word":"基地","reading":"きち","part_of_speech":"名詞","jlpt_level":"N4","meaning":"男人、男性、基礎、基地","example":{"japanese":"テストが終わった後、友達と一緒にゲームをして遊びました。","reading":"てすとがおわったあと、ともだちといっしょにげーむをしてあそびました。","chinese":"考完試之後，和朋友一起玩了遊戲。"},"gloss_en":["base (military, expedition, etc.)","enthusiast","maniac","fanatic"],"quality_issues":["missing_target_word"]}
{"id":1206,"word":"声優","reading":"せいゆう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"聲優","example":{"japanese":"このパソコンは古いので、動作がとても遅いです。","reading":"このぱそこんはふるいので、どうさがとてもおそいです。","chinese":"這台電腦因為很舊，所以運作非常慢。"},"gloss_en":["voice actor or actress (radio, animation, etc.)"],"quality_issues":["missing_target_word"]}
{"id":1207,"word":"女優","reading":"じょゆう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"昨日は早めに寝たので、今日はすっきり目が覚めました。","reading":"きのうははやめにねたので、きょうはすっきりめがさめました。","chinese":"昨天早早睡覺，所以今天醒來神清氣爽。"},"gloss_en":["actress","female actor"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1208,"word":"扱い","reading":"あつかい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"手、治療、處理","example":{"japanese":"家の近くに二十四時間開いているコンビニがあります。","reading":"いえのちかくににじゅうよじかんあいているこんびにがあります。","chinese":"家附近有二十四小時開著的便利商店。"},"gloss_en":["treatment","service","dealing (with)","handling"],"quality_issues":["missing_target_word"]}
{"id":1209,"word":"支持","reading":"しじ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"支持、支援","example":{"japanese":"このレストランはランチが千円以内でおいしいです。","reading":"このれすとらんはらんちがせんえんいないでおいしいです。","chinese":"這家餐廳的午餐一千日圓以內就很好吃。"},"gloss_en":["support","backing","endorsement","approval"],"quality_issues":["missing_target_word"]}
{"id":1210,"word":"教授","reading":"きょうじゅ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"今日のアルバイトは立ち仕事で、足がとても疲れました。","reading":"きょうのあるばいとはたちしごとで、あしがとてもつかれました。","chinese":"今天打工是站著的工作，腳非常疲憊。"},"gloss_en":["professor","teaching","instruction"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1211,"word":"昭和","reading":"しょうわ","part_of_speech":"名詞・形容動詞","jlpt_level":"N4","meaning":"動作、行為","example":{"japanese":"この本を読み終わったら、貸してあげます。","reading":"このほんをよみおわったら、かしてあげます。","chinese":"這本書讀完後會借給你。"},"gloss_en":["Shōwa era (1926.12.25-1989.1.7)","reminiscent of the Shōwa era","Shōwa-nostalgic","old-fashioned"],"quality_issues":["missing_target_word"]}
{"id":1212,"word":"本来","reading":"ほんらい","part_of_speech":"副詞・名詞・助詞","jlpt_level":"N4","meaning":"本來","example":{"japanese":"週末に部屋をきれいに掃除しました。","reading":"しゅうまつにへやをきれいにそうじしました。","chinese":"週末把房間打掃得很乾淨。"},"gloss_en":["originally","primarily","essentially","intrinsically"],"quality_issues":["missing_target_word"]}
{"id":1213,"word":"残り","reading":"のこり","part_of_speech":"名詞・助詞","jlpt_level":"N4","meaning":"殘り","example":{"japanese":"駅の近くに新しいビルが建てられました。","reading":"えきのちかくにあたらしいびるがたてられました。","chinese":"車站附近蓋了一棟新大樓。"},"gloss_en":["remainder","remnant","the rest","what is left"],"quality_issues":["missing_target_word"]}
{"id":1214,"word":"注目","reading":"ちゅうもく","part_of_speech":"名詞","jlpt_level":"N4","meaning":"通知、注意","example":{"japanese":"今日の天気予報では、午後から雨が降るそうです。","reading":"きょうのてんきよほうでは、ごごからあめがふるそうです。","chinese":"今天的天氣預報說，下午開始會下雨。"},"gloss_en":["notice","attention","observation"],"quality_issues":["missing_target_word"]}
{"id":1215,"word":"無事","reading":"ぶじ","part_of_speech":"名詞・形容動詞・副詞","jlpt_level":"N4","meaning":"無事、安全、安全保障","example":{"japanese":"久しぶりに会った友達と、カフェでたくさん話しました。","reading":"ひさしぶりにあったともだちと、かふぇでたくさんはなしました。","chinese":"和久違見面的朋友在咖啡廳聊了很多。"},"gloss_en":["safety","security","peace","quiet"],"quality_issues":["missing_target_word"]}
{"id":1216,"word":"異常","reading":"いじょう","part_of_speech":"名詞・形容動詞","jlpt_level":"N4","meaning":"普通、一般","example":{"japanese":"授業の後、図書館でレポートを書きました。","reading":"じゅぎょうのあと、としょかんでれぽーとをかきました。","chinese":"課後在圖書館寫了報告。"},"gloss_en":["abnormal","unusual","extraordinary","remarkable"],"quality_issues":["missing_target_word"]}
```

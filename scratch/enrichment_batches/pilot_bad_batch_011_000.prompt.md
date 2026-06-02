# Vocabulary enrichment batch pilot_bad_batch_011_000

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
{"id":1316,"word":"モノ","reading":"モノ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"彼女はいつもかわいいモノを持っています。","reading":"かのじょはいつもかわいいものをもっています。","chinese":"她總是帶著可愛的東西。"},"gloss_en":["mono"],"quality_issues":["meaning_placeholder","stale_llm_source"]}
{"id":1319,"word":"分析","reading":"ぶんせき","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"データを分析した結果、新しい傾向が見えてきました。","reading":"でーたをぶんせきしたけっか、あたらしいけいこうがみえてきました。","chinese":"分析了數據後，發現了新的趨勢。"},"gloss_en":["analysis"],"quality_issues":["meaning_placeholder"]}
{"id":1321,"word":"千葉","reading":"ちば","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"千葉県は東京の近くにある有名な県です。","reading":"ちばけんはとうきょうのちかくにあるゆうめいなけんです。","chinese":"千葉縣是位於東京附近的著名縣份。"},"gloss_en":["Chiba (city, prefecture)"],"quality_issues":["meaning_placeholder"]}
{"id":1324,"word":"強化","reading":"きょうか","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"チームの守備を強化するために、練習を増やしました。","reading":"ちーむのしゅびをきょうかするために、れんしゅうをふやしました。","chinese":"為了加強隊伍的防守，增加了練習量。"},"gloss_en":["strengthening","intensifying","reinforcement","enhancement"],"quality_issues":["meaning_placeholder"]}
{"id":1326,"word":"感染","reading":"かんせん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"風邪が感染しないように、手洗いをしっかりしています。","reading":"かぜがかんせんしないように、てあらいをしっかりしています。","chinese":"為了不被感冒傳染，認真地洗手。"},"gloss_en":["infection","contagion","becoming infected","being infected (e.g. with harmful ideas)"],"quality_issues":["meaning_placeholder"]}
{"id":1330,"word":"深夜","reading":"しんや","part_of_speech":"名詞・副詞","jlpt_level":"N4","meaning":"副詞用法","example":{"japanese":"深夜に電話が来て、びっくりしました。","reading":"しんやにでんわがきて、びっくりしました。","chinese":"深夜接到電話，嚇了一跳。"},"gloss_en":["late at night"],"quality_issues":["meaning_placeholder"]}
{"id":1333,"word":"範囲","reading":"はんい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"試験の範囲は第一章から第三章までです。","reading":"しけんのはんいはだいいっしょうからだいさんしょうまでです。","chinese":"考試的範圍是第一章到第三章。"},"gloss_en":["extent","scope","sphere","range"],"quality_issues":["meaning_placeholder"]}
{"id":1336,"word":"自殺","reading":"じさつ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"友達が突然自殺したというニュースに衝撃を受けました。","reading":"ともだちがとつぜんじさつしたというにゅーすにしょうげきをうけました。","chinese":"聽到朋友突然自殺的消息，受到了衝擊。"},"gloss_en":["suicide"],"quality_issues":["meaning_placeholder"]}
{"id":1339,"word":"達成","reading":"たっせい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"目標を達成したとき、とてもうれしかったです。","reading":"もくひょうをたっせいしたとき、とてもうれしかったです。","chinese":"達成目標的時候，非常高興。"},"gloss_en":["achievement","attainment","accomplishment","realization"],"quality_issues":["meaning_placeholder"]}
{"id":1340,"word":"関西","reading":"かんさい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"関西地方には美味しい食べ物がたくさんあります。","reading":"かんさいちほうにはおいしいたべものがたくさんあります。","chinese":"關西地區有很多美食。"},"gloss_en":["Kansai (region comprising Kyoto, Osaka, Kobe and surrounding prefectures)","Kansai (western half of Japan; during the feudal era)"],"quality_issues":["meaning_placeholder"]}
{"id":1344,"word":"とく","reading":"とく","part_of_speech":"助動詞・動詞","jlpt_level":"N4","meaning":"先做好、預先做","example":{"japanese":"夕飯の準備をしておいて、後で食べました。","reading":"ゆうはんのじゅんびをしておいて、あとでたべました。","chinese":"先把晚飯準備好，之後再吃。"},"gloss_en":["to do something in readiness for","to get something (needful) done"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1345,"word":"もう少し","reading":"もうすこし","part_of_speech":"表現","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"もう少し待ってもらえますか？","reading":"もうすこしまってもらえますか？","chinese":"可以再等一下嗎？"},"gloss_en":["a bit more","a bit longer"],"quality_issues":["meaning_placeholder"]}
{"id":1355,"word":"ビール","reading":"ビール","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"暑い日はビールが飲みたくなります。","reading":"あついひはびーるがのみたくなります。","chinese":"在炎熱的日子裡很想喝啤酒。"},"gloss_en":["beer"],"quality_issues":["meaning_placeholder","stale_llm_source"]}
{"id":1358,"word":"出身","reading":"しゅっしん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"彼はどこの出身ですか？","reading":"かれはどこのしゅっしんですか？","chinese":"他是哪裡人？"},"gloss_en":["one's origin (e.g. city, country, parentage, school)"],"quality_issues":["meaning_placeholder"]}
{"id":1361,"word":"収入","reading":"しゅうにゅう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"今月の収入が先月より少なかったです。","reading":"こんげつのしゅうにゅうがせんげつよりすくなかったです。","chinese":"這個月的收入比上個月少。"},"gloss_en":["income","earnings","revenue","proceeds"],"quality_issues":["meaning_placeholder"]}
{"id":1362,"word":"投資","reading":"とうし","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"店長が新しいアルバイトに仕事を説明しています。","reading":"てんちょうがあたらしいあるばいとにしごとをせつめいしています。","chinese":"店長正在向新來的打工人員說明工作。"},"gloss_en":["investment"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1363,"word":"拡大","reading":"かくだい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"擴大、擴張","example":{"japanese":"彼女の意見はとても的確でした。","reading":"かのじょのいけんはとてもてきかくでした。","chinese":"她的意見非常準確。"},"gloss_en":["expansion","extension","magnification","enlargement"],"quality_issues":["missing_target_word"]}
{"id":1364,"word":"改善","reading":"かいぜん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"仕事で失敗したので、上司に謝りました。","reading":"しごとでしっぱいしたので、じょうしにあやまりました。","chinese":"工作上失敗了，所以向上司道歉了。"},"gloss_en":["betterment","improvement","kaizen (Japanese business philosophy of continuous improvement)"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1365,"word":"暮らし","reading":"くらし","part_of_speech":"名詞","jlpt_level":"N4","meaning":"生活、人生","example":{"japanese":"この事件の真相は今でもわかっていません。","reading":"このじけんのしんそうはいまでもわかっていません。","chinese":"這起事件的真相至今仍不清楚。"},"gloss_en":["(way of) life","lifestyle","living","life circumstances"],"quality_issues":["missing_target_word"]}
{"id":1366,"word":"最低","reading":"さいてい","part_of_speech":"名詞・助詞・形容動詞","jlpt_level":"N4","meaning":"我們","example":{"japanese":"家族と一緒に晩ご飯を食べました。","reading":"かぞくといっしょにばんごはんをたべました。","chinese":"和家人一起吃了晚飯。"},"gloss_en":["least","lowest","minimum","worst"],"quality_issues":["missing_target_word"]}
```

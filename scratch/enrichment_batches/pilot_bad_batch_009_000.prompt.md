# Vocabulary enrichment batch pilot_bad_batch_009_000

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
{"id":1259,"word":"固定","reading":"こてい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"戒指、環","example":{"japanese":"この地域の人口は年々減っています。","reading":"このちいきのじんこうはねんねんへっています。","chinese":"這個地區的人口每年都在減少。"},"gloss_en":["fixing (in place)","being fixed (in place)","securing","anchoring"],"quality_issues":["missing_target_word"]}
{"id":1260,"word":"太郎","reading":"たろう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"大切な書類を整理してファイルにまとめました。","reading":"たいせつなしょるいをせいりしてふぁいるにまとめました。","chinese":"把重要的文件整理後歸入檔案夾。"},"gloss_en":["first son"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1262,"word":"学園","reading":"がくえん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"學園、學校","example":{"japanese":"このレストランは予約なしでは入れません。","reading":"このれすとらんはよやくなしではいれません。","chinese":"這家餐廳沒有預約是進不去的。"},"gloss_en":["educational institution","school","academy","campus"],"quality_issues":["missing_target_word"]}
{"id":1264,"word":"将来","reading":"しょうらい","part_of_speech":"名詞・副詞","jlpt_level":"N4","meaning":"將來","example":{"japanese":"彼女の笑顔がとても印象に残りました。","reading":"かのじょのえがおがとてもいんしょうにのこりました。","chinese":"她的笑容讓我印象非常深刻。"},"gloss_en":["future","(future) prospects","bringing (from abroad, another region, etc.)","bringing about"],"quality_issues":["missing_target_word"]}
{"id":1265,"word":"手段","reading":"しゅだん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"方式、方法","example":{"japanese":"仕事が終わった後でジムに通っています。","reading":"しごとがおわったあとでじむにかよっています。","chinese":"工作結束後去健身房鍛鍊。"},"gloss_en":["means","way","measure"],"quality_issues":["missing_target_word"]}
{"id":1266,"word":"指摘","reading":"してき","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"今日は風が強くて、外に出るのが大変でした。","reading":"きょうはかぜがつよくて、そとにでるのがたいへんでした。","chinese":"今天風很大，外出很辛苦。"},"gloss_en":["pointing out","identification"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1267,"word":"授業","reading":"じゅぎょう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"班級、等級、課程、教訓","example":{"japanese":"新しいアパートを探しています。","reading":"あたらしいあぱーとをさがしています。","chinese":"正在找新的公寓。"},"gloss_en":["lesson","class","teaching","instruction"],"quality_issues":["missing_target_word"]}
{"id":1268,"word":"楽天","reading":"らくてん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"この曲はとても人気があります。","reading":"このきょくはとてもにんきがあります。","chinese":"這首歌非常受歡迎。"},"gloss_en":["optimism"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1269,"word":"死に","reading":"しに","part_of_speech":"名詞","jlpt_level":"N4","meaning":"使用、利用、死亡","example":{"japanese":"週末に友達とバーベキューをしました。","reading":"しゅうまつにともだちとばーべきゅーをしました。","chinese":"週末和朋友烤肉了。"},"gloss_en":["dying","death","dead","useless"],"quality_issues":["missing_target_word"]}
{"id":1270,"word":"確保","reading":"かくほ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"戒指、環","example":{"japanese":"彼は毎朝新聞を読む習慣があります。","reading":"かれはまいあさしんぶんをよむしゅうかんがあります。","chinese":"他有每天早上閱讀報紙的習慣。"},"gloss_en":["securing","obtaining","ensuring","guarantee"],"quality_issues":["missing_target_word"]}
{"id":1271,"word":"詳しく","reading":"くわしく","part_of_speech":"副詞","jlpt_level":"N4","meaning":"副詞用法","example":{"japanese":"試験が終わったので、少し休憩しました。","reading":"しけんがおわったので、すこしきゅうけいしました。","chinese":"考試結束了，所以稍微休息了一下。"},"gloss_en":["in detail","fully","minutely","at length"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1272,"word":"返し","reading":"かえし","part_of_speech":"名詞","jlpt_level":"N4","meaning":"返回、歸還","example":{"japanese":"この建物はとても古い歴史があります。","reading":"このたてものはとてもふるいれきしがあります。","chinese":"這棟建築物有非常悠久的歷史。"},"gloss_en":["reversal","return","return gift","return favour"],"quality_issues":["missing_target_word"]}
{"id":1273,"word":"連中","reading":"れんちゅう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"連中、人們","example":{"japanese":"彼女は毎日ピアノを三十分練習しています。","reading":"かのじょはまいにちぴあのをさんじゅっぷんれんしゅうしています。","chinese":"她每天練習三十分鐘鋼琴。"},"gloss_en":["company","lot","people","bunch"],"quality_issues":["missing_target_word"]}
{"id":1274,"word":"開け","reading":"ひらけ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"開始、開頭","example":{"japanese":"旅行の思い出をアルバムにまとめました。","reading":"りょこうのおもいでをあるばむにまとめました。","chinese":"把旅行的回憶整理成相冊。"},"gloss_en":["beginning","start","civilization","civilisation"],"quality_issues":["missing_target_word"]}
{"id":1275,"word":"集団","reading":"しゅうだん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"この映画は世界中で大ヒットしました。","reading":"このえいがはせかいじゅうでおおひっとしました。","chinese":"這部電影在全世界大受歡迎。"},"gloss_en":["group","mass"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1277,"word":"たん","reading":"たん","part_of_speech":"未分類","jlpt_level":"N4","meaning":"使用、利用、結束、結尾","example":{"japanese":"この本は読むたびに新しい発見があります。","reading":"このほんはよむたびにあたらしいはっけんがあります。","chinese":"每次讀這本書都有新的發現。"},"gloss_en":["diminutive used with names, etc.","diminutive adjective ending"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1278,"word":"つき","reading":"つき","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"彼は数学が得意です。","reading":"かれはすうがくがとくいです。","chinese":"他擅長數學。"},"gloss_en":["thrust","stab","lunge","pass (in fencing)"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
{"id":1281,"word":"クリア","reading":"クリア","part_of_speech":"名詞・形容動詞","jlpt_level":"N4","meaning":"清楚、通關","example":{"japanese":"このプロジェクトはとても重要です。","reading":"このぷろじぇくとはとてもじゅうようです。","chinese":"這個專案非常重要。"},"gloss_en":["clear","transparent","clearing (a high-jump bar, hurdle, etc.)","overcoming"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1282,"word":"シングル","reading":"シングル","part_of_speech":"名詞・助詞","jlpt_level":"N4","meaning":"床","example":{"japanese":"駅の前に大きな花屋があります。","reading":"えきのまえにおおきなはなやがあります。","chinese":"車站前面有一家大花店。"},"gloss_en":["single","single bed","hotel room with a single bed","single-breasted"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1283,"word":"フル","reading":"フル","part_of_speech":"名詞・形容動詞","jlpt_level":"N4","meaning":"形容表現:フル","example":{"japanese":"毎日少しずつ日本語が上手になっています。","reading":"まいにちすこしずつにほんごがじょうずになっています。","chinese":"每天一點一點地，日語越來越進步了。"},"gloss_en":["full"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
```

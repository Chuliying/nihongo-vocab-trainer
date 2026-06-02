# Vocabulary enrichment batch pilot_bad_batch_015_000

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
{"id":1429,"word":"交渉","reading":"こうしょう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"彼は今日の会議で重要な発表をしました。","reading":"かれはきょうのかいぎでじゅうようなはっぴょうをしました。","chinese":"他在今天的會議上做了重要的發表。"},"gloss_en":["negotiations","bargaining","discussions","talks"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1430,"word":"住民","reading":"じゅうみん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"最近、睡眠の質を改善しようとしています。","reading":"さいきん、すいみんのしつをかいぜんしようとしています。","chinese":"最近正在嘗試改善睡眠品質。"},"gloss_en":["inhabitant","resident","citizen","population"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1431,"word":"再び","reading":"ふたたび","part_of_speech":"副詞","jlpt_level":"N4","meaning":"時間","example":{"japanese":"彼女は毎週一冊本を読む習慣があります。","reading":"かのじょはまいしゅういっさつほんをよむしゅうかんがあります。","chinese":"她有每週讀一本書的習慣。"},"gloss_en":["again","once more","a second time"],"quality_issues":["missing_target_word"]}
{"id":1432,"word":"天使","reading":"てんし","part_of_speech":"名詞・助詞","jlpt_level":"N4","meaning":"文法功能","example":{"japanese":"今日の授業でグループ発表を行いました。","reading":"きょうのじゅぎょうでぐるーぷはっぴょうをおこないました。","chinese":"今天的課堂上進行了小組發表。"},"gloss_en":["angel"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1433,"word":"小学校","reading":"しょうがっこう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"小學校","example":{"japanese":"この映画はとても長いですが、最後まで面白いです。","reading":"このえいがはとてもながいですが、さいごまでおもしろいです。","chinese":"這部電影雖然很長，但直到最後都很有趣。"},"gloss_en":["primary school","elementary school","grade school"],"quality_issues":["missing_target_word"]}
{"id":1434,"word":"展示","reading":"てんじ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"遊玩、演奏、比賽","example":{"japanese":"彼女はいつも笑顔で接客しています。","reading":"かのじょはいつもえがおでせっきゃくしています。","chinese":"她總是面帶微笑地接待客人。"},"gloss_en":["exhibition","display"],"quality_issues":["missing_target_word"]}
{"id":1435,"word":"後半","reading":"こうはん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"新しい仕事のために資格を取ることにしました。","reading":"あたらしいしごとのためにしかくをとることにしました。","chinese":"決定為了新工作而取得資格證書。"},"gloss_en":["second half","latter half"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1436,"word":"所有","reading":"しょゆう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"彼はとても親切で、困っている人を助けます。","reading":"かれはとてもしんせつで、こまっているひとをたすけます。","chinese":"他非常親切，會幫助有困難的人。"},"gloss_en":["possession","ownership"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1437,"word":"抜け","reading":"ぬけ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"今日の夕飯はとても豪華でした。","reading":"きょうのゆうはんはとてもごうかでした。","chinese":"今天的晚餐非常豐盛。"},"gloss_en":["omission","slip","error","fault"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1438,"word":"搭載","reading":"とうさい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"彼女は先生からのアドバイスを大切にしています。","reading":"かのじょはせんせいからのあどばいすをたいせつにしています。","chinese":"她很珍視老師給的建議。"},"gloss_en":["loading (on a ship)","equipping (an aircraft, car, etc.) with","being equipped with"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1439,"word":"新作","reading":"しんさく","part_of_speech":"名詞","jlpt_level":"N4","meaning":"構成、組成、創作、創造","example":{"japanese":"この地域は治安がよくて、安心して住めます。","reading":"このちいきはちあんがよくて、あんしんしてすめます。","chinese":"這個地區治安良好，可以安心居住。"},"gloss_en":["new work","new production","new composition","new creation"],"quality_issues":["missing_target_word"]}
{"id":1440,"word":"最悪","reading":"さいあく","part_of_speech":"名詞・形容動詞・助詞","jlpt_level":"N4","meaning":"動作、行為","example":{"japanese":"彼は音楽が趣味で、よくライブに行きます。","reading":"かれはおんがくがしゅみで、よくらいぶにいきます。","chinese":"他的興趣是音樂，經常去看現場演出。"},"gloss_en":["worst","horrible","horrid","awful"],"quality_issues":["missing_target_word"]}
{"id":1441,"word":"模様","reading":"もよう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"今日は予想以上に仕事が多かったです。","reading":"きょうはよそういじょうにしごとがおおかったです。","chinese":"今天的工作比預期的多。"},"gloss_en":["pattern","figure","design","state"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1442,"word":"産業","reading":"さんぎょう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"彼女は英語が流暢に話せます。","reading":"かのじょはえいごがりゅうちょうにはなせます。","chinese":"她能流利地說英語。"},"gloss_en":["industry","livelihood","occupation"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1443,"word":"細胞","reading":"さいぼう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"今日は全力で練習しました。","reading":"きょうはぜんりょくでれんしゅうしました。","chinese":"今天全力練習了。"},"gloss_en":["cell","cell (in an organization, esp. a communist party)"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1444,"word":"背景","reading":"はいけい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"設定、一組、套裝、背後、後方","example":{"japanese":"彼は会社の経営について詳しく知っています。","reading":"かれはかいしゃのけいえいについてくわしくしっています。","chinese":"他對公司的經營管理非常了解。"},"gloss_en":["background","scenery","backdrop","setting"],"quality_issues":["missing_target_word"]}
{"id":1445,"word":"言語","reading":"げんご","part_of_speech":"名詞","jlpt_level":"N4","meaning":"言語、語言","example":{"japanese":"この映画のストーリーはとても感動的です。","reading":"このえいがのすとーりーはとてもかんどうてきです。","chinese":"這部電影的故事情節非常感人。"},"gloss_en":["language"],"quality_issues":["missing_target_word"]}
{"id":1446,"word":"近所","reading":"きんじょ","part_of_speech":"名詞・助詞","jlpt_level":"N4","meaning":"附近、鄰近地區","example":{"japanese":"彼女は毎朝早起きをしています。","reading":"かのじょはまいあさはやおきをしています。","chinese":"她每天早上都早起。"},"gloss_en":["neighbourhood","neighborhood","vicinity"],"quality_issues":["missing_target_word"]}
{"id":1447,"word":"閲覧","reading":"えつらん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"閱讀、讀法、檢查、檢驗","example":{"japanese":"今日は友達に手伝ってもらいました。","reading":"きょうはともだちにてつだってもらいました。","chinese":"今天請朋友幫忙了。"},"gloss_en":["inspection","reading","perusal","browsing (the web)"],"quality_issues":["missing_target_word"]}
{"id":1448,"word":"おじさん","reading":"おじさん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"男人、男性","example":{"japanese":"この公園は春になると桜がきれいです。","reading":"このこうえんははるになるとさくらがきれいです。","chinese":"這個公園一到春天，櫻花就很漂亮。"},"gloss_en":["uncle","old man","mister","manybar goatfish (Parupeneus multifasciatus)"],"quality_issues":["missing_target_word","stale_llm_source"]}
```

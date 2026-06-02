# Vocabulary enrichment batch pilot_bad_batch_014_000

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
{"id":1409,"word":"確定","reading":"かくてい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"確認、設立、建立、一組、套裝、設定","example":{"japanese":"来週の月曜日に大事な会議があります。","reading":"らいしゅうのげつようびにだいじなかいぎがあります。","chinese":"下週一有重要的會議。"},"gloss_en":["decision","settlement","confirmation","establishment"],"quality_issues":["missing_target_word"]}
{"id":1410,"word":"空間","reading":"くうかん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"空間、房間","example":{"japanese":"彼女は自分の子供をとても大切にしています。","reading":"かのじょはじぶんのこどもをとてもたいせつにしています。","chinese":"她非常珍愛自己的孩子。"},"gloss_en":["space","room","airspace","atmosphere"],"quality_issues":["missing_target_word"]}
{"id":1411,"word":"職場","reading":"しょくば","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"今日の天気はとても良くて、気持ちいいです。","reading":"きょうのてんきはとてもよくて、きもちいいです。","chinese":"今天天氣非常好，心情舒暢。"},"gloss_en":["one's post","place of work","workplace"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1412,"word":"興奮","reading":"こうふん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"この町にはたくさんの観光スポットがあります。","reading":"このまちにはたくさんのかんこうすぽっとがあります。","chinese":"這個城鎮有很多觀光景點。"},"gloss_en":["excitement","stimulation","agitation","arousal"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1413,"word":"規制","reading":"きせい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"控制、管理、休息、剩餘","example":{"japanese":"彼女は毎日一時間ウォーキングをしています。","reading":"かのじょはまいにちいちじかんうぉーきんぐをしています。","chinese":"她每天走路運動一個小時。"},"gloss_en":["regulation","(traffic) policing","control","restriction"],"quality_issues":["missing_target_word"]}
{"id":1414,"word":"辛い","reading":"からい","part_of_speech":"形容詞","jlpt_level":"N4","meaning":"性質、狀態","example":{"japanese":"この映画は大人だけでなく、子供も楽しめます。","reading":"このえいがはおとなだけでなく、こどももたのしめます。","chinese":"這部電影不只大人，連小孩都能享受。"},"gloss_en":["spicy","hot","salty","harsh (criticism)"],"quality_issues":["missing_target_word"]}
{"id":1415,"word":"遅れ","reading":"おくれ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"後面、全部、下降、跌落","example":{"japanese":"彼は毎日勉強を続けているので、成績が上がっています。","reading":"かれはまいにちべんきょうをつづけているので、せいせきがあがっています。","chinese":"他每天持續學習，所以成績在提升。"},"gloss_en":["delay","lag","falling behind","falling behind in"],"quality_issues":["missing_target_word"]}
{"id":1416,"word":"なんとか","reading":"なんとか","part_of_speech":"表現・副詞・名詞","jlpt_level":"N4","meaning":"副詞用法、需人工確認","example":{"japanese":"ここ数年で技術がとても進歩しました。","reading":"ここすうねんでぎじゅつがとてもしんぽしました。","chinese":"這幾年來技術進步了很多。"},"gloss_en":["something","something or other","so-and-so","somehow (handling, dealing with something)"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
{"id":1417,"word":"ひとり","reading":"ひとり","part_of_speech":"名詞・副詞","jlpt_level":"N4","meaning":"副詞用法、需人工確認","example":{"japanese":"朝起きたら、まず歯を磨きます。","reading":"あさおきたら、まずはをみがきます。","chinese":"早上起床後，先刷牙。"},"gloss_en":["one person","being alone","being by oneself","being single"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
{"id":1418,"word":"ぶっ","reading":"ぶっ","part_of_speech":"未分類","jlpt_level":"N4","meaning":"行動、動作","example":{"japanese":"彼女は仕事が終わった後、英会話を習っています。","reading":"かのじょはしごとがおわったあと、えいかいわをならっています。","chinese":"她工作結束後在學英語會話。"},"gloss_en":["adds emphasis to the following verb or indicates that the action is done forcefully or violently"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1419,"word":"カバー","reading":"カバー","part_of_speech":"名詞","jlpt_level":"N4","meaning":"戒指、環","example":{"japanese":"今日は図書館に本を返しに行きました。","reading":"きょうはとしょかんにほんをかえしにいきました。","chinese":"今天去圖書館還書了。"},"gloss_en":["cover","covering","dust jacket","wrapper"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1420,"word":"キャンペーン","reading":"キャンペーン","part_of_speech":"名詞","jlpt_level":"N4","meaning":"促進、宣傳、升遷","example":{"japanese":"彼は何でも一人でできる、独立した人です。","reading":"かれはなんでもひとりでできる、どくりつしたひとです。","chinese":"他什麼事都能獨立完成，是個獨立的人。"},"gloss_en":["(sales) promotion","(sales, advertising) campaign","campaign (for an election, social change, etc.)","movement"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1421,"word":"シーズン","reading":"シーズン","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"この交差点は事故が多いので、注意してください。","reading":"このこうさてんはじこがおおいので、ちゅういしてください。","chinese":"這個十字路口事故很多，請多加注意。"},"gloss_en":["season (period in which regulated games are played)","season (division of the year)","season (of a TV show, etc.)","season (for doing something, e.g. ski season, entrance examination season)"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
{"id":1422,"word":"ストレス","reading":"ストレス","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"彼女は試験に合格してとても喜んでいます。","reading":"かのじょはしけんにごうかくしてとてもよろこんでいます。","chinese":"她通過了考試，非常高興。"},"gloss_en":["stress"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
{"id":1423,"word":"ドラゴン","reading":"ドラゴン","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"今日は日曜日なので、家でのんびりしました。","reading":"きょうはにちようびなので、いえでのんびりしました。","chinese":"今天是星期日，所以在家悠閒地度過了。"},"gloss_en":["dragon (as depicted in Western myths)"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
{"id":1424,"word":"パソコン","reading":"パソコン","part_of_speech":"名詞","jlpt_level":"N4","meaning":"人","example":{"japanese":"彼は自分の目標に向かって頑張っています。","reading":"かれはじぶんのもくひょうにむかってがんばっています。","chinese":"他朝著自己的目標努力奮鬥。"},"gloss_en":["personal computer","PC"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1425,"word":"ブラ","reading":"ブラ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"この問題の解答は後で説明します。","reading":"このもんだいのかいとうはあとでせつめいします。","chinese":"這道題的答案稍後再說明。"},"gloss_en":["bra"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
{"id":1426,"word":"ホーム","reading":"ホーム","part_of_speech":"名詞","jlpt_level":"N4","meaning":"形式、形狀","example":{"japanese":"週末は子供と一緒に料理を作りました。","reading":"しゅうまつはこどもといっしょにりょうりをつくりました。","chinese":"週末和孩子一起做了料理。"},"gloss_en":["platform"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1427,"word":"ボス","reading":"ボス","part_of_speech":"名詞","jlpt_level":"N4","meaning":"領導者","example":{"japanese":"彼女は毎日欠かさず日記をつけています。","reading":"かのじょはまいにちかかさずにっきをつけています。","chinese":"她每天不間斷地寫日記。"},"gloss_en":["boss","leader","head","boss (difficult enemy, usu. at the end of a section or level)"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1428,"word":"ライト","reading":"ライト","part_of_speech":"名詞・形容動詞","jlpt_level":"N4","meaning":"形容表現:ライト","example":{"japanese":"この図書館には古い本がたくさんあります。","reading":"このとしょかんにはふるいほんがたくさんあります。","chinese":"這間圖書館有很多古老的書籍。"},"gloss_en":["light","light (colour, food, comedy, etc.)"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
```

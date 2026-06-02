# Vocabulary enrichment batch pilot_bad_batch_004_000

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
{"id":1104,"word":"ぜひ","reading":"ぜひ","part_of_speech":"副詞・名詞","jlpt_level":"N4","meaning":"一定、務必","example":{"japanese":"このゲームのグラフィックは本当にきれいです。","reading":"このげーむのぐらふぃっくはほんとうにきれいです。","chinese":"這款遊戲的畫面真的很漂亮。"},"gloss_en":["certainly","without fail","right and wrong","pros and cons"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1105,"word":"なれる","reading":"なれる","part_of_speech":"動詞・助動詞","jlpt_level":"N4","meaning":"習慣、適應","example":{"japanese":"昨日、友達と一緒に映画を観ました。","reading":"きのう、ともだちといっしょにえいがをみました。","chinese":"昨天和朋友一起看了電影。"},"gloss_en":["to get used to","to grow accustomed to","to become familiar with","to become skilled in"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1106,"word":"ゆう","reading":"ゆう","part_of_speech":"動詞","jlpt_level":"N4","meaning":"動作、需人工確認","example":{"japanese":"最近、健康のために野菜をたくさん食べるようにしています。","reading":"さいきん、けんこうのためにやさいをたくさんたべるようにしています。","chinese":"最近為了健康，盡量多吃蔬菜。"},"gloss_en":["to do up (hair)","to dress","to arrange","to tie"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
{"id":1114,"word":"不思議","reading":"ふしぎ","part_of_speech":"名詞・形容動詞・副詞","jlpt_level":"N4","meaning":"動作、行為","example":{"japanese":"新しいプログラムのバグを見つけて、修正しました。","reading":"あたらしいぷろぐらむのばぐをみつけて、しゅうせいしました。","chinese":"找到了新程式的漏洞，並修正了它。"},"gloss_en":["wonderful","marvelous","strange","incredible"],"quality_issues":["missing_target_word"]}
{"id":1115,"word":"中央","reading":"ちゅうおう","part_of_speech":"名詞・助詞","jlpt_level":"N4","meaning":"中央、心","example":{"japanese":"彼は外国語を独学で勉強して、話せるようになりました。","reading":"かれはがいこくごをどくがくでべんきょうして、はなせるようになりました。","chinese":"他自學外語，學會了說外語。"},"gloss_en":["centre","center","middle","heart"],"quality_issues":["missing_target_word"]}
{"id":1116,"word":"主人公","reading":"しゅじんこう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"学校の文化祭の準備が本格的に始まりました。","reading":"がっこうのぶんかさいのじゅんびがほんかくてきにはじまりました。","chinese":"學校文化祭的準備工作正式開始了。"},"gloss_en":["protagonist","main character","hero","heroine"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1117,"word":"保存","reading":"ほぞん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"保存、維持","example":{"japanese":"あのお店のカレーはスパイスが効いていておいしいです。","reading":"あのおみせのかれーはすぱいすがきいていておいしいです。","chinese":"那家店的咖哩香料味道十足，非常好吃。"},"gloss_en":["preservation","conservation","storage","maintenance"],"quality_issues":["missing_target_word"]}
{"id":1118,"word":"保険","reading":"ほけん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"授業で先生がとても難しい問題を出しました。","reading":"じゅぎょうでせんせいがとてもむずかしいもんだいをだしました。","chinese":"上課時老師出了一道非常難的題目。"},"gloss_en":["insurance","guarantee","warranty"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1119,"word":"優勝","reading":"ゆうしょう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"全部","example":{"japanese":"新幹線に乗って大阪まで行きました。","reading":"しんかんせんにのっておおさかまでいきました。","chinese":"搭乘新幹線去了大阪。"},"gloss_en":["overall victory","championship","winning the title","(being in) heaven"],"quality_issues":["missing_target_word"]}
{"id":1120,"word":"助け","reading":"たすけ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"助け、援助、支援","example":{"japanese":"雨が降っているので、傘を持って出かけました。","reading":"あめがふっているので、かさをもってでかけました。","chinese":"因為在下雨，所以帶著傘出門了。"},"gloss_en":["assistance","help","aid","support"],"quality_issues":["missing_target_word"]}
{"id":1121,"word":"周辺","reading":"しゅうへん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"この本を読んで、たくさんのことを学びました。","reading":"このほんをよんで、たくさんのことをまなびました。","chinese":"讀了這本書，學到了很多東西。"},"gloss_en":["circumference","outskirts","environs","around"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1122,"word":"土地","reading":"とち","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"友達の家でパーティーがあって、楽しかったです。","reading":"ともだちのいえでぱーてぃーがあって、たのしかったです。","chinese":"在朋友家裡開了派對，玩得很開心。"},"gloss_en":["plot of land","lot","soil","locality"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1123,"word":"実験","reading":"じっけん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"試験の結果が心配で、なかなか眠れませんでした。","reading":"しけんのけっかがしんぱいで、なかなかねむれませんでした。","chinese":"很擔心考試的結果，遲遲睡不著。"},"gloss_en":["experiment","experimentation"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1124,"word":"建物","reading":"たてもの","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"電車の中で隣に座った人が話しかけてきました。","reading":"でんしゃのなかでとなりにすわったひとがはなしかけてきました。","chinese":"在電車上坐在旁邊的人向我搭話了。"},"gloss_en":["building"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1125,"word":"患者","reading":"かんじゃ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"帰り道にコンビニで買い物を済ませました。","reading":"かえりみちにこんびにでかいものをすませました。","chinese":"回家途中在便利商店把購物搞定了。"},"gloss_en":["patient"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1126,"word":"愛し","reading":"はし","part_of_speech":"未分類","jlpt_level":"N4","meaning":"我們、可愛、迷人","example":{"japanese":"一週間前にホテルの予約を取りました。","reading":"いっしゅうかんまえにほてるのよやくをとりました。","chinese":"提前一週預訂了飯店。"},"gloss_en":["lovely","beloved","sweet","adorable"],"quality_issues":["missing_target_word"]}
{"id":1127,"word":"支配","reading":"しはい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"控制、管理、方向、指導、規則、支配","example":{"japanese":"彼女とのデートがとても楽しかったです。","reading":"かのじょとのでーとがとてもたのしかったです。","chinese":"和她約會非常開心。"},"gloss_en":["rule","domination","control","direction"],"quality_issues":["missing_target_word"]}
{"id":1128,"word":"規模","reading":"きぼ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"計畫、預定","example":{"japanese":"このクラスには様々な国から来た学生がいます。","reading":"このくらすにはさまざまなくにからきたがくせいがいます。","chinese":"這個班級裡有來自各個國家的學生。"},"gloss_en":["scale","scope","plan","structure"],"quality_issues":["missing_target_word"]}
{"id":1131,"word":"それは","reading":"それは","part_of_speech":"副詞・表現","jlpt_level":"N4","meaning":"非常、很","example":{"japanese":"彼は健康のために毎朝ジョギングをしています。","reading":"かれはけんこうのためにまいあさじょぎんぐをしています。","chinese":"他為了健康，每天早上都去慢跑。"},"gloss_en":["very","extremely","that is"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1135,"word":"チャンス","reading":"チャンス","part_of_speech":"名詞","jlpt_level":"N4","meaning":"機會","example":{"japanese":"忙しい日はカップラーメンを食べることが多いです。","reading":"いそがしいひはかっぷらーめんをたべることがおおいです。","chinese":"忙碌的日子經常吃杯麵。"},"gloss_en":["chance","opportunity"],"quality_issues":["missing_target_word"]}
```

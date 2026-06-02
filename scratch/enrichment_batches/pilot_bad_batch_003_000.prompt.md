# Vocabulary enrichment batch pilot_bad_batch_003_000

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
{"id":1083,"word":"世代","reading":"せだい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"最近、経済の状況が変わってきているようです。","reading":"さいきん、けいざいのじょうきょうがかわってきているようです。","chinese":"最近，經濟狀況似乎開始改變了。"},"gloss_en":["generation"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1084,"word":"以来","reading":"いらい","part_of_speech":"名詞・副詞","jlpt_level":"N4","meaning":"以來、自從、從此以後","example":{"japanese":"病気が回復して、元の生活に戻れました。","reading":"びょうきがかいふくして、もとのせいかつにもどれました。","chinese":"病好了，回到了原來的生活。"},"gloss_en":["since","henceforth","ever since"],"quality_issues":["missing_target_word"]}
{"id":1085,"word":"余裕","reading":"よゆう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"餘裕、房間","example":{"japanese":"地球温暖化は今の時代の深刻な問題です。","reading":"ちきゅうおんだんかはいまのじだいのしんこくなもんだいです。","chinese":"地球暖化是當今時代嚴重的問題。"},"gloss_en":["surplus","margin","leeway","room"],"quality_issues":["missing_target_word"]}
{"id":1086,"word":"停止","reading":"ていし","part_of_speech":"名詞","jlpt_level":"N4","meaning":"年齡、頂端、第一、停止","example":{"japanese":"彼は政治に深い関心を持っています。","reading":"かれはせいじにふかいかんしんをもっています。","chinese":"他對政治有深厚的關注。"},"gloss_en":["stoppage","coming to a stop","halt","standstill"],"quality_issues":["missing_target_word"]}
{"id":1087,"word":"古い","reading":"ふるい","part_of_speech":"形容詞","jlpt_level":"N4","meaning":"年齡","example":{"japanese":"この地域には独自の文化があります。","reading":"このちいきにはどくじのぶんかがあります。","chinese":"這個地區有獨特的文化。"},"gloss_en":["old","aged","ancient","antiquated"],"quality_issues":["missing_target_word"]}
{"id":1088,"word":"同士","reading":"どうし","part_of_speech":"名詞","jlpt_level":"N4","meaning":"同伴、對象","example":{"japanese":"今年の夏は去年より特に暑いです。","reading":"ことしのなつはきょねんよりとくにあついです。","chinese":"今年夏天比去年特別熱。"},"gloss_en":["fellow","mutual","companion","comrade"],"quality_issues":["missing_target_word"]}
{"id":1089,"word":"家庭","reading":"かてい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"家庭、家人","example":{"japanese":"新聞で事件の詳しい記事を読みました。","reading":"しんぶんでじけんのくわしいきじをよみました。","chinese":"在報紙上讀到了關於事件的詳細報導。"},"gloss_en":["home","household","family","hearth"],"quality_issues":["missing_target_word"]}
{"id":1090,"word":"平均","reading":"へいきん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"年齡","example":{"japanese":"この部屋のインテリアがとてもおしゃれですね。","reading":"このへやのいんてりあがとてもおしゃれですね。","chinese":"這個房間的室內裝飾非常時尚呢。"},"gloss_en":["average","mean","balance","equilibrium"],"quality_issues":["missing_target_word"]}
{"id":1091,"word":"年代","reading":"ねんだい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"年齡","example":{"japanese":"大人気の映画の続編が来月公開されます。","reading":"だいにんきのえいがのぞくへんがらいげつこうかいされます。","chinese":"超人氣電影的續集下個月上映。"},"gloss_en":["age","era","period","date"],"quality_issues":["missing_target_word"]}
{"id":1092,"word":"後ろ","reading":"うしろ","part_of_speech":"名詞・助詞","jlpt_level":"N4","meaning":"後面、背後、後方","example":{"japanese":"このアニメには感動的なシーンがたくさんあります。","reading":"このあにめにはかんどうてきなしーんがたくさんあります。","chinese":"這部動畫有很多令人感動的場面。"},"gloss_en":["back","behind","rear"],"quality_issues":["missing_target_word"]}
{"id":1093,"word":"挑戦","reading":"ちょうせん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"全部","example":{"japanese":"激しい試合の末、結果が判明しました。","reading":"はげしいしあいのすえ、けっかがはんめいしました。","chinese":"在激烈的比賽後，結果終於出爐了。"},"gloss_en":["challenge","defiance","dare","attempt"],"quality_issues":["missing_target_word"]}
{"id":1094,"word":"構造","reading":"こうぞう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"建設、建築","example":{"japanese":"この映画は暴力シーンがあるので、子供向けではありません。","reading":"このえいがはぼうりょくしーんがあるので、こどもむけではありません。","chinese":"這部電影有暴力場面，不適合兒童觀看。"},"gloss_en":["structure","construction","makeup","framework"],"quality_issues":["missing_target_word"]}
{"id":1095,"word":"権利","reading":"けんり","part_of_speech":"名詞","jlpt_level":"N4","meaning":"権利、右","example":{"japanese":"料理を毎日練習しているので、少し上手になりました。","reading":"りょうりをまいにちれんしゅうしているので、すこしじょうずになりました。","chinese":"因為每天都在練習做菜，稍微進步了。"},"gloss_en":["right","privilege"],"quality_issues":["missing_target_word"]}
{"id":1096,"word":"目標","reading":"もくひょう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"對象、目標","example":{"japanese":"その作家の本はとても人気があり、すぐ売り切れます。","reading":"そのさっかのほんはとてもにんきがあり、すぐうりきれます。","chinese":"那位作家的書非常受歡迎，一下子就賣光了。"},"gloss_en":["goal","target","aim","objective"],"quality_issues":["missing_target_word"]}
{"id":1097,"word":"知識","reading":"ちしき","part_of_speech":"名詞","jlpt_level":"N4","meaning":"形式、形狀","example":{"japanese":"彼女は昨日の夜から体調が悪いそうです。","reading":"かのじょはきのうのよるからたいちょうがわるいそうです。","chinese":"聽說她從昨晚開始身體不舒服。"},"gloss_en":["knowledge","information"],"quality_issues":["missing_target_word"]}
{"id":1098,"word":"立て","reading":"たて","part_of_speech":"未分類","jlpt_level":"N4","meaning":"頭、首位、負責人","example":{"japanese":"三か月かかりましたが、プロジェクトが無事に完了しました。","reading":"さんかげつかかりましたが、ぷろじぇくとがぶじにかんりょうしました。","chinese":"雖然花了三個月，但專案順利完成了。"},"gloss_en":["central","main","leading","head"],"quality_issues":["missing_target_word"]}
{"id":1100,"word":"逃げ","reading":"にげ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"方式、方法","example":{"japanese":"バスが来るまでしばらく待ちました。","reading":"ばすがくるまでしばらくまちました。","chinese":"等公車來之前等了一會兒。"},"gloss_en":["escape","getaway","evasion"],"quality_issues":["missing_target_word"]}
{"id":1101,"word":"あら","reading":"あら","part_of_speech":"感動詞","jlpt_level":"N4","meaning":"哎呀、啊","example":{"japanese":"この問題には複数の原因があります。","reading":"このもんだいにはふくすうのげんいんがあります。","chinese":"這個問題有多個原因。"},"gloss_en":["oh!","ah!","oh no"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1102,"word":"いつか","reading":"いつか","part_of_speech":"名詞","jlpt_level":"N4","meaning":"月份","example":{"japanese":"チームワークがあれば、どんな目標でも達成できます。","reading":"ちーむわーくがあれば、どんなもくひょうでもたっせいできます。","chinese":"只要有團隊合作，任何目標都能達成。"},"gloss_en":["5th day of the month","five days"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1103,"word":"さっき","reading":"さっき","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"彼女はいつも笑顔で、周りを明るくします。","reading":"かのじょはいつもえがおで、まわりをあかるくします。","chinese":"她總是面帶微笑，讓周遭的氣氛變得開朗。"},"gloss_en":["thirst for blood","bloodlust","determination to kill"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
```

# Vocabulary enrichment batch pilot_bad_batch_012_000

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
{"id":1367,"word":"歓迎","reading":"かんげい","part_of_speech":"名詞","jlpt_level":"N4","meaning":"我們","example":{"japanese":"彼は大学で法律を勉強しています。","reading":"かれはだいがくでほうりつをべんきょうしています。","chinese":"他在大學學習法律。"},"gloss_en":["welcome","(warm) reception"],"quality_issues":["missing_target_word"]}
{"id":1368,"word":"気軽","reading":"きがる","part_of_speech":"名詞・形容動詞","jlpt_level":"N4","meaning":"輕、光","example":{"japanese":"この問題は複雑で、簡単には解決できません。","reading":"このもんだいはふくざつで、かんたんにはかいけつできません。","chinese":"這個問題很複雜，不能簡單解決。"},"gloss_en":["carefree","buoyant","lighthearted","sprightly"],"quality_issues":["missing_target_word"]}
{"id":1369,"word":"済み","reading":"ずみ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"一組、套裝、設定","example":{"japanese":"今日は予定がなかったので、家でゆっくりしました。","reading":"きょうはよていがなかったので、いえでゆっくりしました。","chinese":"今天沒有預定行程，所以在家裡好好休息了。"},"gloss_en":["arranged","taken care of","settled","completed"],"quality_issues":["missing_target_word"]}
{"id":1370,"word":"現れ","reading":"あらわれ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"男人、男性、材料、素材","example":{"japanese":"このカフェの雰囲気がとても好きです。","reading":"このかふぇのふんいきがとてもすきです。","chinese":"我非常喜歡這間咖啡廳的氣氛。"},"gloss_en":["embodiment","manifestation","materialization","materialisation"],"quality_issues":["missing_target_word"]}
{"id":1371,"word":"目差し","reading":"めざし","part_of_speech":"名詞","jlpt_level":"N4","meaning":"目的、一看、外觀","example":{"japanese":"地震が起きたとき、冷静に行動しました。","reading":"じしんがおきたとき、れいせいにこうどうしました。","chinese":"地震發生時，冷靜地採取了行動。"},"gloss_en":["aim","goal","purpose","look"],"quality_issues":["missing_target_word"]}
{"id":1372,"word":"約束","reading":"やくそく","part_of_speech":"名詞","jlpt_level":"N4","meaning":"同意、協議","example":{"japanese":"今日は仕事が早く終わったので、映画を見に行きました。","reading":"きょうはしごとがはやくおわったので、えいがをみにいきました。","chinese":"今天工作早早結束，所以去看了電影。"},"gloss_en":["promise","agreement","arrangement","one's word"],"quality_issues":["missing_target_word"]}
{"id":1373,"word":"自転車","reading":"じてんしゃ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"大学の入学試験は難しいです。","reading":"だいがくのにゅうがくしけんはむずかしいです。","chinese":"大學的入學考試很難。"},"gloss_en":["bicycle","bike"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1374,"word":"落とし","reading":"おとし","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"彼女はいつも積極的に質問します。","reading":"かのじょはいつもせっきょくてきにしつもんします。","chinese":"她總是積極地發問。"},"gloss_en":["dropping","losing","missing item","something one forgot to write down"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1375,"word":"計算","reading":"けいさん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"旅行の写真を家族に見せました。","reading":"りょこうのしゃしんをかぞくにみせました。","chinese":"把旅行的照片給家人看了。"},"gloss_en":["calculation","computation","reckoning","counting"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1376,"word":"訓練","reading":"くんれん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"線、隊伍","example":{"japanese":"毎週土曜日にバスケットボールの練習があります。","reading":"まいしゅうどようびにばすけっとぼーるのれんしゅうがあります。","chinese":"每週六有籃球練習。"},"gloss_en":["training","drill","practice","discipline"],"quality_issues":["missing_target_word"]}
{"id":1377,"word":"資料","reading":"しりょう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"材料、素材、形式、形狀","example":{"japanese":"このソフトウェアは最新バージョンに更新してください。","reading":"このそふとうぇあはさいしんばーじょんにこうしんしてください。","chinese":"請把這個軟體更新到最新版本。"},"gloss_en":["material","materials","data","information"],"quality_issues":["missing_target_word"]}
{"id":1378,"word":"連載","reading":"れんさい","part_of_speech":"名詞・助詞","jlpt_level":"N4","meaning":"文法功能","example":{"japanese":"彼は毎日ストレッチをしています。","reading":"かれはまいにちすとれっちをしています。","chinese":"他每天做伸展運動。"},"gloss_en":["serialization","serialisation","serial story"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1379,"word":"進化","reading":"しんか","part_of_speech":"名詞","jlpt_level":"N4","meaning":"進展、進步","example":{"japanese":"今年の夏は旅行に行く予定があります。","reading":"ことしのなつはりょこうにいくよていがあります。","chinese":"今年夏天有計畫去旅行。"},"gloss_en":["evolution","evolution","becoming more advanced","progress"],"quality_issues":["missing_target_word"]}
{"id":1380,"word":"首相","reading":"しゅしょう","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"彼女はいつも明るくて、周りを元気にします。","reading":"かのじょはいつもあかるくて、まわりをげんきにします。","chinese":"她總是開朗，讓周遭的人精神振奮。"},"gloss_en":["prime minister","chancellor (Germany, Austria, etc.)","premier"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1382,"word":"かつて","reading":"かつて","part_of_speech":"副詞・名詞・助詞","jlpt_level":"N4","meaning":"文法功能、需人工確認","example":{"japanese":"彼は毎日規則正しい生活を送っています。","reading":"かれはまいにちきそくただしいせいかつをおくっています。","chinese":"他每天過著規律的生活。"},"gloss_en":["once","before","formerly","ever"],"quality_issues":["meaning_placeholder","stale_llm_source"]}
{"id":1383,"word":"其方","reading":"そちら","part_of_speech":"名詞・代名詞","jlpt_level":"N4","meaning":"方式、方法、方向、指導","example":{"japanese":"このメニューの中からお好みの料理を選んでください。","reading":"このめにゅーのなかからおこのみのりょうりをえらんでください。","chinese":"請從這個菜單中選擇您喜歡的料理。"},"gloss_en":["that way","that direction","there","that (one)"],"quality_issues":["missing_target_word"]}
{"id":1384,"word":"ついに","reading":"ついに","part_of_speech":"副詞","jlpt_level":"N4","meaning":"終於","example":{"japanese":"最近、仕事のストレスが多いです。","reading":"さいきん、しごとのすとれすがおおいです。","chinese":"最近工作壓力很大。"},"gloss_en":["finally","in the end","at last","in the end"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1385,"word":"はっきり","reading":"はっきり","part_of_speech":"副詞・助詞・名詞","jlpt_level":"N4","meaning":"清楚地","example":{"japanese":"彼女は料理だけでなく、掃除も得意です。","reading":"かのじょはりょうりだけでなく、そうじもとくいです。","chinese":"她不只擅長做料理，打掃也很在行。"},"gloss_en":["clearly","plainly","distinctly","to be clear"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1386,"word":"ひと","reading":"ひと","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"今日は晴れていて、気持ちがいい天気です。","reading":"きょうははれていて、きもちがいいてんきです。","chinese":"今天天氣晴朗，心情舒暢。"},"gloss_en":["bandit"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
{"id":1387,"word":"まだまだ","reading":"まだまだ","part_of_speech":"副詞・表現","jlpt_level":"N4","meaning":"副詞用法、需人工確認","example":{"japanese":"この建物はリノベーションされてきれいになりました。","reading":"このたてものはりのべーしょんされてきれいになりました。","chinese":"這棟建物翻新後變得很漂亮了。"},"gloss_en":["still","much more","(not) yet","still a long way to go"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
```

# Vocabulary enrichment batch pilot_bad_batch_next_000

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
{"id":1056,"word":"公園","reading":"こうえん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"事故の原因をくわしく調べています。","reading":"じこのげんいんをくわしくしらべています。","chinese":"正在詳細調查事故的原因。"},"gloss_en":["(public) park"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1057,"word":"努力","reading":"どりょく","part_of_speech":"名詞","jlpt_level":"N4","meaning":"結束、結尾","example":{"japanese":"彼女は家族のために毎日一生懸命働いています。","reading":"かのじょはかぞくのためにまいにちいっしょうけんめいはたらいています。","chinese":"她每天為了家人拼命工作。"},"gloss_en":["effort","exertion","endeavour","endeavor"],"quality_issues":["missing_target_word"]}
{"id":1058,"word":"同時に","reading":"どうじに","part_of_speech":"表現・副詞・接続詞","jlpt_level":"N4","meaning":"相同、一樣、時間","example":{"japanese":"長年の夢がやっと実現しました。","reading":"ながねんのゆめがやっとじつげんしました。","chinese":"多年的夢想終於實現了。"},"gloss_en":["at the same time","at once","simultaneously","concurrently"],"quality_issues":["missing_target_word"]}
{"id":1059,"word":"唯一","reading":"ゆいいつ","part_of_speech":"名詞・助詞・副詞","jlpt_level":"N4","meaning":"唯一、只有","example":{"japanese":"試合で優勝するために、チーム全員で毎日練習しています。","reading":"しあいでゆうしょうするために、ちーむぜんいんでまいにちれんしゅうしています。","chinese":"為了在比賽中奪冠，全體隊員每天一起練習。"},"gloss_en":["only","sole","unique"],"quality_issues":["missing_target_word"]}
{"id":1060,"word":"基準","reading":"きじゅん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"毎日、鉄道を利用して通勤しています。","reading":"まいにち、てつどうをりようしてつうきんしています。","chinese":"每天搭乘鐵路通勤。"},"gloss_en":["standard","criterion","norm","benchmark"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1061,"word":"得る","reading":"うる","part_of_speech":"未分類","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"会議で新しいプロジェクトを提案しました。","reading":"かいぎであたらしいぷろじぇくとをていあんしました。","chinese":"在會議上提出了新的專案計畫。"},"gloss_en":["to be able to ...","can ...","to get","to acquire"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1062,"word":"復活","reading":"ふっかつ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"返回、歸還、背後、後方、恢復、修復","example":{"japanese":"このレストランの料理は本当においしいです。","reading":"このれすとらんのりょうりはほんとうにおいしいです。","chinese":"這家餐廳的料理真的很好吃。"},"gloss_en":["revival (of an old system, custom, fashion, etc.)","restoration","return","comeback"],"quality_issues":["missing_target_word"]}
{"id":1063,"word":"性格","reading":"せいかく","part_of_speech":"名詞","jlpt_level":"N4","meaning":"人","example":{"japanese":"友達の誕生日にプレゼントを用意しました。","reading":"ともだちのたんじょうびにぷれぜんとをようしました。","chinese":"為朋友的生日準備了禮物。"},"gloss_en":["character (of a person)","personality","disposition","nature"],"quality_issues":["missing_target_word"]}
{"id":1064,"word":"提案","reading":"ていあん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"提案、建議","example":{"japanese":"その事件はとても複雑な状況でした。","reading":"そのじけんはとてもふくざつなじょうきょうでした。","chinese":"那個事件的狀況非常複雜。"},"gloss_en":["proposal","proposition","suggestion"],"quality_issues":["missing_target_word"]}
{"id":1065,"word":"最新","reading":"さいしん","part_of_speech":"名詞・助詞","jlpt_level":"N4","meaning":"我們","example":{"japanese":"自分の考えをレポートにまとめました。","reading":"じぶんのかんがえをれぽーとにまとめました。","chinese":"把自己的想法整理成報告了。"},"gloss_en":["latest","newest","late-breaking (news)"],"quality_issues":["missing_target_word"]}
{"id":1066,"word":"東","reading":"ひがし","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"先生の助言がとても役に立ちました。","reading":"せんせいのじょげんがとてもやくにたちました。","chinese":"老師的建議非常有幫助。"},"gloss_en":["east"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1067,"word":"検査","reading":"けんさ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"檢查、檢驗","example":{"japanese":"日本語の文法の規則をひとつずつ覚えています。","reading":"にほんごのぶんぽうのきそくをひとつずつおぼえています。","chinese":"一條一條地在記日語文法的規則。"},"gloss_en":["inspection (e.g. customs, factory)","examination","test","check"],"quality_issues":["missing_target_word"]}
{"id":1068,"word":"比べ","reading":"くらべ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"この工場では毎日多くの製品を製造しています。","reading":"このこうじょうではまいにちおおくのせいひんをせいぞうしています。","chinese":"這間工廠每天製造大量的產品。"},"gloss_en":["contest","comparison","competition"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1069,"word":"確実","reading":"かくじつ","part_of_speech":"名詞・形容動詞","jlpt_level":"N4","meaning":"動作、行為","example":{"japanese":"政府が新しい経済政策を発表しました。","reading":"せいふがあたらしいけいざいせいさくをはっぴょうしました。","chinese":"政府發表了新的經濟政策。"},"gloss_en":["certain","sure","definite","reliable"],"quality_issues":["missing_target_word"]}
{"id":1070,"word":"福島","reading":"ふくしま","part_of_speech":"名詞","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"授業で環境問題について深く考えました。","reading":"じゅぎょうでかんきょうもんだいについてふかくかんがえました。","chinese":"在課堂上深入思考了環境問題。"},"gloss_en":["Fukushima (city, prefecture)"],"quality_issues":["meaning_placeholder","missing_target_word"]}
{"id":1071,"word":"自ら","reading":"みずから","part_of_speech":"名詞・副詞","jlpt_level":"N4","meaning":"人、全部、自己、自身","example":{"japanese":"スーパーで今週の食材をまとめて購入しました。","reading":"すーぱーでこんしゅうのしょくざいをまとめてこうにゅうしました。","chinese":"在超市一次買齊了這週的食材。"},"gloss_en":["oneself","oneself","for oneself","personally"],"quality_issues":["missing_target_word"]}
{"id":1072,"word":"製品","reading":"せいひん","part_of_speech":"名詞","jlpt_level":"N4","meaning":"男人、男性、好、良好","example":{"japanese":"大学で専門の知識と技術を身につけました。","reading":"だいがくでせんもんのちしきとぎじゅつをみにつけました。","chinese":"在大學習得了專業知識和技術。"},"gloss_en":["manufactured goods","finished goods","product"],"quality_issues":["missing_target_word"]}
{"id":1073,"word":"連れ","reading":"つれ","part_of_speech":"名詞","jlpt_level":"N4","meaning":"公司、同伴、對象","example":{"japanese":"出発する前に、旅行の内容をもう一度確認しました。","reading":"しゅっぱつするまえに、りょこうのないようをもういちどかくにんしました。","chinese":"出發前再確認了一次旅行的行程內容。"},"gloss_en":["companion","company","tritagonist","second supporting character"],"quality_issues":["missing_target_word"]}
{"id":1075,"word":"だい","reading":"だい","part_of_speech":"助詞","jlpt_level":"N4","meaning":"是嗎、是不是","example":{"japanese":"この地域では昔から農業が盛んです。","reading":"このちいきではむかしからのうぎょうがさかんです。","chinese":"這個地區自古以來農業就很興盛。"},"gloss_en":["is it?","isn't it?","be","is"],"quality_issues":["missing_target_word","stale_llm_source"]}
{"id":1082,"word":"ヾ","reading":"ヾ","part_of_speech":"未分類","jlpt_level":"N4","meaning":"名詞概念","example":{"japanese":"試合に向けて毎日体力トレーニングをしています。","reading":"しあいにむけてまいにちたいりょくとれーにんぐをしています。","chinese":"為了備戰比賽，每天都在做體能訓練。"},"gloss_en":["voiced repetition mark in katakana"],"quality_issues":["meaning_placeholder","missing_target_word","stale_llm_source"]}
```

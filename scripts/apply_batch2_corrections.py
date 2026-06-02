#!/usr/bin/env python3
"""Apply batch 2 corrections to T1 template sentences (entries 51-100)."""
import json, sys

CORRECTIONS = {
    412: {"meaning": "對…來說、對…而言", "example": {"japanese": "私にとって家族は大切です。", "reading": "わたしにとってかぞくはたいせつです。", "chinese": "對我來說，家人是最重要的。"}, "quality_score": "curated"},
    413: {"meaning": "果然、終究（表結果和預期相符）", "example": {"japanese": "やっぱり彼が優勝した。", "reading": "やっぱりかれがゆうしょうした。", "chinese": "果然他得了第一名。"}, "quality_score": "curated"},
    420: {"meaning": "Ω（希臘字母最後一個字，表終結）", "example": {"japanese": "これがΩ、最後の記号だ。", "reading": "これがΩ、さいごのきごうだ。", "chinese": "這是Ω，最後一個符號。"}, "quality_score": "curated"},
    427: {"meaning": "便宜的；容易…（接在動詞後表「容易做」）", "example": {"japanese": "このお店は値段がやすいです。", "reading": "このおみせはねだんがやすいです。", "chinese": "這家店的價格很便宜。"}, "quality_score": "curated"},
    430: {"meaning": "決定、裁定", "example": {"japanese": "会議で方針が決定しました。", "reading": "かいぎでほうしんがけっていしました。", "chinese": "會議上決定了方針。"}, "quality_score": "curated"},
    437: {"meaning": "情色的、色情的（エロティック的縮略，口語）", "example": {"japanese": "そのドラマはエロいシーンが多い。", "reading": "そのドラマはエロいシーンがおおい。", "chinese": "那部戲劇有很多情色場面。"}, "quality_score": "curated"},
    441: {"meaning": "進入；含…的（〜入り）", "example": {"japanese": "このチョコはナッツ入りです。", "reading": "このチョコはナッツいりです。", "chinese": "這個巧克力含有堅果。"}, "quality_score": "curated"},
    447: {"meaning": "差別、不同之處", "example": {"japanese": "二つの商品の違いを説明してください。", "reading": "ふたつのしょうひんのちがいをせつめいしてください。", "chinese": "請說明兩件商品的差異。"}, "quality_score": "curated"},
    450: {"meaning": "整理、總結、匯整", "example": {"japanese": "授業のまとめをノートに書きました。", "reading": "じゅぎょうのまとめをノートにかきました。", "chinese": "把課程摘要寫在筆記本上。"}, "quality_score": "curated"},
    451: {"meaning": "然後、所以（のでの口語形）", "example": {"japanese": "お腹が痛いんで、早退します。", "reading": "おなかがいたいんで、そうたいします。", "chinese": "因為肚子痛，所以提早離開。"}, "quality_score": "curated"},
    453: {"meaning": "男人；（後綴）…人、…員", "example": {"japanese": "彼はサラリーマンです。", "reading": "かれはサラリーマンです。", "chinese": "他是上班族。"}, "quality_score": "curated"},
    461: {"meaning": "過去、往昔", "example": {"japanese": "過去のことは忘れましょう。", "reading": "かこのことはわすれましょう。", "chinese": "讓我們忘掉過去的事吧。"}, "quality_score": "curated"},
    462: {"meaning": "剩餘；不太…（あまり〜ない）", "example": {"japanese": "あまり辛い食べ物は好きじゃない。", "reading": "あまりからいたべものはすきじゃない。", "chinese": "不太喜歡辣的食物。"}, "quality_score": "curated"},
    464: {"meaning": "哪個（在三個以上中選擇）", "example": {"japanese": "どれが一番好きですか。", "reading": "どれがいちばんすきですか。", "chinese": "你最喜歡哪個？"}, "quality_score": "curated"},
    467: {"meaning": "這傢伙（口語、粗俗的人稱代名詞）", "example": {"japanese": "こいつは私の弟です。", "reading": "こいつはわたしのおとうとです。", "chinese": "這傢伙是我弟弟。"}, "quality_score": "curated"},
    468: {"meaning": "熟悉、習慣（慣れ的連用形）", "example": {"japanese": "なれるまで少し時間がかかります。", "reading": "なれるまですこしじかんがかかります。", "chinese": "需要一點時間來適應。"}, "quality_score": "curated"},
    469: {"meaning": "在…（書面語表場所或時間的正式表現）", "example": {"japanese": "日本において礼儀は大切です。", "reading": "にほんにおいてれいぎはたいせつです。", "chinese": "在日本，禮貌是很重要的。"}, "quality_score": "curated"},
    482: {"meaning": "選手、運動員", "example": {"japanese": "彼女はオリンピック選手です。", "reading": "かのじょはオリンピックせんしゅです。", "chinese": "她是奧運選手。"}, "quality_score": "curated"},
    485: {"meaning": "理解、明白（わかる的連用形）", "example": {"japanese": "この説明はわかりやすいです。", "reading": "このせつめいはわかりやすいです。", "chinese": "這個說明很容易理解。"}, "quality_score": "curated"},
    487: {"meaning": "完全、全然（強調副詞）", "example": {"japanese": "全くわからなかった。", "reading": "まったくわからなかった。", "chinese": "完全搞不懂。"}, "quality_score": "curated"},
    496: {"meaning": "呼吸；去（行き・息）", "example": {"japanese": "いきを深く吸ってください。", "reading": "いきをふかくすってください。", "chinese": "請深呼吸。"}, "quality_score": "curated"},
    502: {"meaning": "事業、商業活動", "example": {"japanese": "新しい事業を始めました。", "reading": "あたらしいじぎょうをはじめました。", "chinese": "開始了新的事業。"}, "quality_score": "curated"},
    505: {"meaning": "環境", "example": {"japanese": "環境を守るために節電しています。", "reading": "かんきょうをまもるためにせつでんしています。", "chinese": "為了保護環境而節約用電。"}, "quality_score": "curated"},
    506: {"meaning": "經濟", "example": {"japanese": "日本の経済は大きいです。", "reading": "にほんのけいざいはおおきいです。", "chinese": "日本的經濟規模很大。"}, "quality_score": "curated"},
    507: {"meaning": "議員", "example": {"japanese": "彼は国会議員です。", "reading": "かれはこっかいぎいんです。", "chinese": "他是國會議員。"}, "quality_score": "curated"},
    508: {"meaning": "附近、靠近", "example": {"japanese": "駅の近くにコンビニがあります。", "reading": "えきのちかくにコンビニがあります。", "chinese": "車站附近有便利商店。"}, "quality_score": "curated"},
    515: {"meaning": "…個月（月份計數詞）", "example": {"japanese": "日本語を三ヶ月勉強しました。", "reading": "にほんごをさんかげつべんきょうしました。", "chinese": "學了三個月的日語。"}, "quality_score": "curated"},
    516: {"meaning": "改變（変える的連用形）", "example": {"japanese": "気分を変えに外を散歩しました。", "reading": "きぶんをかえにそとをさんぽしました。", "chinese": "為了轉換心情，去外面散步了。"}, "quality_score": "curated"},
    518: {"meaning": "成功", "example": {"japanese": "プロジェクトが成功しました。", "reading": "プロジェクトがせいこうしました。", "chinese": "專案成功了。"}, "quality_score": "curated"},
    519: {"meaning": "文化", "example": {"japanese": "日本の文化に興味があります。", "reading": "にほんのぶんかにきょうみがあります。", "chinese": "對日本文化有興趣。"}, "quality_score": "curated"},
    528: {"meaning": "合作、協力", "example": {"japanese": "皆で協力して仕事を終えました。", "reading": "みんなできょうりょくしてしごとをおえました。", "chinese": "大家合力完成了工作。"}, "quality_score": "curated"},
    537: {"meaning": "代表", "example": {"japanese": "彼女がクラスの代表に選ばれました。", "reading": "かのじょがクラスのだいひょうにえらばれました。", "chinese": "她被選為班級代表。"}, "quality_score": "curated"},
    538: {"meaning": "變更、修改", "example": {"japanese": "計画を変更しました。", "reading": "けいかくをへんこうしました。", "chinese": "變更了計畫。"}, "quality_score": "curated"},
    543: {"meaning": "出生、出身", "example": {"japanese": "彼女は大阪生まれです。", "reading": "かのじょはおおさかうまれです。", "chinese": "她是大阪出生的。"}, "quality_score": "curated"},
    546: {"meaning": "興趣、關心", "example": {"japanese": "音楽に興味があります。", "reading": "おんがくにきょうみがあります。", "chinese": "對音樂有興趣。"}, "quality_score": "curated"},
    551: {"meaning": "上升、提高；炸物（油炸料理）", "example": {"japanese": "揚げたてのから揚げはおいしい。", "reading": "あげたてのからあげはおいしい。", "chinese": "剛炸好的炸雞很好吃。"}, "quality_score": "curated"},
    559: {"meaning": "支援、援助", "example": {"japanese": "被災地に支援物資を送りました。", "reading": "ひさいちにしえんぶっしをおくりました。", "chinese": "向災區送去了救援物資。"}, "quality_score": "curated"},
    561: {"meaning": "決定、規定（決める的連用形）", "example": {"japanese": "早起きを決めて実行しています。", "reading": "はやおきをきめてじっこうしています。", "chinese": "決定早起並付諸行動。"}, "quality_score": "curated"},
    566: {"meaning": "駕駛、操作", "example": {"japanese": "毎日車を運転して通勤しています。", "reading": "まいにちくるまをうんてんしてつうきんしています。", "chinese": "每天開車上班。"}, "quality_score": "curated"},
    569: {"meaning": "々（漢字重複符號，如人々・国々）", "example": {"japanese": "人々が公園に集まっています。", "reading": "ひとびとがこうえんにあつまっています。", "chinese": "人們聚集在公園裡。"}, "quality_score": "curated"},
    583: {"meaning": "嗎？（口語疑問語氣助詞）", "example": {"japanese": "もう宿題はやったかい。", "reading": "もうしゅくだいはやったかい。", "chinese": "作業做完了嗎？"}, "quality_score": "curated"},
    587: {"meaning": "整體、全體", "example": {"japanese": "クラス全体で話し合いました。", "reading": "クラスぜんたいではなしあいました。", "chinese": "全班一起討論了。"}, "quality_score": "curated"},
    593: {"meaning": "能力、才能", "example": {"japanese": "彼には音楽の能力があります。", "reading": "かれにはおんがくののうりょくがあります。", "chinese": "他有音樂方面的才能。"}, "quality_score": "curated"},
    598: {"meaning": "一邊…一邊…；雖然…卻…（表同時進行或逆接）", "example": {"japanese": "音楽を聴きつつ勉強しています。", "reading": "おんがくをきつつべんきょうしています。", "chinese": "一邊聽音樂一邊學習。"}, "quality_score": "curated"},
    599: {"meaning": "打算、預計", "example": {"japanese": "来年日本に行くつもりです。", "reading": "らいねんにほんにいくつもりです。", "chinese": "打算明年去日本。"}, "quality_score": "curated"},
    602: {"meaning": "幾乎、差不多", "example": {"japanese": "宿題はほぼ終わりました。", "reading": "しゅくだいはほぼおわりました。", "chinese": "作業幾乎做完了。"}, "quality_score": "curated"},
    607: {"meaning": "意識、自覺", "example": {"japanese": "健康に意識を向けることが大切です。", "reading": "けんこうにいしきをむけることがたいせつです。", "chinese": "對健康保持意識很重要。"}, "quality_score": "curated"},
    611: {"meaning": "承認、認可（認める的連用形）", "example": {"japanese": "彼の努力を認めてあげました。", "reading": "かれのどりょくをみとめてあげました。", "chinese": "認可了他的努力。"}, "quality_score": "curated"},
    613: {"meaning": "這樣的、這種", "example": {"japanese": "こういう問題は難しいですね。", "reading": "こういうもんだいはむずかしいですね。", "chinese": "這樣的問題真難呢。"}, "quality_score": "curated"},
    618: {"meaning": "負責、主管", "example": {"japanese": "この仕事を担当することになりました。", "reading": "このしごとをたんとうすることになりました。", "chinese": "決定由我來負責這項工作。"}, "quality_score": "curated"},
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

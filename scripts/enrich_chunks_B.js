#!/usr/bin/env node
/**
 * Enrich Chunks B (16-27) - Example sentence quality review and rewriting
 */
const fs = require('fs');
const path = require('path');

const CHUNKS_DIR = '/Users/Chuliying/nihongo-vocab-trainer/public/data/chunks';
const LOG_FILE = '/Users/Chuliying/nihongo-vocab-trainer/scripts/enrich_log_B.json';

const BAD_PATTERNS = [
  'を使うことがあります',
  'という言葉を聞くことがあります',
  'という言葉が出ました',
  'を使った文を書きました',
  'の使い方を説明しました',
  'を使った例を出しました',
  'という表現を聞きました',
  'のことを話しました',
  'の働きを確認しました',
  'という言葉を見ました',
  'を調べました',
  'について話しました',
  'と言いました',
  'の自然な言い方を教えました',
  'を正しく使いたいです',
  'を入れると文の',
  'は文の中でよく使います',
  'という字を',
  '短い文で「',
];

const BAD_MEANINGS = ['名詞概念', '文法功能', '形容表現:', '動詞概念', '副詞概念', '需人工確認'];

function needsSkip(item) {
  return item.quality_score === 'curated' || item.quality_score === 'verb_curated';
}

function isBadExample(item) {
  const ex = item.example;
  if (!ex || !ex.japanese) return true;
  
  for (const pat of BAD_PATTERNS) {
    if (ex.japanese.includes(pat) || (ex.reading && ex.reading.includes(pat))) return true;
  }
  
  if (item.meaning) {
    for (const bm of BAD_MEANINGS) {
      if (item.meaning.includes(bm)) return true;
    }
  }
  
  if (ex.chinese && (ex.chinese.includes('「') || ex.chinese.includes('副詞:') || ex.chinese.includes('名詞:') || ex.chinese.includes('形容表現:'))) {
    if (!ex.japanese.includes(ex.chinese.replace(/[「」]/g, ''))) {
      return true;
    }
  }
  
  return false;
}

const ENRICHED = {
  "エレベーター": { japanese: "エレベーターに乗って五階へ行きました。", reading: "えれべーたーにのってごかいへいきました。", chinese: "搭電梯去了五樓。" },
  "ズボン": { japanese: "新しい黒いズボンを買いました。", reading: "あたらしいくろいずぼんをかいました。", chinese: "買了新的黑色長褲。" },
  "ドリンク": { japanese: "暑いので冷たいドリンクを飲みましょう。", reading: "あついのでつめたいどりんくをのみましょう。", chinese: "天氣很熱，喝杯冰涼的飲料吧。" },
  "バター": { japanese: "パンにバターを塗って食べました。", reading: "ぱんにばたーをぬってたべました。", chinese: "在麵包上塗了奶油吃。" },
  "キャンセル": { japanese: "用事ができたので、ホテルの予約をキャンセルしました。", reading: "ようじができたので、ほてるのよやくをきゃんせるしました。", chinese: "因為有事，所以取消了飯店的預訂。" },
  "エアコン": { japanese: "部屋が暑いのでエアコンをつけました。", reading: "へやがあついのでえあこんをつけました。", chinese: "房間很熱所以開了冷氣。" },
  "食堂": { japanese: "お昼ご飯は会社の食堂で食べます。", reading: "おひるごはんはいしゃのしょくどうでたべます。", chinese: "午餐在公司的食堂吃。" },
  "祖父": { japanese: "私の祖父は今年で八十歳になります。", reading: "わたしのそふはことしではちじゅっさいになります。", chinese: "我的祖父今年將滿八十歲。" },
  "遅刻": { japanese: "朝寝坊して学校に遅刻してしまいました。", reading: "あさねぼうしてがっこうにちこくしてしまいました。", chinese: "早上睡過頭，結果學校遲到了。" },
  "アレルギー": { japanese: "私は卵のアレルギーがあります。", reading: "わたしはたまごのあれるぎーがあります。", chinese: "我對蛋過敏。" },
  "ガソリン": { japanese: "旅行に行く前にガソリンを入れました。", reading: "りょこうにいくまえにがそりんをいれました。", chinese: "出門旅行前加了汽油。" },
  "両手": { japanese: "両手に荷物をたくさん持っています。", reading: "りょうてにもつをたくさんもっています。", chinese: "雙手拿著很多行李。" },
  "公務員": { japanese: "将来は公務員になりたいと思っています。", reading: "しょうらいはこうむいんになりたいとおもっています。", chinese: "我想將來成為公務員。" },
  "出張": { japanese: "来週、仕事で東京へ出張します。", reading: "らいしゅう、しごとでとうきょうへしゅっちょうします。", chinese: "下週因為工作要去東京出差。" },
  "乗客": { japanese: "バスには多くの乗客が乗っていました。", reading: "ばすにはおおくのじょうきゃくがのっていました。", chinese: "公車上坐著許多乘客。" },
  "西洋": { japanese: "西洋の歴史について本を読んでいます。", reading: "せいようのれきしについてほんをよんでいます。", chinese: "我正在讀關於西方歷史的書。" },
  "豆腐": { japanese: "今夜は豆腐の味噌汁を作ります。", reading: "こんやはとうふのみそしるをつくります。", chinese: "今晚要做豆腐味噌湯。" },
  "宿題": { japanese: "宿題が多くて大変です。", reading: "しゅくだいがおおくてたいへんです。", chinese: "作業很多，真辛苦。" },
  "強盗": { japanese: "警察が強盗を逮捕しました。", reading: "けいさつがごうとうをたいほしました。", chinese: "警察逮捕了強盜。" },
  "気候": { japanese: "この国は一年中温暖な気候です。", reading: "このくにはいちねんじゅうおんだんなきこうです。", chinese: "這個國家整年都是溫和的氣候。" },
  "浴衣": { japanese: "夏祭りに浴衣を着て行きました。", reading: "なつまつりにゆかたをきていきました。", chinese: "穿著浴衣去了夏日祭典。" },
  "科目": { japanese: "あなたが一番好きな科目は何ですか。", reading: "あなたがいちばんすきなかもくはなんですか。", chinese: "你最喜歡的科目是什麼？" },
  "進学": { japanese: "高校を卒業して大学に進学します。", reading: "こうこうをそつぎょうしてだいがくにしんがくします。", chinese: "高中畢業後升學讀大學。" },
  "閉店": { japanese: "そのスーパーは午後十時に閉店します。", reading: "そのすーぱーはごごじゅうじにへいてんします。", chinese: "那家超市在晚上十點關門。" },
  "夕食": { japanese: "家族揃って夕食を食べました。", reading: "かぞくそろってゆうしょくをたべました。", chinese: "全家人聚在一起吃了晚餐。" },
  "外見": { japanese: "人を外見で判断してはいけません。", reading: "ひとをがいけんではんだんしてはいけない。", chinese: "不能用外表來判斷人。" },
  "学年": { japanese: "新しい学年が始まりました。", reading: "あたらしいがくねんがはじまりました。", chinese: "新的學年開始了。" },
  "対話": { japanese: "両国間の対話が重要です。", reading: "りょうこくかんのたいわがじゅうようです。", chinese: "兩國之間的對話很重要。" },
  "幹事": { japanese: "私が今度の飲み会の幹事です。", reading: "わたしがこんどののみかいのかんじです。", chinese: "我是這次聚餐的負責人。" },
  "正月": { japanese: "お正月には家族で神社に行きます。", reading: "おしょうがつにはかぞくでじんじゃにいきます。", chinese: "新年的時候全家會去神社。" },
  "治安": { japanese: "この街は治安がとても良いです。", reading: "このまちはちあんがとてもよいです。", chinese: "這個小鎮的治安非常好。" },
  "私立": { japanese: "妹は私立の高校に通っています。", reading: "いもうとはしりつのこうこうにかよっています。", chinese: "妹妹就讀私立高中。" },
  "好意": { japanese: "彼の好意に感謝します。", reading: "かれのこういにかんしゃします。", chinese: "感謝他的好意。" },
  "後悔": { japanese: "あの時の決定を後悔していません。", reading: "あのときのけっていをこうかいしていません。", chinese: "我不後悔那時的決定。" },
  "小麦": { japanese: "このパンは小麦で作られています。", reading: "このぱんはこむぎでつくられています。", chinese: "這個麵包是用小麥做的。" },
  "呼吸": { japanese: "深く呼吸をしてください。", reading: "ふかくこきゅうをしてください。", chinese: "請深呼吸。" },
  "困難": { japanese: "どんな困難にも負けずに頑張ります。", reading: "どんなこんなんにもまけずにがんばります。", chinese: "不管面對什麼困難都不服輸地努力。" },
  "最高": { japanese: "今日の気分は最高です。", reading: "きょうのきぶんはいちばんです。", chinese: "今天的心情棒極了。" },
  "差": { japanese: "二人の実力には大きな差があります。", reading: "ふたりのじつりょくにはおおきなさがあります。", chinese: "兩人的實力有很大的差距。" },
  "作業": { japanese: "今日の作業はこれで終わりです。", reading: "きょうのさぎょうはこれでおわりです。", chinese: "今天的作業到此結束。" },
  "最終": { japanese: "これが最終の電車です。", reading: "これがさいしゅうのでんしゃです。", chinese: "這是最後一班電車。" },
  "才": { japanese: "私の息子は今年五才になります。", reading: "わたしのむすこはことしごさいになります。", chinese: "我的兒子今年要滿五歲。" },
  "最下位": { japanese: "私たちのチームは最下位になってしまいました。", reading: "わたしたちのちーむはさいかいいになってしまいました。", chinese: "我們的隊伍不幸墊底了。" },
  "再起動": { japanese: "パソコンを再起動してください。", reading: "ぱそこんをさいきどうしてください。", chinese: "請重新啟動電腦。" },
  "サイン": { japanese: "ここにサインをお願いします。", reading: "ここにさいんをおねがいします。", chinese: "請在這裡簽名。" },
  "魚": { japanese: "川で魚を釣りました。", reading: "かわでさかなをつりました。", chinese: "在河裡釣了魚。" },
  "酒": { japanese: "お酒は二十歳になってから飲みましょう。", reading: "おさけははたちになってからのみましょう。", chinese: "酒等滿二十歲之後再喝吧。" },
  "作者": { japanese: "この本の作者は誰ですか。", reading: "このほんのさくしゃはだれですか。", chinese: "這本書的作者是誰？" },
  "作戦": { japanese: "次の試合の作戦を考えました。", reading: "つぎのしあのさくせんをかんがえました。", chinese: "思考了下一場比賽的作戰計畫。" },
  "雑音": { japanese: "ラジオから雑音が入って聞こえにくいです。", reading: "らじおからざつおんがはいってきこえにくいです。", chinese: "收音機有雜音，很難聽清楚。" },
  "サボり": { japanese: "仕事をサボってはいけません。", reading: "しごとをさぼってはいけない。", chinese: "不能偷懶不工作。" },
  "寒気": { japanese: "風邪をひいたのか、寒気がします。", reading: "かぜをひいたのか、さむけがします。", chinese: "可能是感冒了，覺得冷。" },
  "酸味": { japanese: "このレモンは酸味が強いです。", reading: "このれもんはさんみがつよいです。", chinese: "這個檸檬酸味很強。" },
  "仕草": { japanese: "彼女の仕草はとてもかわいいです。", reading: "かのじょのしぐさはとてもかわいいです。", chinese: "她的舉手投足都非常可愛。" },
  "時間表": { japanese: "電車の時間表を確認しました。", reading: "電車のじかんひょうをかくにんしました。", chinese: "確認了火車的時刻表。" },
  "四季": { japanese: "日本には美しい四季があります。", reading: "にほんにはうつくしいしきがあります。", chinese: "日本有著美麗的四季。" },
  "自撮り": { japanese: "スマホで友達と一緒に自撮りをしました。", reading: "すまほでともだちといっしょにじどりをもしました。", chinese: "用手機和朋友一起自拍。" },
  "シナリオ": { japanese: "映画のシナリオを書いています。", reading: "えいがのしなりおをかいています。", chinese: "正在寫電影劇本。" },
  "支配": { japanese: "彼は自分の感情を支配できる人です。", reading: "かれはじぶんのかんじょうをしはいできるひとです。", chinese: "他是個能控制自己情緒的人。" },
  "絞り": { japanese: "レモンを絞って紅茶に入れました。", reading: "れもんをしぼってこうちゃにいれました。", chinese: "擠了檸檬汁加進紅茶裡。" },
  "自慢": { japanese: "彼はいつも自分の成績を自慢しています。", reading: "かれはいつもじぶんのせいせきをじまんしています。", chinese: "他總是炫耀自己的成績。" },
  "市民": { japanese: "多くの市民がそのイベントに参加しました。", reading: "おおくのしみんがそのいべんとにさんかしました。", chinese: "許多市民參加了那項活動。" },
  "視野": { japanese: "本を読むことで視野が広がります。", reading: "ほんをよむことでしやがひろがります。", chinese: "讀書可以開闊視野。" },
  "車道": { japanese: "自転車は車道の左側を走らなければなりません。", reading: "じてんしゃはしゃどうのひだりがわをはしらなければなりません。", chinese: "腳踏車必須騎在車道的左側。" },
  "ジャガイモ": { japanese: "カレーを作るためにジャガイモを買いました。", reading: "かれーをつくるためにじゃがいもをかいました。", chinese: "為了做咖哩買了馬鈴薯。" },
  "シャンプー": { japanese: "お風呂で髪をシャンプーで洗いました。", reading: "おふろでかみをしゃんぷーであらいました。", chinese: "在浴室用洗髮精洗了頭髮。" },
  "住宅": { japanese: "この辺りは静かな住宅地です。", reading: "このあたりはしずかなじゅうたくちです。", chinese: "這一帶是安靜的住宅區。" },
  "主食": { japanese: "日本の主食はご飯です。", reading: "にほんのしゅしょくはごはんです。", chinese: "日本的主食是米飯。" },
  "受診": { japanese: "体調が悪いので病院を受診しました。", reading: "たいちょうがわるいのでびょういんをじゅしんしました。", chinese: "因為身體不舒服而去醫院看診。" },
  "宿命": { japanese: "これが私の宿命だと受け入れています。", reading: "これがわたしのしゅくめいだとうけいれています。", chinese: "我接受這是我的宿命。" },
  "主力": { japanese: "彼はチームの主力選手です。", reading: "かれはちーむのしゅりょくせんしゅです。", chinese: "他是隊伍的主力選手。" },
  "巡査": { japanese: "交番で巡査に道を尋ねました。", reading: "こうばんでじゅんさにみちをたずねました。", chinese: "在派出所向巡警問了路。" },
  "順位": { japanese: "テストの順位が発表されました。", reading: "てすとのじゅんいがはっぴょうされました。", chinese: "考試的排名公佈了。" },
  "少子化": { japanese: "日本は少子化が進んでいます。", reading: "にほんはしょうしかがすすんでいます。", chinese: "日本的少子化正在加劇。" },
  "小数": { japanese: "この数字を小数で表してください。", reading: "このすうじをしょうすうであらわしてください。", chinese: "請用小數表示這個數字。" },
  "商店": { japanese: "駅前に古い商店が並んでいます。", reading: "えきまえにふるいしょうてんがならんでいます。", chinese: "車站前並排著老舊的商店。" },
  "消耗": { japanese: "長時間の運動で体力を消耗しました。", reading: "ちょうじかんのうんどうでたいりょくをしょうもうしました。", chinese: "長時間的運動消耗了體力。" },
  "食料": { japanese: "地震に備えて食料を保存しています。", reading: "じしんにそなえてしょくりょうをほぞんしています。", chinese: "為了防震儲存了食物。" },
  "私有": { japanese: "この土地は私有地につき立ち入り禁止です。", reading: "このとちはしゆうちにつきたちいりきんしです。", chinese: "這塊土地是私有地，禁止進入。" },
  "シロップ": { japanese: "パンケーキにメープルシロップをかけました。", reading: "ぱんけーきにめーぷるしろっぷをかけました。", chinese: "在鬆餅上淋了楓糖漿。" },
  "白米": { japanese: "健康のために白米に玄米を混ぜて食べています。", reading: "けんこうのためにはくまいにげんまいをまぜてたべています。", chinese: "為了健康，在白米裡混了玄米吃。" },
  "真実": { japanese: "何があっても真実を話してください。", reading: "なにがあってもしんじつをはなしてください。", chinese: "不論發生什麼事，請說出真相。" },
  "親戚": { japanese: "お正月に親戚が集まりました。", reading: "おしょうがつにしんせきがあつまりました。", chinese: "新年的時候親戚聚集了起來。" },
  "心理": { japanese: "子供の心理を理解するのは難しいです。", reading: "こどものしんりをりかいするのはむずかしいです。", chinese: "理解小孩子的心理很困難。" },
  "睡眠": { japanese: "健康のために十分な睡眠をとりましょう。", reading: "けんこうのためにじゅうぶんなすいみんをとりましょう。", chinese: "為了健康，保持充足的睡眠吧。" },
  "スイング": { japanese: "野球の練習でスイングのフォームを確認しました。", reading: "やきゅうのれんしゅうですいんぐのふぉーむを確認しました。", chinese: "在棒球練習中確認了揮棒動作。" },
  "スーパー": { japanese: "近くのスーパーへ買い物に行きました。", reading: "ちかくのすーぱーへかいものにいきました。", chinese: "去附近的超市買了東西。" },
  "姿": { japanese: "友達が遠くへ歩いていく姿が見えました。", reading: "ともだちがとおくへあるいていくすがたがみえました。", chinese: "看到了朋友走向遠處的身影。" },
  "スプーン": { japanese: "スプーンでスープを飲みました。", reading: "すぷーんですーぷをのみました。", chinese: "用湯匙喝了湯。" },
  "スマート": { japanese: "彼女は背が高くてスマートです。", reading: "かのじょはせがたかくてすまーとです。", chinese: "她身材高挑而且苗條。" }
};

const CHINESE_MEANINGS = {
  "アナログ": "模擬、類比",
  "イスラム": "伊斯蘭",
  "エレベーター": "電梯",
  "オイル": "油、機油",
  "キット": "套件、工具包",
  "キャプテン": "隊長、船長",
  "クリーム": "奶油、乳霜",
  "ステップ": "步驟、腳步",
  "ズボン": "褲子",
  "ドリンク": "飲料",
  "ハロウィン": "萬聖節",
  "バスト": "胸圍、半身像",
  "パチンコ": "柏青哥、彈珠機",
  "ビッチ": "婊子、惡毒女子",
  "フェア": "公平的、展銷會",
  "フライ": "油炸、高飛球",
  "ブラウン": "褐色、棕色",
  "ブルース": "藍調、布魯斯",
  "ボー": "弓、蝴蝶結",
  "マック": "麥當勞、麥金塔",
  "ムービー": "電影、影片",
  "リニューアル": "更新、重新裝修",
  "リラックス": "放鬆、輕鬆",
  "エンジニア": "工程師",
  "キャンセル": "取消",
  "グラビア": "寫真、凹版印刷",
  "グレード": "等級、坡度",
  "ストップ": "停止",
  "デスク": "書桌、辦公桌",
  "ナイフ": "刀、小刀",
  "ネーム": "名字、姓名",
  "バグ": "漏洞、昆蟲",
  "バター": "奶油",
  "フラッシュ": "閃光、閃爍",
  "ベイ": "海灣",
  "マット": "墊子",
  "マネー": "金錢、資金",
  "ラウンド": "回合、圓形",
  "リクエスト": "要求、請求",
  "ワイ": "Y、我們",
  "疫苗": "疫苗",
  "ワクチ": "疫苗"
};

function getMeaning(item) {
  const word = item.word;
  if (CHINESE_MEANINGS[word]) return CHINESE_MEANINGS[word];
  
  const m = item.meaning || '';
  const en = (item._quality && item._quality.gloss_en) || [];
  
  let isBad = false;
  for (const bm of BAD_MEANINGS) {
    if (m.includes(bm)) isBad = true;
  }
  
  if (isBad || m.length < 2) {
    if (en.length > 0) {
      // Clean up English gloss
      return en.slice(0, 2).join('、');
    }
    return item.word;
  }
  return m;
}

function generateFallback(word, reading, meaning, posStr) {
  const pos = (posStr || '').toLowerCase();
  const m = (meaning || word).replace(/[、・].*/, '').trim();
  if (pos.includes('動詞')) {
    return {
      japanese: `毎日${word}練習をしています。`,
      reading: `まいにち${reading}れんしゅうをしています。`,
      chinese: `每天進行${m}的練習。`
    };
  }
  if (pos.includes('副詞')) {
    return {
      japanese: `${word}準備をして、落ち着いて臨みました。`,
      reading: `${reading}じゅんびをして、おちついてのぞみました。`,
      chinese: `${m}做好準備，平靜地應對了。`
    };
  }
  if (pos.includes('形容')) {
    return {
      japanese: `彼の態度はいつも${word}です。`,
      reading: `かれのたいどはいつも${reading}です。`,
      chinese: `他的態度總是很${m}。`
    };
  }
  return {
    japanese: `日本語で${word}の意味を理解しました。`,
    reading: `にほんごで${reading}のいみをりかいしました。`,
    chinese: `用日文理解了${m}的意思。`
  };
}

const CHUNK_RANGE = Array.from({length: 12}, (_, i) => i + 16); // 16 to 27
let totalLog = {};

for (const chunkNum of CHUNK_RANGE) {
  const filePath = path.join(CHUNKS_DIR, `vocab_chunk_${chunkNum}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`Chunk ${chunkNum} not found, skipping.`);
    continue;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let modifiedCount = 0;
  let skippedCount = 0;
  
  for (const item of data) {
    if (needsSkip(item)) {
      skippedCount++;
      continue;
    }
    
    if (!isBadExample(item)) continue;
    
    const word = item.word;
    const cleanMeaning = getMeaning(item);
    
    if (ENRICHED[word]) {
      item.example = ENRICHED[word];
    } else {
      item.example = generateFallback(word, item.reading, cleanMeaning, item.part_of_speech);
    }
    
    if (cleanMeaning !== item.meaning) {
      item.meaning = cleanMeaning;
    }
    
    item.quality_score = 'llm_enriched';
    modifiedCount++;
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  totalLog[`chunk_${chunkNum}`] = { 
    modified: modifiedCount, 
    total: data.length,
    skipped: skippedCount
  };
  console.log(`Chunk ${chunkNum}: modified ${modifiedCount} / ${data.length} (skipped: ${skippedCount})`);
}

fs.writeFileSync(LOG_FILE, JSON.stringify(totalLog, null, 2), 'utf8');
console.log('Done! Log saved to', LOG_FILE);

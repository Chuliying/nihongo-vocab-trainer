#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const CHUNKS_DIR = path.join(process.cwd(), "public", "data", "chunks");
const OUT_DIR = path.join(process.cwd(), "scratch", "cleanup_pipeline");
const DEFAULT_OUT = path.join(OUT_DIR, "verb_info_candidates.json");

const GODAN = {
  う: { masu: "い", te: "って", ta: "った", nai: "わ", potential: "え", imperative: "え", conditional: "え", volitional: "お" },
  く: { masu: "き", te: "いて", ta: "いた", nai: "か", potential: "け", imperative: "け", conditional: "け", volitional: "こ" },
  ぐ: { masu: "ぎ", te: "いで", ta: "いだ", nai: "が", potential: "げ", imperative: "げ", conditional: "げ", volitional: "ご" },
  す: { masu: "し", te: "して", ta: "した", nai: "さ", potential: "せ", imperative: "せ", conditional: "せ", volitional: "そ" },
  つ: { masu: "ち", te: "って", ta: "った", nai: "た", potential: "て", imperative: "て", conditional: "て", volitional: "と" },
  ぬ: { masu: "に", te: "んで", ta: "んだ", nai: "な", potential: "ね", imperative: "ね", conditional: "ね", volitional: "の" },
  ぶ: { masu: "び", te: "んで", ta: "んだ", nai: "ば", potential: "べ", imperative: "べ", conditional: "べ", volitional: "ぼ" },
  む: { masu: "み", te: "んで", ta: "んだ", nai: "ま", potential: "め", imperative: "め", conditional: "め", volitional: "も" },
  る: { masu: "り", te: "って", ta: "った", nai: "ら", potential: "れ", imperative: "れ", conditional: "れ", volitional: "ろ" },
};

const REVIEW_SURFACES = new Set(["ます", "なく", "たく", "こう", "おう", "とう", "ゆう", "如く"]);
const REVIEWED_DERIVED_OR_AMBIGUOUS = new Set([
  "できる\tできる",
  "言える\tいえる",
  "もらえる\tもらえる",
  "いける\tいける",
  "切れる\tきれる",
  "使える\tつかえる",
  "行ける\tいける",
  "読める\tよめる",
  "いただける\tいただける",
  "思える\tおもえる",
  "見れる\tみれる",
  "取れる\tとれる",
  "稼げる\tかせげる",
  "笑える\tわらえる",
  "話せる\tはなせる",
  "持てる\tもてる",
  "飲める\tのめる",
  "聞ける\tきける",
  "眠れる\tねむれる",
  "泣ける\tなける",
  "食える\tくえる",
  "まくれる\tまくれる",
  "撮れる\tとれる",
  "引ける\tひける",
]);
const REVIEWED_SUPPRESS = new Map([
  ["ます\tます", "grammaticalized or inflected surface"],
  ["てる\tてる", "colloquial contraction of ている"],
  ["れる\tれる", "auxiliary passive, potential, or honorific surface"],
  ["なく\tなく", "inflected or grammaticalized surface"],
  ["たく\tたく", "inflected or grammaticalized surface"],
  ["せる\tせる", "auxiliary causative surface"],
  ["による\tによる", "multi-token grammatical expression"],
  ["ちゃう\tちゃう", "colloquial contraction of てしまう"],
  ["こう\tこう", "grammaticalized or inflected surface"],
  ["よる\tよる", "auxiliary surface with ambiguous lexical identity"],
  ["とる\tとる", "colloquial contraction represented as an expression"],
  ["とく\tとく", "colloquial contraction of ておく"],
  ["がる\tがる", "derivational suffix surface"],
  ["ついてる\tついてる", "colloquial expression rather than dictionary verb"],
  ["おう\tおう", "grammaticalized or inflected surface"],
  ["とう\tとう", "grammaticalized or inflected surface"],
  ["ゆう\tゆう", "grammaticalized or nonstandard surface"],
  ["はる\tはる", "dialectal honorific auxiliary surface"],
  ["とある\tとある", "fixed expression rather than dictionary verb"],
  ["ちまう\tちまう", "colloquial contraction of てしまう"],
  ["如く\tしく", "grammaticalized surface"],
  ["さす\tさす", "causative auxiliary surface"],
  ["まう\tまう", "auxiliary completion surface"],
  ["なう\tなう", "derivational suffix surface"],
  ["しめる\tしめる", "auxiliary causative or honorific surface"],
  ["づく\tづく", "derivational suffix surface"],
]);
const GODAN_RU_EXCEPTIONS = new Set([
  "帰る",
  "切る",
  "知る",
  "走る",
  "入る",
  "要る",
  "減る",
  "蹴る",
  "滑る",
  "参る",
  "混じる",
  "交じる",
  "握る",
  "限る",
  "喋る",
]);

// Exact lexical reviews for quarantined ru-ending verbs. Keep this deliberately
// small and require both surface and reading so homographs do not inherit a
// conjugation class accidentally.
const REVIEWED_ICHIDAN = new Set([
  "くれる\tくれる",
  "でる\tでる",
  "すぎる\tすぎる",
  "あげる\tあげる",
  "なれる\tなれる",
  "つける\tつける",
  "かける\tかける",
  "やめる\tやめる",
  "える\tえる",
  "見せる\tみせる",
  "ばれる\tばれる",
  "終える\tおえる",
  "夢見る\tゆめみる",
  "いてる\tいてる",
  "かえる\tかえる",
  "考える\tかんがえる",
  "感じる\tかんじる",
  "入れる\tいれる",
  "与える\tあたえる",
  "変える\tかえる",
  "求める\tもとめる",
  "生きる\tいきる",
  "決める\tきめる",
  "伝える\tつたえる",
  "落ちる\tおちる",
  "生まれる\tうまれる",
  "認める\tみとめる",
  "流れる\tながれる",
  "逃げる\tにげる",
  "消える\tきえる",
  "付ける\tつける",
  "信じる\tしんじる",
  "捨てる\tすてる",
  "調べる\tしらべる",
  "集める\tあつめる",
  "増える\tふえる",
  "現れる\tあらわれる",
  "避ける\tさける",
  "答える\tこたえる",
  "負ける\tまける",
  "比べる\tくらべる",
  "触れる\tふれる",
  "迎える\tむかえる",
  "抜ける\tぬける",
  "進める\tすすめる",
  "育てる\tそだてる",
  "売れる\tうれる",
  "演じる\tえんじる",
  "立てる\tたてる",
  "合わせる\tあわせる",
  "生じる\tしょうじる",
  "訪れる\tおとずれる",
  "受け入れる\tうけいれる",
  "伸びる\tのびる",
  "加える\tくわえる",
  "助ける\tたすける",
  "見かける\tみかける",
  "投げる\tなげる",
  "勤める\tつとめる",
  "支える\tささえる",
  "抑える\tおさえる",
  "高める\tたかめる",
  "出かける\tでかける",
  "定める\tさだめる",
  "溢れる\tあふれる",
  "諦める\tあきらめる",
  "疲れる\tつかれる",
  "当てる\tあてる",
  "離れる\tはなれる",
  "まとめる\tまとめる",
  "燃える\tもえる",
  "訴える\tうったえる",
  "占める\tしめる",
  "下げる\tさげる",
  "用いる\tもちいる",
  "遅れる\tおくれる",
  "分ける\tわける",
  "通じる\tつうじる",
  "揺れる\tゆれる",
  "別れる\tわかれる",
  "壊れる\tこわれる",
  "乗せる\tのせる",
  "抱える\tかかえる",
  "埋める\tうめる",
  "挙げる\tあげる",
  "任せる\tまかせる",
  "痩せる\tやせる",
  "倒れる\tたおれる",
  "掛ける\tかける",
  "掲げる\tかかげる",
  "重ねる\tかさねる",
  "向ける\tむける",
  "広げる\tひろげる",
  "生える\tはえる",
  "確かめる\tたしかめる",
  "届ける\tとどける",
  "間違える\tまちがえる",
  "浴びる\tあびる",
  "震える\tふるえる",
  "憧れる\tあこがれる",
  "耐える\tたえる",
  "建てる\tたてる",
  "数える\tかぞえる",
  "率いる\tひきいる",
  "眺める\tながめる",
  "述べる\tのべる",
  "分かれる\tわかれる",
  "告げる\tつげる",
  "備える\tそなえる",
  "逃れる\tのがれる",
  "飽きる\tあきる",
  "捉える\tとらえる",
  "仕える\tつかえる",
  "傷つける\tきずつける",
  "設ける\tもうける",
  "取り上げる\tとりあげる",
  "尽きる\tつきる",
  "捧げる\tささげる",
  "欠ける\tかける",
  "片付ける\tかたづける",
  "目覚める\tめざめる",
  "責める\tせめる",
  "追いかける\tおいかける",
  "例える\tたとえる",
  "閉じる\tとじる",
  "控える\tひかえる",
  "含める\tふくめる",
  "唱える\tとなえる",
  "外れる\tはずれる",
  "知らせる\tしらせる",
  "切り替える\tきりかえる",
  "話しかける\tはなしかける",
  "仕掛ける\tしかける",
  "崩れる\tくずれる",
  "恐れる\tおそれる",
  "折れる\tおれる",
  "攻める\tせめる",
  "混ぜる\tまぜる",
  "見つめる\tみつめる",
  "覚める\tさめる",
  "勧める\tすすめる",
  "叶える\tかなえる",
  "応える\tこたえる",
  "引き上げる\tひきあげる",
  "試みる\tこころみる",
  "見える\tみえる",
  "越える\tこえる",
  "聞こえる\tきこえる",
  "鍛える\tきたえる",
  "応じる\tおうじる",
  "弾ける\tはじける",
  "舐める\tなめる",
  "尋ねる\tたずねる",
  "手がける\tてがける",
  "整える\tととのえる",
  "捕まえる\tつかまえる",
  "盛り上げる\tもりあげる",
  "置き換える\tおきかえる",
  "収める\tおさめる",
  "広める\tひろめる",
  "溶ける\tとける",
  "溺れる\tおぼれる",
  "足りる\tたりる",
  "揃える\tそろえる",
  "暴れる\tあばれる",
  "近づける\tちかづける",
  "隠れる\tかくれる",
  "和える\tあえる",
  "組み合わせる\tくみあわせる",
  "褒める\tほめる",
  "ぶつける\tぶつける",
  "休める\tやすめる",
  "受け止める\tうけとめる",
  "構える\tかまえる",
  "割れる\tわれる",
  "引き受ける\tひきうける",
  "萎える\tなえる",
  "預ける\tあずける",
  "ふざける\tふざける",
  "取り入れる\tとりいれる",
  "寄せる\tよせる",
  "済ませる\tすませる",
  "晴れる\tはれる",
  "深める\tふかめる",
  "繰り広げる\tくりひろげる",
  "解ける\tとける",
  "追い詰める\tおいつめる",
  "乗り越える\tのりこえる",
  "貯める\tためる",
  "つなげる\tつなげる",
  "取り付ける\tとりつける",
  "命じる\tめいじる",
  "極める\tきわめる",
  "賭ける\tかける",
  "乗り換える\tのりかえる",
  "込める\tこめる",
  "固める\tかためる",
  "妨げる\tさまたげる",
]);

const REVIEWED_GODAN = new Set([
  "違う\tちがう",
  "いく\tいく",
  "やる\tやる",
  "しまう\tしまう",
  "わかる\tわかる",
  "おく\tおく",
  "もらう\tもらう",
  "かかる\tかかる",
  "つく\tつく",
  "かつ\tかつ",
  "いただく\tいただく",
  "かく\tかく",
  "倒す\tたおす",
  "ふく\tふく",
  "願う\tねがう",
  "回す\tまわす",
  "役に立つ\tやくにたつ",
  "なす\tなす",
  "果たす\tはたす",
  "たつ\tたつ",
  "つる\tつる",
  "ける\tける",
  "あらす\tあらす",
  "ぶつ\tぶつ",
  "つなぐ\tつなぐ",
  "たまる\tたまる",
  "こなす\tこなす",
  "はく\tはく",
  "こむ\tこむ",
  "なくす\tなくす",
  "ぶる\tぶる",
  "かす\tかす",
  "あく\tあく",
  "どく\tどく",
  "かる\tかる",
  "すく\tすく",
  "しげる\tしげる",
  "ずる\tずる",
  "いじる\tいじる",
  "いぬ\tいぬ",
  "わく\tわく",
  "まく\tまく",
  "かおる\tかおる",
  "逃す\tのがす",
  "むす\tむす",
  "たどる\tたどる",
  "しのぶ\tしのぶ",
  "みなす\tみなす",
  "合う\tあう",
  "上がる\tあがる",
  "居る\tおる",
  "飛ばす\tとばす",
  "去る\tさる",
  "腐る\tくさる",
  "まくる\tまくる",
  "変わる\tかわる",
  "取る\tとる",
  "異なる\tことなる",
  "始まる\tはじまる",
  "守る\tまもる",
  "残る\tのこる",
  "困る\tこまる",
  "売る\tうる",
  "起こる\tおこる",
  "語る\tかたる",
  "当たる\tあたる",
  "戻る\tもどる",
  "関わる\tかかわる",
  "切る\tきる",
  "至る\tいたる",
  "通る\tとおる",
  "なくなる\tなくなる",
  "集まる\tあつまる",
  "見つかる\tみつかる",
  "撮る\tとる",
  "繋がる\tつながる",
  "頑張る\tがんばる",
  "広がる\tひろがる",
  "怒る\tおこる",
  "伝わる\tつたわる",
  "助かる\tたすかる",
  "誇る\tほこる",
  "踊る\tおどる",
  "回る\tまわる",
  "減る\tへる",
  "下がる\tさがる",
  "決まる\tきまる",
  "図る\tはかる",
  "止まる\tとまる",
  "治る\tなおる",
  "光る\tひかる",
  "降る\tふる",
  "受け取る\tうけとる",
  "喋る\tしゃべる",
  "祈る\tいのる",
  "触る\tさわる",
  "迫る\tせまる",
  "塗る\tぬる",
  "巡る\tめぐる",
  "眠る\tねむる",
  "上回る\tうわまわる",
  "無くなる\tなくなる",
  "湿る\tしめる",
  "張る\tはる",
  "名乗る\tなのる",
  "振る\tふる",
  "高まる\tたかまる",
  "殴る\tなぐる",
  "盛り上がる\tもりあがる",
  "飾る\tかざる",
  "加わる\tくわわる",
  "頼る\tたよる",
  "こだわる\tこだわる",
  "謝る\tあやまる",
  "限る\tかぎる",
  "捕まる\tつかまる",
  "断る\tことわる",
  "贈る\tおくる",
  "振り返る\tふりかえる",
  "操る\tあやつる",
  "握る\tにぎる",
  "映る\tうつる",
  "上る\tのぼる",
  "移る\tうつる",
  "被る\tかぶる",
  "陥る\tおちいる",
  "鳴る\tなる",
  "探る\tさぐる",
  "破る\tやぶる",
  "要る\tいる",
  "してやる\tしてやる",
  "生き残る\tいきのこる",
  "替わる\tかわる",
  "引っ張る\tひっぱる",
  "見守る\tみまもる",
  "嵌まる\tはまる",
  "割る\tわる",
  "収まる\tおさまる",
  "係る\tかかる",
  "当てはまる\tあてはまる",
  "重なる\tかさなる",
  "儲かる\tもうかる",
  "嫌がる\tいやがる",
  "携わる\tたずさわる",
  "ビビる\tビビる",
  "太る\tふとる",
  "劣る\tおとる",
  "削る\tけずる",
  "掘る\tほる",
  "泊まる\tとまる",
  "焦る\tあせる",
  "配る\tくばる",
  "蘇る\tよみがえる",
  "勝る\tまさる",
  "散る\tちる",
  "裏切る\tうらぎる",
  "寄る\tよる",
  "譲る\tゆずる",
  "ぶつかる\tぶつかる",
  "下る\tくだる",
  "貯まる\tたまる",
  "折る\tおる",
  "計る\tはかる",
  "立ち上がる\tたちあがる",
  "捗る\tはかどる",
  "煽る\tあおる",
  "滑る\tすべる",
  "とどまる\tとどまる",
  "余る\tあまる",
  "下回る\tしたまわる",
  "斬る\tきる",
  "引っかかる\tひっかかる",
  "載る\tのる",
  "黙る\tだまる",
  "絞る\tしぼる",
]);

const REVIEWED_KURU = new Set([
  "くる\tくる",
  "やってくる\tやってくる",
]);

function isKanaOnly(word) {
  return /^[ぁ-ゟ]+$/.test(String(word || ""));
}

function readEntries() {
  return fs
    .readdirSync(CHUNKS_DIR)
    .filter((name) => /^vocab_chunk_\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    .flatMap((file) => {
      const chunk = JSON.parse(fs.readFileSync(path.join(CHUNKS_DIR, file), "utf8"));
      return chunk.map((entry, index) => ({ entry, file, index }));
    })
    .sort((a, b) => a.entry.id - b.entry.id);
}

function posTokens(entry) {
  return String(entry.part_of_speech || "")
    .split("・")
    .map((token) => token.trim())
    .filter(Boolean);
}

function kanaBeforeRu(word) {
  const chars = Array.from(String(word || ""));
  if (chars[chars.length - 1] !== "る") return "";
  return chars[chars.length - 2] || "";
}

function ichidanLikely(word) {
  const prev = kanaBeforeRu(word);
  return /[いきしちにひみりぎじぢびぴえけせてねへめれげぜでべぺ]/.test(prev) && !GODAN_RU_EXCEPTIONS.has(word);
}

function lexicalKey(entry) {
  return `${String(entry.word || "")}\t${String(entry.reading || "")}`;
}

function sStem(word) {
  return word.slice(0, -"する".length);
}

function conjugateSuru(word) {
  const stem = word === "する" ? "" : sStem(word);
  return {
    verb_type: "サ変動詞",
    dictionary_form: word,
    masu_form: stem + "します",
    te_form: stem + "して",
    ta_form: stem + "した",
    nai_form: stem + "しない",
    potential_form: stem + "できる",
    passive_form: stem + "される",
    causative_form: stem + "させる",
    imperative_form: stem + "しろ",
    conditional_form: stem + "すれば",
    volitional_form: stem + "しよう",
    notes: "deterministic candidate",
  };
}

function conjugateKuru(word) {
  if (word.endsWith("くる") && word !== "くる") {
    const stem = word.slice(0, -"くる".length);
    return {
      verb_type: "カ変動詞",
      dictionary_form: word,
      masu_form: stem + "きます",
      te_form: stem + "きて",
      ta_form: stem + "きた",
      nai_form: stem + "こない",
      potential_form: stem + "こられる",
      passive_form: stem + "こられる",
      causative_form: stem + "こさせる",
      imperative_form: stem + "こい",
      conditional_form: stem + "くれば",
      volitional_form: stem + "こよう",
      notes: "deterministic candidate",
    };
  }
  return {
    verb_type: "カ変動詞",
    dictionary_form: word,
    masu_form: word === "来る" ? "来ます" : "きます",
    te_form: word === "来る" ? "来て" : "きて",
    ta_form: word === "来る" ? "来た" : "きた",
    nai_form: word === "来る" ? "来ない" : "こない",
    potential_form: word === "来る" ? "来られる" : "こられる",
    passive_form: word === "来る" ? "来られる" : "こられる",
    causative_form: word === "来る" ? "来させる" : "こさせる",
    imperative_form: word === "来る" ? "来い" : "こい",
    conditional_form: word === "来る" ? "来れば" : "くれば",
    volitional_form: word === "来る" ? "来よう" : "こよう",
    notes: "deterministic candidate",
  };
}

function conjugateIchidan(word) {
  const stem = word.slice(0, -1);
  return {
    verb_type: "一段動詞",
    dictionary_form: word,
    masu_form: stem + "ます",
    te_form: stem + "て",
    ta_form: stem + "た",
    nai_form: stem + "ない",
    potential_form: stem + "られる",
    passive_form: stem + "られる",
    causative_form: stem + "させる",
    imperative_form: stem + "ろ",
    conditional_form: stem + "れば",
    volitional_form: stem + "よう",
    notes: "deterministic candidate",
  };
}

function conjugateGodan(word) {
  const last = Array.from(word).pop();
  const rule = GODAN[last];
  if (!rule) return null;
  const stem = word.slice(0, -1);
  const specialIku = word === "行く" || word === "いく";
  return {
    verb_type: "五段動詞",
    dictionary_form: word,
    masu_form: stem + rule.masu + "ます",
    te_form: specialIku ? stem + "って" : stem + rule.te,
    ta_form: specialIku ? stem + "った" : stem + rule.ta,
    nai_form: stem + rule.nai + "ない",
    potential_form: stem + rule.potential + "る",
    passive_form: stem + rule.nai + "れる",
    causative_form: stem + rule.nai + "せる",
    imperative_form: stem + rule.imperative,
    conditional_form: stem + rule.conditional + "ば",
    volitional_form: stem + rule.volitional + "う",
    notes: "deterministic candidate",
  };
}

function inferCandidate(entry) {
  const quarantine = entry._quality && entry._quality.verb_info_quarantine;
  if (!quarantine) return null;

  const word = String(entry.word || "");
  const oldType = quarantine.previous && quarantine.previous.verb_type;
  const tokens = posTokens(entry);
  const hasVerbToken = tokens.includes("動詞");
  const hasAuxiliaryOrExpression = tokens.includes("助動詞") || tokens.includes("表現");
  const cleanIndependentVerb = hasVerbToken && !hasAuxiliaryOrExpression;
  const suppressReason = REVIEWED_SUPPRESS.get(lexicalKey(entry));
  if (suppressReason) {
    return { confidence: "suppress", reason: suppressReason, verb_info: null };
  }
  if (REVIEW_SURFACES.has(word)) return { confidence: "review", reason: "grammaticalized surface", verb_info: null };
  if (REVIEWED_DERIVED_OR_AMBIGUOUS.has(lexicalKey(entry))) {
    return {
      confidence: "suppress",
      reason: "potential, colloquial, or multi-POS surface is not representable by the full conjugation schema",
      verb_info: null,
    };
  }
  if (hasVerbToken && REVIEWED_KURU.has(lexicalKey(entry))) {
    return {
      confidence: "high",
      reason: "exact surface and reading in reviewed kuru lexicon",
      verb_info: conjugateKuru(word),
    };
  }
  if (hasVerbToken && REVIEWED_GODAN.has(lexicalKey(entry))) {
    return {
      confidence: "high",
      reason: "exact surface and reading in reviewed godan lexicon",
      verb_info: conjugateGodan(word),
    };
  }
  if (hasVerbToken && REVIEWED_ICHIDAN.has(lexicalKey(entry))) {
    return {
      confidence: "high",
      reason: "exact surface and reading in reviewed ichidan lexicon",
      verb_info: conjugateIchidan(word),
    };
  }
  if (isKanaOnly(word) && word.length <= 3) {
    return { confidence: "review", reason: "short kana-only surface needs lexical review", verb_info: null };
  }

  if (word === "する" || word.endsWith("する")) {
    return { confidence: cleanIndependentVerb ? "high" : "review", reason: "suru pattern", verb_info: conjugateSuru(word) };
  }
  if (word === "来る" || entry.reading === "くる") {
    return { confidence: cleanIndependentVerb ? "high" : "review", reason: "kuru pattern", verb_info: conjugateKuru(word) };
  }
  if (oldType === "五段動詞" && cleanIndependentVerb && !word.endsWith("る")) {
    return { confidence: "high", reason: "non-ru godan with clean verb POS", verb_info: conjugateGodan(word) };
  }
  if (oldType === "五段動詞" && cleanIndependentVerb && word.endsWith("る")) {
    return { confidence: "medium", reason: "ru-ending godan needs review", verb_info: conjugateGodan(word) };
  }
  if (oldType === "一段動詞" && cleanIndependentVerb && ichidanLikely(word)) {
    return { confidence: "medium", reason: "likely ichidan by kana ending", verb_info: conjugateIchidan(word) };
  }
  return { confidence: "review", reason: "type or POS requires linguistic review", verb_info: null };
}

function validateReviewedLexicon(entries) {
  const matches = new Map(Array.from(REVIEWED_ICHIDAN, (key) => [key, []]));
  const godanMatches = new Map(Array.from(REVIEWED_GODAN, (key) => [key, []]));
  const kuruMatches = new Map(Array.from(REVIEWED_KURU, (key) => [key, []]));
  const suppressMatches = new Map(Array.from(REVIEWED_SUPPRESS.keys(), (key) => [key, []]));
  const reviewedAmbiguousMatches = new Map(
    Array.from(REVIEWED_DERIVED_OR_AMBIGUOUS, (key) => [key, []])
  );
  for (const { entry } of entries) {
    const key = lexicalKey(entry);
    if (matches.has(key)) matches.get(key).push(entry);
    if (godanMatches.has(key)) godanMatches.get(key).push(entry);
    if (kuruMatches.has(key)) kuruMatches.get(key).push(entry);
    if (suppressMatches.has(key)) suppressMatches.get(key).push(entry);
    if (reviewedAmbiguousMatches.has(key)) reviewedAmbiguousMatches.get(key).push(entry);
  }

  const errors = [];
  for (const [key, found] of matches) {
    if (found.length !== 1) {
      errors.push(`${JSON.stringify(key)} matched ${found.length} entries`);
      continue;
    }
    const entry = found[0];
    if (!posTokens(entry).includes("動詞")) errors.push(`${JSON.stringify(key)} no longer has 動詞 POS`);
    const quarantineType = entry._quality?.verb_info_quarantine?.previous?.verb_type;
    const restoredByLexicon =
      entry.verb_info?.verb_type === "一段動詞" &&
      entry._quality?.verb_info_restore?.reason === "exact surface and reading in reviewed ichidan lexicon";
    if (quarantineType !== "一段動詞" && !restoredByLexicon) {
      errors.push(
        `${JSON.stringify(key)} is neither a quarantined ichidan nor a matching reviewed restore`
      );
    }
  }
  for (const [key, found] of godanMatches) {
    if (found.length !== 1) {
      errors.push(`${JSON.stringify(key)} reviewed godan matched ${found.length} entries`);
      continue;
    }
    const entry = found[0];
    if (!posTokens(entry).includes("動詞")) errors.push(`${JSON.stringify(key)} no longer has 動詞 POS`);
    const restoredByLexicon =
      entry.verb_info?.verb_type === "五段動詞" &&
      entry._quality?.verb_info_restore?.reason === "exact surface and reading in reviewed godan lexicon";
    if (!entry._quality?.verb_info_quarantine && !restoredByLexicon) {
      errors.push(`${JSON.stringify(key)} is neither quarantined nor a matching reviewed godan restore`);
    }
  }
  for (const [key, found] of kuruMatches) {
    if (found.length !== 1) {
      errors.push(`${JSON.stringify(key)} reviewed kuru matched ${found.length} entries`);
      continue;
    }
    const entry = found[0];
    const restoredByLexicon =
      entry.verb_info?.verb_type === "カ変動詞" &&
      entry._quality?.verb_info_restore?.reason === "exact surface and reading in reviewed kuru lexicon";
    if (!entry._quality?.verb_info_quarantine && !restoredByLexicon) {
      errors.push(`${JSON.stringify(key)} is neither quarantined nor a matching reviewed kuru restore`);
    }
  }
  for (const [key, found] of suppressMatches) {
    if (found.length !== 1) {
      errors.push(`${JSON.stringify(key)} reviewed suppress surface matched ${found.length} entries`);
      continue;
    }
    const entry = found[0];
    const suppressed = entry._quality?.verb_info_suppressed;
    if (!entry._quality?.verb_info_quarantine && !suppressed) {
      errors.push(`${JSON.stringify(key)} is neither quarantined nor explicitly suppressed`);
    }
    if (entry.verb_info) {
      errors.push(`${JSON.stringify(key)} suppressed surface unexpectedly has verb_info`);
    }
  }
  for (const [key, found] of reviewedAmbiguousMatches) {
    if (found.length !== 1) {
      errors.push(`${JSON.stringify(key)} reviewed ambiguous surface matched ${found.length} entries`);
      continue;
    }
    const entry = found[0];
    if (!entry._quality?.verb_info_quarantine && !entry._quality?.verb_info_suppressed) {
      errors.push(`${JSON.stringify(key)} reviewed ambiguous surface is neither quarantined nor suppressed`);
    }
    if (entry.verb_info) {
      errors.push(`${JSON.stringify(key)} reviewed ambiguous surface unexpectedly has verb_info`);
    }
  }
  if (errors.length) throw new Error(`Reviewed ichidan lexicon is stale:\n- ${errors.join("\n- ")}`);
}

function summarize(rows) {
  const summary = { total: rows.length, byConfidence: {}, restorable: 0 };
  for (const row of rows) {
    summary.byConfidence[row.confidence] = (summary.byConfidence[row.confidence] || 0) + 1;
    if (row.verb_info) summary.restorable++;
  }
  return summary;
}

function main() {
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
  const entries = readEntries();
  validateReviewedLexicon(entries);
  const rows = entries
    .map(({ entry, file, index }) => {
      const candidate = inferCandidate(entry);
      if (!candidate) return null;
      return {
        id: entry.id,
        word: entry.word,
        reading: entry.reading,
        part_of_speech: entry.part_of_speech,
        jlpt_level: entry.jlpt_level,
        file,
        chunk_index: index,
        confidence: candidate.confidence,
        reason: candidate.reason,
        verb_info: candidate.verb_info,
      };
    })
    .filter(Boolean);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    source: "public/data/chunks _quality.verb_info_quarantine",
    rule: "candidate only; apply high confidence separately after validation",
    summary: summarize(rows),
    rows,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ out: path.relative(process.cwd(), outPath), summary: payload.summary }, null, 2));
}

main();

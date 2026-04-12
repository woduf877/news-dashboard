// 영어 불용어 (뉴스 특화)
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','as','is','was','are','were','be','been','being','have',
  'has','had','do','does','did','will','would','could','should','may',
  'might','shall','can','its','this','that','these','those','it',
  'i','you','he','she','we','they','me','him','her','us','them',
  'my','your','his','our','their','what','which','who','when','where',
  'why','how','all','each','every','both','more','most','other','some',
  'such','no','not','only','same','so','than','too','very','just',
  'after','before','into','over','under','up','out','about','new','first',
  'last','long','own','right','next','early','old','public','real','best',
  'free','back','also','now','here','there','then','while','because',
  'between','against','through','during','without','says','say','said',
  'make','made','take','come','know','see','look','want','give','use',
  'find','tell','ask','feel','try','leave','call','keep','let','show',
  'hear','play','run','move','live','hold','bring','write','set','put',
  'due','per','since','still','yet','even','well','day','year','week',
  'month','time','life','part','place','case','work','number','amid',
  'like','off','away','down','going','getting','having','taking','making',
  'using','following','including','according','however','though','already',
  'much','many','less','another','thing','things','people','man','woman',
  'men','women','percent','million','billion','report','reports','news',
  'today','ago','later','soon','once','never','always','often','ever',
  'top','big','high','low','small','large','great','good','bad','two',
  'three','four','five','six','seven','eight','nine','ten','their',
  // URL / HTML 노이즈
  'http','https','www','com','org','net','edu','gov','html','href',
  'url','link','links','click','read','more','full','story','source',
  // Hacker News 메타 필드
  'comments','comment','points','point','ycombinator','hacker',
  'article','articles','post','posts','submit','vote','upvote',
  // 일반 뉴스 노이즈
  'watch','video','photos','photo','image','images','gallery','related',
  'advertisement','sponsored','newsletter','subscribe','sign','login',
  // RSS 피드 메타 필드
  'item','title','description','content','summary','feed','channel',
  'home','page','site','web','rss','xml','atom','entry','entries',
  'win','wins','winning','winner','winners','lost','loss','losing',
  'get','got','set','put','let','run','ran','run','say','said',
  'new','old','big','long','short','good','bad','best','worst',
  'those','these','them','they','when','then','than','that','this',
  'over','under','into','onto','upon','within','between','among',
  'although','despite','around','across','along','behind','beyond',
  'world','country','countries','government','president','minister',
  'officials','officials','state','states','federal','national','local',
  'said','says','told','according','reported','reports','official',
  'one','two','three','also','could','would','should','have','been',
  'were','was','are','not','but','his','her','its','our','their',
  'few','lot','way','days','years','weeks','months','times','back',
  'after','while','being','doing','going','coming','taking','making',
  'getting','having','saying','telling','giving','showing','putting',
  'seeing','knowing','thinking','looking','trying','using','following',
]);

/**
 * 텍스트에서 키워드 추출
 */
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w =>
      w.length >= 3 &&
      !STOP_WORDS.has(w) &&
      !/^\d+$/.test(w) &&         // 순수 숫자 제외
      !/^[a-z]{1,2}$/.test(w)     // 1-2글자 제외
    );
}

/**
 * 기사 배열 → { date → category → keyword → count } 구조로 변환
 */
function extractFromArticles(articles) {
  const result = {};

  for (const article of articles) {
    const date = (article.pub_date || '').slice(0, 10) ||
                  new Date().toISOString().slice(0, 10);
    const text = `${article.title} ${article.description || ''}`;
    const words = tokenize(text);

    // 'all' + 해당 카테고리 양쪽에 기록
    for (const cat of ['all', article.category]) {
      if (!result[date])       result[date] = {};
      if (!result[date][cat])  result[date][cat] = {};

      for (const word of words) {
        result[date][cat][word] = (result[date][cat][word] || 0) + 1;
      }
    }
  }

  return result;
}

// ─── 한국어 키워드 추출 ──────────────────────────────

// 한국어 불용어 (조사·어미·기능어·뉴스 형식어)
const KO_STOP_WORDS = new Set([
  // 조사
  '이','가','은','는','을','를','의','에','에서','로','으로','와','과',
  '도','만','뿐','까지','부터','에게','한테','께','이나','나','이며','며',
  // 어미·서술어
  '이다','있다','없다','하다','되다','했다','한다','됩니다','했습니다',
  '합니다','됩니다','있습니다','없습니다','이다','라고','이라고',
  '하며','되며','하고','되고','했으며','됐으며','라며','이라며',
  // 지시·접속
  '이','그','저','이것','그것','저것','이런','그런','저런','모든','각',
  '및','등','또','또한','그리고','하지만','그러나','그래서','따라서',
  '그런데','한편','반면','아울러','다만','단','물론',
  // 시간·정도
  '지난','이번','올해','내년','최근','현재','당시','오는','이후','이전',
  '지난해','올해','매년','매월','매주','오늘','내일','어제',
  '이날','같은날','전날','다음날',
  // 뉴스 형식어
  '발표','공개','예정','확인','관련','내용','통해','위해','따라','대해',
  '대한','관한','위한','통한','따른','의한','보다','비해','위에','아래',
  '가운데','사이','속에','중에','전에','후에','때문','탓에','덕분',
  // 수량·비율
  '약','총','전체','일부','대부분','여러','다양한','다른','같은',
  '더욱','매우','특히','아직','이미','항상','가장','더','이상','이하',
  // 자주 나오지만 의미 낮은 단어
  '문제','상황','경우','방법','결과','기준','수준','방향','과정','내용',
  '부분','측면','분야','차원','기간','규모','정도','이유','원인',
]);

// 한국어 텍스트 여부 판별
function isKorean(text) {
  return /[\uAC00-\uD7A3]/.test(text);
}

// 한국어 토크나이저 (공백 분리 + 불용어 필터)
function tokenizeKorean(text) {
  return (text || '')
    .replace(/[^\uAC00-\uD7A3\s]/g, ' ')   // 한글·공백만 남김
    .split(/\s+/)
    .filter(w =>
      w.length >= 2 &&                       // 2글자 이상
      !KO_STOP_WORDS.has(w) &&
      !/^\d+$/.test(w)
    );
}

/**
 * 한국 증시 시간창 내 기사에서 키워드 집계 (온디맨드)
 * articles: DB에서 조회한 기사 배열
 * returns: [{ keyword, count, lang }] 정렬된 배열
 */
function computeMarketKeywords(articles, topN = 50) {
  const freq = {};

  for (const article of articles) {
    const text = `${article.title} ${article.description || ''}`;
    const words = isKorean(text) ? tokenizeKorean(text) : tokenize(text);

    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([keyword, count]) => ({
      keyword,
      count,
      lang: isKorean(keyword) ? 'ko' : 'en',
    }));
}

/**
 * 한국 증시 마감 이후 시간창 계산 (KST 기준)
 * 마감: 평일 15:30 KST
 * 주말이면 직전 금요일 15:30으로 소급
 */
function getMarketWindow() {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

  // 전날(또는 직전 영업일) 15:30 KST 계산
  const close = new Date(kst);
  close.setDate(close.getDate() - 1);
  close.setHours(15, 30, 0, 0);

  // 직전 영업일로 소급 (주말 건너뜀)
  const dow = close.getDay(); // 0=일, 6=토
  if (dow === 0) close.setDate(close.getDate() - 2); // 일→금
  if (dow === 6) close.setDate(close.getDate() - 1); // 토→금

  // UTC 변환 (KST = UTC+9)
  const fromUTC = new Date(close.getTime() - 9 * 60 * 60 * 1000);
  const toUTC   = now;

  const fmt = (d) =>
    d.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return {
    from:      fromUTC.toISOString(),
    to:        toUTC.toISOString(),
    fromLabel: fmt(fromUTC) + ' (장 마감)',
    toLabel:   fmt(toUTC),
  };
}

module.exports = {
  tokenize,
  tokenizeKorean,
  extractFromArticles,
  computeMarketKeywords,
  getMarketWindow,
};

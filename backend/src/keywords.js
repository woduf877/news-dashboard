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

module.exports = { tokenize, extractFromArticles };

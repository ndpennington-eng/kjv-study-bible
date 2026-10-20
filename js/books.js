/* Book metadata and reference parser (quick jump). */
var BOOK_ABBR = [
 ["gen","ge","gn"],["exod","exo","ex"],["lev","le","lv"],["num","nu","nm","nb"],["deut","deu","de","dt"],
 ["josh","jos","jsh"],["judg","jdg","jg","jdgs"],["ruth","rth","ru"],["1sam","1sa","1s","1sm","isam"],["2sam","2sa","2s","2sm","iisam"],
 ["1kgs","1ki","1kin","1k","1kings"],["2kgs","2ki","2kin","2k","2kings"],["1chr","1ch","1chron"],["2chr","2ch","2chron"],
 ["ezra","ezr"],["neh","ne"],["esth","est","es"],["job","jb"],["ps","psa","psalm","psalms","pss","psm"],["prov","pro","prv","pr"],
 ["eccl","ecc","eccles","ec","qoh"],["song","sos","so","sng","canticles","songofsongs","songofsolomon"],["isa","is"],["jer","je","jr"],["lam","la"],
 ["ezek","eze","ezk"],["dan","da","dn"],["hos","ho"],["joel","jl"],["amos","am"],["obad","ob","oba"],["jonah","jon","jnh"],["mic","mi"],
 ["nah","na"],["hab","hb"],["zeph","zep","zp"],["hag","hg"],["zech","zec","zc"],["mal","ml"],
 ["matt","mt","mat"],["mark","mk","mr","mrk"],["luke","lk","lu","luk"],["john","jn","jhn","joh"],["acts","ac","act"],["rom","ro","rm"],
 ["1cor","1co","icor"],["2cor","2co","iicor"],["gal","ga"],["eph","ephes"],["phil","php","pp"],["col","co"],
 ["1thess","1th","1thes"],["2thess","2th","2thes"],["1tim","1ti","1tm"],["2tim","2ti","2tm"],["titus","tit","ti"],["phlm","philem","phm","pm"],
 ["heb","he"],["jas","jm","jam","james"],["1pet","1pe","1pt","1p"],["2pet","2pe","2pt","2p"],["1john","1jn","1jo","1jhn"],["2john","2jn","2jo"],["3john","3jn","3jo"],
 ["jude","jud","jd"],["rev","re","rv","revelation","revelations","apoc"]
];
function normBookKey(s){
  s = s.toLowerCase().replace(/[.\s]/g,"");
  s = s.replace(/^iii(?=[a-z])/,"3").replace(/^ii(?=[a-z])/,"2").replace(/^i(?=(sam|kgs|ki|chr|cor|thess|th|tim|ti|pet|pe|john|jn|jo)\b)/,"1");
  s = s.replace(/^(first|1st)/,"1").replace(/^(second|2nd)/,"2").replace(/^(third|3rd)/,"3");
  return s;
}
function findBook(input, names){
  var k = normBookKey(input);
  if(!k) return -1;
  var i, j;
  for(i=0;i<names.length;i++){ if(names[i].toLowerCase().replace(/\s/g,"")===k) return i; }
  for(i=0;i<BOOK_ABBR.length;i++){ for(j=0;j<BOOK_ABBR[i].length;j++){ if(BOOK_ABBR[i][j]===k) return i; } }
  var hits=[];
  for(i=0;i<names.length;i++){ if(names[i].toLowerCase().replace(/\s/g,"").indexOf(k)===0) hits.push(i); }
  if(hits.length===1) return hits[0];
  hits=[];
  for(i=0;i<BOOK_ABBR.length;i++){ for(j=0;j<BOOK_ABBR[i].length;j++){ if(BOOK_ABBR[i][j].indexOf(k)===0 && k.length>=2){ hits.push(i); break; } } }
  if(hits.length===1) return hits[0];
  return -1;
}
/* Returns {b, c, v, v2} (0-based book, 1-based chapter/verse) or null. */
function parseRef(q, names){
  if(!q) return null;
  var s = q.trim().replace(/\s+/g," ");
  var m = s.match(/^((?:[123]|i{1,3})?\s*[a-z][a-z .]*?)\s*(\d+)?(?:(?:\s*[:.,]\s*|\s+)(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/i);
  if(!m) return null;
  var b = findBook(m[1], names);
  if(b<0) return null;
  return {b:b, c:m[2]?parseInt(m[2],10):0, v:m[3]?parseInt(m[3],10):0, v2:m[4]?parseInt(m[4],10):0};
}
if(typeof module!=="undefined") module.exports={parseRef:parseRef,findBook:findBook};

/* Full-text search over the KJV, run off the main thread. */
var V = null; // [{b,c,v,n}] n = normalized text with leading/trailing spaces
function norm(s){
  return " " + s.toLowerCase().replace(/[\[\]¶]/g,"").replace(/æ/g,"ae").replace(/[’']/g,"").replace(/[^a-z0-9]+/g," ").trim() + " ";
}
function load(url){
  return fetch(url).then(function(r){return r.json();}).then(function(d){
    V = [];
    d.books.forEach(function(bk,bi){
      bk.c.forEach(function(ch,ci){
        ch.forEach(function(t,vi){ V.push({b:bi,c:ci+1,v:vi+1,n:norm(t)}); });
      });
    });
  });
}
var ready = null;
self.onmessage = function(e){
  var m = e.data;
  if(m.type==="init"){ ready = load(m.url).then(function(){ self.postMessage({type:"ready",count:V.length}); }); return; }
  if(m.type==="search"){
    (ready||Promise.resolve()).then(function(){ self.postMessage(run(m)); });
  }
};
function run(m){
  var t0 = Date.now();
  var q = (m.q||"").trim();
  var phrase = /^".*"$/.test(q);
  var words = norm(q.replace(/"/g," ")).trim().split(" ").filter(Boolean);
  if(!words.length) return {type:"results",id:m.id,q:q,total:0,items:[],words:[]};
  var prefix = words.map(function(w){ return /\*$/.test(q) && w===words[words.length-1]; });
  var pq = " " + words.join(" ") + " ";
  var exact = [], rest = [];
  var lo = 0, hi = 66;
  if(m.scope==="ot"){ hi = 39; } else if(m.scope==="nt"){ lo = 39; }
  else if(/^b\d+$/.test(m.scope||"")){ lo = parseInt(m.scope.slice(1),10); hi = lo+1; }
  for(var i=0;i<V.length;i++){
    var r = V[i];
    if(r.b<lo || r.b>=hi) continue;
    var n = r.n, ok = true;
    if(phrase){ if(n.indexOf(pq)<0) continue; exact.push(i); continue; }
    for(var j=0;j<words.length;j++){
      if(n.indexOf(" "+words[j]+(prefix[j]?"":" "))<0){ ok=false; break; }
    }
    if(!ok) continue;
    if(words.length>1 && n.indexOf(pq)>=0) exact.push(i); else rest.push(i);
  }
  var all = exact.concat(rest);
  var LIMIT = 500;
  return {type:"results",id:m.id,q:q,total:all.length,phrase:exact.length,
          items:all.slice(0,LIMIT).map(function(i){var r=V[i];return [r.b,r.c,r.v];}),
          words:words,ms:Date.now()-t0};
}

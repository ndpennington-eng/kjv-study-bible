/* KJV Study Bible: single-page app (no frameworks, relative paths, works offline). */
(function(){
"use strict";
var APP_VERSION = "1.1.0";
var D = {kjv:null, luther:null, study:null, xref:null};
var NAMES = [], OFFS = [], TOTAL = 0;
var $view = document.getElementById("view");
var $title = document.getElementById("title");
var $back = document.getElementById("backBtn");
var $sheet = document.getElementById("sheet");
var $scrim = document.getElementById("scrim");
var upRoute = "#/";
var $pill = document.getElementById("backPill"), $pillTxt = document.getElementById("backPillTxt");

/* ---------- storage ---------- */
var SKEY = "kjvsb.settings.v1", UKEY = "kjvsb.user.v1";
function loadJSON(k, def){ try{ var v = JSON.parse(localStorage.getItem(k)); return v && typeof v==="object" ? v : def; }catch(e){ return def; } }
var settings = loadJSON(SKEY, {theme:"light", fs:19, layout:"verse", last:null});
var user = loadJSON(UKEY, {bookmarks:{}, highlights:{}, notes:{}});
["bookmarks","highlights","notes"].forEach(function(k){ if(!user[k] || typeof user[k]!=="object") user[k] = {}; });
function saveSettings(){ try{ localStorage.setItem(SKEY, JSON.stringify(settings)); }catch(e){} }
function saveUser(){ try{ localStorage.setItem(UKEY, JSON.stringify(user)); }catch(e){ toast("Could not save (storage full?)"); } }
function applySettings(){
  document.documentElement.setAttribute("data-theme", settings.theme);
  document.documentElement.style.setProperty("--fs", settings.fs + "px");
  var tc = {light:"#7a1e24", dark:"#1d1c1a", sepia:"#8a4b1c"}[settings.theme] || "#7a1e24";
  var m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute("content", tc);
}
applySettings();
if(navigator.storage && navigator.storage.persist){ try{ navigator.storage.persist(); }catch(e){} }

/* ---------- helpers ---------- */
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function verseHTML(t){
  return esc(t).replace(/\[([^\]]*)\]/g,'<i>$1</i>').replace(/¶\s*/g,'<span class="pm" aria-hidden="true">¶</span>');
}
function plain(t){ return t.replace(/[\[\]]/g,"").replace(/¶\s*/g,""); }
function key(b,c,v){ return (b+1)+"."+c+"."+v; }
function parseKey(k){ var p = k.split(".").map(Number); return {b:p[0]-1,c:p[1],v:p[2]}; }
function refName(b,c,v,v2){ var s = (NAMES[b]==="Psalms" && c ? "Psalm" : NAMES[b]) + " " + c; if(v) s += ":" + v + (v2 && v2!==v ? "–"+v2 : ""); return s; }
function gidToRef(g){
  var lo=0, hi=OFFS.length-1;
  while(lo<hi){ var mid=(lo+hi+1)>>1; if(OFFS[mid][0]<=g) lo=mid; else hi=mid-1; }
  return {b:OFFS[lo][1], c:OFFS[lo][2], v:g-OFFS[lo][0]+1};
}
function verseText(b,c,v){ var ch = D.kjv.books[b].c[c-1]; return ch && ch[v-1] !== undefined ? ch[v-1] : ""; }
function toast(msg){ var t=document.getElementById("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(function(){t.hidden=true;},2200); }
function getJSON(url){ return fetch(url).then(function(r){ if(!r.ok) throw new Error(url+" "+r.status); return r.json(); }); }
function need(name){
  if(D[name]) return Promise.resolve(D[name]);
  return getJSON("data/"+name+".json").then(function(d){ D[name]=d; return d; });
}
function setTitle(t, up){ $title.textContent = t; upRoute = up; $back.hidden = !up; document.title = t === "KJV Study Bible" ? t : t + " · KJV Study Bible"; }
function setTab(name){ Array.prototype.forEach.call(document.querySelectorAll("#tabbar a"), function(a){ a.classList.toggle("on", a.getAttribute("data-tab")===name); }); }
$back.addEventListener("click", function(){ if(upRoute) location.hash = upRoute; });

/* ---------- "back to where I was" navigation stack ----------
   Every history entry is stamped with an index (history.state.i). Following a cross-reference, a search
   result, or a quick jump pushes an "origin" (where you were: hash, scroll, open verse sheet) onto a stack.
   The floating pill (or the browser / iOS back gesture) returns to the top origin exactly as it was. */
var NKEY = "kjvsb.nav.v1";
var nav = (function(){ try{ var v = JSON.parse(sessionStorage.getItem(NKEY)); return Array.isArray(v) ? v : []; }catch(e){ return []; } })();
var curI = -1, curHash = null, curView = null, lastReader = null, pendingRestore = null;
if("scrollRestoration" in history) try{ history.scrollRestoration = "manual"; }catch(e){}
function saveNav(){ try{ sessionStorage.setItem(NKEY, JSON.stringify(nav)); }catch(e){} }
function originLabel(o){
  if(o.t==="search") return "Back to search results";
  return "Back to " + refName(o.b, o.c, o.sheet ? o.v : 0);
}
function pushOrigin(o, useHistory){
  o.h = o.h || location.hash || "#/";
  o.i = useHistory === false ? null : curI;
  var top = nav[nav.length-1];
  if(top && top.h===o.h && top.i===o.i) nav.pop();   // never stack the same place twice
  nav.push(o); if(nav.length>50) nav.shift(); saveNav();
}
function readerOrigin(){   // snapshot of the reader as it is right now
  if(!curView || curView.t!=="reader") return null;
  var sel = document.querySelector("#verses .v.sel"), open = !$sheet.hidden && !!sel && !!document.getElementById("xrefArea");
  return {t:"reader", b:curView.b, c:curView.c, v: open ? +sel.getAttribute("data-v") : 0, sheet: open, y: window.scrollY, sy: open ? $sheet.scrollTop : 0};
}
function updatePill(){
  var show = nav.length>0 && curView && (curView.t==="reader" || curView.t==="search");
  if(show) $pillTxt.textContent = originLabel(nav[nav.length-1]);
  $pill.hidden = !show; document.body.classList.toggle("has-pill", !!show);
}
function goBackToOrigin(){
  var o = nav[nav.length-1]; if(!o) return;
  if(o.i!==null && o.i!==undefined && o.i < curI){
    var from = curI;
    history.go(o.i - curI);
    // safety net: if that history entry is gone (e.g. after a fresh app launch), navigate there directly
    setTimeout(function(){ if(curI===from && nav.indexOf(o)>=0) forwardTo(o); }, 700);
  } else forwardTo(o);
}
function forwardTo(o){
  var i = nav.indexOf(o); if(i>=0) nav.splice(i,1); saveNav();
  pendingRestore = o;
  if(location.hash===o.h) route(); else location.hash = o.h;
}
document.getElementById("backPillGo").addEventListener("click", goBackToOrigin);
document.getElementById("backPillX").addEventListener("click", function(){ nav = []; saveNav(); updatePill(); });
function restoreScroll(y, done){
  var n = 0;
  (function f(){
    window.scrollTo(0, y);
    if(Math.abs(window.scrollY - y) > 2 && document.documentElement.scrollHeight - window.innerHeight < y && n++ < 40) return setTimeout(f, 50);
    if(done) done();
  })();
}

/* ---------- init ---------- */
function init(){
  return need("kjv").then(function(k){
    NAMES = k.books.map(function(b){ return b.n; });
    var g = 0;
    k.books.forEach(function(bk,bi){ bk.c.forEach(function(ch,ci){ OFFS.push([g,bi,ci+1]); g += ch.length; }); });
    TOTAL = g;
  });
}

/* ---------- router ---------- */
function route(){
  // remember where the reader was before leaving it (used by quick jump)
  if(curView && curView.t==="reader"){ var ro = readerOrigin(); if(ro){ ro.h = curHash; lastReader = ro; } }
  closeSheet(); document.getElementById("toast").hidden = true;
  var h = location.hash || "#/";
  // stamp this history entry with an index so "back" can step to an exact entry
  var st = history.state;
  if(st && typeof st.i==="number") curI = st.i;
  else { curI = curI + 1; try{ history.replaceState({i:curI}, ""); }catch(e){} }
  curHash = h;
  nav = nav.filter(function(o){ return o.i===null || o.i===undefined || o.i <= curI; });   // went back past these
  var top = nav[nav.length-1];
  if(top && top.i===curI){ nav.pop(); if(top.h===h) pendingRestore = top; }               // returned to an origin
  saveNav();
  var restore = pendingRestore; pendingRestore = null;
  var path = h.slice(1).split("?")[0], qs = h.indexOf("?")>=0 ? h.slice(h.indexOf("?")+1) : "";
  var params = {}; qs.split("&").forEach(function(p){ if(!p) return; var i=p.indexOf("="); params[decodeURIComponent(p.slice(0,i))]=decodeURIComponent(p.slice(i+1).replace(/\+/g," ")); });
  var seg = path.split("/").filter(Boolean);
  window.scrollTo(0,0);
  curView = {t: seg[0]==="r" ? "reader" : seg[0]==="search" ? "search" : (seg[0]||"home")};
  // deliberate navigation elsewhere (book list / chapter grid, Saved, More) ends the trail
  if((seg[0]==="b" && !seg[2]) || seg[0]==="saved" || seg[0]==="more") { nav = []; saveNav(); }
  updatePill();
  try{
    if(!seg.length) return viewHome();
    switch(seg[0]){
      case "b": if(seg[2]==="context") return viewContext(+seg[1]); if(seg[2]==="luther") return viewLuther(+seg[1]); return viewBook(+seg[1]);
      case "r": return viewReader(+seg[1], +seg[2]||1, +seg[3]||0, +seg[4]||0, restore);
      case "search": return viewSearch(params.q||"", params.s||"all", restore);
      case "saved": return viewSaved(params.t||"bookmarks");
      case "more": return viewMore();
      case "prefaces": return viewPrefaces();
      case "preface": return viewPreface(seg[1]);
      case "timeline": return viewTimeline();
      case "empires": return viewEmpires(seg[1]);
      case "glossary": return viewGlossary();
      case "settings": return viewSettings();
      case "about": return viewAbout();
    }
  }catch(e){ console.error(e); }
  viewHome();
}
window.addEventListener("hashchange", route);
// a back/forward between two entries with the same hash fires no hashchange; route it anyway
window.addEventListener("popstate", function(e){ if(e.state && typeof e.state.i==="number" && e.state.i!==curI && (location.hash||"#/")===curHash) route(); });

/* ---------- home ---------- */
var homeTab = sessionStorage.getItem("homeTab") || "OT";
function viewHome(){
  setTitle("KJV Study Bible", null); setTab("home");
  var h = '<form class="searchbox" id="qj" role="search"><input id="qjIn" type="search" enterkeyhint="go" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Jump (jn 3:16) or search words" aria-label="Jump to reference or search"><button type="submit">Go</button></form>';
  if(settings.last && NAMES[settings.last.b]){
    h += '<a class="btn primary" style="width:100%;margin-bottom:6px" href="#/r/'+settings.last.b+'/'+settings.last.c+'">Continue: '+esc(refName(settings.last.b,settings.last.c))+'</a>';
  }
  h += '<div class="seg" role="tablist"><button data-t="OT" class="'+(homeTab==="OT"?"on":"")+'">Old Testament</button><button data-t="NT" class="'+(homeTab==="NT"?"on":"")+'">New Testament</button></div>';
  h += '<ul class="booklist" id="books">'+bookItems(homeTab)+'</ul>';
  $view.innerHTML = h;
  document.getElementById("qj").addEventListener("submit", function(e){ e.preventDefault(); quickGo(document.getElementById("qjIn").value); });
  Array.prototype.forEach.call($view.querySelectorAll(".seg button"), function(b){
    b.addEventListener("click", function(){ homeTab=b.getAttribute("data-t"); sessionStorage.setItem("homeTab",homeTab);
      $view.querySelectorAll(".seg button").forEach(function(x){x.classList.toggle("on",x===b);}); document.getElementById("books").innerHTML = bookItems(homeTab); });
  });
}
function bookItems(t){
  var h = "";
  D.kjv.books.forEach(function(bk,i){ if(bk.t!==t) return;
    h += '<li><a href="#/b/'+i+'"><span>'+esc(bk.n)+'</span><span class="cnt">'+bk.c.length+' ch</span></a></li>'; });
  return h;
}
function quickGo(q){
  q = (q||"").trim(); if(!q) return;
  var r = parseRef(q, NAMES);
  if(r && !r.c){
    // a bare word: only jump if it is exactly a book name or a standard abbreviation
    var k = normBookKey(q), exact = NAMES.some(function(n){ return n.toLowerCase().replace(/\s/g,"")===k; }) ||
      BOOK_ABBR.some(function(a){ return a.indexOf(k)>=0; });
    if(!exact || k.length<2) r = null;
  }
  if(r){
    if(lastReader) pushOrigin(JSON.parse(JSON.stringify(lastReader)), false);  // "Back to" where you were reading
    var bk = D.kjv.books[r.b];
    if(bk.c.length===1 && r.c && !r.v && r.c>1){ r.v = r.c; r.c = 1; }  // "Jude 3"
    if(!r.c){ location.hash = "#/b/"+r.b; return; }
    r.c = Math.min(Math.max(1,r.c), bk.c.length);
    if(r.v) r.v = Math.min(r.v, bk.c[r.c-1].length);
    location.hash = "#/r/"+r.b+"/"+r.c+(r.v?"/"+r.v+(r.v2?"/"+r.v2:""):"");
    return;
  }
  location.hash = "#/search?q="+encodeURIComponent(q);
}

/* ---------- book page ---------- */
function lutherSummary(bi){
  var m = D.luther.books[bi][0], p = D.luther.prefaces[m.pid];
  if(m.kind==="full") return {tag:"Full text", text: p.title + " (" + p.date + ")"};
  return {tag:"Labeled excerpt", text:"No separate preface — excerpt from “" + p.title.replace(/ \d{4}.*$/,"") + "”"};
}
function viewBook(bi){
  var bk = D.kjv.books[bi]; if(!bk) return viewHome();
  setTitle(bk.n, "#/"); setTab("home");
  homeTab = bk.t; sessionStorage.setItem("homeTab",homeTab);
  need("luther").then(function(){
    var ls = lutherSummary(bi);
    var h = '<h2>'+esc(bk.n)+'</h2>';
    h += '<div class="btnrow"><a class="btn" href="#/b/'+bi+'/context">Historical Context</a><a class="btn" href="#/b/'+bi+'/luther">Luther’s Preface</a></div>';
    h += '<div class="small muted">Luther: <span class="tag alt">'+ls.tag+'</span> '+esc(ls.text)+'</div>';
    h += '<h3>Chapters</h3><div class="grid">';
    for(var c=1;c<=bk.c.length;c++) h += '<a href="#/r/'+bi+'/'+c+'">'+c+'</a>';
    h += '</div>';
    $view.innerHTML = h;
  });
}

/* ---------- reader ---------- */
function viewReader(bi, c, v, v2, restore){
  var bk = D.kjv.books[bi]; if(!bk) return viewHome();
  c = Math.min(Math.max(1,c), bk.c.length);
  curView = {t:"reader", b:bi, c:c};
  if(restore && (restore.t!=="reader" || restore.b!==bi || restore.c!==c)) restore = null;
  setTitle(refName(bi,c), "#/b/"+bi); setTab("home");
  settings.last = {b:bi, c:c}; saveSettings();
  var ch = bk.c[c-1];
  var h = '<div class="reader">';
  if(c===1){
    h += '<div class="card intro-banner"><b>Before you read '+esc(bk.n)+'</b><div class="btnrow"><a class="btn" href="#/b/'+bi+'/context">Historical Context</a><a class="btn" href="#/b/'+bi+'/luther">Luther’s Preface</a></div></div>';
  }
  h += '<div class="chhead">'+(NAMES[bi]==="Psalms"?"Psalm":"Chapter")+' '+c+'</div>';
  h += '<div class="'+(settings.layout==="para"?"para":"verseblock")+'" id="verses">';
  for(var i=0;i<ch.length;i++){
    var k = key(bi,c,i+1), cls = "v", hl = user.highlights[k];
    if(hl) cls += " h-"+hl;
    var mk = (user.bookmarks[k]?'<span class="mk" title="Bookmarked">★</span>':'') + (user.notes[k]?'<span class="mk" title="Note">✎</span>':'');
    h += (settings.layout==="para" ? "" : "") + '<span class="'+cls+'" id="v'+(i+1)+'" data-v="'+(i+1)+'"><sup>'+(i+1)+'</sup>'+verseHTML(ch[i])+mk+'</span>' + (settings.layout==="para" ? " " : "");
  }
  h += '</div>';
  var prev = c>1 ? [bi,c-1] : (bi>0 ? [bi-1, D.kjv.books[bi-1].c.length] : null);
  var next = c<bk.c.length ? [bi,c+1] : (bi<65 ? [bi+1,1] : null);
  h += '<div class="chnav">' + (prev?'<a class="btn" id="prevCh" href="#/r/'+prev[0]+'/'+prev[1]+'">‹ '+esc(refName(prev[0],prev[1]))+'</a>':'<span></span>') +
       (next?'<a class="btn" id="nextCh" href="#/r/'+next[0]+'/'+next[1]+'">'+esc(refName(next[0],next[1]))+' ›</a>':'<span></span>') + '</div>';
  h += '<p class="small muted" style="font-family:var(--sans)">Tap a verse to bookmark, highlight, add a note, or see cross-references. <i>Italics</i> mark words printed in italics in the KJV (supplied by the translators).</p>';
  h += '</div>';
  $view.innerHTML = h;
  document.getElementById("verses").addEventListener("click", function(e){
    var el = e.target.closest(".v"); if(!el) return;
    openVerse(bi, c, +el.getAttribute("data-v"));
  });
  if(restore){
    var rv = restore.sheet && restore.v && restore.v<=ch.length ? restore.v : 0;
    requestAnimationFrame(function(){ restoreScroll(restore.y||0, function(){ if(rv) openVerse(bi, c, rv, restore.sy||0); }); });
  }else if(v){
    var last = v2 && v2>v ? Math.min(v2, ch.length) : v;
    var el = document.getElementById("v"+v);
    if(el){
      requestAnimationFrame(function(){ el.scrollIntoView({block:"center"});
        for(var x=v;x<=last;x++){ var e2=document.getElementById("v"+x); if(e2) e2.classList.add("flash"); } });
    }
  }
  swipe(prev, next);
}
var swipeHandler = null;
function swipe(prev, next){
  var el = $view, sx=0, sy=0, st=0;
  if(swipeHandler){ el.removeEventListener("touchstart", swipeHandler[0]); el.removeEventListener("touchend", swipeHandler[1]); }
  var ts = function(e){ var t=e.changedTouches[0]; sx=t.clientX; sy=t.clientY; st=Date.now(); };
  var te = function(e){ var t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;
    if(Date.now()-st<600 && Math.abs(dx)>80 && Math.abs(dy)<40){ var target = dx<0 ? next : prev; if(target) location.hash = "#/r/"+target[0]+"/"+target[1]; } };
  el.addEventListener("touchstart", ts, {passive:true}); el.addEventListener("touchend", te, {passive:true});
  swipeHandler = [ts, te];
}
function clearSwipe(){ if(swipeHandler){ $view.removeEventListener("touchstart", swipeHandler[0]); $view.removeEventListener("touchend", swipeHandler[1]); swipeHandler=null; } }

/* ---------- verse sheet ---------- */
function openSheet(html){ $sheet.innerHTML = '<div class="grab"></div>' + html; $sheet.hidden = false; $scrim.hidden = false; $sheet.scrollTop = 0; }
function closeSheet(){ $sheet.hidden = true; $scrim.hidden = true; var s = document.querySelector(".v.sel"); if(s) s.classList.remove("sel"); }
$scrim.addEventListener("click", closeSheet);
function refreshVerse(bi,c,v){
  var el = document.getElementById("v"+v); if(!el) return;
  var k = key(bi,c,v);
  el.className = "v sel" + (user.highlights[k] ? " h-"+user.highlights[k] : "");
  el.innerHTML = '<sup>'+v+'</sup>'+verseHTML(verseText(bi,c,v)) + (user.bookmarks[k]?'<span class="mk">★</span>':'') + (user.notes[k]?'<span class="mk">✎</span>':'');
}
function openVerse(bi, c, v, sheetY){
  var k = key(bi,c,v), t = verseText(bi,c,v);
  var s = document.querySelector(".v.sel"); if(s) s.classList.remove("sel");
  var el = document.getElementById("v"+v); if(el) el.classList.add("sel");
  var colors = [["y","Yellow"],["g","Green"],["b","Blue"],["p","Pink"]];
  var h = '<h4>'+esc(refName(bi,c,v))+'</h4><div class="xprev">'+verseHTML(t)+'</div>';
  h += '<div class="row verse-actions"><button class="btn" id="bmBtn">'+(user.bookmarks[k]?"★ Bookmarked":"☆ Bookmark")+'</button><button class="btn" id="noteBtn">✎ Note</button><button class="btn" id="copyBtn">Copy</button></div>';
  h += '<div class="row" aria-label="Highlight">';
  colors.forEach(function(cl){ h += '<button class="swatch'+(user.highlights[k]===cl[0]?" on":"")+'" data-c="'+cl[0]+'" aria-label="'+cl[1]+' highlight" style="background:var(--hl-'+cl[0]+')"></button>'; });
  h += '<button class="btn" id="hlClear" style="flex:0 0 auto">No highlight</button></div>';
  h += '<div id="noteArea"></div>';
  if(nav.length) h += '<button class="btn sheet-back" id="sheetBack" type="button">‹ '+esc(originLabel(nav[nav.length-1]))+'</button>';
  h += '<div id="xrefArea"><h3>Cross-references</h3><div class="muted small">Loading…</div></div>';
  openSheet(h);
  document.getElementById("bmBtn").onclick = function(){
    if(user.bookmarks[k]) delete user.bookmarks[k]; else user.bookmarks[k] = {t:Date.now()};
    saveUser(); this.textContent = user.bookmarks[k]?"★ Bookmarked":"☆ Bookmark"; refreshVerse(bi,c,v); toast(user.bookmarks[k]?"Bookmarked":"Bookmark removed");
  };
  Array.prototype.forEach.call($sheet.querySelectorAll(".swatch"), function(b){
    b.onclick = function(){ user.highlights[k] = b.getAttribute("data-c"); saveUser(); $sheet.querySelectorAll(".swatch").forEach(function(x){x.classList.toggle("on",x===b);}); refreshVerse(bi,c,v); };
  });
  document.getElementById("hlClear").onclick = function(){ delete user.highlights[k]; saveUser(); $sheet.querySelectorAll(".swatch").forEach(function(x){x.classList.remove("on");}); refreshVerse(bi,c,v); };
  document.getElementById("copyBtn").onclick = function(){
    var txt = "“" + plain(t) + "” (" + refName(bi,c,v) + ", KJV)";
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){toast("Copied");},function(){toast("Copy failed");}); else toast("Copy not supported");
  };
  var showNote = function(){
    var area = document.getElementById("noteArea");
    area.innerHTML = '<h3>Note</h3><textarea id="noteTxt" placeholder="Write a note on this verse…">'+esc(user.notes[k]?user.notes[k].text:"")+'</textarea><div class="row"><button class="btn primary" id="noteSave">Save note</button>'+(user.notes[k]?'<button class="btn" id="noteDel">Delete note</button>':'')+'</div>';
    document.getElementById("noteSave").onclick = function(){
      var val = document.getElementById("noteTxt").value.trim();
      if(val) user.notes[k] = {text:val, t:Date.now()}; else delete user.notes[k];
      saveUser(); refreshVerse(bi,c,v); toast(val?"Note saved":"Note removed"); showNote();
    };
    var del = document.getElementById("noteDel"); if(del) del.onclick = function(){ delete user.notes[k]; saveUser(); refreshVerse(bi,c,v); toast("Note deleted"); showNote(); };
  };
  document.getElementById("noteBtn").onclick = function(){ showNote(); var ta=document.getElementById("noteTxt"); if(ta) ta.focus(); };
  if(user.notes[k]) showNote();
  var sb = document.getElementById("sheetBack"); if(sb) sb.onclick = goBackToOrigin;
  need("xref").then(function(X){
    var g = OFFS.filter(function(o){return o[1]===bi && o[2]===c;})[0][0] + v - 1;
    var s = X.x[g], area = document.getElementById("xrefArea"); if(!area) return;
    if(!s){ area.innerHTML = '<h3>Cross-references</h3><div class="muted small">None listed for this verse.</div>'; return; }
    var hh = '<h3>Cross-references</h3><div class="xref">';
    s.split(",").forEach(function(item){
      var p = item.split("-").map(Number), a = gidToRef(p[0]), b2 = p[1] ? gidToRef(p[1]) : null;
      var label = refName(a.b,a.c,a.v, b2 && b2.c===a.c && b2.b===a.b ? b2.v : 0) + (b2 && (b2.c!==a.c || b2.b!==a.b) ? "–" + (b2.b!==a.b? NAMES[b2.b]+" ":"") + b2.c + ":" + b2.v : "");
      var href = "#/r/"+a.b+"/"+a.c+"/"+a.v+(b2 && b2.c===a.c && b2.b===a.b ? "/"+b2.v : "");
      hh += '<a href="'+href+'" title="'+esc(plain(verseText(a.b,a.c,a.v)))+'">'+esc(label)+'</a>';
    });
    hh += '</div><p class="small muted">Cross-references: OpenBible.info (CC BY). <a href="#/about">Details</a></p>';
    area.innerHTML = hh;
    area.querySelector(".xref").addEventListener("click", function(e){
      var a = e.target.closest("a"); if(!a) return;
      var o = readerOrigin(); if(o) pushOrigin(o);
    });
    if(sheetY) $sheet.scrollTop = sheetY;
  }).catch(function(){ var a=document.getElementById("xrefArea"); if(a) a.innerHTML='<div class="muted small">Cross-references unavailable.</div>'; });
}

/* ---------- search ---------- */
var worker = null, searchId = 0, lastResults = null;
function getWorker(){
  if(worker) return worker;
  worker = new Worker("js/search-worker.js");
  worker.postMessage({type:"init", url: new URL("data/kjv.json", location.href).href});
  return worker;
}
function hlWords(text, words){
  var h = verseHTML(text);
  if(!words || !words.length) return h;
  var re = new RegExp("\\b(" + words.map(function(w){return w.replace(/[^a-z0-9]/g,"");}).filter(Boolean).join("|") + ")\\b", "gi");
  return h.replace(/(<[^>]+>)|([^<]+)/g, function(m, tag, txt){ return tag ? tag : txt.replace(re, "<mark>$1</mark>"); });
}
function viewSearch(q, scope, restore){
  setTitle("Search", null); setTab("search"); clearSwipe();
  var h = '<form class="searchbox" id="sf" role="search"><input id="sq" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Words, “exact phrase”, or jn 3:16" value="'+esc(q)+'" aria-label="Search the Bible"><button type="submit">Search</button></form>';
  h += '<div class="seg" id="scope">' + [["all","All"],["ot","OT"],["nt","NT"]].map(function(s){return '<button data-s="'+s[0]+'" class="'+(scope===s[0]?"on":"")+'">'+s[1]+'</button>';}).join("") + '</div>';
  h += '<div id="sres">'+(q?'<div class="muted">Searching…</div>':'<div class="empty">Search all 31,102 verses offline.<br><br>Tips: words match whole words in any order; put a phrase in "quotes"; end with * for a prefix (e.g. <i>righteous*</i>). A reference like <i>1 cor 13:4</i> jumps straight there.</div>')+'</div>';
  $view.innerHTML = h;
  document.getElementById("sf").addEventListener("submit", function(e){
    e.preventDefault(); var val = document.getElementById("sq").value.trim();
    var r = parseRef(val, NAMES);
    if(r && r.c && /\d/.test(val)){ quickGo(val); return; }
    location.hash = "#/search?q="+encodeURIComponent(val)+"&s="+scope;
  });
  Array.prototype.forEach.call(document.querySelectorAll("#scope button"), function(b){
    b.onclick = function(){ location.hash = "#/search?q="+encodeURIComponent(document.getElementById("sq").value.trim())+"&s="+b.getAttribute("data-s"); };
  });
  if(!q){ setTimeout(function(){ var i=document.getElementById("sq"); if(i && !("ontouchstart" in window)) i.focus(); }, 50); getWorker(); return; }
  if(restore && restore.t!=="search") restore = null;
  document.getElementById("sres").addEventListener("click", function(e){
    var a = e.target.closest(".results a"); if(!a) return;
    pushOrigin({t:"search", y: window.scrollY});
  });
  if(lastResults && lastResults.q===q && lastResults.scope===scope){ renderResults(lastResults); if(restore) restoreScroll(restore.y||0); return; }
  var id = ++searchId, w = getWorker();
  w.onmessage = function(e){
    var m = e.data; if(m.type!=="results" || m.id!==searchId) return;
    m.scope = scope; lastResults = m; renderResults(m); if(restore) restoreScroll(restore.y||0);
  };
  w.postMessage({type:"search", id:id, q:q, scope:scope});
}
function renderResults(m){
  var el = document.getElementById("sres"); if(!el) return;
  if(!m.total){ el.innerHTML = '<div class="empty">No verses found for “'+esc(m.q)+'”.</div>'; return; }
  var h = '<p class="small muted">'+m.total.toLocaleString()+' verse'+(m.total===1?"":"s")+(m.total>m.items.length?' (showing first '+m.items.length+')':'')+(m.phrase && m.words.length>1?' · exact phrase matches first':'')+'</p><ul class="results">';
  m.items.forEach(function(r){
    h += '<li><a href="#/r/'+r[0]+'/'+r[1]+'/'+r[2]+'"><div class="ref">'+esc(refName(r[0],r[1],r[2]))+'</div><div class="txt">'+hlWords(verseText(r[0],r[1],r[2]), m.words)+'</div></a></li>';
  });
  el.innerHTML = h + '</ul>';
}

/* ---------- context (historical introduction) ---------- */
function linkRefs(s){ return esc(s); }
function viewContext(bi){
  var bk = D.kjv.books[bi]; if(!bk) return viewHome();
  setTitle(bk.n + ": Context", "#/b/"+bi); setTab("home"); clearSwipe();
  need("study").then(function(S){
    var d = S.intros[bi];
    var F = [["author","Author"],["date","Date"],["audience","Original audience"],["setting","Historical setting"],["empires","Empires and powers"],["genre","Genre"],["purpose","Purpose"],["themes","Key themes"]];
    var h = '<h2>'+esc(bk.n)+'</h2><p class="small muted">Historical introduction. Written for this app from a confessional Lutheran standpoint; where scholars disagree, the traditional view and the main critical view are both given.</p><dl class="facts">';
    F.forEach(function(f){ if(d[f[0]]) h += '<dt>'+f[1]+'</dt><dd>'+linkRefs(d[f[0]])+'</dd>'; });
    h += '<dt>Short outline</dt><dd><ul class="outline">' + d.outline.map(function(o){return '<li>'+esc(o)+'</li>';}).join("") + '</ul></dd>';
    h += '<dt>How it points to Christ</dt><dd>'+linkRefs(d.christ)+'</dd></dl>';
    h += '<h3>Debated questions</h3>';
    d.debated.forEach(function(x){
      var i = x.indexOf(" — "), head = i>0 ? x.slice(0,i) : "", body = i>0 ? x.slice(i+3) : x;
      body = esc(body).replace(/\b(Traditional(?:\/confessional)?(?: \([^)]*\))?|Older Western and medieval tradition[^:]*|Main critical view|Critical alternative|Critical|Alternative|Other readings|Early Eastern and modern view[^:]*):/g, '<span class="tag alt">$1</span>');
      h += '<div class="debate"><span class="tag">Debated</span> ' + (head?'<b>'+esc(head)+'</b>':'') + '<div>' + body + '</div></div>';
    });
    h += '<div class="btnrow" style="margin-top:18px"><a class="btn" href="#/b/'+bi+'/luther">Luther’s Preface</a><a class="btn primary" href="#/r/'+bi+'/1">Read '+esc(bk.n)+' 1</a></div>';
    h += '<p class="small muted"><a href="#/empires">Empire profiles</a> · <a href="#/timeline">Timeline</a></p>';
    $view.innerHTML = h;
  });
}

/* ---------- Luther ---------- */
function citation(p){
  return 'Martin Luther, “'+esc(p.title)+',” '+esc(p.date)+', trans. Charles M. Jacobs, in <i>Works of Martin Luther</i>, Philadelphia Edition, vol. 6 (Philadelphia: A. J. Holman Company, 1932), '+(p.p1===p.p2?'p. '+p.p1:'pp. '+p.p1+'–'+p.p2)+'. Public domain in the US; see <a href="#/about">About</a>.';
}
function lutherParas(paras){ return paras.map(function(t){ return '<p>'+esc(t)+'</p>'; }).join(""); }
function notesFor(p, text){
  return p.notes.filter(function(n){ return text.indexOf(n.a)>=0; }).map(function(n){ return '<div class="cite"><b>Editor’s note (Philadelphia Edition, vol. 6), on the bracketed text beginning “'+esc(n.a.slice(1))+'…”:</b> '+esc(n.t)+'</div>'; }).join("");
}
function viewLuther(bi){
  var bk = D.kjv.books[bi]; if(!bk) return viewHome();
  setTitle(bk.n + ": Luther", "#/b/"+bi); setTab("home"); clearSwipe();
  need("luther").then(function(L){
    var h = '<h2>Luther on '+esc(bk.n)+'</h2>';
    L.books[bi].forEach(function(m, idx){
      var p = L.prefaces[m.pid];
      h += '<div class="card">';
      if(m.kind==="excerpt"){
        h += '<div class="luther-label"><span class="tag">Excerpt</span> '+esc(m.label)+'</div>';
        h += '<div class="small muted" style="font-family:var(--sans)">From: <b>'+esc(p.title)+'</b>'+' · '+esc(p.date)+' · pp. '+p.p1+(p.p2!==p.p1?'–'+p.p2:'')+'</div>';
        var parts = [], prev = -2;
        m.paras.forEach(function(i){ if(prev>=0 && i!==prev+1) parts.push(null); parts.push(p.paras[i]); prev = i; });
        var txt = "";
        h += '<div class="prose" style="margin-top:10px">' + parts.map(function(t){ if(t===null) return '<p class="muted small" style="text-align:center">[ omitted ]</p>'; txt += t; return '<p>'+esc(t)+'</p>'; }).join("") + '</div>';
        h += notesFor(p, txt);
        h += '<div class="btnrow"><a class="btn" href="#/preface/'+m.pid+'">Read the whole “'+esc(p.title.replace(/ \d{4}.*$/,""))+'”</a></div>';
      }else{
        if(m.label) h += '<div class="luther-label">'+esc(m.label)+'</div>';
        h += '<div style="font-family:var(--sans)"><span class="tag">Luther’s own words</span> <span class="tag alt">Full text</span></div>';
        h += '<h2 style="margin-top:10px">'+esc(p.title)+'</h2><div class="small muted">'+esc(p.date)+' · Translated by Charles M. Jacobs · <i>Works of Martin Luther</i>, Philadelphia Edition, vol. 6 (1932), '+(p.p1===p.p2?'p. '+p.p1:'pp. '+p.p1+'–'+p.p2)+'</div>';
        h += '<div class="prose" style="margin-top:10px">'+lutherParas(p.paras)+'</div>';
        h += notesFor(p, p.paras.join(" "));
      }
      h += '<div class="cite">'+citation(p)+'</div></div>';
    });
    h += '<p class="small muted">Text reproduced verbatim from the 1932 English translation (bracketed passages and spelling as printed; side-notes and footnote numbers omitted). <a href="#/prefaces">All of Luther’s prefaces</a></p>';
    h += '<div class="btnrow"><a class="btn" href="#/b/'+bi+'/context">Historical Context</a><a class="btn primary" href="#/r/'+bi+'/1">Read '+esc(bk.n)+' 1</a></div>';
    $view.innerHTML = h;
  });
}
function viewPrefaces(){
  setTitle("Luther’s Prefaces", "#/more"); setTab("more"); clearSwipe();
  need("luther").then(function(L){
    var h = '<h2>Luther’s Prefaces to the Books of the Bible</h2><p class="small muted">'+esc(L.source.full)+'</p><ul class="menu">';
    Object.keys(L.prefaces).forEach(function(id){ var p=L.prefaces[id];
      h += '<li><a href="#/preface/'+id+'"><span>'+esc(p.title)+'<span class="sub">'+esc(p.date)+' · pp. '+p.p1+(p.p2!==p.p1?'–'+p.p2:'')+'</span></span></a></li>'; });
    $view.innerHTML = h + '</ul>';
  });
}
function viewPreface(id){
  setTitle("Luther’s Preface", "#/prefaces"); setTab("more"); clearSwipe();
  need("luther").then(function(L){
    var p = L.prefaces[id]; if(!p) return viewPrefaces();
    var h = '<h2>'+esc(p.title)+'</h2><div class="small muted">'+esc(p.date)+' · Translated by Charles M. Jacobs (1932)</div><div class="prose" style="margin-top:12px">'+lutherParas(p.paras)+'</div>'+notesFor(p,p.paras.join(" "))+'<div class="cite">'+citation(p)+'</div>';
    $view.innerHTML = h;
  });
}

/* ---------- saved ---------- */
function viewSaved(t){
  setTitle("Saved", null); setTab("saved"); clearSwipe();
  var h = '<div class="seg" id="st">' + [["bookmarks","Bookmarks"],["highlights","Highlights"],["notes","Notes"]].map(function(s){return '<button data-t="'+s[0]+'" class="'+(t===s[0]?"on":"")+'">'+s[1]+' ('+Object.keys(user[s[0]]).length+')</button>';}).join("") + '</div>';
  var keys = Object.keys(user[t]).filter(function(k){ var r=parseKey(k); return NAMES[r.b] && verseText(r.b,r.c,r.v); });
  keys.sort(function(a,b){ var x=parseKey(a), y=parseKey(b); return x.b-y.b || x.c-y.c || x.v-y.v; });
  if(!keys.length) h += '<div class="empty">Nothing here yet. Tap any verse while reading to '+(t==="notes"?"add a note":t==="highlights"?"highlight it":"bookmark it")+'.</div>';
  else{
    h += '<ul class="results">';
    keys.forEach(function(k){ var r = parseKey(k);
      var extra = t==="notes" ? '<div class="small" style="margin-top:4px;white-space:pre-wrap">✎ '+esc(user.notes[k].text)+'</div>' : "";
      var cls = t==="highlights" ? ' style="background:var(--hl-'+user.highlights[k]+');border-radius:4px"' : "";
      h += '<li><a href="#/r/'+r.b+'/'+r.c+'/'+r.v+'"><div class="ref">'+esc(refName(r.b,r.c,r.v))+'</div><div class="txt"'+cls+'>'+verseHTML(verseText(r.b,r.c,r.v))+'</div>'+extra+'</a></li>'; });
    h += '</ul>';
  }
  h += '<h3>Backup</h3><div class="btnrow"><button class="btn" id="exportBtn">Export JSON</button><label class="btn" for="importIn">Import JSON</label><input type="file" id="importIn" accept="application/json,.json" hidden></div><p class="small muted">Your bookmarks, highlights and notes are stored only on this device. Export a backup file now and then.</p>';
  $view.innerHTML = h;
  Array.prototype.forEach.call(document.querySelectorAll("#st button"), function(b){ b.onclick = function(){ location.hash = "#/saved?t="+b.getAttribute("data-t"); }; });
  document.getElementById("exportBtn").onclick = exportData;
  document.getElementById("importIn").onchange = function(e){ var f = e.target.files[0]; if(f) importFile(f); };
}
function exportData(){
  var data = {app:"kjv-study-bible", format:1, exported:new Date().toISOString(), keyFormat:"book(1-66).chapter.verse",
              bookmarks:user.bookmarks, highlights:user.highlights, notes:user.notes};
  var blob = new Blob([JSON.stringify(data,null,1)], {type:"application/json"});
  var name = "kjv-study-bible-backup-" + new Date().toISOString().slice(0,10) + ".json";
  if(navigator.canShare && window.File){
    try{ var file = new File([blob], name, {type:"application/json"}); if(navigator.canShare({files:[file]})){ navigator.share({files:[file], title:name}).catch(function(){}); return; } }catch(e){}
  }
  var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast("Backup exported");
}
function importFile(f){
  var r = new FileReader();
  r.onload = function(){
    try{
      var d = JSON.parse(r.result), n = 0, ok = /^\d+\.\d+\.\d+$/;
      if(!d || d.app!=="kjv-study-bible") throw new Error("Not a KJV Study Bible backup");
      ["bookmarks","highlights","notes"].forEach(function(t){
        var src = d[t] || {};
        Object.keys(src).forEach(function(k){
          if(!ok.test(k)) return;
          if(t==="highlights" && !/^[ygbp]$/.test(src[k])) return;
          if(t==="notes" && !(src[k] && typeof src[k].text==="string")) return;
          user[t][k] = src[k]; n++;
        });
      });
      saveUser(); toast("Imported " + n + " items"); route();
    }catch(e){ toast("Import failed: " + e.message); }
  };
  r.readAsText(f);
}
window.__kjvImport = function(text){ importFile(new Blob([text],{type:"application/json"})); };

/* ---------- more ---------- */
function viewMore(){
  setTitle("More", null); setTab("more"); clearSwipe();
  var h = '<ul class="menu">';
  [["#/settings","Reading settings","Font size, light / dark / sepia theme"],["#/prefaces","Luther’s Prefaces","All 46 prefaces, verbatim (1932 translation)"],
   ["#/timeline","Biblical Timeline","From the patriarchs to the end of the New Testament"],["#/empires","Empire Profiles","Egypt, Assyria, Babylon, Persia, Greece, Rome"],
   ["#/glossary","KJV Word Glossary","Archaic words and their meanings"],["#/about","About & Sources","Texts, licenses, and attribution"]].forEach(function(x){
    h += '<li><a href="'+x[0]+'"><span>'+x[1]+'<span class="sub">'+x[2]+'</span></span></a></li>'; });
  h += '</ul><p class="small muted" style="margin-top:16px"><span class="offline-dot" id="offDot"></span><span id="offTxt">Checking offline status…</span></p>';
  $view.innerHTML = h;
  offlineStatus();
}
function offlineStatus(){
  var t = document.getElementById("offTxt"), dot = document.getElementById("offDot"); if(!t) return;
  if(!("serviceWorker" in navigator)){ t.textContent = "Offline mode not supported in this browser."; dot.style.background="#c33"; return; }
  if(!window.caches){ t.textContent = "Offline cache unavailable."; return; }
  caches.keys().then(function(keys){
    var k = keys.filter(function(x){return x.indexOf("kjvsb-")===0;})[0];
    if(!k){ t.textContent = "Preparing for offline use…"; dot.style.background="#d9a400"; return; }
    return caches.open(k).then(function(c){ return c.keys(); }).then(function(reqs){
      t.textContent = "Ready for offline use (" + reqs.length + " files cached, " + k + ")."; });
  });
}

/* ---------- settings ---------- */
function viewSettings(){
  setTitle("Reading settings", "#/more"); setTab("more"); clearSwipe();
  var h = '<h3>Theme</h3><div class="seg" id="thm">' + [["light","Light"],["sepia","Sepia"],["dark","Dark"]].map(function(s){return '<button data-v="'+s[0]+'" class="'+(settings.theme===s[0]?"on":"")+'">'+s[1]+'</button>';}).join("") + '</div>';
  h += '<h3>Text size</h3><div class="btnrow"><button class="btn" id="fsDown" aria-label="Smaller text">A−</button><div class="btn" id="fsVal" style="flex:0 0 80px">'+settings.fs+'px</div><button class="btn" id="fsUp" aria-label="Larger text">A+</button></div>';
  h += '<h3>Verse layout</h3><div class="seg" id="lay">' + [["verse","Verse by verse"],["para","Paragraph"]].map(function(s){return '<button data-v="'+s[0]+'" class="'+(settings.layout===s[0]?"on":"")+'">'+s[1]+'</button>';}).join("") + '</div>';
  h += '<h3>Preview</h3><div class="card reader"><span class="v"><sup>16</sup>For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.</span></div>';
  $view.innerHTML = h;
  Array.prototype.forEach.call(document.querySelectorAll("#thm button"), function(b){ b.onclick = function(){ settings.theme=b.getAttribute("data-v"); saveSettings(); applySettings(); viewSettings(); }; });
  Array.prototype.forEach.call(document.querySelectorAll("#lay button"), function(b){ b.onclick = function(){ settings.layout=b.getAttribute("data-v"); saveSettings(); viewSettings(); }; });
  document.getElementById("fsDown").onclick = function(){ settings.fs=Math.max(14,settings.fs-1); saveSettings(); applySettings(); document.getElementById("fsVal").textContent=settings.fs+"px"; };
  document.getElementById("fsUp").onclick = function(){ settings.fs=Math.min(32,settings.fs+1); saveSettings(); applySettings(); document.getElementById("fsVal").textContent=settings.fs+"px"; };
}
document.getElementById("menuBtn").addEventListener("click", function(){
  var h = '<h4>Reading settings</h4><div class="seg" id="qthm">' + [["light","Light"],["sepia","Sepia"],["dark","Dark"]].map(function(s){return '<button data-v="'+s[0]+'" class="'+(settings.theme===s[0]?"on":"")+'">'+s[1]+'</button>';}).join("") + '</div>';
  h += '<div class="btnrow"><button class="btn" id="qfd">A−</button><div class="btn" id="qfv" style="flex:0 0 80px">'+settings.fs+'px</div><button class="btn" id="qfu">A+</button></div><div class="btnrow"><a class="btn" href="#/settings">More settings</a></div>';
  openSheet(h);
  Array.prototype.forEach.call(document.querySelectorAll("#qthm button"), function(b){ b.onclick = function(){ settings.theme=b.getAttribute("data-v"); saveSettings(); applySettings(); document.querySelectorAll("#qthm button").forEach(function(x){x.classList.toggle("on",x===b);}); }; });
  document.getElementById("qfd").onclick = function(){ settings.fs=Math.max(14,settings.fs-1); saveSettings(); applySettings(); document.getElementById("qfv").textContent=settings.fs+"px"; };
  document.getElementById("qfu").onclick = function(){ settings.fs=Math.min(32,settings.fs+1); saveSettings(); applySettings(); document.getElementById("qfv").textContent=settings.fs+"px"; };
});

/* ---------- timeline / empires / glossary ---------- */
function viewTimeline(){
  setTitle("Timeline", "#/more"); setTab("more"); clearSwipe();
  need("study").then(function(S){
    var h = '<h2>Biblical Timeline</h2><p class="small muted">Dates before the divided monarchy are approximate and debated; alternatives are noted. Tap a reference to read it.</p><ul class="tl">';
    S.timeline.forEach(function(t){ h += '<li><div class="d">'+esc(t.d)+'</div><div class="e">'+esc(t.e)+'</div>'+(t.r&&t.r!=="—"?'<div class="small">'+refLinks(t.r)+'</div>':'')+(t.n?'<div class="small muted">'+esc(t.n)+'</div>':'')+'</li>'; });
    $view.innerHTML = h + '</ul>';
  });
}
function refLinks(s){
  return s.split(/;\s*/).map(function(part){
    var r = parseRef(part.replace(/[–-]\d+(:\d+)?$/,"").replace(/\s*\(.*\)$/,""), NAMES);
    if(r && r.c) return '<a href="#/r/'+r.b+'/'+r.c+(r.v?'/'+r.v:'')+'">'+esc(part)+'</a>';
    return esc(part);
  }).join("; ");
}
function viewEmpires(which){
  setTitle("Empires", "#/more"); setTab("more"); clearSwipe();
  need("study").then(function(S){
    var L = {period:"Period",capital:"Capital",summary:"Overview",kings:"Rulers in the Bible's story",emperors:"Emperors",events:"Key events",bible:"In the Bible",history:"History and archaeology",dating:"Dating question",fall:"Fall",legacy:"Significance"};
    var h = '<h2>Empire Profiles</h2><p class="small muted">The great powers that shaped the biblical world.</p><div class="btnrow">';
    S.empires.forEach(function(e,i){ h += '<a class="btn" style="flex:1 1 40%" href="#e'+i+'" data-i="'+i+'">'+esc(e.name.split(",")[0])+'</a>'; });
    h += '</div>';
    S.empires.forEach(function(e,i){
      h += '<div class="card" id="e'+i+'"><h2 style="margin-top:4px">'+esc(e.name)+'</h2><dl class="facts">';
      Object.keys(L).forEach(function(k){ if(e[k]) h += '<dt>'+L[k]+'</dt><dd>'+esc(e[k])+'</dd>'; });
      h += '</dl></div>';
    });
    $view.innerHTML = h;
    Array.prototype.forEach.call($view.querySelectorAll("a[data-i]"), function(a){ a.onclick = function(ev){ ev.preventDefault(); document.getElementById("e"+a.getAttribute("data-i")).scrollIntoView({block:"start"}); window.scrollBy(0,-60); }; });
  });
}
function viewGlossary(){
  setTitle("KJV Glossary", "#/more"); setTab("more"); clearSwipe();
  need("study").then(function(S){
    var h = '<h2>KJV Word Glossary</h2><p class="small muted">Words whose meaning has changed or fallen out of use since 1611.</p><form class="searchbox" onsubmit="return false"><input id="gf" type="search" placeholder="Filter words" autocomplete="off" autocapitalize="off" aria-label="Filter glossary"></form><dl class="gl" id="gl"></dl>';
    $view.innerHTML = h;
    var draw = function(f){
      f = (f||"").toLowerCase();
      document.getElementById("gl").innerHTML = S.glossary.filter(function(g){ return !f || g.w.toLowerCase().indexOf(f)>=0 || g.m.toLowerCase().indexOf(f)>=0; })
        .map(function(g){ return '<dt>'+esc(g.w)+'</dt><dd>'+esc(g.m)+'<div class="ex">'+esc(g.e)+'</div></dd>'; }).join("") || '<div class="empty">No matching words.</div>';
    };
    draw(""); document.getElementById("gf").addEventListener("input", function(){ draw(this.value); });
  });
}

/* ---------- about ---------- */
function viewAbout(){
  setTitle("About & Sources", "#/more"); setTab("more"); clearSwipe();
  Promise.all([need("luther"), need("xref")]).then(function(r){
    var L = r[0], X = r[1];
    var h = '<h2>About this app</h2><div class="prose">';
    h += '<p>KJV Study Bible is a free, offline study Bible: the King James Version with historical introductions to all 66 books, Martin Luther’s prefaces in a public-domain English translation, cross-references, and personal notes. Everything is stored on your device; nothing is sent anywhere.</p>';
    h += '<h3>Bible text</h3><p>King James Version (1769 Oxford standard text, as distributed by eBible.org / CrossWire as <i>eng-kjv</i>). The KJV is in the public domain in the United States (in the United Kingdom it remains under Crown letters patent). Words in <i>italics</i> are those printed in italics in the KJV; ¶ is the KJV paragraph sign. 66 books, 1,189 chapters, '+TOTAL.toLocaleString()+' verses.</p>';
    h += '<h3>Luther’s prefaces</h3><p>'+esc(L.source.full)+'</p><p><b>Why this is public domain:</b> '+esc(L.source.pd)+'</p><p>'+esc(L.source.scan)+' The text was checked word-by-word against a fresh OCR of the 1932 page images. Luther’s words are never paraphrased or modernized: where Luther wrote no preface to a book, the app shows a clearly labeled excerpt from his general Old or New Testament preface instead.</p>';
    h += '<h3>Cross-references</h3><p>'+esc(X.attribution)+' Source: <a href="https://www.openbible.info/labs/cross-references/" rel="noopener">openbible.info/labs/cross-references</a>, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">Creative Commons Attribution (CC BY)</a>.</p>';
    h += '<h3>Introductions, glossary, timeline, empire profiles</h3><p>Original writing for this app. The introductions are written from a confessional Lutheran perspective while presenting debated questions fairly, giving both the traditional view and the main critical view.</p>';
    h += '<h3>Privacy</h3><p>No accounts, tracking, or network requests after the first load. Bookmarks, highlights, notes and settings live in this browser’s local storage; use Saved › Export to back them up.</p>';
    h += '<p class="small muted">Version '+APP_VERSION+'</p></div>';
    $view.innerHTML = h;
  });
}

/* ---------- start ---------- */
function netState(){ document.body.classList.toggle("offline", !navigator.onLine); }
window.addEventListener("online", netState); window.addEventListener("offline", netState); netState();
init().then(route).catch(function(e){
  console.error(e);
  $view.innerHTML = '<div class="empty">Could not load the Bible text. If you are offline, open the app once while online so it can be saved for offline use.<br><br><button class="btn" onclick="location.reload()">Retry</button></div>';
});
if("serviceWorker" in navigator){
  window.addEventListener("load", function(){
    var hadController = !!navigator.serviceWorker.controller;
    // a new worker activates itself (skipWaiting + clients.claim); offer a one-tap reload to run the new code
    navigator.serviceWorker.addEventListener("controllerchange", function(){
      if(!hadController){ hadController = true; return; }   // first install: nothing to update
      var u = document.getElementById("updBar"); if(u) u.hidden = false;
    });
    navigator.serviceWorker.register("sw.js", {updateViaCache:"none"}).then(function(reg){
      // iOS keeps home-screen apps alive for a long time: check for a new version whenever the app comes back
      document.addEventListener("visibilitychange", function(){ if(document.visibilityState==="visible" && navigator.onLine) reg.update().catch(function(){}); });
    }).catch(function(e){ console.warn("SW registration failed", e); });
  });
}
document.getElementById("updBar").addEventListener("click", function(){ location.reload(); });
})();

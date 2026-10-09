// ─── CONFIG PER LOCALE ───────────────────────────────────────────────────────
// Stesso pattern di manager.js: un solo carta.js condiviso, le differenze vivono
// in window.CARTA_CONFIG dentro l'index.html di ciascun locale. I default sono
// quelli dell'Osteria, così il deploy esistente resta valido senza modifiche.
var _CFG=(function(){
  var D={
    sbUrl:      "https://aznqjmhzbehpmvxnxbzs.supabase.co",
    sbKey:      "sb_publishable_FnsZcIMLdfbaABqmwx3I2A_rXfRmHhY",
    dbUser:     "default",
    mescitaMax: 45,                    // tetto € vista "Carta Breve"
    paeseOrder: ["Italia","Francia"],  // paesi in testa, il resto alfabetico
    extra:      []                     // voci fuori inventario (es. vino alla spina), stesso schema di cm_wines
  };
  var O=(typeof window!=="undefined"&&window.CARTA_CONFIG&&typeof window.CARTA_CONFIG==="object"&&!Array.isArray(window.CARTA_CONFIG))?window.CARTA_CONFIG:{};
  var out={},k;
  for(k in D) out[k]=D[k];
  for(k in O) if(O[k]!==undefined&&O[k]!==null&&O[k]!=="") out[k]=O[k];
  return out;
})();
const SB_URL  = _CFG.sbUrl;
const SB_KEY  = _CFG.sbKey;
const DB_USER = _CFG.dbUser;

var _useRestFallback = SB_KEY.startsWith("sb_publishable_") || SB_KEY.startsWith("sb_");

const CAT_ORDER = ["Spumante","Bianco","Macerato","Rosato","Rosso","Naturale","Dolce","Passito","Liquoroso","Altro","AltriFormati"];
// Ordine enologico interno ai "Altri Formati" (esclude la categoria contenitore).
const CAT_ORDER_ENO = CAT_ORDER.filter(function(c){ return c!=="AltriFormati"; });
const CAT_LABELS = {
  Rosso:"Rossi", Bianco:"Bianchi", Rosato:"Rosati", Spumante:"Bolle",
  Naturale:"Naturali", Dolce:"Dolci", Passito:"Passiti", Liquoroso:"Liquorosi",
  Macerato:"Macerati", Altro:"Altro", AltriFormati:"Altri Formati"
};
const CAT_COLORS = {
  Spumante:  "#8EA8B8",  // grigio-azzurro polvere
  Bianco:    "#B5A060",  // oro antico
  Macerato:  "#9C7A50",  // cuoio
  Rosato:    "#B87878",  // cipria scura
  Rosso:     "#7A3030",  // borgogna spento
  Naturale:  "#5C7A58",  // verde oliva
  Dolce:     "#8A6A8A",  // malva cenere
  Passito:   "#8A4A40",  // terracotta
  Liquoroso: "#9A6030",  // ambra scura
  AltriFormati:"#607080",// acciaio blu
  Altro:     "#787068"   // grigio caldo neutro
};

// ── STATO GLOBALE ─────────────────────────────────────────────────────────────
var currentView = 'calice'; // 'calice' | 'mescita' | 'cantina'
var db={}, catConfig=[], fCat="tutti", fSearch="";
var pMin=0, pMax=500, pMaxG=500;
var fState={paese:"",regione:"",produttore:"",vitigno:"",annata:""};
var fFresco=false;
var _idxById=new Map();
var _sb=null;

var _REGIONE_TO_PAESE = {
  "abruzzo":"Italia","alto adige":"Italia","basilicata":"Italia","calabria":"Italia",
  "campania":"Italia","emilia romagna":"Italia","emilia-romagna":"Italia",
  "friuli venezia giulia":"Italia","friuli":"Italia","lazio":"Italia",
  "liguria":"Italia","lombardia":"Italia","marche":"Italia","molise":"Italia",
  "piemonte":"Italia","valtellina":"Italia","puglia":"Italia","sardegna":"Italia","sicilia":"Italia",
  "toscana":"Italia","trentino alto adige":"Italia","trentino":"Italia",
  "umbria":"Italia","valle d'aosta":"Italia","veneto":"Italia",
  "collio":"Italia","colli euganei":"Italia","soave":"Italia","amarone":"Italia",
  "alsazia":"Francia","ardeche":"Francia","ardèche":"Francia",
  "auvergne":"Francia","beaujolais":"Francia","bordeaux":"Francia",
  "borgogna":"Francia","chablis":"Francia","champagne":"Francia",
  "cotes catalanes":"Francia","côtes catalanes":"Francia",
  "jura":"Francia","languedoc":"Francia","languedoc – roussillon":"Francia",
  "languedoc - roussillon":"Francia","loira":"Francia","loire":"Francia",
  "nuova aquitania – charente":"Francia","nuova aquitania – dordogna":"Francia",
  "provenza":"Francia","provence":"Francia","rodano":"Francia","rhône":"Francia",
  "rhone":"Francia","roussillon":"Francia","savoia":"Francia",
  "sud ouest":"Francia","alsace":"Francia","bourgogne":"Francia",
  "baden":"Germania","franconia":"Germania","mosella":"Germania","mosel":"Germania",
  "pfalz":"Germania","rheingau":"Germania","rheinhessen":"Germania",
  "ahr":"Germania","nahe":"Germania","württemberg":"Germania",
  "burgenland":"Austria","niederösterreich":"Austria","steiermark":"Austria",
  "wagram":"Austria","wachau":"Austria","kamptal":"Austria","kremstal":"Austria",
  "vienna":"Austria","wien":"Austria","vino di vienna":"Austria",
  "andalusia":"Spagna","bierzo":"Spagna","canarias":"Spagna",
  "castilla y leon":"Spagna","catalogna":"Spagna","catalunya":"Spagna",
  "gran canaria":"Spagna","lanzarote":"Spagna","manchuela":"Spagna",
  "paesi baschi":"Spagna","pais vasco":"Spagna","priorat":"Spagna",
  "rias baixas":"Spagna","ribera del duero":"Spagna","rioja":"Spagna",
  "tenerife":"Spagna","villanueva de avila":"Spagna","navarra":"Spagna",
  "jerez":"Spagna","madrid":"Spagna","la mancha":"Spagna","galicia":"Spagna",
  "andia":"Spagna",
  "alentejo":"Portogallo","bairrada":"Portogallo","douro":"Portogallo",
  "minho":"Portogallo","serra da estrela":"Portogallo","vinho verde":"Portogallo",
  "duriense":"Portogallo","algarve":"Portogallo","beira":"Portogallo",
  "collio sloveno":"Slovenia","brda":"Slovenia","karst":"Slovenia",
  "santorini":"Grecia","naoussa":"Grecia","nemea":"Grecia","crete":"Grecia",
  "creta":"Grecia","makedonia":"Grecia","macedonia":"Grecia",
  "rila":"Bulgaria","thrace":"Bulgaria","tracia":"Bulgaria",
  "serbia":"Serbia","sumadija":"Serbia",
  "margaret river":"Australia","victoria":"Australia","barossa":"Australia",
  "mclaren vale":"Australia","hunter valley":"Australia","tasmania":"Australia",
  "central otago":"Nuova Zelanda","marlborough":"Nuova Zelanda",
  "hawke's bay":"Nuova Zelanda","nelson":"Nuova Zelanda",
  "maipo valley":"Cile","colchagua":"Cile","casablanca":"Cile","leyda":"Cile",
  "western cape":"Sudafrica","stellenbosch":"Sudafrica","swartland":"Sudafrica",
  "sonoma":"Stati Uniti","napa":"Stati Uniti","napa valley":"Stati Uniti",
  "willamette":"Stati Uniti","oregon":"Stati Uniti","finger lakes":"Stati Uniti",
  "aargau":"Svizzera","valais":"Svizzera","vaud":"Svizzera","ticino":"Svizzera",
  "valle della beeka":"Libano","bekaa":"Libano","beka":"Libano",
};

function inferPaese(nazione, regione, zona){
  if(nazione) return nazione;
  var r=(regione||zona||"").toLowerCase().trim(); if(!r) return "";
  if(_REGIONE_TO_PAESE[r]) return _REGIONE_TO_PAESE[r];
  var keys=Object.keys(_REGIONE_TO_PAESE);
  for(var i=0;i<keys.length;i++){ if(r.indexOf(keys[i])>-1||keys[i].indexOf(r)>-1) return _REGIONE_TO_PAESE[keys[i]]; }
  return "";
}

var _overlayCount=0;
function _lockScroll(){ _overlayCount++; document.body.style.overflow="hidden"; }
function _unlockScroll(){ _overlayCount=Math.max(0,_overlayCount-1); if(_overlayCount===0) document.body.style.overflow=""; }
function esc(s){ var d=document.createElement("div"); d.textContent=s||""; return d.innerHTML; }
function _fresco(w){ return w&&w.inFresco?"<span class='w-fresco' title='Servito in fresco' aria-label='in fresco'>\u2744\uFE0E</span>":""; }
function _ensureFrescoCSS(){
  if(document.getElementById("fresco-css")) return;
  var st=document.createElement("style"); st.id="fresco-css";
  st.textContent=".w-fresco{display:inline-block;margin-left:7px;font-size:1.35em;line-height:1;vertical-align:middle;color:#0f9fe0;text-shadow:0 0 3px rgba(130,222,255,.95),0 0 7px rgba(40,170,235,.7),0 0 14px rgba(40,170,235,.4),0 0 22px rgba(40,170,235,.2);animation:frescoNeon 2.4s ease-in-out infinite}"
    +"@keyframes frescoNeon{0%,100%{opacity:.92;transform:scale(1);text-shadow:0 0 3px rgba(130,222,255,.8),0 0 6px rgba(40,170,235,.5),0 0 11px rgba(40,170,235,.28)}50%{opacity:1;transform:scale(1.14);text-shadow:0 0 3px rgba(170,235,255,1),0 0 8px rgba(40,170,235,.85),0 0 16px rgba(40,170,235,.55),0 0 26px rgba(40,170,235,.3)}}"
    +"@media(max-width:640px){.w-fresco{font-size:1.55em;margin-left:6px}}"
    +"@media(prefers-reduced-motion:reduce){.w-fresco{animation:none;opacity:1;transform:none;text-shadow:0 0 3px rgba(130,222,255,.9),0 0 8px rgba(40,170,235,.6),0 0 15px rgba(40,170,235,.35)}}"
    +".fresco-legenda{font-family:inherit;font-size:11px;letter-spacing:.05em;color:#8C7E72;text-align:center;padding:26px 12px 10px;border-top:1px solid rgba(26,22,18,.07);margin-top:14px}"
    +".fresco-legenda .w-fresco{font-size:1em;margin:0 6px 0 0}";
  document.head.appendChild(st);
}
function _setStatus(state){
  var dot=document.getElementById("sb-dot"),lbl=document.getElementById("sb-lbl"); if(!dot)return;
  dot.className=state; lbl.textContent={ok:"Live",sync:"Sync...",err:"Offline",off:"Offline"}[state]||"DB";
}
function _pgEsc(s){ return String(s).replace(/'/g,"''"); }

async function _fetchWinesRaw(){
  if(!_useRestFallback && _sb){
    var r=await _sb.from("cm_wines").select("data").eq("user_id",DB_USER);
    if(r.error) throw r.error;
    if(!r.data||!r.data.length) return [];
    if(r.data.length===1) return r.data[0].data||[];
    // Più righe (struttura legacy): merge identico a manager.js
    return r.data.flatMap(function(row){
      var d=row.data;
      if(Array.isArray(d)) return d;
      if(d&&typeof d==="object") return [d];
      return [];
    });
  } else {
    // REST path: rimuove limit=1 per recuperare eventuali righe multiple
    var url=SB_URL+"/rest/v1/cm_wines?select=data&user_id=eq."+encodeURIComponent(_pgEsc(DB_USER));
    var resp=await fetch(url,{headers:{"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY,"Accept":"application/json"}});
    if(!resp.ok){ var errText=await resp.text(); throw new Error("HTTP "+resp.status+": "+errText); }
    var rows=await resp.json();
    if(!rows||!rows.length) return [];
    if(rows.length===1) return rows[0].data||[];
    // Più righe: merge
    return rows.flatMap(function(row){
      var d=row.data;
      if(Array.isArray(d)) return d;
      if(d&&typeof d==="object") return [d];
      return [];
    });
  }
}

var _BOLLE=["Champagne","Champagne Rosè","Metodo Classico","Metodo Classico Rosato",
            "Rifermentato","Rifermentato Rosso","Rifermentato Rosato","Col Fondo",
            "Colfondo","Ancestrale","Metodo Charmat","Sidro","Sidro di Pera",
            "Petillant","Spumante","Bolle"];
// ── FORMATI BOTTIGLIA ─────────────────────────────────────────────────────────
// La 0,75 è la carta "normale". Tutto il resto (mezze, litro, magnum e oltre)
// finisce in una sezione dedicata: è così che un sommelier legge la lista.
var FMT_BUCKETS=[
  {key:"grandi",label:"Grandi Formati", test:function(f){ return f>=1.5; }},
  {key:"litro", label:"Litro",          test:function(f){ return f>0.75&&f<1.5; }},
  {key:"mezze", label:"Mezze Bottiglie",test:function(f){ return f<0.75; }}
];
function _fmtBucket(f){
  for(var i=0;i<FMT_BUCKETS.length;i++) if(FMT_BUCKETS[i].test(f)) return FMT_BUCKETS[i].key;
  return "grandi";
}
var _FMT_NOMI={0.1875:"Piccola",0.25:"Quarto",0.375:"Mezza",0.5:"0,50 L",1:"Litro",
  1.5:"Magnum",2:"Jéroboam",2.25:"Marie-Jeanne",3:"Doppia Magnum",4.5:"Réhoboam",
  5:"5 L",6:"Mathusalem",9:"Salmanazar",12:"Balthazar",15:"Nabuchodonosor"};
function _fmtNome(f){ return _FMT_NOMI[f]||(String(f).replace(".",",")+" L"); }
function _fmtLitri(f){ return String(f).replace(".",",")+" L"; }

// ── ORDINE SOMMELIER ─────────────────────────────────────────────────────────
// Italia e Francia in testa (peso reale in carta), il resto alfabetico.
var PAESE_ORDER=Array.isArray(_CFG.paeseOrder)?_CFG.paeseOrder:["Italia","Francia"];
function _paeseRank(p){ var i=PAESE_ORDER.indexOf(p||""); return i<0?PAESE_ORDER.length:i; }
function _cmpTxt(a,b){
  a=String(a||"").trim(); b=String(b||"").trim();
  if(!a&&!b) return 0;
  if(!a) return 1;            // valori mancanti in coda, non in testa
  if(!b) return -1;
  return a.localeCompare(b,"it",{sensitivity:"base"});
}
// Chiave alfabetica produttore come in una carta da sommelier: "Domaine de la
// Renardière" sta sotto R, "Champagne Les Frères Mignon" sotto F. Il nome esposto resta intero.
var _PROD_PREFIX=/^(?:domaine|dom\.|ch[aâ]teau|champagne|maison|weingut|bodegas?|quinta|azienda agricola|az\.?\s*agr\.?|societ[aà] agricola|soc\.?\s*agr\.?|agricola)\s+/i;
var _PROD_ART=/^(?:de la\s+|de l['’]\s*|du\s+|des\s+|de\s+|d['’]\s*|l['’]\s*|la\s+|le\s+|les\s+)/i;
var _prodKeyCache=new Map();
function _prodKey(p){
  p=String(p||"").trim(); if(!p) return "";
  var k=_prodKeyCache.get(p); if(k!==undefined) return k;
  var s=p.replace(_PROD_PREFIX,"");
  if(s!==p) s=s.replace(_PROD_ART,"");
  k=(s||p).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
  _prodKeyCache.set(p,k); return k;
}
function _prodId(w){ return String(w.produttore||"").trim().toLowerCase(); }
// paese → regione → produttore (A-Z) → prezzo crescente → nome → annata
function _cmpSommelier(a,b){
  var d=_paeseRank(a.paese||a.nazione)-_paeseRank(b.paese||b.nazione); if(d) return d;
  d=_cmpTxt(a.paese||a.nazione,b.paese||b.nazione); if(d) return d;
  d=_cmpTxt(a.regione,b.regione); if(d) return d;
  d=_cmpTxt(_prodKey(a.produttore),_prodKey(b.produttore)); if(d) return d;
  d=_cmpTxt(a.produttore,b.produttore); if(d) return d;
  d=(a._p||Infinity)-(b._p||Infinity); if(d) return d;   // senza prezzo in coda
  d=_cmpTxt(a.n,b.n); if(d) return d;
  return (parseInt(a.annata,10)||0)-(parseInt(b.annata,10)||0);
}
function _cru(w){ return (w.zona&&w.zona!==w.regione)?w.zona:""; }

function getCategoryByTipologia(t){
  if(_BOLLE.indexOf(t)>-1) return "Spumante";
  if(t==="Bianco"||t==="Bianchi") return "Bianco";
  if(t==="Rosso"||t==="Rossi") return "Rosso";
  if(t==="Rosato"||t==="Rosati") return "Rosato";
  if(t==="Macerato"||t==="Macerati"||t==="Orange") return "Macerato";
  if(t==="Naturale") return "Naturale";
  if(t==="Dolce"||t==="Vino Dolce") return "Dolce";
  if(t==="Passito"||t==="Passito rosso") return "Passito";
  if(t==="Liquoroso"||t==="Vino Liquoroso"||t==="Vino Ossidativo") return "Liquoroso";
  return "Altro";
}
function _fmtP(v){ var s=parseFloat(v).toFixed(2); return s.replace(/\.00$/,"").replace(/(\.\d)0$/,"$1"); }
function _capVitigni(s){
  if(!s) return s;
  var lower=["di","del","della","dei","degli","de","d","e","in","da"];
  return s.split(",").map(function(seg){
    var t=seg.trim();
    if(!t) return t;
    return t.toLowerCase().split(/\s+/).map(function(word,i){
      if(!word) return word;
      // Gestisce apostrofo: "d'avola" → "d'Avola"
      var apos=word.indexOf("'");
      if(apos>0){
        var pre=word.slice(0,apos+1);
        var post=word.slice(apos+1);
        return pre+(post?post.charAt(0).toUpperCase()+post.slice(1):"");
      }
      if(i===0||lower.indexOf(word)<0){
        return word.charAt(0).toUpperCase()+word.slice(1);
      }
      return word;
    }).join(" ");
  }).join(", ");
}

// Varianti di scrittura della stessa regione ("Friuli Venezia-Giulia") non devono
// aprire due intestazioni: si unificano sulla prima grafia incontrata.
function _regKey(r){ return String(r||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z]+/g," ").trim(); }
async function loadWines(){
  var _regCanon={};
  var wines=await _fetchWinesRaw();
  wines=wines.filter(function(w){ return (w.giacenza||0)>0; });
  // Voci fuori inventario da CARTA_CONFIG.extra: niente giacenza, sempre in carta.
  (Array.isArray(_CFG.extra)?_CFG.extra:[]).forEach(function(x,i){
    if(x&&x.nome) wines.push(Object.assign({id:"extra-"+i,giacenza:0},x));
  });
  var d={}; CAT_ORDER.forEach(function(t){ d[t]=[]; });
  wines.forEach(function(w){
    var rawTipo=w.tipologia||"Altro";
    var fmt=parseFloat(w.formato)||0.75;
    var tipoEno=getCategoryByTipologia(rawTipo);
    // Qualunque formato diverso dalla 0,75 esce dalla sua categoria enologica e
    // confluisce in "Altri Formati", dove viene poi risuddiviso per bucket e tipologia.
    var cat=fmt!==0.75?"AltriFormati":tipoEno;
    if(!d[cat]) d[cat]=[];
    var nome=w.nome||w.nomeVino||w.n||"";
    var prod=w.produttore||"";
    var pCarta=w.prezzoCarta||"";
    var pNum=pCarta?parseFloat(String(pCarta).replace(/[^0-9.,]/g,"").replace(/\.(?=\d{3})/g,"").replace(",","."))||0:0;
    var pCalice=parseFloat(w.prezzoCalice||w.prezzoAlCalice)||0;
    var _paese=inferPaese(w.nazione,w.regione,w.zona);
    d[cat].push({
      id:w.id, n:nome, produttore:prod, annata:w.annata||"",
      inFresco:!!w.inFresco,
      p:pNum>0?"€ "+_fmtP(pNum):"",
      b:pCalice>0?"€ "+_fmtP(pCalice):"",
      prezzo_carta:pNum,
      prezzo_calice:pCalice,
      vitigno:_capVitigni(w.vitigni||w.vitigno||""),
      regione:(function(r){ r=String(r||"").trim(); if(!r) return ""; var k=_regKey(r); return _regCanon[k]||(_regCanon[k]=r); })(w.regione), zona:w.zona||"",
      nazione:_paese, paese:_paese,
      tipologia:CAT_LABELS[tipoEno]||tipoEno,
      _tipoKey:tipoEno,
      _fmt:fmt,
      _fmtBucket:_fmtBucket(fmt),
      formato:fmt!==0.75?fmt:null,
      qty:w.giacenza||0,
      note:w.noteVeloce||w.note||"",
      _p:pNum,
      _soloCalice:!pNum&&pCalice>0&&String(w.id).indexOf("extra-")===0
    });
  });
  catConfig=CAT_ORDER.filter(function(t){ return d[t]&&d[t].length>0; })
    .map(function(t){ return {nome:t,label:CAT_LABELS[t]||t,colore:CAT_COLORS[t]||"#888"}; });
  var allPrices=Object.values(d).reduce(function(acc,arr){ return acc.concat(arr.map(function(w){ return w._p||0; })); },[]);
  var realMax=allPrices.length?Math.max.apply(null,allPrices):500;
  var newMax=Math.ceil(realMax/50)*50; if(newMax<50) newMax=50;
  if(pMaxG!==newMax){
    var uCMax=(pMax<pMaxG), uCMin=(pMin>0);
    pMaxG=newMax;
    if(!uCMax) pMax=newMax;
    if(!uCMin) pMin=0;
  }
  return d;
}

// ── REALTIME / POLLING ────────────────────────────────────────────────────────
async function _sbListen(){
  if(_useRestFallback||!_sb) return;
  try{
    _sb.channel("cm-wines-changes")
      .on("postgres_changes",{event:"*",schema:"public",table:"cm_wines"},function(){
        _setStatus("sync");
        loadWines().then(function(d){ db=d; _buildIdxById(); applyFilters(); buildSidebar(); _setStatus("ok"); }).catch(function(){ _setStatus("err"); });
      }).subscribe();
  }catch(e){}
}
var _pollInterval=null;
var _pollInFlight=false;
function _startPolling(){
  if(_pollInterval) return;
  _pollInterval=setInterval(function(){
    if(_pollInFlight) return;
    _pollInFlight=true;
    _setStatus("sync");
    loadWines().then(function(d){ db=d; _buildIdxById(); applyFilters(); buildSidebar(); _setStatus("ok"); }).catch(function(){ _setStatus("err"); }).finally(function(){ _pollInFlight=false; });
  },60000);
}

async function init(){
  _setStatus("sync");
  try{
    if(!_useRestFallback){ _sb=supabase.createClient(SB_URL,SB_KEY); }
    db=await loadWines(); _buildIdxById();
    _syncViewUI(currentView);
    applyFilters(); buildSidebar(); buildSortBar();
    // ── EVENT DELEGATION: unico listener su #wine-list invece di N listener per vino ──
    var _wl=document.getElementById("wine-list");
    if(_wl) _wl.addEventListener("click",function(e){
      if(e.target.closest("[data-sel]")) return; // gestito dal listener globale
      var el=e.target.closest(".vino[data-id],.ref[data-id]"); if(el) openModal(el.getAttribute("data-id"));
    });
    var _cn=document.getElementById("chipnav");
    if(_cn) _cn.addEventListener("click",function(e){ var go=e.target.closest(".chip[data-go]"); if(go) _goSection(go.getAttribute("data-go")); });
    document.addEventListener("click",function(e){
      var b=e.target.closest("[data-sel]"); if(b){ e.preventDefault(); toggleSel(b.getAttribute("data-sel")); }
    });
    window.addEventListener("scroll",_onScroll,{passive:true});
    var _wc=document.querySelector(".wine-col"); if(_wc) _wc.addEventListener("scroll",_onScroll,{passive:true});
    window.addEventListener("resize",function(){ _layoutSticky(); _onScroll(); });
    _ensureSelUI(); _syncSel(false);
    _setStatus("ok");
    if(!_useRestFallback){ _sbListen(); } else { _startPolling(); }
  }catch(e){
    _setStatus("err");
    var wl=document.getElementById("wine-list");
    if(wl) wl.innerHTML="<div class=\"vuoto\">Errore caricamento dati.<br><small style='opacity:.6'>"+esc(e.message||"Controlla la connessione")+"</small></div>";
    console.error("[carta] init error:",e);
  }
}

function _buildIdxById(){
  _idxById.clear();
  Object.keys(db).forEach(function(cat){
    (db[cat]||[]).forEach(function(w){ if(w.id!=null) _idxById.set(String(w.id),{v:w,c:cat}); });
  });
  // Etichette esaurite nel frattempo: escono dalla selezione dell'ospite.
  var before=_sel.length;
  _sel=_sel.filter(function(id){ return _idxById.has(id); });
  if(_sel.length!==before){ _saveSel(); _syncSel(false); }
}

var MESCITA_MAX_PREZZO = parseFloat(_CFG.mescitaMax)||45; // soglia bottiglia vista mescita

// ── MACRO-FILTRO PER VISTA ────────────────────────────────────────────────────
function _getViewFilteredWines(cat){
  var wines=(db[cat]||[]);
  if(currentView==='calice') return wines.filter(function(w){ return w.prezzo_calice>0; });
  if(currentView==='mescita'){
    // Il tetto è tarato sulla bottiglia da 0,75: applicarlo ai grandi formati
    // azzererebbe la sezione per costruzione, non per assenza di etichette.
    if(cat==='AltriFormati') return wines.filter(function(w){ return w.prezzo_carta>0; });
    return wines.filter(function(w){ return w.prezzo_carta>0&&w.prezzo_carta<=MESCITA_MAX_PREZZO; });
  }
  return wines.filter(function(w){ return !w._soloCalice; }); // 'cantina': tutti (le voci solo-calice fuori inventario restano nella vista calice)
}

// ── FUZZY SEARCH CONDIVISO (identico a manager.js, senza SKU lato pubblico) ──
function _normDup(s){
  return String(s||"").toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[-_''.]/g," ")
    .replace(/\b(le|la|il|lo|i|gli|di|del|della|dei|degli|delle|de|du|von|van|the|domaine|chateau|clos|mas|finca)\b/g,"")
    .replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
}
function _trigramSim(a,b){
  if(!a&&!b) return 1; if(!a||!b) return 0;
  function tg(s){ var p="  "+s+"  ",set=new Set(); for(var i=0;i<p.length-2;i++) set.add(p.slice(i,i+3)); return set; }
  var ta=tg(a),tb=tg(b),inter=0;
  ta.forEach(function(t){ if(tb.has(t)) inter++; });
  return (2*inter)/(ta.size+tb.size);
}
function _lev(a,b){
  if(a===b) return 0; var m=a.length,n=b.length; if(!m) return n; if(!n) return m;
  var prev=new Array(n+1),cur=new Array(n+1),i,j;
  for(j=0;j<=n;j++) prev[j]=j;
  for(i=1;i<=m;i++){ cur[0]=i;
    for(j=1;j<=n;j++){ var cost=a[i-1]===b[j-1]?0:1; cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+cost); }
    var t=prev; prev=cur; cur=t;
  }
  return prev[n];
}
function _fuzzyMatch(q,haystack){
  q=_normDup(q); if(!q) return true;
  var hayNorm=_normDup(haystack);
  if(hayNorm.indexOf(q)>=0) return true;
  var qt=q.split(" ").filter(Boolean), ht=hayNorm.split(" ").filter(Boolean);
  if(!ht.length) return false;
  return qt.every(function(tok){
    if(tok.length<=2) return ht.some(function(x){ return x.indexOf(tok)>=0; });
    return ht.some(function(x){
      if(x.indexOf(tok)>=0) return true;
      if(_trigramSim(tok,x)>=0.82) return true;
      return _lev(tok,x) <= (tok.length<=6?1:2);
    });
  });
}

function _matchesFilters(w){
  if(fFresco&&!w.inFresco) return false;
  if(fSearch){
    var hay=[w.n,w.produttore,w.vitigno,w.zona,w.regione,w.paese,w.nazione,w.annata].filter(Boolean).join(" ");
    if(!_fuzzyMatch(fSearch,hay)) return false;
  }
  if(fState.paese&&(w.paese||"").toLowerCase()!==fState.paese.toLowerCase()) return false;
  if(fState.regione&&(w.regione||"").toLowerCase()!==fState.regione.toLowerCase()) return false;
  if(fState.produttore&&(w.produttore||"").toLowerCase()!==fState.produttore.toLowerCase()) return false;
  if(fState.vitigno&&!(w.vitigno||"").toLowerCase().includes(fState.vitigno.toLowerCase())) return false;
  if(fState.annata&&(w.annata||"").toString()!==fState.annata) return false;
  if(w._p>0&&w._p<pMin) return false;
  if(pMax<pMaxG&&w._p>pMax) return false;
  return true;
}

function applyFilters(){ _ensureFrescoCSS();
  var sortSel=document.getElementById("sort-sel");
  var sortVal=sortSel?sortSel.value:"default";
  var html=""; var total=0; var navItems=[];
  var catsToShow=fCat==="tutti"?catConfig.map(function(c){return c.nome;}):[fCat];

  catsToShow.forEach(function(cat){
    var wines=_getViewFilteredWines(cat).filter(_matchesFilters);
    var manuale=(sortVal!=="default");
    if(sortVal==="az") wines.sort(function(a,b){return _cmpTxt(a.n,b.n);});
    else if(sortVal==="za") wines.sort(function(a,b){return _cmpTxt(b.n,a.n);});
    else if(sortVal==="asc") wines.sort(function(a,b){return a._p-b._p;});
    else if(sortVal==="desc") wines.sort(function(a,b){return b._p-a._p;});
    else wines.sort(_cmpSommelier);
    if(!wines.length) return;
    total+=wines.length;

    navItems.push({cat:cat,n:wines.length});
    html+="<section class=\"sezione\" id=\"sez-"+esc(cat)+"\" data-cat=\""+esc(cat)+"\" style=\"--accent:"+(CAT_COLORS[cat]||"#787068")+"\">"
      +"<h2 class=\"sezione-titolo\">"+esc(CAT_LABELS[cat]||cat)+"<span class=\"sez-n\">"+wines.length+"</span></h2>";
    if(currentView==='calice'){
      // Lista breve: la gerarchia geografica sarebbe rumore, resta piatta.
      wines.forEach(function(w){ html+=_buildSingle(w,"calice"); });
    } else if(manuale){
      // Ordinamento esplicito scelto dall'utente: nessun raggruppamento.
      wines.forEach(function(w){ html+=_buildSingle(w); });
    } else if(cat==='AltriFormati'){
      html+=_renderAltriFormati(wines);
    } else {
      html+=_renderGeo(wines,cat);
    }
    html+="</section>";
  });
  // Indice tipologie: navigazione rapida, soprattutto da mobile.
  var navEl=document.getElementById("chipnav"), nav="";
  if(navItems.length>1){
    navItems.forEach(function(it,i){
      nav+="<button type=\"button\" class=\"chip"+(i===0?" on":"")+"\" data-go=\""+esc(it.cat)+"\" style=\"--c:"+(CAT_COLORS[it.cat]||"#787068")+"\">"
        +"<i></i>"+esc(CAT_LABELS[it.cat]||it.cat)+"<b>"+it.n+"</b></button>";
    });
  }
  if(navEl) navEl.innerHTML=nav;

  var rc=document.getElementById("results-count");
  if(rc) rc.textContent=total+" etichett"+(total===1?"a":"e");
  var wl=document.getElementById("wine-list");
  var _legenda = html.indexOf("w-fresco")>=0
    ? "<div class=\"fresco-legenda\"><span class=\"w-fresco\">\u2744\uFE0E</span>servito in fresco</div>"
    : "";
  if(wl) wl.innerHTML=html?(html+_legenda):"<div class=\"vuoto\">Nessun vino trovato.</div>";
  _syncFabBadge();
  _layoutSticky(); _spy();
}

// ── STICKY + SCROLL-SPY ──────────────────────────────────────────────────────
// L'offset dipende dalle barre sticky reali (mobile: indietro+ricerca+ordina,
// desktop: nessuna), quindi si misura invece di cablarlo nel CSS.
function _layoutSticky(){
  // Unica barra fissa sopra la lista: il pulsante "Indietro" su mobile.
  var root=document.documentElement, back=document.getElementById("btn-back-mobile");
  var top=(back&&getComputedStyle(back).position==="fixed"&&back.offsetHeight)?back.offsetHeight:0;
  var nav=document.getElementById("chipnav");
  root.style.setProperty("--stick-top",top+"px");
  root.style.setProperty("--nav-h",(nav?nav.offsetHeight:0)+"px");
}
var _spyRaf=0,_spyCur=null;
function _spy(){
  var nav=document.getElementById("chipnav"); if(!nav||!nav.firstChild) return;
  var lim=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--stick-top"))||0)+nav.offsetHeight+16;
  var secs=document.querySelectorAll("#wine-list .sezione"),cur=secs[0];
  for(var i=0;i<secs.length;i++){ if(secs[i].getBoundingClientRect().top<=lim) cur=secs[i]; else break; }
  if(!cur) return;
  var cat=cur.getAttribute("data-cat"),on=null;
  nav.querySelectorAll(".chip").forEach(function(c){ var a=c.getAttribute("data-go")===cat; c.classList.toggle("on",a); if(a) on=c; });
  if(on&&_spyCur!==cat){ _spyCur=cat; nav.scrollTo({left:Math.max(0,on.offsetLeft-16),behavior:"smooth"}); }
}
function _onScroll(){ if(_spyRaf) return; _spyRaf=requestAnimationFrame(function(){ _spyRaf=0; _spy(); }); }
function _goSection(cat){
  var s=document.getElementById("sez-"+cat); if(!s) return;
  s.scrollIntoView({behavior:"smooth",block:"start"});
}

// ── LA TUA SELEZIONE ──────────────────────────────────────────────────────────
// Shortlist per il tavolo: si salva nel browser dell'ospite e si mostra al
// personale a schermo pieno. Nessun dato lascia il dispositivo.
var _SEL_KEY=DB_USER==="default"?"carta_sel_v1":"carta_sel_v1_"+DB_USER; // stesso origin github.io: niente selezioni condivise tra locali
var _sel=(function(){ try{ var a=JSON.parse(localStorage.getItem(_SEL_KEY)||"[]"); return Array.isArray(a)?a.map(String):[]; }catch(e){ return []; } })();
function _saveSel(){ try{ localStorage.setItem(_SEL_KEY,JSON.stringify(_sel)); }catch(e){} }
function _isSel(id){ return _sel.indexOf(String(id))>-1; }
function _selWines(){ return _sel.map(function(id){ var it=_idxById.get(id); return it?it.v:null; }).filter(Boolean); }
function toggleSel(id){
  id=String(id); var i=_sel.indexOf(id);
  if(i>-1) _sel.splice(i,1); else if(_idxById.has(id)) _sel.push(id);
  _saveSel(); _syncSel(i<0);
}
function clearSel(){ _sel=[]; _saveSel(); _syncSel(false); closeSel(); }
function _syncSel(added){
  document.querySelectorAll("[data-sel]").forEach(function(b){
    var on=_isSel(b.getAttribute("data-sel"));
    b.setAttribute("aria-pressed",on?"true":"false");
    if(b.classList.contains("sel-cta")) b.textContent=on?"✓ Nella tua selezione":"+ Aggiungi alla selezione";
    else b.setAttribute("aria-label",on?"Togli dalla selezione":"Aggiungi alla selezione");
  });
  var list=_selWines(), n=list.length;
  document.body.classList.toggle("has-sel",n>0);
  var fab=document.getElementById("sel-fab");
  if(fab){
    fab.querySelector(".sel-n").textContent=n;
    if(added){ fab.classList.remove("bump"); void fab.offsetWidth; fab.classList.add("bump"); }
  }
  var sh=document.getElementById("sel-sheet");
  if(sh&&sh.classList.contains("show")){ if(n) _renderSel(); else closeSel(); }
}
function _ensureSelUI(){
  if(document.getElementById("sel-fab")) return;
  var fab=document.createElement("button");
  fab.type="button"; fab.id="sel-fab"; fab.className="sel-fab";
  fab.innerHTML="La tua selezione <span class=\"sel-n\">0</span>";
  fab.addEventListener("click",openSel);
  var sh=document.createElement("div");
  sh.id="sel-sheet"; sh.className="sel-overlay";
  sh.innerHTML="<div class=\"sel-card\" role=\"dialog\" aria-modal=\"true\" aria-label=\"La tua selezione\"></div>";
  sh.addEventListener("click",function(e){ if(e.target===sh) closeSel(); });
  document.body.appendChild(fab); document.body.appendChild(sh);
}
function _renderSel(show){
  var card=document.querySelector("#sel-sheet .sel-card"); if(!card) return;
  var list=_selWines(), tot=0, na=0;
  var items=list.map(function(w){
    if(w._p) tot+=w._p; else na++;
    return "<li class=\"sel-it\"><div class=\"sel-it-main\">"
      +"<span class=\"sel-it-prod\">"+esc(w.produttore)+"</span>"
      +"<span class=\"sel-it-nome\">"+esc(w.n)+(w.annata?" <em>"+esc(w.annata)+"</em>":"")+(w.formato?" <em>"+esc(_fmtNome(w.formato))+"</em>":"")+"</span>"
      +"</div><span class=\"sel-it-p\">"+(w.p?esc(w.p):"su richiesta")+"</span>"
      +(show?"":"<button type=\"button\" class=\"sel-rm\" data-sel=\""+esc(String(w.id))+"\" aria-label=\"Togli\">×</button>")
      +"</li>";
  }).join("");
  card.parentElement.classList.toggle("sel-show",!!show);
  card.innerHTML=
    "<div class=\"sel-hdr\"><span>"+(show?"Vorremmo ordinare":"La tua selezione")+"</span><button type=\"button\" class=\"sel-x\" onclick=\""+(show?"_renderSel(false)":"closeSel()")+"\" aria-label=\"Chiudi\">×</button></div>"
    +"<ul class=\"sel-list\">"+items+"</ul>"
    +(show?"":"<div class=\"sel-tot\"><span>"+list.length+" bottigli"+(list.length===1?"a":"e")+"</span><span>€ "+_fmtP(tot)+(na?" + "+na+" su richiesta":"")+"</span></div>"
      +"<div class=\"sel-acts\"><button type=\"button\" class=\"sel-go\" onclick=\"_renderSel(true)\">Mostra al personale</button>"
      +"<button type=\"button\" class=\"sel-clear\" onclick=\"clearSel()\">Svuota</button></div>");
}
function openSel(){
  if(!_selWines().length) return;
  _renderSel(false);
  var sh=document.getElementById("sel-sheet"); if(!sh) return;
  if(!sh.classList.contains("show")){ sh.classList.add("show"); _lockScroll(); }
}
function closeSel(){
  var sh=document.getElementById("sel-sheet");
  if(sh&&sh.classList.contains("show")){ sh.classList.remove("show","sel-show"); _unlockScroll(); }
}

// ── RENDER GERARCHICO ─────────────────────────────────────────────────────────
// Tipologia (sezione) → Paese → Regione → Produttore A-Z → referenze per prezzo.
// Presuppone l'input già ordinato con _cmpSommelier: raggruppa per sequenze contigue.
function _runs(arr,keyFn){
  var out=[],cur=null;
  arr.forEach(function(w){ var k=keyFn(w); if(!cur||cur.k!==k){ cur={k:k,items:[]}; out.push(cur); } cur.items.push(w); });
  return out;
}
function _renderGeo(wines,cat){
  var html="";
  _runs(wines,function(w){ return w.paese||w.nazione||""; }).forEach(function(P){
    html+="<div class='paese-blk'><h3 class='grp-l1'>"+esc(P.k||"Altre provenienze")+"</h3>";
    var regs=_runs(P.items,function(w){ return w.regione||""; });
    var named=regs.some(function(R){ return R.k; });
    regs.forEach(function(R){
      html+="<div class='reg-blk'>";
      // Le regioni vuote ordinano in coda: se il paese ha sottosezioni serve comunque un titolo.
      if(R.k) html+="<h4 class='grp-l2'>"+esc(R.k)+"</h4>";
      else if(named) html+="<h4 class='grp-l2'>Altre zone</h4>";
      _runs(R.items,_prodId).forEach(function(G){ html+=_buildProdBlock(G.items); });
      html+="</div>";
    });
    html+="</div>";
  });
  return html;
}
// Blocco produttore: il nome compare una volta sola, sotto tutte le sue etichette.
// Se tutte condividono la stessa zona/cru la si porta nell'intestazione.
function _geoTxt(w){ return [_cru(w),w.regione,w.paese].filter(Boolean).join(" \u00b7 "); }
// Riga isolata (ordinamenti manuali, vista calice): stesso blocco, geografia sulla riga.
function _buildSingle(w,mode){
  return "<div class='prod'><div class='prod-h'><span class='prod-n'>"+esc(w.produttore||"")+"</span></div>"+_buildRefRow(w,_geoTxt(w),mode)+"</div>";
}
function _buildProdBlock(items,geo){
  var zone=items.map(_cru), z0=zone[0];
  var shared=!geo&&!!z0&&zone.every(function(z){ return z===z0; });
  var html="<div class='prod'><div class='prod-h'><span class='prod-n'>"+esc(items[0].produttore||"Produttore n.d.")+"</span>"
    +(shared?"<span class='prod-z'>"+esc(z0)+"</span>":"")+"</div>";
  items.forEach(function(w){ html+=_buildRefRow(w,geo?_geoTxt(w):(shared?"":_cru(w))); });
  return html+"</div>";
}
function _buildRefRow(w,zona,mode){
  var cal=(mode==="calice");
  var id=esc(String(w.id)), on=_isSel(w.id);
  var meta=[];
  if(w.vitigno) meta.push("<i>"+esc(w.vitigno)+"</i>");
  if(zona)      meta.push(esc(zona));
  return "<div class='ref' data-id='"+id+"'>"
    +"<div class='ref-main'>"
    +  "<div class='ref-nome'>"+esc(w.n)+(w.annata?" <span class='w-annata'>"+esc(w.annata)+"</span>":"")+_fresco(w)
    +    (w.formato?" <span class='w-formato'>"+esc(_fmtNome(w.formato))+"</span>":"")+"</div>"
    +  (meta.length?"<div class='ref-meta'>"+meta.join("<span class='w-sep'> · </span>")+"</div>":"")
    +"</div>"
    +"<div class='ref-price'>"
    +  (cal?"<span class='w-price'>"+esc(w.b)+"</span><span class='ref-calice'>al calice</span>"
         :(w.p?"<span class='w-price'>"+esc(w.p)+"</span>":"<span class='w-price w-price-na'>su richiesta</span>")
          +(w.b?"<span class='ref-calice'>calice "+esc(w.b)+"</span>":""))
    +"</div>"
    +(cal?"":"<button type='button' class='sel-btn' data-sel='"+id+"' aria-pressed='"+on+"' aria-label='"+(on?"Togli dalla selezione":"Aggiungi alla selezione")+"'></button>")
    +"</div>";
}

// Altri Formati: bucket dimensionale → tipologia enologica → ordine sommelier.
// Profondità volutamente ferma a due livelli: la geografia resta sulla riga.
function _renderAltriFormati(wines){
  var html="",byBucket={};
  wines.forEach(function(w){ (byBucket[w._fmtBucket]=byBucket[w._fmtBucket]||[]).push(w); });
  FMT_BUCKETS.forEach(function(b){
    var arr=byBucket[b.key]; if(!arr||!arr.length) return;
    html+="<div class='grp-l1'>"+esc(b.label)+"</div>";
    var byTipo={};
    arr.forEach(function(w){ var k=w._tipoKey||"Altro"; (byTipo[k]=byTipo[k]||[]).push(w); });
    CAT_ORDER_ENO.forEach(function(t){
      var list=byTipo[t]; if(!list||!list.length) return;
      html+="<div class='grp-l2'>"+esc(CAT_LABELS[t]||t)+"</div>";
      _runs(list.sort(_cmpSommelier),_prodId).forEach(function(G){ html+=_buildProdBlock(G.items,true); });
    });
  });
  return html;
}

function _buildWineRow(w,cat){
  var slug=cat.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
  var accentColor=CAT_COLORS[cat]||"#787068";
  var annata=w.annata?"<span class='w-annata'>"+esc(w.annata)+"</span>":"";
  var formato=w.formato?"<span class='w-formato' title='"+esc(_fmtLitri(w.formato))+"'>"+esc(_fmtNome(w.formato))+"</span>":"";
  var meta=[];
  if(w.produttore) meta.push("<span class='w-prod'>"+esc(w.produttore)+"</span>");
  if(w.vitigno)    meta.push("<span class='w-vitigno'>"+esc(w.vitigno)+"</span>");
  var metaHtml=meta.length?"<div class='w-meta'>"+meta.join("<span class='w-sep'>\u00b7</span>")+"</div>":"";
  var geo=[];
  if(w.zona)                        geo.push(esc(w.zona));
  if(w.regione&&w.regione!==w.zona) geo.push(esc(w.regione));
  if(w.nazione)                     geo.push(esc(w.nazione));
  var geoHtml=geo.length?"<div class='w-geo'>"+geo.join("<span class='w-sep'>\u00b7</span>")+"</div>":"";
  var priceHtml="<div class='w-price-wrap'>"
    +"<span class='w-price'>"+(w.p||"\u2014")+"</span>"
    +(w.b?"<span class='w-calice'>"+esc(w.b)+"</span>":"")
    +"</div>";
  return "<div class='vino vino-"+slug+"' data-id='"+w.id+"' style='--accent:"+accentColor+"'>"
    +"<div class='w-accent-bar'></div>"
    +"<div class='w-body'>"
    +  "<div class='w-sx'>"
    +    "<div class='w-nome'>"+esc(w.n)+_fresco(w)+annata+formato+"</div>"
    +    metaHtml+geoHtml
    +  "</div>"
    +  "<div class='w-dx'>"+priceHtml+"</div>"
    +"</div>"
    +"</div>";
}

// Vista calice: mostra prezzo al calice + info categoria
function _buildCaliceRow(w,cat){
  var slug=cat.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
  var accentColor=CAT_COLORS[cat]||"#787068";
  var catLabel=CAT_LABELS[cat]||cat;
  var annata=w.annata?"<span class='w-annata'>"+esc(w.annata)+"</span>":"";
  var meta=[];
  if(w.produttore) meta.push("<span class='w-prod'>"+esc(w.produttore)+"</span>");
  if(w.vitigno)    meta.push("<span class='w-vitigno'>"+esc(w.vitigno)+"</span>");
  meta.push("<span class='w-tipo-label' style='color:"+accentColor+"'>"+esc(catLabel)+"</span>");
  var metaHtml="<div class='w-meta'>"+meta.join("<span class='w-sep'>\u00b7</span>")+"</div>";
  var geo=[];
  if(w.zona)                        geo.push(esc(w.zona));
  if(w.regione&&w.regione!==w.zona) geo.push(esc(w.regione));
  if(w.nazione)                     geo.push(esc(w.nazione));
  var geoHtml=geo.length?"<div class='w-geo'>"+geo.join("<span class='w-sep'>\u00b7</span>")+"</div>":"";
  return "<div class='vino vino-"+slug+" vino-calice' data-id='"+w.id+"' style='--accent:"+accentColor+"'>"
    +"<div class='w-accent-bar'></div>"
    +"<div class='w-body'>"
    +  "<div class='w-sx'>"
    +    "<div class='w-nome'>"+esc(w.n)+_fresco(w)+annata+"</div>"
    +    metaHtml+geoHtml
    +  "</div>"
    +  "<div class='w-dx'><span class='w-price'>"+esc(w.b)+"</span></div>"
    +"</div>"
    +"</div>";
}

// ── SYNC UI IN BASE ALLA VISTA ────────────────────────────────────────────────
function _syncViewUI(view){
  // Active state bottoni desktop
  document.querySelectorAll(".btn-view[data-view]").forEach(function(el){
    el.classList.toggle("active",el.getAttribute("data-view")===view);
  });
  var isCantina=(view==='cantina');
  var isMescita=(view==='mescita');
  // Filtri sidebar: visibili con cantina E mescita
  var sf=document.getElementById("sidebar-filters");
  if(sf){ sf.classList.toggle("visible", isCantina); }
  document.body.classList.toggle("view-cantina", isCantina);
  // Search bar destra: visibile solo con cantina
  var sbw=document.getElementById("search-bar-wrap");
  if(sbw){ sbw.classList.toggle("visible",isCantina); }
  // Reset filtri avanzati se non cantina
  if(!isCantina){
    fSearch=""; fCat="tutti";
    fState={paese:"",regione:"",produttore:"",vitigno:"",annata:""};
    pMin=0; pMax=pMaxG;
    var inp=document.getElementById("search-input"); if(inp) inp.value="";
    var cl=document.getElementById("search-clear"); if(cl) cl.classList.remove("show");
    document.querySelectorAll("#range-min").forEach(function(el){el.value=0;});
    document.querySelectorAll("#range-max").forEach(function(el){el.value=pMaxG;});
    _updateRangeFill();
  }
  buildSortBar();
}

// ── CAMBIO VISTA (desktop) ────────────────────────────────────────────────────
function setView(view){
  currentView=view;
  _syncViewUI(view);
  applyFilters(); buildSidebar();
}

// ── CAMBIO VISTA (mobile: da landing) ────────────────────────────────────────
function setViewMobile(view){
  currentView=view;
  _syncViewUI(view);
  var landing=document.getElementById("mobile-landing");
  var back=document.getElementById("btn-back-mobile");
  if(landing){
    landing.classList.add("is-leaving");
    setTimeout(function(){ landing.classList.add("hidden"); }, 220);
  }
  if(back) back.style.display="flex";
  document.body.classList.add("mobile-list-view");
  // Aggiungi stato alla history del browser così il tasto "indietro" funziona
  history.pushState({mobileLanding:false, view:view}, "", "");
  applyFilters(); buildSidebar();
}

function backToLanding(){
  currentView='calice';
  var landing=document.getElementById("mobile-landing");
  var back=document.getElementById("btn-back-mobile");
  if(landing){
    landing.classList.remove("hidden");
    requestAnimationFrame(function(){ landing.classList.remove("is-leaving"); });
  }
  if(back) back.style.display="none";
  document.body.classList.remove("mobile-list-view");
}

// Intercetta il tasto "indietro" del browser su mobile
window.addEventListener("popstate", function(e){
  // Solo su mobile (landing visibile = siamo in modalità mobile)
  var landing=document.getElementById("mobile-landing");
  if(!landing) return;
  // Se siamo nella lista (landing nascosta), torna alla landing
  if(document.body.classList.contains("mobile-list-view")){
    backToLanding();
  }
});

function buildSidebar(){
  var inner=document.getElementById("sidebar-inner"); if(!inner) return;
  var html="";
  // Filtri avanzati solo per cantina
  if(currentView==='cantina'){
    [
      {field:"paese",label:"Paese"},
      {field:"regione",label:"Regione"},
      {field:"produttore",label:"Produttore"},
      {field:"vitigno",label:"Vitigno"},
      {field:"annata",label:"Annata"}
    ].forEach(function(f){
      var vals=_getUniqueVals(f.field); if(!vals.length) return;
      if(f.field==="annata") vals=vals.slice().sort(function(a,b){ return (parseInt(b,10)||0)-(parseInt(a,10)||0); });
      var isOpen=!!(fState[f.field]);
      var uid="acc-"+f.field;
      var tuttiLabel=(f.field==="paese"||f.field==="regione")?"Tutti":"Tutte";
      html+="<div class=\"sb-acc-wrap"+(isOpen?" open":"")+"\" id=\"wrap-"+uid+"\">"
        +"<div class=\"sb-acc-head\" onclick=\"_toggleAcc(this)\">"
        +"<span class=\"sb-acc-title\">"+f.label+"</span>"
        +"<span class=\"sb-acc-arrow\">▼</span></div>"
        +"<div class=\"sb-acc-body\" id=\""+uid+"\">"
        +"<ul class=\"sb-filter-list\">"
        +"<li class=\"sb-filter-item"+(fState[f.field]===""?" active":"")+"\" "
          +"onclick=\"fState['"+f.field+"']='';applyFilters();buildSidebar();\">"+tuttiLabel+"</li>";
      vals.forEach(function(v){
        html+="<li class=\"sb-filter-item"+(fState[f.field]===v?" active":"")+" sb-fval\" "
          +"data-field=\""+esc(f.field)+"\" data-val=\""+esc(v)+"\">"+esc(v)+"</li>";
      });
      html+="</ul></div></div>";
    });
    var prezzoOpen=(pMin>0||pMax<pMaxG);
    html+="<div class=\"sb-acc-wrap"+(prezzoOpen?" open":"")+"\" id=\"wrap-acc-prezzo\">"
      +"<div class=\"sb-acc-head\" onclick=\"_toggleAcc(this)\">"
      +"<span class=\"sb-acc-title\">Prezzo bottiglia</span>"
      +"<span class=\"sb-acc-arrow\">▼</span></div>"
      +"<div class=\"sb-acc-body\" id=\"acc-prezzo\">"
      +"<div class=\"price-row\"><span>€ "+pMin+"</span><span>€ "+pMax+(pMax>=pMaxG?"+":"")+"</span></div>"
      +"<div class=\"dual-range-wrap\"><div class=\"dual-range-track\"></div>"
      +"<div class=\"dual-range-fill\" id=\"range-fill\"></div>"
      +"<input type=\"range\" id=\"range-min\" min=\"0\" max=\""+pMaxG+"\" step=\"5\" value=\""+pMin+"\" oninput=\"onRangeMin(this.value)\" onchange=\"onRangeMinEnd(this.value)\">"
      +"<input type=\"range\" id=\"range-max\" min=\"0\" max=\""+pMaxG+"\" step=\"5\" value=\""+pMax+"\" oninput=\"onRangeMax(this.value)\" onchange=\"onRangeMaxEnd(this.value)\"></div>"
      +"</div></div>";
    html+="<div class=\"sb-sec\" style=\"padding-top:8px\"><button class=\"btn-reset-all\" onclick=\"resetAll()\">↺ Reset filtri</button></div>";
  }
  inner.innerHTML=html;
  _updateRangeFill();
  inner.querySelectorAll(".cat-item[data-cat]").forEach(function(el){
    el.addEventListener("click",function(){ setFCat(el.getAttribute("data-cat")); });
  });
  inner.querySelectorAll(".sb-fval[data-field]").forEach(function(el){
    el.addEventListener("click",function(){
      fState[el.getAttribute("data-field")]=el.getAttribute("data-val");
      applyFilters(); buildSidebar();
    });
  });
  _refreshDrawer();
}
function _toggleAcc(headEl){ var wrap=headEl.parentElement; if(wrap) wrap.classList.toggle("open"); }

function _hasFresco(){
  return catConfig.some(function(c){ return _getViewFilteredWines(c.nome).some(function(w){ return w.inFresco; }); });
}
function toggleFresco(){ fFresco=!fFresco; applyFilters(); buildSortBar(); buildSidebar(); }
function buildSortBar(){
  var wrap=document.getElementById("sort-bar-wrap"); if(!wrap) return;
  _ensureFrescoCSS();
  var cur=(document.getElementById("sort-sel")||{}).value||"default";
  var opts=[["default","Per produttore"],["asc","Prezzo crescente"],["desc","Prezzo decrescente"],["az","Nome A → Z"],["za","Nome Z → A"]];
  var html="<select class=\"sort-select\" id=\"sort-sel\" aria-label=\"Ordina\" onchange=\"applyFilters()\">";
  opts.forEach(function(o){ html+="<option value=\""+o[0]+"\""+(cur===o[0]?" selected":"")+">"+o[1]+"</option>"; });
  html+="</select>";
  if(fFresco||_hasFresco()){
    html+="<button type=\"button\" class=\"fresco-toggle"+(fFresco?" active":"")+"\" onclick=\"toggleFresco()\" aria-pressed=\""+(fFresco?"true":"false")+"\"><span class=\"ico\">\u2744\uFE0E</span>In fresco</button>";
  }
  wrap.innerHTML=html;
}

function countAll(){ return catConfig.reduce(function(s,c){return s+(db[c.nome]||[]).length;},0); }
function _countFiltered(cat){
  return _getViewFilteredWines(cat).filter(_matchesFilters).length;
}
function countAllFiltered(){ return catConfig.reduce(function(s,c){return s+_countFiltered(c.nome);},0); }
function _getUniqueVals(field){
  var set=new Set();
  catConfig.forEach(function(c){
    _getViewFilteredWines(c.nome).forEach(function(w){
      var fields=["paese","regione","produttore","vitigno"];
      for(var i=0;i<fields.length;i++){
        var f=fields[i]; if(f===field||!fState[f]) continue;
        if(f==="vitigno"){ if(!(w.vitigno||"").toLowerCase().includes(fState[f].toLowerCase())) return; }
        else { if((w[f]||"").toLowerCase()!==fState[f].toLowerCase()) return; }
      }
      if(!w[field]) return;
      if(field==="vitigno"){ w[field].split(",").forEach(function(v){ var t=_capVitigni(v.trim()); if(t) set.add(t); }); }
      else { set.add(w[field]); }
    });
  });
  return Array.from(set).sort(function(a,b){ return a.localeCompare(b,"it"); });
}
function setFCat(cat){ fCat=cat; applyFilters(); buildSidebar(); }
function _updatePriceLabel(){ var pr=document.querySelectorAll(".price-row"); pr.forEach(function(el){ var spans=el.querySelectorAll("span"); if(spans[0]) spans[0].textContent="€ "+pMin; if(spans[1]) spans[1].textContent="€ "+pMax+(pMax>=pMaxG?"+":""); }); }
function onRangeMin(v){ v=parseInt(v); if(v>pMax-5)v=pMax-5; pMin=v; applyFilters(); _updateRangeFill(); _updatePriceLabel(); document.querySelectorAll("#range-min").forEach(function(el){el.value=v;}); }
function onRangeMax(v){ v=parseInt(v); if(v<pMin+5)v=pMin+5; pMax=v; applyFilters(); _updateRangeFill(); _updatePriceLabel(); document.querySelectorAll("#range-max").forEach(function(el){el.value=v;}); }
function onRangeMinEnd(v){ onRangeMin(v); buildSidebar(); }
function onRangeMaxEnd(v){ onRangeMax(v); buildSidebar(); }
function _updateRangeFill(){ var fill=document.getElementById("range-fill"); if(!fill)return; var p1=pMin/pMaxG*100,p2=pMax/pMaxG*100; fill.style.left=p1+"%"; fill.style.width=(p2-p1)+"%"; }
var _searchDebounce=null;
function onSearch(inp){ fSearch=inp.value; var cl=document.getElementById("search-clear"); if(cl) cl.classList.toggle("show",!!fSearch); clearTimeout(_searchDebounce); _searchDebounce=setTimeout(applyFilters,150); }
function clearSearch(){ fSearch=""; var inp=document.getElementById("search-input"); if(inp) inp.value=""; var cl=document.getElementById("search-clear"); if(cl) cl.classList.remove("show"); applyFilters(); }
function resetAll(){
  fCat="tutti"; fSearch=""; pMin=0; pMax=pMaxG; fFresco=false;
  fState={paese:"",regione:"",produttore:"",vitigno:"",annata:""};
  var inp=document.getElementById("search-input"); if(inp) inp.value="";
  var cl=document.getElementById("search-clear"); if(cl) cl.classList.remove("show");
  document.querySelectorAll("#range-min").forEach(function(el){el.value=0;});
  document.querySelectorAll("#range-max").forEach(function(el){el.value=pMaxG;});
  _updateRangeFill(); _syncDrawerRangeFill();
  applyFilters(); buildSidebar();
}

// ── MODAL DETTAGLIO VINO ──────────────────────────────────────────────────────
function openModal(id){
  var item=_idxById.get(String(id)); if(!item) return;
  var w=item.v, cat=item.c;
  var catEl=document.getElementById("modal-cat");
  var nomeEl=document.getElementById("modal-nome");
  var annataEl=document.getElementById("modal-annata");
  var prezzoEl=document.getElementById("modal-prezzo");
  var bodyEl=document.getElementById("modal-body");
  var noteEl=document.getElementById("modal-note-wrap");
  if(catEl) catEl.textContent=CAT_LABELS[cat]||cat;
  if(nomeEl) nomeEl.textContent=w.n;
  if(annataEl) annataEl.textContent=w.annata?"Annata "+w.annata:"";
  var p="";
  if(w.p) p+="<div class=\"modal-p-item\"><div class=\"modal-p-lbl\">Bottiglia</div><div class=\"modal-p-val\">"+esc(w.p)+"</div></div>";
  if(w.b) p+="<div class=\"modal-p-item\"><div class=\"modal-p-lbl\">Al calice</div><div class=\"modal-p-val\">"+esc(w.b)+"</div></div>";
  var on=_isSel(w.id);
  p+="<button type=\"button\" class=\"sel-cta\" data-sel=\""+esc(String(w.id))+"\" aria-pressed=\""+on+"\">"+(on?"\u2713 Nella tua selezione":"+ Aggiungi alla selezione")+"</button>";
  if(prezzoEl) prezzoEl.innerHTML=p;
  var body="";
  [["Produttore",w.produttore],["Formato",w.formato?(_fmtNome(w.formato)+" · "+_fmtLitri(w.formato)):null],["Regione",w.regione],
   ["Zona",w.zona&&w.zona!==w.regione?w.zona:null],["Nazione",w.nazione],["Vitigno",w.vitigno],["Tipologia",w.tipologia]
  ].forEach(function(r){ if(r[1]) body+="<div class=\"modal-row\"><span class=\"modal-lbl\">"+r[0]+"</span><span class=\"modal-val\">"+esc(r[1])+"</span></div>"; });
  if(bodyEl) bodyEl.innerHTML=body||"<p style=\"color:var(--grey);font-size:13px\">Nessun dettaglio disponibile.</p>";
  if(noteEl){
    if(w.note&&w.note.trim()){
      noteEl.style.display="block";
      var noteTxtEl=document.getElementById("modal-note-text");
      if(noteTxtEl) noteTxtEl.textContent=w.note;
    } else { noteEl.style.display="none"; }
  }
  var modal=document.getElementById("modal");
  if(modal) modal.classList.add("show");
  _lockScroll();
}
function closeModal(e){ if(e&&e.target!==document.getElementById("modal")) return; closeModalDirect(); }
function closeModalDirect(){ var modal=document.getElementById("modal"); if(!modal||!modal.classList.contains("show")) return; modal.classList.remove("show"); _unlockScroll(); }
document.addEventListener("keydown",function(e){
  if(e.key!=="Escape") return;
  var sh=document.getElementById("sel-sheet");
  if(sh&&sh.classList.contains("show")) closeSel(); else closeModalDirect();
});

// ── DRAWER FILTRI MOBILE ──────────────────────────────────────────────────────
function _countActiveFilters(){ var n=0; if(fSearch)n++; if(pMin>0||pMax<pMaxG)n++; if(fState.paese)n++; if(fState.regione)n++; if(fState.produttore)n++; if(fState.vitigno)n++; if(fState.annata)n++; if(fFresco)n++; return n; }
function _syncFabBadge(){
  var n=_countActiveFilters();
  var b=document.getElementById("fab-badge");
  if(b){ b.textContent=n; b.classList.toggle("show",n>0); }
  var dh=document.getElementById("drawer-handle-count");
  if(dh){ dh.textContent=n>0?" ("+n+")":""; }
}
function openDrawer(){
  var body=document.getElementById("drawer-body");
  var src=document.getElementById("sidebar-inner");
  if(!body||!src) return;
  document.getElementById("filter-drawer").classList.add("open");
  document.getElementById("drawer-overlay").classList.add("show");
  _lockScroll();
  _refreshDrawer();
}
function _refreshDrawer(){
  var fd=document.getElementById("filter-drawer"); if(!fd||!fd.classList.contains("open")) return;
  // Ricostruisce il body del drawer con lo stato aggiornato
  var body=document.getElementById("drawer-body");
  var src=document.getElementById("sidebar-inner");
  if(!body||!src) return;
  body.innerHTML=src.innerHTML;
  body.querySelectorAll("[id]").forEach(function(el){ el.removeAttribute("id"); });
  // Toggle "In fresco" in cima al drawer (i filtri su mobile stanno qui, non nella sort-bar)
  if(fFresco || _hasFresco()){
    _ensureFrescoCSS();
    var ft=document.createElement("button");
    ft.type="button";
    ft.className="fresco-toggle drawer-fresco"+(fFresco?" active":"");
    ft.setAttribute("aria-pressed", fFresco?"true":"false");
    ft.innerHTML="<span class=\"df-ice\">\u2744\uFE0E</span> Solo vini in fresco";
    ft.addEventListener("click",function(){ toggleFresco(); closeDrawer(); });
    body.insertBefore(ft, body.firstChild);
  }
  var ranges=body.querySelectorAll("input[type=range]");
  if(ranges[0]) ranges[0].classList.add("drawer-range-min");
  if(ranges[1]) ranges[1].classList.add("drawer-range-max");
  body.querySelectorAll(".cat-item[data-cat],.sb-btn[data-cat]").forEach(function(el){
    el.addEventListener("click",function(){ setFCat(el.getAttribute("data-cat")); closeDrawer(); });
  });
  body.querySelectorAll(".sb-fval[data-field]").forEach(function(el){
    el.addEventListener("click",function(){
      fState[el.getAttribute("data-field")]=el.getAttribute("data-val");
      applyFilters(); buildSidebar(); closeDrawer();
    });
  });
  var rMin=body.querySelector(".drawer-range-min");
  var rMax=body.querySelector(".drawer-range-max");
  if(rMin){ rMin.addEventListener("input",function(){ onRangeMin(this.value); _syncDrawerRangeFill(); }); rMin.addEventListener("change",function(){ onRangeMinEnd(this.value); }); }
  if(rMax){ rMax.addEventListener("input",function(){ onRangeMax(this.value); _syncDrawerRangeFill(); }); rMax.addEventListener("change",function(){ onRangeMaxEnd(this.value); }); }
  _syncDrawerRangeFill();
}
function _syncDrawerRangeFill(){
  var body=document.getElementById("drawer-body"); if(!body) return;
  var fill=body.querySelector(".dual-range-fill"); if(!fill) return;
  var p1=pMin/pMaxG*100,p2=pMax/pMaxG*100;
  fill.style.left=p1+"%"; fill.style.width=(p2-p1)+"%";
}
function closeDrawer(){
  var fd=document.getElementById("filter-drawer"),ov=document.getElementById("drawer-overlay");
  if(fd) fd.classList.remove("open");
  if(ov) ov.classList.remove("show");
  _unlockScroll(); _syncFabBadge();
}
(function(){
  var startY=0,drawerEl=null;
  document.addEventListener("touchstart",function(e){
    drawerEl=document.getElementById("filter-drawer");
    if(!drawerEl||!drawerEl.classList.contains("open")) return;
    startY=e.touches[0].clientY;
  },{passive:true});
  document.addEventListener("touchend",function(e){
    if(!drawerEl||!drawerEl.classList.contains("open")) return;
    if(e.changedTouches[0].clientY-startY>80) closeDrawer();
  },{passive:true});
})();

init();

// ================= 1993 — game logic =================
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>Math.round(n).toLocaleString('ru-RU');
const MON=['я~нваря','ф~евраля','м~арта','а~преля','м~ая','и~юня','и~юля','а~вгуста','с~ентября','о~ктября','н~оября','д~екабря'];
const WD=['в~оскресенье','п~онедельник','в~торник','с~реда','ч~етверг','п~ятница','с~уббота'];
const dateOf=day=>new Date(1993,8,13+day);                // day 1 = 14 Sep 1993, day 8 = 21 Sep (decree)
const dateStr=day=>{const d=dateOf(day);return d.getDate()+' '+MON[d.getMonth()];};
const DECREE_DAY=8;
const PRATE=5;                                            // Kremlin pressure per night in the crisis (100 = assault)
const GL=window.GAME_LANG||'', SAVE='1993-save-v4'+(GL?'-'+GL:''), CHRON='1993-chron'+(GL?'-'+GL:''), OPTS='1993-opts';
const store={get(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}},
             set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}},
             del(k){try{localStorage.removeItem(k);}catch(e){}}};

let S=null;           // game state
let screen='title';

function newState(){
  const pts={}; POINTS.forEach(p=>pts[p.id]=p.vs);
  const fac={}; FACTIONS.forEach(f=>fac[f.id]={n:f.n,loy:f.loy,rad:f.rad,room:f.room});
  return {day:1, phase:1, leg:60, ppl:800, mil:0, gun:150, med:15, sup:5, hope:70, rad:10, pr:0, bar:0, city:45, omon:100, kmed:0,
    pts, fac, away:0, cordon:0, ring:null, did:{}, strike:null, orders:2, used:{}, once:{}, laws:{}, lawCharges:1, flags:{}, fired:{}, appeals:{}, uses:{}, out:{}, st:{},
    sel:'wh', selFac:'kr', view:'map', log:[], chron:[], queue:[], kremlin:null, am:null, A:null};
}

// ---------- effects ----------
function merge(a,b){const o=JSON.parse(JSON.stringify(a||{}));for(const k in b||{}){
  if(k==='pts'){o.pts=o.pts||{};for(const p in b.pts)o.pts[p]=(o.pts[p]||0)+b.pts[p];}
  else if(k==='fac'){o.fac=o.fac||{};for(const f in b.fac){o.fac[f]=o.fac[f]||{};for(const q in b.fac[f])o.fac[f][q]=(o.fac[f][q]||0)+b.fac[f][q];}}
  else o[k]=(o[k]||0)+b[k];}return o;}
const fxOf=(obj)=>merge(merge(obj.fx,obj.dyn?obj.dyn(S):{}),obj.fac?{fac:obj.fac}:{});
function apply(fx){
  for(const k in fx){
    if(k==='pts'){for(const p in fx.pts)S.pts[p]=clamp(S.pts[p]+fx.pts[p],0,100);continue;}
    if(k==='fac'){for(const f in fx.fac){const t=S.fac[f],d=fx.fac[f];
      if(d.n){t.n=Math.max(0,t.n+d.n);const F0=FACTIONS.find(x=>x.id===f);if(F0.kind==='dep')t.n=Math.min(t.n,F0.n);} if(d.loy)t.loy=clamp(t.loy+d.loy,0,10);} continue;}
    if(k==='bar')S.bar=clamp(S.bar+fx.bar,0,5);
    else if(k==='ppl'||k==='gun'||k==='sup'||k==='mil'||k==='med')S[k]=Math.max(0,S[k]+fx[k]);
    else if(k==='leg'&&fx.leg>1&&S.leg>=70)S.leg=clamp(S.leg+Math.ceil(fx.leg/2),0,100); // выше 70 набирать вдвое труднее
    else if(k in S)S[k]=clamp(S[k]+fx[k],0,100);
  }
  if(S.mil>S.gun)S.gun=S.mil; // whoever comes armed brings the weapon along
}
const sg=v=>(v>0?'+':'−')+fmt(Math.abs(v));
function fxText(fx,ctx){
  const out=[];
  for(const k of ['leg','ppl','mil','gun','med','sup','hope','rad','bar','city','omon']){ if(!fx[k])continue; const v=fx[k];
    const good=(k==='rad'||k==='omon')?v<0:v>0; out.push(`<span class="${good?'p':'n'}">${RES_NAMES[k]} ${k==='sup'&&v%1?(v>0?'+':'−')+String(Math.abs(v)).replace('.',','):sg(v)}${k==='sup'?' д~н.':''}</span>`);}
  if(fx.pts)for(const p in fx.pts){const v=fx.pts[p];if(!v)continue;const nm=POINTS.find(q=>q.id===p).nm.replace(/ ↑.*/,'');
    out.push(`<span class="${v>0?'p':'n'}">${p===ctx?'л~ояльность':nm} ${v>=100?'— н~аша':sg(v)}</span>`);}
  if(fx.fac)for(const f in fx.fac){const d=fx.fac[f], nm=f===ctx?'':FACTIONS.find(F=>F.id===f).sh+': ';
    if(d.n)out.push(`<span class="${d.n>0?'p':'n'}">${nm}${d.n<=-900?'у~ходят':d.n>0?'+'+d.n+' ч~ел.':d.n+' ч~ел.'}</span>`);
    if(d.loy)out.push(`<span class="${d.loy>0?'p':'n'}">${nm}${d.loy>=2?'н~амного л~ояльнее':d.loy>0?'л~ояльнее':d.loy<=-2?'с~ильно н~едовольны':'н~едовольны'}</span>`);}
  if(fx.pr)out.push(S&&S.phase===1?`<span class="${fx.pr>0?'n':'p'}">${fx.pr>0?'п~одозрения':'м~еньше п~одозрений'}</span>`:`<span class="${fx.pr>0?'n':'p'}">${fx.pr>0?'ш~турм б~лиже':'ш~турм д~альше'}</span>`);
  return out.join(' · ');
}

// ---------- log ----------
function hhmm(){const h=(Math.random()*24)|0,m=(Math.random()*12|0)*5;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
function log(text,cls,tm){S.log.unshift({tm:tm||hhmm(),text,cls:cls||'',day:S.day}); S.log.length=Math.min(S.log.length,40);}

// ---------- sound effects: all synthesised with WebAudio, no files. Silent until the first real click or key press ----------
const Sfx=(function(){let ctx,master,rv,nb,dcurve,armed=false,gk=1;
  const GAIN={click:4,paper:4,thud:2.5,stamp:2.5,phone:3.5,pips:3,teletype:3,crowd:4,alarm:3,fail:4,fire:2,night:1.6,win:1.6,engine:.6,static:1.3};
  const on=()=>!(store.get(OPTS)||{}).mute, R=Math.random;
  // общий тракт: компрессор на выходе и «комната» (свёрточное эхо из затухающего шума), чтобы звук не был сухим писком
  function setup(c){ctx=c;const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=5;comp.attack.value=.003;comp.release.value=.2;
    master=c.createGain();master.gain.value=.7;master.connect(comp);comp.connect(c.destination);
    const sr=c.sampleRate,n=sr*2;nb=c.createBuffer(1,n,sr);const d=nb.getChannelData(0);for(let i=0;i<n;i++)d[i]=R()*2-1;
    const m=Math.floor(sr*1.9),ir=c.createBuffer(2,m,sr);for(let ch=0;ch<2;ch++){const x=ir.getChannelData(ch);let lp=0;
      for(let i=0;i<m;i++){const k=i/m;lp+=((R()*2-1)-lp)*(.55-.4*k);x[i]=lp*Math.pow(1-k,3.2)*(i<sr*.012?i/(sr*.012):1);}
      for(const e of [.031,.047,.083,.131]){const j=Math.floor(sr*(e+ch*.004));x[j]+=.5*(1-e*4);}}
    rv=c.createConvolver();rv.buffer=ir;const rg=c.createGain();rg.gain.value=.55;rv.connect(rg);rg.connect(master);
    dcurve=new Float32Array(1024);for(let i=0;i<1024;i++){const v=i/512-1;dcurve[i]=Math.tanh(v*3.5);}}
  function ac(){if(!ctx){try{setup(new (window.AudioContext||window.webkitAudioContext)());}catch(e){return null;}}
    if(ctx.state==='suspended')ctx.resume();return ctx;}
  function out(n,wet){n.connect(master);if(wet){const g=ctx.createGain();g.gain.value=wet;n.connect(g);g.connect(rv);}}
  function env(g,t,dur,vol,att){g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol*gk,t+(att||.004));g.gain.exponentialRampToValueAtTime(.0001,t+dur);}
  function tone(f,t,dur,vol,type,f2,wet,att){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);env(g,t,dur,vol,att);o.connect(g);out(g,wet);o.start(t);o.stop(t+dur+.05);return o;}
  function noise(t,dur,vol,type,fr,q,f2,att,wet,drive){const b=ctx.createBufferSource();b.buffer=nb;b.loop=true;const f=ctx.createBiquadFilter();f.type=type||'lowpass';f.frequency.setValueAtTime(fr||1000,t);if(f2)f.frequency.exponentialRampToValueAtTime(f2,t+dur);f.Q.value=q||1;
    const g=ctx.createGain();env(g,t,dur,vol,att);b.connect(f);
    if(drive){const pre=ctx.createGain();pre.gain.value=drive;const w=ctx.createWaveShaper();w.curve=dcurve;f.connect(pre);pre.connect(w);w.connect(g);}else f.connect(g);
    out(g,wet);b.start(t,R()*1.5);b.stop(t+dur+.05);return g;}
  // удар по металлу: несколько негармонических призвуков, верхние гаснут быстрее
  function bell(f,t,dur,vol,wet,ratios){(ratios||[1,2.76,5.4,8.93]).forEach((r,i)=>{if(f*r<15000)tone(f*r*(1+(R()-.5)*.004),t,dur/(1+i*.7),vol/(1+i*.8),'sine',0,wet,.002);});}
  function lfo(param,fr,depth,t,dur){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=fr;g.gain.value=depth;o.connect(g);g.connect(param);o.start(t);o.stop(t+dur+.05);}
  // «голос»: пила через две форманты, слоги огибающей
  function voice(t,syl,vol,f0,wet,fm){const o=ctx.createOscillator(),g=ctx.createGain(),mix=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(f0,t);
    const F=[[700,1200],[400,2000],[500,900],[300,2300],[600,1000]];const b1=ctx.createBiquadFilter(),b2=ctx.createBiquadFilter();b1.type=b2.type='bandpass';b1.Q.value=6;b2.Q.value=8;
    g.gain.setValueAtTime(.0001,t);let x=t;syl.forEach((d,i)=>{const v=F[(fm||0)+i]||F[i%5];b1.frequency.setValueAtTime(v[0],x);b2.frequency.setValueAtTime(v[1],x);
      o.frequency.linearRampToValueAtTime(f0*(1+(i%2?.06:-.04)),x+d*.5);g.gain.linearRampToValueAtTime(vol*gk,x+d*.25);g.gain.linearRampToValueAtTime(vol*gk*.15,x+d*.9);x+=d;});
    g.gain.linearRampToValueAtTime(.0001,x+.05);o.connect(b1);o.connect(b2);b1.connect(mix);b2.connect(mix);mix.connect(g);out(g,wet);o.start(t);o.stop(x+.1);return x;}
  // один выстрел: щелчок, тело, низкий удар и раскат эха
  function shot(t,v,far){const k=far?.5:1;noise(t,.014,.9*v*k,'highpass',far?500:1100,.7,0,.001,.5);noise(t,.11,.75*v,'bandpass',far?700:1500,.8,far?260:480,.001,.6,3);
    tone(far?120:175,t,.1,.6*v,'sine',55,.3,.001);noise(t+.02,far?.7:.45,.2*v,'lowpass',far?1200:2600,.6,260,.01,.7);}
  const L={
    click:t=>{noise(t,.014,.16,'bandpass',3600,2.5,0,.001);tone(190,t,.035,.14,'sine',85);noise(t+.03,.01,.05,'bandpass',2200,3,0,.001);},    // клавиша тумблера, а не писк
    paper:t=>{noise(t,.28,.07,'highpass',5200,.6,1400,.05);for(let i=0;i<6;i++)noise(t+i*.04+R()*.03,.04+R()*.05,.04+R()*.08,'bandpass',2200+R()*3500,.9,0,.012);},
    thud:t=>{tone(115,t,.26,.5,'sine',42,.2,.002);noise(t,.14,.28,'lowpass',340,.8,0,.002,.2);noise(t,.03,.12,'bandpass',650,4,0,.001);},
    stamp:t=>{L.thud(t);noise(t+.012,.035,.2,'bandpass',2500,2,0,.001,.15);noise(t+.07,.05,.05,'bandpass',1300,3);},
    bolt:t=>{noise(t,.03,.32,'bandpass',2700,6,0,.001,.2);bell(1900,t,.07,.07,.2);noise(t+.03,.1,.06,'bandpass',1100,2,2500,.02);
      noise(t+.17,.04,.4,'bandpass',1800,5,0,.001,.25);bell(1280,t+.17,.11,.09,.25);tone(210,t+.17,.06,.2,'sine',90);},                       // затвор: назад, скольжение, вперёд
    phone:t=>{for(let k=0;k<2;k++)for(let i=0;i<24;i++){const x=t+k*1.55+i*.04+(R()-.5)*.004;bell(i%2?1570:1245,x,.11,.05,.18,[1,2.41,3.93]);noise(x,.006,.035,'bandpass',4200,2,0,.001);}
      tone(55,t,2.6,.012,'sine');},                                                                                                         // две чашки звонка и молоточек, 25 ударов в секунду
    pips:t=>{noise(t,1.9,.012,'bandpass',1600,.7,0,.2);for(let i=0;i<5;i++)tone(1000,t+i*.26,.1,.09,'sine',0,.1,.004);tone(1000,t+1.3,.5,.09,'sine',0,.15,.004);},
    static:t=>{noise(t,1.5,.11,'bandpass',2400,.5,1300,.05);noise(t,1.5,.05,'highpass',5000,.7,0,.1);
      const w=tone(2300,t+.05,1.1,.035,'sine',640,0,.1);lfo(w.frequency,6,45,t,1.3);tone(880,t+.5,.7,.02,'sine',1900,0,.1);
      for(let i=0;i<10;i++)noise(t+R()*1.4,.008+R()*.02,.12+R()*.15,'highpass',4000,.7,0,.001);
      voice(t+.25,[.12,.1,.16,.09,.14,.12],.05,128,0,1);},                                                                                  // эфир: шипение, свист несущей, треск и обрывок голоса
    teletype:t=>{for(let i=0;i<15;i++){const x=t+i*.068+R()*.012;noise(x,.016,.14,'bandpass',2900,3.5,0,.001,.1);tone(150,x,.03,.1,'sine',80);noise(x+.025,.012,.05,'bandpass',1700,4,0,.001);}
      noise(t,1.1,.02,'lowpass',240,.8,0,.05);bell(2150,t+1.08,.6,.05,.3);},                                                              // стук литер, гул мотора, звоночек конца строки
    crowd:t=>{const a=noise(t,3,.15,'bandpass',620,.5,560,.7,.3);lfo(a.gain,.9,.04,t,3);noise(t+.1,2.8,.09,'bandpass',1150,.7,1000,.8,.3);noise(t+.2,2.6,.04,'bandpass',2500,.9,2200,.9,.2);
      for(let b=0;b<4;b++)for(let v=0;v<4;v++)voice(t+.55+b*.5+R()*.04,[.19,.17],.018,140+R()*90,.35,v%3);
      const s=tone(2700,t+1.9,.3,.02,'sine',3200,.4,.03);lfo(s.frequency,18,60,t+1.9,.35);},                                                // гул площади, скандирование в четыре такта, свист
    boom:t=>{noise(t,.05,.9,'highpass',1300,.7,0,.001,.6);noise(t,1.3,.8,'lowpass',950,.7,55,.002,.6,4);tone(92,t,1.1,.75,'sine',27,.3,.002);
      noise(t+.34,1.5,.3,'lowpass',480,.7,50,.02,.7,2);for(let i=0;i<12;i++)noise(t+.45+R()*1.3,.02+R()*.03,.05+R()*.08,'bandpass',900+R()*2600,3,0,.001,.3);},   // выстрел орудия, раскат, осыпь
    burst:t=>{for(let i=0;i<6;i++)shot(t+i*.1+(R()-.5)*.006,.5*(.85+R()*.3));},                                                           // очередь, 600 выстр./мин
    shots:t=>{for(const d of [0,.34,.52,1.15])shot(t+d,.42*(.7+R()*.4),1);const r=tone(2900,t+.6,.3,.02,'sine',850,.5,.01);lfo(r.frequency,30,80,t+.6,.3);},   // одиночные вдали и рикошет
    engine:t=>{const D=2.8,o=ctx.createOscillator(),s=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='sawtooth';s.type='square';
      o.frequency.setValueAtTime(40,t);o.frequency.linearRampToValueAtTime(46,t+1.2);o.frequency.linearRampToValueAtTime(38,t+D);s.frequency.setValueAtTime(20,t);s.frequency.linearRampToValueAtTime(23,t+1.2);s.frequency.linearRampToValueAtTime(19,t+D);
      f.type='lowpass';f.frequency.value=230;f.Q.value=2;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.3*gk,t+.5);g.gain.linearRampToValueAtTime(.3*gk,t+D-.6);g.gain.linearRampToValueAtTime(.0001,t+D);
      o.connect(f);s.connect(f);f.connect(g);lfo(g.gain,13,.12,t,D);out(g,.15);o.start(t);s.start(t);o.stop(t+D+.05);s.stop(t+D+.05);
      noise(t,D,.22,'lowpass',210,.8,170,.5,.15,2);for(let i=0;i<28;i++)noise(t+.2+i*.088,.022,(i%2?.07:.04)*Math.min(1,i/5),'bandpass',1200+R()*500,3.5,0,.001,.15);
      const q=tone(1950,t+1,.5,.012,'sine',2350,.2,.1);lfo(q.frequency,9,50,t+1,.5);},                                                      // дизель с тактом, лязг траков, скрип катков
    alarm:t=>{for(const d of [1,1.013]){const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(260*d,t);o.frequency.exponentialRampToValueAtTime(610*d,t+.9);o.frequency.setValueAtTime(610*d,t+1.3);o.frequency.exponentialRampToValueAtTime(300*d,t+2.4);
      f.type='lowpass';f.frequency.value=1700;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.05*gk,t+.4);g.gain.linearRampToValueAtTime(.05*gk,t+1.8);g.gain.linearRampToValueAtTime(.0001,t+2.4);o.connect(f);f.connect(g);out(g,.35);o.start(t);o.stop(t+2.5);}},   // ручная сирена: вой вверх и вниз
    night:t=>{const B=[.5,1,1.19,1.5,2,2.51,3.01];bell(196,t,3.4,.13,.5,B);bell(196,t+1.7,3,.1,.5,B);const w=noise(t,3.4,.05,'bandpass',420,1.2,300,1.2,.2);lfo(w.gain,.6,.02,t,3.4);},   // башенный колокол и ветер
    fail:t=>{noise(t,.012,.12,'bandpass',2600,3,0,.001);for(let i=0;i<2;i++)tone(425,t+.05+i*.6,.33,.06,'sine',0,0,.01);},                 // короткие гудки «занято»
    win:t=>{const B=[.5,1,1.19,1.5,2,2.51];bell(262,t,2.6,.1,.5,B);bell(392,t+.5,2.4,.09,.5,B);bell(523,t+1,2.6,.09,.5,B);noise(t+.2,2.8,.13,'bandpass',900,.5,1700,1.2,.3);noise(t+.4,2.6,.06,'bandpass',2400,.8,3000,1.3,.3);},   // перезвон и ликование площади
    lose:t=>{tone(84,t,3,.4,'sine',30,.4,.01);noise(t,2.8,.35,'lowpass',520,.7,55,.01,.6,2);noise(t+1.2,1.6,.2,'lowpass',380,.7,50,.02,.7,2);bell(98,t+.3,3,.07,.5,[.5,1,1.19,1.5,2]);},
    fire:t=>{const r=noise(t,2.2,.1,'lowpass',430,.7,360,.4,.15);lfo(r.gain,5,.03,t,2.2);for(let i=0;i<26;i++){const x=t+R()*2;noise(x,.008+R()*.025,.05+R()*.16,'highpass',2200+R()*2500,.7,0,.001);if(i%4===0)tone(320,x,.025,.08,'sine',110);}},
  };
  addEventListener('pointerdown',e=>{if(e.isTrusted)armed=true;if(e.target.closest&&e.target.closest('.act,.aact,.law,.ch,.tabs div,#menu div,.pull,tr[data-o],.nextb,.row,.srow b,.close,.sndb,.fsb,.menub'))play('click');},true);
  addEventListener('keydown',e=>{if(e.isTrusted)armed=true;},true);
  function play(n,delay){if(!armed||!on())return;const c=ac();if(!c||!L[n])return;gk=GAIN[n]||1;try{L[n](c.currentTime+.01+(delay||0));}catch(e){}gk=1;}
  // проверка без колонок: отрисовать звук в память и вернуть пик/громкость/длину
  async function probe(n){const live=[ctx,master,rv,nb,dcurve];const o=new OfflineAudioContext(2,44100*5,44100);setup(o);let err='';gk=GAIN[n]||1;try{L[n](.01);}catch(e){err=String(e);}gk=1;
    const b=await o.startRendering();[ctx,master,rv,nb,dcurve]=live;const d=b.getChannelData(0);let pk=0,sq=0,last=0;for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>pk)pk=a;sq+=a*a;if(a>.003)last=i;}
    return {n,err,peak:+pk.toFixed(3),rms:+Math.sqrt(sq/Math.max(1,last)).toFixed(3),len:+(last/44100).toFixed(2)};}
  return {play,probe,names:()=>Object.keys(L)};})();
const actSound=t=>/Звон|Запрос|телеграм/i.test(t)?'phone':/Митинг|Собрать|Пикет|Агитац|Перекрыть|обоз/i.test(t)?'crowd':/оруж|штурм|колонн/i.test(t)?'bolt':/баррикад|Запасти/i.test(t)?'thud':/суд|Иск|комисс|переговор/i.test(t)?'stamp':'paper';

// ---------- menu music: plays on the title screen and during the assault, only if music/music.js is present (it is not part of the shared build) ----------
const Music=(function(){let ctx,src,buf,want=false,loading=false;
  const has=()=>typeof MUSIC_B64!=='undefined', on=()=>!(store.get(OPTS)||{}).mute;
  const b2a=b=>{const t=atob(b),u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);return u.buffer;};
  function load(){if(buf||loading)return;loading=true;try{ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
    const list=[MUSIC_B64.ogg,MUSIC_B64.mp3].filter(Boolean);(function next(i){if(i>=list.length)return;try{ctx.decodeAudioData(b2a(list[i]),b=>{buf=b;sync();},()=>next(i+1));}catch(e){next(i+1);}})(0);}
  function sync(){const play=want&&on()&&has();
    if(play){load();if(!buf||!ctx)return;if(ctx.state==='suspended')ctx.resume();
      if(!src){src=ctx.createBufferSource();src.buffer=buf;src.loop=true;const g=ctx.createGain();g.gain.value=.5;src.connect(g);g.connect(ctx.destination);src.start();}}
    else if(src){try{src.stop();}catch(e){}src=null;}
    document.querySelectorAll('.sndb').forEach(b=>{b.textContent='♪ З~ВУК: '+(on()?'В~КЛ':'В~ЫКЛ');b.classList.toggle('off',!on());});}
  return {has,on,sync,set(w){want=w;sync();},toggle(){const o=store.get(OPTS)||{};o.mute=!o.mute;store.set(OPTS,o);sync();}};})();
addEventListener('pointerdown',()=>Music.sync());addEventListener('keydown',()=>Music.sync());

// ---------- intro: a slide show before a new game ----------
const INTRO=[
  {pic:['wh'],      st:'М~ОСКВА · 1993', t:'С~оветского С~оюза н~ет в~торой г~од. Ц~ены о~тпущены, в~клады с~горели, з~аводы с~тоят б~ез з~арплаты. С~трана ж~ивёт п~о К~онституции Р~СФСР 1978 г~ода, в к~оторую у~спели в~нести с~отни п~оправок.'},
  {pic:['yeltsin'], st:'П~РЕЗИДЕНТ',      t:'Б~орис Е~льцин и~збран в и~юне 1991-г~о. О~н в~едёт р~ыночные р~еформы и с~читает, ч~то п~арламент н~е д~аёт д~овести и~х д~о к~онца. Е~му н~ужна н~овая К~онституция с с~ильным п~резидентом.'},
  {pic:['hasb'],    st:'П~АРЛАМЕНТ',      t:'С~ъезд н~ародных д~епутатов и В~ерховный С~овет и~збраны в 1990-м. П~о д~ействующей К~онституции в~ысшая в~ласть в с~тране у н~их. П~редседатель В~ерховного С~овета — Р~услан Х~асбулатов, в~черашний с~оюзник Е~льцина.'},
  {pic:['yeltsin','hasb'], st:'Д~ВОЕВЛАСТИЕ', t:'В д~екабре 1992-г~о С~ъезд н~е у~твердил Г~айдара п~ремьером. В м~арте 1993-г~о п~опытался о~трешить п~резидента: н~е х~ватило 72 г~олосов. К~аждый з~акон, к~аждый у~каз т~еперь о~тменяет д~ругая с~торона.'},
  {pic:['wh'],      st:'25 А~ПРЕЛЯ · «Д~А, Д~А, Н~ЕТ, Д~А»', t:'Н~а р~еферендуме б~ольшинство п~оддержало п~резидента и е~го р~еформы. Н~о д~осрочных в~ыборов н~е б~удет н~и д~ля к~ого. О~бе с~тороны о~бъявили, ч~то п~обедили.'},
  {pic:['rutskoy'], st:'В~ИЦЕ-П~РЕЗИДЕНТ', t:'А~лександр Р~уцкой, г~енерал и Г~ерой С~оветского С~оюза, п~ерешёл н~а с~торону п~арламента и о~бещал ч~емоданы к~омпромата н~а м~инистров. 1 с~ентября Е~льцин у~казом о~тстранил е~го о~т д~олжности. В~ерховный С~овет с~читает у~каз н~езаконным.'},
  {pic:['wh'],      st:'14 С~ЕНТЯБРЯ',    t:'В~ы — В~ерховный С~овет. У в~ас е~сть з~дание н~а К~раснопресненской н~абережной, 265 д~епутатов, з~акон и т~е, к~то п~ридёт к е~го с~тенам. П~резидент о~бещал а~рмии «р~ешающий с~ентябрь». Ч~то б~удет д~альше, н~е з~нает н~икто.'},
];
let introI=0,introN=0,introT=null,introGo=null;
function introStart(go){introGo=go;introI=0;show('intro');introSlide();}
function introSlide(){const sl=INTRO[introI],c=$('in-c'),g=c.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#07070a';g.fillRect(0,0,640,360);
  c.style.animation='none';void c.offsetWidth;c.style.animation='';
  if(sl.pic[0]==='wh')TitleArt.onReady(()=>g.drawImage(TitleArt.calm,0,0));
  else sl.pic.forEach((id,i)=>{const im=new Image(),x=sl.pic.length===1?160:i*320;im.onload=()=>{g.imageSmoothingEnabled=false;g.drawImage(im,x,0,320,360);};im.src=id==='yeltsin'?ASSET_YELTSIN:PEOPLE[id].img||'';});
  Sfx.play('paper');$('in-stamp').textContent=sl.st;$('in-n').textContent=(introI+1)+' / '+INTRO.length;introN=0;clearInterval(introT);
  introT=setInterval(()=>{introN+=2;$('in-txt').textContent=sl.t.slice(0,introN);if(introN>=sl.t.length)clearInterval(introT);},22);}
function introNext(skip){if(screen!=='intro')return;const sl=INTRO[introI];
  if(!skip&&introN<sl.t.length){introN=sl.t.length;clearInterval(introT);$('in-txt').textContent=sl.t;return;}
  clearInterval(introT);introI++;if(skip||introI>=INTRO.length){const f=introGo;introGo=null;f&&f();}else introSlide();}

// ---------- screens ----------
function show(id){screen=id; setTimeout(()=>{if(typeof cheatSync==='function')cheatSync();},0);document.querySelectorAll('.screen').forEach(e=>e.classList.toggle('on',e.id==='s-'+id)); Music.set(id==='title'||id==='assault');
  if(id==='title')TitleArt.start();else TitleArt.stop();}
function showMain(){ if(S.view==='wh'){show('wh');renderWH();}else{show('map');renderMap();} }
function setView(v){S.view=v;hideToast();showMain();}

// ================= TITLE =================
let menuSel=0;
function menuItems(){return [...document.querySelectorAll('#menu div')];}
function renderMenu(){const has=!!store.get(SAVE);
  menuItems().forEach((d,i)=>{d.classList.toggle('sel',i===menuSel);d.classList.toggle('off',d.dataset.m==='cont'&&!has);});
  if(typeof cheatSync==='function')cheatSync();}
// анонимная статистика: window.Stat есть только в публичной копии. Партии с читами концовки и достижения не шлют
function stat(n,once){try{ if(!window.Stat)return; if(S&&S.cheat&&/^(end-|ach-|decree$|assault$)/.test(n))return; once?Stat.once(n):Stat.ev(n);}catch(e){}}
function newGame(){S=newState();S.am=snap();stat('start',1);stat('new');startDay();}
function menuGo(m){
  if(m==='new')introStart(newGame);
  else if(m==='cont'){const s=store.get(SAVE);if(!s)return;S=s;afterLoad();}
  else if(m==='chron')openChron();
  else if(m==='ach')openAch();
  else if(m==='stats')openStats();

}
function applyOpts(){}
menuItems().forEach((d,i)=>{d.onmouseenter=()=>{menuSel=i;renderMenu();};d.onclick=()=>menuGo(d.dataset.m);});

// ================= HUD (shared by the map and the White House screens) =================
const own=v=>v>=65?'vs':v<=35?'kr':'neu';
const OWN_NM={vs:'з~а В~ерховный С~овет',kr:'з~а К~ремль',neu:'м~ежду д~вумя в~ластями'};
const OWN_COL={vs:'#e0866a',kr:'#7fa0cf',neu:'#c9a25a'};
const snap=()=>({leg:S.leg,dep:deputies(S),ppl:S.ppl,mil:S.mil,gun:S.gun,med:S.med,sup:S.sup});
const pressVoice=()=>whYield(S).med;
const mediaIncome=()=>voiceOf(S,'vs')+pressVoice();
const mediaGain=()=>Math.ceil(mediaIncome()/2);
// battle for Moscow: the outlets on your side against the outlets on the Kremlin's, every night
const kremlinVoice=()=>Math.max(0,voiceOf(S,'kr')-(S.flags.komp>0?3:0));
const moscOut=()=>OUTLETS.filter(o=>(o.id==='mk'||o.id==='echo')&&outSt(S,o)==='vs').length;
const cityShift=()=>clamp(Math.round((mediaIncome()-kremlinVoice())/5)+moscOut(),-1,4);
// how fast the assault approaches: the structures you won over slow the Kremlin down
const prRate=()=>Math.max(2,PRATE-(S.pts.gs>=65?2:0)-(S.pts.mo>=65?1:0)+(S.pts.mvd<=10?1:0)-(S.city>=65?1:0)+(S.city<=25?1:0)+(S.rad>=60?1:0)+(S.rad>=80?1:0)-(S.ppl>=2500?1:0));
// Легитимность за ночь: всё, что известно заранее, в одном месте (HUD показывает прогноз, ночь применяет)
function legDrift(S){const P=[],add=(v,t)=>{if(v)P.push([v,t]);};
  add(whYield(S).leg,'р~абота С~ъезда'); add(-(S.phase===2?4:1),S.phase===2?'д~воевластие з~атянулось':'у~сталость о~т п~ротивостояния');
  if(kremlinVoice()-mediaIncome()>=6)add(S.phase===2?-2:-1,'п~ресса К~ремля г~ромче в~ашей');
  const lm=Math.round((S.city-50)/20); add(lm,lm>0?'М~осква з~а в~ас':'М~осква п~ротив');
  if(S.cordon)add(ringPress(S).leg,'з~дание в к~ольце');
  if(S.phase===2&&deputies(S)<QUORUM)add(-3,'н~ет к~ворума');
  if(S.phase===2&&S.med<5)add(-1,'н~ечем о~тветить в э~фире');
  return {v:P.reduce((a,p)=>a+p[0],0),P};}
const pressLeg=S=>OUTLETS.reduce((a,o)=>{const st=outSt(S,o),e=st==='vs'?o.pas:st==='kr'?o.kpas:null;return a+((e&&e.fx.leg)||0);},0);
// давление кольца за ночь; S.hold — что игрок оплачивает, чтобы терпеть
function ringPress(S){const h=S.hold||{}, hv=(S.ring==null?100:S.ring)>=50; return {leg:h.cour?(hv?-2:-1):(hv?-4:-2), hope:h.ration?0:(hv?-3:-2), sup:(h.port||S.flags.gap>0)?0:(hv?.6:.4), med:h.cour?0:(hv?-2:-1), dep:h.cour?0:(hv?4:2)};}
function syncRing(){ if(S.cordon){ if(S.ring==null)S.ring=100; if(S.ring<=0){S.cordon=0;S.ring=null;S.flags.ringOff=1;S.flags.gap=0;S.hold={};apply({hope:5,leg:3});log('К~ольцо с~нято: к Б~елому д~ому с~нова и~дут л~юди и м~ашины.');} } else S.ring=null; }
function halve(fx){const o={};for(const k in fx){const v=fx[k]; o[k]=typeof v==='object'?halve(v):(v<0?Math.ceil(v/2):Math.floor(v/2));}return o;}
// лояльность фракций двигается каждую ночь: её тянут издания, которые фракция читает, и общее положение дел
function facDrift(){const out=[]; for(const F of FACTIONS){const f=S.fac[F.id]; f.tr=null; if(F.kind!=='dep'||f.n<=0)continue; let v=0; const up=[],dn=[];
    for(const id of FAC_PRESS[F.id]||[]){const o=OUTLETS.find(x=>x.id===id),st=outSt(S,o); if(st==='vs'){v+=.34;up.push(o.nm+' з~а в~ас');} else if(st==='kr'){v-=.34;dn.push(o.nm+' у К~ремля');}}
    const mod=['agr','sm','kol'].includes(F.id);
    if(S.hope>=70){v+=.2;up.push('в з~дании в~ерят в у~спех');} else if(S.hope<45){v-=.3;dn.push('Р~ешимость п~адает');}
    if(S.cordon&&mod){v-=.25;dn.push('з~дание в к~ольце');}
    if(S.fac.rne.n>0&&mod){v-=.2;dn.push('Р~НЕ в з~дании');}
    if(S.rad>=60){ if(mod){v-=.3;dn.push('р~адикалы у м~икрофона');} else{v+=.2;up.push('п~ошёл с~ерьёзный р~азговор');} }
    f.dr=clamp((f.dr||0)+v,-1.6,1.6);
    if(f.dr>=1&&f.loy<10){f.dr-=1;f.loy++;f.tr={d:1,why:up[0]||'д~ела и~дут'};} else if(f.dr<=-1&&f.loy>0){f.dr+=1;f.loy--;f.tr={d:-1,why:dn[0]||'у~сталость'};}
    if(f.tr)out.push(F.sh+(f.tr.d>0?' ↑':' ↓')+' ('+f.tr.why+')');} return out;}
function renderHud(p){
  $(p+'-day').textContent='Д~ЕНЬ '+S.day;
  $(p+'-date').textContent=dateStr(S.day).toUpperCase();
  $(p+'-wd').textContent=WD[dateOf(S.day).getDay()]+' · '+PHASE_NM[S.phase];
  const cur=snap();
  const R=[['leg','Л~егитимность'],['dep','Д~епутаты'],['ppl','Л~юди'],['mil','О~полчение'],['gun','О~ружие'],['med','Э~фир'],['sup','С~набжение']];
  if(S.phase===1)R.splice(3,1);
  $(p+'-res').innerHTML=R.map(([k,nm])=>{const d=Math.round(cur[k]-(S.am?S.am[k]:cur[k]));
    let dl=d>0?`<span class="dlt up">+${fmt(d)}</span>`:d<0?`<span class="dlt dn">−${fmt(-d)}</span>`:'';
    if(k==='med')dl=`<span class="dlt up">+${mediaGain()}/х~од</span>`;
    if(k==='gun'&&S.mil>0)dl=`<span class="dlt">с~вободно ${fmt(freeGuns(S))}</span>`;
    if(k==='dep'){const r=S.depRate||0;dl=`<span class="dlt">${S.away?'−'+S.away+' в п~ути · ':''}${S.phase===2&&r>0?'к~ворум ≈ '+Math.max(0,Math.ceil((cur.dep-QUORUM)/r))+' д~н.':'и~з 265'}</span>`;}
    if(k==='leg'){const f=legDrift(S).v+pressLeg(S);dl=`<span class="dlt ${f<0?'dn':'up'}">н~очью ${f?sg(f):'0'}</span>`;}
    const warn=(k==='sup'&&S.sup<=2)||(k==='leg'&&S.leg<=20)||(k==='med'&&S.med<10&&S.phase>1)?' warn':'';
    const v=k==='sup'?Math.floor(S.sup)+' д~н.':fmt(cur[k]);
    return `<div class="r${k==='med'?' click':''}" data-k="${k}"><div class="k"><canvas class="ico" data-i="${k}"></canvas>${nm}</div><div class="v${warn}">${v}${dl}</div></div>`;}).join('');
  drawIcons();
  $(p+'-res').querySelector('[data-k=med]').onclick=openEther;
  $(p+'-res').querySelectorAll('.r:not([data-k=med])').forEach(e=>{e.style.cursor='pointer';e.onclick=openHelp;});
}

// ---------- portraits: stylised photo if we have one, otherwise a silhouette placeholder ----------
const faceCache={};
function drawFace(cv,pid){const P=PEOPLE[pid], c=cv.getContext('2d'), W=cv.width, H=cv.height; c.imageSmoothingEnabled=false;
  c.fillStyle='#17181c';c.fillRect(0,0,W,H);
  if(P&&P.img){const put=im=>{const k=P.crop||[0,0,im.width,im.height];c.drawImage(im,k[0],k[1],k[2],k[3],0,0,W,H);};
    if(faceCache[pid]&&faceCache[pid].complete)put(faceCache[pid]); else{const im=faceCache[pid]=new Image();im.onload=()=>put(im);im.src=P.img;} return;}
  // placeholder: head and shoulders
  const r=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x*W),Math.round(y*H),Math.round(w*W),Math.round(h*H));};
  r(.34,.16,.32,.36,'#3a372f');r(.38,.12,.24,.06,'#3a372f');r(.42,.5,.16,.1,'#33302a');r(.12,.6,.76,.4,'#2e2c27');r(.2,.56,.6,.06,'#2e2c27');
  r(.44,.6,.12,.14,'#4a463d');
}
const faceHTML=(pid,cls)=>`<canvas class="face ${cls||''}" data-p="${pid}" width="28" height="32"></canvas>`;
function drawFaces(root){root.querySelectorAll('canvas.face').forEach(c=>drawFace(c,c.dataset.p));}

// ================= MAP =================
const MAP_LP={wh:'l',mer:'t',mo:'t',gs:'l',smo:'b',mvd:'t',ost:'b',kre:'r'};
function renderMap(){
  renderHud('h');
  // timeline: 14 days; risk = the decree (phase 1) or the rumoured assault date (phase 2)
  const eta=Math.max(1,Math.ceil((100-S.pr)/prRate())), aday=S.phase===1?999:S.day+eta, start=Math.max(1,S.day-9);
  let tl='<div class="lbl px">Х~РОНОЛОГИЯ</div>';
  for(let d=start;d<start+14;d++){const n=dateOf(d).getDate();const cls=d<S.day?'past':d===S.day?'now':(d>=aday&&d<=aday+(S.phase===1?0:1))?'risk':'';
    tl+=`<div class="c ${cls}">${n}${cls==='risk'?' ?':''}</div>`;}
  $('tl').innerHTML=tl;
  // meters
  seg('hope',S.hope); seg('rad',S.rad); seg('city',S.city); $('m-city').textContent=S.city+'%';
  $('m-hope').textContent=S.hope+'%';
  $('m-rad').textContent=S.rad+'%'+(S.rad>=50?' ▲':''); $('m-rad').className=S.rad>=50?'warn':'';
  $('m-a1').textContent=S.phase===1?'П~ОДОЗРЕНИЯ К~РЕМЛЯ':'Д~О Ш~ТУРМА';
  $('m-a2').textContent=S.phase===1?'з~а Б~елым д~омом с~ледят':'п~о с~лухам и~з М~ВД';
  $('m-assault').textContent=S.phase===1?(S.pr>=15?'с~ильные':S.pr>=6?'р~астут':'с~лабые'):'≈'+eta+' д~н.';
  $('m-hl').textContent=S.phase===1?'Р~ешимость В~ерховного С~овета':'Р~ешимость з~ащитников';
  // points
  const map=$('map'); map.querySelectorAll('.pt,.tag').forEach(e=>e.remove());
  for(const p of POINTS){const v=S.pts[p.id];const d=document.createElement('div');
    d.className='pt lp-'+(MAP_LP[p.id]||p.lp||'b')+(p.big?' big':'')+(S.sel===p.id?' sel':'');
    d.style.left=(2+p.x*4)+'px';d.style.top=(p.y*4)+'px';d.style.setProperty('--c',`var(--${own(v)})`);
    const who=PEOPLE[POINT_WHO[p.id]];
    d.innerHTML=`<div class="mk">${p.ic}</div><div class="lb"><div class="pc">${who&&who.img?faceHTML(POINT_WHO[p.id]):''}<div class="pi"><div class="nm">${p.nm.replace(/ ↑.*/,'')}</div>${who?`<div class="wn">${who.nm.split(' ').slice(-1)[0]}</div>`:''}<div class="bar"><i style="width:${v}%"></i></div></div></div></div>`;
    d.querySelector('.mk').onclick=d.querySelector('.pc').onclick=()=>{S.sel=p.id;renderMap();firstLook('p',p.id);};
    map.appendChild(d);}
  syncRing(); const tags=[]; if(S.cordon)tags.push({x:12,y:2,t:'К~ольцо '+S.ring+(S.flags.gap>0?', е~сть л~аз':'')+' ▸ к~ак с~нять',c:'btn',on:openSiege});
  if(S.flags.noComms)tags.push({x:12,y:7,t:'С~вязи н~ет: з~вонки и р~едакции з~акрыты ▸',c:'btn red',on:openSiege});
  if(S.strike){const T=STRIKES.find(x=>x.id===S.strike.id);tags.push({x:12,y:S.flags.noComms&&S.cordon?12:(S.flags.noComms||S.cordon)?7:2,t:'У~дар Е~льцина н~очью: '+T.nm+(T.cover(S)?' · п~рикрыто':' · н~е п~рикрыто')+' ▸',c:'btn'+(T.cover(S)?'':' red'),on:openStrike});}
  if(S.phase>1&&S.rad>=40)tags.push({x:84.5,y:95.5,t:'С~толкновения',c:'red'});
  for(const tg of tags){const d=document.createElement('div');d.className='tag '+tg.c;d.textContent=tg.t;d.style.left=(tg.x*4-40)+'px';d.style.top=(tg.y*4+4)+'px';if(tg.on)d.onclick=tg.on;map.appendChild(d);}
  drawMapDynamic({cordon:S.cordon,crowds:[[84,76,Math.round(6+S.rad*.6),'#c0473a'],[78,50,Math.round(Math.min(60,(S.ppl+S.mil)/80)),'#c0473a'],[88,79,S.phase===1?0:S.cordon?24:12,'#7fa0cf']]});
  renderTarget(); drawFaces($('s-map'));
  // log
  $('log').innerHTML=S.log.slice(0,3).map((l,i)=>`<div class="${i===0&&l.day===S.day?'new ':''}${l.cls}"><span class="tm">${l.day===S.day?l.tm:'в~чера'}</span>${l.text}</div>`).join('')||'<div>У~тро. Ж~дём п~риказов.</div>';
  // buttons
  $('laws-n').textContent='д~оступно: '+lawsAvail(); $('b-laws').classList.toggle('none',!lawsAvail());
  $('orders').textContent='ENTER · п~риказов: '+S.orders;
}
const lawsAvail=()=>Math.min(S.lawCharges,LAWS.filter(l=>inPh(l)&&!S.laws[l.id]).length);
function seg(id,v){const e=$(id);e.innerHTML='';const on=Math.round(v/5);for(let i=0;i<20;i++){const s=document.createElement('i');if(i<on)s.className='on';e.appendChild(s);}}

// actions available on a point in the current phase: [{a, i}] (i = index in ACTIONS[pid], used as a stable key)
const inPh=o=>!o.ph||o.ph.includes(S.phase);
const actsOf=pid=>ACTIONS[pid].map((a,i)=>({a,i})).filter(o=>inPh(o.a)).slice(0,3);
// influence inflation: pressing the same button again and again gives less, then backfires
const INFL=[1,.7,.4,.15,-.3];
const inflOf=(pid,i)=>INFL[Math.min(INFL.length-1,(S.uses&&S.uses[pid+i])||0)];
// legitimacy = chance that an order sent outside the building is actually carried out
const execChance=pid=>pid==='wh'?1:clamp(.2+S.leg*.008-(S.flags.noComms?.15:0),.1,1);
function actFx(pid,i){const a=ACTIONS[pid][i], fx=fxOf(a), k=inflOf(pid,i);
  if(fx.pts)for(const q in fx.pts){const d=fx.pts[q];if(d>0&&d<100){const v=d*(100-S.pts[q])/(q==='mo'||q==='gs'?90:60)*k;fx.pts[q]=k<0?Math.min(-1,Math.round(d*k)):Math.max(1,Math.round(v));}}
  if(!a.dyn&&k<1)for(const q of ['hope','ppl','leg','city','med'])if(fx[q]>0)fx[q]=Math.max(q==='ppl'?10:1,Math.round(fx[q]*Math.max(.15,k)));
  return fx;}
const lawFx=l=>{const fx=fxOf(l), m=.5+S.leg/100; for(const q of ['leg','hope','ppl','med','gun','city'])if(fx[q]>0)fx[q]=Math.max(1,Math.round(fx[q]*m)); return fx;};
function actState(pid,i){const a=ACTIONS[pid][i];
  if(a.once&&S.once[pid+i])return 'у~же с~делано';
  if(S.used[pid+i])return 'у~же с~егодня';
  if(a.phone&&S.flags.noComms)return 'т~елефоны о~тключены';
  if(S.cordon&&pid!=='wh'&&!a.phone&&!/оцеплением/.test(a.t)&&!(S.flags.gap>0||S.flags.tunnel))return 'к~ольцо: з~а п~роволоку н~е в~ыйти';
  if(a.req){const r=a.req(S);if(r!==true)return r;}
  if(a.dep&&deputies(S)-S.away<a.dep)return 'н~е х~ватает с~вободных д~епутатов';
  if(!S.orders)return 'н~ет п~риказов д~о у~тра';
  return true;}
function renderTarget(){
  const p=POINTS.find(q=>q.id===S.sel), v=S.pts[p.id], o=own(v);
  const acts=actsOf(p.id).map(({a,i},n)=>{const st=actState(p.id,i);
    const f0=actFx(p.id,i), kf=inflOf(p.id,i);
    let cost=a.chance?fxText(a.cost||{},p.id):fxText(f0,p.id);
    if(a.chance&&!cost)cost=fxText(a.ok,p.id);
    if(a.dep)cost=`Д~епутаты: ${a.dep}`+(cost?' · '+cost:'');
    if(!a.chance&&kf<1)cost+=(cost?' · ':'')+`<span class="risk">${kf<0?'в~ас у~же н~е с~лушают':'п~риелось: э~ффект '+Math.round(kf*100)+'%'}</span>`;
    if(a.risk)cost+=(cost?' · ':'')+`<span class="risk">${a.risk}</span>`;
    if(st!==true)cost=`<span class="risk">${st}</span>`;
    return `<div class="act${st!==true?(S.used[p.id+i]||S.once[p.id+i]?' done':' off'):''}" data-i="${i}"><span class="k">${n+1}</span><span class="t">${a.t}</span><span class="cost">${cost}</span></div>`;}).join('');
  const W=PEOPLE[POINT_WHO[p.id]];
  $('target').innerHTML=`<div class="who">${faceHTML(POINT_WHO[p.id],'big')}<div><h3>${p.full}</h3>
    <div class="own"><b>${W.nm}</b>, ${W.role}</div>
    <div class="own">${S.phase===1?'Н~астроения':'К~онтроль'}: <span style="color:${OWN_COL[o]}">${OWN_NM[o]}</span></div></div></div>
    <div class="split"><div class="a" style="width:${v}%"></div><div class="b" style="width:${100-v}%"></div></div>
    <div class="split-l"><span>В~С ${v}%</span><span>К~ремль ${100-v}%</span></div>
    <div class="facts">${(T=>T?`<span class="${tugSide(v)==='vs'?'p':'n'}">С~ейчас к~аждую н~очь: ${T.t}${fxText(T.fx)?' ('+fxText(T.fx).replace(/<[^>]+>/g,'')+')':''}${T.ph&&S.phase<T.ph?' — с н~ачала к~ризиса':''}</span><br>`:POINT_TUG[p.id]?'О~т 65% р~аботает н~а в~ас к~аждую н~очь, д~о 35% — н~а К~ремль.<br>':'')(POINT_TUG[p.id]&&tugSide(v)&&POINT_TUG[p.id][tugSide(v)])}${(p.id==='mo'||p.id==='gs')&&S.phase===2?`В ш~турме ${p.id==='mo'?'т~анки':'м~отострелки'}: <span style="color:var(--paper)">${v>=65?'н~е в~ыйдут':v>=45?'п~ойдут в~полсилы':'в~ыполнят п~риказ'}</span> (о~т 45 к~олеблются, о~т 65 о~тказ). `:''}${p.id==='mvd'&&S.phase===2?`<span style="color:var(--paper)">О~МОН: г~отовность ${S.omon==null?100:S.omon}%</span> (д~о 60 к~олеблется, д~о 30 н~е п~ойдёт). `:''}${p.id==='wh'?'З~десь з~аседает С~ъезд. Ф~ракции и р~абота С~овета — н~а э~кране «Б~елый д~ом».':''}${p.id!=='wh'?`<span style="color:var(--paper)">П~риказ и~сполнят: ${Math.round(execChance(p.id)*100)}%</span>${S.flags.noComms?' (с~вязи н~ет: −15%)':''}`:''}</div>
    <div class="acts">${acts}</div>`;
  $('target').querySelectorAll('.act').forEach(e=>e.onclick=()=>doAction(p.id,+e.dataset.i));
}
function doAction(pid,i){
  if(i===undefined||actState(pid,i)!==true)return;
  const a=ACTIONS[pid][i]; let fx, txt; S.uses=S.uses||{};
  if(Math.random()>execChance(pid)){S.orders--; S.used[pid+i]=1; log(POINTS.find(q=>q.id===pid).nm.replace(/ ↑.*/,'')+': п~риказ В~ерховного С~овета н~е и~сполнили. Л~егитимности н~е х~ватает.','bad'); Sfx.play('fail'); S.st=S.st||{}; S.st.fail=(S.st.fail||0)+1; save(); renderMap(); return;}
  Sfx.play(actSound(a.t));
  if(a.chance){const ok=Math.random()<a.chance(S); fx=ok?a.ok:a.fail; txt=ok?a.okLog:a.failLog; log(txt,ok?'':'bad');}
  else{fx=actFx(pid,i); S.uses[pid+i]=(S.uses[pid+i]||0)+1; txt=POINTS.find(q=>q.id===pid).nm.replace(/ ↑.*/,'')+': '+a.t.toLowerCase()+'.'; log(txt);}
  apply(fx); S.orders--; S.used[pid+i]=1; S.did[pid]=1; if(a.once)S.once[pid+i]=1; if(a.dep)S.away+=a.dep;
  if(checkLose())return;
  save(); renderMap();
}

// ---------- decrees ----------
function openLaws(){
  const n=S.lawCharges;
  $('modal-win').innerHTML=`<h2>П~ОСТАНОВЛЕНИЯ В~ЕРХОВНОГО С~ОВЕТА</h2>${resStrip('law')}<div class="sub">${n?'М~ожно п~ринять: '+n+'. Н~овое — р~аз в д~ва д~ня. Ч~ем в~ыше Л~егитимность, т~ем с~ильнее д~ействует п~остановление (с~ейчас ×'+(.5+S.leg/100).toFixed(1)+').':'С~егодня п~ринять н~ельзя. Н~овое п~остановление — р~аз в д~ва д~ня.'}</div>`+
    LAWS.filter(inPh).map(l=>`<div class="law${S.laws[l.id]?' done':!n?' lock':''}" data-id="${l.id}"><div class="t">${l.t}</div><div class="d">${l.d}</div><div class="e">${S.laws[l.id]?'п~ринято':(!n?'<span class="n">н~ет с~вободного п~остановления: н~овое р~аз в д~ва д~ня</span> · ':'')+fxText(lawFx(l))}</div></div>`).join('')+
    `<div class="close">ESC — з~акрыть</div>`;
  $('modal').classList.add('on');
  $('modal-win').querySelectorAll('.law').forEach(e=>e.onclick=()=>{const l=LAWS.find(x=>x.id===e.dataset.id);
    if(S.laws[l.id]||!S.lawCharges)return; Sfx.play('stamp'); S.laws[l.id]=1;S.lawCharges--;S.did.law=1; if(l.flag)S.flags[l.flag]=1; apply(lawFx(l));
    log('П~ринято п~остановление «'+l.t+'».'); closeModal(); if(checkLose())return; save(); showMain();});
  $('modal-win').querySelector('.close').onclick=closeModal;
}
// ---------- media: channels bring Эфир every night, appeals spend it ----------
let etherSel=null;
function outWayState(o,k){const W=OUT_WAYS[k]; if(S.appeals.pull)return 'с~егодня у~же р~аботали с р~едакцией'; return W.req(S,o);}
function outWin(o,k){const W=OUT_WAYS[k]; if(outWayState(o,k)!==true||outLocked(S,o))return; const st=outSt(S,o);
  apply(W.cost(o)); if(W.order)S.orders--; if(W.run)W.run(S); S.appeals.pull=1; S.did.media=1; Sfx.play(k==='p'?'crowd':k==='z'?'stamp':'paper');
  if(W.chance&&Math.random()>W.chance){apply({city:-3}); log('Э~фир: '+o.nm+' — н~ажим н~е у~дался, р~едакция п~ишет о «п~огромщиках».');}
  else{S.out[o.id]=st==='kr'?'neu':'vs'; log('Э~фир: '+o.nm+(st==='kr'?' б~ольше н~е п~оёт с г~олоса К~ремля.':' т~еперь д~аёт с~лово В~ерховному С~овету.'));}
  save(); showMain(); openEther();}
function outActState(o,a,key){if(S.flags.noComms&&o.id!=='radio'&&o.id!=='for')return 'н~ет с~вязи'; if(S.appeals[key])return 'с~егодня у~же б~ыло'; if(S.med<a.cost)return 'н~ужно '+a.cost+' Э~фира'; return true;}
function outAct(o,a,key){if(outActState(o,a,key)!==true)return; Sfx.play(/echo|radio|ost|pch|600|for/.test(o.id)?'pips':'teletype'); S.med-=a.cost; S.appeals[key]=1; S.did.media=1; apply(fxOf(a)); if(a.run)a.run(S); log(o.nm+': '+a.t.toLowerCase()+'.'); save(); showMain(); openEther();}
const UNIT_SH={tanks:'т~анки',taman:'м~отострелки',vv:'В~В',omon:'О~МОН',alpha:'«А~льфа»'};
function finTxt(fx){if(!fx)return '';const o=[],pc=k=>(k<1?'−':'+')+Math.round(Math.abs(1-k)*100)+'%';
  if(fx.air)o.push('Э~фир '+sg(fx.air)); if(fx.hope)o.push('Р~ешимость '+sg(fx.hope)); if(fx.inc)o.push('+'+fx.inc+' л~юдей'); if(fx.ppl)o.push('Л~юди '+sg(fx.ppl));
  if(fx.mil)o.push('б~ойцы '+sg(fx.mil)); if(fx.ctl)o.push('в~ходы '+sg(fx.ctl)); if(fx.all)o.push('н~атиск '+pc(fx.all));
  if(fx.u)for(const k in fx.u)if(fx.u[k]!==1)o.push(UNIT_SH[k]+' '+pc(fx.u[k])); return o.join(', ');}
function openEther(){
  const inc=mediaIncome(), kv=kremlinVoice(), dc=cityShift();
  let o=OUTLETS.find(x=>x.id===etherSel); if(!o){o=OUTLETS.find(x=>outSt(S,x)==='vs'&&x.act)||OUTLETS[0]; etherSel=o.id;}
  const SN={vs:'з~а С~овет',neu:'н~ейтральны',kr:'з~а К~ремль',off:'з~акрыто'}, ord={vs:0,neu:1,kr:2,off:3};
  const rows=OUTLETS.slice().sort((a,b)=>ord[outSt(S,a)]-ord[outSt(S,b)]||b.r-a.r).map(x=>{const st=outSt(S,x), fv=(x.pas&&fxText(x.pas.fx))||'', fk=(x.kpas&&fxText(x.kpas.fx))||'', pl=t=>t.replace(/<[^>]+>/g,'');
    const can=st!=='vs'&&st!=='off'&&!outLocked(S,x), fresh=st==='vs'&&x.act&&!S.appeals['o'+x.id];
    return `<tr class="s-${st}${etherSel===x.id?' sel':''}" data-o="${x.id}"><td class="nm">${x.nm}</td><td class="r">${x.r}</td><td class="st">${SN[st]}${st!=='vs'&&st!=='off'?(can?'':' · н~е в~зять'):''}</td><td>${x.aud||''}</td>
      <td class="${st==='vs'?'':'dim'}">${x.act?x.act.t+(fresh?' <i>●</i>':''):''}</td>
      <td class="${st==='vs'?'':'dim'}">${st==='vs'?fv:pl(fv)}</td><td class="${st==='kr'?'':'dim'}">${st==='kr'?fk:pl(fk)}</td></tr>`;}).join('');
  const st=outSt(S,o); let det=`<div class="odet"><div class="ph">И~ЗДАНИЕ · ${st==='vs'?'в~аше: п~оручить (р~аз в д~ень)':st==='off'?'н~е р~аботает':'к~ак п~еретянуть (о~дно в д~ень'+(S.appeals.pull?', у~же б~ыло':'')+')'}</div><div class="oh"><b>${o.nm}</b> <span>о~хват ${o.r} · ${SN[st]}. ${o.about||''}</span></div><div class="obtn">`;
  if(st==='vs'){det+=[['o'+o.id,o.act],['p'+o.id,o.act2]].filter(x=>x[1]).map(([key,a])=>{const s2=outActState(o,a,key);return `<div class="law oact${s2!==true?' lock':''}" data-k="${key}"><div class="t">${a.t} <span class="cst">Э~фир −${a.cost}</span></div><div class="e">${s2===true?[fxText(fxOf(a)),a.e].filter(Boolean).join(' · '):`<span class="n">${s2}</span>`}</div></div>`;}).join('');}
  else if(st==='off')det+=`<div class="oa n">С~ейчас н~е р~аботает.</div>`;
  else if(outLocked(S,o))det+=`<div class="oa n">П~еретянуть н~ельзя.</div>`;
  else det+=(o.ways||'').split('').map(k=>{const W=OUT_WAYS[k], s2=outWayState(o,k), c=fxText(W.cost(o))||(k==='z'?'п~остановление':'');return `<div class="law oway${s2!==true?' lock':''}" data-w="${k}"><div class="t">${W.t} <span class="cst">${c||'п~риказ'}</span></div><div class="e">${s2===true?W.d(o)+(st==='kr'?'. С~танет н~ейтральным':'. С~танет в~ашим'):`<span class="n">${s2}</span>`}</div></div>`;}).join('');
  det+='</div></div>';
  const win=$('modal-win'); win.classList.add('wide');
  win.innerHTML=`<h2>Э~ФИР · Б~ОРЬБА З~А М~ОСКВУ</h2>
   <div class="tug"><span class="l">з~а С~овет ${S.city}%</span><div class="tb"><i style="width:${S.city}%"></i></div><span class="r">з~а К~ремль ${100-S.city}%</span></div>
   ${resStrip('med')}
   <div class="sub">В~аш г~олос <b style="color:var(--ok)">${inc}</b> п~ротив к~ремлёвского <b style="color:#7fa0cf">${kv}</b>: М~осква <b class="${dc<0?'n':'p'}">${dc?sg(dc):'б~ез п~еремен'}</b> з~а н~очь. Р~ычаги М~осквы: «М~К» и «Э~хо М~осквы» (к~аждое в~аше д~аёт +1 з~а н~очь, с~ейчас +${moscOut()}), к~ампании н~иже, о~провержения в у~тренней г~азете. В~ыберите и~здание в т~аблице.${S.flags.noComms?' <span class="n">С~вязи н~ет: р~аботают т~олько р~адио з~дания, и~ностранцы и т~е, к~ого п~устили в~нутрь.</span>':''}${S.kmed?' <span class="n">Н~очью К~ремль б~ил п~о э~фиру.</span>':''}</div>
   <table class="otab"><tr><th>И~здание</th><th>О~хват</th><th>Ч~ьё</th><th>Н~а к~ого в~лияет</th><th>Ч~то д~елает, к~огда в~аше</th><th>К~аждый х~од, п~ока в~аше</th><th>п~ока у К~ремля</th></tr>${rows}</table>
   <div class="eth3">${det}<div><div class="ph">О~БЩИЕ К~АМПАНИИ · н~е п~ривязаны к и~зданию, т~ратят Э~фир (с~ейчас ${fmt(S.med)})</div><div class="app2 a1">`+
   APPEALS.filter(inPh).map(a=>{const nc=S.flags.noComms&&a.id!=='foreign', used=S.appeals[a.id]||nc, poor=S.med<a.cost;
     return `<div class="law gen${nc?' lock':used?' done2':poor?' lock':''}" data-id="${a.id}"><div class="t">${a.t} <span class="cst">Э~фир −${a.cost}</span></div><div class="e">${nc?'<span class="n">н~ет с~вязи</span>':used?'с~егодня у~же б~ыло':poor?'<span class="n">н~е х~ватает Э~фира: н~ужно '+a.cost+'</span>':[fxText(fxOf(a)),a.e].filter(Boolean).join(' · ')}</div></div>`;}).join('')+
   `</div></div></div><div class="close xtop">✕ З~АКРЫТЬ</div>`;
  $('modal').classList.add('on');
  win.querySelectorAll('tr[data-o]').forEach(e=>e.onclick=()=>{etherSel=e.dataset.o;openEther();});
  win.querySelectorAll('.oway').forEach(e=>e.onclick=()=>outWin(o,e.dataset.w));
  win.querySelectorAll('.oact').forEach(e=>e.onclick=()=>{const key=e.dataset.k;outAct(o,key[0]==='o'?o.act:o.act2,key);});
  win.querySelectorAll('.law.gen').forEach(e=>e.onclick=()=>{const a=APPEALS.find(x=>x.id===e.dataset.id);
    if(S.appeals[a.id]||S.med<a.cost||(S.flags.noComms&&a.id!=='foreign'))return; S.med-=a.cost; S.appeals[a.id]=1; S.did.media=1; apply(fxOf(a)); if(a.run)a.run(S); if(a.id==='deny')S.kmed=0; log('Э~фир: '+a.t.toLowerCase()+'.'); save(); showMain(); openEther();});
  win.querySelector('.close').onclick=closeModal;
}
function siegeState(i){const a=SIEGE[i]; if(a.once&&S.flags[a.once])return 'у~же с~делано'; const r=a.req(S); if(r!==true)return r; if(!S.orders)return 'н~ет п~риказов д~о у~тра'; return true;}
function openSiege(){ syncRing();
  const win=$('modal-win'); win.classList.add('wide');
  const L=SIEGE.map((a,i)=>({a,i,st:siegeState(i)})), can=x=>x.st===true;
  const card=({a,i,st})=>`<div class="law${st===true?'':st==='у~же с~делано'?' done2':' lock'}" data-i="${i}"><div class="t">${a.t} <span class="cst">${[a.ring?'<span class="p">К~ольцо −'+Math.min(a.ring,S.ring||0)+'</span>':'',fxText(a.fx)].filter(Boolean).join(' · ')}</span></div><div class="e">${st===true?a.d:st==='у~же с~делано'?'у~же с~делано':`<span class="n">${st}</span>`}</div></div>`;
  const grp=(t,l)=>l.length?`<div class="ph">${t}</div><div class="sg2">${l.map(card).join('')}</div>`:'';
  const ringL=L.filter(x=>x.a.ring&&x.a.ring<100), sum=ringL.filter(can).reduce((a,x)=>a+x.a.ring,0), oth=L.filter(x=>!x.a.ring||x.a.ring>=100).filter(x=>S.cordon||!/кольца нет/.test(x.st));
  win.innerHTML=`<h2>Б~ЛОКАДА${S.cordon?' · К~ОЛЬЦО '+S.ring+' И~З 100':''}</h2>${resStrip('ord')}${S.cordon?`<div class="tug"><span class="l">с~нято ${100-S.ring}</span><div class="tb"><i style="width:${100-S.ring}%"></i></div><span class="r">о~сталось ${S.ring}</span></div>`:''}
   <div class="sub">${S.cordon?(RP=>'К~ольцо з~а н~очь с~ейчас: <span class="n">Л~егитимность '+RP.leg+(RP.hope?', Р~ешимость '+RP.hope:'')+(RP.med?', Э~фир '+RP.med:'')+(RP.sup?', С~набжение −'+String(RP.sup).replace('.',',')+' д~н.':'')+(RP.dep?', у~ходят е~щё '+RP.dep+' д~епутатов':'')+'</span>, л~юди н~е п~риходят, з~а п~роволоку н~е в~ыйти. '+(S.ring>=50?'Н~иже 50 д~авит с~лабее. ':'К~ольцо о~слаблено: д~авит с~лабее. ')+'К~аждую н~очь е~го п~одтягивают н~а 2. <b style="color:var(--paper);font-weight:400">О~сталось с~нять '+S.ring+'; о~ткрытые с~ейчас п~ути д~ают −'+sum+'.</b>'+(S.flags.gap>0?' <span class="p">Е~сть л~аз: е~щё '+S.flags.gap+' н~оч.</span>':''))(ringPress(S)):'К~ольца н~ет. З~десь ж~е ч~инят с~вязь и с~вет.'}
   ${S.flags.noComms?' <span class="n">С~вязи н~ет.</span>':''}${S.flags.noPower?' <span class="n">С~вет и в~ода о~тключены м~эрией.</span>':''}</div>`+
   (S.cordon?`<div class="ph">Т~ЕРПЕТЬ И П~ЛАТИТЬ · к~аждую н~очь, п~риказ н~е т~ратится, м~ожно о~тменить</div><div class="sg3">`+HOLDS.map(H=>{const on=(S.hold||{})[H.id],c=H.can(S);return `<div class="law hold${on?' on2':c!==true?' lock':''}" data-h="${H.id}"><div class="t">${H.t} <span class="cst">${fxText(H.cost)} з~а н~очь</span></div><div class="e">${on?'<span class="p">✓ в~ключено.</span> '+H.d+'. Н~ажмите, ч~тобы о~тменить':c!==true?`<span class="n">${c}</span>`:H.d}</div></div>`;}).join('')+'</div>':'')+
   (S.cordon?grp('С~НЯТЬ К~ОЛЬЦО П~О Ч~АСТЯМ · О~ТКРЫТО С~ЕЙЧАС · к~аждое д~ействие т~ратит п~риказ',ringL.filter(can))+grp('С~НЯТЬ К~ОЛЬЦО П~О Ч~АСТЯМ · П~ОКА З~АКРЫТО (в~идно, ч~его н~е х~ватает)',ringL.filter(x=>!can(x))):'')+
   grp(S.cordon?'П~РОРЫВ, О~БХОД, С~ВЯЗЬ И С~ВЕТ':'С~ВЯЗЬ И С~ВЕТ',oth.filter(can).concat(oth.filter(x=>!can(x))))+`<div class="close xtop">✕ З~АКРЫТЬ</div>`;
  $('modal').classList.add('on');
  win.querySelectorAll('.law.hold').forEach(e=>e.onclick=()=>{const H=HOLDS.find(x=>x.id===e.dataset.h); S.hold=S.hold||{}; if(!S.hold[H.id]&&H.can(S)!==true)return; S.hold[H.id]=S.hold[H.id]?0:1; Sfx.play('bolt'); save(); showMain(); openSiege();});
  win.querySelectorAll('.law[data-i]').forEach(e=>e.onclick=()=>{const i=+e.dataset.i,a=SIEGE[i]; if(siegeState(i)!==true)return; S.orders--;
    Sfx.play(/силой/.test(a.t)?'burst':/рацию/.test(a.t)?'static':/москвич/.test(a.t)?'crowd':/Патриарх/.test(a.t)?'night':'bolt');
    if(a.chance&&Math.random()>a.chance){apply(a.fail);log(a.failLog,'bad');} else{apply(a.fx);a.run(S);if(a.once)S.flags[a.once]=1;if(a.ring&&S.ring!=null)S.ring=Math.max(0,S.ring-a.ring);log(a.okLog);syncRing();}
    save(); if(checkLose())return; showMain(); openSiege();});
  win.querySelector('.close').onclick=closeModal;
}
// историческая справка: один раз, при первом нажатии на силу или фракцию; после «ОК» больше не показывается
function firstLook(kind,id){S.seen=S.seen||{}; const key=kind+id; if(S.seen[key])return; const P=kind==='p'?POINTS.find(x=>x.id===id):FACTIONS.find(x=>x.id===id), txt=kind==='p'?(P.why?P.why+'<br><br>'+((S.phase===1&&P.facts1)||P.facts).join(' '):''):FAC_WHY[id]; if(!txt)return;
  S.seen[key]=1; save(); const who=kind==='p'?POINT_WHO[id]:FAC_WHO[id], W=PEOPLE[who];
  $('modal-win').classList.remove('wide');
  $('modal-win').innerHTML=`<h2>${kind==='p'?P.full:P.nm.replace(/"/g,'«').replace(/«([^«]*)«/,'«$1»').toUpperCase()}</h2><div style="display:flex;gap:14px;align-items:flex-start;margin-top:10px">${W?faceHTML(who,'big'):''}<div class="sub" style="margin:0;font-size:18px;line-height:21px">${W?`<b style="color:var(--paper);font-weight:400">${W.nm}</b>, ${W.role}<br><br>`:''}${txt}</div></div><div class="law" id="fl-ok" style="margin-top:16px;text-align:center"><div class="t">О~К</div></div>`;
  $('modal').classList.add('on'); drawFaces($('modal-win')); $('fl-ok').onclick=closeModal;}
function resStrip(hl){const it=[['leg','Л~егитимность',S.leg],['dep','Д~епутаты',deputies(S)],['ppl','Л~юди',fmt(S.ppl)],['mil','О~полчение',fmt(S.mil)],['gun','С~тволы с~вободные',fmt(freeGuns(S))],['med','Э~фир',fmt(S.med)+' <i>+'+mediaGain()+' з~а х~од</i>'],['sup','С~набжение',Math.floor(S.sup)+' д~н.'],['hope','Р~ешимость',S.hope+'%'],['rad','Р~адикализм',S.rad+'%'],['city','М~осква',S.city+'%'],['ord','П~риказы',S.orders],['law','П~остановления',S.lawCharges]];
  return '<div class="rstrip">'+it.map(([k,n,v])=>`<span class="${k===hl?'hl':''}">${n} <b>${v}</b></span>`).join('')+'</div>';}
function openStrike(){const T=S.strike&&STRIKES.find(x=>x.id===S.strike.id); if(!T)return; const ok=T.cover(S);
  $('modal-win').innerHTML=`<h2>Г~ЛАВНЫЙ У~ДАР Е~ЛЬЦИНА · ${T.nm.toUpperCase()}</h2><div class="sub">${T.warn}<br><br>У~дар п~ридётся э~той н~очью п~о о~дному м~есту и б~удет т~яжёлым: ${fxText(T.hit(S))||T.e}${T.e&&fxText(T.hit(S))?' · <span class="n">'+T.e+'</span>':''}.<br><br>П~рикрыть: <b style="color:var(--paper)">${T.guard}</b>. ${ok?'<span class="p">С~егодня у~же п~рикрыто.</span>':'<span class="n">П~ока н~е п~рикрыто.</span>'}${S.flags.shield?'<br>К~омпромат в х~оду: е~сли у~дар п~ройдёт, т~о в~полсилы.':'<br>К~ампания «К~омпромат н~а п~равительство» в «Э~фире» о~слабит у~дар в~двое.'}</div><div class="close">ESC — з~акрыть</div>`;
  $('modal').classList.add('on'); $('modal-win').querySelector('.close').onclick=closeModal;}

function openHelp(){
  const LD=legDrift(S);
  const H=[['Л~егитимность','ш~анс, ч~то п~риказ з~а с~тенами и~сполнят (с~ейчас '+Math.round(execChance('x')*100)+'%), м~ножитель п~остановлений, п~роверки в с~обытиях. П~отолка н~ет, н~о к~аждую н~очь о~на у~ходит, а в~ыше 70 л~юбая п~рибавка д~аёт в~двое м~еньше. С~ейчас з~а н~очь: '+LD.P.map(p=>p[1]+' '+sg(p[0])).join(', ')+', и~здания '+(pressLeg(S)?sg(pressLeg(S)):'0')+'.'],
   ['Д~епутаты','и~х ч~исло и е~сть м~андат. К~аждые 5 у~шедших з~а с~утки с~нимают 1 Л~егитимности. В к~ризис и~х б~ерут и~змором: к~аждую н~очь к~то-т~о у~ходит, б~ольше п~ри к~ольце, б~ез с~вета и п~осле е~льцинских «г~арантий»; Р~ешимость и л~ояльность ф~ракций у~ход с~держивают. М~еньше '+QUORUM+' — н~ет к~ворума, Л~егитимность −3 з~а н~очь.'],
   ['Л~юди','р~уки: п~икеты, о~бозы, б~аррикады, т~ушение п~ожара. В к~ризис м~еньше '+PERIM+' — п~ериметр п~уст, Р~ешимость −2 з~а н~очь. О~т 2500 К~ремль м~едлит с~о ш~турмом, н~о т~олпа с~ъедает с~набжение и р~астит р~адикализм.'],
   ['О~полчение','л~юди с о~ружием: д~ержат в~ходы п~ри ш~турме, о~т 200 п~однимают Р~ешимость, о~ткрывают с~иловые в~арианты.'],
   ['О~ружие','с~тволы. В~ооружённый ч~еловек с~тановится б~ойцом о~полчения и д~ержит с~твол п~ри с~ебе: з~апас н~е у~меньшается, у~меньшаются с~вободные с~тволы.'],
   ['Э~фир','е~динственная м~едийная в~алюта. П~риходит к~аждую н~очь о~т и~зданий н~а в~ашей с~тороне. Т~ратится н~а р~едакции, к~ампании, о~тветы н~а г~азету; м~еняется н~а Л~егитимность, М~оскву и л~ояльность ф~ракций.'],
   ['С~набжение','д~ни е~ды и с~олярки. Н~оль — л~юди у~ходят, Р~ешимость п~адает.'],
   ['М~осква','н~астроение г~орода: п~риток л~юдей, Л~егитимность, с~корость ш~турма. Р~ешается в «Э~фире».'],
   ['Р~ешимость','е~динство д~ома: н~иже 45% д~епутаты у~ходят б~ыстрее. Н~оль — к~онец.'],
   ['Р~адикализм','с~тавки: о~ткрывает с~иловые в~арианты, з~акрывает п~ереговоры, о~т 60% К~ремль б~ьёт с~ильнее.'],
   ['С~илы н~а к~арте','к~анат м~ежду С~оветом и К~ремлём. О~т 65% с~ила р~аботает н~а в~ас к~аждую н~очь, д~о 35% — н~а К~ремль. К~ремль к~аждую н~очь т~янет в~сех к с~ебе, а р~аз в д~ва-т~ри д~ня Е~льцин б~ьёт п~о о~дной и~з н~их в~серьёз: г~азета п~редупреждает у~тром.'],
   ['К~ольцо','о~цепление з~дания, 0–100. П~ока с~тоит, к~аждую н~очь б~ьёт п~о Л~егитимности, Р~ешимости, Э~фиру, С~набжению и у~водит д~епутатов; н~иже 50 д~авит с~лабее. М~ожно т~ерпеть и п~латить (к~урьеры, д~войной п~аёк, н~осильщики) и~ли с~нимать п~о ч~астям: о~кно «Б~локада» н~а к~арте.']];
  $('modal-win').innerHTML='<h2>П~ОКАЗАТЕЛИ: Ч~ТО Н~А Ч~ТО В~ЛИЯЕТ</h2>'+H.map(h=>`<div class="hlp"><b>${h[0]}</b><span>${h[1]}</span></div>`).join('')+'<div class="close">ESC — з~акрыть</div>';
  $('modal').classList.add('on'); $('modal-win').querySelector('.close').onclick=closeModal;
}
function closeModal(){ $('modal-win').classList.remove('wide'); $('modal-win').classList.remove('full'); if(S&&S.A&&S.A.card&&screen==='assault')return; $('modal').classList.remove('on');}
function openChron(){
  const c=(S&&S.chron&&S.chron.length?S.chron:store.get(CHRON))||[];
  $('modal-win').innerHTML=`<h2>Х~РОНИКА С~ОБЫТИЙ</h2><div class="sub">Р~ешения п~оследней п~артии.</div><div class="chron">`+
   (c.length?c.map(x=>`<div><b>${x.date}.</b> ${x.h}: ${x.ch}</div>`).join(''):'<div>П~ока п~усто. Н~ачните н~овую и~гру.</div>')+`</div><div class="close">ESC — з~акрыть</div>`;
  $('modal').classList.add('on'); $('modal-win').querySelector('.close').onclick=closeModal;
}
$('modal').onclick=e=>{if(e.target.id==='modal')closeModal();};
$('b-laws').onclick=()=>openLaws();
$('b-end').onclick=()=>endTurn();
$('b-wh').onclick=()=>setView('wh');
$('b-ether').onclick=()=>openEther();
document.querySelectorAll('#s-wh .tabs div').forEach(d=>d.onclick=()=>{const t=d.dataset.t; if(t==='menu')return toMenu();
  if(t==='map')setView('map');else if(t==='ether')openEther();else if(t==='laws')openLaws();else if(t==='end')endTurn();});
$('a-next').onclick=()=>nextHour();

// ---------- toast with the Kremlin's night move ----------
function showToast(){
  return; /* the morning report is now the newspaper screen */ const k=S.kremlin;
  const slot=screen==='wh'?$('w-toast'):$('toast-slot');
  slot.innerHTML=`<div class="toast"><div class="h">Н~ОЧЬ Н~А ${dateStr(S.day).toUpperCase()} · ${S.phase===1?'Ч~ТО Д~ЕЛАЕТ К~РЕМЛЬ':'О~ТВЕТ К~РЕМЛЯ'}</div><div class="b">`+
    (k.moves||[]).slice().sort((a,b)=>(b.y||0)-(a.y||0)).map(m=>`<div class="km${m.g?' g':''}${m.y?' y':''}"><span class="c">${m.c}</span><div>${m.t}<br><span class="e">${m.e}</span></div></div>`).join('')+
    `${k.n?`<div class="nt"><b>В~аша н~очь:</b> ${k.n}</div>`:''}</div><div class="x">щ~ёлкните, ч~тобы з~акрыть</div></div>`;
  slot.firstChild.onclick=hideToast;
}
function hideToast(){$('toast-slot').innerHTML='';$('w-toast').innerHTML='';}
const toastOn=()=>!!($('toast-slot').firstChild||$('w-toast').firstChild);

// ================= TURN =================
function endTurn(){ Sfx.play('night'); const d0={...snap(),hope:S.hope,rad:S.rad,city:S.city,pr:S.pr};
  if(screen!=='map'&&screen!=='wh')return; hideToast(); $('modal').classList.remove('on');
  const notes=[]; S.did=S.did||{}; S.st=S.st||{}; syncRing();
  // supplies
  // no siege before the decree; deliveries still trickle in until the barbed wire goes up
  const shut=S.cordon&&!(S.flags.gap>0);
  const RP=S.cordon?ringPress(S):{leg:0,hope:0,sup:0,med:0,dep:0};
  if(S.cordon){S.hold=S.hold||{}; const paid=[]; for(const H of HOLDS){ if(!S.hold[H.id])continue; if(H.can(S)!==true){S.hold[H.id]=0; notes.push('Н~ечем п~латить: «'+H.t+'» о~тменены');} else{apply(H.cost);paid.push(H.t.toLowerCase());} } if(paid.length)notes.push('О~плачено з~а н~очь: '+paid.join(', ')); if(RP.med)S.med=Math.max(0,S.med+RP.med);}
  if(S.phase===2)S.sup=Math.max(0,S.sup-((.5+RP.sup)+S.ppl/5000)*(S.flags.ration?.5:1)+(S.flags.tunnel?.5:0));
  S.sup+=whYield(S).sup;
  if(S.sup<1){S.hope=clamp(S.hope-8,0,100);S.ppl=Math.round(S.ppl*.9);S.mil=Math.round(S.mil*.95);log('В з~дании н~ет е~ды. Л~юди у~ходят.','bad');}
  // the perimeter needs hands: too few people and the House feels abandoned
  if(S.phase===2&&S.ppl<PERIM){S.hope=clamp(S.hope-2,0,100);notes.push('Л~юдей м~еньше '+PERIM+', п~ериметр д~ержать н~екому: Р~ешимость −2');}
  if(S.flags.gap>0){S.flags.gap--; notes.push(S.flags.gap?'Л~аз в о~цеплении д~ержится':'Л~аз в о~цеплении з~акрыли: с~пираль в т~ри р~яда');}
  // people come and go
  const inflow=shut?Math.max(0,(S.city-55)*4):Math.max(0,Math.round((S.hope-40)*1+(S.city-40)*(S.phase===1?2:4)));
  S.ppl=Math.max(0,S.ppl+inflow-Math.round(S.ppl*(shut?.08:S.phase===2?.06:.03)));
  // rooms of the White House
  const LD=legDrift(S), dh=whYield(S).hope;
  S.leg=clamp(S.leg+LD.v,0,100);
  if(LD.v)notes.push('Л~егитимность з~а н~очь '+sg(LD.v)+': '+LD.P.map(p=>p[1]+' '+sg(p[0])).join(', '));
  if(dh)notes.push('Р~абота С~ъезда: Р~ешимость +'+dh);
  // media: income from channels; without a voice the Kremlin owns the air
  const dc=cityShift(), inc=mediaGain(); S.med+=inc; S.city=clamp(S.city+dc,0,100);
  if(dc)notes.push('Б~орьба з~а М~оскву: '+sg(dc));
  if(S.flags.komp>0)S.flags.komp--;
  if(S.mil>=400)S.rad=clamp(S.rad+1,0,100);
  if(S.phase===2){const o0=S.omon==null?100:S.omon; let o=o0+4; if(S.pts.mer>=65)o-=4; if(S.city>=60)o-=2; S.omon=clamp(o,0,100); if(o0<100&&S.omon>o0)notes.push('О~МОНу в~ыдали п~ремии: г~отовность '+S.omon+'%');}
  // resolve is the unity of the House: when it cracks, deputies walk out
  if(S.phase===2&&S.hope<45){let out=Math.round((45-S.hope)/5)+2, o0=out; for(const id of ['kol','sm','agr','ros']){const f=S.fac[id],k=Math.min(f.n,out);f.n-=k;out-=k;if(f.n<4){f.n=0;f.room=null;} if(!out)break;} notes.push('Р~аскол: у~шли '+(o0-out)+' д~епутатов');}
  S.hope=clamp(S.hope-(S.phase===2?4:1)-(S.sup<3?1:0)+RP.hope+dh,0,100);
  if(S.cordon){S.rad=clamp(S.rad+2,0,100); S.ring=Math.min(100,(S.ring==null?100:S.ring)+2);}
  if(S.phase===2)S.pr=clamp(S.pr+prRate(),0,100);
  // the Kremlin slowly pulls everyone to its side
  for(const p of POINTS)if(!p.fixed&&S.pts[p.id]<100)S.pts[p.id]=clamp(S.pts[p.id]-(S.phase===1?1:(p.id==='mo'||p.id==='gs')?3:2),0,100);
  // канат: сила, которая стоит у одного из полюсов, каждую ночь работает на него
  {let tf={},rg=0;const tn=[]; for(const id in POINT_TUG){const sd=tugSide(S.pts[id]),T=sd&&POINT_TUG[id][sd]; if(!T||(T.ph&&S.phase<T.ph))continue; tf=merge(tf,T.fx); if(T.ring&&S.cordon)rg+=T.ring; tn.push(POINTS.find(p=>p.id===id).nm.replace(/ ↑.*/,'')+': '+T.t);}
   if(tn.length){apply(tf); if(rg&&S.ring!=null){S.ring=Math.max(0,S.ring-rg);} notes.push('С~илы з~а н~очь: '+tn.join('; '));}}
  // factions
  // darkness and cold: no power wears the House down; generators burn supplies instead
  if(S.flags.noPower&&S.flags.gen&&S.sup>0)S.flags.noPower=0;
  if(S.phase===2&&S.flags.noPower){S.hope=clamp(S.hope-2,0,100);notes.push('Н~ет с~вета и в~оды: Р~ешимость −2');}
  else if(S.phase===2&&S.flags.gen){S.sup=Math.max(0,S.sup-.25);notes.push('Г~енераторы ж~гут с~олярку: С~набжение −0,25 д~н.'); if(S.sup<=0){S.flags.noPower=1;S.flags.gen=0;notes.push('С~олярка к~ончилась: с~вет п~огас');}}
  let fb={}, fbn=0;
  for(const F of FACTIONS){const b=facBonus(S,F); if(b&&b.on){fb=merge(fb,b.fx);fbn++;}}
  if(fbn){apply(fb); S.sup=Math.max(0,S.sup); const t=fxText(fb); if(t)notes.push('Ф~ракции: '+t.replace(/<[^>]+>/g,''));}
  // deputies come back to a Congress that looks alive
  if(S.phase===2&&S.leg>=60&&S.hope>=65&&(!S.cordon||S.flags.tunnel||S.flags.gap>0||S.city>=55)){const F0=FACTIONS.find(x=>x.id==='kol'),k=Math.min(F0.n-S.fac.kol.n,2+Math.floor(Math.random()*4)); if(k>0){S.fac.kol.n+=k; notes.push('В~ернулись и~з о~кругов '+k+' у~шедших д~епутатов: С~ъезд в~ыглядит ж~ивым');}}
  for(const k in S.uses||{})if(S.day%2===0&&S.uses[k]>0&&!S.used[k])S.uses[k]--;
  for(const F of FACTIONS){const f=S.fac[F.id]; if(f.n<=0)continue;
    if(S.hope<40&&Math.random()<.5)f.loy=Math.max(0,f.loy-1);
    if(f.loy<=3&&S.phase===2){const out=Math.max(2,Math.round(f.n*.1));f.n=Math.max(0,f.n-out);if(f.n<4)f.n=0;
      notes.push(`${F.nm.replace(/"/g,'')}: у~шли ${out}`); if(f.n===0)f.room=null;}
  }
  // до указа нелояльные тоже разъезжаются: «в округ, к избирателям»
  if(S.phase===1)for(const F of FACTIONS){const f=S.fac[F.id]; if(F.kind==='dep'&&f.n>4&&f.loy<=3){const o=1+Math.floor(Math.random()*3);f.n-=o;notes.push(F.nm.replace(/"/g,'')+': '+o+' у~ехали «в о~круг»');}}
  // измор: в кризис каждую ночь кто-то уходит; сначала те, кто меньше всех верит
  if(S.phase===2){const why=[]; let k=3+Math.floor(Math.random()*4);
    if(S.cordon&&RP.dep){k+=RP.dep;why.push('к~ольцо');} if(S.flags.noPower){k+=2;why.push('н~ет с~вета');} if(S.flags.bribe){k+=2;why.push('«г~арантии» п~резидента');}
    if(S.hope>=70)k-=2; if(S.laws.mandate)k-=2; if(S.leg>=60)k-=1; k=Math.max(0,k);
    const L=FACTIONS.filter(F=>F.kind==='dep'&&S.fac[F.id].n>0&&S.fac[F.id].loy<8).sort((a,b)=>S.fac[a.id].loy-S.fac[b.id].loy); let left=k,gone=0;
    for(const F of L){const f=S.fac[F.id],q=Math.min(f.n,Math.ceil(left*(f.loy<=3?.6:.45)));f.n-=q;left-=q;gone+=q;if(left<=0)break;}
    if(gone)notes.push('И~змор: з~а н~очь у~шли '+gone+' д~епутатов'+(why.length?' ('+why.join(', ')+')':''));}
  {const fd=facDrift(); if(fd.length)notes.push('Ф~ракции: '+fd.join(', '));}
  // Kremlin answers: several moves a night, more as the stakes rise
  S.kdone=S.kdone||{};
  const nK=(S.phase===1?(S.pr>=10?2:1):2+(S.rad>=60||S.day>=15?1:0))-(S.flags.leak?1:0);
  const moves=[]; let kmed=0;
  for(let n=0;n<nK;n++){
    const opts=KREMLIN.filter(k=>!(S.flags.cam&&['п~ровокация','с~рыв','у~лица'].includes(k.c))&&!moves.includes(k)&&!(k.once&&S.kdone[k.t])&&!(k.good&&moves.some(m=>m.good))).map(k=>({k,w:k.w(S)})).filter(o=>o.w>0);
    if(!opts.length)break; let r=Math.random()*opts.reduce((a,o)=>a+o.w,0); const k=(opts.find(o=>(r-=o.w)<0)||opts[0]).k; moves.push(k);}
  const rep=[];
  // главный удар Ельцина: объявлен утром, приходит ночью по одному месту
  let struck=false;
  if(S.strike){const T=STRIKES.find(x=>x.id===S.strike.id); struck=true;
    if(T.cover(S)){rep.push({t:T.okT,h:T.okH,e:'<span class="p">у~дар о~тбит</span>',c:'Е~льцин',g:1,y:1}); S.st.blk=(S.st.blk||0)+1;}
    else{const half=!!S.flags.shield; let fx=T.hit(S); if(half)fx=halve(fx); apply(fx); if(T.run)T.run(S,half); S.flags.shield=0; S.st.hit=(S.st.hit||0)+1; S.hope=clamp(S.hope-2,0,100); if(S.lastStrikeId==='mvd'||T.id==='mvd')S.omon=clamp((S.omon==null?100:S.omon)+10,0,100);
      rep.push({t:T.hitT+(half?' К~омпромат с~бил р~азмах: у~дар в~ышел в~полсилы.':''),h:T.hitH,e:[fxText(fx),T.e?'<span class="n">'+T.e+'</span>':''].filter(Boolean).join(' · '),c:'Е~льцин',y:1});}
    S.lastStrike=S.strike.id; S.strike=null;}
  // Ельцин лично
  if(!struck){S.ydone=S.ydone||{}; const y=YELTSIN.find((y,i)=>!S.ydone[i]&&y.ph===S.phase&&y.w(S)); if(y){S.ydone[YELTSIN.indexOf(y)]=1; apply(y.fx); if(/ОКЛАД/.test(y.h))S.flags.bribe=1; if(y.run)y.run(S); rep.push({t:y.t,h:y.h,e:fxText(y.fx),c:'Е~льцин',y:1}); moves.pop();}}
  // клеймо: пока РНЕ в здании, либеральная пресса бьёт каждую ночь и всё сильнее
  if(S.phase===2){const b0=S.flags.brand||0; if(S.fac.rne.n>0){S.flags.rneWas=1;const b=Math.min(3,b0+1);S.flags.brand=b;const fx={city:-b,leg:b>=3?-2:b>=2?-1:0};apply(fx);const T=BRAND_T[b-1];rep.push({t:T[S.day%T.length],e:fxText(fx),c:'к~леймо'});}
    else{ if(b0>0)S.flags.brand=b0-1; if(S.rad>=60){apply({city:-1});rep.push({t:'Г~азеты п~ишут о «к~расно-к~оричневых» в Б~елом д~оме: с~лишком м~ного р~азговоров о с~трельбе.',e:fxText({city:-1}),c:'к~леймо'});}}}
  // издания работают каждую ночь на того, чьё они; в газету попадают самые громкие, остальное одной строкой
  {const agg={vs:{},kr:{}},L=[]; for(const o of OUTLETS){const sd=outSt(S,o),e=sd==='vs'?o.pas:sd==='kr'?o.kpas:null; if(!e)continue; apply(e.fx); agg[sd]=merge(agg[sd],e.fx); L.push({sd,e:S.phase===1&&e.t1?{...e,t:e.t1}:e});}
   const sh=a=>a.sort(()=>Math.random()-.5), tx=f=>fxText(f).replace(/<[^>]+>/g,'');
   for(const x of sh(L.filter(x=>x.sd==='vs')).slice(0,1))rep.push({t:x.e.t,e:fxText(x.e.fx),c:'в~аша п~ресса',g:1});
   for(const x of sh(L.filter(x=>x.sd==='kr')).slice(0,S.phase===2?2:1))rep.push({t:x.e.t,e:fxText(x.e.fx),c:'и~х п~ресса'});
   if(tx(agg.vs))notes.push('В~аши и~здания з~а н~очь: '+tx(agg.vs)); if(tx(agg.kr))notes.push('И~здания К~ремля з~а н~очь: '+tx(agg.kr));}
  if(S.flags.leak)rep.push({t:'У~течка с~работала: о~дин х~од К~ремля с~орван, о н~ём у~знали з~аранее.',e:'',c:'в~аша п~ресса',g:1}); if(S.flags.cam)rep.push({t:'К~амеры п~ростояли у о~цепления в~сю н~очь. П~ровокаций н~е б~ыло.',e:'',c:'в~аша п~ресса',g:1}); S.flags.leak=0;S.flags.cam=0;
  for(const k0 of moves){const k=k0.tf?Object.assign({},k0,{t:k0.tf(S)}):k0; if(!k.t)continue; const fx=merge(k.fx,k.dyn?k.dyn(S):{}); apply(fx); if(k0.tf){S.kmed=1;kmed=1;S.kmedT=k.t;} if(k.run)k.run(S); if(k.once)S.kdone[k.t]=1;
    if(fx.city<0||fx.med<0){kmed=1;S.kmedT=k.t;} rep.push({t:k.t,e:fxText(fx)||k.e||'',c:k.c,g:k.good?1:0});}
  if(Math.random()<(S.phase===1?.3:.45)){const pool=KCRISIS.filter(k=>!S.kdone[k.t]&&k.w(S)>0); const k=pool[Math.floor(Math.random()*pool.length)];
    if(k){apply(k.fx);S.kdone[k.t]=1;rep.push({t:k.t,e:fxText(k.fx),c:'к~ризис в К~ремле',g:1,kc:1});}}
  S.sup=Math.max(0,S.sup); S.kmed=kmed;
  S.day++; for(const m of rep)log(m.t,m.g?'':'kr','н~очь');
  // every deputy who walks out takes a piece of the mandate with him
  {const now=deputies(S), was=S.depPrev==null?now:S.depPrev, d=now-was; S.st=S.st||{};
   if(d<0){const h=Math.round(-d/5); S.leg=clamp(S.leg-h,0,100); S.st.depOut=(S.st.depOut||0)-d; notes.push('З~а с~утки у~шли '+(-d)+' д~епутатов'+(h?': Л~егитимность −'+h:''));}
   else if(d>0){const h=Math.floor(d/6); S.st.depIn=(S.st.depIn||0)+d; if(h){S.leg=clamp(S.leg+h,0,100);notes.push('В~ернулись '+d+' д~епутатов: Л~егитимность +'+h);}}
   S.depPrev=now; S.depRate=Math.round(((S.depRate||0)+Math.max(0,-d))/2*10)/10; S.st.km=(S.st.km||0)+rep.length;}
  S.orders=S.flags.tapped?1:2; S.flags.tapped=0; S.used={}; S.appeals={}; S.did={}; S.away=0; if(S.day%2===1)S.lawCharges++;
  syncRing(); notes.sort((a,b)=>(/^(Измор|Легитимность за ночь|За сутки)/.test(b)?1:0)-(/^(Измор|Легитимность за ночь|За сутки)/.test(a)?1:0));
  // следующий главный удар: до указа раз в три дня, в кризис через день
  {const due=S.phase===1?(S.day>=2&&S.day<DECREE_DAY-1&&S.day%2===0):(S.phase===2&&S.pr<100&&(S.pr>=60||(S.day-DECREE_DAY)%2===1));
   if(due){const pool=STRIKES.filter(T=>T.id!==S.lastStrike&&T.ph.includes(S.phase)).map(T=>({T,w:T.w(S)})).filter(o=>o.w>0); let r=Math.random()*pool.reduce((a,o)=>a+o.w,0); const pk=pool.find(o=>(r-=o.w)<0)||pool[0]; if(pk)S.strike={id:pk.T.id};}}
  S.kremlin={moves:rep,notes,d0};
  S.am=snap();
  if(S.phase===2){
    // без штурма возможен только редкий компромисс: все восемь условий сразу. Иначе загнанный в угол Кремль идёт на штурм, а победа засчитывается после боя
    if(S.day>=15&&S.pts.mo>=80&&S.pts.gs>=80&&S.pr<100)return ending('win_army',1); // армия за Съезд: штурмовать некому
    if(dealScore().every(x=>x[0])&&!S.flags.dealNo){ if(Math.random()<.45)return ending('elect_deal'); S.flags.dealNo=1; S.flags.corner='elect'; S.pr=100; } // Кремль соглашается не всегда: иначе идёт на штурм
    if(!S.flags.corner&&S.pr<100){ const dealNear=dealScore().slice(0,7).every(x=>x[0]); /* полный мирный набор: Кремль ждёт до 1 октября и идёт на выборы */ const c=(!dealNear&&(S.flags.zero||0)>=1&&S.leg>=80&&S.city>=72&&S.day>=13)?'elect':0; if(c){S.flags.corner=c;S.pr=100;} }
  }
  if(checkLose())return;
  S.paper=1; save(); showPaper();
}
// ================= the morning paper: last night's report as a front page =================
const PAPER_K={'Е~льцин':'П~РЕЗИДЕНТ','к~леймо':'К~ТО В Б~ЕЛОМ Д~ОМЕ','и~х п~ресса':'О~БЗОР П~ЕЧАТИ','в~аша п~ресса':'Г~ОЛОС С~ЪЕЗДА','к~ризис в К~ремле':'В К~РЕМЛЕ Н~ЕСПОКОЙНО','с~иловики':'А~РМИЯ И М~ИЛИЦИЯ','д~епутаты':'Д~ЕПУТАТСКИЙ К~ОРПУС','б~локада':'В~ОКРУГ Б~ЕЛОГО Д~ОМА','п~ресса':'П~ЕЧАТЬ И Э~ФИР','к~омпромат':'Р~АЗОБЛАЧЕНИЕ','п~рослушка':'С~ПЕЦСЛУЖБЫ','п~ровокация':'П~РОИСШЕСТВИЯ','у~лица':'Г~ОРОД','р~егионы':'Р~ЕГИОНЫ','з~акон':'У~КАЗЫ','д~еньги':'Д~ЕНЬГИ','д~авление':'В~ОКРУГ Б~ЕЛОГО Д~ОМА','с~рыв':'С~БОЙ','с~лух':'С~ЛУХИ','в~аша н~очь':'В Б~ЕЛОМ Д~ОМЕ'};
const PAPER_PIC={'Е~льцин':'yeltsin','к~леймо':'barkash','с~иловики':'grachev','д~епутаты':'hasb','к~ризис в К~ремле':'yeltsin'};
const paperNorm=x=>x.replace(/[«»".,:!?…]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
const paperBody=(m,h)=>paperNorm(m.t)===paperNorm(h)||paperNorm(m.t).indexOf(paperNorm(h).replace(/…$/,''))===0&&paperNorm(m.t).length-paperNorm(h).length<4?'':`<p>${m.t}</p>`;
function paperHead(t,max){let h=t.replace(/[«»"]/g,'').split(/[.!?]/)[0].trim(); if(h.length>max){h=h.slice(0,max);h=h.slice(0,h.lastIndexOf(' '))+'…';} return h.toUpperCase();}
const paperStamps=e=>(e||'').split(' · ').filter(Boolean).map(x=>`<span class="st${/class="p"/.test(x)?' g':''}">${x.replace(/<[^>]+>/g,'').toUpperCase()}</span>`).join('');
function paperPhoto(pic){const c=$('np-ph'),g=c.getContext('2d'),W=220,H=110;g.fillStyle='#cfc4a6';g.fillRect(0,0,W,H);
  const tone=['#1c1916','#5b5244','#958a70','#cfc4a6'],B=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  const draw=im=>{const t=document.createElement('canvas');t.width=W;t.height=H;const x=t.getContext('2d');x.imageSmoothingEnabled=false;
    const k=Math.max(W/im.width,H/im.height),w=im.width*k,h=im.height*k;x.drawImage(im,(W-w)/2,(H-h)*.3,w,h);
    let d;try{d=x.getImageData(0,0,W,H);}catch(e){g.drawImage(t,0,0);return;}
    for(let y=0;y<H;y++)for(let X=0;X<W;X++){const i=(y*W+X)*4,l=(d.data[i]*.3+d.data[i+1]*.59+d.data[i+2]*.11)/255*1.5+.08,v=Math.min(2.999,Math.max(0,l*3)),f=v-Math.floor(v);
      g.fillStyle=tone[Math.min(3,Math.floor(v)+((f*16>B[y&3][X&3])?1:0))];g.fillRect(X,y,1,1);}};
  if(pic==='yeltsin'||(PEOPLE[pic]&&PEOPLE[pic].img)){const im=new Image();im.onload=()=>draw(im);im.src=pic==='yeltsin'?ASSET_YELTSIN:PEOPLE[pic].img;}
  else TitleArt.onReady(()=>draw(TitleArt.calm));}
function paperReplies(lead){const R=[];
  if(lead.c==='к~леймо')R.push({t:'В~ыставить Р~НЕ и~з з~дания',fx:{city:4,leg:2,hope:-4,rad:-5},run:()=>{S.fac.rne.n=0;S.flags.rneOut=1;S.flags.brand=Math.max(0,(S.flags.brand||0)-1);}});
  else if(lead.c==='Е~льцин')R.push({t:'П~остановление П~резидиума в о~твет',fx:{leg:2,hope:1,pr:2}});
  else if(lead.g)R.push({t:'Р~азослать н~омер п~о р~егионам и ч~астям',fx:{med:-4,leg:1,pts:{gs:1}},req:()=>S.med>=4||'н~ужно 4 Э~фира'});
  else R.push({t:'З~аявление П~резидиума В~ерховного С~овета',fx:{leg:1,hope:1,rad:1}});
  if(S.kremlin&&S.kremlin.moves.some(m=>m.kc))R.push({t:'Р~аздуть с~кандал в К~ремле',fx:{med:-5,city:2,pr:-3},e2:'с~ледующий г~лавный у~дар Е~льцина в~полсилы',run:()=>{S.flags.shield=1;},req:()=>S.med>=5||'н~ужно 5 Э~фира'});
  else if(!lead.g)R.push({t:'О~провержение в э~фире',fx:{med:-6,city:3},req:()=>S.flags.noComms?'с~вязи н~ет':S.med>=6||'н~ужно 6 Э~фира'});
  R.push({t:'П~ромолчать',fx:{},e:'д~ень н~ачнётся б~ез о~твета'}); return R;}
function showPaper(){const k=S.kremlin; if(!k){S.paper=0;return startDay();}
  show('paper'); Sfx.play('paper'); Sfx.play('teletype',.25);
  const vs=voiceOf(S,'vs'),kr=voiceOf(S,'kr'),nu=voiceOf(S,'neu'),tot=vs+kr+nu||1, ours=vs>kr;
  const items=k.moves.slice(); const ord=m=>ours?(m.g?0:m.y?1:2):(m.y?0:m.c==='к~леймо'?1:m.g?3:2); items.sort((a,b)=>ord(a)-ord(b));
  const lead=items.shift()||{t:'Н~очь п~рошла т~ихо. В Б~елом д~оме г~орит с~вет, в К~ремле т~оже.',e:'',c:'в~аша н~очь',g:1};
  {const kc=items.findIndex(m=>m.kc); if(kc>0)items.unshift(items.splice(kc,1)[0]);}
  const ST=S.strike&&STRIKES.find(x=>x.id===S.strike.id); if(ST)items.unshift({t:ST.warn,h:ST.warnH,e:'<span class="n">г~лавный у~дар э~той н~очью</span>',c:'Е~льцин'});
  const side2=lead.t.length<120&&items.length>3?items.shift():null, cols=items.splice(0,3), d=dateOf(S.day), WDN=['В~оскресенье','П~онедельник','В~торник','С~реда','Ч~етверг','П~ятница','С~уббота'];
  let brief=(k.notes||[]).concat(items.map(m=>m.t.replace(/\.$/,'')+(m.e?' ('+m.e.replace(/<[^>]+>/g,'')+')':''))); {let n=0;brief=brief.filter(x=>(n+=x.length+3)<(side2?430:620));}
  k.lead=lead; k.rep=paperReplies(lead);
  $('np-sheet').innerHTML=`<div class="top"><span>№ ${180+S.day} (${1034+S.day})</span><span>Е~жедневная г~азета · в~ыходит с 1990 г~ода</span><span>Ц~ена с~вободная</span></div>
    <div class="mast">С~ТОЛИЧНЫЙ В~ЕСТНИК</div><div class="rule"></div>
    <div class="date"><span>${WDN[d.getDay()]}, ${dateStr(S.day)} 1993 г~ода</span><span>М~осква</span></div>
    <div class="kick">${PAPER_K[lead.c]||lead.c.toUpperCase()}${S.phase===2?' · К~РИЗИС, Д~ЕНЬ '+(S.day-DECREE_DAY+1):''}</div>
    <div class="h1">${lead.h||paperHead(lead.t,58)}</div>
    <div class="lead"><div><canvas class="ph" id="np-ph" width="220" height="110"></canvas></div>
      <div class="txt"><p>${/^[А-ЯЁA-Z]/.test(lead.t)?`<span class="dc">${lead.t.charAt(0)}</span>${lead.t.slice(1)}`:lead.t}</p>${paperStamps(lead.e)}${side2?`<div class="s2"><div class="h2">${side2.h||paperHead(side2.t,44)}</div>${paperBody(side2,side2.h||paperHead(side2.t,44))}${paperStamps(side2.e)}</div>`:''}</div></div>
    <div class="cols">${cols.map(m=>`<div class="col">${m.kc?'<div class="kick" style="margin:0 0 4px">В К~РЕМЛЕ Н~ЕСПОКОЙНО</div>':''}<div class="h2">${m.h||paperHead(m.t,40)}</div>${paperBody(m,m.h||paperHead(m.t,40))}${paperStamps(m.e)}</div>`).join('')}</div>
    ${brief.length?`<div class="brief"><b>К~ОРОТКОЙ С~ТРОКОЙ</b> ${brief.join(' · ')}</div>`:''}`;
  paperPhoto(PAPER_PIC[lead.c]||(S.phase===2&&S.cordon?'whf':'wh'));
  const now={...snap(),hope:S.hope,rad:S.rad,city:S.city,pr:S.pr}, o=k.d0||now;
  const row=(nm,key,suf,inv)=>{const v=Math.round(now[key]*10)/10, dl=Math.round((now[key]-o[key])*10)/10; return `<div class="row"><span>${nm}</span><span><b>${fmt(v)}${suf||''}</b> ${dl?`<span class="${(dl>0)!==!!inv?'p':'n'}">${dl>0?'+':'−'}${fmt(Math.abs(dl))}</span>`:''}</span></div>`;};
  $('np-side').innerHTML=`<div class="day">У~ТРО · Д~ЕНЬ ${S.day}</div><div class="big">У~ТРЕННЯЯ Г~АЗЕТА</div>
    <div class="npw">С~егодня п~ервую п~олосу п~ишет п~ресса <b class="${ours?'v':''}">${ours?'з~а С~овет':'з~а К~ремль'}</b>. ${ours?'П~ока р~едакций у в~ас б~ольше, г~лавные н~овости в~аши.':'П~еретянете р~едакции в «Э~фире», и з~аголовки б~удут в~аши.'}</div>
    <div class="press"><i class="k" style="width:${kr/tot*100}%"></i><i class="n" style="width:${nu/tot*100}%"></i><i class="v" style="width:${vs/tot*100}%"></i></div>
    <div class="pl"><span>з~а К~ремль ${kr}</span><span>м~олчат ${nu}</span><span>з~а С~овет ${vs}</span></div>
    <div class="box"><div class="bt">И~ТОГИ Н~ОЧИ</div>${row('Л~егитимность','leg')}${row('Д~епутаты','dep')}${row('Л~юди','ppl')}${row('Э~фир','med')}${row('С~набжение','sup',' д~н.')}${row('Р~ешимость','hope','%')}${row('Р~адикализм','rad','%',1)}${row('М~осква з~а С~овет','city','%')}</div>
    <div class="bt" style="margin-top:10px;margin-bottom:0">О~ТВЕТ Н~А П~ЕРВУЮ П~ОЛОСУ</div>`+
    k.rep.map((r,i)=>{const st=r.req?r.req():true;return `<div class="ch${st!==true?' lock':''}" data-i="${i}"><span class="k">${i+1}</span><span>${r.t}</span><span class="e">${st!==true?`<span class="n">${st}</span>`:[fxText(r.fx),r.e2].filter(Boolean).join(' · ')||r.e||''}</span></div>`;}).join('')+
    `<div class="go" id="np-go"><span class="a">Н~АЧАТЬ Д~ЕНЬ ${S.day}</span><span class="b">ENTER</span></div>`;
  if(ST){const w=$('np-side').querySelector('.npw'); w.className='strk'; w.innerHTML=`<b>Г~ЛАВНЫЙ У~ДАР Е~ЛЬЦИНА Э~ТОЙ Н~ОЧЬЮ: ${ST.nm.toUpperCase()}</b>П~рикрыть: ${ST.guard}. И~наче у~дар б~удет т~яжёлым.${S.flags.shield?' К~омпромат в х~оду: у~дарит в~полсилы.':''}`;}
  $('np-side').querySelectorAll('.ch').forEach(e=>e.onclick=()=>paperGo(+e.dataset.i)); $('np-go').onclick=()=>paperGo(-1);
}
function paperGo(i){const k=S.kremlin; if(!k||screen!=='paper')return; const r=k.rep&&k.rep[i];
  if(r){if(r.req&&r.req()!==true)return; apply(r.fx); if(r.run)r.run(); if(r.fx&&Object.keys(r.fx).length)log('О~твет н~а п~ервую п~олосу: '+r.t.toLowerCase()+'.');}
  S.kremlin=null; S.paper=0; if(checkLose())return; startDay();}

function startDay(){
  if(S.phase===2&&S.pr>=100){S.queue=['assault'];}
  else{
    for(const e of EVENTS)if(e.day===S.day&&!S.fired[e.id]&&!S.queue.includes(e.id))S.queue.push(e.id);
    for(const e of EVENTS)if(e.cond&&!S.fired[e.id]&&!S.queue.includes(e.id)&&e.cond(S)){S.queue.push(e.id);break;}
    // a random situation most days, weighted by the state of things: no two games alike
    if(S.day>1&&S.day!==DECREE_DAY&&Math.random()<.7){const pool=EVENTS.filter(e=>e.rnd&&!S.fired[e.id]&&!S.queue.includes(e.id)&&inPh(e)).map(e=>({e,w:e.rnd(S)})).filter(o=>o.w>0);
      let r=Math.random()*pool.reduce((a,o)=>a+o.w,0); const pk=pool.find(o=>(r-=o.w)<0); if(pk)S.queue.push(pk.e.id);}
  }
  // через день приходит фракция (самая довольная или самая злая), через день — одна из сил на карте
  if(!(S.phase===2&&S.pr>=100)&&S.day>=3&&S.day!==DECREE_DAY&&S.queue.length<2){S.fev=S.fev||{}; let c;
    if(S.day%2===1){const L=FACTIONS.filter(F=>F.kind==='dep'&&S.fac[F.id].n>0); c=L.filter(F=>S.fac[F.id].loy>=7).map(F=>'fg_'+F.id).concat(L.filter(F=>S.fac[F.id].loy<=4).map(F=>'fb_'+F.id));}
    else c=['mer','mo','gs','mvd','smo'].map(p=>{const sd=tugSide(S.pts[p]);return sd?'pf_'+p+'_'+(sd==='vs'?'v':'k'):'';});
    c=c.filter(x=>x&&(S.fev[x]||0)<2&&!S.queue.includes(x)&&EVENTS.some(e=>e.id===x)); const id=c[Math.floor(Math.random()*c.length)];
    if(id){S.fev[id]=(S.fev[id]||0)+1;S.queue.push(id);}}
  save(); nextEvent();
}
function afterLoad(){ S.did=S.did||{}; if(S.omon==null)S.omon=100;
  if(S.phase===3&&S.A){show('assault');renderAssault();if(S.A.card==='inc')incidentCard();else if(S.A.card==='muster')musterCard();else if(S.A.card==='fin')finale(S.A.finId,S.A.finWhy);else if(S.A.card)alphaCard();return;}
  if(S.paper&&S.kremlin)return showPaper();
  if(S.queue.length)nextEvent(); else{showMain();showToast();} }
function nextEvent(){
  if(!S.queue.length){save();showMain();showToast();return;}
  const id=S.queue[0];
  showEvent(id==='assault'?ASSAULT():EVENTS.find(e=>e.id===id));
}

// ================= EVENT SCREEN =================
let evCur=null, evSel=0;
// ===== заставка «Останкино»: ночь 3 октября, башня, телецентр, толпа, грузовик у входа, БТР, трассеры. Рисуется попиксельно в 320x360 =====
function drawOstankino(c){
  const W=320,H=360, im=c.createImageData(W,H), D=im.data;
  let seed=1993; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0; return seed/4294967296;};
  const hash=(x,y)=>{let h=(x*374761393+y*668265263)>>>0; h=((h^(h>>>13))*1274126177)>>>0; return ((h^(h>>>16))>>>0)/4294967296;};
  const B4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5], bay=(x,y)=>(B4[(y&3)*4+(x&3)]+.5)/16;
  const set=(x,y,r,g,b)=>{x|=0;y|=0; if(x<0||y<0||x>=W||y>=H)return; const i=(y*W+x)*4; D[i]=r;D[i+1]=g;D[i+2]=b;D[i+3]=255;};
  const get=(x,y)=>{const i=((y|0)*W+(x|0))*4; return [D[i],D[i+1],D[i+2]];};
  const P=(x,y,col)=>set(x,y,col[0],col[1],col[2]);
  const R=(x,y,w,h,col)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)P(x+i,y+j,col);};
  const add=(x,y,r,g,b,k)=>{x|=0;y|=0; if(x<0||y<0||x>=W||y>=H)return; const i=(y*W+x)*4; D[i]=Math.min(255,D[i]+r*k);D[i+1]=Math.min(255,D[i+1]+g*k);D[i+2]=Math.min(255,D[i+2]+b*k);};
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  const noise=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,s=t=>t*t*(3-2*t),a=hash(xi,yi),b=hash(xi+1,yi),cc=hash(xi,yi+1),d=hash(xi+1,yi+1); return a+(b-a)*s(fx)+(cc-a)*s(fy)+(a-b-cc+d)*s(fx)*s(fy);};
  const fbm=(x,y)=>noise(x,y)*.55+noise(x*2.1,y*2.1)*.3+noise(x*4.3,y*4.3)*.15;
  const glow=(cx,cy,rad,r,g,b,k)=>{for(let y=-rad;y<=rad;y++)for(let x=-rad;x<=rad;x++){const d=Math.sqrt(x*x+y*y)/rad; if(d>=1)continue; const v=(1-d)*(1-d); if(v>bay(cx+x,cy+y)*.9)add(cx+x,cy+y,r,g,b,k*(.35+v*.65));}};
  const HOR=262;
  // --- небо: ступенчатый градиент с дизерингом, зарево у горизонта слева (пожар у входа)
  const SKY=[[7,8,16],[9,11,21],[12,14,26],[16,17,30],[22,20,33],[30,23,34],[40,27,33],[54,33,32]];
  for(let y=0;y<HOR;y++)for(let x=0;x<W;x++){ let t=Math.pow(y/HOR,1.7)*6.2+Math.max(0,1-Math.hypot(x-70,y-250)/170)*1.6; t+=bay(x,y)-.5; const k=Math.max(0,Math.min(SKY.length-1,Math.round(t))); P(x,y,SKY[k]); }
  // звёзды
  for(let i=0;i<70;i++){const x=(rnd()*W)|0,y=(rnd()*170)|0,b=rnd(); P(x,y,b>.85?[190,198,226]:b>.5?[96,106,140]:[52,60,88]);}
  // дым: тянется от входа вверх и вправо
  for(let y=40;y<HOR;y++)for(let x=0;x<W;x++){ const u=(x-104-(HOR-y)*.42)/(26+(HOR-y)*.5), band=Math.exp(-u*u*2.6)*Math.min(1,y/70); const n=fbm(x*.035+3,y*.05+7)*band;
    if(n>.30+bay(x,y)*.10){const hot=Math.max(0,1-(HOR-y)/90); P(x,y,mix(n>.46?[40,36,44]:[26,25,34],[92,50,36],hot*.55));} }
  // --- башня (вдали, правее центра)
  const TX=222, wAt=y=>y<22?1:y<44?2:y<68?3:y<92?5:y<100?7:y<104?9:y<110?13:y<120?16:y<124?12:y<232?7.5+(y-124)*.055:13.5+Math.pow((y-232)/30,1.8)*30;
  const TC=[[104,110,130],[72,78,98],[46,50,68],[30,33,46]];
  for(let y=6;y<HOR;y++){ const w=wAt(y), x0=Math.round(TX-w/2), x1=Math.round(TX+w/2);
    for(let x=x0;x<Math.max(x1,x0+1);x++){ const u=(x-x0+.5)/Math.max(1,x1-x0); let k=u<.22?0:u<.5?1:u<.8?2:3; if(k<3&&bay(x,y)<((u*4)%1)*.5)k++;
      let col=TC[k]; if(y<92){ col=((y/9)|0)%2?[150,58,52]:[168,170,180]; if(u>.5)col=mix(col,[20,20,30],.45); }
      P(x,y,col); } }
  // кольцевые балконы и вертикальные ряды окон ствола
  for(const y of [140,158,176,194,212]){const w=wAt(y)+4; for(let x=Math.round(TX-w/2);x<Math.round(TX+w/2);x++){P(x,y,[120,126,146]);P(x,y+1,[26,28,40]);}}
  for(let y=126;y<230;y+=3){P(TX-1,y,[24,26,38]); if(hash(7,y)>.8)P(TX-1,y,[226,190,110]);}
  // главный блок: смотровая и ресторан, свет в окнах
  for(let x=TX-8;x<TX+8;x++){P(x,110,[132,138,158]); if((x+TX)%2)P(x,113,hash(x,3)>.3?[236,204,124]:[40,44,60]); P(x,116,[28,30,42]); if(x%2)P(x,117,hash(x,9)>.5?[214,170,96]:[36,40,54]); P(x,119,[22,24,34]);}
  for(let x=TX-6;x<TX+7;x++)P(x,104,[120,126,146]);
  // арки основания
  for(const ax of [-12,-5,3,10]){for(let y=250;y<HOR;y++){const hw=y<253?1:2; for(let x=-hw;x<=hw;x++)P(TX+ax+x,y,[10,11,18]);}}
  // красные огни
  for(const [x,y] of [[TX,6],[TX-1,44],[TX+1,68],[TX-3,92],[TX+3,92],[TX-8,110],[TX+7,110],[TX-5,176],[TX+5,176]]){glow(x,y,5,120,20,14,1);P(x,y,[255,96,72]);}
  // --- дальний план: деревья парка и дома за прудом
  for(let x=0;x<W;x++){ const h=6+fbm(x*.09,1)*16+(hash(x,77)>.7?2:0); for(let y=HOR-h;y<HOR;y++){const e=y-(HOR-h); P(x,y,e<2&&hash(x,y)>.5?[22,26,24]:[11,14,15]);} }
  for(const [x,w,h] of [[250,26,20],[284,36,28],[204,14,12]]){R(x,HOR-h-4,w,h,[18,20,28]); for(let j=2;j<h-2;j+=3)for(let i=2;i<w-1;i+=3)if(hash(x+i,j)>.72)P(x+i,HOR-h-4+j,[198,160,90]);}
  // --- земля: асфальт улицы Королёва
  for(let y=HOR;y<H;y++)for(let x=0;x<W;x++){ const n=hash(x,y), d=(y-HOR)/(H-HOR); let col=n>.93?[30,30,36]:n<.12?[11,12,16]:[18,19,24]; if(bay(x,y)<d*.35)col=[13,14,18]; P(x,y,col); }
  for(let x=0;x<W;x++){P(x,296-(x*.02|0),[40,40,46]); if(((x+4)/14|0)%2)P(x,318,[58,56,54]);}
  // отражения окон и огня на мокром асфальте
  for(let x=0;x<196;x++){const h1=hash((x/6)|0,41); if(h1>.72)for(let y=294;y<294+10+h1*14;y++)if(bay(x,y)<.34*(1-(y-294)/26))add(x,y,40,30,14,1);}
  // --- телецентр: длинный стеклянный фасад в перспективе (ближний край слева)
  const FX=196, top=x=>198+x*.105, bot=x=>292-x*.04;
  for(let x=0;x<FX;x++){ const t=top(x), b=bot(x), hh=b-t, sc=1-x/FX*.34, cell=x/(7.2*sc)|0, inCell=(x/(7.2*sc))%1;
    for(let y=Math.floor(t);y<b;y++){ const v=(y-t)/hh; let col;
      if(v<.04)col=[96,102,122]; else if(v<.07)col=[28,30,42];
      else if(v<.66){ const f=(v-.07)/.59*5, fl=f|0, fv=f%1; // пять этажей ленточного остекления
        if(fv<.34)col=bay(x,y)<.5?[58,62,78]:[50,54,70];
        else if(inCell<.14)col=[22,24,34];
        else{ const h1=hash(cell,fl+11); col=h1>.80?(fv<.5?[250,222,150]:[226,186,108]):h1>.70?[112,146,190]:h1>.62?[120,92,54]:(fv<.48?[30,36,52]:[15,18,28]); if(h1<=.62&&hash(x,y)>.94)col=[44,52,74]; } }
      else if(v<.70)col=[104,108,126];
      else{ const pc=(x/(11*sc))%1; // двухсветный вестибюль: пилоны и витражи
        if(pc<.2)col=v<.74?[120,124,140]:[84,88,104]; else { const h2=hash((x/(11*sc))|0,5); col=h2>.55?[188,150,84]:h2>.4?[92,76,50]:[16,19,29]; if(((y-t)|0)%7===0)col=[30,32,44]; if(v>.95)col=[40,42,54]; } }
      P(x,y,col); } }
  for(let x=FX;x<FX+12;x++){const t=top(FX)+(x-FX)*.5,b=bot(FX)-(x-FX)*.3; for(let y=t|0;y<b;y++)P(x,y,(y-t)<2?[60,64,80]:hash(x,y)>.9?[30,33,46]:[22,24,35]);}
  // вспышки выстрелов в окнах верхних этажей
  const FL=[[38,214],[86,221],[131,226],[160,231]]; for(const [x,y] of FL){glow(x,y,6,255,200,110,.9);R(x-1,y-1,3,3,[255,244,200]);P(x-2,y,[255,214,130]);P(x+2,y,[255,214,130]);}
  // --- пролом у входа: огонь и грузовик, застрявший в дверях
  const EX=104, EY=bot(EX)|0;
  for(let y=EY-26;y<EY;y++)for(let x=EX-13;x<EX+14;x++){const d=Math.hypot((x-EX)/13,(y-EY+6)/22), n=fbm(x*.3,y*.3+2); if(d<1){const v=1-d+n*.35-.2; P(x,y,v>.75?[255,236,170]:v>.55?[250,176,70]:v>.35?[206,96,36]:[92,36,24]);}}
  for(let i=0;i<26;i++){const x=EX-12+rnd()*26,y=EY-30-rnd()*46; if(rnd()>.4)P(x,y,rnd()>.5?[255,170,70]:[200,90,40]);}
  glow(EX,EY-12,46,150,74,22,.55);
  // грузовик (вид сзади-сбоку): тент, кузов, кабина ушла в проём
  {const x=EX-11,y=EY-17; R(x,y,24,11,[58,66,46]); R(x,y,24,2,[92,100,70]); for(let i=0;i<24;i+=5)R(x+i,y+2,1,9,[44,50,36]); R(x,y+11,24,5,[36,40,30]); R(x,y+11,24,1,[70,74,54]); R(x+24,y+3,6,10,[40,46,34]); R(x+25,y+5,4,3,[240,170,70]);
   R(x+2,y+15,6,5,[8,8,10]);R(x+15,y+15,6,5,[8,8,10]);P(x+4,y+17,[60,60,60]);P(x+17,y+17,[60,60,60]); P(x,y+12,[220,40,30]);P(x+1,y+12,[220,40,30]); for(let i=0;i<24;i++)if(hash(i,3)>.6)P(x+i,y,[150,120,70]);}
  // --- фонари
  for(const [x,y0] of [[22,246],[168,252],[300,250]]){ R(x,y0,1,300-y0,[40,42,50]); R(x,y0,5,1,[40,42,50]); P(x+5,y0+1,[255,236,180]);P(x+4,y0+1,[255,214,140]); glow(x+5,y0+2,13,120,96,50,.7);
    for(let y=292;y<312;y++)for(let i=-16;i<=16;i++){const d=Math.hypot(i/16,(y-302)/9); if(d<1&&bay(x+i,y)<(1-d)*.8)add(x+5+i,y,26,20,10,1);} }
  // --- БТР справа: корпус, башенка, колёса, фара
  {const x=236,y=288; for(let j=0;j<12;j++){const ind=j<4?4-j:j>8?(j-8)*2:0; R(x+ind,y+j,58-ind*2+(j<4?0:2),1,j<1?[84,92,66]:j<5?[58,66,46]:[40,46,34]);}
   R(x+20,y-6,14,6,[52,60,42]);R(x+20,y-6,14,1,[86,94,68]);R(x+4,y-4,17,1,[70,76,58]);R(x+4,y-3,3,1,[30,32,26]);
   for(const wx of [6,19,33,46]){R(x+wx,y+10,8,7,[7,7,9]);R(x+wx+2,y+12,4,3,[34,34,36]);P(x+wx+3,y+13,[70,70,70]);}
   for(let i=8;i<52;i+=9)P(x+i,y+3,[30,34,26]); R(x+1,y+5,2,2,[255,240,190]); glow(x+1,y+6,12,150,130,80,.8);
   for(let i=1;i<60;i++){const hw=i*.16; for(let j=-hw;j<=hw;j++)if(bay(x-i,y+8+(i*.22|0)+(j|0))<.5*(1-i/60))add(x-i,y+8+i*.22+j,40,34,18,1);}
   glow(x+2,y-4,7,255,190,100,.9);R(x+1,y-5,3,3,[255,246,206]);}
  // --- трассеры: из окон и от БТР по площади
  const tr=(x1,y1,x2,y2)=>{const n=Math.max(Math.abs(x2-x1),Math.abs(y2-y1)); for(let i=0;i<=n;i++){const t=i/n,x=x1+(x2-x1)*t,y=y1+(y2-y1)*t,ph=i%9; if(ph<5){P(x,y,ph<1?[255,250,220]:[255,206,110]); add(x,y+1,90,46,10,.6);add(x,y-1,90,46,10,.4);} } };
  tr(40,216,150,318); tr(88,223,214,330); tr(162,233,96,320); tr(238,284,120,300);
  // --- толпа: дальний ряд (мелкие фигуры) и ближний (крупнее), отсвет огня слева
  const man=(x,y,s,lit)=>{ const b=[[24,26,34],[34,30,30],[26,34,30],[40,36,32],[20,22,30]][(hash(x,y)*5)|0], sk=lit?[150,104,70]:[62,52,48], rim=lit?[176,112,56]:[52,54,66];
    if(s===1){ P(x,y,sk);P(x+1,y,sk); R(x,y+1,2,4,b); P(x,y+1,rim); P(x,y+5,[10,10,12]);P(x+1,y+5,[10,10,12]); }
    else{ R(x+1,y,2,2,sk); R(x,y+2,4,6,b); R(x,y+2,1,6,rim); R(x,y+8,1,4,[10,10,13]);R(x+3,y+8,1,4,[10,10,13]); if(hash(x,y+1)>.6){P(x-1,y+3,b);P(x+4,y+3,b);} } };
  for(let i=0;i<64;i++){const x=4+rnd()*226,y=297+rnd()*10; man(x|0,y|0,1,Math.abs(x-EX)<60&&rnd()>.3);}
  // лежащие у входа
  for(const [x,y] of [[62,304],[140,308],[178,313]]){R(x,y,6,2,[26,26,32]);P(x+6,y,[70,56,50]);}
  // флаги: красный, имперский чёрно-жёлто-белый, красный
  const flag=(x,y,rows)=>{R(x,y,1,16,[70,66,60]); rows.forEach((cc,j)=>{for(let i=1;i<9;i++)P(x+i,y+j+((i/3)|0)%2,cc);});};
  flag(58,318,[[178,40,36],[178,40,36],[150,30,30],[150,30,30],[120,24,26]]);
  flag(126,322,[[20,20,22],[20,20,22],[214,170,50],[214,170,50],[214,210,200],[214,210,200]]);
  flag(206,320,[[170,36,34],[170,36,34],[140,28,30],[140,28,30],[116,22,26]]);
  for(let i=0;i<46;i++){const x=rnd()*312,y=322+rnd()*26; man(x|0,y|0,2,x<170&&rnd()>.45);}
  // лёгкое затемнение краёв
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot((x-W/2)/(W*.72),(y-H*.5)/(H*.72)); if(d>.62){const k=Math.max(.55,1-(d-.62)*1.1),i=(y*W+x)*4; D[i]*=k;D[i+1]*=k;D[i+2]*=k;}}
  c.putImageData(im,0,0);
}
// ===== заставка «Танки бьют по Белому дому»: Новоарбатский мост, выстрел, попадание в верхние этажи. Фон — утверждённый рисунок горящего Белого дома =====
function drawTankShot(c){
  const W=320,H=360; c.drawImage(TitleArt.calm,292,0,W,H,0,0,W,H);
  const im=c.getImageData(0,0,W,H), D=im.data;
  let seed=4101993; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0; return seed/4294967296;};
  const hash=(x,y)=>{let h=((x|0)*374761393+(y|0)*668265263)>>>0; h=((h^(h>>>13))*1274126177)>>>0; return ((h^(h>>>16))>>>0)/4294967296;};
  const B4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5], bay=(x,y)=>(B4[(y&3)*4+(x&3)]+.5)/16;
  const P=(x,y,col)=>{x|=0;y|=0; if(x<0||y<0||x>=W||y>=H)return; const i=(y*W+x)*4; D[i]=col[0];D[i+1]=col[1];D[i+2]=col[2];D[i+3]=255;};
  const R=(x,y,w,h,col)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)P(x+i,y+j,col);};
  const add=(x,y,r,g,b,k)=>{x|=0;y|=0; if(x<0||y<0||x>=W||y>=H)return; const i=(y*W+x)*4; D[i]=Math.min(255,D[i]+r*k);D[i+1]=Math.min(255,D[i+1]+g*k);D[i+2]=Math.min(255,D[i+2]+b*k);};
  const dark=(x,y,k)=>{x|=0;y|=0; if(x<0||y<0||x>=W||y>=H)return; const i=(y*W+x)*4; D[i]*=k;D[i+1]*=k;D[i+2]*=k;};
  const noise=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,s=t=>t*t*(3-2*t),a=hash(xi,yi),b=hash(xi+1,yi),cc=hash(xi,yi+1),d=hash(xi+1,yi+1); return a+(b-a)*s(fx)+(cc-a)*s(fy)+(a-b-cc+d)*s(fx)*s(fy);};
  const fbm=(x,y)=>noise(x,y)*.55+noise(x*2.1,y*2.1)*.3+noise(x*4.3,y*4.3)*.15;
  const glow=(cx,cy,rad,r,g,b,k)=>{for(let y=-rad;y<=rad;y++)for(let x=-rad;x<=rad;x++){const d=Math.sqrt(x*x+y*y)/rad; if(d>=1)continue; const v=(1-d)*(1-d); if(v>bay(cx+x,cy+y)*.9)add(cx+x,cy+y,r,g,b,k*(.35+v*.65));}};
  const blob=(cx,cy,rx,ry,pal,sx,sy,thr)=>{for(let y=-ry;y<=ry;y++)for(let x=-rx;x<=rx;x++){const d=Math.hypot(x/rx,y/ry), n=fbm((cx+x)*sx+5,(cy+y)*sy+9), v=1-d+(n-.5)*.9; if(v>thr+bay(cx+x,cy+y)*.12){const k=Math.min(pal.length-1,((v-thr)*pal.length*1.5)|0); P(cx+x,cy+y,pal[k]);}}};
  // проекция: танк стоит кормой к зрителю, носом и стволом к зданию (вид сзади-сбоку и чуть сверху)
  const deck=x=>262-x*.02, KM=24, YA=35*Math.PI/180, PT=17*Math.PI/180, CX0=226, CY0=318;
  const FV=[-Math.sin(YA)*KM,-Math.cos(YA)*Math.sin(PT)*KM], RV=[Math.cos(YA)*KM,-Math.sin(YA)*Math.sin(PT)*KM], UV=[0,-Math.cos(PT)*KM];
  const pr=(x,y,z)=>[CX0+x*RV[0]+y*FV[0]+z*UV[0], CY0+x*RV[1]+y*FV[1]+z*UV[1]]; // x вправо, y вперёд, z вверх (метры)
  const EL=16*Math.PI/180, bdir=[0,Math.cos(EL),Math.sin(EL)], B0=[0,1.7,1.62], BL=5.3;
  const [BX,BY]=pr(B0[0],B0[1],B0[2]), [MX,MY]=pr(B0[0],B0[1]+bdir[1]*BL,B0[2]+bdir[2]*BL);
  const dl=Math.hypot(MX-BX,MY-BY), HX=Math.round(MX+(MX-BX)/dl*100), HY=Math.round(MY+(MY-BY)/dl*100);
  // --- попадание: копоть на верхних этажах, шар разрыва, обломки, столб дыма
  for(let y=-30;y<=16;y++)for(let x=-30;x<=30;x++){const d=Math.hypot(x/30,(y+8)/22), n=fbm((HX+x)*.09,(HY+y)*.11); const v=1-d+(n-.5)*.7; if(v>.12){const k=Math.max(.28,1-v*1.15); if(bay(HX+x,HY+y)<Math.min(1,v*2.4))dark(HX+x,HY+y,k);}}
  blob(HX+5,HY-44,20,36,[[34,32,36],[48,44,48],[66,60,62],[88,78,76]],.06,.045,.16);
  blob(HX+18,HY-86,28,22,[[30,29,34],[42,40,44],[58,54,58]],.05,.05,.20);
  blob(HX,HY-4,15,12,[[120,44,24],[196,84,30],[244,150,54],[255,214,120],[255,246,214]],.22,.22,.22);
  glow(HX,HY-4,30,160,84,26,.6);
  for(const [fx,fy] of [[HX+17,HY+9],[HX-13,HY+13]]){R(fx,fy,3,4,[236,120,40]);R(fx,fy+1,2,3,[255,208,110]);P(fx+1,fy-1,[250,160,60]);P(fx+1,fy-2,[200,90,36]);glow(fx+1,fy+1,7,150,70,20,.6);}
  for(let i=0;i<34;i++){const a=rnd()*6.283, r=10+rnd()*22, x=HX+Math.cos(a)*r*1.2, y=HY-6+Math.sin(a)*r*.9-rnd()*10, t=rnd(); P(x,y,t>.6?[255,196,96]:t>.3?[214,208,196]:[40,36,36]); if(t>.8)P(x+1,y,[255,236,170]);}
  for(let i=0;i<14;i++){const x=HX-30+rnd()*60, y0=HY+8+rnd()*10, len=6+rnd()*22; for(let j=0;j<len;j++)if(hash(x,y0+j)>.35)P(x+((j/7)|0)%2,y0+j,[206,200,188]);}
  // --- настил моста на переднем плане и перила у дальнего края
  for(let x=0;x<W;x++){ const d=deck(x)|0; for(let y=d;y<H;y++){const n=hash(x,y), v=(y-d)/(H-d); let col=n>.94?[40,40,46]:n<.1?[12,13,16]:[22,23,28]; if(y-d<2)col=[70,70,76]; else if(bay(x,y)<v*.4)col=[15,16,20]; P(x,y,col);}
    const ry=d-13; P(x,ry,[82,84,92]);P(x,ry+1,[30,31,38]); P(x,ry+6,[54,56,64]); if(x%13===4){for(let y=ry;y<d;y++){P(x,y,[74,76,84]);P(x+1,y,[34,35,42]);}} }
  for(let x=0;x<W;x+=1)if(((x+6)/18|0)%2)P(x,352-(x*.04|0),[70,68,62]);
  // фонарь моста
  {const x=22,d=deck(x)|0; R(x,d-78,2,78,[52,54,62]); R(x-8,d-78,18,2,[52,54,62]); R(x-9,d-76,4,2,[30,31,38]);R(x+7,d-76,4,2,[30,31,38]);}
  // --- танк Т-80 на мосту: коробки корпуса, гусениц и башни в проекции, грани с разным светом
  const OL=[[112,122,86],[84,94,64],[60,70,47],[42,50,35],[26,31,24]];
  const mixc=(a,b)=>[(a[0]+b[0])>>1,(a[1]+b[1])>>1,(a[2]+b[2])>>1];
  const poly=(pts,f)=>{let y0=1e9,y1=-1e9; for(const p of pts){y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);} for(let y=Math.round(y0);y<=Math.round(y1);y++){let xs=[]; for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length]; if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));} if(xs.length<2)continue; xs.sort((p,q)=>p-q); for(let x=Math.round(xs[0]);x<=Math.round(xs[xs.length-1]);x++)P(x,y,typeof f==='function'?f(x,y):f);}};
  const line=(x1,y1,x2,y2,th,col,hi,lo)=>{const n=Math.max(Math.abs(x2-x1),Math.abs(y2-y1))*2; for(let i=0;i<=n;i++){const t=i/n,x=x1+(x2-x1)*t,y=y1+(y2-y1)*t; for(let k=0;k<th;k++)P(x,y+k,k===0?hi:k>=th-1?lo:k<th*.45?mixc(hi,col):col);}};
  const edge=(a,b,col)=>line(a[0],a[1],b[0],b[1],1,col,col,col);
  // коробка: видны верх, корма и левый борт
  const box=(x0,x1,y0,y1,z0,z1,ct,cr,cs)=>{ const p=(x,y,z)=>pr(x,y,z);
    poly([p(x0,y0,z0),p(x1,y0,z0),p(x1,y0,z1),p(x0,y0,z1)],cr); poly([p(x0,y0,z0),p(x0,y1,z0),p(x0,y1,z1),p(x0,y0,z1)],cs); poly([p(x0,y0,z1),p(x1,y0,z1),p(x1,y1,z1),p(x0,y1,z1)],ct);
    edge(p(x0,y0,z1),p(x1,y0,z1),OL[0]); edge(p(x0,y0,z1),p(x0,y1,z1),OL[0]); edge(p(x0,y0,z0),p(x0,y0,z1),OL[4]); };
  const tex=(c,k)=>(x,y)=>hash(x,y)>.9?mixc(c,OL[4]):bay(x,y)<k?mixc(c,OL[3]):c;
  // тень под танком
  poly([pr(-2,-3.9,0),pr(2.1,-3.9,0),pr(2.1,3.7,0),pr(-2,3.7,0)],(x,y)=>bay(x,y)<.7?[10,11,14]:[18,19,24]);
  // гусеницы
  for(const sx of [1,-1]){ const a=sx<0?-1.75:1.05, b=sx<0?-1.05:1.75; box(a,b,-3.5,3.5,0,.9,[24,26,26],(x,y)=>(y%3===0)?[40,42,42]:[14,15,16],[16,17,18]); }
  // катки по левому борту
  for(let i=0;i<6;i++){const wy=-2.75+i*1.1; for(let t=0;t<360;t+=6)for(let r=0;r<=.36;r+=.06){const [x,y]=pr(-1.77,wy+Math.cos(t*Math.PI/180)*r*1.15,.44+Math.sin(t*Math.PI/180)*r*1.15); P(x,y,r<.08?[96,100,88]:r<.14?[28,32,28]:r<.3?[52,60,46]:[20,22,20]);}}
  // корпус с надгусеничными полками, корма с решёткой и бочками
  box(-1.75,1.75,-3.35,3.2,.74,1.26,tex(OL[2],.2),tex(OL[4],.3),tex(OL[3],.25));
  for(let i=0;i<5;i++){const [a1,b1]=pr(-1.3+i*.62,-3.36,.82),[a2,b2]=pr(-1.3+i*.62,-3.36,1.02); line(a1,b1,a2,b2,1,OL[4],OL[4],OL[4]);}
  for(const dx of [-1.25,.12]){box(dx,dx+1.13,-3.95,-3.4,1.0,1.56,tex(OL[1],.15),tex(OL[3],.25),tex(OL[2],.2)); const [a1,b1]=pr(dx+.56,-3.96,1.0),[a2,b2]=pr(dx+.56,-3.96,1.56); line(a1,b1,a2,b2,1,OL[4],OL[4],OL[4]);}
  {const [a,b]=pr(-1.5,-3.36,.9); R(a|0,b|0,2,2,[200,40,30]); const [a2,b2]=pr(1.5,-3.36,.9); R(a2|0,b2|0,2,2,[200,40,30]);}
  for(let i=0;i<6;i++){const [a,b]=pr(-1.76,-2.6+i*1.05,1.24),[a2,b2]=pr(-1.76,-2.6+i*1.05,.8); line(a,b,a2,b2,1,OL[4],OL[4],OL[4]);}
  // ствол (рисуется до башни: его основание закрыто башней)
  line(BX,BY-1,MX,MY-1,4,OL[2],OL[0],OL[4]);
  line(BX+(MX-BX)*.48,BY+(MY-BY)*.48-2,BX+(MX-BX)*.62,BY+(MY-BY)*.62-2,6,OL[2],OL[0],OL[4]);
  line(MX+2,MY,MX-1,MY-2,5,OL[3],OL[1],OL[4]);
  // башня, ящик ЗИП на корме башни, башенка командира, пулемёт, антенна
  box(-1.35,1.35,-1.1,1.75,1.26,1.98,tex(OL[1],.12),tex(OL[3],.25),tex(OL[2],.18));
  box(-1.05,1.05,-1.45,-1.1,1.36,1.76,tex(OL[1],.1),tex(OL[3],.2),tex(OL[2],.2));
  box(.35,.95,-.25,.4,1.98,2.24,OL[0],OL[3],OL[2]);
  {const [a,b]=pr(.65,.1,2.28),[a2,b2]=pr(.5,1.2,2.5); line(a,b,a2,b2,2,[34,36,34],[66,68,62],[20,22,20]); const [h1,h2]=pr(-.6,.2,1.76); for(let t=0;t<360;t+=10)for(let r=.18;r<=.3;r+=.06){const [x,y]=pr(-.6+Math.cos(t*Math.PI/180)*r,.2+Math.sin(t*Math.PI/180)*r,1.99); P(x,y,OL[3]);}}
  {const [a,b]=pr(-1.1,-.8,1.98); R(a|0,(b|0)-34,1,34,[74,76,72]);}
  // отсвет выстрела на передних кромках
  for(let y=0;y<H;y++)for(let x=120;x<300;x++){const d=Math.hypot(x-MX,y-MY); if(d<120&&y>MY+10&&bay(x,y)<(1-d/120)*.4){const i=(y*W+x)*4; if(D[i+1]>D[i+2]+8&&D[i+1]>D[i]-2)add(x,y,64,40,8,1);}}
  // --- выстрел: пламя из ствола и пороховой дым
  const ang=Math.atan2(MY-BY,MX-BX), ux=Math.cos(ang), uy=Math.sin(ang);
  blob(MX+ux*20,MY+uy*20-10,24,15,[[52,48,48],[78,72,70],[108,100,94],[146,136,124]],.09,.11,.30);
  blob(MX+2,MY+16,18,9,[[60,56,54],[92,86,80]],.12,.14,.34);
  for(let i=0;i<34;i++){const w=i<7?3+i*1.0:Math.max(0,9-(i-7)*.34); for(let k=-w;k<=w;k+=.5){const x=MX+ux*i-uy*k, y=MY+uy*i+ux*k, a=Math.abs(k)/(w+.01); P(x,y,a<.35?[255,250,224]:a<.7?[255,208,110]:[236,122,40]);}}
  for(const sd of [-1,1])for(let i=0;i<18;i++)for(let t=0;t<2;t++){const x=MX+ux*4-uy*sd*i*1.1+ux*i*.3+t, y=MY+uy*4+ux*sd*i*1.1+uy*i*.3; P(x,y,i<8?[255,232,160]:[236,140,50]);}
  glow(MX+ux*10,MY+uy*10,40,190,120,40,.7);
  for(let i=34;i<80;i++){const x=MX+ux*i,y=MY+uy*i; if(i%8<5){P(x,y,[255,240,190]);P(x,y+1,[255,190,100]);add(x,y+2,90,50,14,.7);add(x,y-1,90,50,14,.5);}}
  for(let i=0;i<30;i++){const d=44+rnd()*40,k=(rnd()-.5)*30; P(MX+ux*d-uy*k,MY+uy*d+ux*k,rnd()>.5?[255,200,100]:[230,120,44]);}
  // пыль из-под гусениц
  
  // гильзы и осколки бетона на асфальте
  for(let i=0;i<24;i++){const x=rnd()*W,y=deck(x)+4+rnd()*(H-deck(x)-6); P(x,y,rnd()>.5?[150,126,60]:[92,90,88]);}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot((x-W/2)/(W*.72),(y-H*.5)/(H*.72)); if(d>.66){const k=Math.max(.6,1-(d-.66)*1.1),i=(y*W+x)*4; D[i]*=k;D[i+1]*=k;D[i+2]*=k;}}
  c.putImageData(im,0,0);
}
let _tankURL=null; function tankShotURL(){ if(!_tankURL){const cv=document.createElement('canvas');cv.width=320;cv.height=360;drawTankShot(cv.getContext('2d'));_tankURL=cv.toDataURL();} return _tankURL; }
function drawPhoto(pic){
  const c=$('ev-photo').getContext('2d'); c.fillStyle='#0b0c0f'; c.fillRect(0,0,320,360);
  if(pic!=='yeltsin'&&PEOPLE[pic]&&PEOPLE[pic].img){const P=PEOPLE[pic],im=new Image();c.imageSmoothingEnabled=false;im.onload=()=>c.drawImage(im,0,0,320,360);im.src=P.img;
    $('ev-cap-n').textContent=P.nm.toUpperCase();$('ev-cap-r').textContent=P.role.charAt(0).toUpperCase()+P.role.slice(1);}
  else if(pic==='yeltsin'){const im=new Image();im.onload=()=>c.drawImage(im,0,0);im.src=ASSET_YELTSIN;
    $('ev-cap-n').textContent='Б~ОРИС Е~ЛЬЦИН';$('ev-cap-r').textContent='П~резидент Р~оссийской Ф~едерации';}
  else if(pic==='tank'){ TitleArt.onReady(()=>drawTankShot(c));
    $('ev-cap-n').textContent='Н~ОВОАРБАТСКИЙ М~ОСТ';$('ev-cap-r').textContent='Т~анки б~ьют п~о Б~елому д~ому';}
  else if(pic==='ost'){ drawOstankino(c);
    $('ev-cap-n').textContent='О~СТАНКИНО';$('ev-cap-r').textContent='Т~елецентр, у~лица А~кадемика К~оролёва, 12';}
  else{TitleArt.onReady(()=>c.drawImage(pic==='whf'?TitleArt.burning:TitleArt.calm,270,0,320,360,0,0,320,360));
    $('ev-cap-n').textContent='Б~ЕЛЫЙ Д~ОМ';$('ev-cap-r').textContent='Д~ом С~оветов, К~раснопресненская н~абережная';}
}
function showEvent(ev){
  evCur=ev; evSel=Math.max(0,ev.ch.findIndex(c=>!(c.req&&!c.req(S)))); show('event'); drawPhoto(ev.pic); Sfx.play(ev.end?(ev.win?'win':'lose'):ev.pic==='yeltsin'?'static':ev.urgent?'alarm':/grachev|kolesn|yerin/.test(ev.pic)?'phone':'paper');
  const tag=$('ev-tag'); tag.className='tag'+(ev.end?(ev.win?' win':' end'):''); tag.textContent=ev.end?(ev.win?'П~ОБЕДА':ev.tier==='neu'?'Н~ИЧЬЯ · К~РИЗИС Б~ЕЗ П~ОБЕДИТЕЛЯ':'П~ОРАЖЕНИЕ'):ev.tag||'С~ОБЫТИЕ';
  $('ev-hud').innerHTML=`<span>Д~ень <b>${S.day}</b></span><span>Л~егитимность <b>${S.leg}</b></span><span>Р~ешимость <b>${S.hope}%</b></span><span>Р~адикализм <b>${S.rad}%</b></span>`;
  $('ev-meta').textContent=(dateStr(S.day)+' 1993'+(ev.time?' · '+ev.time:'')).toUpperCase();
  $('ev-meta2').textContent=ev.urgent?'С~РОЧНО':'';
  $('ev-h').textContent=ev.h; $('ev-q').textContent=ev.q||''; $('ev-p').textContent=ev.p; $('ev-res').innerHTML='';
  renderChoices();
}
function renderChoices(){
  $('ev-ch').innerHTML=evCur.ch.map((c,i)=>{const fx=c.fx?fxText(merge(c.fx,c.fac?{fac:c.fac}:{})):'';
    let e=[fx,typeof c.e==='function'?c.e(S):c.e].filter(Boolean).join(' · ');
    const lk=c.req&&!c.req(S); if(lk)e='<span class="n">н~ужно: '+c.rq+'</span>'; else if(c.rq)e=[e,'<span class="p">о~ткрыто: '+c.rq+'</span>'].filter(Boolean).join(' · ');
    return `<div class="ch${i===evSel?' sel':''}${lk?' lock':''}" data-i="${i}"><span class="k">${i+1}</span><span>${c.t}</span>${e?`<span class="e">${e}</span>`:''}</div>`;}).join('');
  $('ev-ch').querySelectorAll('.ch').forEach(d=>{d.onmouseenter=()=>{evSel=+d.dataset.i;$('ev-ch').querySelectorAll('.ch').forEach((x,j)=>x.classList.toggle('sel',j===evSel));};
    d.onclick=()=>choose(+d.dataset.i);});
}
function choose(i){
  const ev=evCur, c=ev.ch[i]; if(!c)return; if(c.req&&!c.req(S))return;
  if(c.go)return c.go();
  S.queue.shift(); S.fired[ev.id]=1;
  if(ev.run)ev.run(S);
  apply(fxOf(c)); if(c.run)c.run(S);
  S.chron.push({date:dateStr(S.day),h:ev.h,ch:c.t}); store.set(CHRON,S.chron);
  log(ev.h.charAt(0)+ev.h.slice(1).toLowerCase()+': '+c.t.toLowerCase()+'.');
  if(checkLose())return;
  nextEvent();
}

// ---------- assault intro and endings ----------
function ASSAULT(){return {id:'assault',pic:unitStance(UNITS.find(u=>u.id==='tanks'))==='refuse'?'whf':'tank',time:'07:00',urgent:1,tag:'Ф~АЗА 3 · Ш~ТУРМ',h:'Ш~ТУРМ',q:'Т~анки н~а Н~овоарбатском м~осту',
  p:(S.flags.corner==='army'?'А~рмия у~ходит и~з-п~од К~ремля: М~инобороны и Г~енштаб п~очти о~ткрыто н~а с~тороне С~ъезда. Е~льцин п~онимает, ч~то з~автра ш~турмовать б~удет н~екем, и о~тдаёт п~риказ с~егодня, т~ем, к~то е~щё с~лушается. ':S.flags.corner==='elect'?'С~уд, р~егионы и г~ород т~ребуют в~ыборов. Е~льцин з~агнан в у~гол и р~ешает к~ончить д~ело с~илой, п~ока е~го п~риказы е~щё в~ыполняют. Ч~асти и~дут н~еохотно. ':'')+'Н~а р~ассвете к Б~елому д~ому в~ыдвинулась б~ронетехника. К~то и~з с~иловиков в~ыполнит п~риказ, а к~то о~ткажется — з~ависит о~т т~ого, с к~ем в~ы у~спели д~оговориться. О~борона и~дёт п~о ч~асам, д~о в~ечера.',
  ch:[
    {t:'К о~ружию! З~анять о~борону',e:`б~ойцов ${fmt(S.mil)} · б~езоружных ${fmt(S.ppl)} · б~аррикады ${S.bar}/5`,go:()=>startAssault()},
    {t:'В~ывести л~юдей п~од г~арантии',e:'д~епутаты с~даются б~ез б~оя',go:()=>ending('surrender')},
  ]};}
const ENDINGS={
  win_army:{win:1,pic:'wh',h:'А~РМИЯ С Н~АРОДОМ',q:'М~инистерство о~бороны и Г~енштаб п~оддержали С~ъезд',
    p:'К~омандующие о~кругами о~тказались в~ыполнять у~каз №1400. Ш~турмовать п~арламент н~екому: б~ез а~рмии К~ремлю н~ечем о~тветить. Е~льцин с~оглашается н~а д~осрочные в~ыборы п~резидента.'},
  win_elect:{win:1,pic:'whf',h:'В~ЫБОРЫ',q:'Ш~турм о~тбит, К~ремль о~тступил',
    p:'Е~льцин п~опробовал р~ешить д~ело с~илой и н~е с~мог. К~онституционный с~уд, с~оветы р~егионов и п~ресса е~дины: у~каз н~езаконен. К~ремль с~нимает б~локаду и с~оглашается н~а о~дновременные в~ыборы н~а у~словиях С~ъезда.'},
  elect_deal:{tier:'neu',pic:'wh',h:'Н~УЛЕВОЙ В~АРИАНТ',q:'В~ыборы в~место ш~турма',
    p:'Д~о с~трельбы н~е д~ошло. С~уд, р~егионы и п~ресса з~аставили о~бе с~тороны о~тступить: у~каз №1400 о~тменён, р~ешения С~ъезда т~оже, н~азначены о~дновременные в~ыборы. В~ерховный С~овет д~отянул д~о н~их, н~о э~то н~е п~обеда. Н~а в~ыборах у К~ремля т~елевидение, д~еньги и и~збиркомы, а н~овый з~акон о п~арламенте п~исали у~же б~ез в~ас. П~режней р~оли у В~ерховного С~овета б~ольше н~е б~удет.'},
  held:{win:1,pic:'whf',h:'У~СТОЯЛИ',q:'Ш~турм з~ахлебнулся',
    p:'Б~елый д~ом г~орит, н~о в~ходы у~держаны. К в~ечеру к з~данию с~текаются д~есятки т~ысяч м~осквичей. К~ремль о~бъявляет п~еремирие.'},
  held_iso:{tier:'neu',pic:'whf',h:'О~ТБИЛИСЬ, Н~О О~ДНИ',q:'Ш~турм о~тбит, п~ризнания н~ет',
    p:'В~ходы у~держаны, н~о с~трана в~идела п~о т~елевизору т~олько л~юдей с а~втоматами и с~лышала т~олько п~ризывы к р~асправе. Р~егионы м~олчат, З~апад г~оворит о м~ятеже, М~осква о~бходит н~абережную с~тороной. К~ремль о~твёл в~ойска и ж~дёт. С~ъезд с~идит в о~бгоревшем з~дании, к~оторое н~екому п~ризнать в~ластью. П~обеды н~ет н~и у к~ого.'},
  pyrrhic:{tier:'neu',pic:'whf',h:'П~ИРРОВА П~ОБЕДА К~РЕМЛЯ',q:'З~дание в~зято, в~ласть н~е у~держана',
    p:'Б~елый д~ом в~зят, н~о с~трана в~идела, к~ак р~асстреливают п~арламент. Ч~асть в~ойск н~е в~ыполнила п~риказ, р~егионы и К~онституционный с~уд у~каз н~е п~ризнают. Е~льцин с~идит в К~ремле и н~е м~ожет п~равить: е~го р~аспоряжения в~озвращаются н~еисполненными. В~переди м~есяцы д~воевластия и т~орга, в к~отором п~роиграли о~ба.'},
  draw_alpha:{tier:'neu',pic:'wh',h:'«А~ЛЬФА» Н~Е С~ТРЕЛЯЕТ',q:'С~пецназ о~тказался ш~турмовать и в~ывел л~юдей с~ам',
    p:'О~фицеры «А~льфы» в~ошли в з~дание б~ез о~ружия и с~казали п~ри к~амерах, ч~то п~риказа с~трелять п~о п~арламенту в~ыполнять н~е б~удут. Д~епутаты и з~ащитники в~ышли п~од и~х г~арантии. Б~елый д~ом п~отерян, н~о п~риказ п~резидента п~ублично н~е в~ыполнен е~го ж~е с~пецназом. К~омандовать Е~льцин б~ольше н~е м~ожет, и в~сем п~онятно, ч~ем б~ыл у~каз №1400. С~ъезда т~оже н~ет. С~трана в~ходит в д~олгий к~ризис б~ез п~обедителя.'},
  fell:{pic:'whf',h:'4 О~КТЯБРЯ',q:'Б~елый д~ом г~орит',
    p:'Ш~турмовые г~руппы в~орвались в з~дание. К в~ечеру з~ащитники в~ыходят п~од к~онвоем. В~ерховный С~овет п~ерестал с~уществовать.'},
  broken:{pic:'whf',h:'О~ГОНЬ П~РЕКРАЩЁН',q:'З~ащитники с~ложили о~ружие',
    p:'П~осле т~анкового о~бстрела д~ержаться б~ольше н~екому. И~з п~одъездов в~ыходят с б~елыми п~ростынями. С~ъезд р~аспущен.'},
  surrender:{pic:'wh',h:'К~АПИТУЛЯЦИЯ',q:'Д~епутаты в~ыходят и~з з~дания',
    p:'П~од г~арантии п~осредников з~ащитники с~дают о~ружие и в~ыходят к а~втобусам. К~рови м~еньше, н~о С~ъезда б~ольше н~ет.'},
  surrender_alpha:{pic:'whf',h:'П~ОД Г~АРАНТИИ «А~ЛЬФЫ»',q:'О~фицеры в~ывели л~юдей и~з г~орящего з~дания',
    p:'«А~льфа» о~тказалась ш~турмовать и с~ама в~ывела д~епутатов и з~ащитников ч~ерез о~цепление. К~рови м~огло б~ыть б~ольше. В~ерховного С~овета б~ольше н~ет.'},
  lose_hope:{pic:'wh',h:'Р~АЗОШЛИСЬ',q:'З~ащитники п~окинули б~аррикады',
    p:'Х~олод, г~олод и н~еизвестность с~делали с~воё. Б~елый д~ом п~устеет б~ез е~диного в~ыстрела. У~каз №1400 в~ступает в с~илу.'},
  lose_leg:{pic:'yeltsin',h:'С~ЪЕЗД Р~АСПАЛСЯ',q:'Н~икто б~ольше н~е в~ерит В~ерховному С~овету',
    p:'Р~егионы п~ризнали у~каз, д~епутаты с~дают м~андаты о~дин з~а д~ругим. К~ремлю д~аже н~е н~ужен ш~турм.'},
  lose_ppl:{pic:'wh',h:'П~УСТЫЕ Б~АРРИКАДЫ',q:'Б~елый д~ом н~екому з~ащищать',
    p:'П~оследние д~обровольцы у~шли. Н~очью О~МОН с~покойно з~анимает з~дание.'},
};
// условия выборов без штурма (нужны все)
function dealScore(){const mine=OUTLETS.filter(o=>outSt(S,o)==='vs').length, kr=OUTLETS.filter(o=>outSt(S,o)==='kr').length, ci=ACTIONS.kre.findIndex(a=>/Иск в Конституционный суд/.test(a.t));
  return [[(S.flags.zero||0)>=1,'н~улевой в~ариант п~ринят'],[!!(S.once&&S.once['kre'+ci]),'и~ск в К~онституционный с~уд п~одан'],[mine>=10&&kr<=4,'з~а в~ас о~т 10 и~зданий, з~а К~ремль н~е б~ольше 4 (с~ейчас '+mine+' и '+kr+')'],
    [S.leg>=85,'Л~егитимность о~т 85 (с~ейчас '+S.leg+')'],[S.city>=80,'М~осква о~т 80% (с~ейчас '+S.city+'%)'],[S.pts.mo>=50||S.pts.gs>=50,'М~инобороны и~ли Г~енштаб о~т 50%'],[S.rad<40&&S.fac.rne.n<=0,'Р~адикализм н~иже 40 и н~ет Р~НЕ в з~дании'],[S.day>=18,'н~е р~аньше 1 о~ктября']];}
function checkLose(){
  if(S.phase===1){S.hope=Math.max(S.hope,10);S.leg=Math.max(S.leg,10);return false;}
  if(S.hope<=0){ending('lose_hope');return true;}
  if(S.leg<=0){ending('lose_leg');return true;}
  if(S.phase===2&&S.ppl+S.mil<=0){ending('lose_ppl');return true;}
  return false;
}
// три яруса исходов: победа, нейтральный (здание потеряно, но Ельцин политически надломлен), поражение
const endTier=id=>{const E=ENDINGS[id]||{};return E.win?'win':E.tier||'lose';};
function drawScore(){const A=S.A||{units:[],air:0}; return [[S.leg>=50,'Л~егитимность о~т 50 (с~ейчас '+S.leg+')'],[(A.air||0)>=50,'Э~фир о~т 50 (с~ейчас '+Math.round(A.air||0)+')'],[A.units.some(u=>u.id!=='alpha'&&(u.st==='refuse'||u.st==='stopped')),'х~отя б~ы о~дна ч~асть о~тказалась и~ли о~становлена'],[S.city>=55,'М~осква о~т 55% (с~ейчас '+S.city+'%)']];}
function ending(id,exact){
  if(exact);
  else if((id==='fell'||id==='broken')&&drawScore().filter(x=>x[0]).length>=3)id='pyrrhic';
  if(!exact&&id==='held'&&S.flags.corner)id=S.flags.corner==='army'?'win_army':'win_elect';
  if(!exact&&id==='held'&&(S.rad>=70||(S.leg<35&&S.A&&S.A.air<30)||(S.A&&S.A.air<50&&(S.A.lost||0)+S.A.units.reduce((x,u)=>x+(u.lost||0),0)>=1500)))id='held_iso'; // без прессы или ценой большой крови без камер // кучка радикалов без прессы: отбились, но никто не признал
  const E={...ENDINGS[id]}; if(id==='fell')E.h=dateStr(S.day).toUpperCase(); if(S.A)S.A.card=0; $('modal').classList.remove('on');
  store.del(SAVE); store.set(CHRON,S.chron);
  S.endId=id; if(typeof aBanQ!=='undefined')aBanQ=[]; if(typeof achEnd==='function')achEnd(id); {const bn=$('a-banner'); if(bn)bn.className='';} stat('end-'+({win:'win',neu:'neutral'}[endTier(id)]||'lose')+'-'+id.replace(/_/g,'-'));
  showEvent({...E,tier:endTier(id),id:'end',end:1,time:'',urgent:0,ch:[
    {t:'Ч~то с~тало с к~аждым',go:()=>showEpi(0)},
    {t:'И~тоги в ц~ифрах',go:()=>openFinal()},
    {t:'Н~ачать з~аново',go:()=>newGame()},
    {t:'В г~лавное м~еню',go:()=>{show('title');renderMenu();}},
  ]});
  $('ev-res').textContent=`П~родержались д~ней: ${S.day}. Р~ешений п~ринято: ${S.chron.length}.`;
}

// ===== эпилог: слайды «что стало с каждым». Гипотетические судьбы зависят от исхода, лояльности фракции, того, на чьей стороне была сила, и решений партии =====
// фракции: [ушли до конца, победа+верны, победа+колебались, поражение+верны, поражение+колебались]
const EPI_FAC={
  ros:['Ф~ракция «Р~оссия» р~азъехалась п~о р~егионам с~обирать с~оветы и к р~азвязке н~е у~спела. Б~абурин п~отом г~оворил, ч~то е~го л~юди у~шли с~лишком р~ано, и н~е с~порил, к~огда е~му о~твечали т~о ж~е с~амое.',
       'Б~абурин в~озглавил к~омиссию п~о н~овой К~онституции. Ю~ристы «Р~оссии», п~исавшие п~остановления в о~саждённом з~дании, т~еперь п~ишут о~сновной з~акон, и п~арламент в н~ём с~ильнее п~резидента.',
       '«Р~оссия» о~сталась в п~обедившем С~ъезде, н~о е~й п~омнят д~ни, к~огда е~ё г~олоса п~риходилось у~говаривать. В к~онституционную к~омиссию Б~абурина в~зяли з~аместителем, а н~е г~лавой.',
       'Б~абурин в~ышел и~з з~дания о~дним и~з п~оследних, у с~тадиона е~го и~збили. В д~екабре и~збиратели О~мска с~нова в~ыбрали е~го д~епутатом, и с т~рибуны Д~умы о~н п~овторял т~о ж~е, ч~то г~оворил в Б~елом д~оме.',
       'В п~оследние д~ни ф~ракция у~же и~скала в~ыход п~оодиночке. Б~абурина в~сё р~авно и~збили п~ри в~ыходе и~з з~дания, а в д~екабре О~мск в~ернул е~го в п~арламент, у~же б~ез ф~ракции.'],
  kr: ['«К~оммунисты Р~оссии» у~шли д~о р~азвязки. Р~ыбкин д~оговорился с п~равительством р~аньше о~стальных и с~охранил п~артию д~ля в~ыборов.',
       'К~оммунисты п~олучили т~ри м~инистерства в п~равительстве н~ационального с~огласия. П~артийные я~чейки, в~ыводившие л~юдей к Б~елому д~ому, з~а о~дну о~сень с~тали с~амой о~рганизованной с~илой с~траны.',
       'К~оммунисты о~стались в С~ъезде, н~о м~инистерств и~м н~е д~али: с~лишком д~олго с~читали, ч~ья в~озьмёт. Р~ыбкин з~анялся т~ем, ч~то у~мел л~учше в~сего, и с~тал п~осредником м~ежду в~семи.',
       'Ф~ракция с~тояла д~о к~онца, и п~артию н~а н~есколько н~едель з~апретили. К д~екабрьским в~ыборам з~апрет с~няли. Р~ыбкин п~рошёл в Д~уму и с~тал е~ё п~ервым п~редседателем.',
       'К~оммунисты у~шли и~з з~дания з~а д~ень д~о к~онца, и э~то и~м з~ачли: п~артию д~опустили к в~ыборам с~разу. Р~ыбкин с~тал п~редседателем н~овой Д~умы, а з~ащитники Б~елого д~ома з~дороваться с н~им п~ерестали.'],
  agr:['А~грарии в~ернулись в с~вои о~бласти д~о к~онца с~обытий. У~борочная, с~казал Л~апшин, ж~дать н~е б~удет.',
       'А~грарный с~оюз п~ровёл ч~ерез С~ъезд з~акон о з~емле в с~воей р~едакции: б~ез с~вободной п~родажи. С~овхозы, в~озившие в о~саду к~артошку, п~олучили с~писание д~олгов.',
       'А~грарии о~стались, н~о т~орговались д~о п~оследнего д~ня. З~акон о з~емле п~риняли в к~омпромиссной р~едакции, а Л~апшин п~олучил к~омитет в~место м~инистерства.',
       'Л~апшин в~ывел с~воих л~юдей п~од к~онвоем и ч~ерез м~есяц с~обрал А~грарную п~артию. В д~екабре о~на п~рошла в Д~уму и т~орговалась з~а б~юджет с~ела с т~еми, к~то с~трелял п~о Б~елому д~ому.',
       'А~грарии с~дали м~андаты в о~бмен н~а о~бещание н~е т~рогать к~олхозы. О~бещание п~родержалось г~од. А~грарная п~артия п~рошла в Д~уму и г~олосовала з~а б~юджет п~равительства.'],
  otc:['Д~епутаты в п~огонах и~з «О~тчизны» у~шли и у~несли с с~обой с~вязи в о~кругах. В р~ешающую н~очь з~вонить в ш~табы б~ыло у~же н~екому.',
       'Г~енералы «О~тчизны» в~ернулись в М~инистерство о~бороны п~обедителями. Т~арасов п~олучил к~ресло з~аместителя м~инистра и п~ервым д~елом о~становил с~окращение а~рмии.',
       '«О~тчизна» д~отянула д~о п~обеды, н~о е~ё з~вонки в о~круга б~ыли о~сторожнее, ч~ем п~росил ш~таб. В м~инистерстве г~енералам ф~ракции д~али к~абинеты б~ез в~ойск.',
       'Г~енералов «О~тчизны» у~волили в з~апас б~ез п~рава н~осить ф~орму. Т~арасов ч~ерез г~од в~ернулся в п~олитику, н~о у~же б~ез п~огон и б~ез ф~ракции.',
       '«О~тчизна» п~ерестала з~вонить в о~круга з~а н~есколько д~ней д~о к~онца. Г~енералов в~сё р~авно у~волили: К~ремль з~апомнил н~е т~о, ч~ем к~ончилось, а т~о, с ч~его н~ачиналось.'],
  sm: ['«С~мена» в~ышла к к~амерам р~аньше в~сех и п~редложила в~ыборы б~ез Е~льцина и б~ез Х~асбулатова. И~х п~оказали п~о в~сем к~аналам о~дин в~ечер.',
       '«С~мена» с~тала л~ицом п~обеды, з~а к~оторую н~е с~тыдно: м~олодые д~епутаты в~ели п~ереговоры о в~ыборах и о~бъясняли З~ападу, ч~то в М~оскве п~обедил п~арламент, а н~е б~аррикады.',
       '«С~мена» о~сталась, н~о д~о п~оследнего д~ержала д~верь о~ткрытой в о~бе с~тороны. Н~а п~ереговоры о в~ыборах Г~оловина п~озвали с~оветником, а н~е г~лавой д~елегации.',
       'Ф~ракция р~аспалась в т~у ж~е н~еделю. Е~ё д~епутаты р~азошлись п~о н~овым п~артиям, а Г~оловин е~щё н~есколько л~ет о~бъяснял, ч~то б~ыл п~ротив и у~каза, и с~трельбы.',
       '«С~мена» в~ышла и~з з~дания с б~елым ф~лагом р~аньше, ч~ем к~ончилось. К~ремль п~облагодарил, и~збиратели н~е п~ростили: в д~екабре и~з ф~ракции н~е в~ыбрали п~очти н~икого.'],
  kol:['К~олеблющиеся у~шли п~о о~дному. У~каз о~бещал к~аждому д~олжность и г~одовой о~клад, и п~очти в~се и~х п~олучили.',
       'К~олеблющиеся о~стались и п~отом р~ассказывали, ч~то н~е с~омневались н~и м~инуты. А~бдулатипов в~озглавил с~огласительную к~омиссию с р~егионами и о~казался т~ам н~а с~воём м~есте.',
       'К~олеблющиеся д~осидели д~о п~обеды, г~лядя н~а д~верь. И~м э~того н~е з~абыли: в н~овом С~ъезде и~х г~олоса б~ольше н~икто н~е с~читал з~аранее.',
       'О~ни о~стались д~о к~онца и с~ами у~дивились э~тому. Д~олжностей и~м у~же н~е п~редложили. А~бдулатипов ч~ерез н~есколько м~есяцев в~сё р~авно о~казался в в~ерхней п~алате н~ового п~арламента.',
       'П~олучили о~т К~ремля о~бещанные д~олжности и к~омпенсации. А~бдулатипов с~тал з~аместителем п~редседателя С~овета Ф~едерации и о с~ентябре в~споминать н~е л~юбил.'],
};
// силы: [победа+были за Совет, победа+были за Кремль или колебались, поражение+были за Совет, поражение+за Кремль]
const EPI_PT={
  mer:['Л~ужков в~овремя п~онял, к~уда д~ует в~етер, и в~ключил с~вет р~аньше, ч~ем е~го о~б э~том п~опросили. М~эром о~н о~стался, н~о М~оссовет т~еперь у~тверждает е~го б~юджет п~острочно.',
       'Л~ужков д~о п~оследнего д~ня д~ержал Б~елый д~ом б~ез с~вета и в~оды. М~оссовет о~тправил е~го в о~тставку п~ервым ж~е р~ешением п~осле п~обеды. Ч~ерез д~ва г~ода о~н в~ернулся в г~ородскую п~олитику.',
       'М~эрия к~олебалась д~ольше, ч~ем К~ремль б~ыл г~отов т~ерпеть. Л~ужков у~сидел, н~о ц~еной М~оссовета: г~ородские с~оветы р~аспустили е~го ж~е р~аспоряжением.',
       'Л~ужков о~тключил з~данию с~вет, в~оду и к~анализацию и н~и р~азу о~б э~том н~е п~ожалел. М~оссовет р~аспустили, а м~эром о~н о~ставался д~о 2010 г~ода.'],
  smo:['А~нпилов п~ривёл н~а С~моленскую с~только л~юдей, ч~то м~илиция о~тступила. П~осле п~обеды «Т~рудовая Р~оссия» т~ребовала с~уда н~ад п~равительством, и С~ъезду п~ришлось о~бъяснять с~воим ж~е с~оюзникам, ч~то п~обеда н~е о~значает р~асправы.',
       'У~лицу у А~нпилова о~тбили е~щё д~о р~азвязки. П~обеду С~ъезда о~н в~стретил с м~егафоном у з~акрытых д~верей и с~читал, ч~то е~ё у н~его у~крали.',
       'А~нпилов д~ержал п~лощадь д~о к~онца. Е~го а~рестовали ч~ерез т~ри д~ня в д~еревне п~од Т~улой. В ф~еврале 1994 г~ода о~н в~ышел п~о а~мнистии и в~ернулся н~а п~лощадь.',
       'С~моленскую з~ачистили з~а о~дин в~ечер. А~нпилова в~зяли в д~еревне п~од Т~улой, в ф~еврале 1994 г~ода о~н в~ышел п~о а~мнистии.'],
  mo: ['Г~рачёв т~ак и н~е о~тдал п~риказ, к~оторого о~т н~его ж~дал К~ремль. М~инистром о~н н~е о~стался: С~ъезд х~отел ч~еловека, к~оторый с~казал «н~ет» с~разу, а н~е т~ого, к~то м~олчал д~ве н~едели.',
       'Г~рачёв б~ыл г~отов в~ыполнить п~риказ, н~о п~риказ н~е д~ошёл д~о т~анков. О~н п~одал в о~тставку в д~ень п~еремирия и д~о к~онца ж~изни с~читал, ч~то а~рмию т~огда п~редали с о~беих с~торон.',
       'Г~рачёв т~янул и т~ребовал п~исьменный п~риказ. П~олучил е~го п~од у~тро. Е~льцин е~му э~того н~е п~ростил: м~инистра с~менили ч~ерез н~есколько м~есяцев.',
       'Г~рачёв п~отребовал п~исьменный п~риказ и п~олучил е~го. Т~анки в~ышли н~а м~ост. М~инистром о~бороны о~н о~ставался д~о 1996 г~ода.'],
  gs: ['Г~енштаб н~е д~ал К~ремлю н~и о~дной д~ивизии. К~олесников о~стался н~ачальником Г~енерального ш~таба п~ри н~овой в~ласти: ч~еловека, к~оторый у~держал а~рмию в к~азармах, м~енять н~е с~тали.',
       'К~олесников ж~дал, ч~ем к~ончится, и д~ождался. П~ри С~ъезде о~н п~рослужил е~щё п~олгода и у~шёл с~ам.',
       'Г~енштаб с~аботировал п~риказы к~ак у~мел: т~ерялись ш~ифровки, н~е з~аводились к~олонны. Э~того х~ватило, ч~тобы з~адержать ш~турм, н~о н~е ч~тобы е~го о~тменить. К~олесникова т~ихо у~брали ч~ерез г~од.',
       'Г~енштаб в~ыполнил п~риказ б~ез э~нтузиазма и б~ез з~адержек. К~олесников о~ставался н~а п~осту д~о 1996 г~ода.'],
  mvd:['О~фицеры в~нутренних в~ойск о~тказались и~дти н~а п~роволоку, и Е~рин о~стался м~инистром б~ез м~инистерства. О~н у~шёл в о~тставку в д~ень п~еремирия.',
       'Е~рин д~ержал о~цепление д~о п~оследнего ч~аса. П~осле п~обеды С~ъезда е~го у~волили и д~опрашивали о п~риказах т~ех д~ней. Д~о с~уда д~ело н~е д~ошло.',
       'В М~ВД б~ыли о~фицеры, о~тводившие п~осты и с~мотревшие в с~торону. И~х у~волили т~ой ж~е о~сенью. Е~рин п~олучил з~везду Г~ероя Р~оссии.',
       'О~МОН и в~нутренние в~ойска с~делали т~о, ч~то о~т н~их т~ребовали. Е~рин п~олучил з~везду Г~ероя Р~оссии и у~шёл в о~тставку т~олько в 1995 г~оду, п~осле Б~удённовска.'],
  ost:['О~станкино д~ало С~ъезду э~фир, и с~трана в~первые у~видела о~саду и~знутри. Б~рагина с~няли, а т~елецентр п~ерешёл п~од н~аблюдательный с~овет п~арламента.',
       'О~станкино д~о к~онца п~оказывало т~о, ч~то н~ужно К~ремлю. Б~рагина у~волили н~а с~ледующий д~ень п~осле п~обеды, т~елевидение п~ередали п~од к~онтроль С~ъезда.',
       'В О~станкине н~ашлись р~едакторы, п~ускавшие в э~фир д~епутатов. И~х у~волили п~ервыми. Б~рагина К~ремль с~нял в д~екабре: с~лишком м~ного л~ишнего у~шло в э~фир.',
       'О~станкино о~ставалось г~олосом К~ремля в~се э~ти д~ни. Б~рагина в~сё р~авно с~няли в д~екабре, п~осле н~еудачных д~ля в~ласти в~ыборов.'],
};
// ничья и «нулевой вариант»: [были верны, колебались]
const EPI_FAC_N={
  ros:['Ю~ристы «Р~оссии» д~о п~оследнего д~ня п~исали п~остановления, и н~и о~дно и~з н~их с~уд п~отом н~е о~тменил. Б~абурин о~стался в п~олитике к~ак ч~еловек, к~оторый н~е у~ступил и н~е п~обедил. В О~мске е~го в~ыбирали с~нова и с~нова.',
       '«Р~оссия» в п~оследние д~ни и~скала в~ыход п~оодиночке. К~огда к~ризис к~ончился б~ез п~обедителя, Б~абурин с~обрал ф~ракцию з~аново, н~о п~режнего в~еса у н~её у~же н~е б~ыло.'],
  kr: ['К~оммунисты о~стались д~о к~онца и в~ышли и~з к~ризиса с п~артией, к~оторую н~икто н~е п~осмел з~апретить. Н~а с~ледующих в~ыборах о~ни с~обрали г~олоса т~ех, к~то н~е п~ростил н~и К~ремлю, н~и С~ъезду.',
       'К~оммунисты с~читали, ч~ья в~озьмёт, а н~е в~зял н~икто. Р~ыбкин п~ервым с~ел з~а с~тол п~ереговоров с п~равительством и с~охранил п~артию д~ля в~ыборов.'],
  agr:['А~грарии к~ормили о~саждённое з~дание д~о п~оследнего д~ня. З~акон о з~емле о~стался т~аким, к~аким б~ыл: н~и о~дна с~торона н~е н~абрала с~ил е~го п~ереписать. Л~апшин н~азывал э~то с~воей г~лавной п~обедой.',
       'А~грарии т~орговались с о~беими с~торонами и н~и о~дной н~ичего н~е о~стались д~олжны. Ч~ерез м~есяц Л~апшин с~обрал А~грарную п~артию и п~овёл е~ё н~а в~ыборы.'],
  otc:['Г~енералы «О~тчизны» з~вонили в о~круга д~о п~оследней н~очи. В а~рмию и~х н~е в~ернули, н~о и у~вольнять с п~озором н~е р~ешились: с~лишком м~ногие к~омандиры п~омнили э~ти з~вонки.',
       '«О~тчизна» з~вонила в о~круга о~сторожнее, ч~ем п~росил ш~таб. Г~енералы ф~ракции т~ихо у~шли в з~апас. Т~арасов ч~ерез г~од в~ернулся в п~олитику у~же б~ез п~огон.'],
  sm: ['«С~мена» в~ела п~ереговоры з~а в~сех, к~то н~е х~отел г~оворить д~руг с д~ругом. К~огда к~ризис к~ончился б~ез п~обедителя, о~казалось, ч~то э~того о~на и д~обивалась. Г~оловина з~вали в к~аждую с~огласительную к~омиссию.',
       '«С~мена» д~ержала д~верь о~ткрытой в о~бе с~тороны и в~ошла в т~у, ч~то о~ткрылась. Е~ё д~епутаты р~азошлись п~о н~овым п~артиям, а Г~оловин е~щё д~олго о~бъяснял, ч~то б~ыл п~ротив о~беих с~торон с~разу.'],
  kol:['К~олеблющиеся о~стались д~о к~онца и с~ами э~тому у~дивились. А~бдулатипов в~озглавил с~огласительную к~омиссию с р~егионами: к~огда н~икто н~е п~обедил, п~осредники о~казались н~ужнее г~ероев.',
       'К~олеблющиеся ж~дали, ч~ем к~ончится, и н~е д~ождались я~сного о~твета. Д~олжности, о~бещанные К~ремлём, п~олучили н~е в~се. А~бдулатипов в~сё р~авно о~казался в в~ерхней п~алате н~ового п~арламента.'],
};
// ничья: [были за Совет, были за Кремль или колебались]
const EPI_PT_N={
  mer:['Л~ужков в~ключал з~данию с~вет и с~нова в~ыключал, с~мотря п~о н~овостям. М~эром о~н о~стался: к~огда в с~тране н~ет п~обедителя, х~озяин г~орода н~ужен о~беим с~торонам.',
       'Л~ужков д~ержал Б~елый д~ом б~ез с~вета и в~оды в~се э~ти д~ни. К~огда к~ризис к~ончился б~ез п~обедителя, М~оссовет п~отребовал е~го о~тставки и н~е с~обрал г~олосов. М~эром о~н о~ставался е~щё м~ного л~ет.'],
  smo:['А~нпилов д~ержал С~моленскую д~о к~онца и с~читал, ч~то у~лица с~делала б~ольше, ч~ем д~епутаты. «Т~рудовая Р~оссия» т~ребовала с~уда н~ад п~равительством. С~уда н~е б~ыло, м~итинги п~родолжались.',
       'У~лицу у А~нпилова о~тбили е~щё д~о р~азвязки. О~н о~стался н~а с~вободе и с м~егафоном: а~рестовывать е~го п~осле т~акой о~сени б~ыло н~езачем.'],
  mo: ['Г~рачёв т~ак и н~е д~ал К~ремлю а~рмию ц~еликом. Е~льцин е~му э~того н~е п~ростил, С~ъезд е~му н~е п~оверил. М~инистра с~менили ч~ерез н~есколько м~есяцев, и о~бе с~тороны с~очли э~то с~воей з~аслугой.',
       'Г~рачёв в~ыполнял п~риказы К~ремля, п~ока б~ыло ч~то в~ыполнять. Р~азвязка б~ез п~обедителя о~ставила е~го м~инистром а~рмии, к~оторая б~ольше н~е х~отела, ч~тобы е~ё з~вали в М~оскву.'],
  gs: ['Г~енштаб с~аботировал п~риказы к~ак у~мел: т~ерялись ш~ифровки, н~е з~аводились к~олонны. К~олесникова з~а э~то н~е н~аградили и н~е н~аказали. О~н п~рослужил е~щё п~олгода и у~шёл с~ам.',
       'Г~енштаб в~ыполнял п~риказы б~ез э~нтузиазма и б~ез з~адержек. К~олесников о~стался н~а п~осту и д~о к~онца с~лужбы и~збегал р~азговоров о т~ой о~сени.'],
  mvd:['В М~ВД б~ыли о~фицеры, о~тводившие п~осты и с~мотревшие в с~торону. У~волить и~х Е~рин н~е с~мог: с~лишком ш~атким в~ышел и~тог. С~ам о~н у~шёл в о~тставку ч~ерез г~од.',
       'О~цепление Е~рин д~ержал д~о п~оследнего ч~аса. З~везду Г~ероя е~му з~а э~то н~е д~али: н~аграждать з~а о~сень, в к~оторой н~икто н~е п~обедил, К~ремль н~е р~ешился.'],
  ost:['О~станкино д~ало с~лово д~епутатам, и с~трана у~видела о~саду и~знутри. Б~рагина с~няли. Т~елецентр п~олучил н~аблюдательный с~овет, в к~отором К~ремль и п~арламент е~щё г~од б~локировали д~руг д~руга.',
       'О~станкино д~о к~онца п~оказывало т~о, ч~то н~ужно К~ремлю. Б~рагина в~сё р~авно с~няли: к~то-т~о д~олжен б~ыл о~тветить з~а т~о, ч~то с~трана п~оверила н~е т~елевизору.'],
};
// поражение без штурма («Разошлись», «Съезд распался», «Пустые баррикады», сдача до боя): замены для текстов, где упомянуты штурм и танки
const EPI_NOA={
  ros3:'Б~абурин в~ышел и~з п~устеющего з~дания о~дним и~з п~оследних. В д~екабре и~збиратели О~мска с~нова в~ыбрали е~го д~епутатом, и с т~рибуны Д~умы о~н п~овторял т~о ж~е, ч~то г~оворил в с~ентябре.',
  ros4:'В п~оследние д~ни ф~ракция и~скала в~ыход п~оодиночке. В д~екабре О~мск в~ернул Б~абурина в п~арламент, у~же в д~ругой.',
  agr3:'Л~апшин у~вёл с~воих л~юдей п~оследним и ч~ерез м~есяц с~обрал А~грарную п~артию. В д~екабре о~на п~рошла в Д~уму и т~орговалась з~а б~юджет с~ела.',
  mo2:'Г~рачёв т~янул и т~ребовал п~исьменный п~риказ. П~риказ н~е п~онадобился: Б~елый д~ом о~пустел с~ам. Е~льцин з~апомнил, ч~то м~инистр ж~дал, и с~менил е~го ч~ерез н~есколько м~есяцев.',
  mo3:'Г~рачёв б~ыл г~отов в~ыполнить п~риказ. В~ыводить т~анки н~е п~ришлось: з~дание о~пустело б~ез е~диного в~ыстрела. М~инистром о~бороны о~н о~ставался д~о 1996 г~ода.',
  gs2:'Г~енштаб с~аботировал п~риказы к~ак у~мел: т~ерялись ш~ифровки, н~е з~аводились к~олонны. Х~ватило б~ы э~того и~ли н~ет, п~роверить н~е д~овелось: д~о ш~турма д~ело н~е д~ошло.',
  gs3:'Г~енштаб б~ыл г~отов в~ыполнить п~риказ б~ез э~нтузиазма и б~ез з~адержек. П~риказа н~е п~онадобилось. К~олесников о~ставался н~а п~осту д~о 1996 г~ода.',
};
function epilogue(){
  const id=S.endId||'', K=id==='elect_deal'?'deal':endTier(id)==='neu'?'draw':/army/.test(id)?'army':id==='win_elect'?'elect':id==='held'?'held':/fell|broken/.test(id)?'fell':/surrender/.test(id)?'surr':'fade', win=K==='army'||K==='elect'||K==='held', neu=K==='deal'||K==='draw', noA=!win&&!neu&&!(S.A&&S.A.units);
  const L=[], add=(pic,h,q,p)=>L.push({pic,h,q,p});
  add(win?'wh':K==='fell'?'whf':'wh','Э~ПИЛОГ','Ч~то с~тало с к~аждым','Д~альше т~о, ч~его н~е б~ыло. И~ли б~ыло н~е т~ак. С~удьбы з~ависят о~т т~ого, ч~ем к~ончилась в~аша о~сень, к~то о~стался с в~ами д~о к~онца и н~а ч~ьей с~тороне о~казались а~рмия, м~илиция, м~эрия и э~фир.');
  add('hasb','Х~АСБУЛАТОВ','П~редседатель В~ерховного С~овета',{army:'Х~асбулатов п~ринял о~тставку п~равительства в т~ом ж~е з~але, г~де д~ве н~едели с~идел п~ри с~вечах. Д~о д~осрочных в~ыборов о~н о~ставался в~торым ч~еловеком в с~тране, а м~ногие с~читали, ч~то п~ервым.',
    deal:'Х~асбулатов п~одписал «н~улевой в~ариант» и о~стался п~редседателем д~о в~ыборов. О~н н~азывал э~то п~обедой п~рава. В н~овом п~арламенте, и~збранном п~о н~овому з~акону, п~редседателя с т~акими п~олномочиями у~же н~е б~ыло.',
    elect:'Х~асбулатов о~тбил ш~турм и с~огласился н~а о~дновременные в~ыборы. Н~а н~их о~н н~е п~ошёл: с~казал, ч~то е~го д~ело б~ыло с~охранить п~арламент, а н~е в~озглавить е~го с~нова.',
    held:'Х~асбулатов в~ышел к л~юдям у о~бгоревшей с~тены и о~бъявил п~еремирие. П~обеда д~осталась е~му в~месте с~о с~писком п~огибших, и э~тот с~писок е~му п~отом н~апоминали н~а к~аждых в~ыборах.',
    draw:S.endId==='held_iso'?'Х~асбулатов о~стался п~редседателем п~арламента, к~оторый п~ризнают т~олько в п~ределах о~цепления. О~н т~ребовал о~т р~адикалов з~амолчать, н~о м~икрофон б~ыл у~же н~е у н~его.':'Х~асбулатов в~ышел и~з з~дания с~вободным ч~еловеком: а~рестовать п~редседателя п~арламента п~осле в~сего, ч~то п~оказали к~амеры, К~ремль н~е р~ешился. О~н о~бъявил, ч~то С~ъезд п~родолжит р~аботу в л~юбом з~але с~траны, и р~егионы о~дин з~а д~ругим п~редлагали е~му э~тот з~ал.',
    fell:'Х~асбулатова в~ывели и~з з~дания п~од к~онвоем и у~везли в Л~ефортово. 26 ф~евраля 1994 г~ода о~н в~ышел п~о а~мнистии Г~осударственной д~умы и в~ернулся п~реподавать в П~лехановский и~нститут.',
    surr:'Х~асбулатов п~одписал у~словия с~дачи и в~ышел к а~втобусам в~месте с д~епутатами. Л~ефортово, а~мнистия в ф~еврале 1994 г~ода, к~афедра в П~лехановском и~нституте.',
    fade:'Х~асбулатов о~стался в п~устеющем з~дании п~очти о~дин. Е~го д~аже н~е а~рестовали: К~ремлю б~ыло в~ажнее п~оказать, ч~то а~рестовывать н~екого. О~н в~ернулся н~а к~афедру.'}[K]);
  add('rutskoy','Р~УЦКОЙ','В~ице-п~резидент',K==='deal'?'Р~уцкой с~ложил п~олномочия и~сполняющего о~бязанности п~резидента в т~от д~ень, к~огда у~каз №1400 о~тменили. О~н н~азывал к~омпромисс к~апитуляцией о~беих с~торон с~разу. Н~а в~ыборы о~н п~ошёл с~ам и п~роиграл, а ч~ерез т~ри г~ода с~тал г~убернатором К~урской о~бласти.':K==='draw'&&S.endId==='held_iso'?'Р~уцкой п~ринимал п~арад з~ащитников в~о д~воре Б~елого д~ома. Е~го у~казы и~сполнялись в р~адиусе т~рёхсот м~етров. Д~альше н~ачиналась с~трана, к~оторая з~апомнила е~го п~ризыв б~омбить К~ремль.':K==='draw'?'Р~уцкой в~ышел п~оследним и п~оказал ж~урналистам а~втомат в с~мазке. П~оловина с~траны с~читала е~го и~сполняющим о~бязанности п~резидента, в~торая п~оловина с~читала м~ятежником, и о~бе б~ыли п~о-с~воему п~равы. С~уда н~ад н~им т~ак и н~е с~лучилось.':win?(S.rad>=60?'Р~уцкой п~ринял п~рисягу и~сполняющего о~бязанности п~резидента и в~ыполнил п~оловину о~бещаний, д~анных с б~алкона. В~торая п~оловина к~асалась т~юрем, и С~ъезд е~ё н~е у~твердил.':'Р~уцкой и~сполнял о~бязанности п~резидента д~о д~осрочных в~ыборов и, к о~бщему у~дивлению, д~ействительно и~х п~ровёл.'):
    (K==='fade'?'Р~уцкой с~ложил с с~ебя п~олномочия, к~оторые н~икто, к~роме С~ъезда, н~е п~ризнавал. Ч~ерез т~ри г~ода е~го в~ыбрали г~убернатором К~урской о~бласти.':'Р~уцкой с~дался п~оследним и п~оказал ж~урналистам а~втомат в с~мазке: н~е с~трелял. Л~ефортово, а~мнистия в ф~еврале 1994 г~ода. В 1996-м е~го в~ыбрали г~убернатором К~урской о~бласти.'));
  add('yeltsin','Е~ЛЬЦИН','П~резидент Р~оссии',{army:'А~рмия н~е в~ыполнила п~риказ, и э~то б~ыл к~онец. Е~льцин с~огласился н~а д~осрочные в~ыборы, в к~оторых у~частвовать н~е с~тал, и у~ехал н~а д~ачу в Б~арвиху п~исать к~нигу.',
    deal:'Е~льцин о~тменил у~каз №1400 и н~азвал э~то «ш~агом к с~огласию». Д~о в~ыборов о~н у~спел с~менить з~акон о п~арламенте и р~уководство т~елевидения. В~ыборы о~н в~ыиграл. Н~асколько ч~естно, с~порят д~о с~их п~ор.',
    elect:'Е~льцин о~тозвал у~каз №1400, н~азвав э~то «ш~агом к с~огласию». Н~а о~дновременных в~ыборах о~н в~ыставил с~вою к~андидатуру. Ч~ем о~ни к~ончились, э~та и~гра н~е з~нает.',
    held:'Ш~турм з~ахлебнулся н~а г~лазах у в~сего м~ира. Е~льцин о~бъявил п~еремирие и ч~ерез н~еделю с~огласился н~а в~ыборы. Т~ех, к~то о~тдавал п~риказы о с~трельбе, о~н н~азвал п~оимённо, с~ебя с~реди н~их н~е н~азвал.',
    draw:'Е~льцин о~стался в К~ремле, н~о п~риказы о~ттуда б~ольше н~е в~ыполнялись: о~круга ж~дали п~исьменных п~одтверждений, р~егионы о~ставляли н~алоги с~ебе, с~уд н~азвал у~каз №1400 п~ереворотом. Ч~ерез н~есколько м~есяцев о~н с~огласился н~а д~осрочные в~ыборы и н~а н~их н~е п~ошёл.',
    fell:'Е~льцин п~равил у~казами д~о д~екабря. 12 д~екабря 1993 г~ода н~а р~еферендуме п~риняли н~овую К~онституцию с с~ильным п~резидентом и с~лабым п~арламентом. О~на д~ействует д~о с~их п~ор.',
    surr:'Е~льцин п~олучил з~дание б~ез б~ольшого б~оя и п~оставил э~то с~ебе в з~аслугу. В д~екабре п~риняли е~го К~онституцию. О г~арантиях, д~анных с~давшимся, в~спомнили т~олько в ф~еврале, к~огда Д~ума о~бъявила а~мнистию.',
    fade:'К~ремлю н~е п~онадобился ш~турм. Е~льцин п~одписал у~каз о в~ыборах в н~овый п~арламент и в д~екабре п~ровёл ч~ерез р~еферендум с~вою К~онституцию.'}[K]);
  for(const F of FACTIONS){ if(F.kind!=='dep')continue; const f=S.fac[F.id], T=EPI_FAC[F.id]; if(!T)continue; const gone=f.n<=0, loyal=f.loy>=6;
    add(FAC_WHO[F.id],F.nm.replace(/"/g,'«').replace(/«([^«]*)«/,'«$1»').toUpperCase(),gone?'У~шли д~о р~азвязки':LOY[loyLvl(f.loy)].nm[0].toUpperCase()+LOY[loyLvl(f.loy)].nm.slice(1)+' · о~сталось '+f.n,gone?T[0]:neu?EPI_FAC_N[F.id][loyal?0:1]:win?T[loyal?1:2]:(noA&&EPI_NOA[F.id+(loyal?3:4)])||T[loyal?3:4]); }
  { const f=S.fac.rne, was=f.n>0||S.flags.rneWas;
    add('barkash','Р~НЕ',f.n>0?'О~стались в з~дании д~о к~онца':was?'В~ыставлены и~ли у~шли с~ами':'В з~дание н~е п~устили',
      neu?(f.n>0?'Б~аркашовцы о~ставались в з~дании д~о р~азвязки и у~шли с о~ружием. К~адры с и~х с~троем К~ремль п~оказывал п~ри к~аждом у~добном с~лучае: «в~от с к~ем н~ам п~редлагают д~оговариваться». О~тмыться о~т э~тих к~адров С~ъезду т~ак и н~е у~далось.'
            :was?'Р~НЕ к р~азвязке в з~дании у~же н~е б~ыло. Б~аркашов г~оворил, ч~то е~го п~редали. О~бвинение в ф~ашизме к з~ащитникам в~сё р~авно к~леили, н~о д~ержалось о~но п~лохо: п~оказывать б~ыло н~екого.'
            :'Б~аркашову о~тказали у д~верей. Ч~ёрной ф~ормы н~а с~нимках у Б~елого д~ома н~е о~казалось, и э~то с~тало о~дной и~з п~ричин, п~о к~оторым К~ремль н~е с~мог о~бъявить п~арламент м~ятежом.')
      :noA?(f.n>0?'Б~аркашовцы у~шли и~з з~дания п~оследними, с~троем и с о~ружием. К~адры с э~тим с~троем К~ремль п~оказывал в~сю з~иму: «в~от к~то т~ам с~идел». Б~аркашова а~рестовали з~имой, в ф~еврале о~н в~ышел п~о а~мнистии.'
            :was?'Р~НЕ к к~онцу в з~дании у~же н~е б~ыло. О~бвинение в ф~ашизме к з~ащитникам в~сё р~авно п~риклеили, н~о д~ержалось о~но х~уже: п~оказывать б~ыло н~екого.'
            :'Б~аркашову о~тказали у д~верей. Н~икто н~е с~мог п~оказать п~о т~елевизору с~вастику у с~тен п~арламента, н~о Б~елый д~ом э~то н~е с~пасло.')
      :f.n>0?(win?'Б~аркашовцы д~ержали д~вадцатый п~одъезд и п~отребовали с~вою д~олю п~обеды: п~омещение, о~ружие, м~есто в о~хране С~ъезда. Л~иберальные г~азеты п~олучили ф~отографию, к~оторую п~ечатали е~щё д~есять л~ет: ч~ёрная ф~орма н~а с~тупенях п~арламента. Р~азоружать Р~НЕ п~ришлось у~же н~овой в~ласти.'
                 :'Б~аркашовцы д~рались у п~одъезда д~ольше в~сех, а п~отом у~шли ч~ерез к~оллекторы с о~ружием. К~адры с и~х с~троем с~тали г~лавным о~правданием ш~турма: «т~ам б~ыли ф~ашисты». Б~аркашова а~рестовали з~имой, в ф~еврале о~н в~ышел п~о а~мнистии.')
      :was?(win?'Р~НЕ в п~обедившем Б~елом д~оме н~е б~ыло, и п~обеду С~ъезда н~икто н~е с~мог н~азвать к~оричневой. Б~аркашов г~оворил, ч~то е~го п~редали. Ч~ерез г~од о е~го о~рганизации п~исали у~же т~олько в к~риминальной х~ронике.'
              :'С~ъезд в~ыставил Р~НЕ и о~стался б~ез л~учшего о~тряда. Б~аркашов у~вёл л~юдей и в б~ою н~е у~частвовал. О~бвинение в ф~ашизме к з~ащитникам в~сё р~авно п~риклеили, н~о о~но д~ержалось х~уже: п~оказывать б~ыло н~екого.')
      :(win?'Б~аркашову о~тказали у д~верей, и э~то о~казалось о~дним и~з с~амых д~ешёвых р~ешений т~ой о~сени: б~ез ч~ёрной ф~ормы н~а с~нимках З~апад п~ризнал п~обеду п~арламента в т~от ж~е д~ень.'
           :'Б~аркашову о~тказали у д~верей. С~та д~вадцати о~бученных б~ойцов в д~ень ш~турма н~е х~ватило, з~ато н~икто н~е с~мог п~оказать п~о т~елевизору с~вастику у с~тен п~арламента.')); }
  { const f=S.fac.so; add('terekh','«С~ОЮЗ О~ФИЦЕРОВ»',f.n>0?'В з~дании д~о к~онца':'В з~дании н~е б~ыло',neu?(f.n>0?'О~фицеры Т~ерехова о~твечали з~а о~борону з~дания д~о п~оследнего д~ня. А~рестовать Т~ерехова К~ремль н~е р~ешился, в~ернуть в а~рмию о~тказался. «С~оюз о~фицеров» о~стался т~ем, ч~ем б~ыл: п~олитическим к~ружком л~юдей в п~огонах.':'«С~оюз о~фицеров» в о~бороне н~е у~частвовал. Т~ерехов т~ребовал т~о с~уда н~ад м~инистром о~бороны, т~о е~го о~тставки и н~е д~обился н~и т~ого, н~и д~ругого.'):f.n>0?(win?'О~фицеры Т~ерехова в~ернулись в а~рмию с в~осстановленными з~ваниями. С~амого Т~ерехова в Г~енштаб н~е в~зяли: п~обедившему С~ъезду н~ужна б~ыла а~рмия, а н~е е~ё п~олитический к~ружок.':'Т~ерехова а~рестовали и б~или н~а д~опросах. В ф~еврале 1994 г~ода о~н в~ышел п~о а~мнистии и с~нова с~обрал «С~оюз о~фицеров», у~же б~ез о~ружия.')
      :(win?'«С~оюз о~фицеров» в о~бороне н~е у~частвовал. П~осле п~обеды Т~ерехов т~ребовал ч~истки М~инистерства о~бороны, и е~го в~ежливо н~е у~слышали.':'Т~ерехов д~ействовал с~ам и б~ыл а~рестован е~щё д~о р~азвязки. А~мнистия в ф~еврале 1994 г~ода в~ернула е~му с~вободу, н~о н~е з~вание.')); }
  for(const pid of ['mo','gs','mvd','mer','smo','ost']){ const P=POINTS.find(x=>x.id===pid), v=S.pts[pid], our=v>=(win||neu?50:60), W=PEOPLE[POINT_WHO[pid]];
    add(POINT_WHO[pid],W.nm.split(' ').pop().toUpperCase(),P.nm.replace(/ ↑.*/,'')+' · к к~онцу '+(v>=65?'з~а С~овет':v<=35?'з~а К~ремль':'к~олебались')+' ('+v+'%)',neu?EPI_PT_N[pid][our?0:1]:win?EPI_PT[pid][our?0:1]:(noA&&EPI_NOA[pid+(our?2:3)])||EPI_PT[pid][our?2:3]); }
  // части Кремля: кто дошёл до конца, кто встал, кто не пошёл вовсе
  { const A=S.A, kWon=endTier(id)==='lose';
    if(!A||!A.units||false){ add('grachev','Ч~АСТИ К~РЕМЛЯ','Ш~турма н~е б~ыло',id==='elect_deal'?'Ч~асти, с~тянутые к М~оскве, п~ростояли н~еделю н~а к~ольцевой и в~ернулись в г~арнизоны. С~олдатам о~бъявили, ч~то э~то б~ыли у~чения.':'Д~о с~трельбы н~е д~ошло. К~олонны п~остояли н~а н~абережной и у~шли: б~рать б~ыло у~же н~екого.'); }
    else{ const T={
      tanks:{who:'grachev',nm:'Т~АНКИ Н~А М~ОСТУ',sub:'К~антемировская д~ивизия',
        refuse:'Э~кипажи К~антемировской д~ивизии н~а м~ост н~е в~ыехали. К~омандир п~олка п~опросил п~исьменный п~риказ м~инистра и ж~дал е~го д~о в~ечера. О~фицеров, о~тказавшихся с~трелять, п~озже т~ихо у~волили, н~о с~удить н~е р~ешились.',
        out:'Т~анки в~ышли н~а м~ост, н~о о~гонь п~рекратили р~аньше, ч~ем к~ончился ш~турм. Э~кипажи з~аглушили м~оторы и с~идели н~а б~роне п~од к~амерами. Ф~отография м~олчащих т~анков у Б~елого д~ома о~бошла в~се г~азеты м~ира.',
        won:'Т~анки о~тстрелялись п~о в~ерхним э~тажам д~о к~онца. Э~кипажам, п~о с~лухам, з~аплатили н~аличными и д~али к~вартиры. И~мена о~фицеров, с~идевших в м~ашинах, м~инистерство н~е р~аскрывало м~ного л~ет.',
        lost:'Т~анки б~или п~о з~данию д~о т~емноты, н~о з~дание у~стояло. О~фицеров, с~трелявших п~о п~арламенту, н~овая в~ласть с~удить н~е с~тала, и~м п~росто п~ерестали п~одавать р~уку. М~ногие у~волились в т~от ж~е г~од.'},
      taman:{who:POINT_WHO.gs,nm:'М~ОТОСТРЕЛКИ',sub:'Т~аманская д~ивизия',
        refuse:'Т~аманская д~ивизия к з~данию н~е п~ошла. Г~енштаб д~оложил в К~ремль о н~ехватке г~орючего. В~се п~онимали, ч~то г~орючее б~ыло.',
        out:'М~отострелки н~ачали ш~турм и н~е з~акончили е~го. Р~оты з~алегли у с~тилобата, и н~икакие п~риказы п~однять и~х у~же н~е м~огли. К в~ечеру д~ивизию о~твели, с~ославшись н~а п~отери.',
        won:'Т~аманцы в~ошли в з~дание ч~ерез п~арадный в~ход. С~рочников, б~равших э~тажи, ч~ерез м~есяц в~ернули в к~азармы и в~елели н~е р~ассказывать, г~де о~ни б~ыли.',
        lost:'М~отострелки ш~ли н~а п~арадный в~ход в~есь д~ень и н~е в~зяли е~го. Д~ивизию в~ывели и~з М~осквы н~очью, б~ез с~троя и б~ез м~узыки. Е~ё к~омандира с~няли п~ервым.'},
      vv:{who:POINT_WHO.mvd,nm:'В~НУТРЕННИЕ В~ОЙСКА',sub:'Д~ивизия и~мени Д~зержинского',
        refuse:'Д~ивизия Д~зержинского н~а ш~турм н~е в~ышла. Ч~асть о~фицеров е~щё д~о р~ассвета з~аявила, ч~то п~о с~воим с~трелять н~е б~удет. М~инистру д~оложили о~б э~том к~ак о «т~ехнической н~еготовности».',
        out:'В~нутренние в~ойска д~рались у д~вадцатого п~одъезда и у~шли о~ттуда р~аньше к~онца. К~омандиры у~вели л~юдей с~ами, н~е д~ожидаясь п~риказа с~верху.',
        won:'Д~ивизия Д~зержинского в~зяла д~вадцатый п~одъезд. Е~ё б~ойцам д~али б~ольше в~сего н~аград з~а э~ту о~сень. Н~осить и~х в М~оскве о~ни п~отом с~теснялись.',
        lost:'Д~ивизия Д~зержинского б~илась о д~вадцатый п~одъезд в~есь д~ень. П~осле п~еремирия е~ё в~ывели и~з г~орода, а с~чёт е~ё п~отерь м~инистерство з~асекретило.'},
      omon:{who:POINT_WHO.mvd,nm:'О~МОН',sub:'Г~УВД М~осквы',
        refuse:'О~МОН н~а з~дание н~е п~ошёл. Б~ойцы с~няли ш~лемы и с~тояли в~доль н~абережной с~пиной к Б~елому д~ому. Ж~енщины и в~етераны, к~оторые х~одили к н~им д~ве н~едели, э~то з~апомнили.',
        out:'О~МОН н~ачал в~месте с~о в~семи и в~стал п~осреди д~ня. М~илиционеры с~казали, ч~то р~азгонять м~итинги о~ни у~меют, а б~рать п~арламент н~е н~анимались.',
        won:'О~МОН ш~ёл з~а а~рмией и з~ачищал э~тажи и д~воры в~округ. П~ро т~о, ч~то д~елали с з~адержанными н~а с~тадионе «К~расная П~ресня», п~отом п~исали г~одами.',
        lost:'О~МОН д~ошёл д~о д~верей и о~ткатился. Ч~ерез н~еделю т~ех ж~е б~ойцов п~оставили о~хранять т~от ж~е п~арламент, у~же о~т е~го и~мени.'},
      alpha:{who:'yeltsin',nm:'«А~ЛЬФА» И «В~ЫМПЕЛ»',sub:'С~пецподразделения'} };
      for(const u of A.units){ const t=T[u.id]; if(!t)continue; const lost=Math.round(u.lost||0), m=uMorV(u);
        if(u.id==='alpha'){ const al=A.alpha, neg=/alpha/.test(id);
          add(t.who,t.nm,t.sub+' · '+(neg?'в~ывели л~юдей п~од с~вои г~арантии':al==='refuse'?'о~тказались ш~турмовать':al==='attack'?'п~ошли н~а ш~турм, п~отери '+fmt(lost):'о~стались в р~езерве'),
            neg?(id==='draw_alpha'?'О~фицеры «А~льфы» в~ошли в з~дание б~ез в~ыстрела и в~ывели л~юдей п~од с~воё с~лово. П~еред к~амерами о~ни с~казали, ч~то ш~турмовать п~арламент н~е б~удут. Э~того К~ремль и~м н~е п~ростил: «В~ымпел» р~асформировали, «А~льфу» п~ередали д~ругому в~едомству.':'«А~льфа» в~ывела л~юдей и~з з~дания п~од с~вои г~арантии. Г~арантии к~ончились у а~втобусов. О~фицеры п~отом г~оворили, ч~то с~делали ч~то м~огли, и ч~то б~ез н~их у~битых б~ыло б~ы в~десятеро б~ольше.')
            :al==='refuse'?'«А~льфа» в~ыслушала о~бращение п~о р~ации и о~сталась н~а м~есте. О~фицеры о~тветили К~ремлю, ч~то п~о б~езоружным д~епутатам о~ни н~е р~аботают. О~тказ с~пецназа с~тал к~онцом ш~турма д~ля в~сех, к~то е~щё с~омневался.'
            :al==='attack'?(kWon?'«А~льфа» и «В~ымпел» в~ошли в д~вадцатый п~одъезд п~оследними и с~делали т~о, ч~его н~е с~могли о~стальные. О~б э~том д~не и~х о~фицеры н~е л~юбят в~споминать.':'«А~льфа» п~ошла н~а ш~турм и н~е в~зяла п~одъезд. Д~ля п~одразделения, к~оторое н~е з~нало н~еудач, э~то с~тало п~ереломом: п~оловина о~фицеров п~одала р~апорты.')
            :'«А~льфу» и «В~ымпел» д~ержали в р~езерве д~о с~амого к~онца и в б~ой т~ак и н~е б~росили. И~х о~фицеры п~отом г~оворили, ч~то э~то б~ыл л~учший п~риказ з~а в~сю о~сень.'); continue; }
        const st=u.st==='refuse'&&lost===0?'refuse':(u.cur<=3||m<MOR_HALT)?'out':kWon?'won':'lost';
        const ls=u.id==='tanks'?'':', п~отери '+fmt(lost), sub=t.sub+' · '+(st==='refuse'?'о~тказались, в б~ою н~е б~ыли':st==='out'?(u.halt||u.cur>3?(u.id==='tanks'?'п~рекратили о~гонь':'в~стали и д~альше н~е п~ошли'):'в~ыведены и~з б~оя')+ls:(u.id==='tanks'?'с~треляли д~о к~онца':'д~рались д~о к~онца')+ls);
        add(t.who,t.nm,sub,t[st]); } } }
  { const mine=OUTLETS.filter(o=>outSt(S,o)==='vs').length, kr=OUTLETS.filter(o=>outSt(S,o)==='kr').length;
    add(null,'П~РЕССА',`З~а в~ас ${mine}, з~а К~ремль ${kr}`,win?(mine>=kr?'Р~едакции, в~ставшие н~а с~торону С~ъезда, н~аписали и~сторию э~той о~сени п~ервыми. О~стальные д~ве н~едели о~бъясняли ч~итателям, ч~то и~мели в в~иду н~а с~амом д~еле.':'Б~ольшинство р~едакций б~ыло п~ротив в~ас д~о п~оследнего д~ня. П~обедивший С~ъезд с~порил, з~акрывать л~и и~х. '+(S.rad>=60?'З~акрыли т~ри, и э~то с~тало п~ервым с~кандалом н~овой в~ласти.':'Н~е з~акрыл н~и о~дной, и э~то з~апомнили.'))
      :(mine>=4?'«П~равду», «С~оветскую Р~оссию», «Д~ень» и е~щё д~есяток и~зданий з~акрыли у~казом н~а с~ледующий д~ень. Ч~асть в~ернулась п~од д~ругими н~азваниями. Г~азеты, п~оддержавшие К~ремль, в~ышли с б~елыми п~ятнами ц~ензуры и в~озмутились.':'О~ппозиционные г~азеты з~акрыли у~казом. О~стальные в~ышли с б~елыми п~ятнами ц~ензуры, к~оторую ч~ерез н~есколько д~ней о~тменили.')); }
  { const A=S.A, lost=A?Math.round(A.lost||0):0;
    add(K==='fell'||K==='held'?'whf':'wh','М~ОСКВА','Г~ород п~осле р~азвязки',win?(lost>300?`П~обеда с~тоила ${fmt(lost)} у~битых и р~аненых з~ащитников. У с~тены с~тадиона «К~расная П~ресня» п~оставили п~амятник, и к н~ему х~одят т~е, к~то б~ыл п~о р~азные с~тороны п~роволоки.`:'Б~аррикады р~азобрали з~а н~еделю. С~пираль Б~руно у~везли н~а с~клад, с к~оторого е~ё п~ривезли. М~осквичи е~щё д~олго с~порили н~а к~ухнях, ч~ья э~то б~ыла п~обеда.')
      :(K==='draw'&&S.endId==='held_iso'?'Б~аррикады у Б~елого д~ома п~ростояли д~о з~имы. Г~ород п~ривык о~бъезжать н~абережную. Т~ех, к~то у~держал з~дание, м~осквичи н~е б~лагодарили и н~е п~роклинали: и~х п~росто б~оялись.':K==='draw'?'Б~елый д~ом с~тоял п~устой и з~акопчённый д~о в~есны: н~и о~дна в~ласть н~е р~ешалась в н~его в~ъехать. М~осква ж~ила с д~вумя п~равительствами и н~и о~дним, ц~ены р~осли, а н~а к~ухнях с~порили н~е о т~ом, к~то п~обедил, а о т~ом, к~то в~иноват.':K==='fell'?'Ч~ёрные п~ятна н~а б~елом ф~асаде з~акрасили к з~име. П~огибших с~читали д~олго и п~о-р~азному: о~фициально о~коло п~олутора с~отен. К~омендантский ч~ас о~тменили ч~ерез д~ве н~едели.':K==='surr'?'З~дание о~тдали б~ез б~ольшого б~оя, и э~то с~пасло н~е о~дну с~отню ж~изней. Ф~асад о~стался б~елым. Б~елый д~ом о~бнесли о~градой, к~оторая с~тоит д~о с~их п~ор.':'Б~елый д~ом о~пустел б~ез в~ыстрела. Ч~ерез м~есяц в н~ём у~же с~идело п~равительство, и о~граду в~округ п~оставили т~акую, ч~тобы б~аррикады б~ольше б~ыло н~е и~з ч~его с~троить.')); }
  add('wh','К~АК Б~ЫЛО Н~А С~АМОМ Д~ЕЛЕ','21 с~ентября — 4 о~ктября 1993 г~ода','У~каз №1400 в~ышел 21 с~ентября. Б~елый д~ом о~тключили о~т с~вета и с~вязи и о~кружили п~роволокой. 3 о~ктября с~торонники В~ерховного С~овета п~рорвали о~цепление, в~зяли м~эрию и п~ошли н~а О~станкино. У~тром 4 о~ктября т~анки с Н~овоарбатского м~оста р~асстреляли п~арламент, к в~ечеру з~ащитники с~дались. П~огибли, п~о о~фициальным д~анным, о~коло 150 ч~еловек. В д~екабре п~риняли н~овую К~онституцию.');
  return L;
}
function showEpi(i){ const L=epilogue(); i=Math.max(0,Math.min(i||0,L.length-1)); const s=L[i], last=i===L.length-1;
  showEvent({id:'epi',pic:s.pic||'wh',tag:'Э~ПИЛОГ',h:s.h,q:s.q,p:s.p,time:'',ch:[
    last?{t:'К и~тогам',go:()=>ending(S.endId)}:{t:'Д~альше',go:()=>showEpi(i+1)},
    ...(i>0?[{t:'Н~азад',go:()=>showEpi(i-1)}]:[]),
    ...(!last?[{t:'П~ропустить',go:()=>ending(S.endId)}]:[])]});
  $('ev-meta').textContent='Ч~ТО С~ТАЛО С К~АЖДЫМ · '+(i+1)+' И~З '+L.length; $('ev-hud').innerHTML='';
}
// what became of every faction: [ушли до конца, победа, поражение]
const FATES={
  kr:['У~шли д~о р~азвязки. Р~ыбкин д~оговорился с п~равительством р~аньше о~стальных.','В~ошли в п~равительство н~ационального с~огласия и п~олучили т~ри м~инистерства.','К~омпартию д~опустили к д~екабрьским в~ыборам. Р~ыбкин с~тал п~редседателем н~овой Д~умы.'],
  ros:['Р~азъехались п~о р~егионам с~обирать с~оветы. С~обрать н~е у~спели.','Б~абурин в~озглавил к~омиссию п~о н~овой К~онституции.','Б~абурина и~збили п~ри в~ыходе и~з з~дания. В д~екабре е~го с~нова в~ыбрали д~епутатом.'],
  agr:['В~ернулись в с~вои о~бласти д~о к~онца с~обытий.','П~ровели ч~ерез С~ъезд з~акон о з~емле в с~воей р~едакции.','А~грарная п~артия п~рошла в Д~уму и т~орговалась з~а б~юджет с~ела.'],
  otc:['Д~епутаты в п~огонах у~шли и у~несли с с~обой с~вязи в о~кругах.','П~олучили к~ресла в М~инистерстве о~бороны.','У~волены в з~апас б~ез п~енсии. Ч~ерез г~од ч~асть в~ернулась в п~олитику.'],
  sm:['В~ышли к к~амерам р~аньше в~сех и п~редложили в~ыборы б~ез Е~льцина и Х~асбулатова.','С~тали л~ицом к~омпромисса: м~олодые д~епутаты п~овели п~ереговоры о в~ыборах.','Ф~ракция р~аспалась. Е~ё д~епутаты р~азошлись п~о н~овым п~артиям.'],
  kol:['У~шли п~о о~дному. У~каз о~бещал к~аждому д~олжность и г~одовой о~клад.','О~стались и п~отом р~ассказывали, ч~то н~е с~омневались н~и м~инуты.','П~олучили о~т К~ремля о~бещанные д~олжности и к~омпенсации.'],
  rne:['П~окинули з~дание д~о к~онца.','П~отребовали с~вою д~олю п~обеды. С н~ими п~ришлось р~азбираться о~тдельно.','У~шли ч~ерез к~оллекторы с о~ружием. Б~аркашова а~рестовали з~имой, п~о а~мнистии о~н в~ышел.'],
  so:['У~шли д~ействовать с~ами.','О~фицеры в~ернулись в а~рмию с в~осстановленными з~ваниями.','Т~ерехов а~рестован. В ф~еврале 1994-г~о о~свобождён п~о а~мнистии.'],
};
function openFinal(){
  const id=S.endId||'', win=!!(ENDINGS[id]&&ENDINGS[id].win)||id==='held', neu=endTier(id)==='neu', A=S.A, st=S.st||{};
  const row=(a,b,c)=>`<div class="fr"><span>${a}</span><b class="${c||''}">${b}</b></div>`;
  const facs=FACTIONS.map(F=>{const f=S.fac[F.id],gone=f.n<=0,L=LOY[loyLvl(f.loy)];
    return `<div class="ff"><span class="sw" style="background:${F.c}"></span><div><b>${F.nm.replace(/"/g,'')}</b> <i style="color:${gone?'var(--dim)':L.c}">${gone?'н~ет в з~дании':L.nm+' · '+f.n}</i><div>${FATES[F.id][gone?0:win?1:2]}</div></div></div>`;}).join('');
  const forces=[['mo','М~инобороны'],['gs','Г~енштаб'],['mvd','М~ВД'],['mer','М~эрия'],['ost','О~станкино']].map(([k,n])=>{const v=S.pts[k];return row(n,v>=70?'з~а С~овет':v>=45?'к~олебались':'з~а К~ремль',v>=70?'p':v>=45?'':'n');}).join('');
  const mine=OUTLETS.filter(o=>outSt(S,o)==='vs').map(o=>o.nm).join(', ')||'н~икого';
  $('modal-win').innerHTML=`<h2>И~ТОГИ · ${dateStr(S.day).toUpperCase()} 1993</h2><div class="sub">${win?'П~обеда: В~ерховный С~овет у~стоял.':neu?'Н~ейтральный и~сход: з~дание п~отеряно, н~о Е~льцин п~олитически н~адломлен.':'П~оражение: Е~льцин п~обедил.'} ${A?'Ш~турм д~лился '+A.r+' ч. и~з 12.':'Д~о ш~турма д~ело н~е д~ошло.'}</div>
   <div class="fin"><div><h3>Ц~ИФРЫ</h3>
    ${row('Д~ней о~т н~ачала',S.day)}${row('Р~ешений п~ринято',S.chron.length)}${row('Л~егитимность',S.leg)}${row('М~осква з~а С~овет',S.city+'%')}
    ${row('Д~епутатов о~сталось',deputies(S)+' и~з 265',deputies(S)<QUORUM?'n':'')}${row('Д~епутатов у~шло',st.depOut||0)}${row('Д~епутатов в~ернулось',st.depIn||0)}
    ${row('Л~юдей у с~тен',fmt(S.ppl))}${row('Б~ойцов',fmt(S.mil))}${A?row('У~битых и р~аненых',fmt(Math.round(A.lost||0)),'n'):''}
    ${A?row('П~отери ш~турмующих',fmt(A.units.reduce((a,u)=>a+(u.lost||0),0)),'p'):''}${row('Х~одов К~ремля п~ротив в~ас',st.km||0)}${row('П~риказов н~е и~сполнено',st.fail||0)}
    <h3>С~ИЛЫ</h3>${forces}
    <h3>П~РЕССА З~А В~АС</h3><div class="fo">${mine}</div>
    ${A&&A.muster?'<h3>К~ТО П~РИШЁЛ В П~ОСЛЕДНЮЮ Н~ОЧЬ</h3>'+A.muster.map(m=>`<div class="fo ${m.g?'p':'n'}">${m.t}</div>`).join(''):''}
   </div><div><h3>С~УДЬБЫ</h3>${facs}
    <div class="ff"><span class="sw" style="background:#b3322b"></span><div><b>Х~асбулатов и Р~уцкой</b><div>${win?'О~стались у в~ласти д~о д~осрочных в~ыборов. Ч~то б~ыло б~ы д~альше, и~стория н~е з~нает.':'Л~ефортово. 26 ф~евраля 1994 г~ода в~ышли п~о а~мнистии Г~осударственной д~умы.'}</div></div></div>
    <h3>К~АК Б~ЫЛО Н~А С~АМОМ Д~ЕЛЕ</h3><div class="fo">У~каз №1400 в~ышел 21 с~ентября. 4 о~ктября т~анки с Н~овоарбатского м~оста р~асстреляли Б~елый д~ом, к в~ечеру з~ащитники с~дались. П~огибли, п~о о~фициальным д~анным, о~коло 150 ч~еловек. В д~екабре п~риняли н~овую К~онституцию.</div>
   </div></div><div class="sub" style="text-align:center;margin-top:6px">И~гра «1993» · ${authorHTML()}</div><div class="close">ESC — з~акрыть</div>`;
  $('modal').classList.add('on'); $('modal-win').querySelector('.close').onclick=()=>$('modal').classList.remove('on');
}
function save(){store.set(SAVE,S);}

// ================= input =================
addEventListener('keydown',e=>{
  const k=e.key;
  if($('modal').classList.contains('on')){
    if(S&&S.A&&S.A.card&&screen==='assault'){if(S.A.card==='muster'){if(k==='Enter'||k===' ')musterClose();}else if(S.A.card==='fin'){if(k==='Enter'||k===' ')finaleGo();}else if(k>='1'&&k<='3')(S.A.card==='inc'?incChoose:alphaChoose)(+k-1);return;}
    if(k==='Escape'||k==='Enter')closeModal();return;}
  if(screen==='intro'){introNext(k==='Escape');return;}
  if(screen==='paper'){if(k==='Enter'||k===' ')paperGo(-1);else if(k>='1'&&k<='3')paperGo(+k-1);return;}
  if(screen==='title'){
    const n=menuItems().length;
    if(k==='ArrowDown'){menuSel=(menuSel+1)%n;renderMenu();}
    else if(k==='ArrowUp'){menuSel=(menuSel+n-1)%n;renderMenu();}
    else if(k==='Enter'||k===' '){menuGo(menuItems()[menuSel].dataset.m);}
  }else if(screen==='map'||screen==='wh'){
    if(toastOn()&&(k==='Escape'||k===' ')){hideToast();return;}
    if(k==='Tab'){e.preventDefault();setView(screen==='map'?'wh':'map');}
    else if(k==='Enter'){endTurn();}
    else if(k==='p'||k==='з'){openLaws();}
    else if(k==='m'||k==='ь'){openEther();}
    else if(k==='Escape'){show('title');renderMenu();}
    else if(screen==='map'){
      if(k>='1'&&k<='3'){const o=actsOf(S.sel)[+k-1];if(o)doAction(S.sel,o.i);}
      else if(k==='ArrowRight'||k==='ArrowLeft'){const i=POINTS.findIndex(p=>p.id===S.sel);
        S.sel=POINTS[(i+(k==='ArrowLeft'?POINTS.length-1:1))%POINTS.length].id;renderMap();}
    }else{
      if(k>='1'&&k<='2')doFacAct(S.selFac,+k-1);
      else if(k==='ArrowDown'||k==='ArrowUp'){e.preventDefault();const i=FACTIONS.findIndex(f=>f.id===S.selFac);
        S.selFac=FACTIONS[(i+(k==='ArrowUp'?FACTIONS.length-1:1))%FACTIONS.length].id;renderWH();}
    }
  }else if(screen==='assault'){
    if(k>='1'&&k<='8')doAOrder(+k-1); else if(k==='m'||k==='M'||k==='ь'||k==='Ь')openAir(); else if(k==='Enter')nextHour();
  }else if(screen==='event'){
    const n=evCur.ch.length;
    if(k>='1'&&k<=String(n)){choose(+k-1);}
    else if(k==='ArrowDown'){evSel=(evSel+1)%n;renderChoices();}
    else if(k==='ArrowUp'){evSel=(evSel+n-1)%n;renderChoices();}
    else if(k==='Enter'){choose(evSel);}
  }
});

function fit(){const d=document.documentElement,s=Math.min(d.clientWidth/1280,d.clientHeight/720);$('stage').style.transform=`scale(${s})`;}
addEventListener('resize',fit);addEventListener('orientationchange',()=>setTimeout(fit,200));fit();
// ---------- выход в главное меню с карты, из Белого дома и со штурма: партия сохраняется, «Продолжить» вернёт туда же ----------
function toMenu(){ if(S&&!S.endId)save(); $('modal').classList.remove('on'); show('title'); renderMenu(); }
$('b-menu').onclick=()=>toMenu();
[$('snd2').parentNode].forEach(b=>{const d=document.createElement('div');d.className='menub px';d.textContent='М~ЕНЮ';d.title='В г~лавное м~еню. П~артия с~охранится';if(b.contains($('snd2')))d.style.cssText='right:132px;top:10px;font-size:8px;padding:6px 8px;z-index:3';d.onclick=e=>{e.stopPropagation();toMenu();};b.appendChild(d);});
// ---------- полный экран: кнопка видна только там, где браузер его даёт (на iPhone его нет — там игра ставится на экран «Домой») ----------
const FS={ el:()=>document.documentElement, can(){const e=this.el();return !!((document.fullscreenEnabled||document.webkitFullscreenEnabled)&&(e.requestFullscreen||e.webkitRequestFullscreen));},
  on:()=>!!(document.fullscreenElement||document.webkitFullscreenElement),
  sync(){const b=$('fsb'); if(!b)return; b.style.display=this.can()?'block':'none'; b.textContent=this.on()?'⤢ В~ЫЙТИ И~З П~ОЛНОГО Э~КРАНА':'⤢ В~О В~ЕСЬ Э~КРАН'; setTimeout(fit,60); setTimeout(fit,400);},
  toggle(){ try{ if(this.on()){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return;}
      const e=this.el(), r=(e.requestFullscreen||e.webkitRequestFullscreen).call(e); const lock=()=>{try{const o=window.screen.orientation; if(o&&o.lock)o.lock('landscape').catch(()=>{});}catch(x){}}; if(r&&r.then)r.then(lock).catch(()=>{}); else lock(); }catch(x){} } };
document.addEventListener('fullscreenchange',()=>FS.sync());document.addEventListener('webkitfullscreenchange',()=>FS.sync());
{const b=$('fsb'); if(b)b.onclick=e=>{e.stopPropagation();FS.toggle();}; FS.sync();}
// ---------- шрифт: пиксельный по умолчанию, обычные подменяют те же два семейства (ширина подогнана, вёрстка не едет) ----------
const Font={ list:[['pix','П~ИКСЕЛЬНЫЙ'],['sans','О~БЫЧНЫЙ'],['serif','С З~АСЕЧКАМИ']],
  cur(){const k=(store.get(OPTS)||{}).font; return this.list.some(x=>x[0]===k)?k:'pix';},
  apply(){const k=this.cur(); let st=$('font-css'); if(!st){st=document.createElement('style');st.id='font-css';document.head.appendChild(st);} st.textContent=(typeof FONT_FACES!=='undefined'&&FONT_FACES[k])||''; document.documentElement.dataset.font=k;
    const b=$('fntb'); if(b){b.textContent='Ш~РИФТ: '+this.list.find(x=>x[0]===k)[1]; b.style.top=(FS.can()?100:62)+'px'; const n=$('fntn'); if(n){n.style.top=(FS.can()?138:100)+'px'; n.style.display=k==='pix'?'none':'block';}} },
  next(){const o=store.get(OPTS)||{}, i=this.list.findIndex(x=>x[0]===this.cur()); o.font=this.list[(i+1)%this.list.length][0]; store.set(OPTS,o); this.apply();} };
{const b=$('fntb'); if(b)b.onclick=e=>{e.stopPropagation();Font.next();}; Font.apply();}
// ---------- язык: переведённые копии скриптов (js/*.en.js и т. д.), выбор в настройках, смена = перезагрузка страницы ----------
const Lang={ list:[['','Р~усский'],['en','English'],['zh','中文'],['ko','한국어']], cur:()=>GL,
  note:{en:'Translations into English, Chinese and Korean have not been checked by anyone. We cannot guarantee their quality.',zh:'英文、中文和韩文翻译未经任何人校对，无法保证翻译质量。',ko:'영어, 중국어, 한국어 번역은 아무도 검수하지 않았습니다. 번역 품질을 보장할 수 없습니다.'},
  sync(){const b=$('lngb'),p=$('lngp'); if(!b)return; if((typeof SINGLE!=='undefined'&&SINGLE)||!LANGS_ON){b.style.display='none';return;} const top=(FS.can()?138:100); b.style.top=top+'px'; b.textContent='⚑ '+this.list.find(x=>x[0]===GL)[1].toUpperCase()+' ▾'; p.style.top=(top+36)+'px'; const f=$('fntn'); if(f)f.style.top=(top+38)+'px';
    const N=this.note; p.innerHTML=this.list.map(x=>`<div class="l${x[0]===GL?' on':''}" data-l="${x[0]}">${x[1]}</div>`).join('')+`<div class="n">${GL&&N[GL]?N[GL]+'<br><br>':''}А~нглийский, к~итайский и к~орейский п~ереводы н~икем н~е п~роверялись, к~ачество н~е г~арантируем.${GL==='en'?'':'<br><br>'+N.en}</div>`;
    p.querySelectorAll('.l').forEach(d=>d.onclick=e=>{e.stopPropagation();this.set(d.dataset.l);}); },
  set(l){ if(l===GL){$('lngp').style.display='none';return;} const o=store.get(OPTS)||{}; if(l)o.lang=l; else delete o.lang; store.set(OPTS,o); if(l&&window.Stat)Stat.ev('lang-'+l); location.href=location.pathname; } };
{const b=$('lngb'); if(b){b.onclick=e=>{e.stopPropagation();const p=$('lngp');p.style.display=p.style.display==='none'?'block':'none';}; Lang.sync();}
 if(window.HTML_TR){const T=window.HTML_TR; const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let n; while(n=w.nextNode()){const k=n.nodeValue.trim(); if(k&&T[k]!==undefined&&!n.parentNode.closest('#lngp'))n.nodeValue=n.nodeValue.replace(k,T[k]);}
   document.querySelectorAll('[title]').forEach(e=>{if(T[e.title]!==undefined)e.title=T[e.title];});
   const st=document.createElement('style'); st.textContent='.law.done .t::after{content:"'+(T['  ✔ п~ринято']||'  ✔')+'"}'+(typeof CJK_CSS!=='undefined'?CJK_CSS:''); document.head.appendChild(st);} }

drawMap(); applyOpts(); renderMenu(); show('title');

(function(){const v=document.getElementById('ver');if(v)v.textContent='в~ерсия '+VERSION;})();

// ================= ЧИТЫ (для тестов): включаются в главном меню, в игре кнопка «ЧИТ» и клавиши =================
function cheatOn(){return !!(store.get(OPTS)||{}).cheat;}
function cheatSync(){const b=$('cheat-btn'); if(b)b.style.display=cheatOn()&&S&&['map','wh','assault','event','paper'].includes(screen)?'block':'none';
}
function cheatBack(){ $('modal').classList.remove('on'); if(screen==='map'||screen==='wh'){save();showMain();} else if(screen==='assault'){save();renderAssault();} }
function cheatGo(k,auto){ if(!S)return; S.cheat=1;
  const toCrisis=()=>{ if(S.phase===1){S.phase=2;S.day=Math.max(S.day,DECREE_DAY+1);S.fired.e1400=1;} };
  $('modal').classList.remove('on');
  if(k==='assault'){ if(S.phase===3)return; if(S.phase===1||S.day<12){const T={ppl:3500,mil:250,gun:300,med:40,sup:5,bar:3}; for(const q in T)S[q]=Math.max(S[q]||0,T[q]);} toCrisis(); S.pr=100; S.queue=['assault']; nextEvent(); if(auto)choose(0); }
  else if(k==='ost'){ toCrisis(); S.fired.eost=0; S.queue=['eost']; nextEvent(); }
  else if(k==='decree'){ if(S.phase!==1)return; S.day=DECREE_DAY; S.queue=['e1400']; nextEvent(); }
  else if(k==='alpha'){ if(S.phase!==3)cheatGo('assault',1); if(S.A){ if(S.A.card==='muster')musterClose(); S.A.r=4; alphaCard(); } }
  else if(k==='epi'){ S.endId=S.endId||'held'; showEpi(0); }
  cheatSync();
}
function openCheats(){ if(!S)return; S.cheat=1; const win=$('modal-win'); win.classList.add('wide');
  const R=[['leg','Л~егитимность',20],['hope','Р~ешимость',20],['rad','Р~адикализм',20],['city','М~осква',20],['med','Э~фир',20],['ppl','Л~юди',1000],['mil','О~полчение',200],['gun','О~ружие',200],['sup','С~набжение',3],['omon','Г~отовность О~МОНа',30]];
  const b=(k,t,c)=>`<div class="law ck${c?' '+c:''}" data-k="${k}"><div class="t">${t}</div></div>`;
  win.innerHTML=`<h2>Ч~ИТЫ · Д~ЛЯ Т~ЕСТОВ</h2>${resStrip('')}
   <div class="sub">К~лавиша 0 о~ткрывает и з~акрывает э~ту п~анель. Н~а т~елефоне: п~ять б~ыстрых н~ажатий н~а н~омер в~ерсии н~а т~итуле в~ключают к~нопку «Ч~ИТ».</div>
   <div class="ph">П~ЕРЕЙТИ</div><div class="ckg">${b('go:decree','У~каз №1400 с~ейчас')+b('go:ost','С~обытие «О~станкино»')+b('go:assault','С~разу к ш~турму')+b('go:alpha','К «А~льфе» у п~одъезда')+b('go:epi','С~лайды «ч~то с~тало с к~аждым»')+b('x:night','З~акончить х~од')}</div>
   <div class="ph">П~ОКАЗАТЕЛИ</div><div class="ckg">${R.map(([k,n,v])=>b('r:'+k+':'+v,n+' +'+v)+b('r:'+k+':-'+v,n+' −'+v)).join('')}</div>
   <div class="ph">Р~АСКЛАД</div><div class="ckg">${b('x:all','В~сё п~о м~аксимуму')+b('x:orders','П~риказы +5, п~остановления +3')+b('x:ptsup','В~се с~илы +20')+b('x:ptsdn','В~се с~илы −20')+b('x:loyup','В~се ф~ракции л~ояльнее')+b('x:loydn','В~се ф~ракции з~лее')+b('x:rne',S.fac.rne.n>0?'У~брать Р~НЕ':'Р~НЕ в з~дание')+b('x:ring',S.cordon?'С~нять к~ольцо':'П~оставить к~ольцо')+b('x:power',S.flags.noPower?'В~ключить с~вет':'О~тключить с~вет')+b('x:dep','Д~епутатов −60')+b('x:seen','С~бросить с~правки')}</div>
   <div class="ph">П~ОКАЗАТЬ К~ОНЦОВКУ</div><div class="ckg">${Object.keys(ENDINGS).map(id=>b('end:'+id,ENDINGS[id].h+' · '+({win:'п~обеда',neu:'н~ичья',lose:'п~оражение'})[endTier(id)])).join('')}</div>
   <div class="close xtop">✕ З~АКРЫТЬ</div>`;
  $('modal').classList.add('on'); win.querySelector('.close').onclick=cheatBack;
  win.querySelectorAll('.ck').forEach(e=>e.onclick=()=>{const [a,k,v]=e.dataset.k.split(':');
    if(a==='go')return cheatGo(k);
    if(a==='end'){$('modal').classList.remove('on');const sv=store.get(SAVE);ending(k,1);if(sv)store.set(SAVE,sv);cheatSync();return;}
    if(a==='r'){ if(k==='omon'&&S.omon==null)S.omon=100; apply({[k]:+v}); }
    if(a==='x')cheatX(k);
    if(a==='x'&&k==='night')return;
    save(); if(screen==='map'||screen==='wh')showMain(); openCheats();});
}
function cheatX(k){
  if(k==='all'){apply({leg:100,hope:100,city:30,med:60,ppl:3000,mil:400,gun:400,sup:10});S.rad=Math.min(S.rad,30);S.orders+=5;S.lawCharges+=3;}
  else if(k==='orders'){S.orders+=5;S.lawCharges+=3;}
  else if(k==='ptsup'||k==='ptsdn'){for(const p in S.pts)if(p!=='wh'&&p!=='kre')S.pts[p]=clamp(S.pts[p]+(k==='ptsup'?20:-20),0,100);}
  else if(k==='loyup'||k==='loydn'){for(const F of FACTIONS)S.fac[F.id].loy=clamp(S.fac[F.id].loy+(k==='loyup'?2:-2),0,10);}
  else if(k==='rne'){S.fac.rne.n=S.fac.rne.n>0?0:120;}
  else if(k==='ring'){ if(S.cordon){S.ring=0;syncRing();} else if(S.phase===2){S.cordon=1;S.ring=null;syncRing();} }
  else if(k==='power'){S.flags.noPower=S.flags.noPower?0:1;}
  else if(k==='dep'){let n=60;for(const id of ['kol','sm','agr','ros','otc','kr']){const f=S.fac[id],q=Math.min(f.n,n);f.n-=q;n-=q;}}
  else if(k==='seen'){S.seen={};}
  else if(k==='night'){$('modal').classList.remove('on'); if(screen==='map'||screen==='wh')endTurn();}
}
// клавиша 0 открывает панель читов (в меню их нет). На телефоне: пять быстрых нажатий на номер версии на титуле включают кнопку «ЧИТ»
addEventListener('keydown',e=>{ if(e.key==='0'&&screen==='title'){e.stopImmediatePropagation();e.preventDefault(); if($('modal').classList.contains('on'))closeModal(); else openAch(1); return;}
  if(e.key!=='0'||!S||screen==='title'||screen==='intro')return; e.stopImmediatePropagation();e.preventDefault(); if($('modal').classList.contains('on')&&$('modal-win').querySelector('.ck'))cheatBack(); else openCheats();},true);
{let n=0,t0=0; $('ver').style.pointerEvents='auto'; $('ver').onclick=e=>{e.stopPropagation(); const now=Date.now(); n=now-t0<600?n+1:1; t0=now; if(n>=5){n=0; const o=store.get(OPTS)||{}; o.cheat=!o.cheat; store.set(OPTS,o); $('ver').style.color=o.cheat?'#c0473a':'#6e6658'; cheatSync();}};
 if(cheatOn())$('ver').style.color='#c0473a';}

$('cheat-btn').onclick=openCheats; cheatSync();

$('author').innerHTML=authorHTML();

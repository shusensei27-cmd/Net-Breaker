/* ================================================
   NETBREAKER — Incremental Hacker Simulator
   Full game engine — script.js
   ================================================ */
'use strict';

/* ══════════════════════════════════════════════════
   AUDIO ENGINE
══════════════════════════════════════════════════ */
const SFX = (() => {
  let ctx = null;
  const init = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };
  const beep = (freq, dur, vol = 0.12, type = 'square') => {
    try {
      init(); if (!ctx) return;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    } catch(e) {}
  };
  return {
    click:   () => beep(440, 0.06, 0.10, 'square'),
    hack:    () => { beep(220, 0.04, 0.07); setTimeout(() => beep(660, 0.08, 0.07), 55); },
    levelup: () => { [440,550,660,880].forEach((f,i) => setTimeout(() => beep(f,0.15,0.15,'sine'), i*100)); },
    buy:     () => beep(330, 0.10, 0.10, 'triangle'),
    error:   () => beep(100, 0.18, 0.10, 'sawtooth'),
  };
})();

/* ══════════════════════════════════════════════════
   FORMATTERS
══════════════════════════════════════════════════ */
const fmt = {
  cash(n) {
    if (n >= 1e15) return '$'+(n/1e15).toFixed(2)+'Qa';
    if (n >= 1e12) return '$'+(n/1e12).toFixed(2)+'T';
    if (n >= 1e9)  return '$'+(n/1e9).toFixed(2)+'B';
    if (n >= 1e6)  return '$'+(n/1e6).toFixed(2)+'M';
    if (n >= 1e3)  return '$'+(n/1e3).toFixed(2)+'K';
    return '$'+n.toFixed(2);
  },
  coin(n) {
    if (n >= 1e6) return (n/1e6).toFixed(3)+'M';
    if (n >= 1e3) return (n/1e3).toFixed(3)+'K';
    return n.toFixed(4);
  },
  int(n) { return Math.floor(n).toLocaleString(); },
};

/* ══════════════════════════════════════════════════
   GAME DATA
══════════════════════════════════════════════════ */
const HACK_LINES = [
  'Scanning target network...','Port 22 open — SSH detected',
  'Brute forcing credentials...','Buffer overflow exploited',
  'Root access GRANTED','Exfiltrating data packets...',
  'Covering tracks — logs cleared','Firewall bypassed ✓',
  'SQL injection successful','XSS vector identified',
  'Session hijacked — persisting','Deploying payload...',
  'Crypto handshake complete','Proxychains: routing active',
  'VPN tunnel established','Kernel exploit loaded',
  'Zero-day payload deployed','System fully compromised',
  'Hash collision detected','Memory corruption exploited',
  'DNS poisoning complete','ARP spoofing active',
];

const CRYPTO_VALUE   = { okt:0.5, sky:2, nex:10, vex:50 };
const MINER_COST     = { okt:300, sky:1500, nex:8000, vex:50000 };
const MINER_RATE     = { okt:0.05, sky:0.02, nex:0.008, vex:0.002 };
const SVC_BASE = [
  { cost:500,   inc:0.5 },
  { cost:2000,  inc:2   },
  { cost:8000,  inc:8   },
  { cost:25000, inc:0   },
];
const HW_COST  = { cpu:200, gpu:500, ram:1000, ai:5000 };
const AH_COST  = 2500;

const STORE = {
  tools: [
    {id:'t0',icon:'🔑',name:'Keygen Pro',     desc:'Generates license keys automatically',    effect:'+5% hack income',   cost:800,    bonus:{t:'hack',  v:0.05},max:5},
    {id:'t1',icon:'🪝',name:'Phishing Kit',   desc:'Mass phishing email campaigns',           effect:'+10% server income',cost:3000,   bonus:{t:'server',v:0.10},max:5},
    {id:'t2',icon:'🕷️',name:'Web Crawler',    desc:'Automated vulnerability scanner',         effect:'+8% hack income',   cost:8000,   bonus:{t:'hack',  v:0.08},max:5},
    {id:'t3',icon:'💀',name:'Rootkit v3',     desc:'Deep system rootkit for persistence',     effect:'+15% all income',   cost:25000,  bonus:{t:'all',   v:0.15},max:3},
    {id:'t4',icon:'🔓',name:'Lockpick Suite', desc:'Advanced password cracking suite',        effect:'+20% hack income',  cost:60000,  bonus:{t:'hack',  v:0.20},max:3},
    {id:'t5',icon:'🧨',name:'Zero-Day Bundle',desc:'Collection of unpatched exploits',        effect:'+30% hack income',  cost:200000, bonus:{t:'hack',  v:0.30},max:2},
  ],
  software: [
    {id:'s0',icon:'🤖',name:'Script Bot',     desc:'Automated scan and exploit bot',          effect:'+10% auto hack',    cost:1500,   bonus:{t:'auto',  v:0.10},max:5},
    {id:'s1',icon:'🛡️',name:'AV Bypass 2.0', desc:'Evade all antivirus systems',             effect:'+12% all income',   cost:5000,   bonus:{t:'all',   v:0.12},max:5},
    {id:'s2',icon:'🌀',name:'Poly Engine',    desc:'Self-mutating malware engine',            effect:'+20% mining rate',  cost:12000,  bonus:{t:'mine',  v:0.20},max:5},
    {id:'s3',icon:'🧬',name:'Neural Net AI',  desc:'AI-powered intrusion system',             effect:'+25% all income',   cost:50000,  bonus:{t:'all',   v:0.25},max:3},
    {id:'s4',icon:'🔭',name:'Darkweb Scanner',desc:'Scans darknet for vulnerabilities',       effect:'+35% server income',cost:120000, bonus:{t:'server',v:0.35},max:3},
    {id:'s5',icon:'⚡',name:'Quantum Cracker',desc:'Quantum-powered decryption',             effect:'+50% hack income',  cost:500000, bonus:{t:'hack',  v:0.50},max:2},
  ],
  network: [
    {id:'n0',icon:'🕸️',name:'Mini Botnet',   desc:'100-node botnet for DDoS & hacking',     effect:'+15% hack income',  cost:4000,   bonus:{t:'hack',  v:0.15},max:5},
    {id:'n1',icon:'🌐',name:'Proxy Chain',    desc:'7-layer anonymous routing',               effect:'+8% all income',    cost:8000,   bonus:{t:'all',   v:0.08},max:5},
    {id:'n2',icon:'📡',name:'Satellite Hack', desc:'Satellite relay for stealth operations',  effect:'+20% server income',cost:20000,  bonus:{t:'server',v:0.20},max:3},
    {id:'n3',icon:'🔗',name:'Mega Botnet',    desc:'10,000-node botnet army',                 effect:'+35% hack income',  cost:80000,  bonus:{t:'hack',  v:0.35},max:3},
    {id:'n4',icon:'💫',name:'Dark Web CDN',   desc:'Hidden content delivery network',         effect:'+40% server income',cost:200000, bonus:{t:'server',v:0.40},max:3},
    {id:'n5',icon:'🌑',name:'Ghost Network',  desc:'Untraceable global network',             effect:'+60% all income',   cost:1000000,bonus:{t:'all',   v:0.60},max:2},
  ],
};

const TARGETS = [
  '192.168.0.1','10.0.0.254','172.16.8.1','203.0.113.42',
  'bank.secure.gov','corp.internal','nasdaq.secure.int',
  'darknet://xyz.onion','megacorp.finance','gov.secure.mil',
];

/* ══════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════ */
const mkState = () => ({
  cash:0, exp:0, level:1,
  crypto:{okt:0,sky:0,nex:0,vex:0},
  hw:{cpu:0,gpu:0,ram:0,ai:0},
  services:[0,0,0,0],
  miners:{okt:0,sky:0,nex:0,vex:0},
  autoHack:false,
  storeOwned:{},
  txLog:[],
  totalEarned:0,
});
const G = mkState();

/* ══════════════════════════════════════════════════
   CALCULATIONS
══════════════════════════════════════════════════ */
const storeMult = t => {
  let v=0;
  for(const cat of Object.values(STORE))
    for(const item of cat)
      if(item.bonus.t===t) v+=item.bonus.v*(G.storeOwned[item.id]||0);
  return v;
};
const calcExpMax    = lvl => Math.floor(100*Math.pow(lvl,1.5));
const calcHackPow   = ()  => (1+G.hw.cpu*0.5)*(1+storeMult('hack'));
const calcAutoRate  = ()  => G.autoHack ? calcHackPow()*0.5*(1+storeMult('auto')) : 0;
const calcSvcInc    = ()  => {
  const cm=1+G.services[3]*0.25, rm=1+G.hw.ram*0.15, sm=1+storeMult('server');
  let t=0;
  for(let i=0;i<3;i++) if(G.services[i]>0) t+=SVC_BASE[i].inc*G.services[i]*cm*rm*sm;
  return t;
};
const calcMineRate  = c   => !G.miners[c]?0: MINER_RATE[c]*G.miners[c]*(1+G.hw.gpu*0.2)*(1+storeMult('mine'));
const calcMineCash  = ()  => ['okt','sky','nex','vex'].reduce((s,c)=>s+calcMineRate(c)*CRYPTO_VALUE[c],0);
const calcAllMult   = ()  => (1+G.hw.ai*0.1)*(1+storeMult('all'));
const calcTotalIPS  = ()  => (calcAutoRate()+calcSvcInc()+calcMineCash())*calcAllMult();

/* ══════════════════════════════════════════════════
   ECONOMY
══════════════════════════════════════════════════ */
const addCash  = amt => { G.cash+=amt; G.totalEarned+=amt; };
const spendCash= amt => {
  if(G.cash<amt) return false;
  G.cash-=amt; addTx('-'+fmt.cash(amt),'neg'); return true;
};
const addExp = (amt, silent=false) => {
  G.exp+=amt;
  let max=calcExpMax(G.level);
  while(G.exp>=max){ G.exp-=max; G.level++; if(!silent) onLevelUp(G.level); max=calcExpMax(G.level); }
  renderExpBar();
};
const addTx = (msg,cls) => {
  G.txLog.unshift({msg,cls,t:Date.now()});
  if(G.txLog.length>60) G.txLog.pop();
};

const UNLOCK_MSGS = {5:'🌐 Server Room unlocked!',10:'⛏️ Mining Zone unlocked!',15:'🔧 Advanced upgrades available!',20:'💀 Premium features unlocked!'};
const onLevelUp = lvl => {
  SFX.levelup();
  checkNavUnlocks();
  showLevelUp(lvl, UNLOCK_MSGS[lvl]||'');
  notify('🎉 LEVEL '+lvl+' REACHED!');
};
const checkNavUnlocks = () => {
  if(G.level>=5)  { const el=$('lock-server'); if(el) el.style.display='none'; }
  if(G.level>=10) { const el=$('lock-mine');   if(el) el.style.display='none'; }
};

/* ══════════════════════════════════════════════════
   GAME ACTIONS
══════════════════════════════════════════════════ */
let hackProgress=0;

const game = {
  hack() {
    SFX.hack();
    const power=calcHackPow()*calcAllMult();
    const exp=Math.max(1,Math.floor(power*0.3));
    addCash(power); addExp(exp);
    addTx('+'+fmt.cash(power)+' [HACK]','pos');
    showClickPop(power);
    addTermLine(HACK_LINES[Math.floor(Math.random()*HACK_LINES.length)]);
    hackProgress=Math.min(100,hackProgress+18);
    const btn=$('btn-hack');
    btn.style.transform='scale(0.93)'; btn.style.boxShadow='0 0 40px var(--green)';
    setTimeout(()=>{ btn.style.transform=''; btn.style.boxShadow=''; },130);
  },

  upgradeService(idx) {
    SFX.click();
    const lv=G.services[idx], cost=Math.floor(SVC_BASE[idx].cost*Math.pow(1.5,lv));
    if(!spendCash(cost)){ SFX.error(); notify('Not enough cash!','error'); return; }
    SFX.buy(); G.services[idx]++; addExp(8);
    const names=['Account Hack','Pen Testing','Data Recovery','Cloud Server'];
    addTx('+'+names[idx]+' Lv'+G.services[idx],'pos');
    notify('🌐 '+names[idx]+' → Level '+G.services[idx]);
    renderServer();
  },

  upgradeMiner(coin) {
    SFX.click();
    const lv=G.miners[coin], cost=Math.floor(MINER_COST[coin]*Math.pow(1.5,lv));
    if(!spendCash(cost)){ SFX.error(); notify('Not enough cash!','error'); return; }
    SFX.buy(); G.miners[coin]++; addExp(6);
    addTx('+'+coin.toUpperCase()+' Rig Lv'+G.miners[coin],'pos');
    notify('⛏️ '+coin.toUpperCase()+' Rig → Level '+G.miners[coin]);
    renderMine();
  },

  upgradeHW(hw) {
    SFX.click();
    const lv=G.hw[hw], cost=Math.floor(HW_COST[hw]*Math.pow(1.5,lv));
    if(!spendCash(cost)){ SFX.error(); notify('Not enough cash!','error'); return; }
    SFX.buy(); G.hw[hw]++; addExp(10);
    addTx('+'+hw.toUpperCase()+' Lv'+G.hw[hw],'pos');
    notify('⚙️ '+hw.toUpperCase()+' → Level '+G.hw[hw]);
    renderUpgrade();
  },

  buyAutoHack() {
    SFX.click();
    if(G.autoHack){ notify('Auto Hack already active!','info'); return; }
    if(!spendCash(AH_COST)){ SFX.error(); notify('Not enough cash!','error'); return; }
    SFX.buy(); G.autoHack=true;
    addTx('+Auto Hack enabled','pos');
    notify('🤖 AUTO HACK ENABLED!');
    renderUpgrade();
  },

  storeTab(tab) {
    currentStoreTab=tab;
    document.querySelectorAll('.store-tab').forEach((el,i)=>{
      el.classList.toggle('active',['tools','software','network'][i]===tab);
    });
    renderStore();
  },

  buyStoreItem(id) {
    SFX.click();
    let item=null;
    for(const cat of Object.values(STORE)){ item=cat.find(i=>i.id===id); if(item) break; }
    if(!item) return;
    const owned=G.storeOwned[id]||0;
    if(owned>=item.max){ notify('Maximum purchases reached!','info'); return; }
    const cost=Math.floor(item.cost*Math.pow(1.8,owned));
    if(!spendCash(cost)){ SFX.error(); notify('Not enough cash!','error'); return; }
    SFX.buy(); G.storeOwned[id]=owned+1; addExp(15);
    addTx('+'+item.name,'pos');
    notify('🛒 '+item.name+' purchased!');
    renderStore();
  },

  save() {
    try{ localStorage.setItem('nb_save_v2',JSON.stringify(G)); notify('💾 Game saved!','info'); }catch(e){}
  },

  switchRoom(room) {
    SFX.click();
    if(room==='server'&&G.level<5) { SFX.error(); notify('🔒 Unlocks at Level 5!','error'); return; }
    if(room==='mine'  &&G.level<10){ SFX.error(); notify('🔒 Unlocks at Level 10!','error'); return; }
    currentRoom=room;
    document.querySelectorAll('.room').forEach(r=>{ r.classList.remove('active'); r.style.display='none'; });
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    const roomEl=$('room-'+room);
    roomEl.style.display='flex';
    requestAnimationFrame(()=>roomEl.classList.add('active'));
    const nav=document.querySelector('[data-room="'+room+'"]');
    if(nav) nav.classList.add('active');
    if(room==='server')  renderServer();
    if(room==='mine')    renderMine();
    if(room==='wallet')  renderWallet();
    if(room==='upgrade') renderUpgrade();
    if(room==='store')   renderStore();
  },
};

/* ══════════════════════════════════════════════════
   UI STATE
══════════════════════════════════════════════════ */
let currentRoom='hack', currentStoreTab='tools';
const $=id=>document.getElementById(id);

/* ══════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════ */
const renderHUD=()=>{
  $('hud-level').textContent=G.level;
  $('hud-cash').textContent=fmt.cash(G.cash);
  $('hud-ips').textContent=fmt.cash(calcTotalIPS())+'/s';
  $('hud-okt').textContent=fmt.coin(G.crypto.okt);
  $('hud-sky').textContent=fmt.coin(G.crypto.sky);
  $('hud-nex').textContent=fmt.coin(G.crypto.nex);
  $('hud-vex').textContent=fmt.coin(G.crypto.vex);
};

const renderExpBar=()=>{
  const max=calcExpMax(G.level), pct=Math.min(100,(G.exp/max)*100);
  const bar=$('hud-exp-bar');
  if(bar){
    bar.style.cssText=`height:6px;border-radius:3px;background:linear-gradient(90deg,var(--purple) 0%,var(--purple3) ${pct}%,var(--border) ${pct}%)`;
  }
  const txt=$('hud-exp-txt');
  if(txt) txt.textContent=fmt.int(G.exp)+' / '+fmt.int(max)+' EXP';
};

const renderHackRoom=()=>{
  const p=$('hack-power'); if(p) p.textContent='+'+fmt.cash(calcHackPow());
  const e=$('hack-exp');   if(e) e.textContent='+'+Math.max(1,Math.floor(calcHackPow()*0.3))+' EXP';
  const s=$('autohack-status');
  if(s){
    if(G.autoHack) s.innerHTML='AUTO HACK: <span class="on">ACTIVE — '+fmt.cash(calcAutoRate()*calcAllMult())+'/s</span>';
    else           s.innerHTML='AUTO HACK: <span class="off">OFFLINE</span>';
  }
  const prog=$('hack-progress'); if(prog) prog.style.width=hackProgress+'%';
};

const renderServer=()=>{
  const names=['Account Hack','Pen Testing','Data Recovery','Cloud Server'];
  for(let i=0;i<4;i++){
    const lv=G.services[i], cost=Math.floor(SVC_BASE[i].cost*Math.pow(1.5,lv));
    $('svc-lv-'+i).textContent=lv;
    $('svc-cost-'+i).textContent=fmt.cash(cost);
    if(i===3) $('svc-inc-'+i).textContent='+'+(lv*25)+'% income boost';
    else{
      const inc=lv>0?SVC_BASE[i].inc*lv*(1+G.services[3]*0.25)*(1+G.hw.ram*0.15):0;
      $('svc-inc-'+i).textContent=fmt.cash(inc)+'/s';
    }
  }
  $('server-total-inc').textContent=fmt.cash(calcSvcInc())+'/s';
};

const renderMine=()=>{
  for(const c of ['okt','sky','nex','vex']){
    const lv=G.miners[c], cost=Math.floor(MINER_COST[c]*Math.pow(1.5,lv));
    $('mine-lv-'+c).textContent=lv;
    $('mine-cost-'+c).textContent=fmt.cash(cost);
    $('mine-rate-'+c).textContent=calcMineRate(c).toFixed(4)+'/s';
    const bar=$('mine-bar-'+c); if(bar) bar.style.width=Math.min(100,lv*8)+'%';
  }
};

const renderUpgrade=()=>{
  const bonusPct={cpu:50,gpu:20,ram:15,ai:10};
  for(const hw of ['cpu','gpu','ram','ai']){
    const lv=G.hw[hw], cost=Math.floor(HW_COST[hw]*Math.pow(1.5,lv));
    $(hw+'-lv').textContent=lv;
    $(hw+'-cost').textContent=fmt.cash(cost);
    $(hw+'-bonus').textContent=lv*bonusPct[hw];
  }
  const btn=$('btn-autohack');
  if(btn){
    btn.disabled=G.autoHack;
    btn.textContent=G.autoHack?'✅ AUTO HACK ACTIVE':'ENABLE AUTO HACK — '+fmt.cash(AH_COST);
  }
  const au=$('au-status-txt');
  if(au) au.innerHTML='STATUS: <span class="'+(G.autoHack?'on':'off')+'">'+(G.autoHack?'ONLINE':'OFFLINE')+'</span>';
};

const renderWallet=()=>{
  $('wallet-cash').textContent=fmt.cash(G.cash);
  $('wallet-total-ips').textContent='Income: '+fmt.cash(calcTotalIPS())+'/s';
  for(const [c,v] of Object.entries(CRYPTO_VALUE)){
    $('wallet-'+c).textContent=fmt.coin(G.crypto[c]);
    $('wallet-'+c+'-val').textContent=(G.crypto[c]*v).toFixed(2);
  }
  const nw=G.cash+Object.keys(G.crypto).reduce((s,c)=>s+G.crypto[c]*CRYPTO_VALUE[c],0);
  $('wallet-networth').textContent=fmt.cash(nw);
  renderTxLog();
};

const renderTxLog=()=>{
  const el=$('tx-log'); if(!el) return;
  el.innerHTML=G.txLog.slice(0,40).map(t=>
    `<div class="tx-entry"><span class="${t.cls}">${t.msg}</span><span style="color:var(--text-dim);font-size:10px;float:right">${new Date(t.t).toLocaleTimeString()}</span></div>`
  ).join('');
};

const renderStore=()=>{
  const el=$('store-content'); if(!el) return;
  el.innerHTML=STORE[currentStoreTab].map(item=>{
    const owned=G.storeOwned[item.id]||0, cost=Math.floor(item.cost*Math.pow(1.8,owned)), maxed=owned>=item.max;
    return `<div class="store-item">
      <div class="store-item-icon">${item.icon}</div>
      <div class="store-item-name">${item.name}</div>
      <div class="store-item-desc">${item.desc}</div>
      <div class="store-item-effect">${item.effect}</div>
      <div class="store-item-count">Owned: ${owned} / ${item.max}</div>
      <button class="btn-store-buy" onclick="game.buyStoreItem('${item.id}')" ${maxed?'disabled':''}>
        ${maxed?'✅ MAXED':'BUY — '+fmt.cash(cost)}</button>
    </div>`;
  }).join('');
};

/* ══════════════════════════════════════════════════
   TERMINAL
══════════════════════════════════════════════════ */
const addTermLine=line=>{
  const el=$('terminal-log'); if(!el) return;
  const div=document.createElement('div');
  div.style.cssText='color:var(--green);opacity:0;transition:opacity 0.3s;line-height:1.7;';
  div.textContent='> '+line;
  el.appendChild(div);
  requestAnimationFrame(()=>{ div.style.opacity='1'; });
  while(el.children.length>35) el.removeChild(el.firstChild);
  el.scrollTop=el.scrollHeight;
};

/* ══════════════════════════════════════════════════
   NOTIFICATIONS
══════════════════════════════════════════════════ */
const notify=(msg,type='')=>{
  const stack=$('notif-stack'); if(!stack) return;
  const el=document.createElement('div');
  el.className='notif'+(type?' '+type:''); el.textContent=msg;
  stack.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity 0.5s'; setTimeout(()=>el.remove(),500); },3000);
};

/* ══════════════════════════════════════════════════
   LEVEL UP OVERLAY
══════════════════════════════════════════════════ */
const showLevelUp=(lvl,unlockTxt)=>{
  const stack=$('notif-stack'); if(!stack) return;
  const el=document.createElement('div');
  el.className='notif levelup';
  el.innerHTML=`<span class="lu-n-title">▲ LEVEL UP</span><span class="lu-n-num">${lvl}</span>${unlockTxt?`<span class="lu-n-unlock">${unlockTxt}</span>`:''}`;
  stack.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity 0.5s'; setTimeout(()=>el.remove(),500); },4000);
};
const closeLevelUp=()=>{}; // no-op, kept for safety

/* ══════════════════════════════════════════════════
   CLICK POPUP
══════════════════════════════════════════════════ */
const showClickPop=amt=>{
  const btn=$('btn-hack'); if(!btn) return;
  const rect=btn.getBoundingClientRect();
  const el=document.createElement('div');
  el.className='click-pop';
  el.textContent='+'+fmt.cash(amt);
  el.style.left=(rect.left+rect.width/2-25+(Math.random()*40-20))+'px';
  el.style.top=(rect.top-10)+'px';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),900);
};

/* ══════════════════════════════════════════════════
   THREE.JS SCENES
══════════════════════════════════════════════════ */
const mkRenderer=cid=>{
  if(!window.THREE) return null;
  const canvas=$(cid); if(!canvas) return null;
  const w=canvas.parentElement?canvas.parentElement.clientWidth:window.innerWidth;
  const h=canvas.parentElement?canvas.parentElement.clientHeight:window.innerHeight;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setSize(w,h); renderer.setClearColor(0x000000,0);
  return {renderer,w,h};
};

const initHackScene=()=>{
  const r=mkRenderer('hack-canvas'); if(!r) return;
  const {renderer,w,h}=r;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(55,w/h,0.1,100);
  camera.position.set(0,1.8,6); camera.lookAt(0,0.5,0);

  // Desk
  const desk=new THREE.Mesh(new THREE.BoxGeometry(7,0.12,3),new THREE.MeshPhongMaterial({color:0x080818}));
  desk.position.y=-0.8; scene.add(desk);
  // Stand
  const sm=new THREE.MeshPhongMaterial({color:0x111125});
  const st=new THREE.Mesh(new THREE.BoxGeometry(0.14,1.4,0.14),sm); st.position.set(0,0.1,0); scene.add(st);
  const sb=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.06,0.5),sm); sb.position.set(0,-0.62,0.1); scene.add(sb);
  // Monitor
  const mon=new THREE.Mesh(new THREE.BoxGeometry(3.4,2.1,0.14),new THREE.MeshPhongMaterial({color:0x0c0c20,emissive:0x020208}));
  mon.position.set(0,1.4,0); scene.add(mon);
  // Screen surface
  const scr=new THREE.Mesh(new THREE.PlaneGeometry(3.05,1.85),new THREE.MeshBasicMaterial({color:0x001805,transparent:true,opacity:0.95}));
  scr.position.set(0,1.4,0.08); scene.add(scr);
  // Glow
  const glowMat=new THREE.MeshBasicMaterial({color:0x00ff66,transparent:true,opacity:0.06});
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(3.0,1.8),glowMat);
  glow.position.set(0,1.4,0.095); scene.add(glow);
  // Scanlines
  for(let i=0;i<18;i++){
    const sl=new THREE.Mesh(new THREE.PlaneGeometry(3.0,0.005),new THREE.MeshBasicMaterial({color:0x00ff88,transparent:true,opacity:0.035}));
    sl.position.set(0,0.55+i*0.096,0.09); scene.add(sl);
  }
  // Keyboard
  const kb=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.05,0.75),new THREE.MeshPhongMaterial({color:0x080818}));
  kb.position.set(0,-0.75,1.1); scene.add(kb);
  for(let row=0;row<4;row++) for(let col=0;col<14;col++){
    const key=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.035,0.13),new THREE.MeshPhongMaterial({color:0x0f0f28}));
    key.position.set(-0.85+col*0.145,-0.705,0.88+row*0.15); scene.add(key);
  }
  // Mouse
  const mouse=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.18,0.06,10),new THREE.MeshPhongMaterial({color:0x0c0c22}));
  mouse.position.set(1.4,-0.75,1.0); scene.add(mouse);
  // Side monitor
  const sm2=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.2,0.1),new THREE.MeshPhongMaterial({color:0x0c0c20}));
  sm2.position.set(-2.5,1.0,-0.1); sm2.rotation.y=0.3; scene.add(sm2);
  const ss=new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.05),new THREE.MeshBasicMaterial({color:0x0a001a,transparent:true,opacity:0.95}));
  ss.position.set(-2.42,1.0,-0.04); ss.rotation.y=0.3; scene.add(ss);
  // Coffee mug
  const mug=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.1,0.28,10),new THREE.MeshPhongMaterial({color:0x1a0a2a}));
  mug.position.set(1.8,-0.66,0.5); scene.add(mug);
  // Particles
  const particles=[];
  const pMat=new THREE.MeshBasicMaterial({color:0x00ff88});
  for(let i=0;i<45;i++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(0.016,4,4),pMat);
    p.position.set((Math.random()-0.5)*7,Math.random()*4-1,(Math.random()-0.5)*4);
    p._vy=0.004+Math.random()*0.008; p._vx=(Math.random()-0.5)*0.004;
    scene.add(p); particles.push(p);
  }
  // Lights
  const pl=new THREE.PointLight(0x7b2fff,2.5,10); pl.position.set(0,2,3); scene.add(pl);
  const gl=new THREE.PointLight(0x00ff88,1.2,7);  gl.position.set(-2,1,2); scene.add(gl);
  scene.add(new THREE.AmbientLight(0x040412,1.5));

  let t=0;
  (function animate(){ requestAnimationFrame(animate); t+=0.008;
    pl.intensity=2+Math.sin(t*1.5)*0.6; glowMat.opacity=0.05+Math.sin(t*4)*0.02;
    particles.forEach(p=>{ p.position.y+=p._vy; p.position.x+=p._vx;
      if(p.position.y>4) p.position.y=-1; if(Math.abs(p.position.x)>3.5) p._vx*=-1; });
    camera.position.x=Math.sin(t*0.08)*0.4; camera.lookAt(0,0.6,0);
    renderer.render(scene,camera);
  })();
};

const initServerScene=()=>{
  const r=mkRenderer('server-canvas'); if(!r) return;
  const {renderer,w,h}=r;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(60,w/h,0.1,100);
  camera.position.set(0,2,8); camera.lookAt(0,0,0);
  const rMat=new THREE.MeshPhongMaterial({color:0x080820,emissive:0x020210});
  for(let i=-2;i<=2;i++){
    const rack=new THREE.Mesh(new THREE.BoxGeometry(0.55,3.5,0.9),rMat);
    rack.position.set(i*0.8,0,0); scene.add(rack);
    for(let j=0;j<10;j++){
      const lc=j%3===0?0x00ff88:j%3===1?0x7b2fff:0x00e5ff;
      const led=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.04,0.04),new THREE.MeshBasicMaterial({color:lc}));
      led.position.set(i*0.8+0.22,-1.5+j*0.34,0.47); scene.add(led);
    }
    const cable=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,1,4),new THREE.MeshPhongMaterial({color:0x7b2fff}));
    cable.position.set(i*0.8+0.3,-1.8,0.5); cable.rotation.x=Math.PI/2; scene.add(cable);
  }
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(6,4),new THREE.MeshBasicMaterial({color:0x7b2fff,transparent:true,opacity:0.04}));
  floor.rotation.x=-Math.PI/2; floor.position.y=-1.76; scene.add(floor);
  const pl=new THREE.PointLight(0x7b2fff,2,12); pl.position.set(0,3,3); scene.add(pl);
  scene.add(new THREE.PointLight(0x00e5ff,0.8,8));
  scene.add(new THREE.AmbientLight(0x030318,1.2));
  let t=0;
  (function animate(){ requestAnimationFrame(animate); t+=0.008;
    pl.intensity=1.8+Math.sin(t)*0.6; camera.position.x=Math.sin(t*0.12)*1.5;
    camera.lookAt(0,0,0); renderer.render(scene,camera);
  })();
};

const initMineScene=()=>{
  const r=mkRenderer('mine-canvas'); if(!r) return;
  const {renderer,w,h}=r;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(60,w/h,0.1,100);
  camera.position.set(0,1.5,7); camera.lookAt(0,0,0);
  const rigColors=[0xf5a623,0x4fc3f7,0xce93d8,0xef9a9a];
  const lights=[];
  for(let ri=0;ri<4;ri++){
    const x=(ri%2-0.5)*3, y=(Math.floor(ri/2)-0.5)*2;
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.3,0.8,0.3),new THREE.MeshPhongMaterial({color:0x0a0a22}));
    frame.position.set(x,y,0); scene.add(frame);
    for(let g=0;g<3;g++){
      const gpu=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.6,0.06),new THREE.MeshPhongMaterial({color:0x0d0d25}));
      gpu.position.set(x-0.35+g*0.35,y,0.19); scene.add(gpu);
      const fan=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.02,8),new THREE.MeshBasicMaterial({color:rigColors[ri],transparent:true,opacity:0.4}));
      fan.position.set(x-0.35+g*0.35,y,0.22); fan.rotation.x=Math.PI/2; scene.add(fan);
    }
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.7),new THREE.MeshBasicMaterial({color:rigColors[ri],transparent:true,opacity:0.12}));
    glow.position.set(x,y,0.16); scene.add(glow);
    const l=new THREE.PointLight(rigColors[ri],0.8,4); l.position.set(x,y,1.5); scene.add(l); lights.push(l);
  }
  scene.add(new THREE.AmbientLight(0x030315,1.2));
  let t=0;
  (function animate(){ requestAnimationFrame(animate); t+=0.01;
    lights.forEach((l,i)=>{ l.intensity=0.6+Math.sin(t*2+i*1.5)*0.3; });
    camera.position.x=Math.sin(t*0.1)*1.2; camera.lookAt(0,0,0);
    renderer.render(scene,camera);
  })();
};

const initUpgradeScene=()=>{
  const r=mkRenderer('upgrade-canvas'); if(!r) return;
  const {renderer,w,h}=r;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(55,w/h,0.1,100);
  camera.position.set(0,1.5,7); camera.lookAt(0,0,0);
  const tower=new THREE.Mesh(new THREE.BoxGeometry(1.6,3,1),new THREE.MeshPhongMaterial({color:0x09091e,emissive:0x030312}));
  scene.add(tower);
  const glassMat=new THREE.MeshBasicMaterial({color:0x7b2fff,transparent:true,opacity:0.08});
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(0.8,2.6),glassMat);
  glass.position.set(0,0,0.51); scene.add(glass);
  const mobo=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.8,0.04),new THREE.MeshPhongMaterial({color:0x061e06,emissive:0x010e01}));
  mobo.position.set(0,-0.3,0.3); scene.add(mobo);
  const fanMesh=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.05,12),new THREE.MeshPhongMaterial({color:0x0c0c22}));
  fanMesh.position.set(0,0.5,0.3); fanMesh.rotation.x=Math.PI/2; scene.add(fanMesh);
  for(let i=0;i<8;i++){
    const led=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.05),new THREE.MeshBasicMaterial({color:0x7b2fff}));
    led.position.set(-0.8,-1.3+i*0.37,0.5); scene.add(led);
  }
  const pl=new THREE.PointLight(0x7b2fff,3,7); pl.position.set(0,0,2.5); scene.add(pl);
  scene.add(new THREE.PointLight(0x00e5ff,0.5,4));
  scene.add(new THREE.AmbientLight(0x040416,1.5));
  let t=0;
  (function animate(){ requestAnimationFrame(animate); t+=0.01;
    pl.intensity=2.5+Math.sin(t*2)*0.8; glassMat.opacity=0.07+Math.sin(t*3)*0.03;
    fanMesh.rotation.z+=0.05; tower.rotation.y=Math.sin(t*0.15)*0.25;
    renderer.render(scene,camera);
  })();
};

/* ══════════════════════════════════════════════════
   SAVE / LOAD
══════════════════════════════════════════════════ */
const SAVE_KEY='nb_save_v2';
const saveGame=()=>{ try{ localStorage.setItem(SAVE_KEY,JSON.stringify(G)); }catch(e){} };
const loadGame=()=>{
  try{
    const raw=localStorage.getItem(SAVE_KEY); if(!raw) return false;
    const data=JSON.parse(raw);
    Object.assign(G,mkState(),data);
    // Ensure nested objects are correct
    if(!G.crypto) G.crypto={okt:0,sky:0,nex:0,vex:0};
    if(!G.hw)     G.hw={cpu:0,gpu:0,ram:0,ai:0};
    if(!G.miners) G.miners={okt:0,sky:0,nex:0,vex:0};
    if(!G.storeOwned) G.storeOwned={};
    if(!G.txLog) G.txLog=[];
    // Clamp exp to never exceed current level max (prevents ghost level-ups on load)
    G.exp = Math.min(G.exp, calcExpMax(G.level) - 1);
    if(G.exp < 0) G.exp = 0;
    return true;
  }catch(e){ return false; }
};

/* ══════════════════════════════════════════════════
   MAIN LOOP
══════════════════════════════════════════════════ */
let lastTick=0, firstTick=true;
const gameTick=now=>{
  requestAnimationFrame(gameTick);
  if(firstTick){ lastTick=now; firstTick=false; return; }
  const dt=Math.min((now-lastTick)/1000,0.1); lastTick=now;
  // Income
  const ips=calcTotalIPS();
  if(ips>0){ addCash(ips*dt); addExp(ips*dt*0.008); }
  // Crypto mining
  for(const c of ['okt','sky','nex','vex']){
    const rate=calcMineRate(c);
    if(rate>0) G.crypto[c]+=rate*dt;
  }
  // Hack progress decay
  if(hackProgress>0) hackProgress=Math.max(0,hackProgress-12*dt);
  // Render
  renderHUD();
  if(currentRoom==='hack')    renderHackRoom();
  if(currentRoom==='wallet')  renderWallet();
  if(currentRoom==='server')  renderServer();
  if(currentRoom==='mine')    renderMine();
};

/* ══════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════ */
const BOOT_MSGS=[
  'Initializing kernel...','Loading exploit modules...',
  'Bypassing firewall rules...','Establishing VPN tunnel...',
  'Connecting to dark network...','System READY — Welcome, hacker.',
];

window.addEventListener('DOMContentLoaded',()=>{
  const bootBar=$('boot-bar'), bootStatus=$('boot-status');
  let step=0;
  const doStep=()=>{
    bootBar.style.width=(++step/BOOT_MSGS.length*100)+'%';
    bootStatus.textContent=BOOT_MSGS[Math.min(step-1,BOOT_MSGS.length-1)];
    if(step<BOOT_MSGS.length) setTimeout(doStep,260+Math.random()*120);
    else setTimeout(()=>{
      const bs=$('boot-screen');
      bs.style.transition='opacity 0.6s'; bs.style.opacity='0';
      setTimeout(()=>{ bs.style.display='none'; $('app').style.display='flex'; startGame(); },600);
    },600);
  };
  setTimeout(doStep,300);
});

const startGame=()=>{
  const loaded=loadGame();
  checkNavUnlocks();
  // Init Three.js
  setTimeout(()=>{ initHackScene(); initServerScene(); initMineScene(); initUpgradeScene(); },150);
  // Initial renders
  renderHUD(); renderExpBar(); renderHackRoom(); renderStore();
  // Terminal boot lines
  const bootLines=[
    'Netbreaker OS v2.0 loaded.','Neural interface connected.',
    'Scanning local network...', loaded?'Session restored. Welcome back.':'New session started. Good luck.',
    'Press [HACK] to begin operations.',
  ];
  bootLines.forEach((l,i)=>setTimeout(()=>addTermLine(l),i*500));
  if(!loaded) addTx('+Session started','pos');
  // Target rotation
  const rotTarget=()=>{ const t=$('hack-target'); if(t) t.textContent=TARGETS[Math.floor(Math.random()*TARGETS.length)]; };
  setInterval(rotTarget,4000+Math.random()*2000); rotTarget();
  // Autosave
  setInterval(saveGame,5000);
  // Passive terminal (auto hack)
  setInterval(()=>{ if(G.autoHack&&Math.random()<0.4) addTermLine(HACK_LINES[Math.floor(Math.random()*HACK_LINES.length)]); },2200);
  if(loaded) notify('💾 Save restored. Welcome back!','info');
  // Wire up Continue button (legacy safety)
  const luBtn=$('btn-levelup-continue');
  if(luBtn) luBtn.addEventListener('click', closeLevelUp);
  // Start loop
  lastTick=performance.now(); requestAnimationFrame(gameTick);
};
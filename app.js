const phases = [
 {n:1,w:[1,2],name:"Retorno à aceleração",intensity:"70–80%",desc:"Readaptação ao impacto e à aceleração. Sem sprint máximo.",minSessions:3,maxAvgPain:2,maxAvgBack:2,maxAvgRpe:8},
 {n:2,w:[3,5],name:"Construção de velocidade",intensity:"80–88%",desc:"Aumentar distância ou tempo de esforço sem perder técnica.",minSessions:4,maxAvgPain:2,maxAvgBack:2,maxAvgRpe:8},
 {n:3,w:[6,8],name:"Repeated Sprint Ability",intensity:"85–92%",desc:"Aprender a repetir esforços curtos mantendo qualidade.",minSessions:4,maxAvgPain:2,maxAvgBack:2,maxAvgRpe:8.5},
 {n:4,w:[9,11],name:"Específico de rugby",intensity:"90–95%",desc:"Mais especificidade, aceleração e mudança de direção controlada.",minSessions:4,maxAvgPain:2,maxAvgBack:2,maxAvgRpe:9},
 {n:5,w:[12,99],name:"Polimento / taper",intensity:"85–95%",desc:"Reduzir volume e preservar velocidade para chegar fresca.",minSessions:2,maxAvgPain:2,maxAvgBack:2,maxAvgRpe:9}
];

let settings = JSON.parse(localStorage.getItem("lancaSettings") || localStorage.getItem("rugbyV2Settings") || "{}");
let history = JSON.parse(localStorage.getItem("lancaHistory") || localStorage.getItem("rugbyV2History") || "[]");
let state = {place:"treadmill", after:"yes", readiness:"green"};
let timerSteps=[], stepIndex=0, remaining=0, totalStep=1, timerId=null, running=false;

const $=id=>document.getElementById(id);

function escapeHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function dateOnly(s){return new Date(s+"T12:00:00")}
function getWeek(){
  const start=dateOnly(settings.startDate||"2026-08-18");
  return Math.max(1,Math.floor((new Date()-start)/604800000)+1);
}
function plannedPhase(){ return phaseForWeek(getWeek()) }
function phaseHistory(n){
  return history.filter(h => (h.phase||1)===n);
}
function phaseMetrics(n){
  const p=phases.find(x=>x.n===n) || phases[0];
  const rows=phaseHistory(n);
  const valid=rows.filter(h => h.completed!==false);
  const avg = key => valid.length ? valid.reduce((a,b)=>a+(+b[key]||0),0)/valid.length : null;
  return {
    p,
    count: valid.length,
    avgPain: avg("pain"),
    avgBack: avg("back"),
    avgRpe: avg("rpe"),
    criteriaMet:
      valid.length>=p.minSessions &&
      (avg("pain")===null || avg("pain")<=p.maxAvgPain) &&
      (avg("back")===null || avg("back")<=p.maxAvgBack) &&
      (avg("rpe")===null || avg("rpe")<=p.maxAvgRpe)
  };
}
function highestUnlockedPhase(){
  const planned=plannedPhase().n;
  let unlocked=1;
  for(let n=1;n<Math.min(planned,5);n++){
    const m=phaseMetrics(n);
    if(m.criteriaMet) unlocked=n+1;
    else break;
  }
  return Math.min(unlocked, planned);
}
function phase(){ return phases.find(p=>p.n===highestUnlockedPhase()) || phases[0] }
function nextPhaseProgress(){
  const current=phase(), planned=plannedPhase();
  const m=phaseMetrics(current.n);
  const canAdvanceByDate = planned.n>current.n;
  return {current,planned,m,canAdvanceByDate,ready:m.criteriaMet && canAdvanceByDate};
}

function intensityLabel(){return phase().intensity}
function isReduced(){
  return state.readiness==="yellow" || (state.after==="yes" && +$("fatigue").value>=5);
}
function buildSession(){
  const p=phase(), reduced=isReduced(), place=state.place;
  const target=Math.min(30,+(settings.preferredDuration||25));
  let rows=[], est=0;

  if(place==="treadmill"){
    if(p.n===1){
      rows=[["Aquecimento","4 min caminhada ativa"],["Preparação","3 min mobilidade + marcha/skipping leve"],["Tiros",`${reduced?4:6} × 10–12 s • RPE 6–7/10`],["Recuperação","50–60 s caminhando"],["Final","3 min caminhada leve"]]; est=reduced?16:20;
    } else if(p.n===2){
      rows=[["Aquecimento","4 min"],["Preparação","3 min"],["Tiros",`${reduced?5:7} × 12–15 s • RPE 7–8/10`],["Recuperação","50–60 s"],["Final","3 min"]]; est=reduced?18:22;
    } else if(p.n===3){
      rows=[["Aquecimento","4 min"],["Preparação","3 min"],["Bloco principal",`${reduced?1:2} × ${reduced?4:5} tiros de 12 s`],["Entre tiros","35–45 s caminhando"],["Entre séries","2 min"],["Final","3 min"]]; est=reduced?18:24;
    } else if(p.n===4){
      rows=[["Aquecimento","4 min"],["Preparação","3 min"],["Tiros fortes",`${reduced?5:7} × 12–15 s • RPE 8–9/10`],["Recuperação","45–60 s"],["Final","3 min"]]; est=reduced?19:24;
    } else {
      rows=[["Aquecimento","4 min"],["Preparação","3 min"],["Tiros",`${reduced?4:5} × 10–12 s • rápidos, sem exaustão`],["Recuperação","60 s"],["Final","3 min"]]; est=reduced?17:20;
    }
  } else {
    if(p.n===1){
      rows=[["Aquecimento","4 min caminhada/trote muito leve"],["Preparação","3 min mobilidade + 2 progressivos"],["Acelerações",`${reduced?4:6} × 10 m • 70–80%`],["Recuperação","volta caminhando + 45–60 s"],["Final","3 min caminhada"]]; est=reduced?16:20;
    } else if(p.n===2){
      rows=[["Aquecimento","4 min"],["Preparação","3 min"],["Acelerações",`${reduced?5:6} × 15 m`],["Tiros",`${reduced?2:3} × 20 m`],["Recuperação","60–90 s"],["Final","3 min"]]; est=reduced?19:24;
    } else if(p.n===3){
      rows=[["Aquecimento","4 min"],["Preparação","3 min"],["Repeated sprint",`${reduced?1:2} × ${reduced?4:5} tiros de 5–6 s`],["Entre tiros","20–25 s andando"],["Entre séries","2,5–3 min"],["Final","3 min"]]; est=reduced?18:24;
    } else if(p.n===4){
      rows=[["Aquecimento","4 min"],["Preparação","3 min"],["Acelerações",`${reduced?4:5} × 20 m`],["Mudança de direção",`${reduced?0:4} × 10–15 m, apenas se joelho verde`],["Recuperação","60–90 s"],["Final","3 min"]]; est=reduced?18:25;
    } else {
      rows=[["Aquecimento","4 min"],["Preparação","3 min"],["Tiros",`${reduced?3:4} × 20 m`],["Repeated sprint",`${reduced?0:1} × 4 tiros de 5 s`],["Final","3 min"]]; est=reduced?17:21;
    }
  }

  if(target===20 && est>20){ est=20; rows.push(["Ajuste automático","cortar 1–2 repetições para fechar em 20 min"]); }
  if(target===25 && est>25){ est=25; rows.push(["Ajuste automático","reduzir última série para fechar em 25 min"]); }

  return {rows,est,reduced};
}

function render(){
  const p=phase(), s=buildSession(), prog=nextPhaseProgress();
  $("weekHero").textContent=getWeek();
  $("phaseHero").textContent="F"+p.n;
  $("totalHero").textContent=history.length;
  $("phaseBadge").textContent=`FASE ${p.n} • ${p.intensity}`;
  $("phaseTitle").textContent=p.name;
  $("phaseDesc").textContent=p.desc;

  const m=prog.m;
  $("phaseSessions").textContent=`${m.count}/${p.minSessions}`;
  $("phasePain").textContent=m.avgPain===null?"—":m.avgPain.toFixed(1);
  $("phaseRpe").textContent=m.avgRpe===null?"—":m.avgRpe.toFixed(1);
  const ps=$("progressionStatus");
  if(prog.ready){
    ps.className="status green";
    ps.textContent=`LIBERADA — critérios da Fase ${p.n} cumpridos e calendário já permite avançar para a Fase ${Math.min(5,p.n+1)}.`;
  }else if(prog.planned.n>p.n){
    const missing=Math.max(0,p.minSessions-m.count);
    let reasons=[];
    if(missing>0) reasons.push(`${missing} sessão(ões) válida(s)`);
    if(m.avgPain!==null && m.avgPain>p.maxAvgPain) reasons.push("reduzir média de dor no joelho");
    if(m.avgBack!==null && m.avgBack>p.maxAvgBack) reasons.push("reduzir média de desconforto lombar");
    if(m.avgRpe!==null && m.avgRpe>p.maxAvgRpe) reasons.push("reduzir carga percebida");
    ps.className="status yellow";
    ps.textContent=`BLOQUEADA — o calendário já aponta Fase ${prog.planned.n}, mas você permanece na Fase ${p.n}. Falta: ${reasons.length?reasons.join("; "):"cumprir os critérios da fase atual"}.`;
  }else{
    ps.className="status yellow";
    ps.textContent=`EM ANDAMENTO — Fase ${p.n}. O calendário ainda não exige avanço. Complete pelo menos ${p.minSessions} sessões com boa resposta antes da próxima janela.`;
  }

  let h=`<div class="session"><div class="session-head"><div><span class="badge">${state.place==="treadmill"?"ESTEIRA":"SOCIETY"}</span><div class="big">${s.reduced?"Sessão reduzida":"Sessão padrão"}</div></div><div><b>~${s.est} min</b><div class="note">${p.intensity}</div></div></div>`;
  s.rows.forEach(r=>h+=`<div class="ex"><div>${r[0]}</div><small>${r[1]}</small></div>`);
  h+="</div>";
  $("sessionCard").innerHTML=h;

  $("phaseList").innerHTML=phases.slice(0,5).map(x=>`<div class="phase"><div class="dot ${x.n===p.n?"on":""}"></div><div><b>Fase ${x.n} — ${x.name}</b><div class="note">Semanas ${x.w[0]}${x.w[1]<90?"–"+x.w[1]:"+"} • ${x.intensity}<br>${x.desc}</div></div></div>`).join("");
  renderHistory();
}

function readiness(){
  const k=+$("knee").value,b=+$("back").value,f=+$("fatigue").value,s=+$("sleep").value, box=$("readinessStatus");
  if(k>=5||b>=5){
    state.readiness="red";box.className="status red";box.textContent="VERMELHO — hoje sem tiros. Se houver piora, inchaço, falseio, travamento ou sintomas neurológicos, interrompa impacto e procure avaliação.";
    $("startWorkout").disabled=true;
  }else if(k>=3||b>=3||f>=7||s<=4){
    state.readiness="yellow";box.className="status yellow";box.textContent="AMARELO — sessão automaticamente reduzida. Sem sprint máximo e sem mudança de direção.";
    $("startWorkout").disabled=false;
  }else{
    state.readiness="green";box.className="status green";box.textContent="VERDE — sessão liberada. Se for após musculação e as pernas estiverem pesadas, o volume será reduzido.";
    $("startWorkout").disabled=false;
  }
  render();
}

["knee","back","fatigue","sleep"].forEach(id=>{
  const el=$(id), out=$(id+"Val");
  el.addEventListener("input",()=>{out.textContent=el.value;readiness()});
});

document.querySelectorAll("[data-place]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-place]").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");state.place=b.dataset.place;render();
});
document.querySelectorAll("[data-after]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-after]").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");state.after=b.dataset.after;render();
});
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>switchTab(t.dataset.tab));
function switchTab(id){
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));
  document.querySelectorAll("section").forEach(x=>x.classList.toggle("active-section",x.id===id));
}

function createTimer(){
  const p=phase(), reduced=buildSession().reduced, place=state.place;
  let reps, work, rest;
  if(place==="treadmill"){
    reps = p.n===1?(reduced?4:6):p.n===2?(reduced?5:7):p.n===3?(reduced?4:5):p.n===4?(reduced?5:7):(reduced?4:5);
    work = p.n===1?12:p.n===2?15:p.n===3?12:p.n===4?15:12;
    rest = p.n<=2?55:p.n===3?40:55;
  }else{
    reps = p.n===1?(reduced?4:6):p.n===2?(reduced?5:7):p.n===3?(reduced?4:5):p.n===4?(reduced?4:5):(reduced?3:4);
    work = p.n<=2?6:p.n===3?6:7;
    rest = p.n===1?55:p.n===2?70:p.n===3?25:75;
  }
  timerSteps=[{name:"Aquecimento",type:"AQUECER",sec:240},{name:"Preparação",type:"PREPARAR",sec:180}];
  for(let i=1;i<=reps;i++){
    timerSteps.push({name:`Tiro ${i}/${reps}`,type:"TIRO",sec:work});
    if(i<reps) timerSteps.push({name:"Recuperação",type:"RECUPERAR",sec:rest});
  }
  timerSteps.push({name:"Volta à calma",type:"FINAL",sec:180});
  stepIndex=0;loadStep();switchTab("timer");
}
function loadStep(){
  if(stepIndex>=timerSteps.length){finishTimer();return}
  const st=timerSteps[stepIndex];remaining=st.sec;totalStep=st.sec;
  $("timerTitle").textContent=st.name;$("timerType").textContent=st.type;updateClock();
}
function updateClock(){
  const m=Math.floor(remaining/60),s=remaining%60;
  $("clock").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
  $("timerBar").style.width=(100*(1-remaining/totalStep))+"%";
  $("timerMeta").textContent=`Etapa ${stepIndex+1} de ${timerSteps.length} • ${state.place==="treadmill"?"Esteira":"Society"}`;
}
function signal(){
  if(navigator.vibrate) navigator.vibrate([160,70,160]);
  try{const ac=new (window.AudioContext||window.webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);o.frequency.value=900;g.gain.value=.07;o.start();o.stop(ac.currentTime+.15)}catch(e){}
}
function tick(){
  if(remaining>0){remaining--;updateClock();return}
  signal();stepIndex++;loadStep();
}
function finishTimer(){
  clearInterval(timerId);timerId=null;running=false;$("timerType").textContent="CONCLUÍDO";$("timerTitle").textContent="Treino finalizado";$("clock").textContent="✓";$("timerBar").style.width="100%";$("timerMeta").textContent="Registre RPE e resposta do joelho/lombar.";
}
$("startWorkout").onclick=createTimer;
$("timerStart").onclick=()=>{if(!timerSteps.length)createTimer();if(running)return;running=true;timerId=setInterval(tick,1000)};
$("timerPause").onclick=()=>{running=false;clearInterval(timerId);timerId=null};
$("timerReset").onclick=()=>{running=false;clearInterval(timerId);timerId=null;timerSteps=[];stepIndex=0;remaining=0;$("clock").textContent="00:00";$("timerTitle").textContent='Selecione “Iniciar treino”';$("timerType").textContent="PRONTO";$("timerBar").style.width="0"};

function renderHistory(){
  $("histTotal").textContent=history.length;
  $("histRpe").textContent=history.length?(history.reduce((a,b)=>a+b.rpe,0)/history.length).toFixed(1):"—";
  $("histPain").textContent=history.length?(history.reduce((a,b)=>a+b.pain,0)/history.length).toFixed(1):"—";
  $("historyList").innerHTML=history.length?history.slice(0,12).map(h=>`<div class="hist"><b>${new Date(h.date).toLocaleDateString("pt-BR")} • Fase ${h.phase||1} • ${h.place==="treadmill"?"Esteira":"Society"}</b><br>RPE ${h.rpe}/10 • joelho ${h.pain}/10 • lombar ${h.back}/10${h.note?`<br><span class="note">${escapeHTML(h.note)}</span>`:""}</div>`).join(""):"Nenhum treino registrado.";
}
$("saveSession").onclick=()=>{
  history.unshift({date:new Date().toISOString(),phase:phase().n,completed:true,place:state.place,after:state.after,rpe:+$("rpe").value,pain:+$("postPain").value,back:+$("postBack").value,note:$("note").value.trim()});
  history=history.slice(0,100);localStorage.setItem("lancaHistory",JSON.stringify(history));$("note").value="";render();
};

$("startDate").value=settings.startDate||"2026-08-18";
$("targetDate").value=settings.targetDate||"2026-11-15";
$("preferredDuration").value=settings.preferredDuration||"25";
$("saveSettings").onclick=()=>{
  settings={startDate:$("startDate").value,targetDate:$("targetDate").value,preferredDuration:$("preferredDuration").value};
  localStorage.setItem("lancaSettings",JSON.stringify(settings));render();alert("Ajustes salvos.");
};

readiness();render();

let deferredInstallPrompt = null;
function updateConnectivityUI(){
  const badge = document.getElementById("offlineBadge");
  if(!badge) return;
  badge.textContent = navigator.onLine ? "OFFLINE OK" : "SEM REDE";
  badge.classList.toggle("offline-ok", navigator.onLine);
  badge.classList.toggle("offline-off", !navigator.onLine);
}
window.addEventListener("online", updateConnectivityUI);
window.addEventListener("offline", updateConnectivityUI);
updateConnectivityUI();

window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById("installApp");
  if(btn) btn.style.display = "inline-block";
});
window.addEventListener("appinstalled", ()=>{
  const btn = document.getElementById("installApp");
  if(btn) btn.style.display = "none";
  deferredInstallPrompt = null;
});
const installButton = document.getElementById("installApp");
if(installButton){
  installButton.addEventListener("click", async ()=>{
    if(!deferredInstallPrompt){
      alert("Use a opção de instalação do navegador para adicionar o app à tela inicial.");
      return;
    }
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch(e) {}
    deferredInstallPrompt = null;
    installButton.style.display = "none";
  });
}
if("serviceWorker" in navigator){
  window.addEventListener("load", async ()=>{
    try{
      await navigator.serviceWorker.register("./service-worker.js");
    }catch(err){
      console.error("Falha no Service Worker:", err);
    }
  });
}
const updateButton = document.getElementById("checkUpdate");
if(updateButton){
  updateButton.addEventListener("click", async ()=>{
    const out = document.getElementById("updateStatus");
    try{
      const reg = await navigator.serviceWorker.getRegistration();
      if(!reg){ out.textContent = "O aplicativo ainda não está registrado para uso offline."; return; }
      await reg.update();
      out.textContent = "Verificação concluída. Se houver nova versão, ela será aplicada ao reabrir o app.";
    }catch(e){
      out.textContent = "Não foi possível verificar atualização agora.";
    }
  });
}
const clearLocalDataButton = document.getElementById("clearLocalData");
if(clearLocalDataButton){
  clearLocalDataButton.addEventListener("click", ()=>{
    if(!confirm("Apagar deste aparelho todo o histórico e os ajustes do Rugby Sprint Prep?")) return;
    localStorage.removeItem("lancaHistory");
    localStorage.removeItem("lancaSettings");
    localStorage.removeItem("rugbyV2History");
    localStorage.removeItem("rugbyV2Settings");
    location.reload();
  });
}

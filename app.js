const phases = [
 {n:1,w:[1,2],name:"Retorno à aceleração",intensity:"70–80%",desc:"Readaptação ao impacto e à aceleração. Sem sprint máximo.",minSessions:3,maxAvgPain:2,maxAvgBack:2},
 {n:2,w:[3,5],name:"Construção de velocidade",intensity:"80–88%",desc:"Aumentar distância ou tempo de esforço sem perder técnica.",minSessions:4,maxAvgPain:2,maxAvgBack:2},
 {n:3,w:[6,8],name:"Repeated Sprint Ability",intensity:"85–92%",desc:"Aprender a repetir esforços curtos mantendo qualidade.",minSessions:4,maxAvgPain:2,maxAvgBack:2},
 {n:4,w:[9,11],name:"Específico de rugby",intensity:"90–95%",desc:"Mais especificidade, aceleração e mudança de direção controlada.",minSessions:4,maxAvgPain:2,maxAvgBack:2},
 {n:5,w:[12,99],name:"Polimento / taper",intensity:"85–95%",desc:"Reduzir volume e preservar velocidade para chegar fresca.",minSessions:2,maxAvgPain:2,maxAvgBack:2}
];

function safeJSONParse(raw, fallback){
  try { return raw ? JSON.parse(raw) : fallback; } catch(e) { return fallback; }
}
let settings = safeJSONParse(localStorage.getItem("lancaSettings") || localStorage.getItem("rugbyV2Settings"), {});
let history = safeJSONParse(localStorage.getItem("lancaHistory") || localStorage.getItem("rugbyV2History"), []);
if(!Array.isArray(history)) history = [];
if(!settings || typeof settings !== "object" || Array.isArray(settings)) settings = {};
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
function phaseForWeek(week){
  return phases.find(p => week >= p.w[0] && week <= p.w[1]) || phases[phases.length - 1];
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
    criteriaMet:
      valid.length>=p.minSessions &&
      (avg("pain")===null || avg("pain")<=p.maxAvgPain) &&
      (avg("back")===null || avg("back")<=p.maxAvgBack)
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

function treadmillReferenceSpeed(){
  const cal = settings.treadmillCalibration;
  const v = cal && parseFloat(cal.speed);
  return Number.isFinite(v) && v >= 7 && v <= 15 ? v : null;
}
function treadmillSpeedRange(){
  const ref = treadmillReferenceSpeed();
  const p = phase();
  if(!ref) return null;
  const factors = {
    1:[0.70,0.80],
    2:[0.80,0.88],
    3:[0.85,0.92],
    4:[0.90,0.95],
    5:[0.85,0.95]
  };
  const f = factors[p.n] || factors[1];
  const reduction = isReduced() ? 0.92 : 1;
  const min = Math.round(ref*f[0]*reduction*10)/10;
  const max = Math.round(ref*f[1]*reduction*10)/10;
  return {min,max,ref};
}
function treadmillSpeedText(){
  const r = treadmillSpeedRange();
  return r ? `${r.min.toFixed(1)}–${r.max.toFixed(1)} km/h` : "Calibre a esteira em Ajustes";
}
function isReduced(){
  return state.readiness==="yellow" || (state.after==="yes" && +$("fatigue").value>=5);
}




function societySpeedGuidance(){
  const p=phase().n;
  const yellow=isReduced();
  const normal = {
    1:"70–80% da sua velocidade máxima",
    2:"80–85% da sua velocidade máxima",
    3:"85–90% da sua velocidade máxima",
    4:"90–95% da sua velocidade máxima",
    5:"85–92% da sua velocidade máxima"
  };
  const reduced = {
    1:"65–75% da sua velocidade máxima",
    2:"70–80% da sua velocidade máxima",
    3:"75–85% da sua velocidade máxima",
    4:"80–88% da sua velocidade máxima",
    5:"75–85% da sua velocidade máxima"
  };
  return (yellow ? reduced : normal)[p];
}

function recoveryText(secMin, secMax){
  return `${secMin}–${secMax} s a partir do fim da desaceleração final`;
}

function recentSessionTypes(){
  return history.slice(0,4).map(h=>h.sessionType).filter(Boolean);
}

function pickVariant(options){
  const recent=recentSessionTypes();
  const unused=options.find(o=>!recent.includes(o.id));
  return unused || options[history.length % options.length];
}


function canChangeDirection(){
  return state.readiness==="green" && state.after==="no" && +$("fatigue").value<5 && +$("sleep").value>=5;
}

function societyPatternSpeed(kind="straight"){
  const p=phase().n;
  if(kind==="cod"){
    const v={2:"70–80%",3:"75–85%",4:"80–90%",5:"80–88%"};
    return `${v[p]||"70–80%"} da sua velocidade máxima`;
  }
  if(kind==="reactive"){
    const v={4:"75–85%",5:"75–85%"};
    return `${v[p]||"75–85%"} da sua velocidade máxima`;
  }
  return societySpeedGuidance();
}

function intensityExplanation(text){
  if(text.includes("65–75")) return "rápido, porém confortável e totalmente controlado; deve sobrar margem clara para acelerar mais.";
  if(text.includes("70–80")) return "rápido e controlado; claramente acima de um trote, mas ainda longe de um sprint máximo.";
  if(text.includes("75–85")) return "forte, mantendo controle para frear e mudar direção sem desequilíbrio.";
  if(text.includes("80–85")) return "forte, com alguma margem para acelerar mais; não é máximo.";
  if(text.includes("80–88")) return "forte e próximo de ritmo específico, mas sem buscar 100%.";
  if(text.includes("85–90")) return "muito rápido, mantendo técnica; ainda não é sprint máximo.";
  if(text.includes("90–95")) return "próximo do máximo, reservado a condição VERDE e execução estável.";
  if(text.includes("85–92")) return "rápido, com volume baixo e técnica preservada.";
  return "use a faixa indicada como referência prática, sem transformar o exercício em teste máximo.";
}

function fieldBlocks(label,reps,rest,labels){
  return [{label,reps,rest,labels:labels||null}];
}

function societyVariants(p,reduced){
  const cod=canChangeDirection() && !reduced;
  if(p===1){
    return reduced ? [
      {id:"f1-acc10-r",title:"Aceleração curta controlada",rows:[
        ["Aquecimento","4 min caminhada + mobilidade dinâmica","warmup-field"],
        ["Preparação","2 passagens progressivas de 10 m","progressive-pass"],
        ["Acelerações",`4 × 10 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
        ["Desaceleração","5 m após cada tiro","deceleration"],
        ["Recuperação",recoveryText(45,60),"recovery-field"],
        ["Final","3 min caminhada","cooldown"]
      ],est:16,timerBlocks:fieldBlocks("Aceleração 10 m",4,55)},
      {id:"f1-acc8-r",title:"Arranque controlado",rows:[
        ["Aquecimento","4 min caminhada + mobilidade dinâmica","warmup-field"],
        ["Preparação","2 passagens progressivas de 8 m","progressive-pass"],
        ["Acelerações",`5 × 8 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
        ["Desaceleração","5 m após cada tiro","deceleration"],
        ["Recuperação",recoveryText(45,60),"recovery-field"],
        ["Final","3 min caminhada","cooldown"]
      ],est:16,timerBlocks:fieldBlocks("Aceleração 8 m",5,55)}
    ] : [
      {id:"f1-acc10",title:"Aceleração curta",rows:[
        ["Aquecimento","4 min caminhada + mobilidade dinâmica","warmup-field"],
        ["Preparação","2 passagens progressivas de 10 m","progressive-pass"],
        ["Acelerações",`6 × 10 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
        ["Desaceleração","5 m após cada tiro","deceleration"],
        ["Recuperação",recoveryText(45,60),"recovery-field"],
        ["Final","3 min caminhada","cooldown"]
      ],est:20,timerBlocks:fieldBlocks("Aceleração 10 m",6,55)},
      {id:"f1-acc12",title:"Aceleração progressiva",rows:[
        ["Aquecimento","4 min caminhada + mobilidade dinâmica","warmup-field"],
        ["Preparação","2 passagens progressivas de 10 m","progressive-pass"],
        ["Acelerações",`5 × 12 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
        ["Desaceleração","5 m após cada tiro","deceleration"],
        ["Recuperação",recoveryText(50,65),"recovery-field"],
        ["Final","3 min caminhada","cooldown"]
      ],est:20,timerBlocks:fieldBlocks("Aceleração 12 m",5,60)}
    ];
  }

  if(p===2){
    const linear = reduced ? [
      {id:"f2-acc15-r",title:"Aceleração média",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 12 m","progressive-pass"],
        ["Acelerações",`5 × 15 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
        ["Desaceleração","5 m","deceleration"],["Recuperação",recoveryText(60,75),"recovery-field"],["Final","3 min","cooldown"]
      ],est:18,timerBlocks:fieldBlocks("Aceleração 15 m",5,70)},
      {id:"f2-ladder-r",title:"Escada curta",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 10 m","progressive-pass"],
        ["Acelerações",`3 × 10 m + 2 × 15 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
        ["Desaceleração","5 m após cada tiro","deceleration"],["Recuperação",recoveryText(60,75),"recovery-field"],["Final","3 min","cooldown"]
      ],est:18,timerBlocks:[{label:"Escada curta",reps:5,rest:70,labels:["10 m","10 m","10 m","15 m","15 m"]}]}
    ] : [
      {id:"f2-acc15-20",title:"Aceleração + extensão",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
        ["Acelerações",`5 × 15 m + 2 × 20 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
        ["Desaceleração","5 m","deceleration"],["Recuperação",recoveryText(60,90),"recovery-field"],["Final","3 min","cooldown"]
      ],est:23,timerBlocks:[{label:"Aceleração",reps:7,rest:75,labels:["15 m","15 m","15 m","15 m","15 m","20 m","20 m"]}]},
      {id:"f2-ladder",title:"Escada de aceleração",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 10 m","progressive-pass"],
        ["Acelerações",`2 × 10 m + 2 × 15 m + 2 × 20 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
        ["Desaceleração","5 m","deceleration"],["Recuperação",recoveryText(60,90),"recovery-field"],["Final","3 min","cooldown"]
      ],est:23,timerBlocks:[{label:"Escada",reps:6,rest:75,labels:["10 m","10 m","15 m","15 m","20 m","20 m"]}]}
    ];
    if(cod){
      linear.push({id:"f2-cut45",title:"Introdução ao corte de 45°",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 12 m","progressive-pass"],
        ["Corte de 45°",`4 × percurso • ${societyPatternSpeed("cod")}`,"cut45"],
        ["Recuperação",recoveryText(60,75),"recovery-field"],["Final","3 min","cooldown"]
      ],est:19,timerBlocks:fieldBlocks("Corte de 45°",4,70)});
    }
    return linear;
  }

  if(p===3){
    const linear=[
      {id:"f3-rsa",title:reduced?"Repetição curta controlada":"Sprints repetidos",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
        ["Sprints repetidos",`${reduced?"1 × 4":"2 × 4"} tiros de 15 m • ${societyPatternSpeed("straight")}`,"repeated-sprint"],
        ["Entre tiros",recoveryText(reduced?35:25,reduced?45:30),"recovery-field"],
        ...(reduced?[]:[["Entre séries","2,5–3 min caminhando","series-recovery"]]),
        ["Final","3 min","cooldown"]
      ],est:reduced?18:24,timerBlocks:reduced?
        fieldBlocks("Tiro repetido 15 m",4,40):
        [{label:"Série 1 • 15 m",reps:4,rest:28},{label:"Série 2 • 15 m",reps:4,rest:28,before:165}]},
      {id:"f3-mix",title:"Repetição mista",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
        ["Sprints repetidos",`${reduced?"3 × 15 m + 2 × 20 m":"4 × 15 m + 3 × 20 m"} • ${societyPatternSpeed("straight")}`,"repeated-sprint"],
        ["Entre tiros",recoveryText(reduced?40:30,reduced?50:40),"recovery-field"],["Final","3 min","cooldown"]
      ],est:reduced?18:23,timerBlocks:[{label:"Repetição mista",reps:reduced?5:7,rest:reduced?45:35,
        labels:reduced?["15 m","15 m","15 m","20 m","20 m"]:["15 m","15 m","15 m","15 m","20 m","20 m","20 m"]}]}
    ];
    if(cod){
      linear.push(
        {id:"f3-z",title:"Z planejado",rows:[
          ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
          ["Circuito em Z",`4 repetições • ${societyPatternSpeed("cod")}`,"z-drill"],
          ["Recuperação",recoveryText(75,90),"recovery-field"],["Final","3 min","cooldown"]
        ],est:21,timerBlocks:fieldBlocks("Circuito em Z",4,80)},
        {id:"f3-shuttle",title:"Shuttle + giro de 180°",rows:[
          ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 12 m","progressive-pass"],
          ["Shuttle 180°",`4 × 5 m ida + 5 m volta • ${societyPatternSpeed("cod")}`,"shuttle180"],
          ["Recuperação",recoveryText(75,90),"recovery-field"],["Final","3 min","cooldown"]
        ],est:20,timerBlocks:fieldBlocks("Shuttle 180°",4,80)},
        {id:"f3-cut90",title:"Corte de 90° + lateral",rows:[
          ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 12 m","progressive-pass"],
          ["Corte de 90°",`4 repetições • ${societyPatternSpeed("cod")}`,"cut90"],
          ["Shuffle lateral","3 × 5 m para cada lado","shuffle"],
          ["Recuperação",recoveryText(75,90),"recovery-field"],["Final","3 min","cooldown"]
        ],est:22,timerBlocks:[{label:"Corte de 90°",reps:4,rest:80},{label:"Shuffle lateral",reps:3,rest:60,before:90}]}
      );
    }
    return linear;
  }

  if(p===4){
    if(reduced){
      return [
        {id:"f4-reduced",title:"Aceleração específica reduzida",rows:[
          ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
          ["Acelerações",`4 × 15 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
          ["Desaceleração","5 m","deceleration"],["Recuperação",recoveryText(75,90),"recovery-field"],["Final","3 min","cooldown"]
        ],est:18,timerBlocks:fieldBlocks("Aceleração 15 m",4,80)}
      ];
    }
    if(!cod){
      return [
        {id:"f4-linear",title:"Velocidade específica linear",rows:[
          ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 20 m","progressive-pass"],
          ["Acelerações",`4 × 20 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
          ["Desaceleração","5 m","deceleration"],["Recuperação",recoveryText(75,90),"recovery-field"],["Final","3 min","cooldown"]
        ],est:20,timerBlocks:fieldBlocks("Aceleração 20 m",4,80)}
      ];
    }
    return [
      {id:"f4-z-t",title:"Z + T simplificado",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
        ["Circuito em Z",`3 repetições • ${societyPatternSpeed("cod")}`,"z-drill"],
        ["T drill simplificado",`3 repetições • ${societyPatternSpeed("cod")}`,"t-drill"],
        ["Recuperação",recoveryText(75,90),"recovery-field"],["Final","3 min","cooldown"]
      ],est:25,timerBlocks:[{label:"Circuito em Z",reps:3,rest:80},{label:"T drill",reps:3,rest:90,before:120}]},
      {id:"f4-y-plan",title:"Y planejado + aceleração",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
        ["Y planejado",`4 repetições alternando lados • ${societyPatternSpeed("cod")}`,"y-planned"],
        ["Acelerações",`3 × 20 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
        ["Recuperação",recoveryText(75,90),"recovery-field"],["Final","3 min","cooldown"]
      ],est:24,timerBlocks:[{label:"Y planejado",reps:4,rest:80},{label:"Aceleração 20 m",reps:3,rest:80,before:120}]},
      {id:"f4-y-react",title:"Y reativo solo",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
        ["Y reativo",`4 repetições • ${societyPatternSpeed("reactive")}`,"y-reactive"],
        ["Recuperação",recoveryText(90,105),"recovery-field"],["Final","3 min","cooldown"]
      ],est:21,timerBlocks:fieldBlocks("Y reativo",4,95)},
      {id:"f4-multi",title:"Sequência multidirecional",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
        ["Sequência rugby",`4 repetições • ${societyPatternSpeed("cod")}`,"multi-direction"],
        ["Recuperação",recoveryText(90,105),"recovery-field"],["Final","3 min","cooldown"]
      ],est:22,timerBlocks:fieldBlocks("Sequência multidirecional",4,95)}
    ];
  }

  // Fase 5 — volume menor, preservando velocidade e familiaridade com direção.
  if(reduced){
    return [
      {id:"f5-reduced",title:"Polimento reduzido",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 12 m","progressive-pass"],
        ["Tiros",`3 × 15 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
        ["Desaceleração","5 m","deceleration"],["Recuperação",recoveryText(90,105),"recovery-field"],["Final","3 min","cooldown"]
      ],est:17,timerBlocks:fieldBlocks("Tiro 15 m",3,95)}
    ];
  }
  if(!cod){
    return [
      {id:"f5-straight",title:"Polimento linear",rows:[
        ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
        ["Tiros",`4 × 20 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
        ["Desaceleração","5 m","deceleration"],["Recuperação",recoveryText(75,90),"recovery-field"],["Final","3 min","cooldown"]
      ],est:19,timerBlocks:fieldBlocks("Tiro 20 m",4,80)}
    ];
  }
  return [
    {id:"f5-straight",title:"Polimento linear",rows:[
      ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
      ["Tiros",`4 × 20 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
      ["Recuperação",recoveryText(75,90),"recovery-field"],["Final","3 min","cooldown"]
    ],est:19,timerBlocks:fieldBlocks("Tiro 20 m",4,80)},
    {id:"f5-z",title:"Polimento com Z",rows:[
      ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
      ["Circuito em Z",`3 repetições • ${societyPatternSpeed("cod")}`,"z-drill"],
      ["Acelerações",`2 × 15 m • ${societyPatternSpeed("straight")}`,"accel-straight"],
      ["Recuperação",recoveryText(90,105),"recovery-field"],["Final","3 min","cooldown"]
    ],est:20,timerBlocks:[{label:"Circuito em Z",reps:3,rest:95},{label:"Aceleração 15 m",reps:2,rest:90,before:120}]},
    {id:"f5-cut45",title:"Polimento de corte",rows:[
      ["Aquecimento","4 min","warmup-field"],["Preparação","2 progressivos de 15 m","progressive-pass"],
      ["Corte de 45°",`3 repetições por lado • ${societyPatternSpeed("cod")}`,"cut45"],
      ["Recuperação",recoveryText(90,105),"recovery-field"],["Final","3 min","cooldown"]
    ],est:20,timerBlocks:fieldBlocks("Corte de 45°",6,95)}
  ];
}

const exerciseLibrary = {
  "warmup-field":{
    name:"Aquecimento de campo",group:"Preparação",availability:"F1–F5 • sessão liberada",animation:"warmup",
    objective:"Elevar gradualmente a temperatura corporal e preparar tornozelos, joelhos, quadril e padrão de corrida.",
    setup:"Use um corredor livre de aproximadamente 10–15 m. Não precisa de cones.",
    steps:[
      "Caminhe de forma contínua por cerca de 2 min.",
      "Nos 2 min seguintes, mantenha deslocamento leve e acrescente mobilidade dinâmica: tornozelos, elevação alternada de joelhos, calcanhar em direção ao glúteo e abertura de quadril.",
      "Termine ainda confortável; o aquecimento não deve parecer o treino principal."
    ],
    errors:["Começar já correndo forte.","Fazer alongamentos longos e parados no lugar do aquecimento dinâmico.","Transformar o aquecimento em exercício cansativo."],
    stop:"Interrompa se o aquecimento aumentar claramente dor, causar tontura ou alterar sua marcha."
  },
  "progressive-pass":{
    name:"Passagem progressiva",group:"Preparação",availability:"F1–F5 • antes dos esforços rápidos",animation:"straight",
    objective:"Preparar a mecânica de aceleração antes do bloco principal.",
    setup:"Marque a distância indicada pelo treino com dois cones/objetos.",
    steps:[
      "Comece em corrida leve.",
      "Aumente a velocidade gradualmente ao longo do percurso.",
      "A primeira passagem é mais leve; a segunda pode ser um pouco mais rápida.",
      "Não transforme essas passagens em sprints."
    ],
    errors:["Sair forte demais no primeiro passo.","Frear exatamente sobre a linha final.","Usar a preparação para competir com o próprio tempo."],
    stop:"Se a passada ficar irregular ou surgir dor crescente, não avance para os tiros principais."
  },
  "accel-straight":{
    name:"Aceleração em linha reta",group:"Aceleração",availability:"F1–F5 • verde ou amarelo conforme prescrição",animation:"straight-decel",
    objective:"Melhorar a capacidade de ganhar velocidade em distâncias curtas, importante em ações de rugby.",
    setup:"Marque INÍCIO, FIM DO TIRO e uma zona extra de 5 m para desacelerar.",
    steps:[
      "Posicione-se atrás da linha inicial em postura confortável.",
      "Comece a correr e aumente a velocidade progressivamente; não tente atingir o máximo no primeiro passo.",
      "Ao longo da distância, mantenha braços ativos e passada controlada.",
      "Cruze a linha do tiro sem frear.",
      "Use os 5 m seguintes para reduzir gradualmente a velocidade."
    ],
    errors:["Sair a 100% quando o treino pede velocidade controlada.","Olhar para os pés.","Frear bruscamente na linha do tiro.","Continuar acelerando dentro da zona de desaceleração."],
    stop:"Pare a série se houver dor, falseio, desequilíbrio ou perda clara do padrão de corrida."
  },
  "deceleration":{
    name:"Zona de desaceleração",group:"Desaceleração",availability:"F1–F5 • após acelerações",animation:"decel",
    objective:"Aprender a reduzir velocidade sem uma frenagem abrupta.",
    setup:"Reserve 5 m livres depois da linha principal do tiro.",
    steps:[
      "Cruze a linha principal ainda correndo.",
      "Nos 5 m seguintes, reduza a velocidade progressivamente.",
      "Encurte as passadas aos poucos e mantenha o tronco controlado.",
      "Termine caminhando; não pare de uma vez."
    ],
    errors:["Plantar um pé e travar o corpo na linha.","Inclinar o tronco exageradamente para trás.","Usar os 5 m extras como continuação do sprint."],
    stop:"Interrompa se não conseguir frear com controle ou se aparecer dor durante a frenagem."
  },
  "recovery-field":{
    name:"Recuperação caminhando",group:"Recuperação",availability:"F1–F5",animation:"recovery",
    objective:"Recuperar o suficiente para que a próxima repetição mantenha boa qualidade.",
    setup:"Nenhuma montagem extra.",
    steps:[
      "A contagem começa assim que termina a desaceleração final. Nos tiros retos, isso significa depois dos 5 m extras.",
      "Volte caminhando ao ponto inicial durante esse intervalo.",
      "Se chegar antes do fim do tempo, continue caminhando devagar ou aguarde.",
      "Só comece a próxima repetição quando o intervalo terminar."
    ],
    errors:["Começar a contar apenas depois de voltar ao início.","Voltar correndo.","Cortar o intervalo para terminar mais rápido."],
    stop:"Se mesmo após o intervalo você não se sentir pronta para repetir com controle, aumente a pausa ou encerre o bloco."
  },
  "series-recovery":{
    name:"Recuperação entre séries",group:"Recuperação",availability:"F3–F5",animation:"recovery",
    objective:"Separar blocos de esforços repetidos para preservar a qualidade do segundo bloco.",
    setup:"Permaneça caminhando em área segura.",
    steps:["Comece a contar ao concluir a última repetição da série.","Caminhe durante o intervalo inteiro.","Só inicie a série seguinte quando o tempo terminar."],
    errors:["Transformar a pausa em corrida leve.","Encurtar a recuperação porque a respiração já normalizou."],
    stop:"Se a técnica já estiver deteriorada antes da nova série, encerre o bloco."
  },
  "repeated-sprint":{
    name:"Sprints repetidos",group:"Velocidade repetida",availability:"F3–F5 • linear; condição do dia define volume",animation:"repeat",
    objective:"Treinar a capacidade de repetir esforços curtos com recuperação incompleta sem perder totalmente a qualidade.",
    setup:"Monte um corredor reto com a distância indicada e mantenha 5 m livres depois da linha para desacelerar.",
    steps:[
      "Execute cada tiro na faixa de velocidade indicada.",
      "Desacelere nos 5 m extras.",
      "A recuperação começa ao terminar a desaceleração.",
      "Volte caminhando e respeite o intervalo curto.",
      "Quando houver duas séries, faça também a recuperação maior entre elas."
    ],
    errors:["Transformar a primeira repetição em sprint máximo.","Ignorar queda grande de técnica nas repetições seguintes.","Eliminar a recuperação curta."],
    stop:"Encerre o bloco se a velocidade ou a técnica cair claramente, ou se surgir dor/desequilíbrio."
  },
  "cut45":{
    name:"Corte planejado de 45°",group:"Mudança de direção",availability:"F2–F5 • somente VERDE • não após musculação",animation:"cut45",
    objective:"Aprender a desacelerar, mudar a direção em ângulo moderado e reacelerar.",
    setup:"Cone A = início. Cone B = 8 m à frente. Cone C = 5 m na diagonal de aproximadamente 45° a partir de B. Alterne o lado entre repetições.",
    steps:[
      "Acelere de A para B dentro da intensidade indicada.",
      "Antes de B, reduza um pouco a velocidade com passos menores.",
      "Abaixe levemente o centro de massa e mantenha joelho e pé alinhados.",
      "Faça o corte em direção a C sem contornar o cone em uma curva grande.",
      "Reacelere por 5 m após o corte e depois desacelere."
    ],
    errors:["Chegar ao cone rápido demais para conseguir cortar com controle.","Fazer uma curva arredondada em vez de mudar direção.","Deixar o joelho colapsar para dentro.","Olhar apenas para o chão."],
    stop:"Pare se houver dor, falseio, perda de equilíbrio ou incapacidade de realizar o corte de forma controlada."
  },
  "cut90":{
    name:"Corte planejado de 90°",group:"Mudança de direção",availability:"F3–F5 • somente VERDE • não após musculação",animation:"cut90",
    objective:"Treinar uma desaceleração mais exigente seguida de mudança lateral e reaceleração.",
    setup:"Cone A = início. Cone B = 8 m à frente. Cone C = 5 m exatamente à esquerda ou à direita de B.",
    steps:[
      "Corra de A para B sem buscar velocidade máxima.",
      "Reduza a velocidade antes do cone B.",
      "Faça passos menores na aproximação e organize o corpo para a nova direção.",
      "Corte 90° e acelere até C.",
      "Depois de C, use espaço livre para desacelerar gradualmente."
    ],
    errors:["Tentar fazer o corte a 100%.","Girar sobre um pé rígido sem reduzir velocidade.","Cruzar a trajetória dos pés de forma descontrolada."],
    stop:"Interrompa se a frenagem ou a mudança de direção causar dor ou instabilidade."
  },
  "shuttle180":{
    name:"Shuttle de 180°",group:"Mudança de direção",availability:"F3–F5 • somente VERDE • não após musculação",animation:"shuttle",
    objective:"Praticar ida, frenagem, giro de 180° e reaceleração em curta distância.",
    setup:"Dois cones separados por 5 m.",
    steps:[
      "Saia do cone A em direção ao B.",
      "Reduza antes de B; não chegue travando o corpo.",
      "Faça o giro de 180° com passos curtos e controle.",
      "Reacelere de volta ao cone A.",
      "Após cruzar A, desacelere em espaço livre."
    ],
    errors:["Tocar o chão obrigatoriamente e perder postura.","Girar com o pé preso e joelho rodando para dentro.","Chegar ao cone sem desacelerar."],
    stop:"Pare se o giro causar dor, sensação de falseio ou perda de equilíbrio."
  },
  "shuffle":{
    name:"Shuffle lateral",group:"Deslocamento lateral",availability:"F3–F5 • somente VERDE • não após musculação",animation:"shuffle",
    objective:"Treinar deslocamento lateral curto mantendo o corpo preparado para reagir.",
    setup:"Dois cones separados por 5 m.",
    steps:[
      "Fique de lado para a direção do deslocamento, joelhos levemente flexionados.",
      "Empurre o chão com a perna oposta à direção do movimento.",
      "Desloque-se lateralmente sem cruzar os pés.",
      "Mantenha peito e quadril relativamente voltados para frente.",
      "Pare com controle antes de inverter o sentido."
    ],
    errors:["Cruzar os pés.","Saltar alto em cada passo.","Juntar completamente os pés e perder base."],
    stop:"Pare se houver dor lateral no joelho, tornozelo instável ou dificuldade de manter o equilíbrio."
  },
  "z-drill":{
    name:"Circuito em Z",group:"Agilidade planejada",availability:"F3–F5 • somente VERDE • não após musculação",animation:"z",
    objective:"Combinar aceleração, desaceleração, cortes sucessivos e reaceleração em trajetória típica de evasão.",
    setup:"Use 4 cones em zigue-zague. Deixe aproximadamente 5 m na diagonal entre cada cone. Numere 1 → 2 → 3 → 4.",
    steps:[
      "Saia do cone 1 em direção ao 2.",
      "Antes do 2, reduza a velocidade com passos menores.",
      "Mude a direção e reacelere para o 3.",
      "Repita a mesma lógica do 3 para o 4.",
      "Depois do cone 4, continue alguns metros e desacelere progressivamente."
    ],
    errors:["Transformar cada mudança em curva ampla.","Entrar em todos os cones na velocidade máxima.","Olhar só para o cone e perder postura.","Frear em um único passo."],
    stop:"Pare se os cortes deixarem de ser controlados, se houver dor ou se você começar a escorregar."
  },
  "t-drill":{
    name:"T drill simplificado",group:"Agilidade planejada",availability:"F3–F5 • somente VERDE • não após musculação",animation:"t",
    objective:"Combinar aceleração frontal, deslocamento lateral e retorno controlado.",
    setup:"Cone A = início. Cone B = 5 m à frente. A partir de B, coloque C 5 m à esquerda e D 5 m à direita, formando um T.",
    steps:[
      "Acelere de A para B.",
      "Em B, reduza e faça shuffle lateral até C.",
      "Mude o sentido e faça shuffle de C até D, passando por B.",
      "Volte lateralmente de D até B.",
      "De B, retorne até A em backpedal controlado. Antes de iniciar, confirme que a área atrás de você está livre."
    ],
    errors:["Cruzar os pés no trecho lateral.","Fazer o trecho de costas rápido demais.","Virar o corpo inteiro durante o shuffle."],
    stop:"Pare se não conseguir manter controle lateral ou se o backpedal causar insegurança."
  },
  "y-planned":{
    name:"Y planejado",group:"Agilidade planejada",availability:"F4–F5 • somente VERDE • não após musculação",animation:"y",
    objective:"Treinar aproximação, decisão já conhecida e corte para um dos lados.",
    setup:"Cone A = início. Cone B = 8 m à frente. De B, coloque C e D a 5 m em diagonais esquerda/direita, formando um Y. Deixe cerca de 5 m livres depois de C e D para desacelerar.",
    steps:[
      "Antes de começar, defina esquerda ou direita.",
      "Acelere de A para B.",
      "Reduza ligeiramente antes de B.",
      "Faça o corte para o lado escolhido e reacelere até C ou D.",
      "Alterne os lados nas repetições."
    ],
    errors:["Mudar o lado durante a corrida — isso pertence ao exercício reativo.","Chegar ao B em velocidade incompatível com o corte.","Fazer curva grande."],
    stop:"Pare se houver dor, instabilidade ou dificuldade em frear antes do corte."
  },
  "y-reactive":{
    name:"Y reativo solo",group:"Agilidade reativa",availability:"F4 • somente VERDE • não após musculação",animation:"y-reactive",
    objective:"Adicionar um estímulo inesperado para escolher a direção durante a aproximação, aproximando o treino da necessidade de reagir no rugby.",
    setup:"Monte um Y com 10 m até o cone de decisão B e 5 m para cada diagonal. Deixe espaço livre para desacelerar após as diagonais. Posicione o celular visível próximo ou logo atrás de B.",
    steps:[
      "Toque em “Gerar estímulo” e vá para a posição inicial durante a contagem.",
      "No sinal VAI, comece a correr em direção a B.",
      "A seta aparece cerca de 1,2 s depois do VAI; reaja para ESQUERDA ou DIREITA.",
      "Reduza antes de B, faça o corte e reacelere pela diagonal indicada.",
      "Se a seta aparecer cedo ou tarde demais para a sua distância, ajuste a posição inicial na próxima repetição."
    ],
    errors:["Olhar para o celular o tempo inteiro em vez de usar visão periférica.","Tentar fazer a primeira sessão perto do máximo.","Sacrificar a técnica para obedecer à seta."],
    stop:"Se o estímulo atrapalhar sua segurança ou você não conseguir enxergar a tela sem perder o controle do percurso, use o Y planejado.",
    reactive:true
  },
  "multi-direction":{
    name:"Sequência multidirecional",group:"Rugby específico",availability:"F4 • somente VERDE • não após musculação",animation:"multi",
    objective:"Encadear aceleração, desaceleração, recuo e deslocamento lateral antes de uma nova aceleração.",
    setup:"Monte um quadrado de 5 × 5 m e deixe mais 5 m livres à frente da saída final.",
    steps:[
      "Acelere 5 m para frente.",
      "Desacelere e faça backpedal controlado por aproximadamente 3 m.",
      "Faça shuffle lateral por 5 m sem cruzar os pés.",
      "Reoriente o corpo e acelere 5 m para frente.",
      "Desacelere progressivamente após a saída."
    ],
    errors:["Fazer todas as transições na velocidade máxima.","Cruzar os pés no trecho lateral.","Correr de costas sem olhar/garantir área livre.","Frear de maneira brusca."],
    stop:"Pare se perder a orientação espacial, equilíbrio ou segurança em qualquer transição."
  },
  "warmup-treadmill":{
    name:"Aquecimento na esteira",group:"Esteira",availability:"F1–F5",animation:"treadmill",
    objective:"Preparar o corpo antes dos blocos mais rápidos.",
    setup:"Esteira em velocidade confortável de caminhada.",
    steps:["Caminhe de forma contínua pelo tempo indicado.","Mantenha postura natural e não segure nos apoios, salvo necessidade imediata de segurança.","Nos minutos finais, prepare-se para aumentar gradualmente a velocidade."],
    errors:["Começar o bloco rápido sem aquecer.","Segurar continuamente nos apoios.","Aumentar inclinação ou velocidade sem prescrição."],
    stop:"Pare se houver tontura, desequilíbrio ou dor crescente."
  },
  "treadmill-prep":{
    name:"Preparação na esteira",group:"Esteira",availability:"F1–F5",animation:"treadmill",
    objective:"Fazer a transição entre caminhada e os tiros prescritos.",
    setup:"Use a própria esteira; não altere a inclinação se o treino não pedir.",
    steps:["Faça marcha ativa e corrida muito leve conforme a sessão.","Teste os comandos de aumento/redução de velocidade antes do primeiro tiro.","Comece o bloco principal apenas quando estiver estável."],
    errors:["Descobrir os comandos da esteira já durante o tiro.","Pular para as laterais da lona."],
    stop:"Se não conseguir alterar a velocidade com segurança, não execute os tiros."
  },
  "treadmill-work":{
    name:"Tiro na esteira",group:"Esteira",availability:"F1–F5 • requer calibração",animation:"treadmill-fast",
    objective:"Treinar velocidade em ambiente linear com intensidade definida em km/h pelo LANÇA.",
    setup:"Use a faixa de km/h mostrada na prescrição do dia.",
    steps:["Parta da velocidade de recuperação.","Aumente pelos controles até a faixa indicada.","Conte o tempo do tiro depois de atingir a faixa prescrita.","Corra no centro da lona sem segurar nos apoios.","Ao terminar, reduza a velocidade pelos controles até caminhar."],
    errors:["Saltar para as laterais com a lona rápida.","Usar km/h acima da faixa porque o primeiro tiro parece fácil.","Segurar nos apoios durante o tiro."],
    stop:"Interrompa se houver desequilíbrio, necessidade de segurar, tontura, falta de ar incomum ou dor."
  },
  "treadmill-recovery":{
    name:"Recuperação na esteira",group:"Esteira",availability:"F1–F5",animation:"treadmill",
    objective:"Reduzir a carga entre tiros sem sair da esteira.",
    setup:"Reduza a velocidade pelos controles para uma caminhada confortável.",
    steps:["Comece a recuperação ao terminar o tiro e iniciar a redução de velocidade.","Caminhe durante todo o intervalo.","Aumente novamente apenas quando o próximo tiro começar."],
    errors:["Saltar da lona.","Manter corrida leve quando a sessão pede caminhada.","Encurtar o intervalo."],
    stop:"Se não recuperar estabilidade e controle durante a caminhada, encerre o bloco."
  },
  "cooldown":{
    name:"Volta à calma",group:"Recuperação",availability:"F1–F5",animation:"recovery",
    objective:"Encerrar a sessão reduzindo gradualmente o esforço.",
    setup:"Caminhe em área livre ou na própria esteira em velocidade confortável.",
    steps:["Caminhe pelo tempo indicado.","Deixe a respiração reduzir gradualmente.","Não acrescente tiros extras depois do fim da sessão."],
    errors:["Parar imediatamente após o último esforço rápido.","Adicionar uma repetição extra para 'terminar forte'."],
    stop:"Se houver dor relevante após o treino, registre no histórico e não tente compensar com mais exercício."
  }
};

function animationSVG(type){
  const head=`<div class="exercise-animation"><svg viewBox="0 0 320 170" role="img" aria-label="Animação esquemática do trajeto">`;
  const foot=`</svg><div class="anim-caption">Trajeto animado: use para entender a ordem e a direção. Não é uma representação exata da postura corporal.</div></div>`;
  const dot=(path,dur="4s")=>`<circle class="runner" r="7"><animateMotion class="motion-anim" dur="${dur}" repeatCount="indefinite" path="${path}"/></circle>`;
  if(type==="straight"||type==="straight-decel"){
    return head+`<line class="route-line" x1="35" y1="85" x2="270" y2="85"/><circle class="cone" cx="40" cy="85" r="6"/><circle class="cone" cx="220" cy="85" r="6"/>${type==="straight-decel"?`<rect class="stop-zone" x="220" y="58" width="65" height="54" rx="8"/><text class="anim-label" x="225" y="50">desacelerar</text>`:""}<text class="anim-label" x="25" y="112">início</text><text class="anim-label" x="205" y="112">linha</text>${dot("M40,85 L275,85","3.5s")}`+foot;
  }
  if(type==="decel"){
    return head+`<line class="route-line" x1="35" y1="85" x2="285" y2="85"/><rect class="stop-zone" x="195" y="55" width="90" height="60" rx="9"/><text class="anim-label" x="202" y="47">5 m desaceleração</text>${dot("M45,85 L190,85 L215,85 L235,85 L250,85 L262,85 L270,85","4.5s")}`+foot;
  }
  if(type==="cut45"){
    return head+`<polyline class="route-line" points="40,130 175,90 270,35"/><circle class="cone" cx="40" cy="130" r="6"/><circle class="cone" cx="175" cy="90" r="6"/><circle class="cone" cx="270" cy="35" r="6"/><text class="anim-label" x="160" y="112">corte</text>${dot("M40,130 L175,90 L270,35","4s")}`+foot;
  }
  if(type==="cut90"){
    return head+`<polyline class="route-line" points="55,135 170,70 280,70"/><circle class="cone" cx="55" cy="135" r="6"/><circle class="cone" cx="170" cy="70" r="6"/><circle class="cone" cx="280" cy="70" r="6"/><text class="anim-label" x="158" y="58">90°</text>${dot("M55,135 L170,70 L280,70","4s")}`+foot;
  }
  if(type==="shuttle"){
    return head+`<line class="route-line" x1="65" y1="85" x2="255" y2="85"/><circle class="cone" cx="65" cy="85" r="6"/><circle class="cone" cx="255" cy="85" r="6"/><text class="anim-label" x="42" y="112">A</text><text class="anim-label" x="250" y="112">B</text>${dot("M65,85 L255,85 L65,85","4.5s")}`+foot;
  }
  if(type==="shuffle"){
    return head+`<line class="route-line" x1="65" y1="85" x2="255" y2="85"/><circle class="cone" cx="65" cy="85" r="6"/><circle class="cone" cx="255" cy="85" r="6"/><text class="anim-label" x="105" y="62">deslocamento lateral</text>${dot("M65,85 L255,85 L65,85","5s")}`+foot;
  }
  if(type==="z"){
    return head+`<polyline class="route-line" points="45,130 125,45 205,130 280,45"/><circle class="cone" cx="45" cy="130" r="6"/><circle class="cone" cx="125" cy="45" r="6"/><circle class="cone" cx="205" cy="130" r="6"/><circle class="cone" cx="280" cy="45" r="6"/><text class="anim-label" x="34" y="153">1</text><text class="anim-label" x="118" y="30">2</text><text class="anim-label" x="198" y="153">3</text><text class="anim-label" x="274" y="30">4</text>${dot("M45,130 L125,45 L205,130 L280,45","5s")}`+foot;
  }
  if(type==="t"){
    return head+`<polyline class="route-line" points="160,145 160,75 75,75 245,75 160,75 160,145"/><circle class="cone" cx="160" cy="145" r="6"/><circle class="cone" cx="160" cy="75" r="6"/><circle class="cone" cx="75" cy="75" r="6"/><circle class="cone" cx="245" cy="75" r="6"/><text class="anim-label" x="150" y="163">A</text><text class="anim-label" x="150" y="62">B</text><text class="anim-label" x="62" y="62">C</text><text class="anim-label" x="238" y="62">D</text>${dot("M160,145 L160,75 L75,75 L245,75 L160,75 L160,145","7s")}`+foot;
  }
  if(type==="y"||type==="y-reactive"){
    return head+`<line class="route-line" x1="160" y1="145" x2="160" y2="85"/><line class="route-line" x1="160" y1="85" x2="80" y2="35"/><line class="route-line" x1="160" y1="85" x2="240" y2="35"/><circle class="cone" cx="160" cy="145" r="6"/><circle class="cone" cx="160" cy="85" r="6"/><circle class="cone" cx="80" cy="35" r="6"/><circle class="cone" cx="240" cy="35" r="6"/><text class="anim-label" x="146" y="164">A</text><text class="anim-label" x="150" y="75">B</text>${type==="y-reactive"?`<text class="anim-label" x="52" y="22">← reação</text><text class="anim-label" x="225" y="22">reação →</text>`:""}${dot("M160,145 L160,85 L80,35","4s")}`+foot;
  }
  if(type==="multi"){
    return head+`<polyline class="route-line" points="65,135 65,55 65,105 185,105 260,50"/><circle class="cone" cx="65" cy="135" r="6"/><circle class="cone" cx="65" cy="55" r="6"/><circle class="cone" cx="65" cy="105" r="6"/><circle class="cone" cx="185" cy="105" r="6"/><circle class="cone" cx="260" cy="50" r="6"/><text class="anim-label" x="77" y="72">frente</text><text class="anim-label" x="75" y="98">recuo</text><text class="anim-label" x="112" y="126">lateral</text><text class="anim-label" x="205" y="72">acelera</text>${dot("M65,135 L65,55 L65,105 L185,105 L260,50","6s")}`+foot;
  }
  if(type==="repeat"){
    return head+`<line class="route-line" x1="45" y1="70" x2="270" y2="70"/><line class="route-soft" x1="270" y1="110" x2="45" y2="110"/><circle class="cone" cx="45" cy="70" r="6"/><circle class="cone" cx="225" cy="70" r="6"/><text class="anim-label" x="50" y="138">tiro → desacelera → volta caminhando → repete</text>${dot("M45,70 L270,70","2.8s")}`+foot;
  }
  if(type==="recovery"||type==="warmup"){
    return head+`<path class="route-soft" d="M45 95 C90 45,140 140,190 80 S260 80,285 95"/><text class="anim-label" x="70" y="145">caminhar / mobilidade leve</text>${dot("M45,95 C90,45 140,140 190,80 S260,80 285,95","6s")}`+foot;
  }
  if(type==="treadmill"||type==="treadmill-fast"){
    const dur=type==="treadmill-fast"?"1.8s":"3.8s";
    return head+`<rect x="45" y="55" width="230" height="70" rx="18" fill="#12171B" stroke="#3A4147" stroke-width="3"/><line class="route-line" x1="70" y1="90" x2="250" y2="90"/><text class="anim-label" x="100" y="145">aumente/reduza pelos controles</text>${dot("M80,90 L240,90",dur)}`+foot;
  }
  return head+`<text class="anim-label" x="55" y="85">Veja o passo a passo abaixo.</text>`+foot;
}

function listHTML(items,ordered=false){
  const tag=ordered?"ol":"ul";
  return `<${tag}>${items.map(x=>`<li>${x}</li>`).join("")}</${tag}>`;
}

function exerciseCardHTML(exId,prescription="",standalone=false){
  const ex=exerciseLibrary[exId];
  if(!ex) return `<div class="note">Orientação detalhada indisponível para esta etapa.</div>`;
  const reactive = ex.reactive ? `<div class="guide-box"><b>Modo solo</b><div>Use o estímulo aleatório do próprio LANÇA.</div><button class="mini-btn" data-reactive-cue type="button">Gerar estímulo</button><div class="cue-output" aria-live="polite">PRONTO</div></div>` : "";
  const intensity = prescription && (prescription.includes("%") || prescription.includes("km/h")) ?
    `<div class="guide-box"><b>Intensidade de hoje</b><div>${prescription.includes("%")?intensityExplanation(prescription):"Use somente a faixa de km/h calculada pelo LANÇA para esta sessão."}</div></div>` : "";
  const body=`${prescription?`<div class="exercise-prescription"><b>Prescrição de hoje:</b> ${prescription}</div>`:""}
    ${animationSVG(ex.animation)}
    <div class="guide-grid">
      <div class="guide-box"><b>Objetivo</b><div>${ex.objective}</div></div>
      <div class="guide-box"><b>Como montar</b><div>${ex.setup}</div></div>
      <div class="guide-box"><b>Passo a passo</b>${listHTML(ex.steps,true)}</div>
      ${intensity}
      <div class="guide-box"><b>Erros a evitar</b>${listHTML(ex.errors)}</div>
      <div class="guide-box"><b>Quando interromper</b><div>${ex.stop}</div></div>
      ${reactive}
    </div>`;
  if(!standalone) return body;
  return `<details class="library-card"><summary><span><b>${ex.name}</b><small>${ex.objective}</small></span><span class="safety-chip">${ex.availability}</span></summary><div class="library-body">${body}</div></details>`;
}

function exerciseIdForStep(label,place){
  if(label==="Aquecimento") return place==="treadmill"?"warmup-treadmill":"warmup-field";
  if(label==="Preparação") return place==="treadmill"?"treadmill-prep":"progressive-pass";
  if(label==="Final") return "cooldown";
  if(place==="treadmill"){
    if(label.includes("Tiro")||label==="Bloco principal") return "treadmill-work";
    if(label.includes("Recuper")||label==="Entre tiros"||label==="Entre séries") return "treadmill-recovery";
  }
  if(label==="Acelerações"||label==="Tiros") return "accel-straight";
  if(label==="Sprints repetidos") return "repeated-sprint";
  if(label==="Desaceleração"||label==="Execução") return "deceleration";
  if(label.includes("Recuper")||label==="Entre tiros") return "recovery-field";
  if(label==="Entre séries") return "series-recovery";
  return null;
}

function renderExerciseLibrary(){
  const root=$("exerciseLibrary");
  if(!root) return;
  const groups=["Preparação","Aceleração","Desaceleração","Velocidade repetida","Mudança de direção","Deslocamento lateral","Agilidade planejada","Agilidade reativa","Rugby específico","Esteira","Recuperação"];
  root.innerHTML=groups.map(group=>{
    const ids=Object.keys(exerciseLibrary).filter(id=>exerciseLibrary[id].group===group);
    if(!ids.length) return "";
    return `<div class="card library-group"><h3>${group}</h3><div class="note">Abra para ver a ficha completa.</div>${ids.map(id=>exerciseCardHTML(id,"",true)).join("")}</div>`;
  }).join("");
}

function buildSession(){
  const p=phase(), reduced=isReduced(), place=state.place;
  const target=Math.min(30,+(settings.preferredDuration||25));
  let rows=[], est=0, sessionType=null, sessionTitle=null, timerBlocks=null;

  if(state.readiness==="red"){
    return {
      rows:[],est:0,reduced:false,blocked:true,timerBlocks:null,
      reason:"O check-in de hoje bloqueou corrida rápida, acelerações e mudanças de direção."
    };
  }

  if(place==="treadmill"){
    sessionType=`treadmill-f${p.n}${reduced?"-reduced":""}`;
    sessionTitle=reduced?"Esteira reduzida":"Esteira • velocidade";
    if(p.n===1){
      rows=[["Aquecimento","4 min caminhada ativa","warmup-treadmill"],["Preparação","3 min mobilidade + marcha/skipping leve","treadmill-prep"],["Tiros",`${reduced?4:6} × 10–12 s • ${treadmillSpeedText()}`,"treadmill-work"],["Recuperação","50–60 s caminhando","treadmill-recovery"],["Final","3 min caminhada leve","cooldown"]]; est=reduced?16:20;
    } else if(p.n===2){
      rows=[["Aquecimento","4 min caminhada ativa","warmup-treadmill"],["Preparação","3 min","treadmill-prep"],["Tiros",`${reduced?5:7} × 12–15 s • ${treadmillSpeedText()}`,"treadmill-work"],["Recuperação","50–60 s caminhando","treadmill-recovery"],["Final","3 min caminhada","cooldown"]]; est=reduced?18:22;
    } else if(p.n===3){
      rows=[["Aquecimento","4 min","warmup-treadmill"],["Preparação","3 min","treadmill-prep"],["Bloco principal",`${reduced?1:2} × ${reduced?4:5} tiros de 12 s • ${treadmillSpeedText()}`,"treadmill-work"],["Entre tiros","35–45 s caminhando","treadmill-recovery"],["Entre séries","2 min caminhando","treadmill-recovery"],["Final","3 min","cooldown"]]; est=reduced?18:24;
    } else if(p.n===4){
      rows=[["Aquecimento","4 min","warmup-treadmill"],["Preparação","3 min","treadmill-prep"],["Tiros fortes",`${reduced?5:7} × 12–15 s • ${treadmillSpeedText()}`,"treadmill-work"],["Recuperação","45–60 s caminhando","treadmill-recovery"],["Final","3 min","cooldown"]]; est=reduced?19:24;
    } else {
      rows=[["Aquecimento","4 min","warmup-treadmill"],["Preparação","3 min","treadmill-prep"],["Tiros",`${reduced?4:5} × 10–12 s • ${treadmillSpeedText()}`,"treadmill-work"],["Recuperação","60 s caminhando","treadmill-recovery"],["Final","3 min","cooldown"]]; est=reduced?17:20;
    }
  } else {
    const variant=pickVariant(societyVariants(p.n,reduced));
    rows=variant.rows;est=variant.est;sessionType=variant.id;sessionTitle=variant.title;timerBlocks=variant.timerBlocks||[];
  }

  // O catálogo já mantém as sessões dentro do teto. Em preferência de 20 min,
  // sinalizamos que o usuário pode encerrar após o bloco principal se a sessão estimada for maior.
  if(target===20 && est>20){
    rows.push(["Ajuste de duração","Se atingir 20 min, encerre após a repetição em andamento e faça a volta à calma.","cooldown"]);
    est=20;
  }
  if(target===25 && est>25) est=25;

  return {rows,est,reduced,blocked:false,sessionType,sessionTitle,timerBlocks};
}

function render(){
  const p=phase(), s=buildSession(), prog=nextPhaseProgress();
  $("weekHero").textContent=getWeek();
  $("phaseHero").textContent="F"+p.n;
  $("totalHero").textContent=history.length;
  $("phaseBadge").textContent=`FASE ${p.n}`;
  $("phaseTitle").textContent=p.name;
  $("phaseDesc").textContent=p.desc;

  const m=prog.m;
  $("phaseSessions").textContent=`${m.count}/${p.minSessions}`;
  $("phasePain").textContent=m.avgPain===null?"—":m.avgPain.toFixed(1);
  $("phaseBack").textContent=m.avgBack===null?"—":m.avgBack.toFixed(1);
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
    ps.className="status yellow";
    ps.textContent=`BLOQUEADA — o calendário já aponta Fase ${prog.planned.n}, mas você permanece na Fase ${p.n}. Falta: ${reasons.length?reasons.join("; "):"cumprir os critérios da fase atual"}.`;
  }else{
    ps.className="status yellow";
    ps.textContent=`EM ANDAMENTO — Fase ${p.n}. O calendário ainda não exige avanço. Complete pelo menos ${p.minSessions} sessões com boa resposta antes da próxima janela.`;
  }

  let h="";
  if(s.blocked){
    h=`<div class="blocked-session">
      <span class="badge">SESSÃO NÃO LIBERADA</span>
      <h3 style="margin-top:10px">Hoje sem tiros</h3>
      <div class="note">${s.reason}</div>
      <div class="callout" style="margin-top:12px"><b>O que fazer:</b> não execute o treino listado para outra condição. Se caminhar aumentar sintomas, interrompa. Use o dia para recuperação e reavalie o check-in antes da próxima sessão.</div>
    </div>`;
  }else{
    h=`<div class="session"><div class="session-head"><div><span class="badge">${state.place==="treadmill"?"ESTEIRA":"SOCIETY"}</span><div class="big">${s.sessionTitle || (s.reduced?"Sessão reduzida":"Sessão padrão")}</div></div><div><b>~${s.est} min</b><div class="note">${state.place==="treadmill" ? treadmillSpeedText() : "Distância + intensidade guiada"}</div></div></div>`;
    s.rows.forEach(r=>{
      const exId=r[2]||exerciseIdForStep(r[0],state.place);
      h+=`<details class="exercise-step">
        <summary class="exercise-summary">
          <span class="step-name">${r[0]}</span>
          <span class="step-prescription">${r[1]}</span>
          <span class="how">Como fazer + animação ↓</span>
        </summary>
        <div class="exercise-help">${exerciseCardHTML(exId,r[1],false)}</div>
      </details>`;
    });
    h+="</div>";
  }
  $("sessionCard").innerHTML=h;

  $("phaseList").innerHTML=phases.slice(0,5).map(x=>`<div class="phase"><div class="dot ${x.n===p.n?"on":""}"></div><div><b>Fase ${x.n} — ${x.name}</b><div class="note">Semanas ${x.w[0]}${x.w[1]<90?"–"+x.w[1]:"+"}<br>${x.desc}</div></div></div>`).join("");
  renderExerciseLibrary();
  renderHistory();
}

function readiness(){
  const k=+$("knee").value,b=+$("back").value,f=+$("fatigue").value,s=+$("sleep").value, box=$("readinessStatus");
  if(k>=5||b>=5){
    state.readiness="red";box.className="status red";box.textContent="VERMELHO — treino de corrida rápida bloqueado hoje. O LANÇA não exibirá tiros nem permitirá iniciar o cronômetro. Se houver piora, inchaço, falseio, travamento ou sintomas neurológicos, interrompa impacto e procure avaliação.";
    $("startWorkout").disabled=true;
  }else if(k>=3||b>=3||f>=7||s<=4){
    state.readiness="yellow";box.className="status yellow";box.textContent="AMARELO — sessão reduzida. Menos repetições, ritmo controlado e sem mudança de direção. Abra “Como fazer” em cada etapa para executar exatamente o treino.";
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

function addFieldBlockSteps(block,blockIndex,totalBlocks){
  if(block.before){
    timerSteps.push({name:`Preparação para bloco ${blockIndex+1}`,type:"RECUPERAR",sec:block.before});
  }
  for(let i=0;i<block.reps;i++){
    const detail=block.labels&&block.labels[i]?` • ${block.labels[i]}`:"";
    timerSteps.push({name:`${block.label} ${i+1}/${block.reps}${detail}`,type:"EXECUTAR",manual:true});
    if(i<block.reps-1) timerSteps.push({name:"Recuperação",type:"RECUPERAR",sec:block.rest});
  }
}

function createTimer(){
  const session=buildSession();
  if(session.blocked){
    alert("O check-in de hoje não libera tiros. O cronômetro de treino não será iniciado.");
    switchTab("today");
    return;
  }
  const p=phase(), reduced=session.reduced, place=state.place;
  timerSteps=[{name:"Aquecimento",type:"AQUECER",sec:240},{name:"Preparação",type:"PREPARAR",sec:180}];

  if(place==="treadmill"){
    let reps,work,rest;
    reps=p.n===1?(reduced?4:6):p.n===2?(reduced?5:7):p.n===3?(reduced?4:5):p.n===4?(reduced?5:7):(reduced?4:5);
    work=p.n===1?12:p.n===2?15:p.n===3?12:p.n===4?15:12;
    rest=p.n<=2?55:p.n===3?40:55;
    for(let i=1;i<=reps;i++){
      timerSteps.push({name:`Tiro ${i}/${reps} • ${treadmillSpeedText()}`,type:"TIRO",sec:work});
      if(i<reps) timerSteps.push({name:"Recuperação",type:"RECUPERAR",sec:rest});
    }
  }else{
    (session.timerBlocks||[]).forEach((block,idx)=>addFieldBlockSteps(block,idx,(session.timerBlocks||[]).length));
  }

  timerSteps.push({name:"Volta à calma",type:"FINAL",sec:180});
  stepIndex=0;running=false;clearInterval(timerId);timerId=null;loadStep();switchTab("timer");
}

function stopTimerInterval(){
  running=false;
  clearInterval(timerId);
  timerId=null;
}

function loadStep(){
  stopTimerInterval();
  if(stepIndex>=timerSteps.length){finishTimer();return}
  const st=timerSteps[stepIndex];
  $("timerTitle").textContent=st.name;
  $("timerType").textContent=st.type;
  $("timerNext").style.display=st.manual?"inline-block":"none";
  $("timerStart").style.display=st.manual?"none":"inline-block";
  $("timerPause").style.display=st.manual?"none":"inline-block";
  if(st.manual){
    remaining=0;totalStep=1;
    $("clock").textContent="FAÇA";
    $("clock").classList.add("timer-manual");
    $("timerBar").style.width="0";
    $("timerMeta").textContent=`Etapa ${stepIndex+1} de ${timerSteps.length} • Faça a repetição conforme a ficha e toque em “Concluí a repetição” quando terminar a desaceleração final.`;
  }else{
    $("clock").classList.remove("timer-manual");
    remaining=st.sec;totalStep=Math.max(1,st.sec);updateClock();
  }
}

function updateClock(){
  const st=timerSteps[stepIndex];
  if(st&&st.manual) return;
  const m=Math.floor(remaining/60),s=remaining%60;
  $("clock").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
  $("timerBar").style.width=(100*(1-remaining/totalStep))+"%";
  $("timerMeta").textContent=`Etapa ${stepIndex+1} de ${timerSteps.length} • ${state.place==="treadmill"?"Esteira":"Society"} • o intervalo começa ao final da etapa anterior.`;
}
function signal(){
  if(navigator.vibrate) navigator.vibrate([160,70,160]);
  try{const ac=new (window.AudioContext||window.webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);o.frequency.value=900;g.gain.value=.07;o.start();o.stop(ac.currentTime+.15)}catch(e){}
}
function tick(){
  const st=timerSteps[stepIndex];
  if(!st||st.manual){stopTimerInterval();return}
  if(remaining>0){remaining--;updateClock();return}
  signal();stepIndex++;loadStep();
  const next=timerSteps[stepIndex];
  if(next && !next.manual){
    running=true;
    timerId=setInterval(tick,1000);
  }
}
function finishTimer(){
  stopTimerInterval();
  $("timerType").textContent="CONCLUÍDO";$("timerTitle").textContent="Treino finalizado";$("clock").classList.remove("timer-manual");$("clock").textContent="✓";$("timerBar").style.width="100%";$("timerMeta").textContent="Registre a conclusão dos tiros e a resposta do joelho/lombar.";
  $("timerNext").style.display="none";$("timerStart").style.display="none";$("timerPause").style.display="none";
}
$("startWorkout").onclick=()=>{
  if(state.place==="treadmill" && !treadmillReferenceSpeed()){
    openCalibration();return;
  }
  createTimer();
};
$("timerStart").onclick=()=>{
  if(!timerSteps.length) createTimer();
  const st=timerSteps[stepIndex];
  if(!st||st.manual||running)return;
  running=true;timerId=setInterval(tick,1000);
};
$("timerPause").onclick=()=>stopTimerInterval();
$("timerNext").onclick=()=>{
  const st=timerSteps[stepIndex];
  if(!st||!st.manual)return;
  signal();stepIndex++;loadStep();
  const next=timerSteps[stepIndex];
  if(next && !next.manual){
    running=true;timerId=setInterval(tick,1000);
  }
};
$("timerReset").onclick=()=>{
  stopTimerInterval();timerSteps=[];stepIndex=0;remaining=0;
  $("clock").classList.remove("timer-manual");$("clock").textContent="00:00";$("timerTitle").textContent='Selecione “Iniciar treino”';$("timerType").textContent="PRONTO";$("timerBar").style.width="0";
  $("timerNext").style.display="none";$("timerStart").style.display="inline-block";$("timerPause").style.display="inline-block";
};

// Estímulo solo para Y reativo: contagem para permitir que a pessoa se posicione,
// saída em "VAI" e direção revelada logo depois. É um recurso prático, não um teste validado.
document.addEventListener("click",e=>{
  const btn=e.target.closest("[data-reactive-cue]");
  if(!btn)return;
  const help=btn.closest(".exercise-help")||btn.closest(".library-body");
  const out=help&&help.querySelector(".cue-output");
  if(!out)return;
  btn.disabled=true;
  let count=3;
  out.textContent=String(count);
  const countdown=setInterval(()=>{
    count--;
    if(count>0){out.textContent=String(count);return}
    clearInterval(countdown);
    out.textContent="VAI";
    signal();
    setTimeout(()=>{
      const left=Math.random()<0.5;
      out.textContent=left?"← ESQUERDA":"DIREITA →";
      signal();
      setTimeout(()=>{btn.disabled=false;},1800);
    },1200);
  },1000);
});


function renderHistory(){
  $("histTotal").textContent=history.length;
  $("histBack").textContent=history.length?(history.reduce((a,b)=>a+(+b.back||0),0)/history.length).toFixed(1):"—";
  $("histPain").textContent=history.length?(history.reduce((a,b)=>a+b.pain,0)/history.length).toFixed(1):"—";
  $("historyList").innerHTML=history.length?history.slice(0,12).map(h=>`<div class="hist"><b>${new Date(h.date).toLocaleDateString("pt-BR")} • Fase ${h.phase||1} • ${h.place==="treadmill"?"Esteira":"Society"}</b><br>joelho ${h.pain}/10 • lombar ${h.back}/10${h.note?`<br><span class="note">${escapeHTML(h.note)}</span>`:""}</div>`).join(""):"Nenhum treino registrado.";
}
$("saveSession").onclick=()=>{
  history.unshift({date:new Date().toISOString(),phase:phase().n,sessionType:buildSession().sessionType||state.place,completed:$("completedPlanned").value==="yes",place:state.place,after:state.after,pain:+$("postPain").value,back:+$("postBack").value,note:$("note").value.trim()});
  history=history.slice(0,100);localStorage.setItem("lancaHistory",JSON.stringify(history));$("note").value="";render();
};

$("startDate").value=settings.startDate||"2026-08-18";
$("targetDate").value=settings.targetDate||"2026-11-15";
$("preferredDuration").value=settings.preferredDuration||"25";
$("saveSettings").onclick=()=>{
  settings={...settings,startDate:$("startDate").value,targetDate:$("targetDate").value,preferredDuration:$("preferredDuration").value};
  localStorage.setItem("lancaSettings",JSON.stringify(settings));render();renderCalibrationSummary();alert("Ajustes salvos.");
};

readiness();render();


// ===== Calibração automática da velocidade da esteira =====
let calState = {running:false, phase:"idle", speed:7, lastCompleted:null, remaining:0, total:1, timer:null};

function calibrationAllowed(){
  const k=+$("knee").value, b=+$("back").value, f=+$("fatigue").value, s=+$("sleep").value;
  return state.after==="no" && k<3 && b<3 && f<5 && s>=5;
}
function renderCalibrationSummary(){
  const cal=settings.treadmillCalibration;
  const label=$("calibratedSpeedLabel"), meta=$("calibratedSpeedMeta");
  if(!label||!meta) return;
  if(cal && cal.speed){
    label.textContent=`${Number(cal.speed).toFixed(1)} km/h`;
    const d=cal.date?new Date(cal.date).toLocaleDateString("pt-BR"):"";
    meta.textContent=`Referência definida pelo LANÇA${d?` em ${d}`:""}. Recalibre ao mudar de fase ou após evolução consistente.`;
    $("openCalibration").textContent="Recalibrar";
  }else{
    label.textContent="Não calibrada";
    meta.textContent="O LANÇA define essa velocidade em uma calibração guiada.";
    $("openCalibration").textContent="Calibrar";
  }
}
function updateCalibrationGate(){
  const box=$("calibrationGate");
  if(!box) return;
  if(calibrationAllowed()){
    box.className="status green";
    box.textContent="LIBERADA — faça a calibração em um dia sem musculação antes, com joelho/lombar abaixo de 3 e pernas sem fadiga relevante.";
    $("calStart").disabled=false;
  }else{
    box.className="status yellow";
    box.textContent="ADIADA — a calibração exige um dia mais descansado. Marque “Não” em pós-musculação e use check-in verde antes de calibrar.";
    $("calStart").disabled=true;
  }
}
function openCalibration(){
  switchTab("calibration");
  resetCalibration(false);
  updateCalibrationGate();
}
function calSetScreen(type,title,sec,instruction){
  calState.phase=type; calState.remaining=sec; calState.total=Math.max(1,sec);
  $("calType").textContent=type==="warmup"?"AQUECER":type==="work"?"ESTÁGIO":"RECUPERAR";
  $("calTitle").textContent=title;
  $("calInstruction").textContent=instruction;
  updateCalClock();
}
function updateCalClock(){
  const m=Math.floor(calState.remaining/60), s=calState.remaining%60;
  $("calClock").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
  $("calBar").style.width=(100*(1-calState.remaining/calState.total))+"%";
}
function calSignal(){
  if(navigator.vibrate) navigator.vibrate([180,80,180]);
  try{
    const ac=new (window.AudioContext||window.webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain();
    o.connect(g);g.connect(ac.destination);o.frequency.value=920;g.gain.value=.07;o.start();o.stop(ac.currentTime+.16);
  }catch(e){}
}
function calTick(){
  if(calState.remaining>0){calState.remaining--;updateCalClock();return}
  clearInterval(calState.timer);calState.timer=null;calState.running=false;calSignal();
  if(calState.phase==="warmup"){
    startCalibrationStage();
  }else if(calState.phase==="work"){
    $("calTitle").textContent=`Estágio ${calState.speed.toFixed(1)} km/h concluído`;
    $("calInstruction").textContent="Se completou os 15 s sem segurar nos apoios, sem desequilíbrio e sem precisar parar, confirme. Caso contrário, interrompa.";
    $("calCompleted").style.display="inline-block"; $("calStop").style.display="inline-block";
  }else if(calState.phase==="recovery"){
    startCalibrationStage();
  }
}
function startCalTimer(){
  calState.running=true; clearInterval(calState.timer); calState.timer=setInterval(calTick,1000);
}
function startCalibration(){
  if(!calibrationAllowed()) return;
  calState={running:false,phase:"warmup",speed:7,lastCompleted:null,remaining:240,total:240,timer:null};
  $("calStart").style.display="none"; $("calCompleted").style.display="none"; $("calStop").style.display="inline-block";
  calSetScreen("warmup","Aquecimento",240,"Caminhe a 4,5 km/h. Ao terminar, o LANÇA inicia os estágios automaticamente.");
  startCalTimer();
}
function startCalibrationStage(){
  if(calState.speed>15){
    finishCalibration();
    return;
  }
  $("calCompleted").style.display="none"; $("calStop").style.display="inline-block";
  calSetScreen("work",`${calState.speed.toFixed(1)} km/h`,15,`Ajuste a esteira para ${calState.speed.toFixed(1)} km/h e complete 15 s. Não segure nos apoios.`);
  startCalTimer();
}
function confirmCalibrationStage(){
  if(calState.phase!=="work" || calState.remaining>0) return;
  calState.lastCompleted=calState.speed;
  calState.speed+=1;
  $("calCompleted").style.display="none";
  calSetScreen("recovery","Recuperação",45,"Reduza para 4,5 km/h e caminhe. O próximo estágio começa ao final.");
  startCalTimer();
}
function stopCalibration(){
  clearInterval(calState.timer);calState.timer=null;calState.running=false;
  if(calState.lastCompleted!==null){
    finishCalibration();
  }else{
    resetCalibration(false);
    switchTab("today");
    alert("Calibração encerrada sem referência. O LANÇA não prescreverá velocidade de esteira até uma calibração ser concluída.");
  }
}
function finishCalibration(){
  clearInterval(calState.timer);calState.timer=null;calState.running=false;
  if(calState.lastCompleted===null){resetCalibration(false);return}
  settings.treadmillCalibration={
    speed:calState.lastCompleted,
    date:new Date().toISOString(),
    phase:phase().n
  };
  localStorage.setItem("lancaSettings",JSON.stringify(settings));
  renderCalibrationSummary();
  $("calType").textContent="CONCLUÍDA";
  $("calTitle").textContent=`Referência: ${calState.lastCompleted.toFixed(1)} km/h`;
  $("calClock").textContent="✓";
  $("calInstruction").textContent="O LANÇA já pode calcular automaticamente a faixa de km/h dos seus treinos na esteira.";
  $("calBar").style.width="100%";
  $("calCompleted").style.display="none";$("calStop").style.display="none";$("calStart").style.display="inline-block";$("calStart").textContent="Recalibrar";
  render();
}
function resetCalibration(back=true){
  clearInterval(calState.timer);calState={running:false,phase:"idle",speed:7,lastCompleted:null,remaining:0,total:1,timer:null};
  if($("calType")){
    $("calType").textContent="PREPARAR";$("calTitle").textContent="Calibração não iniciada";$("calClock").textContent="00:00";
    $("calInstruction").textContent="O primeiro estágio começa em 7,0 km/h.";$("calBar").style.width="0";
    $("calStart").style.display="inline-block";$("calStart").textContent="Iniciar calibração";
    $("calCompleted").style.display="none";$("calStop").style.display="none";
  }
  if(back) switchTab("settings");
}
$("openCalibration").onclick=openCalibration;
$("calStart").onclick=startCalibration;
$("calCompleted").onclick=confirmCalibrationStage;
$("calStop").onclick=stopCalibration;
$("cancelCalibration").onclick=()=>resetCalibration(true);
renderCalibrationSummary();


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
      await navigator.serviceWorker.register("./service-worker.js?v=6.7",{updateViaCache:"none"});
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
      if(reg.waiting){
        reg.waiting.postMessage({type:"SKIP_WAITING"});
      }
      out.textContent = "Atualização verificada. O LANÇA vai recarregar para aplicar a versão mais recente.";
      setTimeout(()=>location.reload(),700);
    }catch(e){
      out.textContent = "Não foi possível verificar atualização agora.";
    }
  });
}
const clearLocalDataButton = document.getElementById("clearLocalData");
if(clearLocalDataButton){
  clearLocalDataButton.addEventListener("click", ()=>{
    if(!confirm("Apagar deste aparelho todo o histórico e os ajustes do LANÇA?")) return;
    localStorage.removeItem("lancaHistory");
    localStorage.removeItem("lancaSettings");
    localStorage.removeItem("rugbyV2History");
    localStorage.removeItem("rugbyV2Settings");
    location.reload();
  });
}

let lancaReloading = false;
if("serviceWorker" in navigator){
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{
    if(lancaReloading) return;
    lancaReloading = true;
    location.reload();
  });
}

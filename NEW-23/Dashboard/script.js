function getParams(){
  const u=new URL(location.href);
  return Object.fromEntries(u.searchParams.entries());
}

function setBanner(text){
  const el=document.getElementById('locationBanner');
  if(!el) return; el.textContent=text; el.hidden=false;
}

async function api(path, params){
  const url=new URL(`http://localhost:3000${path}`);
  Object.entries(params||{}).forEach(([k,v])=>url.searchParams.set(k,v));
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok){
    let detail='';
    try{ detail = await res.text(); }catch{}
    throw new Error(`API ${path} failed: ${res.status}${detail?` — ${detail}`:''}`);
  }
  return res.json();
}

function fmtTemp(c){ return `${(c).toFixed(1)}°C`; }

function renderCards({current}){
  if(!current) return;
  document.getElementById('temperature').textContent = fmtTemp(current.temp);
  document.getElementById('humidity').textContent = `${current.humidity}%`;
  // wind_speed is m/s in OWM metric; convert to km/h
  document.getElementById('wind').textContent = `${((current.wind_speed||0)*3.6).toFixed(1)} km/h`;
  // Rainfall this month approximation from daily data later
}

function renderRainTrend(labels, rainfall){
  const ctx1=document.getElementById('rainTrend');
  new Chart(ctx1,{type:'line',data:{labels,datasets:[{label:'Actual',data:rainfall,borderColor:'#2a86ff',tension:.35,fill:false}]},options:{plugins:{legend:{display:true}},scales:{y:{beginAtZero:true,title:{display:true,text:'Rainfall (mm)'}}}}});

  // Simple prediction via linear trend on last 6 points
  const n = rainfall.length;
  let slope=0, intercept=0;
  if(n>=2){
    const xs=rainfall.map((_,i)=>i+1); const ys=rainfall;
    const mean=(a)=>a.reduce((s,v)=>s+v,0)/a.length;
    const mx=mean(xs), my=mean(ys);
    const num=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0);
    const den=xs.reduce((s,x)=>s+(x-mx)*(x-mx),0)||1;
    slope=num/den; intercept=my - slope*mx;
  }
  const futureLabels = Array.from({length:6},(_,i)=> new Date(Date.now()+ (i+1)*30*24*3600*1000).toLocaleString(undefined,{month:'short'}));
  const startIndex = n+1;
  const predict = Array.from({length:6},(_,i)=> Math.max(0, slope*(startIndex+i)+intercept));
  const ctx2=document.getElementById('rainPredict');
  new Chart(ctx2,{type:'line',data:{labels:futureLabels,datasets:[{label:'Predicted',data:predict,borderColor:'#23c05a',borderDash:[6,4],tension:.35}]},options:{plugins:{legend:{display:true}},scales:{y:{beginAtZero:true,title:{display:true,text:'Rainfall (mm)'}}}}});

  const last = rainfall[n-1]||0;
  document.getElementById('rainfall').textContent = `${(last).toFixed(0)}mm`;
}

function phHint(ph){
  if(ph<5.5) return 'Strongly acidic - Amend lime recommended';
  if(ph<6.5) return 'Slightly acidic - Good for most crops';
  if(ph<=7.5) return 'Neutral to slightly alkaline - Good';
  return 'Alkaline - Consider soil amendments';
}

function renderSoil(soil){
  if(!soil) return;
  document.getElementById('soil-ph').textContent = soil.ph.toFixed(1);
  document.getElementById('soil-ph-hint').textContent = phHint(soil.ph);
  document.getElementById('soil-oc').textContent = `${soil.organicCarbon}%`;
  const {n,p,k}=soil.npk;
  const nPct=Math.min(100, Math.round(n/400*100));
  const pPct=Math.min(100, Math.round(p/120*100));
  const kPct=Math.min(100, Math.round(k/300*100));
  document.getElementById('npk-n').style.width = nPct+'%';
  document.getElementById('npk-p').style.width = pPct+'%';
  document.getElementById('npk-k').style.width = kPct+'%';
  document.getElementById('npk-n-val').textContent = `${n} kg/ha`;
  document.getElementById('npk-p-val').textContent = `${p} kg/ha`;
  document.getElementById('npk-k-val').textContent = `${k} kg/ha`;

  const labels = soil.phHistory.map(x=>x.label);
  const values = soil.phHistory.map(x=>x.value);
  const ctx=document.getElementById('phChart');
  new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'pH',data:values,backgroundColor:'#cc8f45'}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:false,min:5,max:8,title:{display:true,text:'pH Level'}}}}});
}

// Simple crops storage
const cropsKey='agriplatform:crops';
function readCrops(){
  try{ return JSON.parse(localStorage.getItem(cropsKey)||'[]'); }catch{return []}
}
function writeCrops(items){ localStorage.setItem(cropsKey, JSON.stringify(items)); }
function renderCrops(){
  const list=document.getElementById('cropsList');
  const items=readCrops();
  list.innerHTML='';
  items.forEach((c,i)=>{
    const el=document.createElement('div'); el.className='crop-card';
    el.innerHTML=`<div class="crop-name"><span>${c.name}</span><span class="chip">${c.status||'Growing'}</span></div>
    <div class="muted">Planted: ${c.planted||'-'} · Area: ${c.area||'-'}</div>
    <div class="muted">Growth Progress</div>
    <div class="progress"><span style="width:${c.progress||0}%"></span></div>
    <div class="crop-actions"><button class="btn small" data-i="${i}" data-act="up">+5%</button><button class="btn small" data-i="${i}" data-act="down">-5%</button><button class="btn small" data-i="${i}" data-act="del">Remove</button></div>`;
    list.appendChild(el);
  });
  list.querySelectorAll('button').forEach(btn=>{
    btn.onclick=()=>{
      const i=+btn.dataset.i; const act=btn.dataset.act; const items=readCrops();
      if(act==='del'){ items.splice(i,1); }
      else { items[i].progress=Math.max(0, Math.min(100, (items[i].progress||0)+(act==='up'?5:-5))); }
      writeCrops(items); renderCrops();
    };
  });
}

async function load(){
  const params=getParams();
  document.getElementById('changeLocation').addEventListener('click',()=>{
    location.href = '../Get%20started/location.html';
  });
  document.getElementById('addCrop')?.addEventListener('click',()=>{
    const name=prompt('Crop name (e.g., Rice)'); if(!name) return;
    const planted=prompt('Planted date (e.g., 2025-09-15)');
    const area=prompt('Area (e.g., 3.5 acres)');
    const items=readCrops(); items.push({name,planted,area,progress:0,status:'Growing'}); writeCrops(items); renderCrops();
  });
  try{
    let lat=params.lat, lon=params.lon, place=params.query;
    if(!lat || !lon){
      if(!place) throw new Error('No location provided.');
      const g=await api('/api/geocode',{q:place});
      lat=g.lat; lon=g.lon; place=g.label;
    }
    setBanner(`Showing data for: ${place || `${lat}, ${lon}`} — [${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)}]`);
    const [w, rain, soil] = await Promise.all([
      api('/api/weather',{lat,lon}),
      api('/api/rain-history',{lat,lon}),
      api('/api/soil',{lat,lon})
    ]);
    renderCards(w);
    renderRainTrend(rain.labels, rain.values);
    renderSoil(soil);
    renderCrops();
  }catch(e){
    // Friendly not-found handling
    let msg = e.message || 'Unknown error';
    if(/geocode/i.test(msg) && /404/.test(msg)){
      msg = 'No matching location found. Please check the spelling or try a more specific name (e.g., City, State, Country).';
      setBanner(`${msg} `);
      // Add quick action to change location
      const el=document.getElementById('locationBanner');
      if(el){
        const a=document.createElement('a');
        a.href='../Get%20started/location.html';
        a.textContent='Change Location';
        a.style.marginLeft='8px';
        el.appendChild(a);
      }
    } else {
      setBanner(`Failed to load data: ${e.message}`);
    }
    console.error(e);
  }
}

load();
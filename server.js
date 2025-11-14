require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENWEATHER_API_KEY;

if (!API_KEY) {
  console.warn('OPENWEATHER_API_KEY not set. Create a .env file with OPENWEATHER_API_KEY=your_key');
}

app.use(cors());
// Disable caching for API responses
app.use((req,res,next)=>{ res.set('Cache-Control','no-store'); next(); });

// Soil data from SoilGrids (no API key). Falls back to deterministic mock if needed.
app.get('/api/soil', async (req, res) => {
  try{
    const { lat, lon } = req.query;
    if(!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });

    // Try SoilGrids v2.0 properties API
    try {
      const url = new URL('https://rest.isric.org/soilgrids/v2.0/properties/query');
      url.searchParams.set('lat', lat);
      url.searchParams.set('lon', lon);
      url.searchParams.append('property','phh2o');
      url.searchParams.append('property','soc');
      url.searchParams.append('property','nitrogen');
      url.searchParams.set('depth','0-5cm');
      url.searchParams.set('value','mean');
      const r = await fetch(url);
      if (!r.ok) throw new Error(`SoilGrids error ${r.status}`);
      const j = await r.json();

      const layers = j?.properties?.layers || j?.layers || [];
      const byName = (name)=> layers.find(l=> l.name===name) || {};
      const firstVal = (layer)=>{
        const d = layer.depths?.[0];
        const mean = d?.values?.mean;
        return typeof mean==='number' ? mean : null;
      };

      const phMean10 = firstVal(byName('phh2o')); // deci-pH
      const soc_gkg = firstVal(byName('soc')); // g/kg
      const n_gkg = firstVal(byName('nitrogen')); // g/kg

      if (phMean10==null && soc_gkg==null && n_gkg==null) throw new Error('SoilGrids missing data');

      const ph = phMean10!=null ? +(phMean10/10).toFixed(1) : null;
      const organicCarbon = soc_gkg!=null ? +(soc_gkg/10).toFixed(2) : null; // %
      // Rough nitrogen availability estimate to kg/ha for 0-5cm slice:
      // kg/ha ≈ (g/kg / 1000) * soil_mass_per_ha (for 5 cm ~ 650,000 kg/ha assuming 1.3 g/cc bulk density)
      const soilMass5cm = 650000; // kg/ha
      const n = n_gkg!=null ? Math.round((n_gkg/1000) * soilMass5cm) : null;
      // P and K not provided by SoilGrids at this endpoint; estimate from OC & N for display only
      const p = n!=null && organicCarbon!=null ? Math.round(Math.max(15, Math.min(120, n*0.2/10 + organicCarbon*8))) : null;
      const k = n!=null && organicCarbon!=null ? Math.round(Math.max(80, Math.min(300, n*0.4/10 + organicCarbon*60))) : null;

      const months = Array.from({length:6},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-5+i); return d; });
      const basePh = ph ?? 6.5;
      const phHistory = months.map((d,i)=>({ label:d.toLocaleString(undefined,{month:'short'}), value:+(basePh + (Math.sin((i+1)*0.9)-0.5)*0.4).toFixed(2) }));

      return res.json({ ph, organicCarbon, npk:{ n, p, k }, phHistory, source:'soilgrids' });
    } catch (e) {
      console.warn('SoilGrids failed, using mock:', e.message);
      // Fallback mock using deterministic seed
      const latN = Number(lat), lonN = Number(lon);
      const seed = Math.abs(Math.sin(latN*12.9898 + lonN*78.233) * 43758.5453);
      const ph = +(5.5 + (seed%1)*2.5).toFixed(1);
      const oc = +(0.4 + ((seed*1.3)%1)*1.2).toFixed(2);
      const n = Math.round(150 + ((seed*1.7)%1)*200);
      const p = Math.round(20 + ((seed*2.1)%1)*80);
      const k = Math.round(120 + ((seed*2.7)%1)*160);
      const months = Array.from({length:6},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-5+i); return d; });
      const phHistory = months.map((d,i)=>({ label:d.toLocaleString(undefined,{month:'short'}), value:+(ph + ((Math.sin(seed+i)-0.5)*0.6)).toFixed(2) }));
      return res.json({ ph, organicCarbon: oc, npk:{ n,p,k }, phHistory, source:'mock' });
    }
  }catch(e){
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Monthly rainfall totals for last 6 months
app.get('/api/rain-history', async (req, res) => {
  try{
    const { lat, lon } = req.query;
    if(!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });

    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    const fmt = (d)=> d.toISOString().slice(0,10);

    // Try archive API for robust history
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    url.searchParams.set('start_date', fmt(start));
    url.searchParams.set('end_date', fmt(end));
    url.searchParams.set('daily', 'precipitation_sum');
    url.searchParams.set('timezone', 'auto');

    let r = await fetch(url);
    let data;
    if(!r.ok){
      // Fallback to forecast endpoint with past_days (max 92 ~ 3 months)
      const url2 = new URL('https://api.open-meteo.com/v1/forecast');
      url2.searchParams.set('latitude', lat);
      url2.searchParams.set('longitude', lon);
      url2.searchParams.set('past_days', '92');
      url2.searchParams.set('daily', 'precipitation_sum');
      url2.searchParams.set('timezone', 'auto');
      const r2 = await fetch(url2);
      if(!r2.ok) return res.status(500).json({ error: 'Rain history request failed' });
      data = await r2.json();
    } else {
      data = await r.json();
    }

    const times = data.daily?.time || [];
    const vals = data.daily?.precipitation_sum || [];
    const monthly = new Map(); // key: YYYY-MM -> sum
    for(let i=0;i<times.length;i++){
      const key = (new Date(times[i])).toISOString().slice(0,7);
      monthly.set(key, (monthly.get(key)||0) + (vals[i]||0));
    }
    // Keep last 6 months only, sorted ascending
    const keys = Array.from(monthly.keys()).sort();
    const last6 = keys.slice(-6);
    const labels = last6.map(k=>{
      const [y,m]=k.split('-');
      return new Date(Number(y), Number(m)-1, 1).toLocaleString(undefined,{month:'short'});
    });
    const values = last6.map(k=> Number(monthly.get(k)?.toFixed(1) || 0));

    return res.json({ labels, values });
  }catch(e){
    return res.status(500).json({ error: e.message });
  }
});

// Geocode by place name; returns first result
app.get('/api/geocode', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Missing q' });
    // First try OpenWeather geocoding
    let useFallback = false;
    try {
      const url = new URL('https://api.openweathermap.org/geo/1.0/direct');
      url.searchParams.set('q', q);
      url.searchParams.set('limit', '1');
      url.searchParams.set('appid', API_KEY);
      const r = await fetch(url);
      if (r.status === 401 || r.status === 403) {
        useFallback = true;
      } else if (!r.ok) {
        throw new Error(`Geocode failed ${r.status}`);
      } else {
        const arr = await r.json();
        if (!arr.length) return res.status(404).json({ error: 'Not found' });
        const { lat, lon, name, state, country } = arr[0];
        return res.json({ lat, lon, label: [name, state, country].filter(Boolean).join(', ') });
      }
    } catch (e) {
      // continue to fallback
      useFallback = true;
    }

    // Fallback: Open-Meteo geocoding (no API key required)
    try {
      const url2 = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url2.searchParams.set('name', q);
      url2.searchParams.set('count', '5');
      url2.searchParams.set('language', 'en');
      const r2 = await fetch(url2);
      if (!r2.ok) throw new Error(`Fallback geocode failed ${r2.status}`);
      const data = await r2.json();
      if (!data || !data.results || !data.results.length) return res.status(404).json({ error: 'Not found', suggestions: [] });
      const g = data.results[0];
      const label = [g.name, g.admin1, g.country].filter(Boolean).join(', ');
      return res.json({ lat: g.latitude, lon: g.longitude, label });
    } catch (e2) {
      const msg = useFallback ? `Both geocoders failed: ${e2.message}` : `Geocoder error: ${e2.message}`;
      return res.status(500).json({ error: msg });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Weather via One Call API 3.0
app.get('/api/weather', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });
    const params = new URLSearchParams({ lat, lon, exclude: 'minutely,alerts', appid: API_KEY, units: 'metric' });

    // Try One Call 3.0 first
    let r = await fetch(`https://api.openweathermap.org/data/3.0/onecall?${params.toString()}`);
    if (!r.ok) {
      // Fallback to One Call 2.5 (wider availability on free tier)
      const text = await r.text().catch(()=> '');
      console.warn('One Call 3.0 failed:', r.status, text);
      r = await fetch(`https://api.openweathermap.org/data/2.5/onecall?${params.toString()}`);
    }
    if (r.ok) {
      const data = await r.json();
      return res.json(data);
    }

    // If OpenWeather still failed (e.g., 401/403), fallback to Open-Meteo (free, no key)
    const errText = await r.text().catch(()=> '');
    console.warn('OpenWeather fallback failed:', errText);

    try {
      const om = new URL('https://api.open-meteo.com/v1/forecast');
      om.searchParams.set('latitude', lat);
      om.searchParams.set('longitude', lon);
      om.searchParams.set('current_weather', 'true');
      om.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m');
      om.searchParams.set('daily', 'precipitation_sum');
      om.searchParams.set('timezone', 'auto');
      const rOm = await fetch(om);
      if (!rOm.ok) throw new Error(`Open-Meteo error ${rOm.status}`);
      const j = await rOm.json();

      // Map to OpenWeather-like shape consumed by the frontend
      // Map humidity closest to current_weather time
      let humidityVal = null;
      if (Array.isArray(j.hourly?.time) && Array.isArray(j.hourly?.relative_humidity_2m)){
        const target = j.current_weather?.time; // e.g., '2025-11-14T15:00'
        let idx = j.hourly.time.findIndex(t=> t === target);
        if (idx === -1) idx = j.hourly.relative_humidity_2m.findIndex(v=> typeof v === 'number');
        if (idx >= 0) humidityVal = j.hourly.relative_humidity_2m[idx];
      }
      const current = {
        temp: j.current_weather?.temperature ?? null,
        humidity: humidityVal,
        wind_speed: (j.current_weather?.windspeed ?? 0) / 3.6 // convert km/h -> m/s to match OWM semantics, frontend multiplies by 3.6
      };
      const daily = Array.isArray(j.daily?.time)
        ? j.daily.time.map((t, i) => ({ dt: Math.floor(new Date(t).getTime()/1000), rain: j.daily.precipitation_sum?.[i] ?? 0 }))
        : [];

      return res.json({ current, daily });
    } catch (e3) {
      return res.status(500).json({ error: 'All weather providers failed', detail: e3.message });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));

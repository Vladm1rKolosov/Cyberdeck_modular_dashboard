const dashboard = document.querySelector('#dashboard');
const savedKey = 'cyberdeck-layout-v1';
let config, editing = false, dragged = null, lastData = null;

const templates = {
  cpu: () => `<div class="metric"><strong data-v="cpu.usage">--</strong><span>% TOTAL LOAD</span></div><div class="subline"><span data-v="cpu.name">PROCESSOR</span><span data-v="cpu.frequency">--</span></div><div class="meter"><div data-bar="cpu.usage"></div></div><div class="cores" data-list="cores"></div>`,
  ram: () => `<div class="metric"><strong data-v="ram.usage">--</strong><span>% MEMORY LOAD</span></div><div class="meter"><div data-bar="ram.usage"></div></div><div class="rows"><div class="row"><span>ALLOCATED</span><span data-v="ram.used_gb">--</span></div><div class="row"><span>TOTAL CAPACITY</span><span data-v="ram.total_gb">--</span></div></div>`,
  gpu: () => `<div class="metric"><strong data-v="gpu.usage">--</strong><span>% GPU LOAD</span></div><div class="subline"><span data-v="gpu.name">GPU SENSOR</span><span data-v="gpu.temperature">--</span></div><div class="meter"><div data-bar="gpu.usage"></div></div><div class="rows"><div class="row"><span>POWER DRAW</span><span data-v="gpu.power">--</span></div><div class="row"><span>VRAM</span><span data-v="gpu.memory_used">--</span></div></div>`,
  clock: () => `<div class="big-clock" id="panel-time">00:00:00</div><div class="center" id="panel-date">--</div><div class="rows" style="margin-top:28px"><div class="row"><span>PROFILE</span><span>RED ALERT</span></div><div class="row"><span>TIMEZONE</span><span>LOCAL</span></div></div>`,
  network: () => `<div class="rows"><div class="row"><span>DOWNLOAD</span><span data-v="network.down_bps">--</span></div><div class="meter"><div data-net="down_bps"></div></div><div class="row" style="margin-top:18px"><span>UPLOAD</span><span data-v="network.up_bps">--</span></div><div class="meter"><div data-net="up_bps"></div></div></div>`,
  storage: () => `<div class="rows" data-list="disks"></div>`,
  processes: () => `<div class="rows" data-list="processes"></div>`,
  terminal: () => `<div class="log" id="system-log"><div><b>[BOOT]</b> CYBERDECK interface initialized</div><div><b>[LINK]</b> Waiting for telemetry bridge...</div></div>`
};

function render() {
  dashboard.innerHTML = '';
  config.widgets.forEach((item, index) => {
    const node = document.createElement('section');
    node.className = `widget ${item.size || 'normal'}`;
    node.dataset.id = item.id; node.draggable = editing;
    node.innerHTML = `<div class="widget-head"><span>[ ${item.title} ]</span><div class="controls"><button data-action="size">↔</button><button data-action="clone">⧉</button><button data-action="hide">×</button></div><i>0${index + 1}</i></div>${(templates[item.type || item.id] || templates.terminal)()}`;
    dashboard.append(node);
  });
  bindEditor(); if (lastData) update(lastData);
}

function bindEditor() {
  dashboard.querySelectorAll('.widget').forEach(node => {
    node.addEventListener('dragstart', () => dragged = node.dataset.id);
    node.addEventListener('dragover', event => event.preventDefault());
    node.addEventListener('drop', event => { event.preventDefault(); reorder(dragged, node.dataset.id); });
    node.querySelectorAll('[data-action]').forEach(button => button.onclick = () => act(node.dataset.id, button.dataset.action));
  });
}

function reorder(from, to) { const a=config.widgets.findIndex(x=>x.id===from), b=config.widgets.findIndex(x=>x.id===to); if(a<0||b<0)return; const [item]=config.widgets.splice(a,1); config.widgets.splice(b,0,item); save(); render(); }
function act(id, action) { const i=config.widgets.findIndex(x=>x.id===id); if(i<0)return; if(action==='hide') config.widgets.splice(i,1); if(action==='size') config.widgets[i].size=config.widgets[i].size==='wide'?'normal':'wide'; if(action==='clone'){ const original=config.widgets[i],copy={...original,type:original.type||original.id,id:`${id}-copy-${Date.now()}`,title:`${original.title} COPY`}; config.widgets.splice(i+1,0,copy); } save(); render(); }
function save() { localStorage.setItem(savedKey, JSON.stringify(config)); }
function value(obj, path) { return path.split('.').reduce((o,k)=>o?.[k],obj); }
function fmtBytes(value) { if(value==null)return '--'; const units=['B/s','KB/s','MB/s','GB/s']; let i=0; while(value>=1024&&i<3){value/=1024;i++} return `${value.toFixed(i?1:0)} ${units[i]}`; }

function update(data) {
  lastData=data; document.querySelector('#host').textContent=data.system.hostname; document.querySelector('#uptime').textContent=`UPTIME ${formatUptime(data.system.uptime)}`;
  document.querySelectorAll('[data-v]').forEach(el => { const path=el.dataset.v, val=value(data,path); if(path.includes('_bps'))el.textContent=fmtBytes(val); else if(path==='cpu.frequency')el.textContent=`${val||0} GHz`; else if(path.includes('temperature'))el.textContent=val==null?'--':`${val}°C`; else if(path==='gpu.power')el.textContent=val==null?'--':`${val} W`; else if(path==='gpu.memory_used')el.textContent=val==null?'--':`${val} MB`; else if(path.includes('_gb'))el.textContent=val==null?'--':`${val} GB`; else el.textContent=val??'--'; });
  document.querySelectorAll('[data-bar]').forEach(el=>el.style.width=`${Math.min(100,value(data,el.dataset.bar)||0)}%`);
  document.querySelectorAll('[data-net]').forEach(el=>el.style.width=`${Math.min(100,(data.network[el.dataset.net]||0)/100000)}%`);
  document.querySelectorAll('[data-list="cores"]').forEach(el=>el.innerHTML=data.cpu.cores.map(x=>`<span class="core" style="--load:${x}%" title="${x}%"></span>`).join(''));
  document.querySelectorAll('[data-list="disks"]').forEach(el=>el.innerHTML=data.disks.map(x=>`<div class="row"><span>${x.name} // ${x.used_gb} GB</span><span>${x.percent}% / ${x.total_gb} GB</span></div><div class="meter"><div style="width:${x.percent}%"></div></div>`).join(''));
  document.querySelectorAll('[data-list="processes"]').forEach(el=>el.innerHTML=data.processes.map(x=>`<div class="row"><span>${x.pid} // ${x.name}</span><span>${x.memory_mb} MB</span></div>`).join(''));
}
function formatUptime(s){const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return `${d}D ${h}H ${m}M`}
function tick(){const now=new Date(),time=now.toLocaleTimeString('ru-RU'),date=now.toLocaleDateString('ru-RU',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}); ['hero-time','panel-time'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=time}); ['hero-date','panel-date'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=date});}
function connect(){const socket=new WebSocket(`ws://${location.host}/ws/telemetry`); socket.onopen=()=>{document.querySelector('#connection').textContent='LINK ONLINE';document.querySelector('#connection').classList.remove('offline')}; socket.onmessage=e=>update(JSON.parse(e.data)); socket.onclose=()=>{document.querySelector('#connection').textContent='DEMO / OFFLINE';document.querySelector('#connection').classList.add('offline');setTimeout(connect,4000)};}

document.querySelector('#edit-toggle').onclick=event=>{editing=!editing;document.body.classList.toggle('editing',editing);event.currentTarget.classList.toggle('active',editing);render()};
document.querySelector('#export-layout').onclick=()=>{const blob=new Blob([JSON.stringify(config,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cyberdeck-layout.json';a.click();URL.revokeObjectURL(a.href)};
document.querySelector('#import-layout').onchange=async event=>{try{config=JSON.parse(await event.target.files[0].text());save();render()}catch{alert('Некорректный файл конфигурации')}};

(async()=>{const local=localStorage.getItem(savedKey);config=local?JSON.parse(local):await fetch('/api/config').then(r=>r.json());render();tick();setInterval(tick,1000);connect()})();

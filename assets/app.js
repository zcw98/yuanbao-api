/* 元宝API 应用层：路由、状态、组件渲染与交互（对接 new-api 实时数据） */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const store = {
  get(k,d){ try{ const v=localStorage.getItem('yb.'+k); return v==Null?d:JSON.parse(v);}catch{return d;} },
  set(k,v){ localStorage.setItem('yb.'+k,JSON.stringify(v)); }
};
const state = {
  theme: store.get('theme','dark'),
  collapsed: store.get('collapsed',false),
  channels:[], groups:[], pricing:{}, models:[],
  balance: store.get('balance',0),
  orders: store.get('orders',[]),
  profile: store.get('profile',{username:'yuanbao',email:'yuanbao@example.com',nickname:'元宝用户'})
};
const save = ()=>{ store.set('balance',state.balance); store.set('orders',state.orders); store.set('profile',state.profile); };
const ADMIN='/api/admin';
async function api(path, opts={}){
  const headers={...(opts.headers||{})};
  if(opts.body!==undefined) headers['Content-Type']='application/json';
  const r=await fetch(ADMIN+path,{...opts,headers});
  const t=await r.text();
  let j=null; try{ j=JSON.parse(t); }catch(e){}
  return {ok:r.ok, status:r.status, json:j, text:t};
}
function mapChannel(c, pricing){
  const base=(c.base_url||'').replace(/\/+$/,'');
  let platform='custom', plat='p-cus';
  const u=base.toLowerCase();
  if(u.includes('openai.com')) platform='openai',plat='p-ope';
  else if(u.includes('deepseek.com')) platform='deepseek',plat='p-dee';
  else if(u.includes('anthropic.com')) platform='anthropic',plat='p-cla';
  else if(u.includes('minimax.chat')) platform='minimax',plat='p-min';
  else if(u.includes('aliyuncs.com')||u.includes('dashscope')) platform='qwen',plat='p-qwe';
  else if(u.includes('bigmodel.cn')) platform='zhipu',plat='p-zhi';
  const models=(c.models||'').split(',').map(m=>m.trim()).filter(Boolean);
  return { id:c.id, type:c.type, name:c.name, desc:c.desc||c.name,
    platform, plat, status:c.status===1?'enabled':'disabled', groups:[c.group||'default'],
    models, priority:c.priority||0, weight:c.weight||0,
    response_time:c.response_time, test_time:c.test_time,
    base_url:base, key:c.key, balance:(c.balance||0)/100 };
}
async function loadData(){
  try{
    const cg=await api('/group/'); state.groups=cg.json?.data||[];
    const ch=await api('/channel/?page=1&page_size=100');
    const pricing=await api('/pricing');
    state.pricing={}; (pricing.json?.data||[]).forEach(x=>{ state.pricing[x.model_name]={model_ratio:x.model_ratio,enable_groups:x.enable_groups||['default']}; });
    state.channels=(ch.json?.data?.items||[]).map(c=>mapChannel(c,state.pricing));
    state.models=[...new Set(state.channels.filter(c=>c.status==='enabled').flatMap(c=>c.models))];
  }catch(e){ console.error('load fail',e); }
}
function rateText(c){
  const active=c.models.filter(m=>state.pricing[m]);
  if(!active.length) return '—';
  const avg=c.models.reduce((a,m)=>{const p=state.pricing[m];return p?a+p.model_ratio:0},0)/active.length;
  return 'x'+Number(avg||0).toFixed(2);
}
const NAV=[
  {id:'dashboard',label:'仪表盘',icon:'▦'},
  {id:'channels',label:'可用渠道',icon:'◆'},
  {id:'keys',label:'API 密钥',icon:'⚿'},
  {id:'purchase',label:'充值/订阅',icon:'¥'},
  {id:'docs',label:'✨ 使用教程',icon:'◈'},
  {id:'errors',label:'错误处理',icon:'!'}
];
const VIEWS={
  dashboard:{title:'仪表盘',sub:'账户用量、余额与快捷入口'},
  channels:{title:'可用渠道',sub:'查看可用渠道、分组、模型与定价，点击即可添加供应商'},
  keys:{title:'API 密钥',sub:'创建、管理并测试用于调用模型的密钥'},
  purchase:{title:'充值/订阅',sub:'购买额度或订阅套餐，余额用于按量计费'},
  docs:{title:'✨ 使用教程',sub:'OpenAI 兼容接口的接入步骤与在线测试'},
  errors:{title:'错误处理',sub:'按状态码排查调用失败的原因'}
};
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&'+'amp;','<':'&'+'lt;','>':'&'+'gt;','"':'&'+'quot;',"'":'&'+'#39;'}[c]));
const money = n => '¥'+Number(n||0).toFixed(2);
const num = n => Number(n||0).toLocaleString('zh-CN');
const dateText = ts => ts?new Date(ts*1000).toLocaleString('zh-CN',{hour12:false}):'—';
const platName = p => ({deepseek:'DEEPSEEK',gemini:'GEMINI',minimax:'MINIMAX',openai:'OPENAI',anthropic:'CLAUDE',qwen:'QWEN',zhipu:'ZHIPU',custom:'CUSTOM'}[p]||p.toUpperCase());
let toastTimer;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2400); }
function renderNav(){
  const cur=location.hash.replace(/^#\//,'')||'dashboard';
  $('#nav').innerHTML=NAV.map(n=>`<li><a href="#/${n.id}" ${n.id===cur?'aria-current="page"':''}>
    <span class="ico" aria-hidden="true">${n.icon}</span><span>${n.label}</span></a></li>`).join('');
  $('#nav-foot').innerHTML=`<li><button type="button" data-act="theme"><span class="ico" aria-hidden="true">${state.theme==='dark'?'☀':'☾'}</span>
    <span>${state.theme==='dark'?'浅色模式':'深色模式'}</span></button></li>`;
  $('#chip-keys').textContent=state.models.length;
  $('#chip-balance').textContent=money(state.balance);
  $('#main').setAttribute('aria-busy','false');
}
function channelRows(){
  const q=(state.q||'').trim().toLowerCase(), fplat=state.fplat||'';
  let rows=state.channels.filter(c=>
    (!fplat||c.platform===fplat)&&
    (!q||(c.name+c.desc+(c.models.join(' '))).toLowerCase().includes(q)));
  rows.sort((a,b)=>a.name.localeCompare(b.name,'zh'));
  if(!rows.length) return '';
  return rows.map(c=>`<tr>
    <th scope="row"><span class="muted">${esc(c.name)}</span></th>
    <td class="muted">${esc(c.desc)}</td>
    <td><span class="plat plat-${c.plat}">${platName(c.platform)}</span></td>
    <td class="num"><span class="tag tag-rate">${rateText(c)}</span></td>
    <td><div class="tags">${c.groups.map(g=>`<span class="tag">${esc(g)}</span>`).join('')}</div></td>
    <td><div class="models">${c.models.map(m=>`<span class="model">${esc(m)}</span>`).join('')}</div></td>
    <td><span class="badge ${c.status==='enabled'?'badge-ok':'badge-err'}">${c.status==='enabled'?'启用':'停用'}</span>
      <details class="more"><summary class="rowlink">详情</summary>
        <dl class="detail-grid">
          <div><dt>渠道 ID</dt><dd>${c.id}</dd></div>
          <div><dt>优先级</dt><dd>${c.priority}</dd></div>
          <div><dt>权重</dt><dd>${c.weight}</dd></div>
          <div><dt>响应时间</dt><dd>${c.response_time?c.response_time+' ms':'—'}</dd></div>
          <div><dt>余额</dt><dd>${money(c.balance)}</dd></div>
          <div><dt>最近测试</dt><dd>${dateText(c.test_time)}</dd></div>
          <div><dt>上游地址</dt><dd>${esc(c.base_url)}</dd></div>
        </dl></details></td></tr>`).join('');
}
async function renderChannels(){
  const pf=$('#fplat')?.value||''; state.fplat=pf;
  const platOpts=[...new Set(state.channels.map(c=>c.platform))].map(p=>
    `<option value="${p}" ${state.fplat===p?'selected':''}>${platName(p)}</option>`).join('');
  $('#chbody').innerHTML=channelRows()||'<tr><td colspan="7"><div class="empty"><h3>没有匹配的渠道</h3></div></td></tr>';
  $('#platopts')?.innerHTML='<option value="">全部平台</option>'+platOpts;
}
function viewChannels(){
  return `<div class="toolbar">
    <div class="field grow"><label for="q">搜索渠道或模型</label>
      <input id="q" type="search" placeholder="例如 Gemini 或 claude" value="${esc(state.q||'')}"></div>
    <div class="field"><label for="fplat">平台</label><select id="fplat"><option value="">全部平台</option><option id="platopts"></option></select></div>
    <button class="btn" type="button" data-act="refresh">刷新</button>
    <button class="btn btn-primary" type="button" id="addprovider">＋ 添加供应商</button>
  </div>
  <div class="table-wrap"><table>
    <caption class="sr-only">可用渠道列表</caption>
    <thead><tr>
      <th scope="col">渠道名</th><th scope="col">描述</th><th scope="col">平台</th>
      <th scope="col">倍率</th><th scope="col">分组</th><th scope="col">支持模型</th><th scope="col">状态</th>
    </tr></thead><tbody id="chbody"></tbody></table>
  </div>`;
}
function viewKeys(){
  return `<div class="panel" style="margin-bottom:var(--s5)">
    <div class="panel-head"><h2>创建 API 密钥</h2></div>
    <div class="panel-body"><form id="keyform" novalidate>
      <div class="form-grid">
        <div class="field"><label for="kname">密钥名称</label>
          <input id="kname" name="name" type="text" required placeholder="例如：生产环境"></div>
        <div class="field"><label for="kgroup">可用分组</label>
          <select id="kgroup" name="group">${state.groups.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select>
          <p class="hint">分组决定该密钥能调用哪些渠道所属的模型。</p></div>
        <div class="field"><label for="kexpire">过期时间</label>
          <select id="kexpire" name="expire"><option value="0">永不过期</option>
            <option value="30">30 天</option><option value="90">90 天</option></select></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">创建密钥</button>
        <span class="faint">创建后密钥仅显示一次，请及时复制。</span></div>
    </form></div></div>
  <div class="table-wrap"><table>
    <thead><tr><th>名称</th><th>密钥</th><th>分组</th><th>过期</th><th>状态</th><th>操作</th></tr></thead>
    <tbody id="keybody"></tbody>
  </table></div>`;
}
async function renderKeys(){
  const list=await api('/token/?page=1&page_size=50');
  const items=(list.json?.data?.items||[]);
  $('#keybody').innerHTML=items.map(k=>`<tr>
    <th scope="row">${esc(k.name)}</th>
    <td><code>${esc((k.key||'').slice(0,20))}…</code></td>
    <td><span class="tag">${esc(k.group||'all')}</span></td>
    <td>${k.expired_time?dateText(k.expired_time):'永不过期'}</td>
    <td><span class="badge badge-ok">启用</span></td>
    <td><button class="btn btn-sm" type="button" data-act="copy" data-key="${esc(k.key)}">复制</button></td>
  </tr>`).join('')||'<tr><td colspan="6"><div class="empty"><h3>暂无密钥</h3></div></td></tr>';
}
const PLATFORM_TEMPLATES={
  deepseek:{name:'DeepSeek 官方',base_url:'https://api.deepseek.com/v1',models:'deepseek-chat,deepseek-reasoner',type:11},
  openai:{name:'OpenAI 官方',base_url:'https://api.openai.com/v1',models:'gpt-4o,gpt-4o-mini,gpt-4.1,gpt-4.1-mini',type:1},
  minimax:{name:'MiniMax 官方',base_url:'https://api.minimax.chat/api',models:'minimax-m3.1-flash,minimax-m3.1-pro',type:8},
  qwen:{name:'通义千问',base_url:'https://dashscope.aliyuncs.com/compatible-mode/v1',models:'qwen-plus,qwen-max,qwen-turbo',type:17},
  zhipu:{name:'智谱 GLM',base_url:'https://open.bigmodel.cn/api/paas/v4',models:'glm-4-plus,glm-4-air,glm-4-flash',type:6},
  anthropic:{name:'Claude 官方',base_url:'https://api.anthropic.com',models:'claude-sonnet-4-5,claude-opus-4-1,claude-haiku-4-5',type:14}
};
function showAddProvider(){
  const items=Object.entries(PLATFORM_TEMPLATES).map(([k,v])=>`
    <label class="opt"><input type="radio" name="plat" value="${k}" data-base="${esc(v.base_url)}"
      data-models="${esc(v.models)}" data-type="${v.type}">
      <span>${v.name}</span></label>`);
  $('#view').innerHTML=`
    <div class="panel"><div class="panel-head"><h2>添加供应商渠道</h2></div>
      <div class="panel-body">
        <form id="provform" novalidate>
          <fieldset class="plat-set"><legend>选择供应商类型</legend>${items.join('')}</fieldset>
          <div class="form-grid">
            <div class="field"><label for="pname">渠道名称</label><input id="pname" required></div>
            <div class="field"><label for="pkey">API 密钥</label><input id="pkey" type="password" placeholder="sk-..." required></div>
            <div class="field"><label for="pgroup">分组</label><select id="pgroup">${state.groups.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select></div>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">保存渠道</button>
            <button class="btn" type="button" id="cancelprov">取消</button></div>
        </form>
      </div></div>`;
  $('#pgroup').value='default';
  $$('input[name="plat"]').forEach(i=>{ i.addEventListener('change',()=>{ $('#pname').value=PLATFORM_TEMPLATES[i.value].name; }); });
  $('#cancelprov').onclick=()=>history.back();
  $('#provform').onsubmit=async e=>{
    e.preventDefault();
    const sel=$('input[name="plat"]:checked'); if(!sel){ toast('请选择供应商类型'); return; }
    const name=$('#pname').value.trim()||PLATFORM_TEMPLATES[sel.value].name;
    const key=$('#pkey').value.trim();
    if(!key){ toast('请输入 API 密钥'); return; }
    const body={channel:{
      name, type:+sel.dataset.type, key, base_url:sel.dataset.base,
      models:sel.dataset.models, group:$('#pgroup').value, status:1, weight:100, priority:10, auto_ban:1
    }, mode:'single'};
    const r2=await fetch(ADMIN+'/channel/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(r2.ok){ toast('供应商「'+name+'」已添加'); setTimeout(()=>history.back(),800); }
    else{ toast('保存失败：HTTP '+r2.status); }
  };
  const def=$('input[name="plat"]:checked');
  if(def) $('#pname').value=PLATFORM_TEMPLATES[def.value].name;
}
function viewDashboard(){
  const enabled=state.channels.filter(c=>c.status==='enabled').length;
  return `<div class="grid" style="margin-bottom:var(--s5)">
    <div class="stat"><div class="label">可用渠道</div><div class="value">${enabled}<span class="muted" style="font-size:var(--fs-lg)">/${state.channels.length}</span></div>
      <div class="delta"><a href="#/channels">查看列表</a></div></div>
    <div class="stat"><div class="label">可用模型</div><div class="value">${state.models.length}</div>
      <div class="delta"><a href="#/keys">创建密钥</a></div></div>
    <div class="stat"><div class="label">充值余额</div><div class="value">${money(state.balance)}</div>
      <div class="delta"><a href="#/purchase">去充值</a></div></div>
    <div class="stat"><div class="label">新接口</div><div class="value">稳定</div>
      <div class="delta"><a href="#/docs">查看教程</a></div></div>
  </div>
  <div class="panel"><div class="panel-head"><h2>快速开始</h2><a class="btn btn-sm" href="http://127.0.0.1:3001" target="_blank">打开管理后台</a></div>
    <div class="panel-body"><ol class="quick">
      <li>在「可用渠道」点击「添加供应商」粘贴你的 API 密钥。</li>
      <li>在「API 密钥」页创建密钥，选择要访问的分组。</li>
      <li>复制准确的模型名，在 Codex 等工具中按 OpenAI 格式调用 <code>/v1/chat/completions</code>。</li>
      <li>调用前往「管理后台」查看实时日志与余额。</li>
    </ol></div></div>`;
}
function viewDocs(){
  return `<div class="panel"><div class="panel-head"><h2>在 Codex 中接入元宝API</h2></div>
    <div class="panel-body"><pre class="code"><code># Codex 配置文件 ~/.codex/config.toml
[model_providers.custom]
base_url = "http://127.0.0.1:3001/v1"
model = "minimax-m3.1-flash"
wire_api = "responses"</code></pre>
    <p>在「API 密钥」页复制你的密钥，填入 Codex 的 <code>api_key</code> 即可。</p></div></div>
  <div class="grid"><div class="stat"><div class="label">接口地址</div><div class="value mono">127.0.0.1:3001/v1</div></div>
    <div class="stat"><div class="label">协议</div><div class="value mono">OpenAI<br>兼容</div></div>
    <div class="stat"><div class="label">可用模型</div><div class="value mono">${state.models.length} 个</div></div>
    <div class="stat"><div class="label">文档</div><div class="value mono"><a href="https://github.com/QuantumNous/new-api" target="_blank">new-api</a></div></div></div>`;
}
const ERROR_CODES=[
  { code:400, title:'请求参数错误', fix:'检查 model 与 messages 格式' },
  { code:401, title:'密钥无效或已过期', fix:'刷新或更换 API 密钥' },
  { code:403, title:'分组无权访问', fix:'为密钥选择包含该渠道的分组' },
  { code:429, title:'触发限流', fix:'降低调用频率，稍后重试' },
  { code:500, title:'上游渠道异常', fix:'查看渠道余额，切换其他渠道' },
  { code:503, title:'没有可用渠道', fix:'启用一个渠道并配置正确的 base_url' },
];
function viewErrors(){
  const q=(state.eq||'').trim().toLowerCase();
  const hit=ERROR_CODES.filter(e=>!q||(String(e.code)+e.title+e.fix).toLowerCase().includes(q));
  return `<div class="toolbar"><div class="field grow"><label for="eq">搜索状态码</label>
    <input id="eq" type="search" placeholder="例如 429" value="${esc(q)}"></div></div>
  <div id="elist">${hit.map(e=>`<details class="panel"><summary class="panel-head"><span class="badge badge-info">${e.code}</span><h2>${esc(e.title)}</h2></summary>
    <div class="panel-body"><p><strong>处理：</strong>${esc(e.fix)}</p></div></details>`).join('')||'<div class="empty"><h3>没有匹配</h3></div>'}</div>`;
}
function render(){
  const cur=(location.hash.replace(/^#\//,'')||'dashboard').split('?')[0];
  if(cur==='provider'){ showAddProvider(); $('#page-title').textContent='添加供应商'; $('#page-sub').textContent='填写你的 API 密钥接入新渠道'; return; }
  const v=VIEWS[cur]||VIEWS.dashboard;
  $('#page-title').textContent=v.title; $('#page-sub').textContent=v.sub;
  document.title='元宝API — '+v.title;
  $('#view').innerHTML=v.render();
  renderNav();
  if(cur==='channels') renderChannels();
  if(cur==='keys') renderKeys();
}
window.addEventListener('hashchange',render);
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');
  if(!b) return;
  if(b.dataset.act==='refresh'){ await loadData(); render(); toast('渠道已刷新'); }
  if(b.dataset.act==='theme'){ state.theme=state.theme==='dark'?'light':'dark';
    document.documentElement.dataset.theme=state.theme; store.set('theme',state.theme); renderNav(); }
  if(b.dataset.act==='copy'){ await copyText(b.dataset.key); toast('密钥已复制到剪贴板'); }
});
document.addEventListener('input',e=>{
  if(e.target.id==='q'){ state.q=e.target.value; const r=channelRows(); $('#chbody').innerHTML=r||'<tr><td colspan="7"><div class="empty"><h3>没有匹配</h3></div></td></tr>'; }
  if(e.target.id==='fplat'){ state.fplat=e.target.value; $('#chbody').innerHTML=channelRows(); }
});
document.addEventListener('change',e=>{ if(e.target.id==='fplat'){ state.fplat=e.target.value; $('#chbody').innerHTML=channelRows(); } });
document.addEventListener('submit',async e=>{
  e.preventDefault();
  if(e.target.id==='keyform'){
    const name=$('#kname').value.trim(), grp=$('#kgroup').value, exp=parseInt($('#kexpire').value);
    if(!name){ toast('请输入密钥名称'); return; }
    const body={name,remain_quota:99990000,unlimited_quota:true,expired_time:exp===0?0:Math.floor(Date.now()/1000)+exp*86400,model_limits_enabled:false,group:grp||'default'};
    const r=await fetch(ADMIN+'/token/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const t=await r.text(); let j=null; try{ j=JSON.parse(t); }catch(e){}
    if(r.ok){
      const newtok=j.data;
      const copy=document.createElement('textarea'); copy.value=newtok?.key||j.key||'';
      document.body.appendChild(copy); copy.select(); document.execCommand('copy'); copy.remove();
      toast('密钥已创建并复制到剪贴板！'); await renderKeys();
    } else { toast('创建失败：HTTP '+r.status); }
  }
});
async function copyText(t){ try{ await navigator.clipboard.writeText(t); }catch{ const a=document.createElement('textarea');
  a.value=t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } }

/* ---------- 启动 ---------- */
document.documentElement.dataset.theme=state.theme;
document.body.classList.toggle('side-collapsed',state.collapsed);
loadData().then(()=>{ render(); });
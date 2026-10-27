/* 元宝API 演示数据：字段对齐 songquanpeng/one-api 的 Channel / Token / Log 模型 */
const SEED = {
  user:{ id:1, username:'yuanbao', nickname:'元宝用户', email:'yuanbao@example.com',
         quota:0, used_quota:0, group:'default', role:1, request_count:0 },
  groups:[
    { name:'default',   ratio:1,   desc:'默认分组，所有用户可用' },
    { name:'公开',       ratio:1,   desc:'对所有用户公开的分组' },
    { name:'Gemini',    ratio:.2,  desc:'Gemini 官方渠道分组' },
    { name:'DeepSeek 1017版本【订阅卡用户不支持！】', ratio:.7, desc:'DeepSeek 1017 专用分组' },
    { name:'MiniMax订阅卡', ratio:1,  desc:'MiniMax 订阅卡专用分组' },
    { name:'Claude',    ratio:1.2, desc:'Claude 直连分组' },
    { name:'千问',       ratio:.8,  desc:'阿里云百炼千问分组' },
    { name:'VIP',       ratio:.6,  desc:'高优先级分组' }
  ],
  channels:[
    { id:1, name:'DeepSeek-1017', desc:'DeepSeek-V4.1-Flash-1017 专用渠道', platform:'deepseek', plat:'p-deep',
      status:'enabled', groups:['公开','DeepSeek 1017版本【订阅卡用户不支持！】'], rate:'0.7x',
      models:['DeepSeek-V4.1-Flash-1017'], priority:10, weight:5, balance:182.4, used_quota:31740,
      response_time:820, test_time:1767225600, base_url:'https://api.deepseek.com', mapping:{} },
    { id:2, name:'Gemini-官方渠道', desc:'Gemini 全系模型聚合渠道', platform:'gemini', plat:'p-gem',
      status:'enabled', groups:['公开','Gemini'], rate:'0.2x',
      models:['gemini-3.1-flash-image','gemini-3.8-flash','gemini-3.8-flash-high'], priority:20, weight:8,
      balance:94.2, used_quota:24120, response_time:430, test_time:1767225600, base_url:'https://generativelanguage.googleapis.com', mapping:{} },
    { id:3, name:'MiniMax-订阅渠道', desc:'MiniMax 订阅卡渠道', platform:'minimax', plat:'p-min',
      status:'enabled', groups:['公开','MiniMax订阅卡'], rate:'1x',
      models:['minimax-m3.1-flash'], priority:15, weight:4, balance:58.7, used_quota:18900,
      response_time:610, test_time:1767225600, base_url:'https://api.minimax.chat', mapping:{} },
    { id:4, name:'OpenAI-默认渠道', desc:'OpenAI 官方接口，支持 GPT-4o / o3 系列', platform:'openai', plat:'p-deep',
      status:'enabled', groups:['公开','default'], rate:'1x',
      models:['gpt-4o-mini','gpt-4o','o3-mini','gpt-4.1'], priority:8, weight:10, balance:320.5,
      used_quota:52300, response_time:1150, test_time:1767225600, base_url:'https://api.openai.com', mapping:{} },
    { id:5, name:'Claude-直连渠道', desc:'Anthropic Claude 官方直连', platform:'anthropic', plat:'p-cla',
      status:'enabled', groups:['公开','Claude'], rate:'1.2x',
      models:['claude-sonnet-4-5','claude-3-7-sonnet','claude-haiku-4-5'], priority:12, weight:6,
      balance:140.9, used_quota:28600, response_time:1420, test_time:1767225600, base_url:'https://api.anthropic.com', mapping:{} },
    { id:6, name:'通义千问-阿里云', desc:'阿里云百炼千问全系模型', platform:'qwen', plat:'p-ppl',
      status:'enabled', groups:['公开','千问'], rate:'0.8x',
      models:['qwen-max','qwen-plus','qwen-turbo','qwen-vl-max'], priority:14, weight:7, balance:76.3,
      used_quota:15200, response_time:690, test_time:1767225600, base_url:'https://dashscope.aliyuncs.com/compatible-mode/v1', mapping:{} },
    { id:7, name:'Azure-备用渠道', desc:'Azure OpenAI 备用通道，当前停用', platform:'azure', plat:'p-deep',
      status:'disabled', groups:['公开','default'], rate:'1x',
      models:['gpt-4o','gpt-4o-mini'], priority:1, weight:1, balance:0, used_quota:0,
      response_time:0, test_time:1766966400, base_url:'https://xxx.openai.azure.com', mapping:{} },
    { id:8, name:'本地中转-备用', desc:'自建中转节点，连续三次探测失败后自动禁用', platform:'custom', plat:'p-min',
      status:'auto-disabled', groups:['公开','VIP'], rate:'0.6x',
      models:['qwen-max','gemini-3.8-flash'], priority:2, weight:1, balance:12.1, used_quota:4300,
      response_time:0, test_time:1766880000, base_url:'http://127.0.0.1:3000', mapping:{} }
  ],
  packages:[
    { id:'p10',  name:'入门包', amount:10,  price:9.9,  bonus:0 },
    { id:'p50',  name:'标准包', amount:50,  price:45,   bonus:5 },
    { id:'p200', name:'进阶包', amount:200, price:170,  bonus:30 },
    { id:'p500', name:'企业包', amount:500, price:395,  bonus:100 }
  ],
  errorCodes:[
    { code:400, title:'请求参数错误', symptom:'提示 model 不存在或 messages 格式不合法。',
      cause:'模型名拼写错误、未使用渠道支持的模型，或 message 缺少 role/content。',
      fix:'在「可用渠道」页复制该渠道的准确模型名；请求体必须包含 messages 数组，content 可为字符串。' },
    { code:401, title:'密钥无效或已过期', symptom:'返回 invalid_api_key 或 token 已失效。',
      cause:'密钥被禁用、已删除，或请求头 Authorization 未按 Bearer 格式携带。',
      fix:'在「API 密钥」页确认密钥状态为启用，调用格式为 Authorization: Bearer sk-xxx。' },
    { code:403, title:'分组无权访问', symptom:'提示当前分组不允许使用该模型。',
      cause:'密钥所属分组与渠道分组不匹配。',
      fix:'为密钥选择包含目标渠道的分组，或联系管理员把你的账号加入对应分组。' },
    { code:429, title:'触发限流', symptom:'返回 rate_limit_exceeded。',
      cause:'单分钟请求数或并发超过渠道限速阈值。',
      fix:'降低调用频率；大并发任务改用权重更高的渠道；指数退避重试。' },
    { code:500, title:'上游渠道异常', symptom:'返回 upstream_error 或 Internal Server Error。',
      cause:'上游厂商接口临时故障、额度耗尽或网络抖动。',
      fix:'查看渠道列表中该渠道的余额与最近测试时间；必要时切换到其他同平台渠道。' },
    { code:502, title:'网关无法连接上游', symptom:'请求超时或连接被重置。',
      cause:'渠道 base_url 填写错误、防火墙拦截或上游域名不可达。',
      fix:'在渠道详情里核对 base_url；本地网络需放行出站 443。' },
    { code:503, title:'没有可用渠道', symptom:'提示 no available channel。',
      cause:'所有匹配渠道均被禁用、权重为 0 或余额耗尽。',
      fix:'在「可用渠道」页把渠道状态切回启用并补充余额。' }
  ],
  docs:[
    { id:'chat',   name:'对话补全',   path:'POST /v1/chat/completions', desc:'OpenAI 兼容的文本/多模态对话接口' },
    { id:'models', name:'模型列表',   path:'GET  /v1/models',          desc:'查询当前密钥可用的模型' },
    { id:'embed',  name:'向量嵌入',   path:'POST /v1/embeddings',      desc:'生成文本向量，用于检索与聚类' },
    { id:'image',  name:'图像生成',   path:'POST /v1/images/generations', desc:'文生图与图生图' }
  ]
};

/* 演示用量：确定性伪随机，保证每次刷新数据一致 */
function seedUsage(days){
  let s=20260101, rnd=()=>((s=(s*1664525+1013904223)%4294967296)/4294967296);
  const models=['gemini-3.8-flash','gpt-4o-mini','DeepSeek-V4.1-Flash-1017','minimax-m3.1-flash','claude-sonnet-4-5','qwen-plus'];
  const channels=[1,2,3,4,5,6], out=[];
  const today=new Date('2026-10-27T00:00:00');
  for(let d=days-1;d>=0;d--){
    const day=new Date(today); day.setDate(day.getDate()-d);
    const weekday=day.getDay();
    const base=weekday===0||weekday===6?70:140;
    const req=Math.round(base+rnd()*90);
    let tokens=0,cost=0,fail=0;
    for(let i=0;i<req;i++){
      const m=models[Math.floor(rnd()*models.length)];
      const t=Math.round(300+rnd()*4200);
      tokens+=t;
      cost+=t*0.000012*(0.2+rnd());
      if(rnd()<0.03) fail++;
    }
    out.push({ date:day.toISOString().slice(0,10), requests:req, tokens, cost:+cost.toFixed(3), fail,
      models:Object.fromEntries(models.map(m=>[m,Math.round(req/6+rnd()*20)])) });
  }
  return out;
}

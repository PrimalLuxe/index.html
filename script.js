const storageKey = 'gc_data';
let data = JSON.parse(localStorage.getItem(storageKey) || '{}');
let typingTimer=null;

function save(){
  localStorage.setItem(storageKey, JSON.stringify(data));
}
function generateUser(){
  if(!data.userId){
    data.userId = 'Guest'+Math.floor(Math.random()*9000+1000);
    save();
  }
}
function ensureDefaults(){
  data.servers = data.servers || {home:{name:'Home',channels:{general:{messages:[]}}}};
  data.activeServer = data.activeServer || 'home';
  data.activeChannel = data.activeChannel || 'general';
  data.theme = data.theme || 'dark';
  data.accent = data.accent || '#5865f2';
  data.nickname = data.nickname || data.userId;
  data.messageCount = data.messageCount || 0;
  data.achievements = data.achievements || {};
}
function render(){
  document.body.dataset.theme = data.theme === 'light' ? 'light' : '';
  document.documentElement.style.setProperty('--accent', data.accent);
  renderServers();
  renderChannels();
  renderMessages();
  renderUsers();
  document.getElementById('accentPicker').value = data.accent;
}
function renderServers(){
  const cont=document.getElementById('servers');
  cont.innerHTML='';
  for(const [key,srv] of Object.entries(data.servers)){
    const div=document.createElement('div');
    div.className='server'+(key===data.activeServer?' active':'');
    div.textContent=srv.name[0]?.toUpperCase();
    div.title=srv.name;
    div.onclick=()=>{data.activeServer=key; data.activeChannel=Object.keys(srv.channels)[0]; save(); render();};
    cont.appendChild(div);
  }
  const add=document.createElement('div');
  add.className='server add';
  add.textContent='+';
  add.onclick=()=>{
    const name=prompt('Server name');
    if(!name) return;
    const id='srv'+Date.now();
    data.servers[id]={name,channels:{general:{messages:[]}}};
    data.activeServer=id; data.activeChannel='general';
    save(); render();
  };
  cont.appendChild(add);
}
function renderChannels(){
  const list=document.getElementById('channelList');
  const chs=data.servers[data.activeServer].channels;
  list.innerHTML='';
  Object.keys(chs).forEach(ch=>{
    const li=document.createElement('li');
    li.textContent='# '+ch;
    if(ch===data.activeChannel) li.classList.add('active');
    li.onclick=()=>{data.activeChannel=ch; save(); render();};
    list.appendChild(li);
  });
  document.getElementById('channelTitle').textContent = '# '+data.activeChannel;
}
function renderMessages(){
  const container=document.getElementById('messages');
  const msgs=data.servers[data.activeServer].channels[data.activeChannel].messages;
  container.innerHTML='';
  msgs.forEach(m=>{
    const div=document.createElement('div');
    div.className='message'+(m.pinned?' pinned':'');
    div.innerHTML=`<div class="meta"><span class="author">${m.author}</span> <span>${new Date(m.ts).toLocaleTimeString()}</span></div>`;
    const content=document.createElement('div');
    content.className='content';
    content.textContent=m.content;
    if(m.file){
      const img=document.createElement('img');
      img.src=m.file; img.style.maxWidth='200px';
      content.appendChild(img);
    }
    div.appendChild(content);
    if(m.reactions){
      const re=document.createElement('div');
      re.className='reactions';
      for(const [k,v] of Object.entries(m.reactions)){
        const span=document.createElement('span');
        span.textContent=`${k} ${v}`;
        re.appendChild(span);
      }
      div.appendChild(re);
    }
    div.ondblclick=()=>{m.pinned=!m.pinned; save(); renderMessages();};
    div.oncontextmenu=e=>{
      e.preventDefault();
      const emoji=prompt('React with emoji');
      if(!emoji) return;
      m.reactions = m.reactions || {};
      m.reactions[emoji] = (m.reactions[emoji]||0)+1;
      save(); renderMessages();
    };
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

function renderUsers(){
  const list=document.getElementById('userList');
  list.innerHTML='';
  const li=document.createElement('li');
  li.textContent=data.nickname;
  list.appendChild(li);
}
function sendSystem(content){
  const msg={id:Date.now(),author:'System',content,ts:Date.now()};
  data.servers[data.activeServer].channels[data.activeChannel].messages.push(msg);
  save(); renderMessages();
  notify(msg);
}
let typeraceWord=null;
function handleCommand(text){
  if(text.startsWith('/flip')){ sendSystem(Math.random()<0.5?'Heads':'Tails'); return true; }
  if(text.startsWith('/roll')){ sendSystem('Rolled '+(Math.floor(Math.random()*6)+1)); return true; }
  if(text.startsWith('/typerace')){ typeraceWord=randomWord(); sendSystem('Type this word: '+typeraceWord); return true; }
  if(typeraceWord && text===typeraceWord){ sendSystem('Completed typerace!'); typeraceWord=null; return false; }
  return false;
}
function randomWord(){
  const w=['apple','banana','cherry','dragon','elephant'];
  return w[Math.floor(Math.random()*w.length)];
}
function sendMessage(text, file){
  if(handleCommand(text)) return;
  const msg={id:Date.now(), author:data.nickname, content:text, ts:Date.now(), file:file||null};
  data.servers[data.activeServer].channels[data.activeChannel].messages.push(msg);
  data.messageCount++;
  save();
  renderMessages();
  checkAchievements();
  notify(msg);
}

function checkAchievements(){
  const milestones=[10,50,100];
  milestones.forEach(m=>{
    if(data.messageCount===m && !data.achievements[m]){
      data.achievements[m]=true;
      sendSystem(`Achievement unlocked: ${m} messages!`);
    }
  });
}

function notify(msg){
  if(Notification.permission==='granted' && document.hidden){
    new Notification(`${msg.author}`, {body:msg.content});
  }
}
let fileData=null;
const composer=document.getElementById('composer');
composer.addEventListener('submit',e=>{
  e.preventDefault();
  const input=document.getElementById('messageInput');
  const text=input.value.trim();
  if(!text && !fileData) return;
  sendMessage(text,fileData);
  input.value=''; fileData=null; document.getElementById('fileInput').value='';
});
document.getElementById('messageInput').addEventListener('input',()=>{
  const el=document.getElementById('typingIndicator');
  el.textContent=`${data.nickname} is typing...`;
  clearTimeout(typingTimer);
  typingTimer=setTimeout(()=>{el.textContent='';},1000);
});
document.getElementById('uploadBtn').addEventListener('click',()=>document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change',e=>{
  const file=e.target.files[0];
  if(file){
    const reader=new FileReader();
    reader.onload=ev=>{fileData=ev.target.result;};
    reader.readAsDataURL(file);
  }
});
document.getElementById('newChannel').addEventListener('click',()=>{
  const name=prompt('Channel name');
  if(!name) return;
  data.servers[data.activeServer].channels[name]={messages:[]};
  save(); renderChannels();
});
document.getElementById('themeToggle').addEventListener('click',()=>{
  data.theme = data.theme==='dark'?'light':'dark';
  save(); render();
});
document.getElementById('exportBtn').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='guestcord-data.json'; a.click();
  URL.revokeObjectURL(url);
});
document.getElementById('importBtn').addEventListener('click',()=>document.getElementById('importInput').click());
document.getElementById('importInput').addEventListener('change',e=>{
  const file=e.target.files[0];
  if(file){
    const reader=new FileReader();
    reader.onload=ev=>{ try{data=JSON.parse(ev.target.result); save(); render();}catch(err){alert('Invalid file');} };
    reader.readAsText(file);
  }
});
document.getElementById('searchBar').addEventListener('input',e=>{
  const term=e.target.value.toLowerCase();
  if(!term){ renderMessages(); return; }
  const container=document.getElementById('messages');
  container.innerHTML='';
  for(const [srvKey,srv] of Object.entries(data.servers)){
    for(const [chName,ch] of Object.entries(srv.channels)){
      ch.messages.filter(m=>m.content.toLowerCase().includes(term)).forEach(m=>{
        const div=document.createElement('div');
        div.className='message';
        div.innerHTML=`<div class=\"meta\">[${srv.name||'home'} #${chName}] ${m.author}</div><div>${m.content}</div>`;
        container.appendChild(div);
      });
    }
  }
});
document.getElementById('accentPicker').addEventListener('change',e=>{
  data.accent=e.target.value; save(); render();
});
document.getElementById('nickBtn').addEventListener('click',()=>{
  const n=prompt('Enter nickname', data.nickname);
  if(n){ data.nickname=n; save(); renderUsers(); }
});
document.addEventListener('keydown',e=>{
  if(e.ctrlKey && e.key==='k'){ e.preventDefault(); document.getElementById('searchBar').focus(); }
  if(e.ctrlKey && e.key==='b'){ e.preventDefault(); document.getElementById('themeToggle').click(); }
});
const dropArea=document.getElementById('messages');
['dragenter','dragover'].forEach(ev=>dropArea.addEventListener(ev,e=>{e.preventDefault(); dropArea.classList.add('drop-hover');}));
['dragleave','drop'].forEach(ev=>dropArea.addEventListener(ev,e=>{e.preventDefault(); dropArea.classList.remove('drop-hover');}));
dropArea.addEventListener('drop',e=>{
  const file=e.dataTransfer.files[0];
  if(file){
    const reader=new FileReader();
    reader.onload=ev=>{fileData=ev.target.result; sendMessage('',fileData);};
    reader.readAsDataURL(file);
  }
});
function init(){
  generateUser();
  ensureDefaults();
  render();
  if('Notification' in window && Notification.permission==='default'){
    Notification.requestPermission();
  }
}
init();

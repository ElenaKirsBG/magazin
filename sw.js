// Список покупок и учёт расходов · © 2026 Elena Kirsanova
// Офлайн-режим: приложение ВСЕГДА открывается из памяти телефона, обновления скачиваются в фоне.
const CACHE='magazin-v8';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const LIBS=['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'];
const good=r=>r&&r.ok&&!r.redirected&&(r.type==='basic'||r.type==='cors');

self.addEventListener('install',e=>{e.waitUntil((async()=>{
  const c=await caches.open(CACHE);
  await Promise.allSettled([...SHELL,...LIBS].map(async u=>{const r=await fetch(new Request(u,{cache:'reload'}));if(good(r))await c.put(u,r)}));
  // если новые файлы не скачались — переносим из старой версии, чтобы не остаться без приложения
  for(const k of await caches.keys()){if(k===CACHE)continue;const old=await caches.open(k);
    for(const u of [...SHELL,...LIBS]){if(!(await c.match(u))){const m=await old.match(u);if(m)await c.put(u,m)}}}
  await self.skipWaiting()})())});

self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  const c=await caches.open(CACHE);const ok=await c.match('./index.html');
  for(const k of await caches.keys())if(k!==CACHE&&ok)await caches.delete(k); // старое удаляем, только если новое на месте
  await self.clients.claim()})())});

const withTimeout=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(null),ms))]);

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const u=new URL(req.url);
  // облако синхронизации и всё прочее — напрямую в сеть, без кэша
  if(u.origin!==location.origin&&u.hostname!=='cdnjs.cloudflare.com')return;

  if(req.mode==='navigate'){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      const cached=await c.match('./index.html')||await c.match('./',{ignoreSearch:true});
      // в фоне — свежая версия (сохраняется, только если это действительно наше приложение)
      const net=fetch(req,{cache:'no-store'}).then(async r=>{
        if(good(r)&&u.origin===location.origin){const t=await r.clone().text();if(t.includes('magazin_data_v1'))await c.put('./index.html',r.clone())}
        return r}).catch(()=>null);
      if(cached){e.waitUntil(net);return cached}
      const r=await withTimeout(net,10000);
      return r||new Response('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font:18px -apple-system;padding:40px;text-align:center">Нет интернета, а приложение ещё не сохранено на телефоне.<br><br>Откройте его один раз с Wi‑Fi.</body>',{headers:{'Content-Type':'text/html;charset=utf-8'}});
    })());return}

  // файлы и библиотеки: из памяти телефона, при отсутствии — из сети с сохранением
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);const m=await c.match(req,{ignoreSearch:true});
    if(m)return m;
    try{const r=await fetch(req);if(good(r)||(r.type==='opaque'&&u.hostname==='cdnjs.cloudflare.com'))c.put(req,r.clone());return r}
    catch(err){return new Response('',{status:504})}
  })());
});

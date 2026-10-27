/* ExamenKompas — één volledig origineel examenblad naast het antwoordvak. */
(() => {
  'use strict';
  const iframe=document.querySelector('iframe#paper');
  if(!iframe)return;
  const match=location.pathname.match(/^\/(havo|vwo)-([ab])-examen-(20\d\d)\.html$/i);
  if(!match)return;
  const slug=match[1]+'-'+match[2]+'-examen-'+match[3];
  const css=document.createElement('style');
  css.textContent=`
    .layout{display:grid!important;grid-template-columns:minmax(0,1.6fr) minmax(330px,.9fr)!important;max-width:1650px!important;gap:14px!important;padding:12px 16px!important;align-items:start!important}
    .layout>aside:first-child:not(.answer){display:none!important}
    .layout>.answer{grid-column:2!important;position:sticky!important;top:10px!important;max-height:calc(100dvh - 20px)!important;overflow-y:auto!important}
    .layout>main{grid-column:1!important;min-width:0!important}
    .hero{padding-top:10px!important;padding-bottom:10px!important}.hero h1{font-size:22px!important}
    .ek-paper-single{position:relative;width:100%;height:calc(100dvh - 300px);min-height:385px;overflow:auto;background:#edf2f8;border:1px solid #dbe3ef;border-radius:12px;display:flex;align-items:center;justify-content:center;padding:9px}
    .ek-paper-single canvas{display:block;width:auto;height:auto;max-width:100%;max-height:100%;background:#fff;box-shadow:0 4px 18px rgba(24,44,69,.13)}
    .ek-paper-single.ek-zoom{align-items:flex-start;justify-content:flex-start}
    .ek-paper-single.ek-zoom canvas{max-height:none;width:100%;height:auto}
    .ek-paper-single .ek-msg{text-align:center;max-width:440px;padding:30px 15px;color:#405670;margin:auto}
    .ek-paper-single .ek-msg strong{display:block;color:#17385e;font-size:16px;margin-bottom:8px}
    .ek-paper-info{margin-top:8px;font-size:12px;color:#536780;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .ek-paper-info button{border:1px solid #c8d7eb;border-radius:8px;background:#fff;color:#2457a8;font:700 12px system-ui;padding:7px 9px;cursor:pointer}
    .answer textarea{min-height:225px!important}
    .ek-extra{border:1px solid #d9e3f1;border-radius:10px;margin-top:12px;background:#f9fbfe;overflow:hidden}
    .ek-extra>summary{cursor:pointer;font-size:13px;font-weight:750;color:#375b88;padding:11px}
    .ek-extra>div{padding:12px;border-top:1px solid #d9e3f1}
    @media(max-width:900px){.layout{grid-template-columns:minmax(0,1fr)!important;padding:10px!important}.layout>main,.layout>.answer{grid-column:1!important}.layout>.answer{position:static!important;max-height:none!important;overflow:visible!important}.ek-paper-single{height:min(68vh,660px);min-height:350px}}
    @media(max-width:540px){.ek-paper-single{height:55vh;min-height:310px;padding:5px}}
  `;
  document.head.append(css);

  // Verouderde instructies verwezen nog naar een volledig PDF-document.
  for(const p of document.querySelectorAll('main p')){
    if(/Zoek de geselecteerde vraag|exacte paginakoppeling/i.test(p.textContent||''))p.hidden=true;
  }
  const answerPanel=document.querySelector('.layout>.answer');
  if(answerPanel){
    const extras=[...answerPanel.querySelectorAll('.notice,.warning,.links,.sourcebox')];
    if(extras.length){
      const detail=document.createElement('details');detail.className='ek-extra';
      const summary=document.createElement('summary');summary.textContent='Bronnen en extra informatie';
      const body=document.createElement('div');extras.forEach(el=>body.append(el));
      detail.append(summary,body);answerPanel.append(detail);
    }
  }
  const prev=document.getElementById('prev'),next=document.getElementById('next');
  if(prev)prev.textContent='← Vorige vraag';
  if(next)next.textContent='Volgende vraag →';

  const host=document.createElement('div');
  host.id='paper';host.className='ek-paper-single';host.setAttribute('role','region');
  host.setAttribute('aria-label','Volledig origineel examenblad bij de actieve vraag');
  host.innerHTML='<div class="ek-msg" role="status"><strong>Examenpagina laden…</strong>Het volledige bronblad wordt getoond.</div>';
  iframe.replaceWith(host);
  const info=document.createElement('div');info.className='ek-paper-info';
  const label=document.createElement('span');label.textContent='Eén volledig examenblad tegelijk · oorspronkelijke examenbron';
  const zoom=document.createElement('button');zoom.type='button';zoom.textContent='Vergroot pagina';
  const source=document.createElement('a');source.textContent='Officiële bron ↗';
  source.href=document.querySelector('a[href*="/documenten/cse-1/"][href*="-o"]')?.href||'https://www.examenblad.nl/';
  source.target='_blank';source.rel='noopener';
  info.append(label,zoom,source);host.after(info);
  let pdf=null,metadata=null,renderTask=null,revision=0,currentQuestion=-1,lastWidth=0;
  const question=()=>Math.max(1,parseInt(new URLSearchParams(location.search).get('vraag')||'1',10)||1);
  const msg=(title,body)=>{
    host.replaceChildren();
    const div=document.createElement('div');div.className='ek-msg';div.setAttribute('role','status');
    const strong=document.createElement('strong');strong.textContent=title;
    const span=document.createElement('span');span.textContent=body;
    div.append(strong,span);host.append(div);
  };

  async function render(){
    if(!pdf||!metadata)return;
    const q=question(),pageNo=Number(metadata.pages[String(q)]),id=++revision;
    if(renderTask){try{renderTask.cancel()}catch(_){}renderTask=null;}
    if(!pageNo){msg('Vraag '+q,'Voor deze vraag is nog geen bronpagina gekoppeld. Gebruik de officiële bronlink.');return;}
    msg('Vraag '+q+' laden…','De opgave wordt klaargezet.');
    try{
      const page=await pdf.getPage(pageNo);if(id!==revision)return;
      const base=page.getViewport({scale:1});
      const scale=Math.max(1.3,Math.min(2.1,(host.clientWidth-20)/base.width*1.5));
      const viewport=page.getViewport({scale});
      const raw=document.createElement('canvas');raw.width=Math.ceil(viewport.width);raw.height=Math.ceil(viewport.height);
      renderTask=page.render({canvasContext:raw.getContext('2d'),viewport});
      await renderTask.promise;if(id!==revision)return;
      raw.setAttribute('role','img');raw.setAttribute('aria-label','Volledig examenblad '+pageNo+' bij vraag '+q);
      host.replaceChildren(raw);host.scrollTop=0;
      label.textContent='Vraag '+q+' · volledig examenblad '+pageNo+' van '+pdf.numPages;
      currentQuestion=q;
    }catch(e){
      if(id===revision&&e.name!=='RenderingCancelledException')msg('Examenopgave kan niet worden getoond',String(e.message||'Open de officiële bron.'));
    }
  }
  zoom.onclick=()=>{const big=host.classList.toggle('ek-zoom');zoom.textContent=big?'Passend tonen':'Vergroot pagina';};
  const monitor=()=>{if(question()!==currentQuestion&&pdf&&metadata){host.classList.remove('ek-zoom');zoom.textContent='Vergroot pagina';render();}};
  const originalReplace=history.replaceState;
  history.replaceState=function(){const result=originalReplace.apply(this,arguments);queueMicrotask(monitor);return result;};
  window.addEventListener('popstate',monitor);
  window.addEventListener('resize',()=>{if(Math.abs(host.clientWidth-lastWidth)>45){lastWidth=host.clientWidth;render();}});

  (async()=>{
    try{
      const response=await fetch('/exam-pdfs/questions.json');
      if(!response.ok)throw new Error('Paginakoppelingen zijn niet beschikbaar.');
      const manifest=await response.json();metadata=manifest[slug];
      if(!metadata?.pages)throw new Error('Paginakoppelingen ontbreken voor dit examen.');
      if(!window.pdfjsLib){
        await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('PDF-weergave is niet beschikbaar.'));document.head.append(script);});
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdf=await window.pdfjsLib.getDocument('/exam-pdfs/'+slug+'.pdf').promise;
      lastWidth=host.clientWidth;await render();
    }catch(e){msg('Examenblad tijdelijk niet beschikbaar',String(e.message||'Probeer het later opnieuw.'));}
  })();

  // De gratis zelfnakijkfunctie wordt door alle examenjaren gedeeld.
  const gradingScript=document.createElement('script');
  gradingScript.src='/exam-grading.js?v=1';
  document.body.append(gradingScript);
})();

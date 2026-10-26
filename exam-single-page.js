/* ExamenKompas — één actieve vraag, één antwoordvak, één uitsnede van de bron. */
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
  host.setAttribute('aria-label','Alleen de examenopgave bij de actieve vraag');
  host.innerHTML='<div class="ek-msg" role="status"><strong>Examenopgave laden…</strong>Je ziet straks één vraag naast je antwoord.</div>';
  iframe.replaceWith(host);
  const info=document.createElement('div');info.className='ek-paper-info';
  const label=document.createElement('span');label.textContent='Eén vraag tegelijk · oorspronkelijke examenbron';
  const zoom=document.createElement('button');zoom.type='button';zoom.textContent='Vergroot opgave';
  const whole=document.createElement('button');whole.type='button';whole.textContent='Bekijk heel bronblad';
  const source=document.createElement('a');source.textContent='Officiële bron ↗';
  source.href=document.querySelector('a[href*="/documenten/cse-1/"][href*="-o"]')?.href||'https://www.examenblad.nl/';
  source.target='_blank';source.rel='noopener';
  info.append(label,zoom,whole,source);host.after(info);
  let pdf=null,metadata=null,renderTask=null,revision=0,currentQuestion=-1,lastWidth=0,fullPage=false;
  const question=()=>Math.max(1,parseInt(new URLSearchParams(location.search).get('vraag')||'1',10)||1);
  const msg=(title,body)=>{
    host.replaceChildren();
    const div=document.createElement('div');div.className='ek-msg';div.setAttribute('role','status');
    const strong=document.createElement('strong');strong.textContent=title;
    const span=document.createElement('span');span.textContent=body;
    div.append(strong,span);host.append(div);
  };

  // Zoek de vraagnummers in de tekstlaag. Ze staan in officiële examens
  // op een vaste linkermarge. Ontbreekt een leesbare tekstlaag, toon veilig
  // één heel bronblad in plaats van een mogelijk onvolledige uitsnede.
  async function questionSections(page,pageNo,q,base){
    if(fullPage)return [[0,base.height]];
    const nums=Object.entries(metadata.pages).filter(([,p])=>Number(p)===pageNo).map(([n])=>Number(n)).sort((a,b)=>a-b);
    if(nums.length===1)return [[0,base.height]];
    let tc;
    try{tc=await page.getTextContent()}catch(_){return [[0,base.height]];}
    const markers=new Map();
    for(const n of nums){
      const candidates=tc.items.filter(item=>{
        const str=String(item.str||'').trim();
        const x=item.transform?.[4]??-1;
        const y=base.height-(item.transform?.[5]??0);
        return (str===String(n)||new RegExp('^'+n+'\\s+[A-ZÀ-ÿ]').test(str))&&x>base.width*.09&&x<base.width*.245&&y>base.height*.1&&y<base.height*.92;
      });
      candidates.sort((a,b)=>Math.abs(a.transform[4]-base.width*.14)-Math.abs(b.transform[4]-base.width*.14));
      if(candidates.length)markers.set(n,base.height-candidates[0].transform[5]);
    }
    if(!markers.has(q))return [[0,base.height]];
    const previous=nums.filter(n=>n<q&&markers.has(n)).at(-1);
    const next=nums.find(n=>n>q&&markers.has(n));
    const bottom=next?Math.max(markers.get(q)+23,markers.get(next)-92):base.height;
    if(!previous)return [[0,bottom]];
    // Neem voldoende introductietekst mee; die staat vaak direct na de vorige vraag.
    const start=Math.max(0,Math.min(markers.get(previous)+16,markers.get(q)-90));
    const firstKnown=nums.find(n=>markers.has(n));
    const intro=Math.min(Math.max(0,markers.get(firstKnown)-28),base.height*.31);
    if(start<=intro+18)return [[0,bottom]];
    return [[0,intro],[start,bottom]];
  }

  async function render(){
    if(!pdf||!metadata)return;
    const q=question(),pageNo=Number(metadata.pages[String(q)]),id=++revision;
    if(renderTask){try{renderTask.cancel()}catch(_){}renderTask=null;}
    if(!pageNo){msg('Vraag '+q,'Voor deze vraag is nog geen bronpagina gekoppeld. Gebruik de officiële bronlink.');return;}
    msg('Vraag '+q+' laden…','De opgave wordt klaargezet.');
    try{
      const page=await pdf.getPage(pageNo);if(id!==revision)return;
      const base=page.getViewport({scale:1});
      const segments=await questionSections(page,pageNo,q,base);if(id!==revision)return;
      const scale=Math.max(1.3,Math.min(2.1,(host.clientWidth-20)/base.width*1.5));
      const viewport=page.getViewport({scale});
      const raw=document.createElement('canvas');raw.width=Math.ceil(viewport.width);raw.height=Math.ceil(viewport.height);
      renderTask=page.render({canvasContext:raw.getContext('2d'),viewport});
      await renderTask.promise;if(id!==revision)return;
      const safeSegments=segments.filter(([a,b])=>b>a+5);
      const gap=safeSegments.length>1?14:0;
      const display=document.createElement('canvas');
      display.width=raw.width;
      display.height=Math.ceil(safeSegments.reduce((n,[a,b])=>n+(b-a)*scale,0)+(safeSegments.length-1)*gap);
      const ctx=display.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,display.width,display.height);
      let offset=0;
      safeSegments.forEach(([start,end],i)=>{
        const top=Math.round(start*scale),height=Math.round((end-start)*scale);
        ctx.drawImage(raw,0,top,raw.width,height,0,offset,raw.width,height);
        offset+=height;
        if(i<safeSegments.length-1){ctx.fillStyle='#e7eef7';ctx.fillRect(0,offset,display.width,gap);offset+=gap;}
      });
      display.setAttribute('role','img');display.setAttribute('aria-label','Examenopgave bij vraag '+q);
      host.replaceChildren(display);host.scrollTop=0;
      label.textContent='Vraag '+q+' · bronblad '+pageNo+' van '+pdf.numPages+' · '+(safeSegments.length===1&&segments[0][1]===base.height?'één blad':'alleen deze vraag');
      currentQuestion=q;
    }catch(e){
      if(id===revision&&e.name!=='RenderingCancelledException')msg('Examenopgave kan niet worden getoond',String(e.message||'Open de officiële bron.'));
    }
  }
  zoom.onclick=()=>{const big=host.classList.toggle('ek-zoom');zoom.textContent=big?'Passend tonen':'Vergroot opgave';};
  whole.onclick=()=>{fullPage=!fullPage;whole.textContent=fullPage?'Toon alleen vraag':'Bekijk heel bronblad';host.classList.remove('ek-zoom');zoom.textContent='Vergroot opgave';render();};
  const monitor=()=>{if(question()!==currentQuestion&&pdf&&metadata){fullPage=false;whole.textContent='Bekijk heel bronblad';host.classList.remove('ek-zoom');zoom.textContent='Vergroot opgave';render();}};
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
})();

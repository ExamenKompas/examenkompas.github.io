/* ExamenKompas — toon uitsluitend het ene bronblad bij de actieve vraag.
   Het complete examen wordt niet als scrollbaar PDF-document ingebed. */
(function () {
  'use strict';
  const iframe = document.querySelector('iframe#paper');
  if (!iframe) return;
  const match = location.pathname.match(/^\/(havo|vwo)-([ab])-examen-(20\d\d)\.html$/i);
  if (!match) return;
  const slug = match[1] + '-' + match[2] + '-examen-' + match[3];
  const css = document.createElement('style');
  css.textContent = `
    .ek-paper-single {position:relative;width:100%;height:calc(100vh - 200px);min-height:500px;overflow:auto;background:#edf2f8;border:1px solid #dbe3ef;border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px}
    .ek-paper-single canvas {display:block;max-width:100%;height:auto;background:white;box-shadow:0 4px 18px rgba(24,44,69,.13)}
    .ek-paper-single .ek-msg {text-align:center;max-width:440px;padding:30px 15px;color:#405670;margin:auto}
    .ek-paper-single .ek-msg strong{display:block;color:#17385e;font-size:16px;margin-bottom:8px}
    .ek-paper-info {margin-top:8px;font-size:12px;color:#536780;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    @media(max-width:900px){.ek-paper-single{height:68vh;min-height:420px;padding:7px}}
    @media(max-width:540px){.ek-paper-single{height:56vh;min-height:350px}}
  `;
  document.head.append(css);
  const host = document.createElement('div');
  host.id = 'paper';
  host.className = 'ek-paper-single';
  host.setAttribute('role','region');
  host.setAttribute('aria-label','Enkele originele examenpagina bij de actieve vraag');
  host.innerHTML = '<div class="ek-msg" role="status"><strong>Examenpagina laden…</strong>De geselecteerde pagina wordt afzonderlijk weergegeven.</div>';
  iframe.replaceWith(host);
  const info=document.createElement('div');
  info.className='ek-paper-info';
  const label=document.createElement('span');
  label.textContent='Eén examenpagina tegelijk · originele pagina ongewijzigd';
  const source=document.createElement('a');
  source.textContent='Officiële bron ↗';
  source.href = document.querySelector('a[href*="/documenten/cse-1/"][href*="-o"]')?.href || 'https://www.examenblad.nl/';
  source.target='_blank';source.rel='noopener';
  info.append(label,source);
  host.after(info);
  const slugPdf='/exam-pdfs/'+slug+'.pdf';
  let pdf=null,metadata=null,task=null,revision=0,currentQuestion=-1,lastWidth=0;
  const msg=(heading,body)=>{
    host.replaceChildren();
    const element=document.createElement('div');
    element.className='ek-msg';element.setAttribute('role','status');
    const bold=document.createElement('strong');bold.textContent=heading;
    const line=document.createElement('span');line.textContent=body;
    element.append(bold,line);host.append(element);
  };
  const question=()=>Math.max(1,parseInt(new URLSearchParams(location.search).get('vraag')||'1',10)||1);
  async function render() {
    if(!pdf || !metadata)return;
    const q=question();
    const pageNumber=Number(metadata.pages[String(q)]);
    const revisionId=++revision;
    if(task){try{task.cancel()}catch(_){ }task=null;}
    if(!pageNumber){
      msg('Vraag '+q,'De juiste bronpagina voor deze vraag is nog niet gevonden. Gebruik zo nodig de officiële bronlink.');
      return;
    }
    msg('Vraag '+q+' laden…','Examenblad '+pageNumber+' wordt getoond.');
    try {
      const page=await pdf.getPage(pageNumber);
      if(revisionId!==revision)return;
      const base=page.getViewport({scale:1});
      const available=Math.max(250,host.clientWidth-30);
      const scale=Math.min(2.1,available/base.width);
      const viewport=page.getViewport({scale});
      const ratio=Math.min(2,window.devicePixelRatio||1);
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(viewport.width*ratio);
      canvas.height=Math.round(viewport.height*ratio);
      canvas.style.width=Math.round(viewport.width)+'px';
      canvas.style.height=Math.round(viewport.height)+'px';
      const context=canvas.getContext('2d');
      context.setTransform(ratio,0,0,ratio,0,0);
      if(revisionId!==revision)return;
      host.replaceChildren(canvas);
      host.scrollTop=0;
      task=page.render({canvasContext:context,viewport});
      await task.promise;
      if(revisionId===revision){label.textContent='Vraag '+q+' · origineel examenblad '+pageNumber+' van '+pdf.numPages+' · één blad tegelijk';currentQuestion=q;}
    } catch(e) {
      if(revisionId===revision && e.name!=='RenderingCancelledException') {
        msg('Examenpagina kan niet worden getoond','Open de officiële bron via de link onder de pagina. '+String(e.message||''));
      }
    }
  }
  const timer=()=>{const q=question();if(q!==currentQuestion && pdf && metadata)render();};
  function startWatcher(){
    const oldReplace=history.replaceState;
    history.replaceState=function(){const result=oldReplace.apply(this,arguments);queueMicrotask(timer);return result;};
    window.addEventListener('popstate',timer);
    window.addEventListener('resize',()=>{if(Math.abs(host.clientWidth-lastWidth)>55){lastWidth=host.clientWidth;render();}});
  }
  startWatcher();
  async function init(){
    try{
      const manifestResponse=await fetch('/exam-pdfs/questions.json');
      if(!manifestResponse.ok)throw new Error('Paginakoppelingen zijn nog niet gepubliceerd.');
      const manifest=await manifestResponse.json();
      metadata=manifest[slug];
      if(!metadata||!metadata.pages)throw new Error('Paginakoppelingen ontbreken voor dit examen.');
      if(!window.pdfjsLib){
        await new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload=resolve;
          script.onerror=()=>reject(new Error('PDF-weergavebibliotheek is niet beschikbaar.'));
          document.head.append(script);
        });
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const documentTask=window.pdfjsLib.getDocument(slugPdf);
      pdf=await documentTask.promise;
      lastWidth=host.clientWidth;
      await render();
    } catch (e) {
      msg('Examenblad tijdelijk niet beschikbaar',String(e.message||'Probeer het later opnieuw.'));
    }
  }
  init();
})();

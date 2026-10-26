/* Havo B 2022: één vraag en één antwoordvak, zonder examenoverzicht. */
(() => {
  'use strict';
  if (!document.getElementById('page-picture') || typeof setPage !== 'function') return;

  const css = document.createElement('style');
  css.textContent = `
    .side {display:none!important}
    .layout {max-width:1580px!important;grid-template-columns:minmax(0,1.55fr) minmax(330px,.9fr)!important;gap:14px!important;padding:12px 18px 28px!important;align-items:start!important}
    .banner {padding:11px 20px!important}.banner h1 {font-size:23px!important;margin:2px 0!important}
    .banner .eyebrow,.banner .pill {display:none!important}
    .pane {padding:14px!important}.workspace-heading {padding:3px 0 10px!important}
    .workspace-heading h2 {font-size:17px!important}.page-actions {gap:7px!important}
    .page-shell {height:calc(100dvh - 208px);min-height:430px!important;padding:9px!important;overflow:auto!important;align-items:center!important;background:#edf1f6!important}
    #page-picture {display:none!important}
    #ek-question-canvas {display:block;width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain;background:white;box-shadow:0 4px 18px #20344a20}
    .page-shell.ek-zoom {align-items:flex-start!important;justify-content:flex-start!important}
    .page-shell.ek-zoom #ek-question-canvas {max-width:none;max-height:none;width:100%;height:auto}
    .answers {position:sticky!important;top:10px!important;max-height:calc(100dvh - 20px)!important;overflow-y:auto!important}
    .answer-stack {grid-template-columns:minmax(0,1fr)!important}.answer-card {background:#fff!important}
    .answer-card textarea {min-height:205px!important}.answers > .tiny {margin:6px 0 12px}
    .vis-note {display:none!important}.page-foot {font-size:11px!important;padding-top:8px!important}
    #page-number {font-weight:800;color:#405877;white-space:nowrap;font-size:13px}
    #ek-zoom-toggle {font-size:12px;padding:7px 10px}
    @media(max-width:900px){.layout{grid-template-columns:minmax(0,1fr)!important;padding:10px!important}.answers{position:static!important;max-height:none!important;overflow:visible!important}.page-shell{height:min(68vh,690px);min-height:350px!important}.banner h1{font-size:20px!important}}
    @media(max-width:520px){.page-actions{width:100%;justify-content:space-between}.page-shell{height:55vh;min-height:315px!important}.page-foot{display:none!important}}
  `;
  document.head.append(css);

  const shell = document.querySelector('.page-shell');
  const img = document.getElementById('page-picture');
  const canvas = document.createElement('canvas');
  canvas.id = 'ek-question-canvas';
  canvas.setAttribute('role','img');
  shell.append(canvas);
  const counter = document.getElementById('page-number');
  const zoom = document.createElement('button');
  zoom.type='button';zoom.className='btn';zoom.id='ek-zoom-toggle';
  zoom.textContent='Vergroot opgave';
  document.querySelector('.page-actions').after(zoom);
  zoom.onclick=()=>{const big=shell.classList.toggle('ek-zoom');zoom.textContent=big?'Passend tonen':'Vergroot opgave';};

  // Handmatig gecontroleerde uitsneden van originele examenbladen.
  // Elke vraag behoudt de gedeelde context bovenaan de oorspronkelijke pagina.
  const sections = {
    1:[[.035,.47]], 2:[[.035,.145],[.475,.895]],
    6:[[.035,.505]], 7:[[.035,.17],[.49,.925]],
    9:[[.035,.475]], 10:[[.04,.325],[.455,.81]],
    11:[[.035,.505]], 12:[[.035,.165],[.48,.925]],
    13:[[.035,.54]], 14:[[.035,.17],[.515,.94]]
  };
  let active = 1;
  const originalSetPage = setPage;

  async function cropQuestion(q) {
    const pageNumber=PAGE_OF_QUESTION[q];
    const url=EXAM_PAGES[pageNumber];
    const preview=new Image();
    preview.src=url;
    try {await preview.decode();}catch(_){return;}
    if(q!==active)return;
    const {naturalWidth:w,naturalHeight:h}=preview;
    const cuts=sections[q]||[[.025,.95]];
    const margin=12;
    const cropX=Math.round(w*.055), cropWidth=Math.round(w*.89);
    const pieces=cuts.map(([start,end])=>({y:Math.round(start*h),height:Math.round((end-start)*h)}));
    canvas.width=cropWidth;
    canvas.height=pieces.reduce((acc,p)=>acc+p.height,0)+(pieces.length-1)*margin;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    let y=0;
    for (const [i,p] of pieces.entries()) {
      ctx.drawImage(preview,cropX,p.y,cropWidth,p.height,0,y,cropWidth,p.height);
      y+=p.height;
      if (i<pieces.length-1) {ctx.fillStyle='#edf2f8';ctx.fillRect(0,y,cropWidth,margin);y+=margin;}
    }
    canvas.setAttribute('aria-label','Originele examenopgave bij vraag '+q+' van 16');
    shell.scrollTop=0;
  }

  function setActiveQuestion(q,{syncUrl=true}={}) {
    if(!Number.isInteger(q)||q<1||q>16)return;
    active=q;
    originalSetPage(PAGE_OF_QUESTION[q]);
    const stack=document.getElementById('answer-stack');
    const onlyCard=document.getElementById('answer-q'+q);
    if(onlyCard)stack.replaceChildren(onlyCard);
    document.getElementById('chapter-name').textContent='Vraag '+q+' · '+EXAM_INFO[PAGE_OF_QUESTION[q]].topic;
    document.getElementById('prev-page').disabled=q===1;
    document.getElementById('next-page').disabled=q===16;
    counter.textContent='Vraag '+q+' / 16';
    if(syncUrl)history.replaceState(null,'','?vraag='+q);
    shell.classList.remove('ek-zoom');zoom.textContent='Vergroot opgave';
    cropQuestion(q);
  }
  document.getElementById('prev-page').textContent='← Vorige vraag';
  document.getElementById('next-page').textContent='Volgende vraag →';
  document.getElementById('prev-page').onclick=()=>setActiveQuestion(active-1);
  document.getElementById('next-page').onclick=()=>setActiveQuestion(active+1);
  document.getElementById('cover-button').onclick=()=>setActiveQuestion(1);
  window.addEventListener('popstate',()=>{
    const q=Number(new URLSearchParams(location.search).get('vraag'));
    setActiveQuestion(Number.isInteger(q)&&q>=1&&q<=16?q:1,{syncUrl:false});
  });
  const start=Number(new URLSearchParams(location.search).get('vraag'));
  setActiveQuestion(Number.isInteger(start)&&start>=1&&start<=16?start:1);
})();

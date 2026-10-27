/* ExamenKompas — gratis zelf nakijken en officieel cijfer, tijdvak 1. */
(() => {
  'use strict';
  const special = !!document.getElementById('page-picture');
  const match = location.pathname.match(/^\/(havo|vwo)-([ab])-examen-(20\d\d)\.html$/i);
  const slug = special ? 'havo-b-examen-2022' : match?.[1] + '-' + match?.[2] + '-examen-' + match?.[3];
  if ((!special && !match) || document.getElementById('ek-grade-finish')) return;

  const panel = special ? document.querySelector('.answers') : document.querySelector('.layout > .answer');
  if (!panel) return;

  const styles = document.createElement('style');
  styles.textContent = `
    .ek-scorebox,.ek-gradebox{border:1px solid #cbdcf1;border-radius:13px;padding:13px;margin:13px 0;background:#f5f9ff;color:#173452}
    .ek-scorebox label{display:block;font-size:13px;font-weight:800;margin:0 0 7px}
    .ek-scorebox select{width:100%;padding:10px;background:white;border:1px solid #b9cee9;border-radius:9px;font:inherit;color:#173452}
    .ek-scorebox p,.ek-gradebox p{font-size:12px;color:#58708d;margin:6px 0 0;line-height:1.5}
    .ek-gradebox h3{margin:0 0 5px;font-size:17px;color:#153a70}
    .ek-grade-track{height:8px;border-radius:50px;overflow:hidden;background:#dae6f5;margin:10px 0}
    .ek-grade-track span{display:block;height:100%;background:#21a77a;width:0;transition:width .2s}
    .ek-grade-btn{width:100%;border:0;background:#235ed0;color:white;border-radius:10px;padding:11px 12px;cursor:pointer;font-weight:800;font:800 14px system-ui}
    .ek-grade-btn:hover{background:#174bb0}.ek-grade-btn:focus-visible{outline:3px solid #ffb950;outline-offset:2px}
    .ek-results-dialog{border:0;border-radius:18px;box-shadow:0 20px 80px #0a245669;background:white;color:#153452;padding:0;width:min(650px,calc(100vw - 24px));max-height:min(90dvh,820px);overflow:auto}
    .ek-results-dialog::backdrop{background:#092148a8}
    .ek-results-body{padding:24px}.ek-results-head{display:flex;align-items:start;justify-content:space-between;gap:15px}
    .ek-results-head h2{font-size:23px;margin:0}.ek-results-sub{color:#637a94;font-size:13px;margin:2px 0 14px}
    .ek-results-close{border:1px solid #cbd9ed;border-radius:9px;background:#fff;color:#244970;padding:7px 11px;font-size:19px;cursor:pointer}
    .ek-score-total{border-radius:14px;padding:20px;text-align:center;background:linear-gradient(120deg,#e9f7f1,#e7f0ff);margin-bottom:14px}
    .ek-score-total strong{display:block;font:800 56px/1.1 system-ui;color:#187657;letter-spacing:-2px}
    .ek-score-total.ek-low strong{color:#c35a2d}.ek-score-total span{display:block;font-size:14px;color:#385d7a;margin-top:5px}
    .ek-results-guidance{border:1px solid #d5e3f4;background:#f6f9ff;padding:12px;border-radius:10px;font-size:13px;margin:12px 0}
    .ek-result-table{width:100%;border-collapse:collapse;font-size:14px}
    .ek-result-table th,.ek-result-table td{padding:8px 6px;border-bottom:1px solid #e6edf5;text-align:left}
    .ek-result-table td:last-child,.ek-result-table th:last-child{text-align:right;font-weight:750}
    .ek-result-table tr.ek-unchecked{color:#a65d22}
    .ek-results-source{display:block;font-size:12px;margin:13px 0;color:#235ab3}
    @media(max-width:520px){.ek-results-body{padding:16px}.ek-score-total strong{font-size:46px}}
  `;
  document.head.append(styles);

  fetch('/exam-grading-data.json?v=1', {cache:'force-cache'})
    .then(r => {if (!r.ok) throw new Error('Cijfergegevens niet beschikbaar');return r.json();})
    .then(all => initialize(all[slug]))
    .catch(err => console.warn('ExamenKompas resultaten:',err));

  function initialize(spec) {
    if (!spec || !Array.isArray(spec.points) || !Array.isArray(spec.grades)) return;
    const total = spec.points.length;
    if (spec.points.reduce((a,b)=>a+b,0)!==spec.max || spec.grades.length!==spec.max+1) return;
    const nativeScores = typeof state!=='undefined' && !!state.scores &&
      (special || !!document.getElementById('score'));
    const key = 'examenkompas_grading_'+slug+'_v1';
    let own = {scores:{}};
    if (!nativeScores) {
      try {const saved=JSON.parse(localStorage.getItem(key)||'{}');if(saved&&typeof saved.scores==='object')own=saved;} catch (_) {}
    }
    const scoreState = () => nativeScores ? state.scores : own.scores;
    const scoreFor = q => {
      const raw=scoreState()?.[q];
      if (raw===undefined || raw===null || raw==='') return null;
      const value=Number(raw);
      return Number.isInteger(value)&&value>=0&&value<=spec.points[q-1] ? value : null;
    };
    const currentQuestion=()=>{
      const q=Number(new URLSearchParams(location.search).get('vraag'));
      return Number.isInteger(q)&&q>=1&&q<=total ? q : 1;
    };
    const fmt=num=>Number(num).toFixed(1).replace('.',',');

    // Pagina's met alleen een antwoordvak krijgen een eigen scorekeuze.
    let select=null,scoreLabel=null;
    if (!nativeScores) {
      const box=document.createElement('section');box.className='ek-scorebox';
      scoreLabel=document.createElement('label');scoreLabel.htmlFor='ek-question-score';
      select=document.createElement('select');select.id='ek-question-score';
      const hint=document.createElement('p');
      hint.textContent='Vergelijk je uitwerking met het officiële correctievoorschrift hierboven. Ook 0 punten moet je invullen.';
      box.append(scoreLabel,select,hint);
      const model=document.getElementById('model');
      if(model)model.after(box);else panel.append(box);
      select.addEventListener('change',()=>{
        const q=currentQuestion();
        if(select.value==='')delete own.scores[q];else own.scores[q]=Number(select.value);
        try{localStorage.setItem(key,JSON.stringify(own));}catch(_){}
        refresh();
      });
    }

    const gradebox=document.createElement('section');gradebox.id='ek-grade-finish';gradebox.className='ek-gradebox';
    const heading=document.createElement('h3');heading.textContent='Examen afronden';
    const count=document.createElement('p');count.setAttribute('aria-live','polite');
    const track=document.createElement('div');track.className='ek-grade-track';
    const bar=document.createElement('span');track.append(bar);
    const button=document.createElement('button');button.type='button';button.className='ek-grade-btn';
    const instruction=document.createElement('p');instruction.textContent='Kijk alle vragen na volgens het officiële correctiemodel. Daarna verschijnt je echte omzettingscijfer van dit examen.';
    gradebox.append(heading,count,track,button,instruction);
    if(special){const answerStack=document.getElementById('answer-stack');answerStack?.after(gradebox);}else panel.append(gradebox);

    const dialog=document.createElement('dialog');dialog.className='ek-results-dialog';
    dialog.innerHTML=`<div class="ek-results-body">
      <div class="ek-results-head"><div><h2>Jouw examenresultaat</h2><p class="ek-results-sub">Officiële normering · tijdvak 1</p></div><button type="button" class="ek-results-close" aria-label="Sluiten">×</button></div>
      <div class="ek-score-total"><strong>—</strong><span></span></div>
      <p class="ek-results-guidance"></p>
      <table class="ek-result-table"><thead><tr><th>Vraag</th><th>Behaalde punten</th></tr></thead><tbody></tbody></table>
      <a class="ek-results-source" target="_blank" rel="noopener">Bekijk de officiële omzettingstabel ↗</a>
      <button type="button" class="ek-grade-btn ek-result-back">Verder nakijken</button>
    </div>`;
    document.body.append(dialog);
    dialog.querySelector('.ek-results-source').href=spec.source;
    const close=()=>dialog.close();
    dialog.querySelector('.ek-results-close').addEventListener('click',close);
    dialog.querySelector('.ek-result-back').addEventListener('click',close);
    dialog.addEventListener('click',e=>{if(e.target===dialog)close();});

    function syncQuestion(){
      if(select){
        const q=currentQuestion(),max=spec.points[q-1];
        scoreLabel.textContent='Jouw punten voor vraag '+q+' (maximaal '+max+')';
        select.replaceChildren(new Option('Nog niet nagekeken',''));
        for(let p=0;p<=max;p++)select.add(new Option(p+' van '+max+' punten',String(p)));
        const score=scoreFor(q);select.value=score===null?'':String(score);
      }
      refresh();
    }

    function refresh(){
      let checked=0;
      for(let q=1;q<=total;q++)if(scoreFor(q)!==null)checked++;
      count.textContent=checked+' van '+total+' vragen nagekeken';
      bar.style.width=(100*checked/total)+'%';
      button.textContent=checked===total?'Bekijk jouw eindcijfer →':'Bekijk nakijkvoortgang →';
    }

    function showResult(){
      const scores=Array.from({length:total},(_,i)=>scoreFor(i+1));
      const checked=scores.filter(s=>s!==null).length;
      const sum=scores.reduce((s,v)=>s+(v??0),0);
      const complete=checked===total;
      const number=dialog.querySelector('.ek-score-total strong');
      const summary=dialog.querySelector('.ek-score-total span');
      const outer=dialog.querySelector('.ek-score-total');
      const guidance=dialog.querySelector('.ek-results-guidance');
      number.textContent=complete?fmt(spec.grades[sum]):'—';
      summary.textContent=sum+' van '+spec.max+' punten · N-term '+fmt(spec.n);
      outer.classList.toggle('ek-low',complete&&spec.grades[sum]<5.5);
      guidance.textContent=complete?
        'Dit cijfer komt uit de officiële omzettingstabel. Je hebt je antwoorden zelf nagekeken; de beoordeling hangt af van hoe zorgvuldig je de deelpunten hebt toegekend.':
        'Nog '+(total-checked)+' vragen nakijken. Vul ook bij onbeantwoorde vragen 0 punten in. Zodra alle scores bekend zijn, verschijnt het definitieve oefencijfer.';
      const tbody=dialog.querySelector('tbody');tbody.replaceChildren();
      for(let i=0;i<total;i++){
        const row=document.createElement('tr');if(scores[i]===null)row.className='ek-unchecked';
        const q=document.createElement('td');q.textContent='Vraag '+(i+1);
        const pts=document.createElement('td');pts.textContent=(scores[i]===null?'Nog niet nagekeken':scores[i])+' / '+spec.points[i];
        row.append(q,pts);tbody.append(row);
      }
      const back=dialog.querySelector('.ek-result-back');
      back.textContent=complete?'Terug naar examen':'Ga naar eerste niet-nagekeken vraag';
      back.onclick=()=>{
        close();
        if(!complete){const q=scores.findIndex(s=>s===null)+1;location.href='?vraag='+q;}
      };
      if(!dialog.open)dialog.showModal();
    }
    button.addEventListener('click',showResult);

    // Bestaande Havo B-scorevelden blijven leidend; geen dubbele invoer.
    document.addEventListener('change',e=>{
      if(nativeScores&&(e.target.id==='score'||(special&&e.target.matches('#answer-stack .answer-card select')))){
        queueMicrotask(refresh);
      }
    });
    const previous=history.replaceState;
    history.replaceState=function(){const value=previous.apply(this,arguments);queueMicrotask(syncQuestion);return value;};
    window.addEventListener('popstate',syncQuestion);
    syncQuestion();
  }
})();

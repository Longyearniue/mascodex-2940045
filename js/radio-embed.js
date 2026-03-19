(function(){
  var code = document.currentScript ? document.currentScript.getAttribute('data-code') : '';
  if(!code) return;
  fetch('/api/radio/JP'+code)
    .then(function(r){return r.ok?r.json():null})
    .then(function(d){
      var el=document.getElementById('r-now'),ar=document.getElementById('r-arc');
      if(!el) return;
      if(!d||!d.episodes||!d.episodes.length){
        el.innerHTML='<span style="opacity:.4;font-size:.84rem">まだラジオがありません</span>';return;
      }
      var e=d.episodes,l=e[0];
      el.innerHTML='<div style="background:rgba(255,255,255,.06);border-radius:10px;padding:14px">'
        +'<div style="font-size:.78rem;opacity:.45;margin-bottom:5px">'+l.date+'</div>'
        +(l.title?'<div style="font-size:.9rem;font-weight:600;margin-bottom:10px">'+l.title+'</div>':'')
        +'<audio controls style="width:100%;border-radius:7px" src="'+l.audio_url+'"></audio>'
        +'</div>';
      if(e.length>1){
        ar.innerHTML='<div style="font-size:.78rem;opacity:.4;margin:10px 0 6px">📚 バックナンバー</div>'
          +e.slice(1).map(function(ep){
            return'<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)">'
              +'<span style="font-size:.74rem;opacity:.38;min-width:76px">'+ep.date+'</span>'
              +'<audio controls style="flex:1;height:30px" src="'+ep.audio_url+'"></audio></div>';
          }).join('');
      }
    }).catch(function(){});
})();

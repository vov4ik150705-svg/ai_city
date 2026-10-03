/* A design-only state inspector. No wallet, account, network or API calls. */
(() => {
  const root = document.querySelector('.entry');
  const dialog = document.getElementById('preview-dialog');
  const primary = document.querySelector('.entry__connect');
  const demo = document.querySelector('.entry__demo');
  const status = document.querySelector('.entry__status');
  const loading = document.querySelector('.entry__loading');
  const labels = {idle:'CONNECT WALLET',connecting:'CHECK YOUR WALLET',signing:'SIGN IN YOUR WALLET',wrong_chain:'SWITCH NETWORK',rejected:'CONNECT WALLET',error:'TRY AGAIN',loading:'OPENING YOUR CITY',demo_loading:'OPENING THE DEMO'};
  const messages = {idle:'',connecting:'',signing:'',wrong_chain:'Switch to the configured Robinhood Chain network, then retry.',rejected:'Request cancelled. You can try again.',error:'Could not connect. Check your wallet and try again.',loading:'',demo_loading:''};
  function fit() {
    root.style.setProperty('--scene-scale',Math.min(window.innerWidth/1672,window.innerHeight/941).toString());
    root.style.setProperty('--panel-scale',Math.min((window.innerWidth-24)/600,1).toString());
  }
  function setState(state) {
    if (!(state in labels)) throw new Error('Unknown preview phase: '+state);
    root.dataset.phase = state;
    const busy = ['connecting','signing','loading','demo_loading'].includes(state);
    primary.disabled = busy;
    demo.disabled = busy;
    root.querySelector('.entry__panel').setAttribute('aria-busy',String(busy));
    primary.setAttribute('aria-label',labels[state]);
    root.querySelector('.entry__connect-text').textContent = labels[state];
    status.textContent = messages[state];
    loading.hidden = !['loading','demo_loading'].includes(state);
    loading.querySelector('h2').textContent = state==='demo_loading' ? 'OPENING THE DEMO' : 'OPENING YOUR CITY';
    root.querySelector('[data-step="connect"]').setAttribute('aria-current',state==='signing'?'false':'step');
    root.querySelector('[data-step="sign"]').setAttribute('aria-current',state==='signing'?'step':'false');
    window.dispatchEvent(new CustomEvent('entry-preview-state',{detail:{state,designOnly:true}}));
  }
  primary.addEventListener('click',()=>dialog.showModal());
  demo.addEventListener('click',()=>dialog.showModal());
  dialog.querySelector('.entry-preview-dialog__close').addEventListener('click',()=>dialog.close());
  dialog.querySelectorAll('[data-preview-state]').forEach(button=>button.addEventListener('click',()=>{setState(button.dataset.previewState);dialog.close();}));
  window.addEventListener('resize',fit);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.open)setState('idle');});
  const params = new URLSearchParams(location.search);
  if(params.get('text')==='native') root.classList.add('entry--native');
  setState(params.get('state')||'idle');
  fit();
  window.CorporatorEntryPreview = Object.freeze({setState,fit,designOnly:true});
})();

const fs=require('node:fs'),path=require('node:path');
const deps=process.env.CORPORATOR_NODE_DEPS||'C:/Users/sk640/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(deps,'playwright'));
const sharp=require(path.join(deps,'sharp'));
const localServer=require('./serve.cjs');
async function run(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const checks=[],errors=[];
 const page=await browser.newPage({viewport:{width:1672,height:941},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://127.0.0.1:5189/');await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:path.join(__dirname,'previews/desktop-1672x941.png')});
 const ref=await sharp(path.join(__dirname,'reference/approved-desktop.png')).removeAlpha().raw().toBuffer();
 const actual=await sharp(path.join(__dirname,'previews/desktop-1672x941.png')).removeAlpha().raw().toBuffer();
 let changed=0,sum=0;for(let i=0;i<ref.length;i+=3){const delta=Math.max(Math.abs(ref[i]-actual[i]),Math.abs(ref[i+1]-actual[i+1]),Math.abs(ref[i+2]-actual[i+2]));if(delta>8)changed++;sum+=Math.abs(ref[i]-actual[i])+Math.abs(ref[i+1]-actual[i+1])+Math.abs(ref[i+2]-actual[i+2]);}
 checks.push({name:'Reference desktop comparison',thresholdPerChannel:8,changedPixelsPercent:100*changed/(1672*941),meanAbsoluteChannelError:sum/ref.length,note:'Differences allowed only in restored areas formerly occupied by UI, exact frame clipping edges, browser compositing. See the real screenshot, not a guarantee of all-screen identity.'});
 const panels=await page.locator('.entry__panel').boundingBox();checks.push({name:'Panel native geometry',...panels});
 await page.getByRole('button',{name:'CONNECT WALLET',exact:true}).click();
 if(!await page.locator('#preview-dialog').evaluate(el=>el.open))throw Error('Preview dialog did not open');
 await page.getByRole('button',{name:'Signature request',exact:true}).click();
 if(await page.locator('.entry').getAttribute('data-phase')!=='signing')throw Error('Signature phase missing');
 if(!await page.locator('.entry__connect').isDisabled())throw Error('Signature double-click guard missing');
 checks.push({name:'Button preview state and busy guard',passed:true});
 for(const state of ['wrong_chain','rejected','error','loading','demo_loading']){
  await page.evaluate(s=>window.CorporatorEntryPreview.setState(s),state);
  if(['wrong_chain','rejected','error'].includes(state)&&await page.locator('.entry__status').textContent()==='')throw Error('Error copy missing '+state);
  if(['loading','demo_loading'].includes(state)&&!await page.locator('.entry__loading').isVisible())throw Error('Loader missing '+state);
 }
 checks.push({name:'Error and load states',passed:true});
 await page.goto('http://127.0.0.1:5189/?state=loading');await page.screenshot({path:path.join(__dirname,'previews/loading-1672x941.png')});
 await page.goto('http://127.0.0.1:5189/?text=native');await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(__dirname,'previews/native-text-1672x941.png')});
 for(const [w,h] of [[1440,900],[1920,1080],[2560,1080],[768,1024],[390,844],[360,800]]){
  await page.setViewportSize({width:w,height:h});await page.goto('http://127.0.0.1:5189/');await page.evaluate(()=>document.fonts.ready);
  const geom=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,panel:document.querySelector('.entry__panel').getBoundingClientRect().toJSON(),cta:document.querySelector('.entry__connect').getBoundingClientRect().toJSON(),demo:document.querySelector('.entry__demo').getBoundingClientRect().toJSON()}));
  if(geom.scroll>w)throw Error(`Horizontal overflow at ${w}`);
  if(geom.cta.x<0||geom.cta.right>w||geom.demo.right>w)throw Error(`Clipped controls at ${w}`);
  if(geom.cta.height<44||geom.demo.height<44)throw Error(`Touch targets under 44px at ${w}`);
  checks.push({name:`Layout ${w}x${h}`,passed:true,ctaHeight:geom.cta.height,demoHeight:geom.demo.height,horizontalOverflow:false});
  await page.screenshot({path:path.join(__dirname,`previews/entry-${w}x${h}.png`),fullPage:true});
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:5189/?state=loading');
 const animation=await page.locator('.entry__progress').evaluate(el=>getComputedStyle(el,'::after').animationName);
 if(animation!=='none')throw Error('Reduced motion not honored');checks.push({name:'Reduced motion',passed:true});
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();
 localServer.close();
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({date:'2026-10-03',checks,browserErrors:errors,realWalletAndAPIIntegration:'not performed; kit is design-only'},null,2));
 console.log(JSON.stringify(checks,null,2));
}
run().catch(e=>{console.error(e);localServer.close();process.exit(1);});

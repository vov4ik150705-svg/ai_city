import { readFileSync, writeFileSync } from "node:fs"
import { afterAll, describe, expect, it } from "vitest"
import { loadPack as readPackBytes, fromUtf8, parseJson } from "../../../packages/contentpack/src/index.ts"
import { loadConfig, newState, plantPrebuilt, mintFromBacking, cityClock, awardPaidTick, population, housingCapacityOf, cityLevelFromPopulation, stickyCityLevel, applyCityScope } from "../../../packages/engine/src/index.ts"
import { collectRequests } from "../../../packages/engine/src/economy.ts"
import { asBig, asDict } from "../../../packages/engine/src/values.ts"
import { makeCtx } from "../../../services/api/src/pack_ctx.ts"
import { applyLive } from "../../../services/api/src/commit.ts"
import { stakeMin } from "../../../services/api/src/commit_districts.ts"
import type { Dict } from "../../../packages/engine/src/values.ts"

const loaded=readPackBytes(new Uint8Array(readFileSync("content/out/pack.json")))
const UNIT=1_000_000, WEI=10n**18n
const path="docs/reports/economy-redesign-2026-10-03/PAID_ROUTE_CHECK_RESULTS.json"
const results:any={status:"Local commands and engine production, with candidate allocation/maturity in an explicit research overlay. No live swap, RPC transaction, full-cohort market or deployed candidate was tested.",sourcePackVersion:loaded.pack.pack_version}
afterAll(()=>writeFileSync(path,JSON.stringify(results,(_k,v)=>typeof v==="bigint"?v.toString():v,2)))

function ctxOf(candidate=true,stock20=true){
 const p:any=structuredClone(loaded.pack)
 if(candidate){
  const costs=p.generated.balance.level_cost
  for(const [bid,arr] of Object.entries(costs) as [string,bigint[]][]){
   let num=80n,den=150n
   if(bid==="bank")den*=50n
   else if(bid==="exchange")den*=12n
   else if(p.sections.buildings.buildings[bid].district){num*=6n;den*=25n}
   costs[bid]=arr.map(v=>v*num/den)
  }
  for(const row of Object.values(p.generated.balance.hire_cost) as any[])row.cost=row.cost*80n/150n
  p.sections.buildings.buildings.exchange.city_level_req=1n
  p.sections.launch.params.bank_daily_limit_pool_share_bps.v=1500n
  if(stock20)for(const row of Object.values(p.sections.districts.stake.s_min) as any[])row.v=row.v/5n
  p.sections.balance.params.reference_deposit_usd_8dec.v=80n*10n**8n
 }
 return makeCtx({...loaded,pack:p})
}
function buyFixture(ctx:any,usd:number,id="route",priceMultiple=1){
 const cfg=ctx.cfg,city:Dict={id,weight:1n,account_kind:"wallet",wallet:"0x"+"12".repeat(20),capital:0n,earned_left:0n,earned_life:0n,earned_spent:0n,deposit_spent:0n,city_level:1n,agents:[],functions:[],districts:[],stake_settled:{},tokens_held:{},district_freeze_until:{},research_unlocked:[],energy_stock:0n,compute_stock:0n,bank_level:0n}
 plantPrebuilt(cfg,city)
 const state=newState(cfg,{[id]:city},{})
 if(priceMultiple!==1)state.pool_corp=asBig(state.pool_corp)*1000000n/BigInt(Math.round(priceMultiple*1000000))
 // Same historical CPMM seed fixture used in the earnings discussion; no external trade.
 const ethUsd=Number(cfg.eth_usd_8dec)/1e8
 const grossWei=BigInt(Math.floor(usd/ethUsd*1e18))
 const effective=grossWei*9700n/10000n
 const corp=asBig(state.pool_corp)*effective/(asBig(state.pool_eth)+effective)
 const capital=mintFromBacking(cfg,state,corp,0n,1n,id)
 city.capital=capital
 state.pool_eth=asBig(state.pool_eth)+effective
 state.pool_corp=asBig(state.pool_corp)-corp
 state.tick_index=0n;state.city_time=asBig(cfg.anchor_hour)
 return {ctx,cfg,city,state,id,capital}
}
async function cmd(r:any,effect:string,body:any){
 const before=asBig(r.city.capital)
 const out=await applyLive(r.ctx,r.state,effect,body,r.id)
 const reply=out?parseJson(fromUtf8(out.body)):{}
 return {effect,body,status:Number(out?.status??0),reply,spent:Number(before-asBig(r.city.capital))}
}
function refresh(r:any){
 const c=r.city,cfg=r.cfg
 c.housing_capacity=housingCapacityOf(c.functions,cfg.population_thresholds,asBig(c.housing_capacity_add))
 c.population=population(asBig(c.occupied_jobs),asBig(cfg.population_per_job),asBig(c.housing_capacity))
 c.city_level=stickyCityLevel(asBig(c.city_level),cityLevelFromPopulation(asBig(c.population),cfg.population_thresholds,asBig(cfg.city_level_max)))
 applyCityScope(cfg,c,asBig(r.state.city_time))
}
async function starter(r:any,includeBank=true){
 const log:any[]=[]
 for(const bid of ["agent_hub","power_node","workshop",...(includeBank?["bank"]:[])])log.push(await cmd(r,"build",{building_id:bid}))
 for(let n=0;n<2;n++)log.push(await cmd(r,"hire",{role:"engineer"}))
 return log
}
function ready(r:any,bid:string){
 const fn=(r.city.functions as Dict[]).find(x=>x.id===bid)
 return fn!==undefined&&asBig(fn.construction)===0n
}
async function assignIfReady(r:any,agentId:string,bid:string,log?:any[]){
 const a=(r.city.agents as Dict[]).find(x=>x.id===agentId)
 if(a&&ready(r,bid)&&a.building_id!==bid){
  const row=await cmd(r,"assign",{agent_id:agentId,building_id:bid});log?.push(row)
 }
}
function clock(r:any,t:number){
 r.state.tick_index=BigInt(t);r.state.city_time=asBig(r.cfg.anchor_hour)+BigInt(t)
 const cl=cityClock(r.cfg,BigInt(t));r.state.hour=cl[1];r.state.day=cl[0];return cl
}
async function production(r:any,t:number,log?:any[],beacon=false){
 const cl=clock(r,t)
 await assignIfReady(r,"h1","power_node",log)
 await assignIfReady(r,"h2","workshop",log)
 if(beacon)await assignIfReady(r,"h3","flagship_store",log)
 const rows=collectRequests(r.cfg,r.state,cl[1],cl[2])
 refresh(r)
 awardPaidTick(r.city,r.cfg.xp_to_next,asBig(r.cfg.agent_level_max),asBig(r.cfg.agent_level_gain_bps),asBig(r.cfg.bps))
 return {rows,raw:rows.reduce((s:any,x:any)=>s+asBig(x.request),0n),clock:cl}
}
type Lot={grant:number,amount:number,spent:number,withdrawn:number,parts:{ready:number,left:number}[]}
function lot(amount:number,t:number):Lot{
 const p1=Math.floor(amount*.7),p2=Math.floor(amount*.15)
 return {grant:t,amount,spent:0,withdrawn:0,parts:[{ready:t,left:p1},{ready:t+24,left:p2},{ready:t+48,left:amount-p1-p2}]}
}
function spendEarned(lots:Lot[],amount:number){
 const rows=lots.flatMap(l=>l.parts.map(p=>({l,p}))).sort((a,b)=>b.p.ready-a.p.ready)
 let left=amount
 for(const {l,p} of rows){const take=Math.min(left,p.left);p.left-=take;l.spent+=take;left-=take}
 expect(left).toBe(0)
}
function spendMatured(lots:Lot[],amount:number,t:number){
 let left=amount
 for(const l of lots)for(const p of l.parts)if(p.ready<=t){const take=Math.min(left,p.left);p.left-=take;l.withdrawn+=take;left-=take}
 expect(left).toBe(0)
}
async function paidCmd(r:any,lots:Lot[],principal:{left:number},log:any[],effect:string,body:any,t:number){
 const before=asBig(r.city.capital),oldDep=asBig(r.city.deposit_spent),oldEarn=asBig(r.city.earned_spent)
 const row=await cmd(r,effect,body)
 if(row.status===200){
  const amount=Number(before-asBig(r.city.capital)),fromPrincipal=Math.min(amount,principal.left)
  principal.left-=fromPrincipal;const fromEarned=amount-fromPrincipal
  if(fromEarned>0)spendEarned(lots,fromEarned)
  r.city.deposit_spent=oldDep+BigInt(fromPrincipal);r.city.earned_spent=oldEarn+BigInt(fromEarned)
  r.city.earned_left=BigInt(lots.reduce((s,l)=>s+l.parts.reduce((a,p)=>a+p.left,0),0))
 }
 log.push({...row,t});return row
}
async function simulate(kind:string,baseline:number,options:any={}){
 const r=buyFixture(ctxOf(),options.gameUSD??80),lots:Lot[]=[],principal={left:Number(r.capital)}
 const log:any[]=[],start=await starter(r)
 for(const x of start){log.push({...x,t:0});principal.left-=x.spent;expect(x.status).toBe(200)}
 const sources=[300000,30000,30000,30000,30000,30000,30000].map(v=>v*.02*.6)
 const usedSource=Array(7).fill(0),sourcesReleased=[.6,...Array(6).fill(.4/6)]
 const series:any[]=[],snapshots:any[]=[],cashRef={value:0},events:any[]=[]
 let upgraded2=false,upgraded3=false,firstSalary:null|number=null,firstCash:null|number=null,extraCashUSD=0
 if(kind==="farm"){
  extraCashUSD=options.externalStockUSD??20
  const s=stakeMin(r.ctx,"AAPL")
  // Simulated already-paid wallet purchase, accounted as external capital above; not a free reward.
  r.city.tokens_held={AAPL:s}
  const actions:any[]=[["stake",{ticker:"AAPL",source:"ledger",amount:s}],...(options.omitExchange?[]:[["build",{building_id:"exchange"}]]),["build",{building_id:"flagship_store"}],["hire",{role:"trader"}]]
  for(const [eff,body] of actions)
   expect((await paidCmd(r,lots,principal,log,eff,body,0)).status).toBe(200)
 }
 for(let t=0;t<168;t++){
  clock(r,t)
  if(kind==="upgrade"||kind==="upgrade3"||kind==="upgrade_both"){
   const bid="workshop",fn=(r.city.functions as Dict[]).find(x=>x.id===bid)
   const level=Number(fn?.level??0)
   const cost=Number((r.ctx.pack as any).generated.balance.level_cost.workshop[level])
   if(ready(r,bid)&&level< (kind==="upgrade3"?3:2)&&Number(r.city.capital)>=cost){
    const paid=await paidCmd(r,lots,principal,log,"upgrade",{building_id:bid},t)
    if(paid.status===200){events.push({t,realHours:t*25/24,event:"Workshop L"+(level+1),costCapital:paid.spent/1000});upgraded2=true;if(level===2)upgraded3=true}
   }
   if(kind==="upgrade_both"&&upgraded2){
    const pf=(r.city.functions as Dict[]).find(x=>x.id==="power_node")
    const pcost=Number((r.ctx.pack as any).generated.balance.level_cost.power_node[1])
    if(Number(pf?.level)===1&&ready(r,"power_node")&&Number(r.city.capital)>=pcost){
     const paid=await paidCmd(r,lots,principal,log,"upgrade",{building_id:"power_node"},t)
     if(paid.status===200)events.push({t,realHours:t*25/24,event:"Power Node L2",costCapital:paid.spent/1000})
    }
   }
  }
  const bankReadyAtStart=ready(r,"bank")
  const prod=await production(r,t,log,kind==="farm")
  const work=Math.min(3,Number(prod.raw)/baseline)
  const total=(options.cohortWork??45.5)-1+work,den=Math.max(50,total),d=Math.floor(t/24)
  let award=0,grossCost=0,dayAlready=series.filter(x=>Math.floor(x.t/24)===d).reduce((s,x)=>s+x.award,0)
  const availableHour=t >= (options.receiptDelayHours??0)
  for(let src=0;src<=d;src++){
   const b=sources[src]*sourcesReleased[d-src]/24
   let gross=availableHour?b*work/den:0
   gross=Math.min(gross,Math.max(0,sources[src]*.06-usedSource[src]))
   let cap=Math.floor(gross*.75*UNIT)
   cap=Math.min(cap,Math.max(0,180000000-dayAlready-award))
   // Authored launch request ceiling is enforced after real work has been collected.
   const requestRoom=Math.max(0,Number(prod.raw)*32-award)
   cap=Math.min(cap,Math.floor(requestRoom))
   gross=cap/(.75*UNIT);usedSource[src]+=gross;award+=cap;grossCost+=gross
  }
  if(award>0){
   const corp=(BigInt(award)*WEI+asBig(r.state.mint_rate)-1n)/asBig(r.state.mint_rate)
   const minted=mintFromBacking(r.cfg,r.state,corp,0n,0n,"fund")
   expect(minted).toBeGreaterThanOrEqual(BigInt(award))
   r.state.fund=asBig(r.state.fund)-BigInt(award)
   r.city.capital=asBig(r.city.capital)+BigInt(award)
   r.city.earned_life=asBig(r.city.earned_life)+BigInt(award)
   lots.push(lot(award,t));if(firstSalary===null)firstSalary=t
  }
  let cash=0,withdrawCode=""
  const matured=lots.reduce((s,l)=>s+l.parts.filter(p=>p.ready<=t).reduce((a,p)=>a+p.left,0),0)
  const powerLevel=Number((r.city.functions as Dict[]).find(x=>x.id==="power_node")?.level)
  const saveForUpgrade=(kind==="upgrade"&&!upgraded2)||(kind==="upgrade3"&&!upgraded3)||(kind==="upgrade_both"&&powerLevel<2)
  // Model a policy that saves for a stated upgrade, then queues mature salary only. Principal is not income.
  if(!saveForUpgrade&&matured>0&&bankReadyAtStart){
   const heldBefore=asBig(r.city.capital)
   const out=await cmd(r,"withdraw",{amount:BigInt(matured),intent_id:"route-"+kind+"-"+t})
   if(out.status===200){
    const spent=Number(heldBefore-asBig(r.city.capital));spendMatured(lots,spent,t)
    cash=spent/UNIT*.97/1.1;cashRef.value+=cash
    if(firstCash===null)firstCash=t
   }else withdrawCode=(out.reply as any)?.code??JSON.stringify(out.reply,(_k,v)=>typeof v==="bigint"?v.toString():v)
  }
  r.city.earned_left=BigInt(lots.reduce((s,l)=>s+l.parts.reduce((a,p)=>a+p.left,0),0))
  const fn=(r.city.functions as Dict[]).find(x=>x.id==="workshop")
  const workshopRow=(r.city._slot_rows as Dict[]).find(x=>x.building_id==="workshop")
  series.push({t,hour:Number(prod.clock[1]),weekday:Number(prod.clock[2]),work,rawWork:Number(prod.raw),award,capital:Number(r.city.capital),energyStock:Number(r.city.energy_stock),workshopLevel:Number(fn?.level??0),workshopIdle:workshopRow?.idle??"",cashReferenceUSD:cash,withdrawCode,grossSalaryCost:grossCost})
  for(const l of lots)expect(l.amount).toBe(l.spent+l.withdrawn+l.parts.reduce((s,p)=>s+p.left,0))
  expect(Number(r.city.capital)).toBe(principal.left+lots.reduce((s,l)=>s+l.parts.reduce((a,p)=>a+p.left,0),0))
  if([23,71,167].includes(t)){
   const earned=lots.reduce((s,l)=>s+l.amount,0),spent=lots.reduce((s,l)=>s+l.spent,0),maturedLeft=lots.reduce((s,l)=>s+l.parts.filter(p=>p.ready<=t).reduce((a,p)=>a+p.left,0),0)
   snapshots.push({periods:(t+1)/24,earnedCapital:earned/1000,earnedReferenceUSD:earned/UNIT*.97/1.1,earnedSpentCapital:spent/1000,cashReferenceUSD:cashRef.value,maturedLeftReferenceUSD:maturedLeft/UNIT*.97/1.1,pendingEarnedCapital:Number(r.city.earned_left)/1000,principalLeftCapital:principal.left/1000,meanWork:series.reduce((s,x)=>s+x.work,0)/(t+1),workshopLevel:Number(fn?.level??0)})
  }
 }
 for(let src=0;src<7;src++)expect(usedSource[src]).toBeLessThanOrEqual(sources[src]*.06+1e-6)
 return {kind,cohortWork:options.cohortWork??45.5,receiptDelayHours:options.receiptDelayHours??0,omitExchange:options.omitExchange??false,gameUSD:options.gameUSD??80,externalStockUSD:extraCashUSD,totalExternalUSD:(options.gameUSD??80)+extraCashUSD,initialCapitalDisplay:Number(r.capital)/1000,firstSalaryRealHours:firstSalary===null?null:firstSalary*25/24,firstBankCORPRealHours:firstCash===null?null:firstCash*25/24,events,usedSourceSalaryCost:usedSource,snapshots,log,series}
}

describe("Paid progression characterization with candidate economy overlay",()=>{
 it("reads exact current frozen stakes and the candidate costs",()=>{
  const current:any=loaded.pack,ctx=ctxOf(),table:any=[]
  for(const [ticker,row]of Object.entries(current.sections.districts.stake.s_min) as any[]){
   const answer=current.sections.districts.stake.snapshot.feeds[ticker].answer
   table.push({ticker,currentAtoms:row.v,currentTokens:Number(row.v)/1e18,snapshotUSD:Number(row.v)*Number(answer)/1e26,candidate20Atoms:row.v/5n,candidate20Tokens:Number(row.v/5n)/1e18})
  }
  results.stakes={targetSnapshotUSD:100,candidateTargetUSD:20,frozenAt:current.sections.districts.stake.snapshot.at,tiersMultiples:[1,2,3],cooldownCityDays:current.sections.economy.params.unstake_cooldown_city_days.v,cooldownRealHours:Number(current.sections.economy.params.unstake_cooldown_city_days.v)*25,table}
  results.candidatePrices={levelCost:(ctx.pack as any).generated.balance.level_cost,hireCost:(ctx.pack as any).generated.balance.hire_cost}
  expect(table.every((x:any)=>Math.abs(x.snapshotUSD-100)<1e-8)).toBe(true)
 })
 it("shows the current $80 pack cannot buy the same full starter",async()=>{
  const r=buyFixture(ctxOf(false),80),log=await starter(r)
  results.current80={initialCapitalDisplay:Number(r.capital)/1000,commands:log,remainingDisplay:Number(r.city.capital)/1000}
  expect(log.some(x=>x.status!==200)).toBe(true)
 })
 it("calibrates an ordinary paid city without donated resources",async()=>{
  const r=buyFixture(ctxOf(),80),start=await starter(r)
  expect(start.every(x=>x.status===200)).toBe(true)
  const samples:any[]=[]
  for(let t=0;t<26;t++){const p=await production(r,t);if(t>=2)samples.push(Number(p.raw))}
  const mean=samples.reduce((a,b)=>a+b,0)/samples.length
  results.baseline={rawOutputMeanPerHour:mean,paidStarterDisplay:start.reduce((s,x)=>s+x.spent,0)/1000,initialCapitalDisplay:Number(r.capital)/1000,resourcesDonated:false,agentRoles:(r.city.agents as Dict[]).map(x=>x.role)}
  expect(mean).toBeGreaterThan(0)
 })
 it("runs paid routes for first period, 3 periods and 7 periods",async()=>{
  const baseline=results.baseline.rawOutputMeanPerHour
  results.routes=[]
  for(const kind of ["active","upgrade","upgrade_both","upgrade3","farm"])results.routes.push(await simulate(kind,baseline))
  results.routes.push(await simulate("farm",baseline,{gameUSD:60,externalStockUSD:20}))
  results.routes.push(await simulate("farm",baseline,{gameUSD:60,externalStockUSD:20,omitExchange:true}))
  results.routes.push(await simulate("active",baseline,{cohortWork:91}))
  results.routes.push(await simulate("upgrade",baseline,{cohortWork:91}))
  results.routes.push(await simulate("active",baseline,{receiptDelayHours:12}))
  const upgraded=results.routes.find((x:any)=>x.kind==="upgrade"&&x.gameUSD===80)
  expect(upgraded.events.length).toBeGreaterThan(0)
  expect(upgraded.series.some((x:any)=>x.workshopLevel===2&&x.award>0)).toBe(true)
  results.powerL1WithWorkshopL2={noPowerUpgradeRequested:upgraded.log.every((x:any)=>!(x.effect==="upgrade"&&x.body.building_id==="power_node")),energyIdleAfterWorkshop2:upgraded.series.filter((x:any)=>x.workshopLevel===2&&x.workshopIdle==="IDLE_NO_ENERGY").length}
 })
 it("checks paid Farm entry sensitivity to CORP price without free Capital",async()=>{
  results.farmEntrySensitivity=[]
  for(const priceMultiple of [1,1.01,1.05,1.2,2])for(const omitExchange of [false,true]){
   const r=buyFixture(ctxOf(),60,"route",priceMultiple),log=await starter(r)
   const s=stakeMin(r.ctx,"AAPL");r.city.tokens_held={AAPL:s}
   for(const [e,b]of [["stake",{ticker:"AAPL",source:"ledger",amount:s}],...(omitExchange?[]:[["build",{building_id:"exchange"}]]),["build",{building_id:"flagship_store"}],["hire",{role:"trader"}]] as any[])log.push(await cmd(r,e,b))
   results.farmEntrySensitivity.push({priceMultiple,omitExchange,capitalDisplay:Number(r.capital)/1000,allCommandsPaid:log.every(x=>x.status===200),failures:log.filter(x=>x.status!==200)})
  }
  expect(results.farmEntrySensitivity.some((x:any)=>x.priceMultiple===1&&x.allCommandsPaid)).toBe(true)
  expect(results.farmEntrySensitivity.some((x:any)=>x.priceMultiple===1.2&&!x.allCommandsPaid)).toBe(true)
 })
 it("keeps spending/maturity rights conserved when offline",()=>{
  const l=lot(100000,0);spendEarned([l],40000)
  expect(l.parts.reduce((s,p)=>s+p.left,0)).toBe(60000)
  expect(l.parts.filter(p=>p.ready<=0).reduce((s,p)=>s+p.left,0)).toBe(60000)
  const u=lot(100000,0)
  expect(u.parts.filter(p=>p.ready<=48).reduce((s,p)=>s+p.left,0)).toBe(100000)
  results.maturityConservation={spent40From100Remaining60:true,offlineUnlockNeedsNewDeposit:false}
 })
 it("reproduces the current slot path ignoring the offline allowance",async()=>{
  const r=buyFixture(ctxOf(),80);await starter(r)
  for(let t=0;t<6;t++)await production(r,t)
  r.city.last_login=0n;r.city.login_period=24n
  const p=await production(r,120)
  results.offlineSlotCharacterization={hoursSinceLogin:120,configuredOfflineCap:r.cfg.offline_cap,rawRequestAfter120Hours:p.raw,note:"Current production path still works beyond the offline cap. This passing characterization does not mean that active-vs-sleeping incentives are correct."}
  expect(p.raw).toBeGreaterThan(0n)
 })
 it("bounds simultaneous salary and principal requests against the shared Bank",()=>{
  const depthUSD=4.2*2500.87,cap=depthUSD*.15,net=.97/1.1
  const salaryMatureUSD=2160*.75*.7*net*45.5/50
  const principalMatureUSD=35056.506/1000*net*50
  const scale=Math.min(1,cap/(salaryMatureUSD+principalMatureUSD))
  results.simultaneousBankStress={historicalDepthUSD:depthUSD,globalCandidateQuotaUSD:cap,matureSalaryReferenceUSD:salaryMatureUSD,remainingPrincipalReferenceUSD:principalMatureUSD,proportionalQueueScale:scale,salaryReleaseReferenceUSD:salaryMatureUSD*scale,ordinary20ReferenceAfterQueueUSD:20*scale,strong40ReferenceAfterQueueUSD:40*scale,note:"Arithmetic of the proposed proportional queue, not current first-come API. Fully ready profile claims; no quote movement or sell impact."}
  expect(scale).toBeLessThan(1)
  expect((salaryMatureUSD+principalMatureUSD)*scale).toBeLessThanOrEqual(cap+1e-6)
 })
})

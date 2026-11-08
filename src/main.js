import {demoDay,data,state,modes,layers,uid,allEvents,eventsOn,confirmedOn,plans,plansOn,planBlocks,scenarioReport,removeEvent,resetData,persist} from './store.js';
import {parse,keyOf,plusDays,dateLabel,cap,shortDate,minutes,overlaps,clockTime} from './dates.js';
import {escape,icon,action,iconButton,textLink} from './ui.js';
import {moveLiquid,stopLiquid} from './liquid.js';
import {schedule,parallel,layerPage,settings,miniCalendar,settingsRows,timeBalance} from './views.js';
const app = document.querySelector('#app'), nav = document.querySelector('#nav');
const dialog = document.querySelector('#dialog'), toast = document.querySelector('#toast');
const mini = document.querySelector('#mini-calendar'), shell = document.querySelector('.shell');
const labels = {home:'Головна',calendar:'Календар',parallel:'Parallel Days',layers:'Шари',settings:'Налаштування'};
let toastTimer;
let weather={icon:'cloud',label:'Погода',temperature:null,loading:false,location:''};
let weatherLocation, weatherRequest=0, cityResults=[];
function weatherButton(){
 const time=clockTime(new Date());
 const temperature=weather.temperature===null?'':(weather.temperature>0?'+':'')+weather.temperature+'°';
 return action(icon(weather.icon)+'<span class="weather-copy"><span>'+(temperature?'<strong>'+temperature+'</strong> ':'')+
 escape(weather.label)+'</span><small>'+(weather.location?escape(weather.location)+' · ':'')+
 '<time class="local-clock" datetime="'+time+'">'+time+'</time></small></span>',
 'weather',undefined,'class="weather-button" aria-label="'+escape(['Погода',temperature,weather.label,weather.location].filter(Boolean).join(' · '))+'"');
}
async function weatherJSON(url,query){
 const response=await fetch(url+'?'+new URLSearchParams(query),{signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('Weather request failed');
 return response.json();
}
async function loadWeather(location,background=false){
 if(background&&weather.loading)return;
 const request=++weatherRequest;
 if(background)weather.loading=true;
 else {
  weatherLocation=null;
  weather={icon:'cloud',label:'Завантаження…',temperature:null,loading:true,location:location?.name??''};
  refreshWeather();
 }
 try {
  if(!location){
   if(!navigator.geolocation)throw {code:1};
   const {coords}=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:8000}));
   if(request!==weatherRequest)return;
   location={latitude:coords.latitude,name:'За місцезнаходженням',longitude:coords.longitude};
  }
  const {current}=await weatherJSON('https://api.open-meteo.com/v1/forecast',{
   latitude:location.latitude.toFixed(2),longitude:location.longitude.toFixed(2),current:'temperature_2m,weather_code'
  });
  if(request!==weatherRequest)return;
  if(!Number.isFinite(current?.temperature_2m)||!Number.isFinite(current?.weather_code))throw new Error('Invalid weather response');
  const code=current.weather_code;
  weather={icon:code===0?'sun':code<51?'cloud':'rain',
   label:code===0?'Ясно':code<3?'Легка хмарність':code===3?'Хмарно':code<51?'Туман':code>=95?'Гроза':
   (code>=71&&code<=77)||(code>=85&&code<=86)?'Сніг':'Дощ',
   temperature:Math.round(current.temperature_2m),loading:false,location:location.name};
  weatherLocation=location;
 } catch(error) {
  if(request!==weatherRequest)return;
  weather={icon:'cloud',label:error.code===1?'Геолокація недоступна':error.code===2||error.code===3?'Не вдалося визначити місце':'Погода недоступна',
   temperature:null,loading:false,location:location?.name??''};
 }
 refreshWeather();
}
async function findWeatherCity(form,name){
 const results=form.querySelector('.city-results');
 if(name.length<2){results.textContent='Введи щонайменше дві літери.';return;}
 const submit=form.querySelector('button[type="submit"]');
 if(submit.disabled)return;
 submit.disabled=true;
 cityResults=[];
 results.textContent='Шукаємо місто…';
 try {
  const response=await weatherJSON('https://geocoding-api.open-meteo.com/v1/search',{name,count:6,language:'uk'});
  if(!form.isConnected||!dialog.open)return;
  cityResults=(response.results??[]).filter(city=>Number.isFinite(city.latitude)&&Number.isFinite(city.longitude));
  results.innerHTML=cityResults.map((city,i)=>action('<span><strong>'+escape(city.name)+'</strong><small>'+
   escape([city.admin1,city.country].filter(Boolean).join(', '))+'</small></span>'+icon('right'),
   'weather-city-select',i,'class="row"')).join('')||'Міста не знайдено.';
 } catch {
  results.textContent='Пошук міст недоступний. Спробуй ще раз.';
 } finally {submit.disabled=false;}
}
function refreshWeather(){
 const button=app.querySelector('.weather-button');
 if(!button)return;
 const focused=button===document.activeElement;
 button.outerHTML=weatherButton();
 if(focused)app.querySelector('.weather-button')?.focus({preventScroll:true});
}
function placeIndicator(group,selector,previous,animate,reuse){
 const selected=group?.querySelector(selector);
 if(!selected?.getBoundingClientRect)return;
 const bounds=selected.getBoundingClientRect();
 if(!bounds.width)return;
 const indicator=reuse??group.querySelector('.active-indicator')??document.createElement('span');
 indicator.className='active-indicator';
 indicator.setAttribute('aria-hidden','true');
 group.prepend(indicator);
 stopLiquid(indicator);
 indicator.style.cssText='left:'+selected.offsetLeft+'px;top:'+selected.offsetTop+'px;width:'+bounds.width+'px;height:'+bounds.height+'px';
 if(animate&&previous?.width&&!data.reduceMotion&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  const resting=indicator.getBoundingClientRect();
  const x=previous.left+previous.width/2-resting.left-resting.width/2;
  const y=previous.top+previous.height/2-resting.top-resting.height/2;
  if(Math.abs(x)+Math.abs(y)+Math.abs(previous.width-resting.width)<1)return;
  moveLiquid(group,indicator,previous,resting);
 }
}
function animateProgress(previous){
 const ring=app.querySelector('.day-overview');
 if(!ring||!previous||previous.date!==state.date||data.reduceMotion||
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const target=ring.style.getPropertyValue('--percent');
 if(previous.value!==target)ring.animate([{'--percent':previous.value},{'--percent':target}],
  {duration:340,easing:'ease-out'});
}
function notify(message){toast.textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.textContent='',4000);}
function save(message){
 try {persist();notify(message);}
 catch {notify(message+' · Збережено до закриття сторінки');}
}
function render(animate=false){
 const ring=app.querySelector('.day-overview');
 const previousProgress=ring&&{date:ring.dataset.date,value:getComputedStyle(ring).getPropertyValue('--percent').trim()};
 const periodIndicator=app.querySelector('.period-tabs .active-indicator');
 const oldPeriod=periodIndicator?.getBoundingClientRect();
 const oldNav=nav.querySelector('.active-indicator')?.getBoundingClientRect();
 const active=document.activeElement;
 const demoOpen=Boolean(app.querySelector('.live-demo[open]'));
 const weekOffset=app.querySelector('.week-scroll')?.scrollLeft;
 const dayOffset=app.querySelector('.day-scroll')?.scrollTop;
 const restore=active?.dataset?.act&&active.closest('#app')?[active.dataset.act,active.dataset.value]:null;
 const content=state.screen==='parallel'?parallel():state.screen==='layers'?layerPage():state.screen==='settings'?settings():schedule(weatherButton());
 app.innerHTML='<div>'+content+'</div>';
 shell?.classList.toggle('reduce-motion',data.reduceMotion);
 if(mini){
  const control=active?.closest('#mini-calendar')?active.dataset.act:null;
  const previousMonth=mini.querySelector('.mini-head')?.dataset.month;
  mini.innerHTML=miniCalendar();
  revealMiniMonth(previousMonth);
  if(control==='mini-shift'||control==='mini-date')mini.querySelector('[data-act="'+control+'"][data-value="'+active.dataset.value+'"]')?.focus({preventScroll:true});
 }
 const day=app.querySelector('.day-scroll');
 if(day)day.scrollTop=dayOffset??0;
 const week=app.querySelector('.week-scroll');
 if(week){
  const selected=week.querySelector('.week-column.selected');
  const gutter=week.querySelector('.week-hours')?.offsetWidth??0;
  week.scrollLeft=weekOffset??Math.max(0,(selected?.offsetLeft??0)-gutter);
 }
 if(demoOpen&&app.querySelector('.live-demo'))app.querySelector('.live-demo').open=true;
 if(animate)app.querySelector('.workspace')?.classList.add('view');
 if(!nav.innerHTML)nav.innerHTML=Object.entries(labels).map(([key,label])=>action(icon(key)+'<span>'+label+'</span>','nav',key)).join('');
 for(const item of nav.querySelectorAll('[data-act="nav"]')){
  if(item.dataset.value===state.screen)item.setAttribute('aria-current','page');
  else item.removeAttribute('aria-current');
 }
 positionIndicators(oldPeriod,oldNav,animate,periodIndicator);
 animateProgress(previousProgress);
 if(restore){
  const [act,value]=restore;
  [...app.querySelectorAll('[data-act]')].find(el=>el.dataset.act===act&&el.dataset.value===value)?.focus({preventScroll:true});
 }
}
function revealMiniMonth(previousMonth){
 if(previousMonth&&previousMonth!==mini.querySelector('.mini-head')?.dataset.month){
  mini.querySelector('.dates')?.classList.add('month-reveal');
 }
}
function positionIndicators(oldPeriod,oldNav,animate=false,periodIndicator){
 if(!globalThis.matchMedia?.('(min-width: 1200px)').matches)return;
 placeIndicator(app.querySelector('.period-tabs .seg'),'[aria-pressed="true"]',oldPeriod,animate,periodIndicator);
 placeIndicator(nav,'[aria-current="page"]',oldNav,animate);
}
globalThis.addEventListener?.('resize',()=>positionIndicators());
let opener, pendingPlan, pendingRemoval;
function modal(title,body,variant='',glyph){
 if(!dialog.open)opener=document.activeElement;
 pendingPlan=null;
 pendingRemoval=null;
 dialog.className='overlay '+variant;
 dialog.innerHTML='<div class="section-head dialog-heading">'+(glyph?'<span class="detail-glyph">'+icon(glyph)+'</span>':'')+
 '<h2 id="dialog-title">'+title+'</h2>'+iconButton('close','close','Закрити')+'</div>'+body;
 if(!dialog.open)dialog.showModal();
 (dialog.querySelector('input:not(.subtask input, .subtask-form input)')||dialog.querySelector('[data-act="close"]'))?.focus();
}
dialog.addEventListener('close',()=>{
 if(dialog.open)return;
 pendingPlan=null;
 pendingRemoval=null;
 if(document.activeElement?.closest('#nav'))return;
 const fallback=app.querySelector('[data-act="quick"]')||app;
 const replacement=opener?.dataset.act&&[...app.querySelectorAll('[data-act]')].find(item=>
  item.dataset.act===opener.dataset.act&&item.dataset.value===opener.dataset.value);
 (opener?.isConnected?opener:replacement||fallback).focus({preventScroll:true});
});
function quick(){
 modal('Створити','<p class="muted">'+shortDate(state.date)+'</p><div class="list">'+
 [['note','Зберегти думку','Одна фраза в локальних нотатках','note'],['event','Додати подію','Підтверджений запис у вибраний день','calendar'],['scenario','Створити сценарій','Окрема версія дня','parallel']].map(([key,title,desc,glyph])=>
 action('<span class="action-glyph">'+icon(glyph)+'</span><span><h3>'+title+'</h3><p>'+desc+'</p></span>'+icon('right'),'form',key,'class="row quick-row"')).join('')+'</div>','quick-sheet');
}
function form(kind){
 const isNote=kind==='note',isEvent=kind==='event';
 const title=isNote?'Зберегти думку':isEvent?'Додати подію':'Створити сценарій';
 modal(title,'<p class="muted">'+cap(dateLabel(state.date,{dateStyle:'full'}))+'</p><form data-kind="'+kind+'"><label>'+(isNote?'Думка':'Назва')+'<input name="title" required maxlength="100" placeholder="'+(isNote?'Напиши кілька слів…':'Наприклад, час для читання')+'"></label>'+
 (isNote?'':'<label>'+(isEvent?'Початок':'Час першого блоку')+'<input type="time" name="time" value="15:00" required></label>')+
 (isNote?'':'<label>Кінець (необов’язково)<input type="time" name="end"></label>')+
 '<button class="primary" type="submit">Зберегти</button></form>','quick-sheet');
}
function eventDetail(id){
 const e=allEvents().find(e=>e.id===id);
 if(!e)return;
 const assumed=e.layer==='ai';
 const conflicts=confirmedOn(e.date).filter(other=>other.id!==e.id&&overlaps(e,other));
 const duration=e.end?minutes(e.end)-minutes(e.time):0;
 const status=assumed?'AI-пропозиція · Не підтверджено':(e.done?'Завершено':'Підтверджено')+' · '+layers[e.layer];
 const subtasks=e.subtasks??[];
 const related=assumed?[]:allEvents().filter(item=>item.id!==id&&item.date===e.date&&item.layer===e.layer&&data.layers[item.layer]);
 modal(escape(e.title),'<p class="detail-status '+(assumed?'draft':'')+'">'+status+(e.demo?' · Демодані':'')+'</p>'+
 '<div class="detail-facts"><span>'+icon('calendar')+shortDate(e.date)+'</span><span>'+icon('clock')+e.time+(e.end?'–'+e.end:'')+'</span>'+(duration?'<strong>'+duration+' хв</strong>':'')+'</div>'+
 (conflicts.length?'<p class="conflict">Перетин у розкладі · '+conflicts.map(other=>escape(other.title)).join(', ')+'</p>':'')+
 '<div class="detail-actions">'+(assumed?action('Додати як підтверджену подію','accept',id,'class="primary"'):
 action(icon('check')+(e.done?'Відновити подію':'Позначити завершеною'),'complete',id,'class="primary"')+
 action('Редагувати','edit-event',id,'class="secondary"')+
 action('Видалити','event-delete-confirm',id,'class="secondary"'))+'</div>'+
 '<section class="detail-section"><h3>Опис</h3><p>'+escape(e.detail||'Опису ще немає.')+'</p></section>'+
 (assumed?'':'<section class="detail-section"><div class="section-head"><h3>Підзавдання</h3><span class="subtask-count muted" aria-live="polite">'+subtasks.filter(task=>task.done).length+'/'+subtasks.length+'</span></div>'+
 subtasks.map((task,index)=>'<label class="subtask"><input type="checkbox" data-event="'+escape(id)+'" data-index="'+index+'"'+(task.done?' checked':'')+'><span>'+escape(task.title)+'</span></label>').join('')+
 '<form class="subtask-form" data-kind="subtask" data-id="'+escape(id)+'"><label>Нове підзавдання<input name="title" maxlength="100" required></label><button class="secondary" type="submit">Додати</button></form></section>')+
 (related.length?'<section class="detail-section related-events"><h3>Інші події цього шару</h3>'+related.map(item=>
 action('<time>'+item.time+'</time><span>'+escape(item.title)+'</span>'+icon('right'),'event',item.id,'class="row"')).join('')+'</section>':''),
 assumed?'event-sheet ai-sheet':'event-sheet',assumed?'spark':e.layer==='work'?'work':'calendar');
}
function editEvent(id){
 const event=allEvents().find(item=>item.id===id&&item.layer!=='ai');
 if(!event)return;
 modal('Редагувати подію','<form data-kind="edit" data-id="'+escape(id)+'">'+
 '<label>Назва<input name="title" required maxlength="100" value="'+escape(event.title)+'"></label>'+
 '<label>Дата<input type="date" name="date" required value="'+event.date+'"></label>'+
 '<div class="time-fields"><label>Початок<input type="time" name="time" required value="'+event.time+'"></label>'+
 '<label>Кінець<input type="time" name="end" value="'+(event.end||'')+'"></label></div>'+
 '<label>Опис<textarea name="detail" maxlength="1000">'+escape(event.detail||'')+'</textarea></label>'+
 '<button class="primary" type="submit">Зберегти</button></form>','event-sheet');
}
function updateEvent(id,patch,refreshDetails=true){
 data.eventUpdates={...data.eventUpdates,[id]:{...data.eventUpdates[id],...patch}};
 save('Подію оновлено');
 render();
 if(refreshDetails)eventDetail(id);
}

function setting(key){
 const title=settingsRows.find(row=>row[0]===key)?.[1];
 if(!title)return;
 const content={
  account:'Записи зберігаються в цьому браузері. Обліковий запис і синхронізація між пристроями недоступні.',
  sources:'UNFOLD використовує локальні події та демонстраційні AI-пропозиції. Зовнішні календарі й сервіси завдань не підключені.',
  preferences:'Можна повернутися до початкової дати й переглянути приклади розкладу.',
  appearance:'Світла тема UNFOLD. За потреби можна вимкнути переходи між екранами.',
  privacy:'Події, підзавдання, думки й сценарії зберігаються в цьому браузері для локальної адреси UNFOLD.',
  about:'UNFOLD 0.1.0 · Локальний планувальник і простір для порівняння сценаріїв дня.'
 };
 const extras={
  preferences:textLink('Повернутися до демодня','today'),
  appearance:action('Зменшити рух <span class="toggle" aria-hidden="true"></span>','motion',undefined,'class="row" aria-pressed="'+data.reduceMotion+'"'),
  privacy:textLink('Збережені думки','notes')+'<br>'+textLink('Скинути демо','reset-confirm')
 };
 modal(title,'<p class="muted">'+content[key]+'</p>'+(extras[key]||''));
}

function planDialog(id,confirm){
 const plan=plansOn(state.date).find(item=>item.id===id);
 if(!plan)return;
 const date=state.date;
 const key=date+'/'+id;
 const applied=data.appliedPlans.includes(key);
 const report=scenarioReport(confirmedOn(date).filter(event=>!data.planEventIds[key]?.includes(event.id)),plan);
 const canApply=confirm&&!applied;
 const message=applied?'Цей сценарій уже додано на вибрану дату.':confirm?'Блоки стануть новими подіями. Поточні записи залишаться в календарі.':'Попередній перегляд. Календар залишиться без змін.';
 modal(escape(plan.title),'<div class="preview-note"><span class="eyebrow">Симуляція · '+shortDate(date)+'</span><p>'+message+'</p></div>'+
 (applied?'':timeBalance(report))+
 '<ul class="plan-list preview-list">'+report.rows.map(({time,title,end,conflicts})=>'<li><time>'+time+'</time><span>'+escape(title)+
 (end?' <small>до '+end+'</small>':'')+(conflicts.length?'<small class="conflict-text">Перетин · '+conflicts.map(event=>escape(event.title)).join(', ')+'</small>':'')+'</span></li>').join('')+'</ul>'+
 (canApply?action('Підтвердити додавання','plan-apply',id,'class="primary"'):''),'scenario-sheet','parallel');
 if(canApply)pendingPlan={plan,date};
}
function go(screen){
 state.screen=screen;
 if(modes[screen])state.mode=modes[screen];
 render(true);
 window.scrollTo(0,0);
 nav.querySelector('[aria-current]')?.focus({preventScroll:true});
}
function shift(offset){
 if(state.mode!=='month'){state.date=plusDays(state.date,offset*(state.mode==='week'?7:1));return;}
 const date=parse(state.date);
 const target=new Date(date.getFullYear(),date.getMonth()+offset,1,12);
 const limit=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
 target.setDate(Math.min(date.getDate(),limit));state.date=keyOf(target);
}
function search(){
 modal('Пошук','<label>Події, нотатки й сценарії<input type="search" id="local-search" autocomplete="off"></label>'+
 '<div id="search-results" class="list" aria-live="polite"><p>Введи назву або частину тексту.</p></div>');
}
function searchResults(query){
 const term=query.trim().toLocaleLowerCase('uk');
 if(!term)return '<p>Введи назву або частину тексту.</p>';
 const matches=[
  ...allEvents().map(item=>[item,'event','Подія']),
  ...data.notes.map(item=>[item,'note-result','Нотатка']),
  ...[...plans,...data.plans].map(item=>[item,'plan-result','Сценарій'])
 ].filter(([item])=>[item.title,item.detail,item.desc].some(value=>value?.toLocaleLowerCase('uk').includes(term)));
 return !matches.length?'<p>Нічого не знайдено.</p>':
 matches.map(([item,act,type])=>action('<span><strong>'+escape(item.title)+'</strong><small>'+type+
  (item.date?' · '+shortDate(item.date):'')+'</small></span>'+icon('right'),act,item.id,'class="row"')).join('');
}
dialog.addEventListener('input',event=>{
 if(event.target.id==='local-search')dialog.querySelector('#search-results').innerHTML=searchResults(event.target.value);
});
dialog.addEventListener('keydown',event=>{
 if(!['ArrowDown','ArrowUp'].includes(event.key)||!dialog.querySelector('#local-search'))return;
 const targets=[dialog.querySelector('#local-search'),...dialog.querySelectorAll('#search-results button')];
 const index=targets.indexOf(event.target);
 if(index<0)return;
 event.preventDefault();
 targets[(index+(event.key==='ArrowDown'?1:-1)+targets.length)%targets.length].focus();
});
document.addEventListener('click',event=>{
 const button=event.target.closest('button[data-act]');
 if(!button)return;
 const {act,value}=button.dataset;
 switch(act){
 case 'nav': if(dialog.open)dialog.close();go(value);break;
 case 'mode': state.mode=value;state.followToday=false;modes[state.screen]=value;render(true);break;
 case 'date':
 case 'mini-date': {
  const openDay=act==='mini-date'||state.mode==='month';
  state.date=value;state.followToday=false;state.miniMonth=null;state.live='auto';
  if(act==='mini-date'&&!modes[state.screen]){state.screen='calendar';}
  if(openDay){state.mode='day';modes[state.screen]='day';}
  render(openDay);
  if(openDay)app.focus?.({preventScroll:true});
  break;
 }
 case 'shift': shift(Number(value));state.followToday=false;state.miniMonth=null;state.live='auto';render(true);break;
 case 'mini-shift': {
  const date=parse(state.miniMonth||state.date);
  state.miniMonth=keyOf(new Date(date.getFullYear(),date.getMonth()+Number(value),1,12));
  render();break;
 }
 case 'current-date': {
  state.mode=modes[state.screen]='day';
  state.date=keyOf(new Date());state.followToday=true;state.miniMonth=null;state.live='auto';render(true);
  const scroller=app.querySelector('.day-scroll');
  const line=scroller?.querySelector('.now-line');
  if(line)scroller.scrollTop=Math.max(0,line.offsetTop-scroller.clientHeight/3);
  break;
 }
 case 'rail': {
  const expanded=shell?.classList.toggle('rail-open');
  button.setAttribute('aria-expanded',String(expanded));
  button.setAttribute('aria-label',expanded?'Згорнути навігацію':'Розгорнути навігацію');
  break;
 }
 case 'live': state.live=value;render();break;
 case 'live-pause': {
  const item=allEvents().find(event=>event.id===value);
  if(item?.demo||!item?.end)break;
  const clock=new Date(), now=clock.getHours()*60+clock.getMinutes();
  const start=minutes(item.time), end=minutes(item.end);
  if(item.date!==keyOf(clock)||now<start||now>=end)break;
  state.pausedLive=state.pausedLive?.id===value?null:{id:value,remaining:end-now,percent:Math.round(100*(now-start)/(end-start))};
  render();break;
 }
 case 'all-events': modes.calendar='day';go('calendar');break;
 case 'search': search();break;
 case 'note-result': {
  const note=data.notes.find(item=>item.id===value);
  if(note)modal('Нотатка','<p class="muted">'+shortDate(note.date)+'</p><p>'+escape(note.title)+'</p>');
  break;
 }
 case 'plan-result': {
  const plan=[...plans,...data.plans].find(item=>item.id===value);
  if(!plan)break;
  if(plan.date){state.date=plan.date;state.followToday=false;}
  state.plan=value;
  dialog.close();go('parallel');break;
 }
 case 'weather':
  cityResults=[];
  modal('Погода','<p>Обери місто або дозволь браузеру передати приблизні координати в Open-Meteo.</p>'+
   action('Визначити місцезнаходження','weather-load',undefined,'class="secondary"')+
   '<form class="weather-form" data-kind="weather-city"><label>Назва міста<input name="city" required minlength="2" maxlength="100" autocomplete="off"></label>'+
   '<button type="submit" class="primary">Знайти місто</button><div class="list city-results" aria-live="polite"></div></form>');
  break;
 case 'weather-load': dialog.close();loadWeather();break;
 case 'weather-city-select': {
  const city=cityResults[Number(value)];
  if(!city)break;
  dialog.close();loadWeather(city);break;
 }
 case 'notifications': {
  const clock=new Date(), now=clock.getHours()*60+clock.getMinutes();
  const upcoming=eventsOn(keyOf(clock)).filter(item=>item.layer!=='ai'&&!item.done&&minutes(item.time)>=now&&minutes(item.time)<=now+60);
  modal('Сповіщення',upcoming.length?'<div class="list">'+upcoming.map(item=>action('<span><strong>'+escape(item.title)+'</strong><small>Початок о '+item.time+'</small></span>'+icon('right'),
   'event',item.id,'class="row"')).join('')+'</div>':'<p class="muted">На найближчу годину немає запланованих подій.</p>');
  break;
 }
 case 'profile': modal('Локальний профіль','<p class="muted">Твої записи зберігаються в цьому браузері.</p><div class="list">'+
  action(icon('note')+' Збережені думки','notes',undefined,'class="row"')+
  action(icon('settings')+' Налаштування','nav','settings','class="row"')+'</div>');break;
 case 'layer': {
  const visible=!data.layers[value];
  data.layers={...data.layers,[value]:visible};
  button.setAttribute('aria-checked',String(visible));
  button.querySelector('.layer-state').textContent=visible?'Видимо':'Приховано';
  save('Видимість шару оновлено');break;
 }
 case 'plan': state.plan=value;render(true);break;
 case 'plan-preview': planDialog(value,false);break;
 case 'plan-confirm': planDialog(value,true);break;
 case 'plan-apply': {
  if(!dialog.open||pendingPlan?.plan.id!==value)break;
  const {plan,date}=pendingPlan;
  pendingPlan=null;
  const key=date+'/'+value;
  if(data.appliedPlans.includes(key))break;
  const created=planBlocks(plan).map(block=>({...block,id:uid(),date,layer:'personal',detail:'Додано зі сценарію «'+plan.title+'».'}));
  data.events=[...data.events,...created];
  data.appliedPlans=[...data.appliedPlans,key];
  data.planEventIds={...data.planEventIds,[key]:created.map(event=>event.id)};
  data.layers={...data.layers,personal:true};
  dialog.close();save('Сценарій додано до календаря');render();break;
 }
 case 'plan-undo-confirm': {
  const key=state.date+'/'+value;
  if(!data.planEventIds[key])break;
  modal('Скасувати застосування сценарію?','<p>З календаря буде видалено події, створені цим сценарієм, разом із їхніми правками.</p>'+
   action('Скасувати застосування','plan-undo',key,'class="primary"'),'scenario-sheet','parallel');
  pendingRemoval={kind:'plan',id:key};
  break;
 }
 case 'plan-undo': {
  const ids=data.planEventIds[value];
  if(!ids||!dialog.open||pendingRemoval?.kind!=='plan'||pendingRemoval.id!==value)break;
  pendingRemoval=null;
  for(const item of data.events.filter(event=>ids.includes(event.id)))removeEvent(item);
  delete data.planEventIds[value];
  data.appliedPlans=data.appliedPlans.filter(key=>key!==value);
  dialog.close();save('Застосування сценарію скасовано');render();break;
 }
 case 'quick': quick();break;
 case 'form': form(value);break;
 case 'close': dialog.close();break;
 case 'event': eventDetail(value);break;
 case 'event-delete-confirm': {
  const item=allEvents().find(event=>event.id===value&&event.layer!=='ai');
  if(!item)break;
  modal('Видалити подію?','<p>'+escape(item.title)+'</p>'+
   action('Видалити подію','event-delete',value,'class="primary"'),'event-sheet','calendar');
  pendingRemoval={kind:'event',id:value};
  break;
 }
 case 'event-delete': {
  const item=allEvents().find(event=>event.id===value&&event.layer!=='ai');
  if(!item||!dialog.open||pendingRemoval?.kind!=='event'||pendingRemoval.id!==value)break;
  pendingRemoval=null;
  removeEvent(item);dialog.close();save('Подію видалено');render();break;
 }
 case 'edit-event': editEvent(value);break;
 case 'complete': {
  const event=allEvents().find(item=>item.id===value&&item.layer!=='ai');
  if(event){
   updateEvent(value,{done:!event.done});
   dialog.querySelector('[data-act="complete"]')?.focus();
  }
  break;
 }
 case 'setting': setting(value);break;
 case 'motion': data.reduceMotion=!data.reduceMotion;save('Оформлення оновлено');render();setting('appearance');break;
 case 'live-info':
  if(value==='change')modal('Приклад зміни','<p>У деморозкладі синхронізацію команди перенесено з 09:00 на 09:30.</p>'+textLink('Відкрити демоподію','event','e1'));
  else modal('Можливість для паузи','<p>AI-пропозиція · Якщо тобі зручно, приміряй 30 хвилин для прогулянки.</p>'+textLink('Переглянути сценарій','nav','parallel'));
  break;
 case 'accept': {
  const idea=allEvents().find(e=>e.id===value&&e.layer==='ai');
  if(!idea)break;
  data.events=[...data.events,{...idea,id:uid(),demo:false,layer:'personal',detail:'Додано після твого підтвердження.'}];
  data.accepted=[...data.accepted,idea.id];
  data.layers={...data.layers,personal:true};
  dialog.close();save('Подію підтверджено');render();break;
 }
 case 'notes': modal('Збережені думки',data.notes.length?'<div class="list">'+data.notes.map(n=>'<div class="row"><span>'+escape(n.title)+'<p>'+shortDate(n.date)+'</p></span></div>').join('')+'</div>':'<p class="muted">Збережи першу думку через швидкі дії.</p>');break;
 case 'today':
 case 'demo-day': if(dialog.open)dialog.close();modes.home='day';state.followToday=false;state.date=demoDay;state.miniMonth=null;state.live='auto';go('home');break;
 case 'reset-confirm': modal('Скинути демо?','<p>Власні події, думки, сценарії та налаштування шарів буде видалено.</p>'+action('Скинути демо','reset',undefined,'class="primary"'));break;
 case 'reset': modes.home='day';modes.calendar='month';resetData();state.date=demoDay;state.miniMonth=null;state.followToday=false;state.pausedLive=null;state.live='auto';state.plan='focus';dialog.close();save('Початкові демодані відновлено');go('home');break;
 }
});
dialog.addEventListener('click',event=>{
 if(event.target!==dialog)return;
 const bounds=dialog.getBoundingClientRect();
 if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();
});
dialog.addEventListener('change',event=>{
 const {event:id,index}=event.target.dataset;
 if(id===undefined||index===undefined)return;
 const item=allEvents().find(item=>item.id===id&&item.layer!=='ai');
 if(!item?.subtasks?.[index])return;
 const subtasks=item.subtasks.map((task,position)=>position===Number(index)?{...task,done:event.target.checked}:task);
 updateEvent(id,{subtasks},false);
 const count=dialog.querySelector('.subtask-count');
 if(count)count.textContent=subtasks.filter(task=>task.done).length+'/'+subtasks.length;
});
dialog.addEventListener('submit',event=>{
 event.preventDefault();
 const form=event.target, fields=new FormData(form);
 if(form.dataset.kind==='weather-city'){findWeatherCity(form,fields.get('city').trim());return;}
 const title=fields.get('title').trim(), time=fields.get('time'), end=fields.get('end');
 if(!title){const input=form.elements.title;input.setCustomValidity('Введи текст');input.reportValidity();input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});return;}
 if(end&&end<=time){
  const input=form.elements.end;
  input.setCustomValidity('Кінець має бути пізніше за початок.');
  input.reportValidity();
  const clear=()=>{input.setCustomValidity('');form.removeEventListener('input',clear);};
  form.addEventListener('input',clear);
  return;
 }
 if(form.dataset.kind==='edit'||form.dataset.kind==='subtask'){
  const event=allEvents().find(item=>item.id===form.dataset.id&&item.layer!=='ai');
  if(!event)return;
  const patch=form.dataset.kind==='edit'?{title,time,end,date:fields.get('date'),detail:fields.get('detail').trim()}:
   {subtasks:[...(event.subtasks??[]),{title,done:false}]};
  updateEvent(event.id,patch);return;
 }
 const id=uid();
 if(form.dataset.kind==='note'){
  data.notes=[...data.notes,{id,title,date:state.date}];dialog.close();save('Думку збережено');return;
 }
 if(form.dataset.kind==='event'){
  data.events=[...data.events,{id,title,time,end,date:state.date,layer:'personal',detail:'Додано вручну.'}];
  data.layers={...data.layers,personal:true};
  dialog.close();save('Подію додано');if(['home','calendar'].includes(state.screen))render();else go('home');return;
 }
 data.plans=[...data.plans,{id,title,date:state.date,desc:'Твій сценарій',items:[[time,title,end||undefined]]}];
 state.plan=id;dialog.close();save('Сценарій створено');go('parallel');
});

app.addEventListener('change',event=>{
 if(event.target.id==='scenario-choice'){
  state.plan=event.target.value;render(true);
  app.querySelector('#scenario-choice')?.focus({preventScroll:true});return;
 }
 if(event.target.id!=='scenario-date'||!event.target.value)return;
 state.date=event.target.value;
 state.followToday=false;
 state.live='auto';
 render(true);
 app.querySelector('#scenario-date')?.focus({preventScroll:true});
});
document.addEventListener('keydown',event=>{
 if(!dialog.open&&!event.defaultPrevented&&!event.repeat&&(event.ctrlKey||event.metaKey)&&event.code==='KeyK'){
  event.preventDefault();search();return;
 }
 if(event.target.matches?.('[data-act="mini-date"]')){
  const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  const offset=offsets[event.key];
  if(offset){
   event.preventDefault();
   const date=plusDays(event.target.dataset.value,offset);
   let target=mini.querySelector('[data-value="'+date+'"]');
   if(!target){
    const previousMonth=mini.querySelector('.mini-head')?.dataset.month;
    state.miniMonth=date;mini.innerHTML=miniCalendar();revealMiniMonth(previousMonth);
    target=mini.querySelector('[data-value="'+date+'"]');
   }
   target?.focus();return;
  }
 }
 if(event.defaultPrevented||dialog.open||event.repeat||!event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input, textarea, select, [contenteditable]'))return;
 if(event.code==='KeyN'){
  event.preventDefault();
  app.querySelector('[data-act="quick"]')?.focus();
  quick();
 }
});
render();
let lastClock=new Date();
function syncClock(){
 if(document.hidden)return;
 const now=new Date(), day=keyOf(now), time=clockTime(now);
 const clock=app.querySelector('.local-clock');
 if(clock&&clock.dateTime!==time){clock.dateTime=time;clock.textContent=time;}
 if(dialog.open)return;
 const newDay=day!==keyOf(lastClock);
 const newMinute=newDay||time!==clockTime(lastClock);
 if(newMinute&&(app.querySelector('.liquid-layer')||nav.querySelector('.liquid-layer')))return;
 if(newDay&&state.followToday){state.date=day;state.miniMonth=null;state.pausedLive=null;}
 if(newDay||newMinute&&state.mode==='day'&&(state.screen==='home'||state.screen==='calendar'))render();
 lastClock=now;
}
if(typeof window.setInterval==='function'){
 window.setInterval(syncClock,1000);
 window.setInterval(()=>{if(weatherLocation&&!document.hidden)loadWeather(weatherLocation,true);},900000);
 document.addEventListener('visibilitychange',syncClock);
}

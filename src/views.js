import {demoDay,plans,data,state,layers,allEvents,eventsOn} from './store.js';
import {months,weekdays,parse,keyOf,plusDays,weekStart,dateLabel,cap,shortDate,minutes} from './dates.js';
import {escape,icon,action,iconButton,textLink,segment,header} from './ui.js';
function periodControls(){
 return '<div class="period"><div class="controls">'+iconButton('left','shift','Попередній період','-1')+
 iconButton('right','shift','Наступний період','1')+action('Сьогодні','current-date',undefined,'class="today-button"')+
 '</div>'+segment({day:'День',week:'Тиждень',month:'Місяць'},state.mode,'mode','Вигляд календаря')+'</div>';
}
function dateGrid(key=state.date,month=state.mode==='month',mini=false){
 const date=parse(key);
 const first=keyOf(new Date(date.getFullYear(),date.getMonth(),1,12));
 const start=weekStart(month?first:key);
 const count=month?Math.ceil((new Date(date.getFullYear(),date.getMonth()+1,0).getDate()+((parse(first).getDay()+6)%7))/7)*7:7;
 const cells=Array.from({length:count},(_,index)=>{
  const key=plusDays(start,index), events=eventsOn(key);
  const confirmed=events.filter(e=>e.layer!=='ai'), ideas=events.length-confirmed.length;
  const markers='<span class="markers" aria-hidden="true">'+(confirmed.length?'<i class="dot"></i>':'')+(ideas?'<i class="dot ai"></i>':'')+'</span>';
  const suggestions=events.filter(event=>event.layer==='ai');
  const previews=confirmed.length&&suggestions.length?[confirmed[0],suggestions[0]]:events.slice(0,2);
  const overflow=events.length-previews.length;
  const titles=month&&!mini?'<span class="cell-events" aria-hidden="true">'+previews.map(event=>
   '<span class="cell-event'+(event.layer==='ai'?' cell-idea':'')+'">'+(event.layer==='ai'?'AI · ':'')+escape(event.title)+'</span>').join('')+
   (overflow?'<span class="cell-counts">+'+overflow+'</span>':'')+'</span>':'';
  const outside=month&&parse(key).getMonth()!==date.getMonth()?' outside':'';
  const label=dateLabel(key,{dateStyle:'full'})+' Підтверджено '+confirmed.length+'. AI-пропозицій '+ideas+
   (month&&!mini&&previews.length?'. '+previews.map(event=>(event.layer==='ai'?'AI: ':'')+event.title).join('; '):'');
  const weekday=month?'':'<span class="day-name">'+weekdays[index]+'</span>';
  return action(weekday+'<span class="day-num">'+parse(key).getDate()+'</span>'+(mini?'':markers+titles),mini?'mini-date':'date',key,'class="day'+outside+'" aria-pressed="'+(key===state.date)+'" aria-label="'+escape(label)+'"');
 }).join('');
 const heading=month?'<div class="weekday">'+weekdays.map(day=>'<span>'+day+'</span>').join('')+'</div>':'';
 return '<div class="calendar '+(month?'month-grid':'week-strip')+'">'+heading+'<div class="dates">'+cells+'</div></div>';
}
function miniCalendar(){
 const key=state.miniMonth||state.date, month=parse(key);
 return '<div class="mini-head"><strong>'+months[month.getMonth()]+' '+month.getFullYear()+'</strong><div class="controls">'+
 iconButton('left','mini-shift','Попередній місяць','-1')+iconButton('right','mini-shift','Наступний місяць','1')+
 '</div></div>'+dateGrid(key,true,true);
}

function weekBlocks(events,firstHour){
 const groups=[];
 for(const event of events){
  const start=minutes(event.time);
  const end=event.end?minutes(event.end):start+15;
  const visibleEnd=Math.max(end,start+24);
  if(!groups.length||groups.at(-1).end<=start)groups.push({end:visibleEnd,lanes:[],blocks:[]});
  const group=groups.at(-1);
  let lane=group.lanes.findIndex(previousEnd=>previousEnd<=start);
  if(lane===-1)lane=group.lanes.length;
  group.lanes[lane]=visibleEnd;
  group.end=Math.max(group.end,visibleEnd);
  group.blocks.push({event,start,end:visibleEnd,lane});
 }
 return groups.flatMap(group=>group.blocks.map(({event,start,end,lane})=>{
  const assumed=event.layer==='ai';
  const time=event.time+(event.end?'–'+event.end:'');
  const label=(assumed?'AI-пропозиція. ':'Підтверджено. ')+event.title+' · '+time;
  const style='--start:'+(start/60-firstHour)+';--length:'+((end-start)/60)+';--lane:'+lane+';--lanes:'+group.lanes.length;
  const compact=end-start<30;
  return action('<strong>'+(assumed?'AI · ':'')+escape(event.title)+'</strong>'+(compact?'':'<small>'+time+'</small>'),
   'event',event.id,'class="week-event'+(assumed?' assumed':'')+(event.done?' done':'')+(compact?' compact':'')+'" style="'+style+'" aria-label="'+escape(label)+'" title="'+escape(label)+'"');
 })).join('');
}

function timeGrid(day=false){
 const start=weekStart(state.date);
 const days=Array.from({length:day?1:7},(_,index)=>{
  const key=day?state.date:plusDays(start,index);
  return {key,events:eventsOn(key)};
 });
 const events=days.flatMap(day=>day.events);
 const clock=new Date();
 const now=clock.getHours()*60+clock.getMinutes(), today=keyOf(clock);
 const showNow=day&&state.date===today;
 const firstHour=Math.min(showNow?Math.min(8,Math.floor(now/60)):8,...events.map(event=>Math.floor(minutes(event.time)/60)));
 const lastHour=Math.max(showNow?Math.max(20,Math.floor(now/60)+1):20,...events.map(event=>Math.ceil(Math.max(minutes(event.end||event.time),minutes(event.time)+24)/60)));
 const hours=Array.from({length:lastHour-firstHour},(_,index)=>
  '<time>'+String(firstHour+index).padStart(2,'0')+':00</time>').join('');
 const columns=days.map(({key,events})=>{
  const selected=key===state.date;
  const label=weekdays[(parse(key).getDay()+6)%7];
  const heading=day?'':action('<span>'+label+'</span><strong'+(key===today?' class="current-day"':'')+'>'+parse(key).getDate()+'</strong>','date',key,
   'class="week-day" aria-pressed="'+selected+'" aria-label="'+dateLabel(key,{dateStyle:'full'})+'"');
  const line=showNow?'<div class="now-line" style="--start:'+(now/60-firstHour)+'"><time>'+String(clock.getHours()).padStart(2,'0')+':'+String(clock.getMinutes()).padStart(2,'0')+'</time></div>':'';
  return '<div class="week-column'+(selected?' selected':'')+'">'+heading+
   '<div class="week-track">'+weekBlocks(events,firstHour)+line+'</div></div>';
 }).join('');
 return '<div class="'+(day?'day-scroll':'week-scroll')+'"><div class="'+(day?'day-grid':'week-overview')+'" style="--hours:'+(lastHour-firstHour)+'">'+
  '<div class="week-hours" aria-hidden="true">'+hours+'</div>'+columns+'</div></div>';
}

function timeline(events,scenario=false){
 if(!events.length)return '<div class="empty-state"><strong>На цю дату записів не видно</strong><p>Додай подію або переглянь видимість шарів.</p>'+textLink('Швидкі дії','quick')+'</div>';
 const rows=events;
 return '<div class="timeline">'+rows.map(e=>{
  const type=scenario||e.layer==='ai'?'assumed':e.title?'confirmed':'';
  const status=scenario?'Альтернативний сценарій':e.layer==='ai'?'AI-пропозиція · Не підтверджено':(e.done?'Завершено':'Підтверджено')+' · '+layers[e.layer];
  const content=e.title?'<span><strong>'+escape(e.title)+'</strong><small>'+status+(e.end?' · '+e.time+'–'+e.end:'')+'</small></span>':'';
  const card=e.title?(scenario?'<div class="card assumed">'+content+'</div>':action(icon(e.layer==='ai'?'spark':e.layer==='work'?'work':'calendar')+content+icon('right'),'event',e.id,'class="card '+type+(e.done?' done':'')+'"')):'<div class="open-slot">Без записів</div>';
  return '<div class="slot '+type+'"><time>'+e.time+'</time><i class="point"></i>'+card+'</div>';
 }).join('')+'</div>';
}
function liveCard(){
 const confirmed=eventsOn(state.date).filter(e=>e.layer!=='ai');
 const clock=new Date();
 const now=clock.getHours()*60+clock.getMinutes();
 const current=state.date===keyOf(clock)&&confirmed.find(event=>!event.done&&!event.demo&&event.end&&minutes(event.time)<=now&&now<minutes(event.end));
 const next=confirmed.find(e=>!e.done&&(state.date!==demoDay||e.time>='09:00'));
 const ai=eventsOn(state.date).find(e=>e.layer==='ai');
 const variant=state.live==='auto'?(current?'current':next?'upcoming':ai?'idea':confirmed.length?'past':'empty'):state.live;
 const states={
  change:['Зміна в розкладі','Демо · Синхронізацію перенесено з 09:00 на 09:30.','Переглянути приклад','live-info','change'],
  current:[current?.title,current?.time+'–'+current?.end,'Відкрити подію','event',current?.id],
  upcoming:[(state.live==='auto'&&state.date!==demoDay?'Перша подія · ':'Попереду · ')+(state.live==='auto'?next?.time:'09:30'),state.live==='auto'?next?.title+(state.date===demoDay?' · Демочас 09:00':''):'Демо · Синхронізація команди.','Переглянути подію','event',state.live==='auto'?next?.id:'e1'],
  idea:['Можливість для паузи','AI-пропозиція · Спробуй 30 хвилин для прогулянки, якщо тобі зручно.','Відкрити можливість',ai?'event':'live-info',ai?.id||'idea'],
  past:['Події на сьогодні','Усі підтверджені події почалися до демонстраційного часу 09:00.','Приміряти сценарій','nav','parallel'],
  empty:['Є простір для планів.','На цю дату серед видимих шарів немає підтверджених подій.','Приміряти сценарій','nav','parallel']
 };
 const [title,copy,label,act,value]=states[variant];
 const progress=variant==='current'?'<progress max="'+(minutes(current.end)-minutes(current.time))+'" value="'+(now-minutes(current.time))+'" aria-label="Минуло часу від початку події"></progress>':'';
 return '<div class="live"><div class="live-copy"><div class="eyebrow"><i class="dot"></i> Live Card · '+(variant==='current'?'триває зараз':state.live==='auto'?'огляд дня':'приклад')+'</div><h2>'+escape(title)+'</h2><p>'+escape(copy)+'</p>'+progress+'</div>'+textLink(label,act,value)+'</div>'+
 '<details class="live-demo"><summary>Стани демо</summary><div class="livebar">'+segment({auto:'Авто',change:'Зміна',upcoming:'Подія',idea:'Ідея',empty:'Порожньо'},state.live,'live','Демонстраційні стани Live Card')+'</div></details>';
}

function agenda(events,title='Часова стрічка'){
 const count=events.filter(e=>e.layer!=='ai').length;
 return '<section class="timeline-area" aria-labelledby="timeline-title"><div class="section-head"><h2 id="timeline-title">'+title+'</h2><span class="meta-date">'+shortDate(state.date)+'</span></div>'+
 '<div class="legend"><span><i class="dot"></i> Підтверджено · '+count+'</span><span><i class="dot ai"></i> AI-пропозиції · '+(events.length-count)+'</span></div>'+timeline(events)+'</section>';
}
function schedule(){
 const home=state.screen==='home', day=state.mode==='day', events=eventsOn(state.date);
 const date=parse(state.date);
 const title=day?shortDate(state.date):state.mode==='month'?months[date.getMonth()]+' '+date.getFullYear():
  shortDate(weekStart(state.date))+' – '+shortDate(plusDays(weekStart(state.date),6));
 const intro=header(day?cap(dateLabel(state.date,{weekday:'long'})):home?'Твій день':'Календар',title);
 const overview=state.mode==='week'?timeGrid():dateGrid();
 const detail=agenda(events,home&&day?'Часова стрічка':'Порядок дня');
 if(home&&day){
  const confirmed=events.filter(event=>event.layer!=='ai').length;
  return periodControls()+intro+'<div class="home-grid workspace"><div class="home-main">'+
   '<div class="day-calendar">'+overview+'</div>'+liveCard()+detail+'</div><aside class="home-context" aria-labelledby="context-title">'+
   '<h2 id="context-title">Огляд дня</h2><dl class="overview-list"><div><dt><i class="dot"></i> Підтверджено</dt><dd>'+confirmed+'</dd></div><div><dt><i class="dot ai"></i> Можливості AI</dt><dd>'+(events.length-confirmed)+'</dd></div></dl>'+
   action(icon('parallel')+'<span><strong>Parallel Days</strong><small>Порівняй дві версії дня</small></span>'+icon('right'),'nav','parallel','class="context-action"')+
   action(icon('note')+'<span><strong>Швидка нотатка</strong><small>Збережи думку на цей день</small></span>'+icon('right'),'form','note','class="context-action"')+'</aside></div>';
 }
 const body=day?'<div class="calendar-day">'+overview+timeGrid(true)+'</div>':overview;
 return periodControls()+intro+'<div class="calendar-workspace workspace '+(day?'day-workspace':'')+'"><section class="period-overview" aria-label="Огляд періоду">'+body+
  '</section>'+(day?'':'<aside class="day-inspector">'+detail+'</aside>')+'</div>';
}


function parallel(){
 const choices=[...plans,...data.plans.filter(p=>!p.date||p.date===state.date)];
 const plan=choices.find(p=>p.id===state.plan)||choices[0];
 const alternative=choices.find(candidate=>candidate.id!==plan.id);
 const versions=[plan,alternative];
 const times=[...new Set(versions.flatMap(version=>version.items.map(([time])=>time)))].sort();
 const baseline=allEvents().filter(e=>e.date===state.date&&e.layer!=='ai').sort((a,b)=>a.time.localeCompare(b.time));
 return header('03 / Можливості','Parallel Days','Порівняй сценарій із розкладом · '+shortDate(state.date))+
 '<div class="parallel-date"><label for="scenario-date">Дата порівняння</label><input type="date" id="scenario-date" value="'+state.date+'">'+
 '<label for="scenario-choice">Сценарій</label><select id="scenario-choice">'+choices.map(p=>'<option value="'+escape(p.id)+'"'+(p.id===plan.id?' selected':'')+'>'+escape(p.title)+'</option>').join('')+'</select></div>'+
 '<div class="compare workspace" style="--comparison-slots:'+times.length+';--comparison-rows:'+(times.length+2)+'">'+versions.map((p,index)=>'<section class="context-card"><header class="comparison-head"><div class="section-head"><span class="eyebrow">Версія '+(index?'B':'A')+'</span><span class="badge draft">Симуляція</span></div>'+
 '<h2>'+escape(p.title)+'</h2><p class="muted scenario-copy">'+escape(p.desc)+'</p></header>'+
 '<ul class="plan-list">'+times.map(time=>{
  const blocks=p.items.filter(([start])=>start===time);
  const other=versions[1-index].items.filter(([start])=>start===time);
  const differs=JSON.stringify(blocks)!==JSON.stringify(other);
  return blocks.length?'<li'+(differs?' class="comparison-difference"':'')+'><time>'+time+'</time><span>'+blocks.map(([,title])=>escape(title)).join('<br>')+'</span></li>':
   '<li class="comparison-gap" aria-hidden="true"><time>'+time+'</time><span>—</span></li>';
 }).join('')+'</ul><div class="comparison-actions">'+
 action('Переглянути','plan-preview',p.id,'class="secondary"')+
 action('Додати до календаря','plan-confirm',p.id,'class="primary"')+'</div></section>').join('')+'</div>'+
 '<details class="baseline"><summary>Поточний розклад · '+baseline.length+'</summary>'+
 (baseline.length?timeline(baseline):'<p class="muted">На цю дату немає підтверджених подій.</p>')+'</details>';
}

const settingsRows=[
 ['account','Обліковий запис і синхронізація','Локальний режим','user'],
 ['sources','Джерела та інтеграції','Календарі, завдання й AI','layers'],
 ['preferences','Уподобання','Видимість шарів і демодень','sliders'],
 ['appearance','Оформлення','Тема й рух інтерфейсу','spark'],
 ['privacy','Приватність і дані','Локальні записи та скидання','shield'],
 ['about','Про UNFOLD','Версія та можливості','info']
];
const settingRow=([key,title,description,glyph])=>action(icon(glyph)+'<span><h3>'+title+'</h3><p>'+description+'</p></span>'+icon('right'),'setting',key,'class="row"');
const settingsGroup=(title,rows)=>'<section class="settings-group"><h2>'+title+'</h2><div class="settings-list">'+rows+'</div></section>';

function layerPage(){
 const rows=[
  ['personal','Календарі','Особисті події локального календаря','calendar'],
  ['work','Завдання та проєкти','Робочі події локального календаря','work'],
  ['ai','Можливості AI','Демонстраційні пропозиції','spark']
 ];
 return header('Видимість','Шари','Вибери, що показувати в календарі й часовій стрічці.')+
 '<div class="settings-layout workspace">'+settingsGroup('Видимість у розкладі',rows.map(([key,title,description,glyph])=>
 action(icon(glyph)+'<span><h3>'+title+'</h3><p>'+description+'</p></span><span class="layer-state" aria-hidden="true">'+(data.layers[key]?'Видимо':'Приховано')+'</span><span class="toggle" aria-hidden="true"></span>',
 'layer',key,'class="row" role="switch" aria-checked="'+data.layers[key]+'"')).join(''))+
 settingsGroup('Контекст і уподобання',settingRow(settingsRows[2])+action(icon('note')+'<span><h3>Контекст</h3><p>Думки, збережені на цьому пристрої</p></span>'+icon('right'),'notes',undefined,'class="row"'))+'</div>';
}
function settings(){
 return header('UNFOLD','Налаштування','Дані, джерела й оформлення.')+
 '<div class="settings-layout workspace">'+settingsGroup('Обліковий запис і дані',[0,1,4].map(index=>settingRow(settingsRows[index])).join(''))+
 settingsGroup('Застосунок',[2,3,5].map(index=>settingRow(settingsRows[index])).join(''))+'</div>';
}
export {schedule,parallel,layerPage,settings,miniCalendar,settingsRows};

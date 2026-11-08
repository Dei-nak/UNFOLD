import {demoDay,data,state,layers,eventsOn,confirmedOn,plansOn,scenarioReport} from './store.js';
import {months,weekdays,parse,keyOf,plusDays,weekStart,dateLabel,cap,shortDate,minutes,clockTime,overlaps,timeSummary,durationLabel} from './dates.js';
import {escape,icon,action,iconButton,textLink,segment,header} from './ui.js';
function periodControls(weather=''){
 return '<div class="period"><div class="controls">'+iconButton('left','shift','Попередній період','-1')+
 iconButton('right','shift','Наступний період','1')+'</div>'+
 '<div class="period-tabs"><div class="seg" role="group" aria-label="Вигляд календаря">'+
 action('Сьогодні','current-date',undefined,'class="today-button" aria-pressed="'+(state.screen==='home'&&!state.explicitPeriod)+'"')+
 Object.entries({day:'День',week:'Тиждень',month:'Місяць'}).map(([key,label])=>action(label,'mode',key,
 'aria-pressed="'+((state.screen!=='home'||Boolean(state.explicitPeriod))&&key===state.mode)+'"')).join('')+
 '</div></div><div class="top-tools">'+weather+
 action(icon('search')+'<kbd>⌘ K</kbd>','search',undefined,'class="top-search" aria-label="Пошук" aria-keyshortcuts="Control+K Meta+K"')+
 iconButton('bell','notifications','Сповіщення')+iconButton('user','profile','Профіль',undefined,'icon profile-button')+'</div></div>';
}
function dateGrid(key=state.date,month=state.mode==='month',mini=false){
 const date=parse(key);
 const today=keyOf(new Date());
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
  return action(weekday+'<span class="day-num">'+parse(key).getDate()+'</span>'+markers+titles,mini?'mini-date':'date',key,
   'class="day'+outside+'" aria-pressed="'+(key===state.date)+'"'+(key===today?' aria-current="date"':'')+' aria-label="'+escape(label)+'"');
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
  const visibleEnd=Math.min(1440,Math.max(end,start+24));
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
  const conflict=group.blocks.some(other=>other.event!==event&&other.event.layer!=='ai'&&overlaps(event,other.event));
  const label=(assumed?'AI-пропозиція. ':event.done?'Завершено. ':'Підтверджено. ')+event.title+' · '+time+(conflict?' · Перетин у розкладі':'');
  const style='--start:'+(start/60-firstHour)+';--length:'+((end-start)/60)+';--lane:'+lane+';--lanes:'+group.lanes.length;
  const compact=end-start<30;
  return action('<strong>'+(assumed?'AI · ':'')+escape(event.title)+'</strong><small>'+time+'</small>',
   'event',event.id,'class="week-event'+(assumed?' assumed':'')+(event.done?' done':'')+(compact?' compact':'')+(conflict?' has-overlap':'')+'" style="'+style+'" aria-label="'+escape(label)+'" title="'+escape(label)+'"');
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
 const lastHour=Math.min(24,Math.max(showNow?Math.max(20,Math.floor(now/60)+1):20,...events.map(event=>Math.ceil(Math.max(minutes(event.end||event.time),minutes(event.time)+24)/60))));
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
  const status=scenario?'Альтернативний сценарій':e.layer==='ai'?'AI-пропозиція':layers[e.layer];
  const content=e.title?'<span><strong>'+escape(e.title)+'</strong><small>'+status+(e.end?' · '+e.time+' – '+e.end:'')+'</small></span>':'';
  const glyph=e.layer==='ai'?'spark':e.layer==='work'?'work':e.id==='e2'?'coffee':e.id==='e3'?'book':'calendar';
  const card=e.title?(scenario?'<div class="card assumed">'+content+'</div>':action(icon(glyph)+content+icon('more'),'event',e.id,'class="card '+type+(e.done?' done':'')+'"')):'<div class="open-slot">Без записів</div>';
  return '<div class="slot '+type+'"><time>'+e.time+'</time><i class="point"></i>'+card+'</div>';
 }).join('')+'</div>';
}
const liveWaves='<svg class="live-waves" viewBox="0 0 804 183" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="wave-color"><stop stop-color="#30283c" stop-opacity=".05"/><stop offset=".45" stop-color="#7040a0" stop-opacity=".35"/><stop offset=".69" stop-color="#d8aaf6"/><stop offset="1" stop-color="#4b286d" stop-opacity=".1"/></linearGradient></defs>'+
 Array.from({length:32},(_,i)=>'<path d="M0 '+(158+i*.9)+' C180 '+(117+i*3)+' 218 '+(231-i)+' 349 '+(178+i*.8)+' S480 '+(157+i*4)+' 544 '+(76-i*.55)+' S675 '+(-36+i*2)+' 804 '+(13+i*.85)+'"/>').join('')+'</svg>';
function liveCard(){
 const confirmed=eventsOn(state.date).filter(e=>e.layer!=='ai');
 const clock=new Date();
 const now=clock.getHours()*60+clock.getMinutes();
 const today=keyOf(clock);
 const current=state.date===today&&confirmed.find(event=>!event.done&&event.end&&minutes(event.time)<=now&&now<minutes(event.end));
 const next=confirmed.find(event=>!event.done&&(event.demo&&state.date===demoDay?event.time>='09:00':state.date>today||state.date===today&&event.time>=clockTime(clock)));
 const ai=eventsOn(state.date).find(e=>e.layer==='ai');
 const variant=state.live==='auto'?(current?'current':next?'upcoming':ai?'idea':confirmed.length?'past':'empty'):state.live;
 const states={
  change:['Зміна в розкладі','Демо · Синхронізацію перенесено з 09:00 на 09:30.','Переглянути приклад','live-info','change'],
  current:[current?.title,current?.time+'–'+current?.end,'Відкрити подію','event',current?.id],
  upcoming:['Попереду · '+(state.live==='auto'?next?.time:'09:30'),state.live==='auto'?next?.title+(next?.demo&&state.date===demoDay?' · Демочас 09:00':''):'Демо · Синхронізація команди.','Переглянути подію','event',state.live==='auto'?next?.id:'e1'],
  idea:[ai?.title||'Можливість для паузи',ai?'Демонстраційна AI-пропозиція · '+ai.time:'Демо · Ідея для 30-хвилинної паузи.','Відкрити можливість',ai?'event':'live-info',ai?.id||'idea'],
  past:['Підтверджені події','У часовій стрічці можна переглянути записи за цей день.','Переглянути календар','nav','calendar'],
  empty:['Є простір для планів.','На цю дату серед видимих шарів немає підтверджених подій.','Приміряти сценарій','nav','parallel']
 };
 const [title,copy,label,act,value]=states[variant];
 const featured=variant==='current'?current:variant==='upcoming'&&state.live==='auto'?next:null;
 const remaining=current?minutes(current.end)-now:0;
 const paused=state.pausedLive?.id===current?.id&&Boolean(current);
 const percent=current?(paused?state.pausedLive.percent:Math.round(100*(now-minutes(current.time))/(minutes(current.end)-minutes(current.time)))):0;
 const progress=variant==='current'?'<div class="live-meter"><div><small>Залишилося</small><strong>'+(paused?state.pausedLive.remaining:remaining)+' хв</strong></div>'+
 iconButton(paused?'play':'pause','live-pause',paused?'Відновити оновлення індикатора':'Призупинити оновлення індикатора',current.id)+
 progressBar(percent,'Прогрес поточної події')+'</div>':textLink(label,act,value);
 return '<div class="live" aria-label="Live Card">'+liveWaves+'<div class="live-copy"><div class="eyebrow"><i class="dot"></i> '+
 (variant==='current'?'Зараз · до '+current.end:featured?(featured.demo&&featured.date<=today&&featured.time<clockTime(clock)?'Деморозклад':'Попереду · '+featured.time):state.live==='auto'?'Огляд дня':'Приклад')+
 '</div><h2>'+escape(featured?.title??title)+'</h2><p>'+escape(featured?featured.time+(featured.end?' – '+featured.end:'')+' · '+layers[featured.layer]:copy)+'</p></div>'+progress+'</div>'+
 '<details class="live-demo"><summary>Стани демо</summary><div class="livebar">'+segment({auto:'Авто',change:'Зміна',upcoming:'Подія',idea:'Ідея',empty:'Порожньо'},state.live,'live','Демонстраційні стани Live Card')+'</div></details>';
}

function agenda(events,title='Часова стрічка',home=false){
 const count=events.filter(e=>e.layer!=='ai').length;
 return '<section class="timeline-area" aria-labelledby="timeline-title"><div class="section-head"><h2 id="timeline-title">'+title+'</h2>'+
 (home?textLink('Усі події','all-events'):'<span class="meta-date">'+shortDate(state.date)+'</span>')+'</div>'+
 '<div class="legend"><span><i class="dot"></i> Підтверджено · '+count+'</span><span><i class="dot ai"></i> AI-пропозиції · '+(events.length-count)+'</span></div>'+timeline(events)+'</section>';
}
function progressBar(percent,label){
 return '<progress max="100" value="'+percent+'" aria-label="'+label+'"></progress>';
}
function dayOverview(events){
 const planned=events.filter(event=>event.layer!=='ai');
 const completed=planned.filter(event=>event.done).length;
 const percent=planned.length?Math.round(100*completed/planned.length):0;
 const rows=[['check','Заплановано подій',planned.length],['spark','AI-пропозиції',events.length-planned.length],['circle','Завершено',completed]];
 return '<section class="day-overview"><div class="overview-heading"><h2 id="context-title">'+icon('chart')+'Огляд дня</h2>'+
 '<div class="progress-ring" style="--percent:'+percent+'%" role="img" aria-label="'+(planned.length?'Завершено '+percent+' відсотків':'Немає запланованих подій')+'"><span>'+(planned.length?percent+'%':'—')+'</span></div></div>'+
 '<dl class="overview-list">'+rows.map(([glyph,label,value])=>'<div><dt>'+icon(glyph)+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl>'+
 progressBar(percent,'Частка завершених запланованих подій')+'</section>';
}
function schedule(weather){
 const home=state.screen==='home', day=state.mode==='day', events=eventsOn(state.date);
 const date=parse(state.date);
 const title=day?shortDate(state.date):state.mode==='month'?months[date.getMonth()]+' '+date.getFullYear():
  shortDate(weekStart(state.date))+' – '+shortDate(plusDays(weekStart(state.date),6));
 const intro=header(day?cap(dateLabel(state.date,{weekday:'long'})):home?'Твій день':'Календар',title);
 const overview=state.mode==='week'?timeGrid():dateGrid();
 const detail=agenda(events,home&&day?'Розклад дня':'Порядок дня',home&&day);
 if(home&&day){
  const confirmed=events.filter(event=>event.layer!=='ai').length;
  const heading=header(cap(dateLabel(state.date,{weekday:'long',day:'numeric',month:'long'})),'Доброго дня!',
   'Заплановано подій: '+confirmed+' · AI-пропозицій: '+(events.length-confirmed));
  return periodControls(weather)+'<div class="home-heading">'+heading+'</div><div class="home-grid workspace"><div class="home-main">'+
   '<div class="day-calendar">'+overview+'</div>'+liveCard()+detail+'</div><aside class="home-context" aria-labelledby="context-title">'+
   dayOverview(events)+'<section class="personal-space"><h2>Твій простір</h2>'+
   action(icon('parallel')+'<span><strong>Parallel Days</strong><small>Порівняй дві версії дня</small></span>'+icon('right'),'nav','parallel','class="context-action"')+
   action(icon('note')+'<span><strong>Швидка нотатка</strong><small>Збережи думку на цей день</small></span>'+icon('right'),'form','note','class="context-action"')+'</section></aside></div>';
 }
 const body=day?'<div class="calendar-day"><div class="day-toolbar">'+overview+
  action(icon('plus')+'Додати подію','form','event','class="secondary"')+'</div>'+timeGrid(true)+
  '<div class="day-agenda">'+detail+'</div></div>':overview;
 return periodControls(weather)+intro+'<div class="calendar-workspace workspace '+(day?'day-workspace':'')+'"><section class="period-overview" aria-label="Огляд періоду">'+body+
  '</section>'+(day?'':'<aside class="day-inspector">'+detail+'</aside>')+'</div>';
}


function timeBalance({busy,free,unknown}){
 return '<dl class="time-balance"><div><dt>Зайнято</dt><dd>'+(unknown?'≥ ':'')+durationLabel(busy)+'</dd></div>'+
  '<div><dt>Вільно</dt><dd>'+(unknown?'≤ ':'')+durationLabel(free)+'</dd></div></dl>'+
  (unknown?'<p class="balance-note">Записи без часу завершення · '+unknown+'</p>':'');
}

function parallel(){
 const choices=plansOn(state.date);
 const plan=choices.find(p=>p.id===state.plan)||choices[0];
 const alternative=choices.find(candidate=>candidate.id!==plan.id);
 const versions=[plan,alternative];
 const times=[...new Set(versions.flatMap(version=>version.items.map(([time])=>time)))].sort();
 const baseline=confirmedOn(state.date);
 const summaries=versions.map(version=>data.appliedPlans.includes(state.date+'/'+version.id)?null:scenarioReport(baseline,version));
 return header('03 / Можливості','Parallel Days','Порівняй сценарій із розкладом · '+shortDate(state.date))+
 '<div class="parallel-date"><label for="scenario-date">Дата порівняння</label><input type="date" id="scenario-date" value="'+state.date+'">'+
 '<label for="scenario-choice">Сценарій</label><select id="scenario-choice">'+choices.map(p=>'<option value="'+escape(p.id)+'"'+(p.id===plan.id?' selected':'')+'>'+escape(p.title)+'</option>').join('')+'</select></div>'+
 '<div class="compare workspace" style="--comparison-slots:'+times.length+';--comparison-rows:'+(times.length+2)+'">'+versions.map((p,index)=>'<section class="context-card"><header class="comparison-head"><div class="section-head"><span class="eyebrow">Версія '+(index?'B':'A')+'</span><span class="badge draft">Симуляція</span></div>'+
 '<h2>'+escape(p.title)+'</h2><p class="muted scenario-copy">'+escape(p.desc)+'</p>'+
 (summaries[index]?'<p class="balance-note">Після додавання · за 24 години</p>'+timeBalance(summaries[index])+
 '<p class="scenario-conflicts'+(summaries[index].conflicts?' has-conflicts':'')+'">Блоки з перетинами · '+summaries[index].conflicts+'</p>':
 '<p class="balance-note">Додано до поточного розкладу</p>')+'</header>'+
 '<ul class="plan-list">'+times.map(time=>{
  const blocks=p.items.filter(([start])=>start===time);
  const other=versions[1-index].items.filter(([start])=>start===time);
  const differs=JSON.stringify(blocks)!==JSON.stringify(other);
  return blocks.length?'<li'+(differs?' class="comparison-difference"':'')+'><time>'+time+'</time><span>'+blocks.map(([,title,end])=>escape(title)+(end?' <small>до '+end+'</small>':'')).join('<br>')+'</span></li>':
   '<li class="comparison-gap" aria-hidden="true"><time>'+time+'</time><span>—</span></li>';
 }).join('')+'</ul><div class="comparison-actions">'+
 action('Переглянути','plan-preview',p.id,'class="secondary"')+
 (data.planEventIds[state.date+'/'+p.id]?action('Скасувати застосування','plan-undo-confirm',p.id,'class="secondary"'):
  action(data.appliedPlans.includes(state.date+'/'+p.id)?'Уже додано':'Додати до календаря','plan-confirm',p.id,
   'class="primary"'+(data.appliedPlans.includes(state.date+'/'+p.id)?' disabled':'')))+'</div></section>').join('')+'</div>'+
 '<details class="baseline"><summary>Поточний розклад · '+baseline.length+'</summary>'+timeBalance(timeSummary(baseline))+
 (baseline.length?timeline(baseline):'<p class="muted">На цю дату немає підтверджених подій.</p>')+'</details>';
}

const settingsRows=[
 ['account','Локальне збереження','Записи в цьому браузері','user'],
 ['sources','Джерела даних','Локальні записи й демонстраційний AI','layers'],
 ['preferences','Демонстраційний режим','Повернення до початкової дати','sliders'],
 ['appearance','Рух інтерфейсу','Анімації та доступність','spark'],
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
 '</div>';
}
function settings(){
 return header('UNFOLD','Налаштування','Дані, джерела й оформлення.')+
 '<div class="settings-layout workspace">'+settingsGroup('Обліковий запис і дані',[0,1,4].map(index=>settingRow(settingsRows[index])).join(''))+
 settingsGroup('Застосунок',[2,3,5].map(index=>settingRow(settingsRows[index])).join(''))+'</div>';
}
export {schedule,parallel,layerPage,settings,miniCalendar,settingsRows,timeBalance};

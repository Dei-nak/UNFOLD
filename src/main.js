import {demoDay,plans,data,state,modes,layers,uid,allEvents,resetData,persist} from './store.js';
import {parse,keyOf,plusDays,dateLabel,cap,shortDate,minutes} from './dates.js';
import {escape,icon,action,iconButton,textLink} from './ui.js';
import {schedule,parallel,layerPage,settings,miniCalendar,settingsRows} from './views.js';
const app = document.querySelector('#app'), nav = document.querySelector('#nav');
const dialog = document.querySelector('#dialog'), toast = document.querySelector('#toast');
const mini = document.querySelector('#mini-calendar'), shell = document.querySelector('.shell');
const labels = {home:'Головна',calendar:'Календар',parallel:'Parallel Days',layers:'Шари',settings:'Налаштування'};
let toastTimer;
function notify(message){toast.textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.textContent='',3000);}
function save(message){
 try {persist();notify(message);}
 catch {notify(message+' · Збережено до закриття сторінки');}
}
function render(animate=false){
 const active=document.activeElement;
 const demoOpen=Boolean(app.querySelector('.live-demo[open]'));
 const weekOffset=app.querySelector('.week-scroll')?.scrollLeft;
 const dayOffset=app.querySelector('.day-scroll')?.scrollTop;
 const restore=active?.dataset?.act&&active.closest('#app')?[active.dataset.act,active.dataset.value]:null;
 const content=state.screen==='parallel'?parallel():state.screen==='layers'?layerPage():state.screen==='settings'?settings():schedule();
 app.innerHTML='<div>'+content+'</div>';
 shell?.classList.toggle('reduce-motion',data.reduceMotion);
 if(mini){
  const control=active?.closest('#mini-calendar')?active.dataset.act:null;
  mini.innerHTML=miniCalendar();
  if(control==='mini-shift')mini.querySelector('[data-act="mini-shift"][data-value="'+active.dataset.value+'"]')?.focus();
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
 if(restore){
  const [act,value]=restore;
  [...app.querySelectorAll('[data-act]')].find(el=>el.dataset.act===act&&el.dataset.value===value)?.focus({preventScroll:true});
 }
}
let opener;
function modal(title,body,variant='',glyph){
 if(!dialog.open)opener=document.activeElement;
 dialog.className='overlay '+variant;
 dialog.innerHTML='<div class="section-head dialog-heading">'+(glyph?'<span class="detail-glyph">'+icon(glyph)+'</span>':'')+
 '<h2 id="dialog-title">'+title+'</h2>'+iconButton('close','close','Закрити')+'</div>'+body;
 if(!dialog.open)dialog.showModal();
 (dialog.querySelector('input:not(.subtask input, .subtask-form input)')||dialog.querySelector('[data-act="close"]'))?.focus();
}
dialog.addEventListener('close',()=>{
 if(dialog.open||document.activeElement?.closest('#nav'))return;
 const fallback=app.querySelector('[data-act="quick"]')||app;
 const replacement=opener?.dataset.act&&[...app.querySelectorAll('[data-act]')].find(item=>
  item.dataset.act===opener.dataset.act&&item.dataset.value===opener.dataset.value);
 (opener?.isConnected?opener:replacement||fallback).focus({preventScroll:true});
});
function quick(){
 modal('Швидкі дії','<p class="muted">'+shortDate(state.date)+'</p><div class="list">'+
 [['note','Зберегти думку','Одна фраза в локальних нотатках','note'],['event','Додати подію','Підтверджений запис у вибраний день','calendar'],['scenario','Створити сценарій','Окрема версія дня','parallel']].map(([key,title,desc,glyph])=>
 action('<span class="action-glyph">'+icon(glyph)+'</span><span><h3>'+title+'</h3><p>'+desc+'</p></span>'+icon('right'),'form',key,'class="row quick-row"')).join('')+'</div>','quick-sheet');
}
function form(kind){
 const isNote=kind==='note',isEvent=kind==='event';
 const title=isNote?'Зберегти думку':isEvent?'Додати подію':'Створити сценарій';
 modal(title,'<p class="muted">'+cap(dateLabel(state.date,{dateStyle:'full'}))+'</p><form data-kind="'+kind+'"><label>'+(isNote?'Думка':'Назва')+'<input name="title" required maxlength="100" placeholder="'+(isNote?'Напиши кілька слів…':'Наприклад, час для читання')+'"></label>'+
 (isNote?'':'<label>'+(isEvent?'Початок':'Час першого блоку')+'<input type="time" name="time" value="15:00" required></label>')+
 (isEvent?'<label>Кінець (необов’язково)<input type="time" name="end"></label>':'')+
 '<button class="primary" type="submit">Зберегти</button></form>','quick-sheet');
}
function eventDetail(id){
 const e=allEvents().find(e=>e.id===id);
 if(!e)return;
 const assumed=e.layer==='ai';
 const overlaps=assumed&&allEvents().some(other=>other.date===e.date&&other.layer!=='ai'&&other.time<(e.end||e.time)&& (other.end?other.end>e.time:other.time>=e.time));
 const duration=e.end?minutes(e.end)-minutes(e.time):0;
 const status=assumed?'AI-пропозиція · Не підтверджено':(e.done?'Завершено':'Підтверджено')+' · '+layers[e.layer];
 const subtasks=e.subtasks??[];
 const related=assumed?[]:allEvents().filter(item=>item.id!==id&&item.date===e.date&&item.layer===e.layer&&data.layers[item.layer]);
 modal(escape(e.title),'<p class="detail-status '+(assumed?'draft':'')+'">'+status+(e.demo?' · Демодані':'')+'</p>'+
 '<div class="detail-facts"><span>'+icon('calendar')+shortDate(e.date)+'</span><span>'+icon('clock')+e.time+(e.end?'–'+e.end:'')+'</span>'+(duration?'<strong>'+duration+' хв</strong>':'')+'</div>'+
 (overlaps?'<p class="conflict">Цей час перетинається з підтвердженою подією.</p>':'')+
 '<div class="detail-actions">'+(assumed?action('Додати як підтверджену подію','accept',id,'class="primary"'):
 action(icon('check')+(e.done?'Відновити подію':'Позначити завершеною'),'complete',id,'class="primary"')+
 action('Редагувати','edit-event',id,'class="secondary"'))+'</div>'+
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
  preferences:'Керуй видимістю робочих, особистих і демонстраційних записів у шарах.',
  appearance:'Світла тема UNFOLD. За потреби можна вимкнути переходи між екранами.',
  privacy:'Події, підзавдання, думки й сценарії зберігаються в цьому браузері для локальної адреси UNFOLD.',
  about:'UNFOLD 0.1.0 · Локальний планувальник і простір для порівняння сценаріїв дня.'
 };
 const extras={
  sources:textLink('Відкрити шари','nav','layers'),
  preferences:textLink('Відкрити шари','nav','layers')+'<br>'+textLink('Повернутися до демодня','today'),
  appearance:action('Зменшити рух <span class="toggle" aria-hidden="true"></span>','motion',undefined,'class="row" aria-pressed="'+data.reduceMotion+'"'),
  privacy:textLink('Збережені думки','notes')+'<br>'+textLink('Скинути демо','reset-confirm')
 };
 modal(title,'<p class="muted">'+content[key]+'</p>'+(extras[key]||''));
}

let pendingPlan;
function planDialog(id,confirm){
 const plan=[...plans,...data.plans].find(item=>item.id===id&&(!item.date||item.date===state.date));
 if(!plan)return;
 const date=state.date;
 const applied=data.appliedPlans.includes(date+'/'+id);
 pendingPlan=confirm&&!applied?{plan,date}:null;
 const message=applied?'Цей сценарій уже додано на вибрану дату.':confirm?'Блоки стануть новими подіями. Поточні записи залишаться в календарі.':'Попередній перегляд. Календар залишиться без змін.';
 modal(escape(plan.title),'<div class="preview-note"><span class="eyebrow">Симуляція · '+shortDate(date)+'</span><p>'+message+'</p></div>'+
 '<ul class="plan-list preview-list">'+plan.items.map(([time,title])=>'<li><time>'+time+'</time><span>'+escape(title)+'</span></li>').join('')+'</ul>'+
 (pendingPlan?action('Підтвердити додавання','plan-apply',id,'class="primary"'):''),'scenario-sheet','parallel');
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
document.addEventListener('click',event=>{
 const button=event.target.closest('button[data-act]');
 if(!button)return;
 const {act,value}=button.dataset;
 switch(act){
 case 'nav': if(dialog.open)dialog.close();go(value);break;
 case 'mode': state.mode=value;modes[state.screen]=value;render(true);break;
 case 'date':
 case 'mini-date': {
  const openDay=act==='mini-date'||state.mode==='month';
  state.date=value;state.miniMonth=null;state.live='auto';
  if(act==='mini-date'&&!modes[state.screen]){state.screen='calendar';}
  if(openDay){state.mode='day';modes[state.screen]='day';}
  render(openDay);
  if(openDay)app.focus?.({preventScroll:true});
  break;
 }
 case 'shift': shift(Number(value));state.miniMonth=null;state.live='auto';render(true);break;
 case 'mini-shift': {
  const date=parse(state.miniMonth||state.date);
  state.miniMonth=keyOf(new Date(date.getFullYear(),date.getMonth()+Number(value),1,12));
  render();break;
 }
 case 'current-date': {
  state.date=keyOf(new Date());state.miniMonth=null;state.live='auto';render(true);
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
  data.events=[...data.events,...plan.items.map(([time,title])=>({id:uid(),date,time,title,layer:'personal',detail:'Додано зі сценарію «'+plan.title+'».'}))];
  data.appliedPlans=[...data.appliedPlans,date+'/'+value];
  data.layers={...data.layers,personal:true};
  dialog.close();save('Сценарій додано до календаря');render();break;
 }
 case 'quick': quick();break;
 case 'form': form(value);break;
 case 'close': dialog.close();break;
 case 'event': eventDetail(value);break;
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
 case 'today': if(dialog.open)dialog.close();modes.home='day';state.date=demoDay;state.miniMonth=null;state.live='auto';go('home');break;
 case 'reset-confirm': modal('Скинути демо?','<p>Власні події, думки, сценарії та налаштування шарів буде видалено.</p>'+action('Скинути демо','reset',undefined,'class="primary"'));break;
 case 'reset': modes.home='day';modes.calendar='month';resetData();state.date=demoDay;state.live='auto';state.plan='focus';dialog.close();save('Початкові демодані відновлено');go('home');break;
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
 const form=event.target, fields=new FormData(form), title=fields.get('title').trim(), time=fields.get('time'), end=fields.get('end');
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
 data.plans=[...data.plans,{id,title,date:state.date,desc:'Твій сценарій',items:[[time,title]]}];
 state.plan=id;dialog.close();save('Сценарій створено');go('parallel');
});

app.addEventListener('change',event=>{
 if(event.target.id==='scenario-choice'){
  state.plan=event.target.value;render(true);
  app.querySelector('#scenario-choice')?.focus({preventScroll:true});return;
 }
 if(event.target.id!=='scenario-date'||!event.target.value)return;
 state.date=event.target.value;
 state.live='auto';
 render(true);
 app.querySelector('#scenario-date')?.focus({preventScroll:true});
});
document.addEventListener('keydown',event=>{
 if(event.defaultPrevented||dialog.open||event.repeat||!event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input, textarea, select, [contenteditable]'))return;
 if(event.code==='KeyN'){
  event.preventDefault();
  app.querySelector('[data-act="quick"]')?.focus();
  quick();
 }
});
render();

import {overlaps,timeSummary} from './dates.js';

const demoDay = '2026-11-08';
const seed = [
 {id:'e1',date:demoDay,time:'09:30',end:'10:15',title:'Синхронізація команди',layer:'work',detail:'Коротко звірити пріоритети на наступний тиждень.'},
 {id:'e2',date:demoDay,time:'13:00',end:'13:45',title:'Обід із Мартою',layer:'personal',detail:'Зустріч у кав’ярні біля парку.'},
 {id:'a1',date:demoDay,time:'15:00',end:'15:30',title:'Прогулянка в парку',layer:'ai',detail:'Можливий 30-хвилинний варіант, якщо тобі зручно. Доступність часу невідома.'},
 {id:'e3',date:demoDay,time:'17:30',end:'18:00',title:'Повернути книжки',layer:'personal',detail:'Занести книжки в бібліотеку до закриття.'},
 {id:'e4',date:'2026-11-05',time:'11:00',end:'12:00',title:'Огляд концепції',layer:'work',detail:'Переглянути чернетки інтерфейсу.'},
 {id:'e5',date:'2026-11-07',time:'10:00',end:'11:00',title:'Сніданок із друзями',layer:'personal',detail:'Зустріч у центрі.'},
 {id:'e6',date:'2026-11-10',time:'14:00',end:'15:00',title:'Робоча сесія',layer:'work',detail:'Узгодити наступні кроки.'},
 {id:'e7',date:'2026-11-12',time:'18:30',end:'19:30',title:'Тренування',layer:'personal',detail:'Вечірня група.'}
];
const plans = [
 {id:'focus',title:'День фокусу',desc:'Два блоки для роботи над однією справою.',items:[['10:30','Зосереджена робота','12:00'],['15:00','Підбити підсумки','15:30']]},
 {id:'slow',title:'Повільний день',desc:'Більше місця для відпочинку й пауз.',items:[['10:30','Кава без поспіху','11:00'],['15:00','Прогулянка в парку','15:30']]},
 {id:'social',title:'День для людей',desc:'Час на розмову й спільні плани.',items:[['11:00','Подзвонити друзям','11:30'],['16:00','Зустрітися на каву','17:00']]}
];
const defaults = {events:[],notes:[],plans:[],accepted:[],hiddenDemoEvents:[],eventUpdates:{},appliedPlans:[],planEventIds:{},reduceMotion:false,layers:{work:true,personal:true,ai:true}};
function readData(){
 try {const saved=JSON.parse(localStorage.getItem('unfold-v1'));
  return {...defaults,...saved,layers:{...defaults.layers,...saved?.layers}};}
 catch {return structuredClone(defaults);}
}
let data = readData();
let state = {screen:'home',mode:'day',date:demoDay,live:'auto',plan:'focus'};
const modes={home:'day',calendar:'month'};
const layers = {work:'Робота',personal:'Особисте',ai:'AI-пропозиції'};
const uid = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)+Math.random().toString(36).slice(2);
const allEvents = () => [
 ...seed.filter(event=>!data.accepted.includes(event.id)&&!data.hiddenDemoEvents.includes(event.id)).map(event=>({...event,demo:true})),
 ...data.events
].map(event=>({...event,...data.eventUpdates[event.id]}));
const eventsOn = key => allEvents().filter(e=>e.date===key && data.layers[e.layer]).sort((a,b)=>a.time.localeCompare(b.time));
const confirmedOn = key => allEvents().filter(event=>event.date===key&&event.layer!=='ai').sort((a,b)=>a.time.localeCompare(b.time));
const plansOn = key => [...plans,...data.plans.filter(plan=>!plan.date||plan.date===key)];
const planBlocks = plan => plan.items.map(([time,title,end])=>({time,title,end}));
function scenarioReport(baseline,plan){
 const blocks=planBlocks(plan);
 const rows=blocks.map((block,index)=>({...block,conflicts:[
  ...baseline.filter(event=>overlaps(block,event)),
  ...blocks.filter((event,other)=>other!==index&&overlaps(block,event))
 ]}));
 return {rows,conflicts:rows.filter(row=>row.conflicts.length).length,...timeSummary([...baseline,...blocks])};
}
function removeEvent(event){
 if(event.demo)data.hiddenDemoEvents=[...data.hiddenDemoEvents,event.id];
 else data.events=data.events.filter(item=>item.id!==event.id);
 delete data.eventUpdates[event.id];
}
function resetData(){data=structuredClone(defaults);}
function persist(){localStorage.setItem('unfold-v1',JSON.stringify(data));}
export {demoDay,plans,data,state,modes,layers,uid,allEvents,eventsOn,confirmedOn,plansOn,planBlocks,scenarioReport,removeEvent,resetData,persist};

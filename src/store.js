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
 {id:'focus',title:'День фокусу',desc:'Два блоки для роботи над однією справою.',items:[['10:30','Зосереджена робота'],['15:00','Підбити підсумки']]},
 {id:'slow',title:'Повільний день',desc:'Більше місця для відпочинку й пауз.',items:[['10:30','Кава без поспіху'],['15:00','Прогулянка в парку']]},
 {id:'social',title:'День для людей',desc:'Час на розмову й спільні плани.',items:[['11:00','Подзвонити друзям'],['16:00','Зустрітися на каву']]}
];
const defaults = {events:[],notes:[],plans:[],accepted:[],eventUpdates:{},appliedPlans:[],reduceMotion:false,layers:{work:true,personal:true,ai:true}};
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
 ...seed.filter(event=>!data.accepted.includes(event.id)).map(event=>({...event,demo:true})),
 ...data.events
].map(event=>({...event,...data.eventUpdates[event.id]}));
const eventsOn = key => allEvents().filter(e=>e.date===key && data.layers[e.layer]).sort((a,b)=>a.time.localeCompare(b.time));
function resetData(){data=structuredClone(defaults);}
function persist(){localStorage.setItem('unfold-v1',JSON.stringify(data));}
export {demoDay,plans,data,state,modes,layers,uid,allEvents,eventsOn,resetData,persist};

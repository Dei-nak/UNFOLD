import assert from 'node:assert/strict';
import test from 'node:test';

const listeners = {};
const app = {
  innerHTML: '',
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: (name, fn) => { listeners['app-' + name] = fn; },
};
const nav = { ...app };
const searchResults = { innerHTML: '' };
const dialog = {
  ...app,
  querySelector: selector => selector === '#search-results' ? searchResults : null,
  open: false,
  addEventListener(name, fn) { listeners['dialog-' + name] = fn; },
  showModal() { this.open = true; },
  close() { this.open = false; },
};
const elements = { '#app': app, '#nav': nav, '#dialog': dialog, '#toast': {} };
const storage = new Map();

globalThis.document = {
  activeElement: null,
  querySelector: selector => elements[selector],
  addEventListener: (name, fn) => { listeners[name] = fn; },
};
const intervals = new Map();
globalThis.window = { scrollTo() {}, setInterval(fn, delay) { intervals.set(delay, fn); } };
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
});
globalThis.FormData = class {
  constructor(form) { return new Map(Object.entries(form.values)); }
};

const store = await import('./src/store.js');
await import('./src/main.js');
const click = (act, value) => listeners.click({ target: { closest: () => ({ dataset: { act, value } }) } });
click('demo-day');

test('Today follows midnight while manual calendar selection stays pinned', t => {
  t.mock.timers.enable({apis:['Date'],now:new Date(2026,11,31,23,59)});
  click('current-date');
  intervals.get(1000)();
  assert.equal(store.state.date,'2026-12-31');
  t.mock.timers.setTime(new Date(2027,0,1,0,0).getTime());
  intervals.get(1000)();
  assert.equal(store.state.date,'2027-01-01');
  assert.match(app.innerHTML,/data-act="current-date" class="today-button" aria-pressed="true"/);
  click('mini-date','2026-12-29');
  t.mock.timers.setTime(new Date(2027,0,2,0,0).getTime());
  intervals.get(1000)();
  assert.equal(store.state.date,'2026-12-29');
  assert.match(app.innerHTML,/data-act="current-date" class="today-button" aria-pressed="false"/);
  click('demo-day');
});

test('the live card times a real event but gives demo events no countdown', t => {
  t.mock.timers.enable({apis:['Date'],now:new Date(2026,10,8,9,45)});
  click('today');
  assert.match(app.innerHTML, /Синхронізація команди/);
  assert.doesNotMatch(app.innerHTML, /data-act="live-pause"/);
  const event = {id:'live-test',date:store.demoDay,time:'09:30',end:'10:00',title:'Реальна подія',layer:'work'};
  store.data.events.push(event);
  try {
    click('live','auto');
    assert.match(app.innerHTML, /data-act="event" data-value="live-test" class="icon live-open" aria-label="Відкрити подію"/);
    assert.match(app.innerHTML, /data-act="live-pause" data-value="live-test"/);
    assert.match(app.innerHTML, /value="50" aria-label="Прогрес поточної події"/);
  } finally {
    store.data.events.pop();
    click('today');
  }
});

test('dashboard statistics reflect actual completion, and search opens matching records', () => {
  assert.match(app.innerHTML, /Завершено 0 відсотків/);
  click('event', 'e1');
  click('complete', 'e1');
  assert.match(app.innerHTML, /Завершено 33 відсотків/);
  assert.match(app.innerHTML, /<progress max="100" value="33"/);
  click('complete', 'e1');
  click('close');

  click('search');
  const search = value => listeners['dialog-input']({target:{id:'local-search',value}});
  search('  СИНХРОНІЗАЦІЯ  ');
  assert.match(searchResults.innerHTML, /data-act="event" data-value="e1"/);
  click('event', 'e1');
  assert.match(dialog.innerHTML, /Синхронізація команди/);
  click('search');
  search('Повільний');
  assert.match(searchResults.innerHTML, /data-act="plan-result" data-value="slow"/);
  search('немає такого запису');
  assert.match(searchResults.innerHTML, /Нічого не знайдено/);
  click('close');
});

test('navigation, calendar views and date movement', () => {
  assert.match(app.innerHTML, /Розклад дня/);
  assert.match(app.innerHTML, /Live Card/);
  click('nav', 'calendar');
  assert.match(app.innerHTML, /month-grid/);
  click('mode', 'week');
  assert.equal((app.innerHTML.match(/class="week-day"/g) ?? []).length, 7);
  assert.match(app.innerHTML, /<time>09:00<\/time>/);
  assert.match(app.innerHTML, /data-value="e1" class="week-event" style="--start:1.5;--length:0.75/);
  assert.match(app.innerHTML, /data-value="e3" class="week-event"/);
  assert.match(app.innerHTML, /data-value="a1" class="week-event assumed"/);
  click('shift', '1');
  assert.equal(store.state.date, '2026-11-15');
  click('nav', 'home');
  assert.equal(store.state.mode, 'day');
  click('nav', 'calendar');
  assert.equal(store.state.mode, 'week');
  click('date', store.demoDay);
});

test('AI preview keeps calendar intact; confirmation is saved once', () => {
  click('event', 'a1');
  assert.match(dialog.innerHTML, /Додати як підтверджену подію/);
  assert.equal(store.eventsOn(store.demoDay).filter(event => event.layer === 'ai').length, 1);
  click('accept', 'a1');
  click('accept', 'a1');
  const records = store.allEvents().filter(event => event.title === 'Прогулянка в парку');
  assert.equal(records.length, 1);
  assert.equal(records[0].layer, 'personal');
  assert.deepEqual(JSON.parse(storage.get('unfold-v1')).accepted, ['a1']);
});

test('quick actions create events, thoughts and dated scenarios', () => {
  function submit(kind, values) {
    listeners['dialog-submit']({ preventDefault() {}, target: { dataset: { kind }, values } });
  }
  click('quick');
  click('form', 'event');
  assert.match(dialog.innerHTML, /name="end"/);
  submit('event', { title: 'Робочий блок', time: '11:00', end: '12:00' });
  assert.ok(store.eventsOn(store.demoDay).some(event => event.title === 'Робочий блок' && event.end === '12:00'));
  submit('note', { title: 'Думка' });
  assert.equal(store.data.notes.at(-1).title, 'Думка');
  const eventCount = store.allEvents().length;
  submit('scenario', { title: 'Чернетка', time: '15:30' });
  assert.equal(store.data.plans.at(-1).date, store.demoDay);
  assert.match(app.innerHTML, /Поточний розклад/);
  assert.equal(store.allEvents().length, eventCount);
});

test('month dates open the day grid and confirmed event details persist changes', () => {
  click('nav', 'calendar');
  click('mode', 'month');
  click('date', store.demoDay);
  assert.equal(store.state.mode, 'day');
  assert.match(app.innerHTML, /class="day-grid"/);
  click('event', 'e1');
  assert.match(dialog.innerHTML, /45 хв/);
  click('complete', 'e1');
  listeners['dialog-submit']({
    preventDefault() {},
    target: { dataset: { kind: 'subtask', id: 'e1' }, values: { title: 'Звірити пріоритети' } },
  });
  listeners['dialog-change']({ target: { dataset: { event: 'e1', index: '0' }, checked: true } });
  click('edit-event', 'e1');
  listeners['dialog-submit']({
    preventDefault() {},
    target: { dataset: { kind: 'edit', id: 'e1' }, values: {
      title: 'Оновлена зустріч', date: store.demoDay, time: '09:45', end: '10:30', detail: 'Оновлений опис',
    } },
  });
  const updated = JSON.parse(storage.get('unfold-v1')).eventUpdates.e1;
  assert.equal(updated.done, true);
  assert.equal(updated.title, 'Оновлена зустріч');
  assert.equal(updated.subtasks[0].done, true);
});

test('scenario preview and confirmation leave events intact until apply', () => {
  click('nav', 'parallel');
  const count = store.allEvents().length;
  click('plan-preview', 'focus');
  click('plan-apply', 'focus');
  assert.equal(store.allEvents().length, count);
  click('plan-confirm', 'focus');
  assert.equal(store.allEvents().length, count);
  click('plan-apply', 'focus');
  click('plan-confirm', 'focus');
  click('plan-apply', 'focus');
  assert.equal(store.allEvents().length, count + 2);
  assert.ok(store.allEvents().some(event => event.id === 'e1'));
});

test('overlapping events only split the width of their own time group', () => {
  store.data.events.push({id:'overlap',date:store.demoDay,time:'09:55',end:'10:15',title:'Перетин',layer:'work'});
  try {
    click('nav', 'calendar');
    click('mode', 'day');
    assert.match(app.innerHTML, /data-value="e1"[^>]+--lane:0;--lanes:2/);
    assert.match(app.innerHTML, /data-value="overlap"[^>]+--lane:1;--lanes:2/);
    assert.match(app.innerHTML, /data-value="e3"[^>]+--lane:0;--lanes:1/);
  } finally {
    store.data.events=store.data.events.filter(event=>event.id!=='overlap');
  }
});

test('scenario reports merge intervals and preserve uncertainty for older blocks', () => {
  const baseline=[{time:'09:00',end:'10:00',title:'Ранкова зустріч'},{time:'09:30',end:'11:00',title:'Робочий блок'}];
  const report=store.scenarioReport(baseline,{items:[['10:45','Перетин','11:30'],['11:30','Запис без кінця']]});
  assert.equal(report.busy,150);
  assert.equal(report.free,1290);
  assert.equal(report.unknown,1);
  assert.equal(report.conflicts,1);
  assert.equal(report.rows[0].conflicts[0].title,'Робочий блок');
});

test('undo removes only records created by the selected application', () => {
  const key=store.demoDay+'/focus';
  const created=store.data.planEventIds[key];
  assert.equal(created.length,2);
  const unrelated=store.data.events.filter(event=>!created.includes(event.id)).map(event=>event.id);
  click('plan-preview','focus');
  click('plan-undo',key);
  assert.ok(store.data.appliedPlans.includes(key));
  click('plan-undo-confirm','focus');
  click('plan-undo',key);
  assert.deepEqual(store.data.events.map(event=>event.id),unrelated);
  assert.equal(store.data.appliedPlans.includes(key),false);
  assert.equal(JSON.parse(storage.get('unfold-v1')).planEventIds[key],undefined);
});

test('deletion requires confirmation and persists for local and demo events', () => {
  const local=store.data.events.find(event=>event.title==='Робочий блок');
  click('event',local.id);
  click('event-delete',local.id);
  assert.ok(store.allEvents().some(event=>event.id===local.id));
  for(const id of [local.id,'e3']){
    click('event-delete-confirm',id);
    click('event-delete',id);
    assert.ok(!store.allEvents().some(event=>event.id===id));
  }
  const saved=JSON.parse(storage.get('unfold-v1'));
  assert.ok(!saved.events.some(event=>event.id===local.id));
  assert.ok(saved.hiddenDemoEvents.includes('e3'));
});

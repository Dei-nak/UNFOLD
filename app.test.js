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
const dialog = {
  ...app,
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
globalThis.window = { scrollTo() {} };
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
});
globalThis.FormData = class {
  constructor(form) { return new Map(Object.entries(form.values)); }
};

const store = await import('./src/store.js');
await import('./src/main.js');
const click = (act, value) => listeners.click({ target: { closest: () => ({ dataset: { act, value } }) } });

test('navigation, calendar views and date movement', () => {
  assert.match(app.innerHTML, /Часова стрічка/);
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

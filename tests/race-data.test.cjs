const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const snapshot = JSON.parse(fs.readFileSync('docs/data/race_status.json'));
const catalog = JSON.parse(fs.readFileSync('docs/data/circuits.json'));
const source = fs.readFileSync('docs/js/race-data.js', 'utf8');
function setup(fetch = async () => { throw Error('offline'); }) {
  let tick, visible;
  const context = {fetch, AbortSignal, console: {warn() {}}, setInterval(fn) {tick = fn;}, document: {hidden: false, addEventListener(_, fn) {visible = fn;}}};
  vm.createContext(context);vm.runInContext(source, context);
  return {api: context.F1RaceData, context, tick: () => tick(), visible: () => visible()};
}
function feed(races, total = races.length) {return {MRData: {total: String(total), RaceTable: {season: '2026', Races: races}}};}
function winner(round) {return {...snapshot.schedule.find(r => Number(r.round) === round), Results: [{position: '1', laps: '56'}]};}
const schedule = feed(snapshot.schedule);
const results = feed(snapshot.completedRounds.map(winner));

test('all scheduled venues have closed real circuit paths and Formula Timer guides', () => {
  for (const race of snapshot.schedule) {
    const track = catalog[race.Circuit.circuitId];assert.ok(track, race.Circuit.circuitId);
    assert.match(track.path, /^M.* Z$/);assert(!track.path.includes('NaN'));
    assert.match(track.guide, /^https:\/\/formula-timer.com\/circuit\//);
    const coordinates = [...track.path.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(m=>m.slice(1).map(Number));
    assert(coordinates.length > 50);
    assert(coordinates.every(([x,y]) => x >= 20 && x <= 520 && y >= 10 && y <= 310));
    assert(Math.hypot(coordinates[0][0]-coordinates.at(-1)[0], coordinates[0][1]-coordinates.at(-1)[1]) < 5);
  }
});
test('relocated Bahrain GP resolves Sepang, not Sakhir', () => {
  const {api} = setup();const state=api.fromResponses(schedule,results,Date.parse('2026-10-01T12:00:00Z'));
  assert.equal(api.selectNextRace(state).Circuit.circuitId,'sepang');
});
test('waits through delays and red flags; advances only on published result', () => {
  const {api}=setup();const now=Date.parse('2026-10-05T12:00:00Z');
  assert.equal(api.selectNextRace(api.fromResponses(schedule,results,now)).round,'16');
  assert.equal(api.selectNextRace(api.fromResponses(schedule,feed([...results.MRData.RaceTable.Races,winner(16)]),now)).Circuit.circuitId,'marina_bay');
});
test('ignores future or empty results and handles season completion', () => {
  const {api}=setup();
  const all=feed(snapshot.schedule.map(r=>winner(Number(r.round))));
  assert.equal(api.selectNextRace(api.fromResponses(schedule,all,Date.parse('2026-10-01T12:00:00Z'))).round,'16');
  assert.equal(api.selectNextRace(api.fromResponses(schedule,all,Date.parse('2026-12-31T12:00:00Z'))),null);
  assert.equal(api.selectNextRace(api.fromResponses(schedule,feed([...results.MRData.RaceTable.Races,{...winner(16),Results:[]}]),Date.parse('2026-10-05T12:00:00Z'))).round,'16');
});
test('rejects truncated schedule and wrong-season data', () => {
  const {api}=setup();assert.throws(()=>api.fromResponses(feed(snapshot.schedule.slice(1),23),results));
  const wrong=structuredClone(schedule);wrong.MRData.RaceTable.season='2025';assert.throws(()=>api.fromResponses(wrong,results));
});
test('offline snapshot is retained and minute/visibility refresh recovers without regression',async () => {
  let offline=true;let requests=0;const next=structuredClone(snapshot);next.completedRounds.push(16);
  const s=setup(async url=> {requests++;if(url.startsWith('data/'))return {ok:true,json:async()=>structuredClone(offline?snapshot:next)};throw Error('offline');});
  let latest;s.api.subscribe(value=>latest=value);await s.api.refresh();assert.equal(latest.nextRace.round,'16');assert.equal(latest.live,false);
  offline=false;await s.api.refresh();assert.equal(latest.nextRace.round,'17');
  offline=true;await s.api.refresh();assert.equal(latest.nextRace.round,'17');
  const before=requests;s.context.document.hidden=true;s.tick();assert.equal(requests,before);
  s.context.document.hidden=false;s.visible();await s.api.refresh();assert(requests>before);
});
test('calendar updates track with race, does not restart unchanged animation, escapes feed text', () => {
  let listener;let renders=0;const status={textContent:''};let html='';
  const root={get innerHTML(){return html},set innerHTML(value){html=value;renders++}};
  const ctx={document:{getElementById:id=>id==='calendar'?root:status},console,fetch:()=>new Promise(()=>{}),F1RaceData:{subscribe(fn){listener=fn}}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('docs/js/schedule.js','utf8'),ctx);
  vm.runInContext('circuitCatalog = '+JSON.stringify(catalog),ctx);
  const state=structuredClone(snapshot);state.nextRace=state.schedule[15];state.live=true;
  listener(state);assert(html.includes(catalog.sepang.path));assert(!html.includes('track-glow'));
  listener(state);assert.equal(renders,1);
  state.completedRounds.push(16);state.nextRace=state.schedule[16];listener(state);
  assert(html.includes(catalog.marina_bay.path));assert(!html.includes(catalog.sepang.path));
  state.nextRace.raceName='<img src=x onerror=alert(1)>';listener(state);assert(!html.includes('<img src=x'));assert(html.includes('&lt;img'));
  state.completedRounds=state.schedule.map(r=>Number(r.round));state.nextRace=null;listener(state);assert(html.includes('Season complete'));assert(!html.includes('<animateMotion'));
});

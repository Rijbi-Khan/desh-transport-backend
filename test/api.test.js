// 🧪 ডাটাবেজ ছাড়া API টেস্ট — মডেলের মেথড stub করে নিরাপত্তা ও লজিক যাচাই
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);

const app = require('../server');
const Admin = require('../models/Admin');
const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const TripApplication = require('../models/TripApplication');
const TripHistory = require('../models/TripHistory');
const { signToken } = require('../utils/auth');

const adminId = new mongoose.Types.ObjectId();
const driverId = new mongoose.Types.ObjectId();
const adminToken = signToken(adminId, 'admin');
const driverToken = signToken(driverId, 'driver');

let server, base;
// জায়গার নাম API (Nominatim) এর নকল
const realFetch = global.fetch;
global.fetch = (url, opts) => String(url).includes('nominatim')
  ? Promise.resolve(new Response(JSON.stringify({ address: { town: 'ঘোড়াশাল', county: 'পলাশ উপজেলা', state_district: 'নরসিংদী জেলা' } }), { status: 200 }))
  : realFetch(url, opts);
test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  // ইউজার খোঁজার stub
  Admin.findById = async (id) => (String(id) === String(adminId) ? { _id: adminId, name: 'A', phone: '01700000000' } : null);
  Driver.findById = async (id) => (String(id) === String(driverId) ? {
    _id: driverId, driverName: 'D', phone: '01711111111', truckType: 'Truck', truckCapacity: 5, vehicleBody: 'open', currentLocation: {}
  } : null);
});
test.after(() => server.close());

const call = (method, path, { token, body, headers = {} } = {}) =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

test('protected routes reject requests without a token', async () => {
  const routes = [
    ['GET', '/api/drivers/all'],
    ['DELETE', `/api/drivers/${driverId}`],
    ['POST', '/api/drivers/location'],
    ['GET', '/api/drivers/history'],
    ['GET', `/api/drivers/history/${driverId}`],
    ['POST', '/api/trips/add'],
    ['POST', '/api/trips/apply-trip'],
    ['GET', `/api/trips/applications/${driverId}`],
    ['POST', '/api/trips/confirm-driver'],
    ['DELETE', `/api/trips/${driverId}`],
    ['GET', '/api/trips/history/last-7-days'],
    ['GET', '/api/admin/me'],
    ['GET', '/api/trips/running'],
    ['POST', `/api/trips/${driverId}/cancel`],
    ['POST', `/api/trips/${driverId}/complete`],
  ];
  for (const [m, p] of routes) {
    const r = await call(m, p, { body: m === 'GET' || m === 'DELETE' ? undefined : {} });
    assert.strictEqual(r.status, 401, `${m} ${p} returned ${r.status}`);
  }
});

test('driver token cannot use admin routes', async () => {
  for (const [m, p] of [['GET', '/api/drivers/all'], ['POST', '/api/trips/add'], ['POST', '/api/trips/confirm-driver'], ['DELETE', `/api/drivers/${driverId}`]]) {
    const r = await call(m, p, { token: driverToken, body: m === 'POST' ? {} : undefined });
    assert.strictEqual(r.status, 403, `${m} ${p}`);
  }
});

test('admin token cannot use driver routes', async () => {
  const r = await call('POST', '/api/trips/apply-trip', { token: adminToken, body: {} });
  assert.strictEqual(r.status, 403);
});

test('forged / expired token is rejected', async () => {
  const jwt = require('jsonwebtoken');
  const bad = jwt.sign({ id: String(adminId), role: 'admin' }, 'wrong-secret');
  assert.strictEqual((await call('GET', '/api/drivers/all', { token: bad })).status, 401);
  const expired = jwt.sign({ id: String(adminId), role: 'admin' }, 'test-secret', { expiresIn: -10 });
  assert.strictEqual((await call('GET', '/api/drivers/all', { token: expired })).status, 401);
});

test('admin/create is closed without setup key', async () => {
  const r = await call('POST', '/api/admin/create', { body: { name: 'x', phone: '01700000000', password: '12345678' } });
  assert.strictEqual(r.status, 403);
});

test('NoSQL operator injection in login is refused', async () => {
  const r1 = await call('POST', '/api/admin/login', { body: { phone: { $ne: null }, password: 'x' } });
  assert.strictEqual(r1.status, 400);
  const r2 = await call('POST', '/api/drivers/login', { body: { phone: { $gt: '' }, password: { $ne: 1 } } });
  assert.strictEqual(r2.status, 400);
});

test('trip add validates cargoDetails with a clear message', async () => {
  const r = await call('POST', '/api/trips/add', {
    token: adminToken,
    body: { from: 'ঢাকা', to: 'চট্টগ্রাম', cargoDetails: '', requiredVehicleBody: 'open', fixedPrice: 5000, pickupTime: 'x' },
  });
  assert.strictEqual(r.status, 400);
  assert.match(r.body.message, /মালামাল/);
});

test('driver login returns fields the frontend reads', async () => {
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('secret1', 4);
  const orig = Driver.findOne;
  Driver.findOne = (filter) => ({
    select: async () => {
      // phone ফিল্টার trusted $in হওয়া উচিত (+88 ফরম্যাটও মিলবে)
      assert.ok(filter.phone.$in.includes('01711111111'));
      return { _id: driverId, driverName: 'D', phone: '01711111111', truckType: 'Truck', truckCapacity: 5, vehicleBody: 'open', passwordHash: hash };
    },
  });
  const r = await call('POST', '/api/drivers/login', { body: { phone: '+8801711111111', password: 'secret1' } });
  Driver.findOne = orig;
  assert.strictEqual(r.status, 200);
  for (const k of ['id', '_id', 'driverName', 'truckType', 'phone']) assert.ok(r.body.driver[k], `missing ${k}`);
  // টোকেন দিয়ে ড্রাইভার রাউটে ঢোকা যায়
  const me = await call('GET', '/api/drivers/me', { token: r.body.token });
  assert.strictEqual(me.status, 200);
});

test('apply-trip uses driver from token, not from body', async () => {
  const tripId = new mongoose.Types.ObjectId();
  const saved = [];
  const o = { fb: Trip.findById, fo: TripApplication.findOne, c: TripApplication.create, u: Driver.updateOne };
  Trip.findById = async () => ({ _id: tripId, status: 'pending' });
  TripApplication.findOne = async () => null;
  TripApplication.create = async (doc) => { saved.push(doc); return doc; };
  Driver.updateOne = async () => ({});
  const other = new mongoose.Types.ObjectId();
  const r = await call('POST', '/api/trips/apply-trip', {
    token: driverToken,
    body: { tripId: String(tripId), driverId: String(other), currentLocation: { lat: 23.8, lng: 90.4, accuracy: 12 } },
  });
  // লোকেশন ছাড়া আবেদন করা যাবে না
  const noLoc = await call('POST', '/api/trips/apply-trip', { token: driverToken, body: { tripId: String(tripId) } });
  Object.assign(Trip, { findById: o.fb }); Object.assign(TripApplication, { findOne: o.fo, create: o.c }); Driver.updateOne = o.u;
  assert.strictEqual(r.status, 200);
  assert.strictEqual(String(saved[0].driverId), String(driverId));
  assert.strictEqual(saved[0].currentLocation.placeName, 'ঘোড়াশাল, পলাশ উপজেলা, নরসিংদী জেলা');
  assert.strictEqual(noLoc.status, 400);
});

test('confirm-driver: second confirm gets 409, capacity copied, others rejected', async () => {
  const tripId = new mongoose.Types.ObjectId();
  const o = { fo: TripApplication.findOne, ex: Driver.exists, foau: Trip.findOneAndUpdate, tex: Trip.exists, hc: TripHistory.create, uo: TripApplication.updateOne, um: TripApplication.updateMany };
  let locked = false; const history = []; const rejected = [];
  TripApplication.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), driverId, driverName: 'D', phone: '01711111111', truckType: 'T', truckCapacity: 5, vehicleBody: 'open', currentLocation: {} });
  Driver.exists = async () => ({ _id: driverId });
  Trip.findOneAndUpdate = async (filter) => {
    assert.strictEqual(filter.status, 'pending');
    if (locked) return null;
    locked = true;
    return { _id: tripId, from: 'A', to: 'B', cargoDetails: 'C', requiredVehicleBody: 'open', requiredCapacity: 7, fixedPrice: 100, pickupTime: 't' };
  };
  Trip.exists = async () => ({ _id: tripId });
  TripHistory.create = async (d) => { history.push(d); return d; };
  TripApplication.updateOne = async () => ({});
  TripApplication.updateMany = async (f, u) => { rejected.push(u.status); return {}; };
  const body = { tripId: String(tripId), driverId: String(driverId) };
  const r1 = await call('POST', '/api/trips/confirm-driver', { token: adminToken, body });
  const r2 = await call('POST', '/api/trips/confirm-driver', { token: adminToken, body });
  Object.assign(TripApplication, { findOne: o.fo, updateOne: o.uo, updateMany: o.um });
  Object.assign(Trip, { findOneAndUpdate: o.foau, exists: o.tex });
  Driver.exists = o.ex; TripHistory.create = o.hc;
  assert.strictEqual(r1.status, 200);
  assert.strictEqual(r2.status, 409);
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].tripDetails.requiredCapacity, 7);
  assert.deepStrictEqual(rejected, ['rejected']);
});

test('bad JSON and unknown routes give clean errors (no internals leaked)', async () => {
  const r = await fetch(base + '/api/drivers/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.strictEqual(r.status, 400);
  const nf = await call('GET', '/api/nothing');
  assert.strictEqual(nf.status, 404);
});

test('CORS allows only the real site', async () => {
  const ok = await fetch(base + '/api/trips/active', { method: 'OPTIONS', headers: { Origin: 'https://desh-transport.vercel.app', 'Access-Control-Request-Method': 'GET' } });
  assert.strictEqual(ok.headers.get('access-control-allow-origin'), 'https://desh-transport.vercel.app');
  const bad = await fetch(base + '/api/trips/active', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } });
  assert.strictEqual(bad.headers.get('access-control-allow-origin'), null);
});

test('cancel: pending trip goes to history as cancelled, needs reason, only once', async () => {
  const tripId = new mongoose.Types.ObjectId();
  const o = { foau: Trip.findOneAndUpdate, ex: Trip.exists, hc: TripHistory.create, hu: TripHistory.updateOne, um: TripApplication.updateMany };
  let state = 'pending'; const created = []; const rejected = [];
  Trip.findOneAndUpdate = async (filter, update) => {
    if (!filter.status.$in.includes(state)) return null;
    const prev = { _id: tripId, status: state, from: 'A', to: 'B', cargoDetails: 'C', requiredVehicleBody: 'open', requiredCapacity: 3, fixedPrice: 100, pickupTime: 't' };
    state = update.status; return prev;
  };
  Trip.exists = async () => ({ _id: tripId });
  TripHistory.create = async (d) => { created.push(d); return d; };
  TripApplication.updateMany = async (f, u) => { rejected.push(u.status); return {}; };
  const noReason = await call('POST', `/api/trips/${tripId}/cancel`, { token: adminToken, body: {} });
  const r1 = await call('POST', `/api/trips/${tripId}/cancel`, { token: adminToken, body: { reason: 'মাল প্রস্তুত না' } });
  const r2 = await call('POST', `/api/trips/${tripId}/cancel`, { token: adminToken, body: { reason: 'আবার' } });
  const asDriver = await call('POST', `/api/trips/${tripId}/cancel`, { token: driverToken, body: { reason: 'x' } });
  Object.assign(Trip, { findOneAndUpdate: o.foau, exists: o.ex }); Object.assign(TripHistory, { create: o.hc, updateOne: o.hu }); TripApplication.updateMany = o.um;
  assert.strictEqual(noReason.status, 400);
  assert.strictEqual(r1.status, 200);
  assert.strictEqual(r2.status, 409);
  assert.strictEqual(asDriver.status, 403);
  assert.strictEqual(created[0].status, 'cancelled');
  assert.strictEqual(created[0].cancelReason, 'মাল প্রস্তুত না');
  assert.deepStrictEqual(rejected, ['rejected']);
});

test('cancel running trip updates its history; complete works only for running', async () => {
  const tripId = new mongoose.Types.ObjectId();
  const o = { foau: Trip.findOneAndUpdate, hu: TripHistory.updateOne, um: TripApplication.updateMany, hc: TripHistory.create };
  const updates = []; let created = 0;
  Trip.findOneAndUpdate = async (filter) => ({ _id: tripId, status: 'confirmed' });
  TripHistory.updateOne = async (f, u) => { updates.push(u.status); return {}; };
  TripHistory.create = async () => { created++; };
  TripApplication.updateMany = async () => ({});
  const c = await call('POST', `/api/trips/${tripId}/cancel`, { token: adminToken, body: { reason: 'গাড়ি নষ্ট' } });
  const d = await call('POST', `/api/trips/${tripId}/complete`, { token: adminToken });
  Trip.findOneAndUpdate = async () => null;
  const e = await call('POST', `/api/trips/${tripId}/complete`, { token: adminToken });
  Object.assign(Trip, { findOneAndUpdate: o.foau }); Object.assign(TripHistory, { updateOne: o.hu, create: o.hc }); TripApplication.updateMany = o.um;
  assert.strictEqual(c.status, 200); assert.strictEqual(d.status, 200); assert.strictEqual(e.status, 409);
  assert.deepStrictEqual(updates, ['cancelled', 'completed']);
  assert.strictEqual(created, 0);
});

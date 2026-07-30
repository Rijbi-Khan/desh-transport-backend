const crypto = require('crypto');

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizePhone(value) {
  let phone = String(value || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('8801') && phone.length === 13) phone = `0${phone.slice(3)}`;
  if (phone.startsWith('1') && phone.length === 10) phone = `0${phone}`;
  return phone;
}

function isValidBangladeshiPhone(phone) {
  return /^01\d{9}$/.test(phone);
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const [salt, savedKey] = String(storedHash || '').split(':');
    if (!salt || !savedKey) return resolve(false);

    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      const savedBuffer = Buffer.from(savedKey, 'hex');
      if (savedBuffer.length !== derivedKey.length) return resolve(false);
      resolve(crypto.timingSafeEqual(savedBuffer, derivedKey));
    });
  });
}

function createSessionToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSessionExpiry() {
  return new Date(Date.now() + TOKEN_TTL_MS);
}

function safeDriver(driver) {
  return {
    id: driver._id,
    driverName: driver.driverName,
    phone: driver.phone,
    truckType: driver.truckType,
    truckCapacity: driver.truckCapacity,
    vehicleBody: driver.vehicleBody,
    currentLocation: driver.currentLocation,
  };
}

function safeAdmin(admin) {
  return { id: admin._id, name: admin.name, phone: admin.phone };
}

module.exports = {
  createSessionExpiry,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  isValidBangladeshiPhone,
  normalizePhone,
  safeAdmin,
  safeDriver,
  verifyPassword,
};

// 📍 ক্লায়েন্ট থেকে আসা লোকেশন যাচাই ও পরিষ্কার করা
// accuracy = GPS কত মিটার পর্যন্ত নির্ভুল, placeName = জায়গার নাম (ঐচ্ছিক)
function normalizeLocation(location) {
  if (!location || location.lat === undefined || location.lng === undefined) return null;

  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  const accuracy = Number(location.accuracy);
  const placeName = typeof location.placeName === 'string' ? location.placeName.trim().slice(0, 200) : '';

  return {
    lat,
    lng,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null,
    placeName: placeName || null,
    updatedAt: new Date(),
  };
}

module.exports = { normalizeLocation };

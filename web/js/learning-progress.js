import { readJson, writeJson } from './storage.js';

const ACTIVITY_KEY = 'yijing-activity-v1';
const MAX_ACTIVITY_DAYS = 400;

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isActivity(value) {
  return value && Array.isArray(value.days) && value.days.every(isDateKey);
}

export function loadActivity(storage) {
  const activity = readJson(ACTIVITY_KEY, { days: [] }, isActivity, storage);
  return { days: [...new Set(activity.days)].sort() };
}

export function recordActivity(now = new Date(), storage) {
  const activity = loadActivity(storage);
  const today = localDateKey(now);
  const days = [...new Set([...activity.days, today])].sort().slice(-MAX_ACTIVITY_DAYS);
  const result = writeJson(ACTIVITY_KEY, { days }, storage);
  return { days, saved: result.ok };
}

export function calculateStreak(days, now = new Date()) {
  const available = new Set((Array.isArray(days) ? days : []).filter(isDateKey));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!available.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (available.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getActivityKey() {
  return ACTIVITY_KEY;
}


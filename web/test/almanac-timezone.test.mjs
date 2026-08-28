import assert from 'node:assert/strict';
import test from 'node:test';
import { shanghaiCalendarDate } from '../js/almanac-page.js';

test('黄历默认日期按 Asia/Shanghai 历日而非设备时区确定', () => {
  const date = shanghaiCalendarDate(new Date('2026-08-28T16:30:00.000Z'));
  assert.deepEqual(
    [date.getFullYear(), date.getMonth() + 1, date.getDate()],
    [2026, 8, 29],
  );
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');

assert.match(css, /\.daily-verse\s*{[^}]*white-space:\s*nowrap/s);
assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?\.daily-verse\s*{[^}]*font-size:\s*min\(1\.05rem,\s*4vw\)/s);

console.log('✓ 今日卦引文保持单行并在窄屏缩放');

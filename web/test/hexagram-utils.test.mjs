import { oppositeCode, reversedCode, interlockingCode, changingCode, allRelations } from '../js/hexagram-utils.js';

const asserts = [];
function ok(name, cond) { asserts.push({name, ok: cond}); console.log(`${cond?'✓':'✗'} ${name}`); }

// 互卦：取 2-3-4 爻为下卦，3-4-5 爻为上卦（索引 1-3 + 2-4，即 lines[1..3]+lines[2..4]）
// 泰 111000：lines = [1,1,1,0,0,0]，2-3-4=[1,1,0]，3-4-5=[1,0,0] → 互卦 = "110"+"100" = 110100 = 归妹
ok('互卦(泰111000)=归妹110100', interlockingCode('111000') === '110100');
// 乾 111111：互卦 = 111+111 = 111111 = 乾（自互）
ok('互卦(乾111111)=乾111111', interlockingCode('111111') === '111111');

// 变卦：指定爻位翻转。position 1-6（自下而上，对应 code[0..5]）
ok('变卦(乾111111, pos1)=姤011111', changingCode('111111', 1) === '011111');
ok('变卦(乾111111, pos2)=遁101111', changingCode('111111', 2) === '101111');
ok('变卦(坤000000, pos1)=复100000', changingCode('000000', 1) === '100000');

// allRelations：一次返回四条变
const r = allRelations('111000'); // 泰
ok('泰错=否000111', r.opposite === '000111');
ok('泰综=否000111', r.reversed === '000111');
ok('泰互=归妹110100', r.interlocking === '110100');
ok('泰变是数组(6个)', Array.isArray(r.changing) && r.changing.length === 6);
ok('泰变[0]=升011000', r.changing[0] === '011000');

const failed = asserts.filter(a => !a.ok);
console.log(failed.length ? `\n${failed.length} 项失败` : '\n全部通过');
process.exit(failed.length ? 1 : 0);

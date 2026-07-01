import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/domain/hexagram_utils.dart';

void main() {
  group('HexagramUtils', () {
    test('错卦：每位取反', () {
      expect(HexagramUtils.oppositeCode('111111'), '000000'); // 乾↔坤
      expect(HexagramUtils.oppositeCode('010001'), '101110');
    });

    test('综卦：上下翻转（整体倒序）', () {
      // 111000（泰，下乾上坤）综卦 = 000111（否，翻转）
      expect(HexagramUtils.reversedCode('111000'), '000111');
    });

    test('下卦 = 前3位，上卦 = 后3位', () {
      expect(HexagramUtils.lowerOf('110010'), '110');
      expect(HexagramUtils.upperOf('110010'), '010');
    });

    test('由下上两卦合成 6 位串', () {
      expect(HexagramUtils.combine(lower: '110', upper: '010'), '110010');
    });

    test('所有合法 6 位串共 64 个且无重复', () {
      final all = HexagramUtils.allBinaryCodes();
      expect(all.length, 64);
      expect(all.toSet().length, 64);
    });
  });
}

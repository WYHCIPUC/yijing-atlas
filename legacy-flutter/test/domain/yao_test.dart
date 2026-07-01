import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/domain/yao.dart';

void main() {
  group('Yao', () {
    test('初九：阳爻，位置1，当位', () {
      final yao = Yao(
        position: 1,
        isYang: true,
        text: '初九：潜龙勿用。',
        xiang: '潜龙勿用，阳在下也。',
      );
      expect(yao.isYang, true);
      expect(yao.isCorrectPosition, true); // 奇位阳爻为当位
      expect(yao.label, '初九');
    });

    test('六三：阴爻，位置3，失位（奇位阴爻）', () {
      final yao = Yao(
        position: 3,
        isYang: false,
        text: '六三：含章可贞。',
        xiang: '',
      );
      expect(yao.isCorrectPosition, false);
      expect(yao.label, '六三');
    });

    test('九五：阳爻位置5，当位', () {
      final yao = Yao(
        position: 5,
        isYang: true,
        text: '九五：飞龙在天，利见大人。',
        xiang: '',
      );
      expect(yao.isCorrectPosition, true);
      expect(yao.label, '九五');
    });

    test('上六：阴爻位置6，当位（偶位阴爻）', () {
      final yao = Yao(
        position: 6,
        isYang: false,
        text: '上六：龙战于野。',
        xiang: '',
      );
      expect(yao.isCorrectPosition, true);
      expect(yao.label, '上六');
    });

    test('位置范围校验 1-6', () {
      expect(
        () => Yao(position: 7, isYang: true, text: '', xiang: ''),
        throwsA(isA<ArgumentError>()),
      );
      expect(
        () => Yao(position: 0, isYang: false, text: '', xiang: ''),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}

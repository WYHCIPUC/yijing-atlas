import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/domain/hexagram.dart';
import 'package:yijing_app/domain/yao.dart';

Hexagram _qian() {
  final lines = [
    for (int i = 0; i < 6; i++)
      Yao(position: i + 1, isYang: true, text: '爻${i + 1}', xiang: ''),
  ];
  return Hexagram(
    number: 1,
    name: '乾',
    fullName: '乾为天',
    binaryCode: '111111',
    trigramLowerCode: '111',
    trigramUpperCode: '111',
    judgement: '乾：元，亨，利，贞。',
    image: '天行健，君子以自强不息。',
    tuan: '大哉乾元……',
    lines: lines,
    useNine: '用九：见群龙无首，吉。',
    useSix: null,
    orderRemark: '有天地，然后万物生焉。',
  );
}

void main() {
  group('Hexagram', () {
    test('乾卦：6 阳爻，binaryCode=111111', () {
      final qian = _qian();
      expect(qian.binaryCode, '111111');
      expect(qian.useNine, isNotNull);
      expect(qian.useSix, isNull);
      expect(qian.lines.length, 6);
    });

    test('下卦=前3位，上卦=后3位', () {
      final qian = _qian();
      expect(qian.lowerTrigramCode, '111');
      expect(qian.upperTrigramCode, '111');
    });

    test('binaryCode 长度校验', () {
      expect(
        () => Hexagram(
          number: 1,
          name: '',
          fullName: '',
          binaryCode: '11',
          trigramLowerCode: '111',
          trigramUpperCode: '111',
          judgement: '',
          image: '',
          tuan: '',
          lines: [
            for (int i = 0; i < 6; i++)
              Yao(position: i + 1, isYang: true, text: '', xiang: ''),
          ],
          useNine: null,
          useSix: null,
          orderRemark: '',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('binaryCode 与 lines 爻象一致性校验', () {
      // lines 全阳，但 binaryCode 末位（爻1）是 0 → 矛盾
      expect(
        () => Hexagram(
          number: 1,
          name: '',
          fullName: '',
          binaryCode: '011111',
          trigramLowerCode: '111',
          trigramUpperCode: '011',
          judgement: '',
          image: '',
          tuan: '',
          lines: [
            for (int i = 0; i < 6; i++)
              Yao(position: i + 1, isYang: true, text: '', xiang: ''),
          ],
          useNine: null,
          useSix: null,
          orderRemark: '',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('fromJson 解析', () {
      final json = {
        'number': 1,
        'name': '乾',
        'fullName': '乾为天',
        'binaryCode': '111111',
        'trigramLower': '111',
        'trigramUpper': '111',
        'judgement': '乾：元，亨，利，贞。',
        'image': '天行健。',
        'tuan': '大哉乾元。',
        'lines': [
          {'position': 1, 'isYang': true, 'text': '初九', 'xiang': ''},
          {'position': 2, 'isYang': true, 'text': '九二', 'xiang': ''},
          {'position': 3, 'isYang': true, 'text': '九三', 'xiang': ''},
          {'position': 4, 'isYang': true, 'text': '九四', 'xiang': ''},
          {'position': 5, 'isYang': true, 'text': '九五', 'xiang': ''},
          {'position': 6, 'isYang': true, 'text': '上九', 'xiang': ''},
        ],
        'useNine': '用九：见群龙无首，吉。',
        'useSix': null,
        'orderRemark': '',
      };
      final h = Hexagram.fromJson(json);
      expect(h.name, '乾');
      expect(h.lines.length, 6);
    });
  });
}

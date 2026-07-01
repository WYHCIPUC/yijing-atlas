import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/data/data_integrity.dart';
import 'package:yijing_app/domain/hexagram.dart';
import 'package:yijing_app/domain/trigram.dart';
import 'package:yijing_app/domain/yao.dart';

Hexagram _mk(int n, String code) {
  final lines = [
    for (int i = 0; i < 6; i++)
      Yao(position: i + 1, isYang: code[i] == '1', text: '', xiang: ''),
  ];
  return Hexagram(
    number: n,
    name: '卦$n',
    fullName: '',
    binaryCode: code,
    trigramLowerCode: code.substring(0, 3),
    trigramUpperCode: code.substring(3, 6),
    judgement: '',
    image: '',
    tuan: '',
    lines: lines,
    useNine: null,
    useSix: null,
    orderRemark: '',
  );
}

void main() {
  group('DataIntegrity', () {
    test('完整 64 卦通过校验', () {
      final all = [
        for (int i = 0; i < 64; i++)
          _mk(i + 1, i.toRadixString(2).padLeft(6, '0')),
      ];
      expect(() => DataIntegrity.validateHexagrams(all), returnsNormally);
    });

    test('卦数不是 64 报错', () {
      expect(
        () => DataIntegrity.validateHexagrams([_mk(1, '000000')]),
        throwsA(isA<StateError>()),
      );
    });

    test('binaryCode 重复报错', () {
      final all = [
        for (int i = 0; i < 63; i++)
          _mk(i + 1, i.toRadixString(2).padLeft(6, '0')),
        _mk(64, '000000'), // 与第 1 个重复
      ];
      expect(
        () => DataIntegrity.validateHexagrams(all),
        throwsA(isA<StateError>()),
      );
    });

    test('卦序必须 1-64 连续', () {
      final all = [
        for (int i = 0; i < 64; i++)
          _mk(i == 0 ? 99 : i + 1, i.toRadixString(2).padLeft(6, '0')),
      ];
      expect(
        () => DataIntegrity.validateHexagrams(all),
        throwsA(isA<StateError>()),
      );
    });

    test('八卦 8 条且 binaryCode 唯一', () {
      final trigrams = [
        for (int i = 0; i < 8; i++)
          Trigram(
            name: 'T$i',
            binaryCode: i.toRadixString(2).padLeft(3, '0'),
            nature: '',
            attribute: '',
            direction: '',
            familyMember: '',
          ),
      ];
      expect(() => DataIntegrity.validateTrigrams(trigrams), returnsNormally);
    });

    test('八卦数量不对报错', () {
      expect(
        () => DataIntegrity.validateTrigrams([
          Trigram(
              name: 'A',
              binaryCode: '111',
              nature: '',
              attribute: '',
              direction: '',
              familyMember: ''),
        ]),
        throwsA(isA<StateError>()),
      );
    });
  });
}

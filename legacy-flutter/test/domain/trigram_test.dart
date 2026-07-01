import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/domain/trigram.dart';

void main() {
  group('Trigram', () {
    test('乾卦二进制为 111，自然为天，德性为健', () {
      final qian = Trigram(
        name: '乾',
        binaryCode: '111',
        nature: '天',
        attribute: '健',
        direction: '南',
        familyMember: '父',
      );
      expect(qian.binaryCode, '111');
      expect(qian.nature, '天');
      expect(qian.attribute, '健');
    });

    test('二进制串长度校验拒绝非法值', () {
      expect(
        () => Trigram(
          name: '错',
          binaryCode: '1101',
          nature: '',
          attribute: '',
          direction: '',
          familyMember: '',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('fromJson / toJson 往返一致', () {
      final original = Trigram(
        name: '坤',
        binaryCode: '000',
        nature: '地',
        attribute: '顺',
        direction: '北',
        familyMember: '母',
      );
      final roundTrip = Trigram.fromJson(original.toJson());
      expect(roundTrip.name, original.name);
      expect(roundTrip.binaryCode, original.binaryCode);
    });
  });
}

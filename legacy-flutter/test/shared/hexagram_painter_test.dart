import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/shared/widgets/hexagram_painter.dart';

void main() {
  group('HexagramPainter logic', () {
    test('111111 → 6 个阳爻，自下而上', () {
      final lines = HexagramPainter.describeLines('111111');
      expect(lines.length, 6);
      expect(lines.every((l) => l.isYang), true);
    });

    test('000000 → 6 个阴爻', () {
      final lines = HexagramPainter.describeLines('000000');
      expect(lines.every((l) => !l.isYang), true);
    });

    test('101010 → 交替，索引0=阳（爻1）', () {
      final lines = HexagramPainter.describeLines('101010');
      expect(lines[0].isYang, true); // 爻1
      expect(lines[1].isYang, false); // 爻2
      expect(lines[2].isYang, true); // 爻3
    });

    test('变爻标记', () {
      final lines = HexagramPainter.describeLines('111111', changingPositions: {3, 6});
      expect(lines[2].isChanging, true); // 爻3
      expect(lines[5].isChanging, true); // 爻6
      expect(lines[0].isChanging, false);
    });

    test('非法串抛错', () {
      expect(
        () => HexagramPainter.describeLines('123'),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/data/data_integrity.dart';
import 'package:yijing_app/data/hexagram_repository.dart';
import 'package:yijing_app/data/trigram_repository.dart';

/// 集成测试：用打包的真实 assets 跑一遍加载 + 自检，
/// 确保实际数据满足易经正确性约束。
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('真实 assets 数据校验', () {
    test('hexagrams.json 加载并通过 64 卦自检', () async {
      final repo = await HexagramRepository.load();
      expect(repo.all.length, 64);
      expect(() => DataIntegrity.validateHexagrams(repo.all), returnsNormally);
    });

    test('trigrams.json 加载并通过八卦自检', () async {
      final repo = await TrigramRepository.load();
      expect(repo.all.length, 8);
      expect(() => DataIntegrity.validateTrigrams(repo.all), returnsNormally);
    });

    test('乾卦数据完整（已填经文的样板卦）', () async {
      final repo = await HexagramRepository.load();
      final qian = repo.findByBinaryCode('111111')!;
      expect(qian.name, '乾');
      expect(qian.judgement, isNotEmpty);
      expect(qian.image, '天行健，君子以自强不息。');
      expect(qian.useNine, isNotNull);
      expect(qian.lines.every((y) => y.text.isNotEmpty), true);
    });

    test('二进制串全覆盖 64 种且无重复（数据层验证）', () async {
      final repo = await HexagramRepository.load();
      final codes = repo.all.map((h) => h.binaryCode).toSet();
      expect(codes.length, 64);
    });
  });
}

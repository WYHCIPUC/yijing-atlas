import 'package:yijing_app/domain/hexagram.dart';
import 'package:yijing_app/domain/trigram.dart';

/// 启动自检：确保内容数据满足易经正确性的硬性约束。
///
/// 数据校验在 APP 启动时执行；任何错误立即抛出，让问题在开发期暴露，
/// 而不是把残缺/错误的卦象数据呈现给用户。
class DataIntegrity {
  DataIntegrity._();

  /// 校验 64 卦：数量为 64、binaryCode 唯一、卦序 1-64 连续。
  static void validateHexagrams(List<Hexagram> all) {
    if (all.length != 64) {
      throw StateError('卦的数量必须为 64，实际 ${all.length}');
    }
    final codes = all.map((h) => h.binaryCode).toSet();
    if (codes.length != 64) {
      throw StateError('存在重复的 binaryCode，唯一数 ${codes.length}');
    }
    final numbers = all.map((h) => h.number).toSet();
    final expected = {for (var i = 1; i <= 64; i++) i};
    if (numbers.length != 64 || !numbers.containsAll(expected)) {
      throw StateError('卦序必须为 1-64 连续，实际: $numbers');
    }
  }

  /// 校验八卦：数量为 8、binaryCode 唯一。
  static void validateTrigrams(List<Trigram> all) {
    if (all.length != 8) {
      throw StateError('八卦数量必须为 8，实际 ${all.length}');
    }
    final codes = all.map((t) => t.binaryCode).toSet();
    if (codes.length != 8) {
      throw StateError('存在重复的八卦 binaryCode，唯一数 ${codes.length}');
    }
  }
}

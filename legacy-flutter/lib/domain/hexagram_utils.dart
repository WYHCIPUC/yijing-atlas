/// 卦象位运算工具。所有运算基于 6 位二进制串（自下而上）。
///
/// 这些纯函数是占筮解读（第 4 期）和卦际关系学习的基础。
class HexagramUtils {
  HexagramUtils._();

  /// 错卦（旁通卦）：每一位取反（阴阳互换）。
  /// 如乾 111111 → 坤 000000。
  static String oppositeCode(String code) {
    _validate(code);
    return code.split('').map((b) => b == '1' ? '0' : '1').join();
  }

  /// 综卦（反卦）：整体上下翻转（爻序倒置）。
  /// 如泰 111000 → 否 000111。
  static String reversedCode(String code) {
    _validate(code);
    return code.split('').reversed.join();
  }

  /// 下卦（内卦）= 前 3 位（爻1-3）。
  static String lowerOf(String code) {
    _validate(code);
    return code.substring(0, 3);
  }

  /// 上卦（外卦）= 后 3 位（爻4-6）。
  static String upperOf(String code) {
    _validate(code);
    return code.substring(3, 6);
  }

  /// 由下卦、上卦合成 6 位串。
  static String combine({required String lower, required String upper}) {
    return '$lower$upper';
  }

  /// 生成全部 64 个合法 6 位二进制串（用于自检全覆盖）。
  static List<String> allBinaryCodes() {
    return [
      for (var i = 0; i < 64; i++) i.toRadixString(2).padLeft(6, '0'),
    ];
  }

  static void _validate(String code) {
    if (!RegExp(r'^[01]{6}$').hasMatch(code)) {
      throw ArgumentError('需要 6 位 0/1 串，得到: $code');
    }
  }
}

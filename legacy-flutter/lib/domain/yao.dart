/// 爻：构成卦的六爻之一，自下而上编号 1-6。
///
/// 爻位分奇偶：1/3/5 为奇位（阳位），2/4/6 为偶位（阴位）。
/// 当位（得位/正）：阳爻居奇位、阴爻居偶位。
class Yao {
  final int position;        // 1-6，自下而上
  final bool isYang;         // true=阳爻，false=阴爻
  final String text;         // 爻辞，如"初九：潜龙勿用。"
  final String xiang;        // 小象传（解释该爻）

  Yao({
    required this.position,
    required this.isYang,
    required this.text,
    required this.xiang,
  }) {
    if (position < 1 || position > 6) {
      throw ArgumentError('position 必须在 1-6，得到: $position');
    }
  }

  /// 当位：阳爻居奇位(1,3,5)、阴爻居偶位(2,4,6) 为 true。
  bool get isCorrectPosition =>
      isYang ? position.isOdd : position.isEven;

  /// 爻题：阳爻用"九"，阴爻用"六"，配位置名（初/二三四/五/上）。
  /// 初、上：位名+阴阳（初九、上六）；中位：阴阳+位名（九二、六五）。
  String get label {
    const positionNames = ['', '初', '二', '三', '四', '五', '上'];
    final yinYang = isYang ? '九' : '六';
    if (position == 1 || position == 6) {
      return '${positionNames[position]}$yinYang';
    }
    return '$yinYang${positionNames[position]}';
  }

  factory Yao.fromJson(Map<String, dynamic> json) => Yao(
        position: json['position'] as int,
        isYang: json['isYang'] as bool,
        text: json['text'] as String,
        xiang: json['xiang'] as String,
      );

  Map<String, dynamic> toJson() => {
        'position': position,
        'isYang': isYang,
        'text': text,
        'xiang': xiang,
      };
}

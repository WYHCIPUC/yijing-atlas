import 'yao.dart';

/// 卦（别卦）：六爻构成，64 卦之一。
///
/// [binaryCode] 为 6 位二进制串，**自下而上**（爻1→爻6），阳爻记 1、阴爻记 0。
/// 它是卦的主键，所有跨文件引用都靠它关联。
class Hexagram {
  final int number;              // 卦序 1-64（周易序卦）
  final String name;             // 卦名，如"乾"
  final String fullName;         // 全称，如"乾为天"
  final String binaryCode;       // ★ 6 位二进制，自下而上；卦的主键
  final String trigramLowerCode; // 下卦（内卦）binaryCode，用于冗余校验
  final String trigramUpperCode; // 上卦（外卦）binaryCode，用于冗余校验
  final String judgement;        // 卦辞
  final String image;            // 大象传
  final String tuan;             // 彖传
  final List<Yao> lines;         // 6 爻，自下而上
  final String? useNine;         // 用九（仅乾卦）
  final String? useSix;          // 用六（仅坤卦）
  final String orderRemark;      // 序卦传说明

  Hexagram({
    required this.number,
    required this.name,
    required this.fullName,
    required this.binaryCode,
    required this.trigramLowerCode,
    required this.trigramUpperCode,
    required this.judgement,
    required this.image,
    required this.tuan,
    required this.lines,
    required this.useNine,
    required this.useSix,
    required this.orderRemark,
  }) {
    if (!RegExp(r'^[01]{6}$').hasMatch(binaryCode)) {
      throw ArgumentError('binaryCode 必须是 6 位 0/1 串，得到: $binaryCode');
    }
    // binaryCode 与 lines 爻象一致性：binaryCode[i] 对应 lines[i].isYang
    for (var i = 0; i < 6; i++) {
      final codeIsYang = binaryCode[i] == '1';
      if (codeIsYang != lines[i].isYang) {
        throw ArgumentError(
          'binaryCode[$i]（爻${i + 1}）与 lines[$i].isYang 不一致',
        );
      }
    }
  }

  /// 下卦（内卦）= binaryCode 前 3 位（爻1-3）。
  String get lowerTrigramCode => binaryCode.substring(0, 3);

  /// 上卦（外卦）= binaryCode 后 3 位（爻4-6）。
  String get upperTrigramCode => binaryCode.substring(3, 6);

  factory Hexagram.fromJson(Map<String, dynamic> json) => Hexagram(
        number: json['number'] as int,
        name: json['name'] as String,
        fullName: json['fullName'] as String,
        binaryCode: json['binaryCode'] as String,
        trigramLowerCode: json['trigramLower'] as String,
        trigramUpperCode: json['trigramUpper'] as String,
        judgement: json['judgement'] as String,
        image: json['image'] as String,
        tuan: json['tuan'] as String,
        lines: (json['lines'] as List)
            .map((e) => Yao.fromJson(e as Map<String, dynamic>))
            .toList(),
        useNine: json['useNine'] as String?,
        useSix: json['useSix'] as String?,
        orderRemark: json['orderRemark'] as String,
      );
}

/// 八卦（经卦）：三爻构成的基础卦。
///
/// binaryCode 为 3 位二进制串，**自下而上**（下爻→上爻），阳爻记 1、阴爻记 0。
/// 例：乾 ☰ = "111"，震 ☳ = "100"（下阳、中阴、上阴）。
class Trigram {
  final String name;          // 乾 兑 离 震 巽 坎 艮 坤
  final String binaryCode;    // 3 位二进制串，自下而上
  final String nature;        // 自然属性：天泽火雷风水山地
  final String attribute;     // 德性：健悦丽动入陷止顺
  final String direction;     // 先天方位
  final String familyMember;  // 家庭成员

  Trigram({
    required this.name,
    required this.binaryCode,
    required this.nature,
    required this.attribute,
    required this.direction,
    required this.familyMember,
  }) {
    if (!RegExp(r'^[01]{3}$').hasMatch(binaryCode)) {
      throw ArgumentError('binaryCode 必须是 3 位 0/1 串，得到: $binaryCode');
    }
  }

  factory Trigram.fromJson(Map<String, dynamic> json) => Trigram(
        name: json['name'] as String,
        binaryCode: json['binaryCode'] as String,
        nature: json['nature'] as String,
        attribute: json['attribute'] as String,
        direction: json['direction'] as String,
        familyMember: json['familyMember'] as String,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'binaryCode': binaryCode,
        'nature': nature,
        'attribute': attribute,
        'direction': direction,
        'familyMember': familyMember,
      };
}

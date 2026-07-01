import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/data/hexagram_repository.dart';

void main() {
  group('HexagramRepository parsing', () {
    test('解析 JSON 字符串', () {
      const raw = '''
[
  {
    "number": 1, "name": "乾", "fullName": "乾为天",
    "binaryCode": "111111", "trigramLower": "111", "trigramUpper": "111",
    "judgement": "乾：元，亨，利，贞。",
    "image": "天行健，君子以自强不息。",
    "tuan": "大哉乾元。",
    "lines": [
      {"position":1,"isYang":true,"text":"初九：潜龙勿用。","xiang":""},
      {"position":2,"isYang":true,"text":"九二：见龙在田。","xiang":""},
      {"position":3,"isYang":true,"text":"九三：终日乾乾。","xiang":""},
      {"position":4,"isYang":true,"text":"九四：或跃在渊。","xiang":""},
      {"position":5,"isYang":true,"text":"九五：飞龙在天。","xiang":""},
      {"position":6,"isYang":true,"text":"上九：亢龙有悔。","xiang":""}
    ],
    "useNine": "用九：见群龙无首，吉。",
    "useSix": null,
    "orderRemark": ""
  }
]
''';
      final list = HexagramRepository.parseJsonString(raw);
      expect(list.length, 1);
      expect(list.first.name, '乾');
      expect(list.first.useNine, isNotNull);
    });

    test('按 binaryCode / number / name 查找', () {
      const raw = '''
[{"number":2,"name":"坤","fullName":"坤为地","binaryCode":"000000","trigramLower":"000","trigramUpper":"000","judgement":"","image":"","tuan":"","lines":[{"position":1,"isYang":false,"text":"","xiang":""},{"position":2,"isYang":false,"text":"","xiang":""},{"position":3,"isYang":false,"text":"","xiang":""},{"position":4,"isYang":false,"text":"","xiang":""},{"position":5,"isYang":false,"text":"","xiang":""},{"position":6,"isYang":false,"text":"","xiang":""}],"useNine":null,"useSix":"用六：利永贞。","orderRemark":""}]
''';
      final repo = HexagramRepository(
          parseResult: HexagramRepository.parseJsonString(raw));
      expect(repo.findByBinaryCode('000000')?.name, '坤');
      expect(repo.findByNumber(2)?.name, '坤');
      expect(repo.findByName('坤')?.binaryCode, '000000');
    });

    test('全文检索', () {
      const raw = '''
[
{"number":1,"name":"乾","fullName":"乾为天","binaryCode":"111111","trigramLower":"111","trigramUpper":"111","judgement":"元亨利贞","image":"","tuan":"","lines":[{"position":1,"isYang":true,"text":"潜龙勿用","xiang":""},{"position":2,"isYang":true,"text":"","xiang":""},{"position":3,"isYang":true,"text":"","xiang":""},{"position":4,"isYang":true,"text":"","xiang":""},{"position":5,"isYang":true,"text":"","xiang":""},{"position":6,"isYang":true,"text":"","xiang":""}],"useNine":null,"useSix":null,"orderRemark":""},
{"number":2,"name":"坤","fullName":"坤为地","binaryCode":"000000","trigramLower":"000","trigramUpper":"000","judgement":"利牝马之贞","image":"","tuan":"","lines":[{"position":1,"isYang":false,"text":"","xiang":""},{"position":2,"isYang":false,"text":"","xiang":""},{"position":3,"isYang":false,"text":"","xiang":""},{"position":4,"isYang":false,"text":"","xiang":""},{"position":5,"isYang":false,"text":"","xiang":""},{"position":6,"isYang":false,"text":"","xiang":""}],"useNine":null,"useSix":null,"orderRemark":""}
]
''';
      final repo = HexagramRepository(
          parseResult: HexagramRepository.parseJsonString(raw));
      expect(repo.search('龙').length, 1);
      expect(repo.search('龙').first.name, '乾');
      expect(repo.search('贞').length, 2);
      expect(repo.search('').length, 2); // 空关键词返回全部
    });
  });
}

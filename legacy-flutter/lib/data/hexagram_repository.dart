import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:yijing_app/domain/hexagram.dart';

/// 读取并缓存 hexagrams.json，提供按序号/名/binaryCode 查询与全文检索。
///
/// UI 层永远通过 Repository 访问数据，不直接接触 JSON 或 rootBundle。
class HexagramRepository {
  final List<Hexagram> _all;
  final Map<String, Hexagram> _byCode;
  final Map<int, Hexagram> _byNumber;
  final Map<String, Hexagram> _byName;

  HexagramRepository({required List<Hexagram> parseResult})
      : _all = parseResult,
        _byCode = {for (final h in parseResult) h.binaryCode: h},
        _byNumber = {for (final h in parseResult) h.number: h},
        _byName = {for (final h in parseResult) h.name: h};

  /// 从 assets 异步加载。
  static Future<HexagramRepository> load(
      [String assetPath = 'assets/data/hexagrams.json']) async {
    final raw = await rootBundle.loadString(assetPath);
    return HexagramRepository(parseResult: parseJsonString(raw));
  }

  /// 解析 JSON 字符串为 Hexagram 列表（便于测试注入）。
  static List<Hexagram> parseJsonString(String raw) {
    final list = jsonDecode(raw) as List;
    return list
        .map((e) => Hexagram.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  List<Hexagram> get all => List.unmodifiable(_all);

  Hexagram? findByBinaryCode(String code) => _byCode[code];
  Hexagram? findByNumber(int number) => _byNumber[number];
  Hexagram? findByName(String name) => _byName[name];

  /// 全文检索：在 卦名/全称/卦辞/大象/彖/序卦/爻辞 中查找关键词（不区分大小写）。
  List<Hexagram> search(String keyword) {
    if (keyword.isEmpty) return all;
    final kw = keyword.toLowerCase();
    bool hit(String s) => s.toLowerCase().contains(kw);
    return _all.where((h) {
      if (hit(h.name) ||
          hit(h.fullName) ||
          hit(h.judgement) ||
          hit(h.image) ||
          hit(h.tuan) ||
          hit(h.orderRemark)) {
        return true;
      }
      return h.lines.any((y) => hit(y.text) || hit(y.xiang));
    }).toList();
  }
}

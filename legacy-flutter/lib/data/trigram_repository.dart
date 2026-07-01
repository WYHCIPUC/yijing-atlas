import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:yijing_app/domain/trigram.dart';

/// 读取并缓存 trigrams.json，提供按 binaryCode/名 查询。
class TrigramRepository {
  final List<Trigram> _all;
  final Map<String, Trigram> _byCode;
  final Map<String, Trigram> _byName;

  TrigramRepository({required List<Trigram> items})
      : _all = items,
        _byCode = {for (final t in items) t.binaryCode: t},
        _byName = {for (final t in items) t.name: t};

  static Future<TrigramRepository> load(
      [String assetPath = 'assets/data/trigrams.json']) async {
    final raw = await rootBundle.loadString(assetPath);
    final list = jsonDecode(raw) as List;
    return TrigramRepository(
      items: list
          .map((e) => Trigram.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  List<Trigram> get all => List.unmodifiable(_all);
  Trigram? findByCode(String code) => _byCode[code];
  Trigram? findByName(String name) => _byName[name];
}

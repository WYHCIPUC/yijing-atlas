import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yijing_app/data/data_integrity.dart';
import 'package:yijing_app/data/hexagram_repository.dart';
import 'package:yijing_app/data/trigram_repository.dart';
import 'package:yijing_app/domain/hexagram.dart';

/// 应用初始化：加载 JSON + 启动自检。返回 true 表示成功。
///
/// 自检失败会抛错——APP 启动时立即暴露数据问题，而非呈现残缺卦象。
final appInitializationProvider = FutureProvider<bool>((ref) async {
  final hexRepo = await HexagramRepository.load();
  DataIntegrity.validateHexagrams(hexRepo.all);
  final triRepo = await TrigramRepository.load();
  DataIntegrity.validateTrigrams(triRepo.all);
  ref.read(hexagramRepositoryProvider.notifier).state = hexRepo;
  ref.read(trigramRepositoryProvider.notifier).state = triRepo;
  return true;
});

final hexagramRepositoryProvider =
    StateProvider<HexagramRepository?>((ref) => null);

final trigramRepositoryProvider =
    StateProvider<TrigramRepository?>((ref) => null);

/// 64 卦列表（按卦序）。
final hexagramListProvider = Provider<List<Hexagram>>((ref) {
  final repo = ref.watch(hexagramRepositoryProvider);
  return repo?.all ?? const [];
});

/// 搜索关键词状态。
final searchKeywordProvider = StateProvider<String>((ref) => '');

/// 搜索结果。
final searchResultProvider = Provider<List<Hexagram>>((ref) {
  final repo = ref.watch(hexagramRepositoryProvider);
  final kw = ref.watch(searchKeywordProvider);
  if (repo == null) return const [];
  return repo.search(kw);
});

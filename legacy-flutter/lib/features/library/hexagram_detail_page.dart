import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yijing_app/application/providers.dart';
import 'package:yijing_app/domain/yao.dart';
import 'package:yijing_app/shared/widgets/hexagram_painter.dart';

/// 卦象详情页：可视化六爻图 + 卦辞/彖/象/各爻爻辞小象/序卦。
class HexagramDetailPage extends ConsumerWidget {
  final String binaryCode;
  const HexagramDetailPage(this.binaryCode, {super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(hexagramRepositoryProvider);
    final hex = repo?.findByBinaryCode(binaryCode);
    if (hex == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('未找到该卦')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('${hex.number}.${hex.name} · ${hex.fullName}'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(child: HexagramView(hex.binaryCode, size: 140)),
          const SizedBox(height: 16),
          _section('卦辞', hex.judgement),
          _section('彖传', hex.tuan),
          _section('大象', hex.image),
          const Divider(),
          // 自上而下展示（上九→初九），符合阅读习惯
          for (final yao in hex.lines.reversed) _yaoTile(yao),
          if (hex.useNine != null) _section('用九', hex.useNine!),
          if (hex.useSix != null) _section('用六', hex.useSix!),
          const Divider(),
          _section('序卦传', hex.orderRemark),
        ],
      ),
    );
  }

  Widget _section(String title, String body) {
    if (body.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
                fontWeight: FontWeight.bold, color: Colors.brown),
          ),
          const SizedBox(height: 4),
          Text(body, style: const TextStyle(fontSize: 15, height: 1.6)),
        ],
      ),
    );
  }

  Widget _yaoTile(Yao yao) {
    if (yao.text.isEmpty && yao.xiang.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Text(yao.label,
                style: const TextStyle(
                    fontWeight: FontWeight.bold, color: Colors.grey)),
            const SizedBox(width: 8),
            const Text('（经文待补）',
                style: TextStyle(color: Colors.grey, fontSize: 13)),
          ],
        ),
      );
    }
    return ExpansionTile(
      title: Text(yao.label,
          style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle:
          Text(yao.text, maxLines: 1, overflow: TextOverflow.ellipsis),
      children: [
        if (yao.text.isNotEmpty) ListTile(title: Text(yao.text)),
        if (yao.xiang.isNotEmpty)
          ListTile(
            title: Text('象曰：${yao.xiang}',
                style: const TextStyle(color: Colors.grey)),
          ),
      ],
    );
  }
}

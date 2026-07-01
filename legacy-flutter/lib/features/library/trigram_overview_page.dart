import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yijing_app/application/providers.dart';
import 'package:yijing_app/shared/widgets/trigram_painter.dart';

/// 八卦基础页：8 卦符号 + 属性详表。
class TrigramOverviewPage extends ConsumerWidget {
  const TrigramOverviewPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(trigramRepositoryProvider);
    final list = repo?.all ?? const [];

    return Scaffold(
      appBar: AppBar(title: const Text('八卦基础')),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          const Text('先天八卦',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 4,
            childAspectRatio: 0.85,
            children: list
                .map((t) => Card(
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            TrigramView(t.binaryCode, size: 48),
                            const SizedBox(height: 4),
                            Text(t.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold)),
                            Text(t.nature,
                                style: const TextStyle(
                                    color: Colors.grey, fontSize: 12)),
                          ],
                        ),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 16),
          const Text('属性详表',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          DataTable(
            columns: const [
              DataColumn(label: Text('卦')),
              DataColumn(label: Text('自然')),
              DataColumn(label: Text('德性')),
              DataColumn(label: Text('方位')),
              DataColumn(label: Text('家人')),
            ],
            rows: list
                .map((t) => DataRow(cells: [
                      DataCell(Text(t.name)),
                      DataCell(Text(t.nature)),
                      DataCell(Text(t.attribute)),
                      DataCell(Text(t.direction)),
                      DataCell(Text(t.familyMember)),
                    ]))
                .toList(),
          ),
        ],
      ),
    );
  }
}

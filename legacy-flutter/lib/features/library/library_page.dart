import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yijing_app/application/providers.dart';
import 'package:yijing_app/core/app_routes.dart';
import 'package:yijing_app/shared/widgets/hexagram_painter.dart';

/// 64 卦总览页：网格展示 + 搜索。
class LibraryPage extends ConsumerStatefulWidget {
  const LibraryPage({super.key});
  @override
  ConsumerState<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends ConsumerState<LibraryPage> {
  bool _searching = false;
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final kw = ref.watch(searchKeywordProvider);
    final list =
        kw.isEmpty ? ref.watch(hexagramListProvider) : ref.watch(searchResultProvider);

    return Scaffold(
      appBar: AppBar(
        title: _searching
            ? TextField(
                controller: _controller,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: '搜索卦名 / 卦辞 / 爻辞…',
                  border: InputBorder.none,
                ),
                onChanged: (v) =>
                    ref.read(searchKeywordProvider.notifier).state = v,
              )
            : const Text('查阅 · 六十四卦'),
        actions: [
          IconButton(
            icon: Icon(_searching ? Icons.close : Icons.search),
            onPressed: () {
              setState(() {
                _searching = !_searching;
                if (!_searching) {
                  _controller.clear();
                  ref.read(searchKeywordProvider.notifier).state = '';
                }
              });
            },
          ),
        ],
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(8),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          childAspectRatio: 0.8,
        ),
        itemCount: list.length,
        itemBuilder: (context, i) {
          final h = list[i];
          return Card(
            child: InkWell(
              onTap: () => context.pushHexagramDetail(h.binaryCode),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  HexagramView(h.binaryCode, size: 56),
                  const SizedBox(height: 4),
                  Text(
                    '${h.number}.${h.name}',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  Text(h.fullName,
                      style: const TextStyle(fontSize: 10, color: Colors.grey)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

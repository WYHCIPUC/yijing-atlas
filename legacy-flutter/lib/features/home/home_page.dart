import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yijing_app/application/providers.dart';
import 'package:yijing_app/core/app_routes.dart';

/// 首页 Shell：承载底部 5 个 Tab 导航 + 应用初始化态。
class HomePage extends ConsumerStatefulWidget {
  final Widget shellChild;
  const HomePage({required this.shellChild, super.key});
  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _indexFromLocation(String location) {
    if (location.startsWith(AppRoutes.trigrams)) return 1;
    if (location.startsWith(AppRoutes.study)) return 2;
    if (location.startsWith(AppRoutes.review)) return 3;
    if (location.startsWith(AppRoutes.profile)) return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final init = ref.watch(appInitializationProvider);

    return Scaffold(
      body: init.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('数据加载失败：$e',
                style: const TextStyle(color: Colors.red)),
          ),
        ),
        data: (_) => widget.shellChild,
      ),
      bottomNavigationBar: Builder(builder: (context) {
        final location = GoRouterState.of(context).uri.toString();
        final idx = _indexFromLocation(location);
        return NavigationBar(
          selectedIndex: idx,
          onDestinationSelected: (i) {
            const routes = [
              AppRoutes.library,
              AppRoutes.trigrams,
              AppRoutes.study,
              AppRoutes.review,
              AppRoutes.profile,
            ];
            context.go(routes[i]);
          },
          destinations: const [
            NavigationDestination(icon: Icon(Icons.menu_book), label: '查阅'),
            NavigationDestination(icon: Icon(Icons.grain), label: '八卦'),
            NavigationDestination(icon: Icon(Icons.school), label: '学习'),
            NavigationDestination(icon: Icon(Icons.repeat), label: '复习'),
            NavigationDestination(icon: Icon(Icons.person), label: '我的'),
          ],
        );
      }),
    );
  }
}

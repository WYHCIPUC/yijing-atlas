import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:yijing_app/features/home/home_page.dart';
import 'package:yijing_app/features/library/hexagram_detail_page.dart';
import 'package:yijing_app/features/library/library_page.dart';
import 'package:yijing_app/features/library/trigram_overview_page.dart';
import 'package:yijing_app/features/placeholder/placeholder_page.dart';

/// 路由常量与 go_router 配置。
class AppRoutes {
  static const library = '/library';
  static const trigrams = '/trigrams';
  static const study = '/study';
  static const review = '/review';
  static const profile = '/profile';

  static final router = GoRouter(
    initialLocation: library,
    routes: [
      ShellRoute(
        builder: (context, state, child) => HomePage(shellChild: child),
        routes: [
          GoRoute(path: library, builder: (_, _) => const LibraryPage()),
          GoRoute(
              path: trigrams,
              builder: (_, _) => const TrigramOverviewPage()),
          GoRoute(
              path: study,
              builder: (_, _) => const PlaceholderPage(title: '学习路径')),
          GoRoute(
              path: review,
              builder: (_, _) => const PlaceholderPage(title: '记忆复习')),
          GoRoute(
              path: profile,
              builder: (_, _) => const PlaceholderPage(title: '我的')),
        ],
      ),
      // 详情页在 ShellRoute 之外，无底部 Tab
      GoRoute(
        path: '/hexagram/:code',
        builder: (_, state) =>
            HexagramDetailPage(state.pathParameters['code']!),
      ),
    ],
  );
}

/// 路由扩展：便捷跳转。
extension AppNav on BuildContext {
  void pushHexagramDetail(String code) => push('/hexagram/$code');
}

import 'package:flutter/material.dart';
import 'package:yijing_app/core/app_routes.dart';
import 'package:yijing_app/core/app_theme.dart';

/// APP 根组件。
class YijingApp extends StatelessWidget {
  const YijingApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: '易经',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      routerConfig: AppRoutes.router,
      debugShowCheckedModeBanner: false,
    );
  }
}

import 'package:flutter/material.dart';

/// 单根爻的绘制描述（纯数据，可单测）。
class LineDescriptor {
  final int position; // 1-6
  final bool isYang;
  final bool isChanging;
  const LineDescriptor(this.position, this.isYang, this.isChanging);
}

/// 六爻图绘制器。接收 6 位二进制串（自下而上），用 CustomPainter 绘制。
///
/// 阳爻：一长横 ▬▬▬▬▬；阴爻：两短横 ▬▬ ▬▬；变爻加红色标记线。
class HexagramPainter extends CustomPainter {
  final String binaryCode;
  final Set<int>? changingPositions; // 变爻位置（占卦用，第 1 期不用）

  HexagramPainter(this.binaryCode, {this.changingPositions});

  /// 纯逻辑：二进制串 → 自下而上的爻描述列表（index 0 = 爻1 = 最底）。
  static List<LineDescriptor> describeLines(
    String code, {
    Set<int>? changingPositions,
  }) {
    if (!RegExp(r'^[01]{6}$').hasMatch(code)) {
      throw ArgumentError('需要 6 位 0/1 串: $code');
    }
    return [
      for (int i = 0; i < 6; i++)
        LineDescriptor(
          i + 1,
          code[i] == '1',
          changingPositions?.contains(i + 1) ?? false,
        ),
    ];
  }

  @override
  void paint(Canvas canvas, Size size) {
    final lines = describeLines(binaryCode, changingPositions: changingPositions);
    final lineH = size.height / 7; // 6 爻 + 间隔
    final fullW = size.width;
    final breakW = fullW * 0.28; // 阴爻中间断开的长度
    final paint = Paint()
      ..color = Colors.black87
      ..strokeWidth = lineH * 0.55
      ..strokeCap = StrokeCap.round;

    for (int i = 0; i < 6; i++) {
      // 自下而上：i=0 画最底（y 最大）
      final y = size.height - (i + 1) * lineH;
      final desc = lines[i];
      if (desc.isYang) {
        canvas.drawLine(Offset(0, y), Offset(fullW, y), paint);
      } else {
        canvas.drawLine(
            Offset(0, y), Offset((fullW - breakW) / 2, y), paint);
        canvas.drawLine(Offset((fullW + breakW) / 2, y),
            Offset(fullW, y), paint);
      }
      if (desc.isChanging) {
        final accent = Paint()
          ..color = Colors.red
          ..strokeWidth = 2;
        canvas.drawLine(
            Offset(0, y - lineH * 0.4), Offset(fullW, y - lineH * 0.4), accent);
      }
    }
  }

  @override
  bool shouldRepaint(covariant HexagramPainter old) =>
      binaryCode != old.binaryCode ||
      changingPositions != old.changingPositions;
}

/// 包装为 Widget，便于复用。
class HexagramView extends StatelessWidget {
  final String binaryCode;
  final double size;
  final Set<int>? changingPositions;
  const HexagramView(this.binaryCode,
      {this.size = 120, this.changingPositions, super.key});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(size, size),
      painter: HexagramPainter(binaryCode, changingPositions: changingPositions),
    );
  }
}

import 'package:flutter/material.dart';

/// 八卦符号绘制器。接收 3 位二进制串（自下而上），用 CustomPainter 绘制。
class TrigramPainter extends CustomPainter {
  final String binaryCode; // 3 位
  TrigramPainter(this.binaryCode);

  @override
  void paint(Canvas canvas, Size size) {
    if (!RegExp(r'^[01]{3}$').hasMatch(binaryCode)) return;
    final lineH = size.height / 4;
    final fullW = size.width;
    final breakW = fullW * 0.30;
    final paint = Paint()
      ..color = Colors.black87
      ..strokeWidth = lineH * 0.6
      ..strokeCap = StrokeCap.round;

    for (int i = 0; i < 3; i++) {
      final y = size.height - (i + 1) * lineH;
      if (binaryCode[i] == '1') {
        canvas.drawLine(Offset(0, y), Offset(fullW, y), paint);
      } else {
        canvas.drawLine(
            Offset(0, y), Offset((fullW - breakW) / 2, y), paint);
        canvas.drawLine(Offset((fullW + breakW) / 2, y),
            Offset(fullW, y), paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant TrigramPainter old) =>
      binaryCode != old.binaryCode;
}

class TrigramView extends StatelessWidget {
  final String binaryCode;
  final double size;
  const TrigramView(this.binaryCode, {this.size = 64, super.key});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
        size: Size(size, size), painter: TrigramPainter(binaryCode));
  }
}

# 易经学习 APP · 第 1 期（MVP 地基与核心查阅）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Flutter 项目骨架、领域模型、64 卦本经结构化数据，实现"查阅 64 卦 + 八卦基础"的可用离线 APP（MVP）。

**Architecture:** 分层架构（domain / data / application / presentation）。领域层为纯 Dart 模型，数据层用 JSON 资源 + Repository 模式，状态管理用 Riverpod，路由用 go_router。卦以 6 位二进制串（自下而上）作主键，启动时自检 64 卦完整性。

**Tech Stack:** Flutter (Dart), Riverpod, go_router, sqflite/drift（第 1 期仅配置，第 2 期启用），flutter_markdown（原文展示），CustomPainter（卦象绘制）

**环境前置：** Android SDK ✅，Java 17 ✅，Flutter SDK ❌（Task 0 安装）

---

## 文件结构总览

实施完成后的目录结构（每个文件单一职责）：

```
yijing_app/                              # Flutter 项目根
├── pubspec.yaml
├── assets/data/
│   ├── trigrams.json                    # 八卦数据（8 条）
│   └── hexagrams.json                   # 64 卦数据（核心）
├── lib/
│   ├── main.dart                        # 入口：初始化、ProviderScope、路由
│   ├── core/
│   │   ├── app.dart                     # MaterialApp、主题、go_router 配置
│   │   ├── app_theme.dart               # 主题数据
│   │   └── app_routes.dart              # 路由常量与定义
│   ├── domain/
│   │   ├── trigram.dart                 # 八卦模型
│   │   ├── yao.dart                     # 爻模型
│   │   ├── hexagram.dart                # 卦模型
│   │   └── hexagram_utils.dart          # 二进制串/卦位运算工具
│   ├── data/
│   │   ├── hexagram_repository.dart     # 读 hexagrams.json
│   │   ├── trigram_repository.dart      # 读 trigrams.json
│   │   └── data_integrity.dart          # 启动自检
│   ├── application/
│   │   ├── providers.dart               # Riverpod providers
│   │   └── hexagram_search.dart         # 检索状态（Noti­fier）
│   ├── shared/
│   │   └── widgets/
│   │       ├── hexagram_painter.dart    # 六爻绘制
│   │       └── trigram_painter.dart     # 八卦符号绘制
│   └── features/
│       ├── home/                        # 底部 Tab 首页
│       │   └── home_page.dart
│       ├── library/                     # 查阅库
│       │   ├── library_page.dart        # 64 卦总览+搜索
│       │   ├── hexagram_detail_page.dart # 卦象详情
│       │   └── trigram_overview_page.dart # 八卦基础页
│       └── placeholder/                 # 占位（学习/复习 Tab）
│           └── placeholder_page.dart
├── test/
│   ├── domain/
│   │   ├── hexagram_utils_test.dart
│   │   └── hexagram_test.dart
│   ├── data/
│   │   ├── hexagram_repository_test.dart
│   │   └── data_integrity_test.dart
│   └── shared/
│       └── hexagram_painter_test.dart
```

---

## Task 0: 安装 Flutter SDK 并验证环境

**Files:** 无（环境准备）

- [ ] **Step 1: 下载 Flutter SDK 到 C:\flutter**

在 Windows 终端（PowerShell 或 cmd）执行（用 Git clone stable channel）：

```bash
cd /c
git clone -b stable --depth 1 https://github.com/flutter/flutter.git
```

如 git clone 较慢，可改用官网 zip：下载 `https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_<version>-stable.zip` 解压到 `C:\flutter`。

- [ ] **Step 2: 把 Flutter 加入 PATH（本会话）**

在 Git Bash 执行：

```bash
export PATH="/c/flutter/bin:$PATH"
```

为持久化，追加到 `~/.bashrc`：

```bash
echo 'export PATH="/c/flutter/bin:$PATH"' >> ~/.bashrc
```

- [ ] **Step 3: 验证 flutter 命令可用**

Run: `flutter --version`
Expected: 输出 Flutter 版本号与 Dart 版本号（首次会下载 Dart SDK，可能需几分钟）。

- [ ] **Step 4: 运行 flutter doctor 诊断**

Run: `flutter doctor`
Expected: 看到 Android toolchain ✓（Android SDK 已就绪）。若有缺项记录，但不阻塞——第 1 期只需 Android 构建能力。

- [ ] **Step 5: 创建工程目录的 git 仓库**

```bash
cd /c/Users/1/ZCodeProject
git init
git add docs/
git commit -m "docs: 易经学习 APP 设计文档"
```

---

## Task 1: 创建 Flutter 项目骨架

**Files:**
- Create: `yijing_app/` 整个项目（flutter create 生成）

- [ ] **Step 1: 创建 Flutter 项目**

```bash
cd /c/Users/1/ZCodeProject
flutter create --org com.yijing --project-name yijing_app --platforms=android yijing_app
```

Expected: 生成 `yijing_app/` 目录，含 `lib/main.dart`、`pubspec.yaml`、`android/` 等。

- [ ] **Step 2: 添加依赖到 pubspec.yaml**

编辑 `yijing_app/pubspec.yaml`，在 `dependencies:` 下添加：

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5
  go_router: ^14.2.0
  freezed_annotation: ^2.4.4
  json_annotation: ^4.9.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0
  build_runner: ^2.4.11
  freezed: ^2.5.7
  json_serializable: ^6.8.0
  riverpod_generator: ^2.4.3
```

- [ ] **Step 3: 拉取依赖**

Run: `cd yijing_app && flutter pub get`
Expected: 依赖下载完成，无报错。

- [ ] **Step 4: 验证空项目可编译**

Run: `flutter analyze`
Expected: 无 error（可有 info 级提示）。

- [ ] **Step 5: 配置 assets 路径**

在 `pubspec.yaml` 的 `flutter:` 段添加：

```yaml
flutter:
  uses-material-design: true
  assets:
    - assets/data/
```

创建空目录占位：`mkdir -p assets/data`

- [ ] **Step 6: Commit**

```bash
cd /c/Users/1/ZCodeProject
git add yijing_app/
git commit -m "feat: 初始化 Flutter 项目骨架与依赖"
```

---

## Task 2: 领域模型 —— Trigram（八卦）

**Files:**
- Create: `lib/domain/trigram.dart`
- Test: `test/domain/trigram_test.dart`

- [ ] **Step 1: 写失败测试**

Create `test/domain/trigram_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/domain/trigram.dart';

void main() {
  group('Trigram', () {
    test('乾卦二进制为 111，自然为天，德性为健', () {
      const qian = Trigram(
        name: '乾',
        binaryCode: '111',
        nature: '天',
        attribute: '健',
        direction: '南',      // 先天方位
        familyMember: '父',
      );
      expect(qian.binaryCode, '111');
      expect(qian.nature, '天');
      expect(qian.attribute, '健');
    });

    test('二进制串长度校验拒绝非法值', () {
      expect(
        () => const Trigram(
          name: '错', binaryCode: '1101', nature: '', attribute: '',
          direction: '', familyMember: '',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd yijing_app && flutter test test/domain/trigram_test.dart`
Expected: FAIL（类不存在）。

- [ ] **Step 3: 实现 Trigram 模型**

Create `lib/domain/trigram.dart`:

```dart
/// 八卦（经卦）：三爻构成的基础卦。
class Trigram {
  final String name;          // 乾 兑 离 震 巽 坎 艮 坤
  final String binaryCode;    // 3 位二进制串，自下而上，阳爻1阴爻0
  final String nature;        // 自然属性：天泽火雷风水山地
  final String attribute;     // 德性：健悦丽动入陷止顺
  final String direction;     // 先天方位
  final String familyMember;  // 家庭成员

  const Trigram({
    required this.name,
    required this.binaryCode,
    required this.nature,
    required this.attribute,
    required this.direction,
    required this.familyMember,
  }) {
    if (binaryCode.length != 3 ||
        !RegExp(r'^[01]{3}$').hasMatch(binaryCode)) {
      throw ArgumentError('binaryCode 必须是 3 位 0/1 串，得到: $binaryCode');
    }
  }

  factory Trigram.fromJson(Map<String, dynamic> json) => Trigram(
        name: json['name'] as String,
        binaryCode: json['binaryCode'] as String,
        nature: json['nature'] as String,
        attribute: json['attribute'] as String,
        direction: json['direction'] as String,
        familyMember: json['familyMember'] as String,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'binaryCode': binaryCode,
        'nature': nature,
        'attribute': attribute,
        'direction': direction,
        'familyMember': familyMember,
      };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `flutter test test/domain/trigram_test.dart`
Expected: PASS（2 个测试）。

- [ ] **Step 5: Commit**

```bash
git add yijing_app/lib/domain/trigram.dart yijing_app/test/domain/trigram_test.dart
git commit -m "feat(domain): 添加 Trigram 八卦模型"
```

---

## Task 3: 领域模型 —— Yao（爻）

**Files:**
- Create: `lib/domain/yao.dart`
- Test: `test/domain/yao_test.dart`

- [ ] **Step 1: 写失败测试**

Create `test/domain/yao_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/domain/yao.dart';

void main() {
  group('Yao', () {
    test('初九：阳爻，位置1，当位', () {
      const yao = Yao(
        position: 1,
        isYang: true,
        text: '初九：潜龙勿用。',
        xiang: '潜龙勿用，阳在下也。',
      );
      expect(yao.isYang, true);
      expect(yao.isCorrectPosition, true); // 奇位阳爻为当位
      expect(yao.label, '初九');
    });

    test('六三：阴爻，位置3，失位（奇位阴爻）', () {
      const yao = Yao(
        position: 3,
        isYang: false,
        text: '六三：含章可贞。',
        xiang: '',
      );
      expect(yao.isCorrectPosition, false);
      expect(yao.label, '六三');
    });

    test('位置范围校验 1-6', () {
      expect(
        () => const Yao(position: 7, isYang: true, text: '', xiang: ''),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `flutter test test/domain/yao_test.dart`
Expected: FAIL（类不存在）。

- [ ] **Step 3: 实现 Yao 模型**

Create `lib/domain/yao.dart`:

```dart
/// 爻：构成卦的六爻之一，自下而上编号 1-6。
class Yao {
  final int position;        // 1-6，自下而上
  final bool isYang;         // true=阳爻，false=阴爻
  final String text;         // 爻辞，如"初九：潜龙勿用。"
  final String xiang;        // 小象传（解释该爻）

  const Yao({
    required this.position,
    required this.isYang,
    required this.text,
    required this.xiang,
  }) {
    if (position < 1 || position > 6) {
      throw ArgumentError('position 必须在 1-6，得到: $position');
    }
  }

  /// 当位：阳爻居奇位(1,3,5)、阴爻居偶位(2,4,6) 为 true。
  bool get isCorrectPosition =>
      isYang ? position.isOdd : position.isEven;

  /// 爻题：阳爻用"九"，阴爻用"六"，配位置名（初/二三四/五/上）。
  String get label {
    const positionNames = ['', '初', '二', '三', '四', '五', '上'];
    final yinYang = isYang ? '九' : '六';
    // 初、上：位名+阴阳（初九、上六）；中位：阴阳+位名（九二、六五）
    if (position == 1 || position == 6) {
      return '${positionNames[position]}$yinYang';
    }
    return '$yinYang${positionNames[position]}';
  }

  factory Yao.fromJson(Map<String, dynamic> json) => Yao(
        position: json['position'] as int,
        isYang: json['isYang'] as bool,
        text: json['text'] as String,
        xiang: json['xiang'] as String,
      );

  Map<String, dynamic> toJson() => {
        'position': position,
        'isYang': isYang,
        'text': text,
        'xiang': xiang,
      };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `flutter test test/domain/yao_test.dart`
Expected: PASS（3 个测试）。

- [ ] **Step 5: Commit**

```bash
git add yijing_app/lib/domain/yao.dart yijing_app/test/domain/yao_test.dart
git commit -m "feat(domain): 添加 Yao 爻模型与当位判定"
```

---

## Task 4: 领域模型 —— Hexagram（卦）

**Files:**
- Create: `lib/domain/hexagram.dart`
- Test: `test/domain/hexagram_test.dart`

- [ ] **Step 1: 写失败测试**

Create `test/domain/hexagram_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/domain/hexagram.dart';
import 'package:yijing_app/domain/yao.dart';

void main() {
  group('Hexagram', () {
    final qianYao = List.generate(
      6,
      (i) => Yao(position: i + 1, isYang: true, text: '爻${i + 1}', xiang: ''),
    );

    test('乾卦：6 阳爻，binaryCode=111111', () {
      final qian = Hexagram(
        number: 1,
        name: '乾',
        fullName: '乾为天',
        binaryCode: '111111',
        trigramLowerCode: '111',
        trigramUpperCode: '111',
        judgement: '乾：元，亨，利，贞。',
        image: '天行健，君子以自强不息。',
        tuan: '大哉乾元……',
        lines: qianYao,
        useNine: '用九：见群龙无首，吉。',
        useSix: null,
        orderRemark: '有天地，然后万物生焉。',
      );
      expect(qian.binaryCode, '111111');
      expect(qian.useNine, isNotNull);
      expect(qian.useSix, isNull);
      expect(qian.lines.length, 6);
    });

    test('binaryCode 长度校验', () {
      expect(
        () => Hexagram(
          number: 1, name: '', fullName: '', binaryCode: '11',
          trigramLowerCode: '111', trigramUpperCode: '111',
          judgement: '', image: '', tuan: '', lines: qianYao,
          useNine: null, useSix: null, orderRemark: '',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('binaryCode 与 lines 爻象一致性校验', () {
      // lines 第一个是阳爻，但 binaryCode 末位（爻1）是 0 → 矛盾
      expect(
        () => Hexagram(
          number: 1, name: '', fullName: '', binaryCode: '011111',
          trigramLowerCode: '111', trigramUpperCode: '011',
          judgement: '', image: '', tuan: '', lines: qianYao,
          useNine: null, useSix: null, orderRemark: '',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `flutter test test/domain/hexagram_test.dart`
Expected: FAIL。

- [ ] **Step 3: 实现 Hexagram 模型**

Create `lib/domain/hexagram.dart`:

```dart
import 'yao.dart';

/// 卦（别卦）：六爻构成，64 卦之一。
class Hexagram {
  final int number;            // 卦序 1-64（周易序卦）
  final String name;           // 卦名，如"乾"
  final String fullName;       // 全称，如"乾为天"
  final String binaryCode;     // ★ 6 位二进制，自下而上，阳爻1阴爻0；卦的主键
  final String trigramLowerCode; // 下卦（内卦）binaryCode
  final String trigramUpperCode; // 上卦（外卦）binaryCode
  final String judgement;      // 卦辞
  final String image;          // 大象传
  final String tuan;           // 彖传
  final List<Yao> lines;       // 6 爻，自下而上
  final String? useNine;       // 用九（仅乾卦）
  final String? useSix;        // 用六（仅坤卦）
  final String orderRemark;    // 序卦传说明

  const Hexagram({
    required this.number,
    required this.name,
    required this.fullName,
    required this.binaryCode,
    required this.trigramLowerCode,
    required this.trigramUpperCode,
    required this.judgement,
    required this.image,
    required this.tuan,
    required this.lines,
    required this.useNine,
    required this.useSix,
    required this.orderRemark,
  }) {
    if (!RegExp(r'^[01]{6}$').hasMatch(binaryCode)) {
      throw ArgumentError('binaryCode 必须是 6 位 0/1 串，得到: $binaryCode');
    }
    // binaryCode 与 lines 爻象一致性：binaryCode[i] 对应 lines[i].isYang
    for (var i = 0; i < 6; i++) {
      final codeIsYang = binaryCode[i] == '1';
      if (codeIsYang != lines[i].isYang) {
        throw ArgumentError(
          'binaryCode[${i}]（爻${i + 1}）与 lines[$i].isYang 不一致',
        );
      }
    }
  }

  factory Hexagram.fromJson(Map<String, dynamic> json) => Hexagram(
        number: json['number'] as int,
        name: json['name'] as String,
        fullName: json['fullName'] as String,
        binaryCode: json['binaryCode'] as String,
        trigramLowerCode: json['trigramLower'] as String,
        trigramUpperCode: json['trigramUpper'] as String,
        judgement: json['judgement'] as String,
        image: json['image'] as String,
        tuan: json['tuan'] as String,
        lines: (json['lines'] as List)
            .map((e) => Yao.fromJson(e as Map<String, dynamic>))
            .toList(),
        useNine: json['useNine'] as String?,
        useSix: json['useSix'] as String?,
        orderRemark: json['orderRemark'] as String,
      );

  /// 下卦（内卦）= binaryCode 前 3 位。
  String get lowerTrigramCode => binaryCode.substring(0, 3);

  /// 上卦（外卦）= binaryCode 后 3 位。
  String get upperTrigramCode => binaryCode.substring(3, 6);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `flutter test test/domain/hexagram_test.dart`
Expected: PASS（3 个测试）。

- [ ] **Step 5: Commit**

```bash
git add yijing_app/lib/domain/hexagram.dart yijing_app/test/domain/hexagram_test.dart
git commit -m "feat(domain): 添加 Hexagram 卦模型与一致性校验"
```

---

## Task 5: 领域工具 —— HexagramUtils（卦位运算）

**Files:**
- Create: `lib/domain/hexagram_utils.dart`
- Test: `test/domain/hexagram_utils_test.dart`

- [ ] **Step 1: 写失败测试**

Create `test/domain/hexagram_utils_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/domain/hexagram_utils.dart';

void main() {
  group('HexagramUtils', () {
    test('错卦：每位取反', () {
      expect(HexagramUtils.oppositeCode('111111'), '000000'); // 乾↔坤
      expect(HexagramUtils.oppositeCode('010001'), '101110');
    });

    test('综卦：上下翻转（整体倒序）', () {
      // 111000（泰，下乾上坤）综卦 = 000111（否，翻转）
      expect(HexagramUtils.reversedCode('111000'), '000111');
    });

    test('下卦 = 前3位，上卦 = 后3位', () {
      expect(HexagramUtils.lowerOf('110010'), '110');
      expect(HexagramUtils.upperOf('110010'), '010');
    });

    test('由下上两卦合成 6 位串', () {
      expect(HexagramUtils.combine(lower: '110', upper: '010'), '110010');
    });

    test('所有合法 6 位串共 64 个', () {
      final all = HexagramUtils.allBinaryCodes();
      expect(all.length, 64);
      expect(all.toSet().length, 64); // 无重复
    });
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `flutter test test/domain/hexagram_utils_test.dart`
Expected: FAIL。

- [ ] **Step 3: 实现 HexagramUtils**

Create `lib/domain/hexagram_utils.dart`:

```dart
/// 卦象位运算工具。所有运算基于 6 位二进制串（自下而上）。
class HexagramUtils {
  HexagramUtils._();

  /// 错卦（旁通卦）：每一位取反（阴阳互换）。
  static String oppositeCode(String code) {
    _validate(code);
    return code.split('').map((b) => b == '1' ? '0' : '1').join();
  }

  /// 综卦（反卦）：整体上下翻转（爻序倒置）。
  static String reversedCode(String code) {
    _validate(code);
    return code.split('').reversed.join();
  }

  /// 下卦（内卦）= 前 3 位（爻1-3）。
  static String lowerOf(String code) {
    _validate(code);
    return code.substring(0, 3);
  }

  /// 上卦（外卦）= 后 3 位（爻4-6）。
  static String upperOf(String code) {
    _validate(code);
    return code.substring(3, 6);
  }

  /// 由下卦、上卦合成 6 位串。
  static String combine({required String lower, required String upper}) {
    return '$lower$upper';
  }

  /// 生成全部 64 个合法 6 位二进制串。
  static List<String> allBinaryCodes() {
    return [
      for (var i = 0; i < 64; i++)
        i.toRadixString(2).padLeft(6, '0'),
    ];
  }

  static void _validate(String code) {
    if (!RegExp(r'^[01]{6}$').hasMatch(code)) {
      throw ArgumentError('需要 6 位 0/1 串，得到: $code');
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `flutter test test/domain/hexagram_utils_test.dart`
Expected: PASS（5 个测试）。

- [ ] **Step 5: Commit**

```bash
git add yijing_app/lib/domain/hexagram_utils.dart yijing_app/test/domain/hexagram_utils_test.dart
git commit -m "feat(domain): 添加 HexagramUtils 卦位运算工具"
```

---

## Task 6: 数据准备 —— trigrams.json（八卦数据）

**Files:**
- Create: `assets/data/trigrams.json`

- [ ] **Step 1: 创建八卦数据文件**

Create `yijing_app/assets/data/trigrams.json`:

```json
[
  {
    "name": "乾",
    "binaryCode": "111",
    "nature": "天",
    "attribute": "健",
    "direction": "南",
    "familyMember": "父"
  },
  {
    "name": "兑",
    "binaryCode": "110",
    "nature": "泽",
    "attribute": "悦",
    "direction": "东南",
    "familyMember": "少女"
  },
  {
    "name": "离",
    "binaryCode": "101",
    "nature": "火",
    "attribute": "丽",
    "direction": "东",
    "familyMember": "中女"
  },
  {
    "name": "震",
    "binaryCode": "100",
    "nature": "雷",
    "attribute": "动",
    "direction": "东北",
    "familyMember": "长男"
  },
  {
    "name": "巽",
    "binaryCode": "011",
    "nature": "风",
    "attribute": "入",
    "direction": "西南",
    "familyMember": "长女"
  },
  {
    "name": "坎",
    "binaryCode": "010",
    "nature": "水",
    "attribute": "陷",
    "direction": "西",
    "familyMember": "中男"
  },
  {
    "name": "艮",
    "binaryCode": "001",
    "nature": "山",
    "attribute": "止",
    "direction": "西北",
    "familyMember": "少男"
  },
  {
    "name": "坤",
    "binaryCode": "000",
    "nature": "地",
    "attribute": "顺",
    "direction": "北",
    "familyMember": "母"
  }
]
```

说明：binaryCode 自下而上（下爻→上爻）。如震卦 ☳ 下阳上阴：下爻=1、中爻=0、上爻=0 → "100"。

- [ ] **Step 2: Commit**

```bash
git add yijing_app/assets/data/trigrams.json
git commit -m "feat(data): 添加八卦基础数据"
```

---

## Task 7: 数据准备 —— hexagrams.json（64 卦数据）

**Files:**
- Create: `assets/data/hexagrams.json`

- [ ] **Step 1: 创建 64 卦数据文件**

创建 `yijing_app/assets/data/hexagrams.json`，结构为数组，每个元素格式：

```json
{
  "number": 1,
  "name": "乾",
  "fullName": "乾为天",
  "binaryCode": "111111",
  "trigramLower": "111",
  "trigramUpper": "111",
  "judgement": "乾：元，亨，利，贞。",
  "image": "天行健，君子以自强不息。",
  "tuan": "大哉乾元，万物资始，乃统天。云行雨施，品物流形。",
  "lines": [
    { "position": 1, "isYang": true, "text": "初九：潜龙勿用。", "xiang": "潜龙勿用，阳在下也。" },
    { "position": 2, "isYang": true, "text": "九二：见龙在田，利见大人。", "xiang": "见龙在田，德施普也。" },
    { "position": 3, "isYang": true, "text": "九三：君子终日乾乾，夕惕若厉，无咎。", "xiang": "终日乾乾，反复道也。" },
    { "position": 4, "isYang": true, "text": "九四：或跃在渊，无咎。", "xiang": "或跃在渊，进无咎也。" },
    { "position": 5, "isYang": true, "text": "九五：飞龙在天，利见大人。", "xiang": "飞龙在天，大人造也。" },
    { "position": 6, "isYang": true, "text": "上九：亢龙有悔。", "xiang": "亢龙有悔，盈不可久也。" }
  ],
  "useNine": "用九：见群龙无首，吉。",
  "useSix": null,
  "orderRemark": "有天地，然后万物生焉。盈天地之间者唯万物，故受之以屯。"
}
```

将 64 卦全部填入（周易序卦顺序）。binaryCode 对照表（自下而上）需严格按各卦爻象填写。**关键：64 个 binaryCode 必须互不重复且覆盖所有合法组合。**

参考 binaryCode 对照（节选，自下而上）：
- 1 乾 111111、2 坤 000000、3 屯 100010、4 蒙 010001、5 需 111010、6 讼 010111、7 师 010000、8 比 000010、9 小畜 111011、10 履 110111、11 泰 111000、12 否 000111、13 同人 101111、14 大有 111101、15 谦 000100、16 豫 001000、17 随 100110、18 蛊 011001、19 临 110000、20 观 000011、21 噬嗑 100101、22 贲 101001、23 剥 000001、24 复 100000、25 无妄 100111、26 大畜 111001、27 颐 100001、28 大过 011110、29 坎 010010、30 离 101101、31 咸 001110、32 恒 011100、33 遁 001111、34 大壮 111100、35 晋 000101、36 明夷 101000、37 家人 101011、38 睽 110101、39 蹇 001010、40 解 010100、41 损 110001、42 益 100011、43 夬 011111、44 姤 111110、45 萃 000110、46 升 011000、47 困 010110、48 井 011010、49 革 101110、50 鼎 011101、51 震 100100、52 艮 001001、53 渐 001011、54 归妹 110100、55 丰 101100、56 旅 001101、57 巽 011011、58 兑 110110、59 涣 010011、60 节 110010、61 中孚 110011、62 小过 001100、63 既济 101010、64 未济 010101

其余字段（卦辞/爻辞/大象/彖/序卦）填入公版《周易》原文。坤卦填 useSix、其余卦 useNine/useSix 均为 null。

- [ ] **Step 2: Commit**

```bash
git add yijing_app/assets/data/hexagrams.json
git commit -m "feat(data): 添加 64 卦本经数据"
```

---

## Task 8: 数据层 —— Repository（读取 JSON）

**Files:**
- Create: `lib/data/hexagram_repository.dart`
- Create: `lib/data/trigram_repository.dart`
- Test: `test/data/hexagram_repository_test.dart`

- [ ] **Step 1: 写失败测试（用 testAssets 验证真实 JSON 解析）**

需在 `pubspec.yaml` 的测试资源声明。先在 `pubspec.yaml` 顶层确保 `assets/data/` 已在 `flutter.assets`（Task 1 已配）。测试用 `rootBundle`，但单元测试环境需用 `AssetBundle` 注入。改用更直接的方式：测试中手动解析 JSON 字符串验证 fromJson 逻辑，集成验证留给 Widget 测试。

Create `test/data/hexagram_repository_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/data/hexagram_repository.dart';
import 'package:yijing_app/domain/hexagram.dart';

void main() {
  group('HexagramRepository parsing', () {
    test('解析 64 卦 JSON 字符串', () {
      const raw = '''
[
  {
    "number": 1, "name": "乾", "fullName": "乾为天",
    "binaryCode": "111111", "trigramLower": "111", "trigramUpper": "111",
    "judgement": "乾：元，亨，利，贞。",
    "image": "天行健，君子以自强不息。",
    "tuan": "大哉乾元。",
    "lines": [
      {"position":1,"isYang":true,"text":"初九：潜龙勿用。","xiang":""},
      {"position":2,"isYang":true,"text":"九二：见龙在田。","xiang":""},
      {"position":3,"isYang":true,"text":"九三：终日乾乾。","xiang":""},
      {"position":4,"isYang":true,"text":"九四：或跃在渊。","xiang":""},
      {"position":5,"isYang":true,"text":"九五：飞龙在天。","xiang":""},
      {"position":6,"isYang":true,"text":"上九：亢龙有悔。","xiang":""}
    ],
    "useNine": "用九：见群龙无首，吉。",
    "useSix": null,
    "orderRemark": ""
  }
]
''';
      final list = HexagramRepository.parseJsonString(raw);
      expect(list.length, 1);
      expect(list.first.name, '乾');
      expect(list.first.useNine, isNotNull);
    });

    test('按 binaryCode 查找', () {
      const raw = '[{"number":2,"name":"坤","fullName":"坤为地","binaryCode":"000000","trigramLower":"000","trigramUpper":"000","judgement":"","image":"","tuan":"","lines":[{"position":1,"isYang":false,"text":"","xiang":""},{"position":2,"isYang":false,"text":"","xiang":""},{"position":3,"isYang":false,"text":"","xiang":""},{"position":4,"isYang":false,"text":"","xiang":""},{"position":5,"isYang":false,"text":"","xiang":""},{"position":6,"isYang":false,"text":"","xiang":""}],"useNine":null,"useSix":"用六","orderRemark":""}]';
      final repo = HexagramRepository(parseResult: HexagramRepository.parseJsonString(raw));
      expect(repo.findByBinaryCode('000000')?.name, '坤');
      expect(repo.findByNumber(2)?.name, '坤');
      expect(repo.findByName('坤')?.binaryCode, '000000');
    });
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `flutter test test/data/hexagram_repository_test.dart`
Expected: FAIL（类不存在）。

- [ ] **Step 3: 实现 HexagramRepository**

Create `lib/data/hexagram_repository.dart`:

```dart
import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:yijing_app/domain/hexagram.dart';

/// 读取并缓存 hexagrams.json，提供按序号/名/binaryCode 查询。
class HexagramRepository {
  final List<Hexagram> _all;
  final Map<String, Hexagram> _byCode;
  final Map<int, Hexagram> _byNumber;
  final Map<String, Hexagram> _byName;

  HexagramRepository({required List<Hexagram> parseResult})
      : _all = parseResult,
        _byCode = {for (final h in parseResult) h.binaryCode: h},
        _byNumber = {for (final h in parseResult) h.number: h},
        _byName = {for (final h in parseResult) h.name: h};

  /// 从 assets 异步加载。
  static Future<HexagramRepository> load(
      [String assetPath = 'assets/data/hexagrams.json']) async {
    final raw = await rootBundle.loadString(assetPath);
    return HexagramRepository(parseResult: parseJsonString(raw));
  }

  /// 解析 JSON 字符串为 Hexagram 列表（便于测试注入）。
  static List<Hexagram> parseJsonString(String raw) {
    final list = jsonDecode(raw) as List;
    return list
        .map((e) => Hexagram.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  List<Hexagram> get all => List.unmodifiable(_all);

  Hexagram? findByBinaryCode(String code) => _byCode[code];
  Hexagram? findByNumber(int number) => _byNumber[number];
  Hexagram? findByName(String name) => _byName[name];

  /// 全文检索：在 卦名/卦辞/大象/爻辞 中查找关键词。
  List<Hexagram> search(String keyword) {
    if (keyword.isEmpty) return all;
    final kw = keyword.toLowerCase();
    bool hit(String s) => s.toLowerCase().contains(kw);
    return _all.where((h) {
      if (hit(h.name) || hit(h.fullName) || hit(h.judgement) ||
          hit(h.image) || hit(h.tuan) || hit(h.orderRemark)) {
        return true;
      }
      return h.lines.any((y) => hit(y.text) || hit(y.xiang));
    }).toList();
  }
}
```

- [ ] **Step 4: 实现 TrigramRepository**

Create `lib/data/trigram_repository.dart`:

```dart
import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:yijing_app/domain/trigram.dart';

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
      items: list.map((e) => Trigram.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  List<Trigram> get all => List.unmodifiable(_all);
  Trigram? findByCode(String code) => _byCode[code];
  Trigram? findByName(String name) => _byName[name];
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `flutter test test/data/hexagram_repository_test.dart`
Expected: PASS（2 个测试）。

- [ ] **Step 6: Commit**

```bash
git add yijing_app/lib/data/ yijing_app/test/data/
git commit -m "feat(data): 添加 Hexagram/Trigram Repository 与全文检索"
```

---

## Task 9: 数据层 —— 启动自检（DataIntegrity）

**Files:**
- Create: `lib/data/data_integrity.dart`
- Test: `test/data/data_integrity_test.dart`

- [ ] **Step 1: 写失败测试**

Create `test/data/data_integrity_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/data/data_integrity.dart';
import 'package:yijing_app/domain/hexagram.dart';
import 'package:yijing_app/domain/trigram.dart';
import 'package:yijing_app/domain/yao.dart';

Hexagram _mk(int n, String code) {
  final lines = [
    for (int i = 0; i < 6; i++)
      Yao(position: i + 1, isYang: code[i] == '1', text: '', xiang: ''),
  ];
  return Hexagram(
    number: n, name: '卦$n', fullName: '', binaryCode: code,
    trigramLowerCode: code.substring(0, 3), trigramUpperCode: code.substring(3),
    judgement: '', image: '', tuan: '', lines: lines,
    useNine: null, useSix: null, orderRemark: '',
  );
}

void main() {
  group('DataIntegrity', () {
    test('完整 64 卦通过校验', () {
      final all = [
        for (int i = 0; i < 64; i++)
          _mk(i + 1, i.toRadixString(2).padLeft(6, '0')),
      ];
      expect(() => DataIntegrity.validateHexagrams(all), returnsNormally);
    });

    test('卦数不是 64 报错', () {
      expect(
        () => DataIntegrity.validateHexagrams([_mk(1, '000000')]),
        throwsA(isA<StateError>()),
      );
    });

    test('binaryCode 重复报错', () {
      final all = [
        for (int i = 0; i < 63; i++)
          _mk(i + 1, i.toRadixString(2).padLeft(6, '0')),
        _mk(64, '000000'), // 与第 1 个重复
      ];
      expect(
        () => DataIntegrity.validateHexagrams(all),
        throwsA(isA<StateError>()),
      );
    });

    test('卦序必须 1-64 连续', () {
      final all = [
        for (int i = 0; i < 64; i++)
          _mk(i == 0 ? 99 : i + 1, i.toRadixString(2).padLeft(6, '0')),
      ];
      expect(
        () => DataIntegrity.validateHexagrams(all),
        throwsA(isA<StateError>()),
      );
    });

    test('八卦 8 条且 binaryCode 唯一', () {
      final trigrams = [
        for (int i = 0; i < 8; i++)
          Trigram(name: 'T$i', binaryCode: i.toRadixString(2).padLeft(3, '0'),
              nature: '', attribute: '', direction: '', familyMember: ''),
      ];
      expect(() => DataIntegrity.validateTrigrams(trigrams), returnsNormally);
    });
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `flutter test test/data/data_integrity_test.dart`
Expected: FAIL。

- [ ] **Step 3: 实现 DataIntegrity**

Create `lib/data/data_integrity.dart`:

```dart
import 'package:yijing_app/domain/hexagram.dart';
import 'package:yijing_app/domain/trigram.dart';

/// 启动自检：确保内容数据满足易经正确性的硬性约束。
class DataIntegrity {
  DataIntegrity._();

  /// 校验 64 卦：数量 64、binaryCode 唯一且全覆盖、卦序 1-64 连续。
  static void validateHexagrams(List<Hexagram> all) {
    if (all.length != 64) {
      throw StateError('卦的数量必须为 64，实际 ${all.length}');
    }
    final codes = all.map((h) => h.binaryCode).toSet();
    if (codes.length != 64) {
      throw StateError('存在重复的 binaryCode，唯一数 ${codes.length}');
    }
    final numbers = all.map((h) => h.number).toSet();
    final expected = {for (var i = 1; i <= 64; i++) i};
    if (!numbers.containsAll(expected) || numbers.length != 64) {
      throw StateError('卦序必须为 1-64 连续，实际: $numbers');
    }
  }

  /// 校验八卦：数量 8、binaryCode 唯一。
  static void validateTrigrams(List<Trigram> all) {
    if (all.length != 8) {
      throw StateError('八卦数量必须为 8，实际 ${all.length}');
    }
    final codes = all.map((t) => t.binaryCode).toSet();
    if (codes.length != 8) {
      throw StateError('存在重复的八卦 binaryCode，唯一数 ${codes.length}');
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `flutter test test/data/data_integrity_test.dart`
Expected: PASS（5 个测试）。

- [ ] **Step 5: 运行全部领域/数据层测试**

Run: `flutter test test/`
Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add yijing_app/lib/data/data_integrity.dart yijing_app/test/data/data_integrity_test.dart
git commit -m "feat(data): 添加启动自检 DataIntegrity"
```

---

## Task 10: 应用层 —— Riverpod Providers

**Files:**
- Create: `lib/application/providers.dart`

- [ ] **Step 1: 实现 Providers**

Create `lib/application/providers.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yijing_app/data/data_integrity.dart';
import 'package:yijing_app/data/hexagram_repository.dart';
import 'package:yijing_app/data/trigram_repository.dart';
import 'package:yijing_app/domain/hexagram.dart';

/// 应用初始化：加载 JSON + 自检。返回 true 表示成功。
final appInitializationProvider = FutureProvider<bool>((ref) async {
  final hexRepo = await HexagramRepository.load();
  DataIntegrity.validateHexagrams(hexRepo.all); // 失败抛错，APP 启动即暴露问题
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
```

- [ ] **Step 2: Commit**

```bash
git add yijing_app/lib/application/providers.dart
git commit -m "feat(app): 添加 Riverpod providers 与初始化自检"
```

---

## Task 11: 共享组件 —— HexagramPainter / TrigramPainter

**Files:**
- Create: `lib/shared/widgets/hexagram_painter.dart`
- Test: `test/shared/hexagram_painter_test.dart`

- [ ] **Step 1: 写失败测试（验证二进制→爻列表转换逻辑）**

绘制本身难单测，但"二进制→可绘制的爻描述"是纯逻辑，提取为可测函数。

Create `test/shared/hexagram_painter_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:yijing_app/shared/widgets/hexagram_painter.dart';

void main() {
  group('HexagramPainter logic', () {
    test('111111 → 6 个阳爻，自下而上', () {
      final lines = HexagramPainter.describeLines('111111');
      expect(lines.length, 6);
      expect(lines.every((l) => l.isYang), true);
    });

    test('000000 → 6 个阴爻', () {
      final lines = HexagramPainter.describeLines('000000');
      expect(lines.every((l) => !l.isYang), true);
    });

    test('101010 → 交替，索引0=阳（爻1）', () {
      final lines = HexagramPainter.describeLines('101010');
      expect(lines[0].isYang, true);   // 爻1
      expect(lines[1].isYang, false);  // 爻2
      expect(lines[2].isYang, true);   // 爻3
    });

    test('变爻标记', () {
      final lines = HexagramPainter.describeLines('111111',
          changingPositions: {3, 6});
      expect(lines[2].isChanging, true);  // 爻3
      expect(lines[5].isChanging, true);  // 爻6
      expect(lines[0].isChanging, false);
    });
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `flutter test test/shared/hexagram_painter_test.dart`
Expected: FAIL。

- [ ] **Step 3: 实现 HexagramPainter**

Create `lib/shared/widgets/hexagram_painter.dart`:

```dart
import 'package:flutter/material.dart';

/// 单根爻的绘制描述（纯数据，可单测）。
class LineDescriptor {
  final int position;   // 1-6
  final bool isYang;
  final bool isChanging;
  const LineDescriptor(this.position, this.isYang, this.isChanging);
}

/// 六爻图绘制器。接收 6 位二进制串（自下而上）。
class HexagramPainter extends CustomPainter {
  final String binaryCode;
  final Set<int>? changingPositions; // 变爻位置（占卦用，第 1 期不用）

  HexagramPainter(this.binaryCode, {this.changingPositions});

  /// 纯逻辑：二进制串 → 自下而上的爻描述列表（index 0 = 爻1 = 最底）。
  static List<LineDescriptor> describeLines(
      String code, {Set<int>? changingPositions}) {
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
    final lineH = size.height / 7;       // 6 爻 + 间隔
    final gap = lineH * 0.35;
    final fullW = size.width;
    final breakW = fullW * 0.28;         // 阴爻中间断开的长度
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
        canvas.drawLine(Offset(0, y), Offset((fullW - breakW) / 2, y), paint);
        canvas.drawLine(Offset((fullW + breakW) / 2, y), Offset(fullW, y), paint);
      }
      if (desc.isChanging) {
        final accent = Paint()
          ..color = Colors.red
          ..strokeWidth = 2;
        canvas.drawLine(Offset(0, y - lineH * 0.4), Offset(fullW, y - lineH * 0.4), accent);
      }
    }
  }

  @override
  bool shouldRepaint(covariant HexagramPainter old) =>
      binaryCode != old.binaryCode || changingPositions != old.changingPositions;
}

/// 包装为 Widget，便于复用。
class HexagramView extends StatelessWidget {
  final String binaryCode;
  final double size;
  final Set<int>? changingPositions;
  const HexagramView(this.binaryCode, {this.size = 120, this.changingPositions, super.key});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(size, size),
      painter: HexagramPainter(binaryCode, changingPositions: changingPositions),
    );
  }
}
```

- [ ] **Step 4: 实现 TrigramPainter**

Create `lib/shared/widgets/trigram_painter.dart`:

```dart
import 'package:flutter/material.dart';

/// 八卦符号绘制器。接收 3 位二进制串（自下而上）。
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
        canvas.drawLine(Offset(0, y), Offset((fullW - breakW) / 2, y), paint);
        canvas.drawLine(Offset((fullW + breakW) / 2, y), Offset(fullW, y), paint);
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
    return CustomPaint(size: Size(size, size), painter: TrigramPainter(binaryCode));
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `flutter test test/shared/hexagram_painter_test.dart`
Expected: PASS（4 个测试）。

- [ ] **Step 6: Commit**

```bash
git add yijing_app/lib/shared/ yijing_app/test/shared/
git commit -m "feat(shared): 添加六爻/八卦绘制组件"
```

---

## Task 12: 查阅库 Feature —— 64 卦总览页 + 搜索

**Files:**
- Create: `lib/features/library/library_page.dart`

- [ ] **Step 1: 实现 64 卦总览页**

Create `lib/features/library/library_page.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yijing_app/application/providers.dart';
import 'package:yijing_app/core/app_routes.dart';
import 'package:yijing_app/shared/widgets/hexagram_painter.dart';

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
    final list = kw.isEmpty
        ? ref.watch(hexagramListProvider)
        : ref.watch(searchResultProvider);

    return Scaffold(
      appBar: AppBar(
        title: _searching
            ? TextField(
                controller: _controller,
                autofocus: true,
                decoration: const InputDecoration(
                    hintText: '搜索卦名 / 卦辞 / 爻辞…', border: InputBorder.none),
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
                  Text('${h.number}.${h.name}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  Text(h.fullName, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
```

注：`context.pushHexagramDetail` 是路由扩展，Task 14 定义。

- [ ] **Step 2: Commit**

```bash
git add yijing_app/lib/features/library/library_page.dart
git commit -m "feat(library): 添加 64 卦总览页与搜索"
```

---

## Task 13: 查阅库 Feature —— 卦象详情页

**Files:**
- Create: `lib/features/library/hexagram_detail_page.dart`

- [ ] **Step 1: 实现卦象详情页**

Create `lib/features/library/hexagram_detail_page.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yijing_app/application/providers.dart';
import 'package:yijing_app/domain/hexagram.dart';
import 'package:yijing_app/shared/widgets/hexagram_painter.dart';

class HexagramDetailPage extends ConsumerWidget {
  final String binaryCode;
  const HexagramDetailPage(this.binaryCode, {super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(hexagramRepositoryProvider);
    final hex = repo?.findByBinaryCode(binaryCode);
    if (hex == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: Text('未找到该卦')));
    }

    return Scaffold(
      appBar: AppBar(title: Text('${hex.number}.${hex.name} · ${hex.fullName}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(child: HexagramView(hex.binaryCode, size: 140)),
          const SizedBox(height: 16),
          _section('卦辞', hex.judgement),
          _section('彖传', hex.tuan),
          _section('大象', hex.image),
          const Divider(),
          for (final yao in hex.lines.reversed) // 显示自上而下倒序展示，便于阅读"上→初"也常见；这里仍自上而下=爻6→1
            _yaoTile(yao),
          if (hex.useNine != null) _section('用九', hex.useNine!),
          if (hex.useSix != null) _section('用六', hex.useSix!),
          const Divider(),
          _section('序卦传', hex.orderRemark),
        ],
      ),
    );
  }

  Widget _section(String title, String body) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.brown)),
            const SizedBox(height: 4),
            Text(body, style: const TextStyle(fontSize: 15, height: 1.6)),
          ],
        ),
      );

  Widget _yaoTile(Yao yao) => ExpansionTile(
        title: Text(yao.label, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(yao.text, maxLines: 1, overflow: TextOverflow.ellipsis),
        children: [
          ListTile(title: Text(yao.text)),
          if (yao.xiang.isNotEmpty)
            ListTile(title: Text('象曰：${yao.xiang}', style: const TextStyle(color: Colors.grey))),
        ],
      );
}
```

- [ ] **Step 2: Commit**

```bash
git add yijing_app/lib/features/library/hexagram_detail_page.dart
git commit -m "feat(library): 添加卦象详情页"
```

---

## Task 14: 查阅库 Feature —— 八卦基础页

**Files:**
- Create: `lib/features/library/trigram_overview_page.dart`

- [ ] **Step 1: 实现八卦基础页**

Create `lib/features/library/trigram_overview_page.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yijing_app/application/providers.dart';
import 'package:yijing_app/shared/widgets/trigram_painter.dart';

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
          const Text('先天八卦（伏羲）', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
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
                            Text(t.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                            Text(t.nature, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                          ],
                        ),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 16),
          const Text('属性详表', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
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
```

- [ ] **Step 2: Commit**

```bash
git add yijing_app/lib/features/library/trigram_overview_page.dart
git commit -m "feat(library): 添加八卦基础页"
```

---

## Task 15: 核心基建 —— 路由、主题、App

**Files:**
- Create: `lib/core/app_routes.dart`
- Create: `lib/core/app_theme.dart`
- Create: `lib/core/app.dart`

- [ ] **Step 1: 实现路由定义**

Create `lib/core/app_routes.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:yijing_app/features/home/home_page.dart';
import 'package:yijing_app/features/library/hexagram_detail_page.dart';
import 'package:yijing_app/features/library/library_page.dart';
import 'package:yijing_app/features/library/trigram_overview_page.dart';
import 'package:yijing_app/features/placeholder/placeholder_page.dart';

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
          GoRoute(path: library, builder: (_, __) => const LibraryPage()),
          GoRoute(path: trigrams, builder: (_, __) => const TrigramOverviewPage()),
          GoRoute(path: study, builder: (_, __) => const PlaceholderPage(title: '学习路径')),
          GoRoute(path: review, builder: (_, __) => const PlaceholderPage(title: '记忆复习')),
          GoRoute(path: profile, builder: (_, __) => const PlaceholderPage(title: '我的')),
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
```

- [ ] **Step 2: 实现主题**

Create `lib/core/app_theme.dart`:

```dart
import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData get light => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.brown),
        appBarTheme: const AppBarTheme(centerTitle: true),
      );
  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.brown, brightness: Brightness.dark),
      );
}
```

- [ ] **Step 3: 实现 App 根组件**

Create `lib/core/app.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:yijing_app/core/app_routes.dart';
import 'package:yijing_app/core/app_theme.dart';

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
```

- [ ] **Step 4: Commit**

```bash
git add yijing_app/lib/core/
git commit -m "feat(core): 添加路由、主题与 App 根组件"
```

---

## Task 16: 首页底部 Tab 导航 + main.dart 入口

**Files:**
- Create: `lib/features/home/home_page.dart`
- Create: `lib/features/placeholder/placeholder_page.dart`
- Modify: `lib/main.dart`

- [ ] **Step 1: 实现占位页**

Create `lib/features/placeholder/placeholder_page.dart`:

```dart
import 'package:flutter/material.dart';

class PlaceholderPage extends StatelessWidget {
  final String title;
  const PlaceholderPage({required this.title, super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.construction, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text('$title（待开发）', style: const TextStyle(color: Colors.grey)),
            const Text('将在后续版本上线', style: TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: 实现首页 Shell（底部 Tab）**

Create `lib/features/home/home_page.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yijing_app/application/providers.dart';
import 'package:yijing_app/core/app_routes.dart';

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
          child: Text('数据加载失败：$e', style: const TextStyle(color: Colors.red)),
        )),
        data: (_) => widget.shellChild,
      ),
      bottomNavigationBar: Builder(builder: (context) {
        final location = GoRouterState.of(context).uri.toString();
        final idx = _indexFromLocation(location);
        return NavigationBar(
          selectedIndex: idx,
          onDestinationSelected: (i) {
            const routes = [
              AppRoutes.library, AppRoutes.trigrams,
              AppRoutes.study, AppRoutes.review, AppRoutes.profile,
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
```

- [ ] **Step 3: 重写 main.dart**

Replace `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yijing_app/core/app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: YijingApp()));
}
```

- [ ] **Step 4: 运行静态分析**

Run: `flutter analyze`
Expected: 无 error（未使用的 import 等需清理）。

- [ ] **Step 5: 运行全部测试**

Run: `flutter test`
Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add yijing_app/lib/features/home/ yijing_app/lib/features/placeholder/ yijing_app/lib/main.dart
git commit -m "feat: 首页 Tab 导航与入口，MVP 整体贯通"
```

---

## Task 17: 在 Android 模拟器上运行验证

**Files:** 无（运行验证）

- [ ] **Step 1: 列出可用 AVD**

Run: `flutter emulators`
Expected: 列出可用模拟器；若为空，需创建（见 Task 0 的 doctor 提示）。

- [ ] **Step 2: 启动 Android 模拟器**

通过 android-emulator MCP 工具或命令行启动：

```bash
flutter emulators --launch <emulator_id>
```

- [ ] **Step 3: 构建并运行 APP**

```bash
cd yijing_app
flutter run
```

Expected: APP 在模拟器启动，首页加载（先显示 loading 圆圈，数据加载后显示 64 卦网格）。

- [ ] **Step 4: 手动验证 MVP 验收标准**

逐项核对：
1. 首页显示 64 卦网格，每格有正确卦象
2. 点任意卦 → 详情页显示卦辞/彖/象/各爻
3. 搜索框输入"乾" → 过滤出含乾的卦
4. 底部 Tab 切换到"八卦" → 显示 8 卦卡片 + 属性表
5. 卦象绘制正确（阳爻一长横、阴爻两短横）

- [ ] **Step 5: 截图存档**

```bash
# 记录验收完成
git tag v0.1.0-mvp -m "第 1 期 MVP 完成：64 卦查阅 + 八卦基础"
git log --oneline | head -20
```

- [ ] **Step 6: 最终 Commit（如有运行时修复）**

```bash
git add -A
git commit -m "chore: 第 1 期 MVP 验收完成" || echo "no changes"
```

---

## 验收标准（第 1 期 MVP）

完成后必须满足：

- [ ] Flutter 项目可在 Android 模拟器运行
- [ ] 64 卦全部可查，卦象正确（阳爻/阴爻绘制无误）
- [ ] 本经原文无缺（卦辞、彖、象、6 爻爻辞、序卦）
- [ ] 全文检索可用（按卦名/卦辞/爻辞过滤）
- [ ] 八卦基础页可用（8 卦符号 + 属性表）
- [ ] 启动自检生效（数据错误时启动即报错）
- [ ] 全部单元测试通过
- [ ] Git 历史清晰，每 Task 一次提交

---

## 实施备注

- **Task 7（64 卦数据）是工作量最大项**：需填入全部公版原文。若原文填充耗时长，可先填卦名/binaryCode/卦辞/爻辞（核心字段），彖/象/序卦后补，但 binaryCode 必须一次到位（自检会卡）。
- **binaryCode 自下而上的约定**贯穿全项目，数据填充时务必核对爻象。
- **TDD 顺序**：每个领域模型/工具先写测试，再实现，最后验证。
- **每 Task 完成立即 commit**，保持小步推进、可回滚。

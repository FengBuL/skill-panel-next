# Skill Panel Next — PRD 5.0 正式基线工作区

**用途：** 后续 Git 建库、生产架构、后端、数据库、打包与发布的唯一基线目录。  
**状态：** 原型视觉 / 流程 / 状态模型 / 交互 = **正式基线（已冻结）**  
**整理：** 2026-07-25（已去重；迁移前分散副本已删除）

---

## 目录结构

```text
skill panel next/
├── README.md
├── SOURCE-MAP.md
├── docs/
│   ├── prd/              # PRD5.0、边际探讨
│   ├── refactor-plan/    # 实施方案、IA、状态机、验收与回归规格
│   └── baseline/         # 冻结报告、交接、开发台账、测试指南
└── prototype/            # 可运行冻结原型 + 20-suite 测试
```

---

## 建议阅读顺序

1. `docs/prd/PRD5.0.md`
2. `docs/baseline/FINAL-FREEZE-REPORT.md`
3. `docs/baseline/DEV-LEDGER.md`
4. `docs/baseline/HANDOFF-REPORT.md`
5. `docs/refactor-plan/03-数据模型与状态机.md`
6. `docs/refactor-plan/02-信息架构与页面规格.md`
7. `prototype/`（实现与回归）

---

## 原型启动

```bash
cd prototype
npm install
python3 -m http.server 8081
# http://localhost:8081/index.html

node run-all-tests.js   # 期望 20 suites · exit 0
```

---

## 后续约定

- **本目录为唯一权威工作区**（旧 Workbuddy / Desktop 分散副本已删除）。
- 冻结规则仍有效：未授权勿改视觉/流程/状态机契约；修复须回归 20-suite。
- 新能力走新版本或分支；Git 建库需人工明确授权后再做。

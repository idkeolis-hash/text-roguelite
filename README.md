WIP. No descriptions other than editing suggestions and rules could be offered.


# 战斗规则

每场战斗开始时，全员满血。不继承上一场的生命和临时战斗状态。

战斗进行中锁定配置修改：
- 武器更换。
- 道具装备更换。
- 同伴上阵、卸下和位置调整。
- 后续新增的其他战斗配置修改。

允许查看背包、图鉴和单位资料。
允许正常使用已经装备的战斗道具。

## 行动与目标

行动应统一描述：
- 稳定识别码。
- 显示名称。
- 目标类型。
- 使用条件与消耗。
- 通用效果或特殊执行函数。

玩家选择与实际目标必须分开。
执行效果使用解析后的实际目标。

目标规则：
- 单体敌人：玩家选中的敌人。
- 单体盟友：玩家选中的我方单位。
- 自身：行动者自己，不受资料选择影响。
- 自身以外单体盟友：
  - 选中其他盟友时，使用该盟友。
  - 选中自己时，使用除自己外场上位置数字最低的合法盟友。
  - 只有自己时，该效果 miss。
- 敌全体：场上合法敌方单位。
- 全体盟友：场上合法我方单位。
- 特殊目标，由明确的目标规则解析。
- 全体攻击不走单体嘲讽、守护重定向。

一个行动可能对多个目标实施多种不同效果，不得合并成一个含糊的目标字段。
无目标的蓄能等行动，不因没有单位目标而 miss。
特殊行动同样必须遵守公共行动入口。

### 当前行动系统实现约定

- `src/actionTypes.ts` 定义公共行动契约。
- `src/combatants.ts` 定义敌人与同伴内容。
- `src/weaponActions.ts` 定义武器行动。
- `src/battleActions.ts` 统一资料查询、目标解析与可用性检查。
- `src/weaponActionEffects.ts` 只实现特殊武器效果。
- `src/game.ts` 的公共行动入口负责事件、重复效果、消耗和行动推进。

具体行动 `id` 与行动 `category` 必须分开：
- `id` 是具体行动的稳定识别码。
- `category` 用于普攻、技能、蓄能等类别判断。
- 不根据显示名称判断行动。
- 青羽不同形态的具体行动使用不同 ID。

敌方选择、盟友效果目标、当前查看或操作单位分别保存。
不得通过切换当前操作单位来代替选择盟友效果目标。

行动重复：
- 复起重复行动效果。
- 不重复支付行动力或公共蓄能消耗。
- 不重复派发公共 `action-used` 和 `action-end` 事件。
- 使用首次选择的行动定义快照；行动如果发生变化，不替换本次重复效果。

蓄能结算：
- 普攻基础蓄能奖励只结算一次。
- 武器特殊效果提供的额外蓄能属于效果本身。
- 当前武器爆发先消耗全部旧蓄能，再执行效果，保留效果获得的新蓄能。
- 当前蓄能技能在效果完成后支付1点蓄能。
- 敌人和同伴保留各自定义的消耗时机。

特殊处理器不得自行扣行动力、派发公共行动事件或推进战斗。
通用和特殊行动均经过公共可用性检查与结算。
行动完成后统一检查失败和正式胜利。

## 速度与行动力

速度决定行动时间，不决定可行动次数。
行动力决定行动次数。

高速单位可能在低速单位第一次行动前完成第二次行动。

每回合重新读取当前速度。
不擅自修改行动力刷新、状态扣时和回合边界规则。

## 图鉴与内容
只为实际存在的武器、遗物、道具、同伴图鉴记录发现。
Normal 中首次获得时记录发现，并跨局保留。
Debug 全开，不持久记录。

重复抽取限制暂缓实现：
- 武器、遗物、道具以后禁止抽出已拥有内容。
- 同伴允许拥有同名的多个实例。
不得为方便处理，提前把同伴设计成只能拥有一个同名单位。

---
Below are default README.md by using React + TypeScript + Vite

# React + TypeScript + Vite
This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

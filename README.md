WIP. No descriptions other than editing suggestions and rules could be offered.


# 项目修改规则

## 修改前必读

任何代码修改前，必须阅读本文件，并核对当前源码。
不得根据旧版本、聊天中的假定结构或示例架构修改代码。
玩法规则发生变化时，必须同步更新本文件。

提供手动修改说明时，必须采用：
- 哪个文件
- 搜索什么
- 替换成什么

新文件明确标注“新建”；范围替换明确给出起止位置。
没有实际运行的构建、测试，不得宣称通过。

## 状态职责

按生命周期区分：
- 全局进度：图鉴发现、命运，以及未来的永久解锁。
- 当前本局：主控、库存、属性变化、流程进度。
- 当前战斗：战斗单位、生命、状态、行动调度。
- 当前页面：弹窗、查询、选中条目等界面状态。

## 游戏模式与存档

### Normal

每个槽位分别保存：
- slot1user
- slot1currentrun
- slot2user
- slot2currentrun
- 后续槽位采用相同命名规则。

user 保存该槽位的永久进度。
currentrun 保存该槽位当前本局。

新开一局只替换对应 currentrun，保留对应 user。
不同槽位之间不得共享永久进度或当前本局。

节点完成并完成结算后保存检查点。
正式战斗失败也属于节点完成：立即标记本局结束并保存，不允许原地重试。

允许战斗中途退出后重新挑战：重新进入时恢复最近已完成节点的检查点。

暂不实现存档迁移和主控解锁系统。

### Debug

不读取存档，不写入任何持久数据。
图鉴全部开放。
每次重新进入 debug 都创建干净的新会话。
不得复用上一次 debug 的游戏状态。
不得污染 normal 的任何槽位。

## 战斗规则

每场战斗开始时，全员满血。不继承上一场的生命和临时战斗状态。

战斗进行中锁定配置修改：
- 武器更换。
- 道具装备更换。
- 同伴上阵、卸下和位置调整。
- 后续新增的其他战斗配置修改。

允许查看背包、图鉴和单位资料。
允许正常使用已经装备的战斗道具。
界面和实际配置修改入口必须同时检查锁定。

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

不得把敌方选择和我方选择合并成一个含糊的目标字段。
无目标的蓄能等行动，不因没有单位目标而 miss。
特殊行动必须遵守公共行动入口。

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

## 暂缓事项

- 完整节点系统。
- 里线信息隐藏。
- 钩子重构。
- 重复抽取限制。
- 存档迁移。
- 主控解锁。
- CSS 整理。

## 验证要求

每批修改后执行。
新增自动测试后，执行相应测试命令。

重点验证：
- 战斗配置锁定及解锁。
- 行动定义与目标解析。
- 速度与行动力。
- 每战满血。
- 失败结束本局。
- 槽位隔离。
- Debug 清洁启动且不读写存档。
- 图鉴跨局保留。
- 节点检查点恢复。











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

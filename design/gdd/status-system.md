# Status System (状态系统)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-03-29
> **Implements Pillar**: 构筑智慧, 养成爆发

## Overview

状态系统管理战斗中的 buff（增益）和 debuff（减益）效果。武将技能、装备特效和羁绊加成可以在战斗中施加各种状态，修改目标的属性或造成持续效果。系统设计偏简洁——MVP 阶段只有 5-8 种基础数值状态，Vertical Slice 阶段引入控制类状态。同类状态不叠加取最强，所有状态有持续回合数，到期自动移除。Boss 拥有特殊免疫机制，不受部分状态影响。状态系统的策略深度体现在战前构筑（"我的阵容能施加什么状态？能抵抗什么？"），而非战斗中的微操。

## Player Fantasy

**「以谋克力，以毒攻心。」**

你的诸葛亮施加的减防让对方坦克形同虚设，张飞的怒吼减速了整排敌人的攻击节奏，而华佗的持续回复让你的前排坚如磐石。状态效果是看不见的第二战场——数值背后的博弈。但当你面对 Boss 时发现你赖以为生的眩晕被完全免疫，必须重新思考策略——这就是 Boss 战的紧张感来源。

**Pillar 对齐**:
- **构筑智慧**: 状态效果让阵容构筑多了一个维度——不只是"谁输出高"，还有"谁能施加/抵抗什么状态"
- **养成爆发**: 高 Tier 武将的状态效果更强、种类更多，是成长的可见回报

## Detailed Design

### Core Rules

#### 1. Status Effect Categories

**基础层（MVP）— 数值修改类**：

| 状态 | ID | 类型 | 效果 | 来源示例 |
|------|-----|------|------|---------|
| 增攻 | `atk_up` | buff | STR 或 INT +X% | 技能、羁绊 |
| 减攻 | `atk_down` | debuff | STR 或 INT -X% | 技能、装备效果 |
| 增防 | `def_up` | buff | DEF +X% | 技能、羁绊 |
| 减防 | `def_down` | debuff | DEF -X% | 技能、名器效果（青龙偃月刀"威压"） |
| 加速 | `spd_up` | buff | SPD +X% | 技能 |
| 减速 | `spd_down` | debuff | SPD -X% | 技能（张飞"怒吼"）、装备效果 |
| 中毒 | `poison` | debuff | 每回合受到固定伤害 | 技能、装备（铁脊蛇矛） |
| 燃烧 | `burn` | debuff | 每回合受到固定伤害 + 受到的治疗效果减半 | 技能（火攻类）、装备 |
| 回复 | `regen` | buff | 每回合恢复固定 HP | 技能（华佗"刮骨疗毒"） |

**高级层（Vertical Slice+）— 控制类**：

| 状态 | ID | 类型 | 效果 | 来源示例 |
|------|-----|------|------|---------|
| 眩晕 | `stun` | debuff | 跳过行动（不能攻击也不能释放技能） | 高级技能 |
| 沉默 | `silence` | debuff | 无法释放技能（只能普攻） | 高级技能 |

#### 2. Status Effect Data Model

```typescript
interface StatusEffect {
  id: string;                    // e.g., "atk_up", "poison"
  name: string;                  // 显示名称
  category: 'buff' | 'debuff';
  effectType: 'stat_modify' | 'dot' | 'hot' | 'control' | 'burn';
  stat?: StatType;               // stat_modify 类型：影响哪个属性
  value: number;                 // 效果值（百分比或固定值）
  valueType: 'percent' | 'flat'; // 百分比加成 or 固定值
  duration: number;              // 持续回合数
  source: string;                // 施加来源（技能ID/装备ID）
}

interface AppliedStatus {
  effect: StatusEffect;
  remainingDuration: number;     // 剩余回合数
  sourceHeroId: string;          // 施加者
}
```

#### 3. Stacking Rules (叠加规则)

**核心规则：同类状态不叠加，取效果最强的一个。**

"同类"定义为相同 `id` 的状态。例如：
- 武将 A 施加 `atk_down` 15%（3 回合），武将 B 施加 `atk_down` 20%（2 回合）
- 结果：保留 20% 那个（值更高），持续 2 回合
- 第一个效果被完全替换，不保留

**不同类状态可共存**：
- 同一个目标可以同时拥有 `atk_down` + `def_down` + `poison`
- buff 和 debuff 各自独立——可以同时被增攻和减防

**最终属性计算中的位置**（引用 Hero System GDD）：
```
finalStat = (baseStat + growthBonus + equipBonus) * (1 + bondModifier + statusModifier)
```

`statusModifier` = 所有当前生效的属性修改类状态的净值之和。
- 例：同时被增攻 20% 和减攻 10%，statusModifier = +0.1

#### 4. Duration and Removal (持续和移除)

- 所有状态都有持续回合数（`duration`），每回合结束时 -1，归零时移除
- DoT（中毒）和 HoT（回复）在每回合开始时结算伤害/治疗
- 控制效果（眩晕/沉默）在武将行动时检查——有眩晕则跳过，有沉默则只能普攻
- 战斗结束时所有状态清除（不带入下一场战斗）

#### 5. Boss Resistance (Boss 抗性机制)

Boss 对状态效果有增强的抗性，但不完全免疫：

**控制类状态（眩晕/沉默）**：
- Boss 对控制效果持续时间大幅缩短（BOSS_CONTROL_REDUCTION = 0.5），最低 1 回合
- 不完全免疫——让控制流构筑仍然有价值，但不能无限控

**数值类 debuff（减攻/减防/减速等）**：
- Boss 受到的数值 debuff 效果减半（BOSS_DEBUFF_REDUCTION = 0.5）
- 数值 debuff 始终有效，只是效果打折

**特殊情况**：
- 极个别 Boss 可能对某个特定状态有额外抗性（如火属性 Boss 对中毒抗性更高），但应极少使用，避免废掉特定构筑流派

```typescript
interface BossResistance {
  controlReduction: number;       // 控制效果持续时间缩短比例（0.5 = 减半）
  debuffReduction: number;        // 数值 debuff 效果缩短比例（0.5 = 减半）
  specialResistances?: Record<string, number>;  // 特定状态的额外抗性（极少使用）
}
```

#### 6. High-Tier Tenacity (高 Tier 韧性)

高 Tier 武将（S 及以上）对控制类状态（眩晕/沉默）有天然抗性：

```
actualDuration = max(1, floor(baseDuration * TENACITY_REDUCTION))
```

| Variable | Value | Description |
|----------|-------|-------------|
| TENACITY_REDUCTION | 0.5 | S+ 武将控制效果持续时间减半 |

- 仅影响控制类状态（stun、silence），不影响数值类
- 仅高 Tier 武将拥有（C-A 无韧性）
- 最低持续 1 回合（不会减到 0）

#### 7. Progressive Complexity

遵循渐进式复杂度原则：
- **C-B 武将**：技能只涉及基础数值 buff/debuff（增攻/减攻/增防/减防）
- **A 武将**：引入中毒、回复、减速等更多状态类型
- **S+ 武将**：引入控制类状态（眩晕/沉默），拥有韧性被动
- **Boss**：拥有免疫机制，迫使玩家在高级构筑中考虑 Boss 的弱点和免疫

### States and Transitions

每个 `AppliedStatus` 的生命周期：

| State | Entry | Exit | Behavior |
|-------|-------|------|----------|
| **Applied** | 技能/装备效果施加 | — | 检查免疫 → 免疫则直接失败；检查同类 → 替换或保留更强的 |
| **Active** | 施加成功 | duration 归零 → Expired / 被更强同类替换 → Replaced | 每回合结算效果；回合结束 duration-1 |
| **Expired** | duration = 0 | — (终态) | 从目标移除，属性重算 |
| **Replaced** | 更强同类施加 | — (终态) | 被新效果替换 |

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Hero System** | Status → Hero | 写入 `statusModifier`，每次状态变更时重算最终属性 |
| **Battle Engine** | Battle ↔ Status | 战斗中施加/移除状态；回合开始结算 DoT/HoT；行动时检查控制效果 |
| **Battle AI** | AI 读取 Status | AI 决策时考虑目标当前状态（优先攻击被减防的目标等） |
| **Equipment System** | Equipment → Status | 名器特效施加状态（如青龙偃月刀"威压"施加 def_down） |
| **Bond System** | Bond → Status | 羁绊效果可能施加全队 buff |
| **Enemy System** | Enemy → Status | Boss 免疫配置 |
| **Battle UI** | Status → UI | 状态图标、持续回合数、施加/移除的视觉反馈 |

**公共接口**:
```typescript
interface StatusSystemAPI {
  applyStatus(target: BattleUnit, effect: StatusEffect, source: string): ApplyResult;
  removeStatus(target: BattleUnit, statusId: string): void;
  getActiveStatuses(target: BattleUnit): AppliedStatus[];
  getStatusModifier(target: BattleUnit, stat: StatType): number;  // 计算某属性的净状态修正
  tickStatuses(target: BattleUnit): TickResult;  // 回合结算：DoT/HoT 伤害/治疗 + duration-1 + 过期移除
  isControlled(target: BattleUnit): ControlState;  // 返回 'none' | 'stunned' | 'silenced'
}

type ApplyResult = 'applied' | 'replaced_weaker' | 'ignored_stronger_exists' | 'reduced_by_boss';
type ControlState = 'none' | 'stunned' | 'silenced';

interface TickResult {
  damage?: number;    // 中毒伤害
  healing?: number;   // 回复治疗
  expired: string[];  // 本回合过期移除的状态 ID
}
```

## Formulas

### Stat Modifier Calculation

```
statusModifier[stat] = sum(activeBuffs[stat].value) - sum(activeDebuffs[stat].value)
```

对 Boss 目标：
```
statusModifier[stat] = sum(activeBuffs[stat].value) - sum(activeDebuffs[stat].value * BOSS_DEBUFF_REDUCTION)
```

| Variable | Value | Description |
|----------|-------|-------------|
| BOSS_DEBUFF_REDUCTION | 0.5 | Boss 受到的数值 debuff 效果减半 |

Clamp: `statusModifier` 的范围为 -0.5 到 1.0（引用 Hero System GDD）。

### DoT Damage (中毒)

```
poisonDamage = effect.value  // 固定值，每回合结算
```

中毒伤害不受 DEF 减免（直接扣 HP），但受 `MIN_DAMAGE = 1` 保底。

### HoT Healing (回复)

```
regenHealing = min(effect.value, target.maxHP - target.currentHP)
```

如果目标有燃烧状态：
```
regenHealing = min(effect.value * BURN_HEAL_REDUCTION, target.maxHP - target.currentHP)
```

| Variable | Value | Description |
|----------|-------|-------------|
| BURN_HEAL_REDUCTION | 0.5 | 燃烧状态下治疗效果减半 |

回复不超过 maxHP。

### Burn Damage (燃烧)

```
burnDamage = effect.value  // 固定值，每回合结算
```

燃烧和中毒一样不受 DEF 减免。两者可共存（不同 ID），伤害各自独立结算。
燃烧的独特效果：目标受到的所有治疗（包括 regen、技能治疗）效果减半。

### Control Duration (高 Tier 韧性)

```
actualDuration = target.tier >= S ? max(1, floor(baseDuration * TENACITY_REDUCTION)) : baseDuration
```

| Variable | Value | Description |
|----------|-------|-------------|
| TENACITY_REDUCTION | 0.5 | S+ 武将控制持续时间减半 |

### Status Effect Value Ranges (按来源)

| 来源 | 典型效果值 | 典型持续 |
|------|-----------|---------|
| C-B 技能 | ±5-10% 属性 | 2-3 回合 |
| A 技能 | ±10-20% 属性 / 固定 DoT | 2-4 回合 |
| S+ 技能 | ±15-25% 属性 / 控制 | 1-3 回合 |
| 装备效果 | ±5-15% 属性 / 轻微 DoT | 2-3 回合 |
| 羁绊加成 | ±5-10% 全队属性 | 整场战斗 |

**注意**：所有数值为初始估算，需 playtest 校准。

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| 同类 buff 和 debuff 同时存在 | 各自独立存在，净值计算到 statusModifier | buff 和 debuff 是不同 ID（atk_up vs atk_down） |
| statusModifier 超出 -0.5 到 1.0 范围 | clamp 到范围边界 | 引用 Hero System 定义 |
| 中毒和燃烧同时存在 | 各自独立结算伤害，燃烧的治疗减半效果叠加生效 | 不同 ID，可共存 |
| 燃烧状态下收到技能治疗 | 治疗量减半 | 燃烧减半效果对所有治疗来源生效 |
| 燃烧和回复同时存在 | 回复每回合治疗量减半，燃烧每回合造成伤害 | 两者共存但燃烧削弱回复效果 |
| 眩晕状态下受到攻击 | 正常受到伤害 | 眩晕只阻止行动，不影响受击 |
| 同时被眩晕和沉默 | 眩晕优先（跳过行动，沉默无意义） | 眩晕是更强的控制 |
| 对 Boss 施加控制状态 | 施加成功但持续时间减半（最低1回合） | Boss 不完全免疫，控制流仍有价值 |
| 对 Boss 施加数值 debuff | 施加成功但效果值减半 | debuff 流始终有效，只是打折 |
| 羁绊 buff 持续整场但被更强的短期 buff 替换 | 短期 buff 过期后，羁绊 buff 不会恢复（已被替换） | 简化逻辑，避免"恢复栈" |
| 战斗结束时有 DoT 但目标 HP=1 | 战斗结束，状态清除，不结算最后一次 DoT | 战斗结束优先于状态结算 |
| 回复使 HP 超过 maxHP | clamp 到 maxHP | 不允许过量治疗 |
| S+ 武将对 1 回合控制效果的韧性 | max(1, floor(1 * 0.5)) = max(1, 0) = 1 回合 | 最低 1 回合，控制不会被完全免疫 |
| Boss 同时被多个不同 debuff | 全部生效（各自减半），允许多种 debuff 叠加不同类型 | 鼓励多样化 debuff 构筑 |

## Dependencies

**双向依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Hero System | Status modifies Hero | 写入 statusModifier | Hard |
| Battle Engine | Battle ↔ Status | Battle Engine 驱动状态施加/移除时机，Status System 写入 Hero 的 statusModifier 供 Battle 读取。两者为对等双向关系。 | Hard |

**下游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Battle AI | AI reads Status | 决策参考目标状态 | Soft |
| Battle UI | UI reads Status | 显示状态图标和效果 | Hard |
| Equipment System | Equipment triggers Status | 装备效果施加状态 | Soft |
| Bond System | Bond triggers Status | 羁绊效果施加 buff | Soft |

## Tuning Knobs

| Parameter | Initial | Safe Range | Effect of ↑ | Effect of ↓ |
|-----------|---------|------------|------------|------------|
| `STATUS_MODIFIER_MIN` | -0.5 | -0.7 to -0.3 | debuff 上限更高（更压制） | debuff 上限更低（更温和） |
| `STATUS_MODIFIER_MAX` | 1.0 | 0.5-1.5 | buff 上限更高 | buff 上限更低 |
| `BOSS_DEBUFF_REDUCTION` | 0.5 | 0.3-0.7 | Boss 受 debuff 影响更大 | Boss 更抗 debuff |
| `TENACITY_REDUCTION` | 0.5 | 0.3-0.7 | S+ 武将控制抗性更强 | 控制对 S+ 也有效 |
| `POISON_IGNORE_DEF` | true | true/false | 中毒穿透 DEF（当前） | 中毒受 DEF 减免 |
| `MAX_STATUSES_PER_UNIT` | 无限制 | 5-10 or 无限 | 限制状态数量防止视觉混乱 | 无限状态 |

## Visual/Audio Requirements

| Event | Visual Feedback | Audio Feedback | Priority |
|-------|----------------|---------------|----------|
| buff 施加 | 目标身上绿色/蓝色上升箭头 + 状态图标出现 | 增益音效 | Medium |
| debuff 施加 | 目标身上红色下降箭头 + 状态图标出现 | 减益音效 | Medium |
| 中毒 tick | 目标闪绿色 + 伤害数字（绿色） | 毒液音效 | Medium |
| 回复 tick | 目标闪白色 + 治疗数字（绿色+） | 治疗音效 | Medium |
| 眩晕 | 目标头顶旋转星星图标 | 眩晕音效 | High |
| 沉默 | 目标头顶封印图标 | 沉默音效 | High |
| 状态过期 | 状态图标淡出消失 | 无 | Low |
| 免疫 | "抵抗"浮字弹出（仅极少数特殊 Boss 特殊状态） | 金属格挡声 | Low |
| 韧性减半 | 控制图标闪烁表示缩短 | 无 | Low |

## UI Requirements

| Information | Display Location | Update Frequency | Condition |
|-------------|-----------------|-----------------|-----------|
| 当前状态图标列表 | 武将头顶/血条旁 | 状态变更时 | 战斗中 |
| 状态剩余回合数 | 状态图标上的小数字 | 每回合 | 战斗中 |
| 状态效果详情 | hover 状态图标弹出 | 实时 | hover |
| buff/debuff 颜色区分 | buff=蓝/绿色边框, debuff=红色边框 | 静态 | 始终 |
| 施加/移除动画 | 状态图标的出现/消失动画 | 事件触发时 | 战斗中 |
| "免疫"提示 | 目标头顶浮字 | 施加失败时 | Boss 战 |
| Boss 抗性信息 | Boss 信息面板（战前预览） | 静态 | Boss 战前 |

## Acceptance Criteria

- [ ] 9 种基础状态（增攻/减攻/增防/减防/加速/减速/中毒/燃烧/回复）正确生效
- [ ] 同类状态不叠加，取效果最强
- [ ] statusModifier 正确计算并 clamp 到 -0.5 至 1.0
- [ ] 状态持续回合数正确递减，归零时移除
- [ ] 中毒每回合正确造成伤害（不受 DEF 影响）
- [ ] 回复每回合正确恢复 HP（不超过 maxHP）
- [ ] 燃烧每回合正确造成伤害
- [ ] 燃烧状态下目标受到的治疗效果减半
- [ ] 中毒和燃烧可同时存在，各自独立结算
- [ ] Boss 对控制效果持续时间大幅缩短（不完全免疫）
- [ ] Boss 受到数值类 debuff 效果减半
- [ ] Boss 抗性信息在战前可预览
- [ ] 眩晕正确跳过目标行动
- [ ] 沉默正确限制目标只能普攻
- [ ] S+ 武将对控制效果持续时间减半（最低 1 回合）
- [ ] 战斗结束时所有状态正确清除
- [ ] 所有 Tuning Knobs 可通过配置文件调整
- [ ] Performance: 状态计算在 <1ms 内完成（单个武将）

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| 具体每个武将的技能施加哪些状态，需要配合武将内容设计 | Game Designer | Hero content design | 与武将设计同步 |
| 每个 Boss 的免疫列表需要配合 Boss 设计 | Game Designer | Enemy content design | 与 Boss 设计同步 |
| 是否需要"净化"类效果（移除 debuff 的技能） | Game Designer | Vertical Slice | 视 playtest 反馈 |
| 是否需要"状态抗性"属性（百分比概率抵抗特定状态） | Game Designer | Alpha | 视复杂度需求 |
| 羁绊 buff 被替换后不恢复——是否需要"持久 buff"类型不可被覆盖 | Game Designer | Prototype | playtest 后决定 |
| 状态效果的数值需配合战斗平衡 playtest 联合校准 | Systems Designer | Prototype | playtest 迭代 |

# Hero Growth (武将养成系统)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-03-29
> **Implements Pillar**: 养成爆发 (核心), 构筑智慧 (养谁是决策)

## Overview

武将养成系统管理 Run 内武将的等级成长。玩家消耗材料(Material)主动提升武将等级，每次升级增加基础属性并自动强化技能数值。没有经验值概念——资源投入即成长，玩家完全控制"养谁"的决策。

## Player Fantasy

**「看着你亲手培养的武将一步步变强。」**

每次升级后属性数字明显跳升、技能伤害肉眼可见增长——这就是「养成爆发」支柱的核心体验。把有限的材料投给谁，是贯穿整个 Run 的关键策略决策。

**Pillar 对齐**:
- **养成爆发**: 升级效果肉眼可见，属性跳升+技能变强
- **构筑智慧**: 材料有限，养谁是战略选择（不能所有人满级）

## Detailed Design

### Core Rules

#### 1. Level System

| 属性 | 值 |
|------|---|
| 最低等级 | 1 |
| 最高等级 | MAX_LEVEL (初始设定 10，待 playtest 调优) |
| 升级方式 | 消耗 Material，即时生效 |
| 经验值 | 无——纯材料消耗 |
| Run 结束 | 等级重置为 1 |

#### 2. Level-Up Cost — Design Principles

具体数值待 playtest 校准，但遵循以下原则：

**经济平衡原则**:
- 一次 Run 的材料总产出应足够将 **5 个主战武将升到接近满级**（Lv.8-9）
- 但材料同时用于**装备强化**，所以需要取舍——要么全投升级、要么分一些给装备
- **不配经济型武将**时：5 人到 Lv.8 比较轻松，Lv.9-10 需要精打细算
- **配经济型武将/技能**时（如糜竺「商贾」）：可以更宽裕，甚至 5 人满级+装备强化

**成本曲线原则**:
- 升级成本**递增**（非线性），后期每级消耗明显多于前期
- Lv.1→5 成本低，确保所有上场武将都能快速到达"可用"水平
- Lv.8→10 成本高，满级是投资决策而非必然
- 升级无失败机制——消耗材料即成功，无挫败感

**调优公式**（初始值，待调整）:
```
levelUpCost = BASE_LEVEL_COST + (targetLevel - 2) * COST_INCREMENT + (targetLevel - 2)^2 * COST_ACCELERATION
```

#### 3. Stat Growth Per Level

```
growthBonus[stat] = (level - 1) * statGrowthRate[stat]
```

每个武将有独立的成长系数（由角色设计决定），反映武将特性：

| 武将类型 | STR/level | INT/level | DEF/level | HP/level | SPD/level |
|---------|-----------|-----------|-----------|----------|-----------|
| 武力型（关羽） | +4 | +1 | +2 | +3 | +1 |
| 智力型（诸葛亮） | +1 | +4 | +1 | +2 | +3 |
| 均衡型（赵云） | +3 | +2 | +2 | +2 | +2 |
| 防御型（曹仁） | +2 | +1 | +4 | +3 | +1 |

- 成长系数为**模板示例**，每位武将可有独特的分配
- 传说变体的成长系数比基础版更高（约 +20-30%）
- 满级时 growthBonus 约占最终属性的 15-25%

#### 4. Skill Auto-Scaling

技能数值随等级自动提升，无需手动操作：

```
scaledSkillValue = baseSkillValue * (1 + (level - 1) * SKILL_SCALING_RATE)
```

| Variable | Value | Description |
|----------|-------|-------------|
| SKILL_SCALING_RATE | ~0.08 (待调优) | 每级技能数值提升百分比 |

- 满级时技能数值约为基础值的 1.7×，感知明显但不数值爆炸
- 被动技能、主动技能、武技、军师技均受此缩放影响
- 缩放影响数值部分（伤害/治疗/加成值），不影响触发条件和概率

#### 5. Progressive Complexity

遵循渐进式复杂度原则：
- **C-B 武将** (Lv.1-5 为主): 升级只提升基础属性，技能自动变强。零额外思考
- **A 武将** (可升至 Lv.10): 同上，但成长系数更高，升级感知更强
- **S+ 传说变体**: 武技/军师技的数值也随等级提升，且成长系数更高

### States and Transitions

无复杂状态机。每个武将维护一个 `level` (int, 1-MAX_LEVEL)：

| Event | Effect |
|-------|--------|
| Run 开始 | 所有武将 level = 1 |
| 玩家消耗材料升级 | level += 1, 重算 growthBonus 和 scaledSkillValues |
| 训练事件（特殊） | level += 1 (免费), 同上 |
| Run 结束 | level 重置为 1 |

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Hero System** | Growth → Hero | 写入 `growthBonus[stat]` + 更新所有技能的 scaledValue |
| **Economy** | Growth → Economy | 升级消耗: `economy.spend(0, levelUpCost)` |
| **Equipment System** | Soft reference | 装备不影响升级；但升级后的属性影响装备效果的绝对值（间接） |
| **Event System** | Event → Growth | 训练事件可免费提升武将等级 |
| **Hero Detail UI** | UI 读取 Growth | 显示当前等级、下一级所需材料、属性变化预览 |

**公共接口**:
```typescript
interface HeroGrowthAPI {
  getLevel(heroId: string): number;
  getLevelUpCost(heroId: string): number;  // Material cost for next level
  canLevelUp(heroId: string): boolean;     // checks level < MAX and economy.canAfford
  levelUp(heroId: string): void;           // spends material, increments level, recalculates
  getGrowthPreview(heroId: string): StatPreview;  // shows stat changes for next level
}
```

## Formulas

### Level-Up Cost

```
levelUpCost = BASE_LEVEL_COST + (targetLevel - 2) * COST_INCREMENT + (targetLevel - 2)^2 * COST_ACCELERATION
```

| Variable | Initial Value | Safe Range | Description |
|----------|--------------|------------|-------------|
| BASE_LEVEL_COST | TBD | 2-10 | Lv.1→2 的材料消耗 |
| COST_INCREMENT | TBD | 1-5 | 每级线性递增 |
| COST_ACCELERATION | TBD | 0.5-2 | 每级二次方递增 |

**Calibration target**: 5 人到 Lv.8-9 的总消耗 ≈ Run 总材料产出的 60-75%，剩余 25-40% 用于装备强化。

### Stat Growth

```
growthBonus[stat] = (level - 1) * statGrowthRate[stat]
```

| Variable | Range | Source |
|----------|-------|--------|
| statGrowthRate | 1-5 per stat | Hero 数据文件，每个武将独立 |

### Skill Scaling

```
scaledSkillValue = baseSkillValue * (1 + (level - 1) * SKILL_SCALING_RATE)
```

| Variable | Initial Value | Safe Range | Description |
|----------|--------------|------------|-------------|
| SKILL_SCALING_RATE | 0.08 | 0.05-0.12 | 每级技能数值提升 |

**Expected at Lv.10**: scaledSkillValue ≈ baseSkillValue × 1.72

## Edge Cases

| Scenario | Behavior | Rationale |
|----------|----------|-----------|
| 材料不足升级 | UI 灰显升级按钮 + 显示差额 | 与 Economy edge case 一致 |
| 已满级武将尝试升级 | UI 灰显 + 显示"已满级" | 清晰反馈 |
| 训练事件提升等级到超过上限 | Clamp 到 MAX_LEVEL，多余部分不生效 | 不允许突破上限 |
| 同时拥有多个可升级武将 | 玩家逐个选择升级，无批量操作 | 每次升级都应是有意识的决策 |
| Run 结束时等级 | 重置为 1 | Roguelike 纯度 |
| 传说变体的成长系数 | 比基础版高 20-30% | 传说变体更强，成长也更快 |
| 经济型武将（糜竺等）对养成的影响 | 更多材料产出 → 更宽裕的升级空间 | 经济型武将的核心价值 |
| 新获取的武将等级 | 始终为 Lv.1 | 即使在 Run 中后期获取，也从 1 级开始 |

## Dependencies

**上游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Hero System | depends on Hero | 读取武将数据，写入 growthBonus | Hard |
| Economy | depends on Economy | 升级消耗 Material | Hard |

**下游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Event System | Event triggers Growth | 训练事件直接升级 | Soft |
| Hero Detail UI | UI depends on Growth | 显示等级和升级选项 | Hard |

## Tuning Knobs

| Parameter | Initial | Safe Range | Effect of ↑ | Effect of ↓ |
|-----------|---------|------------|------------|------------|
| `MAX_LEVEL` | 10 | 8-15 | 更长养成曲线，更多取舍 | 更快到顶 |
| `BASE_LEVEL_COST` | TBD | 2-10 | 升级更贵 | 升级更便宜 |
| `COST_INCREMENT` | TBD | 1-5 | 后期升级更贵 | 成本曲线更平 |
| `COST_ACCELERATION` | TBD | 0.5-2 | 高等级极贵 | 高等级尚可 |
| `SKILL_SCALING_RATE` | 0.08 | 0.05-0.12 | 技能成长更快 | 技能成长更慢 |
| `LEGEND_GROWTH_MULTIPLIER` | 1.25 | 1.1-1.5 | 传说变体成长更快 | 传说变体成长接近基础版 |

## Acceptance Criteria

- [ ] 消耗 Material 正确扣除并升级武将
- [ ] growthBonus 正确计算并写入 Hero System
- [ ] 技能数值随等级自动提升（scaledSkillValue 公式正确）
- [ ] 升级成本递增曲线符合公式
- [ ] 满级后无法继续升级（UI 正确灰显）
- [ ] 训练事件可免费提升等级（不消耗材料）
- [ ] 经济平衡：5 人到 Lv.8-9 消耗约占总材料产出的 60-75%
- [ ] Run 结束后等级正确重置为 1
- [ ] 传说变体成长系数高于基础版
- [ ] 升级预览正确显示属性变化
- [ ] 所有数值可通过配置文件调整，无硬编码
- [ ] Performance: 升级计算在 <1ms 内完成

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| 升级成本具体数值需配合 Economy 产出做 playtest 校准 | Systems Designer | Prototype | playtest 后确定 |
| SKILL_SCALING_RATE 是否需要按技能类型差异化 | Game Designer | Prototype | 初始统一，playtest 后视需求分化 |
| 新获取武将是否应有"追赶机制"（后期获取的武将升级更便宜） | Game Designer | Vertical Slice | 视 playtest 反馈决定 |
| 经济型武将/技能对材料产出的具体加成比例 | Economy Designer | Economy balance pass | 需要整体经济模型 |

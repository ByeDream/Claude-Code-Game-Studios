# Equipment System (装备系统)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-03-29
> **Implements Pillar**: 养成爆发, 构筑智慧, 历史沉浸

## Overview

装备系统管理武将身上的 3 个装备槽位（武器、护甲、坐骑），提供属性加成并影响战斗表现。系统整体深度有限——核心是约 20-30 件装备，前期为纯数值加成的基础通用装备，中后期引入带有轻微效果的高级通用装备，少量三国名器（青龙偃月刀、的卢马等）作为顶级内容引入质变级机制效果和武将专属加成。

## Player Fantasy

**「给关羽配上青龙偃月刀，实力天翻地覆。」**

通用装备是稳步提升——数值缓慢爬升，偶尔获得一件带效果的高级装备带来小惊喜。名器才是真正的质变时刻——当你终于给武将配上那件传说武器，看到战斗表现发生飞跃，这就是「养成爆发」支柱的核心体验。马匹系统则天然体现三国特色（赤兔马、的卢马、绝影马），服务「历史沉浸」支柱。

**Pillar 对齐**:
- **养成爆发**: 装备是武将变强的重要途径，名器带来质变
- **构筑智慧**: 装备分配是资源分配决策（给谁穿更好的装备？）
- **历史沉浸**: 名器是三国历史中真实存在的武器/坐骑

## Detailed Design

### Core Rules

#### 1. Equipment Slots

每个武将固定 3 个装备槽：

| 槽位 | 类型 | 主要属性加成 | 说明 |
|------|------|------------|------|
| 武器 | Weapon | STR 或 INT | 攻击力的主要来源 |
| 护甲 | Armor | DEF, HP | 生存能力 |
| 坐骑 | Mount | SPD | 速度加成，部分有特殊效果 |

- 每个槽位最多装备 1 件对应类型的装备
- **通用装备严格遵循槽位属性规则**：武器只加 STR/INT，护甲只加 DEF/HP，坐骑只加 SPD。无例外
- **名器不受此约束**：名器可以突破槽位属性限制（如赤兔马可能额外加 STR，藤甲可能影响 SPD）
- 装备可自由更换（不消耗资源），被替换的装备立即选择处理方式
- 同一件装备不能同时装备在两个武将身上
- **无背包设计**：获取装备时立即决定去向（装备给某武将 / 卖出 / 拆解 / 放弃），不存储
- **通用装备可复数存在**：同一种通用装备可同时出现在多个武将身上（各自独立实例）
- **名器全局唯一**：一次 Run 中每种名器最多存在 1 件，不可重复获取

#### 2. Equipment Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | 唯一标识符 (e.g., `steel_sword_02`, `named_green_dragon`) |
| `name` | string | 显示名称 (e.g., "精钢刀", "青龙偃月刀") |
| `slot` | enum | Weapon / Armor / Mount |
| `category` | enum | Basic / Advanced / Named |
| `level` | int | 装备等级 (1-3 for 通用, 4 for 名器) |
| `unique` | boolean | 是否全局唯一 (Named=true, Basic/Advanced=false) |
| `baseStats` | object | 基础属性加成 {STR?, INT?, DEF?, HP?, SPD?} |
| `effect` | Effect? | 特殊效果 (Advanced/Named only) |
| `ownerBonus` | OwnerBonus? | 专属加成 (Named only) |
| `ownerHeroId` | string? | 专属武将 ID (Named only) |
| `basePrice` | int | 基础价格（用于卖出/购买） |
| `strengthenLevel` | int | 当前强化等级 (0-3, Named 固定为 0 不可强化) |

#### 3. Equipment Tiers (渐进式复杂度)

**基础通用 (Basic) — 纯数值加成**

| 等级 | 名称格式 | 获取方式 | 属性加成范围 | 效果 |
|------|---------|---------|------------|------|
| Lv.1 | 铁[武器/甲] / 驽马 | 初始/早期事件 | +3~5 主属性 | 无 |
| Lv.2 | 钢[武器/甲] / 良马 | 中期事件/商店 | +6~10 主属性 | 无 |

- 纯粹的数值提升，玩家只需比较数字大小
- 每个等级每种槽位 2-3 个变体（偏 STR / 偏 INT / 均衡等）

**高级通用 (Advanced) — 数值 + 轻微效果**

| 等级 | 名称格式 | 获取方式 | 属性加成范围 | 效果示例 |
|------|---------|---------|------------|---------|
| Lv.3 | 精钢枪、连环甲、骏马 | 后期事件/商店/战利品 | +11~16 主属性 | 轻微效果 |

高级通用效果示例（不改变核心机制，只是小幅增益）：

| 装备 | 槽位 | 属性 | 轻微效果 |
|------|------|------|---------|
| 寒铁枪 | 武器 | STR+12 | 攻击有 10% 概率降低目标 SPD |
| 符文杖 | 武器 | INT+14 | 技能伤害 +5% |
| 连环甲 | 护甲 | DEF+13, HP+5 | 受到伤害时 8% 概率格挡 |
| 骏马 | 坐骑 | SPD+12 | 闪避率 +5% |

- 效果数值较低，属于"锦上添花"而非"质变"
- 没有武将专属加成

**名器 (Named) — 质变级效果 + 专属加成**

名器是后期主要收集点之一，数量较多。不受通用装备的槽位属性约束。

**武器类名器**:

| 名器 | 基础加成 | 特殊效果 | 专属武将 | 专属加成 |
|------|---------|---------|---------|---------|
| 青龙偃月刀 | STR+20 | 攻击附带「威压」：降低目标 DEF 10% | 关羽 | 威压效果翻倍至 20% |
| 方天画戟 | STR+25 | 攻击可同时伤害相邻两个目标 | 吕布 | 范围扩大到三个目标 |
| 羽扇纶巾 | INT+22 | INT 的 20% 加入普攻伤害结算 | 诸葛亮 | 比例提升至 35% |
| 丈八蛇矛 | STR+18 | 每 3 次攻击触发穿刺（无视 DEF） | 张飞 | 每 2 次触发 |
| 雌雄双股剑 | STR+16, INT+8 | 普攻同时计算 STR 和 INT | 刘备 | 额外 +10% 全属性 |
| 青釭剑 | STR+17 | 攻击无视目标 30% DEF | 赵云 | 无视比例提升至 50% |
| 倚天剑 | STR+19 | 暴击时额外造成 STR×0.3 伤害 | 曹操 | 暴击额外伤害翻倍 |
| 古锭刀 | STR+15 | 攻击时 15% 概率破甲（目标 DEF-20% 持续 3 秒） | 孙坚 | 概率提升至 30% |
| 七星宝刀 | STR+14, SPD+5 | 首次攻击必定暴击 | — | — (通用) |
| 铁脊蛇矛 | STR+16 | 攻击附带中毒（持续伤害） | 程普 | 中毒伤害翻倍 |

**护甲类名器**:

| 名器 | 基础加成 | 特殊效果 | 专属武将 | 专属加成 |
|------|---------|---------|---------|---------|
| 藤甲 | DEF+18 | 物理伤害减免 30%，但火攻伤害 +50% | — | — (通用) |
| 白银甲 | DEF+15, SPD+3 | 受到伤害时 10% 概率反射 20% 伤害 | 赵云 | 反射概率提升至 25% |
| 锁子黄金甲 | DEF+20, HP+10 | HP 低于 30% 时 DEF 翻倍 | 曹仁 | 触发阈值提升至 50% |

**坐骑类名器**:

| 名器 | 基础加成 | 特殊效果 | 专属武将 | 专属加成 |
|------|---------|---------|---------|---------|
| 赤兔马 | SPD+20 | 战斗开始时冲锋到最前列 | 关羽/吕布 | 冲锋附带 STR×0.5 伤害 |
| 的卢马 | SPD+15 | 受到致命伤害时 50% 概率闪避 | 刘备 | 闪避概率提升至 80% |
| 绝影 | SPD+18 | 每次攻击后 20% 概率获得额外行动 | 曹操 | 概率提升至 35% |
| 爪黄飞电 | SPD+16, STR+5 | 战斗开始时全体友军 SPD+5 | 曹操 | 加成提升至 SPD+10 |

- 名器总计约 **15-20 件**（MVP 5-8 件，完整版 15-20 件）
- 名器作为重要收集点，每件都有独特的历史背景和收集价值
- 任何武将都能装备名器，但专属武将获得额外加成
- 名器不可强化、不可卖出/拆解
- 名器不受槽位属性约束（坐骑可加 STR，护甲可加 SPD 等）
- 获取方式：Boss 掉落、特殊历史事件、困难战斗奖励

#### 4. Equipment Strengthening (强化)

通用装备（Basic + Advanced）可强化，名器不可强化。

| 强化等级 | 属性增幅 | 金币消耗 | 材料消耗 |
|---------|---------|---------|---------|
| +1 | 基础属性 ×1.2 | 10 | 5 |
| +2 | 基础属性 ×1.4 | 20 | 10 |
| +3 | 基础属性 ×1.6 | 30 | 15 |

- 强化 100% 成功（无失败机制——避免挫败感，符合简洁原则）
- 强化后效果（如有）不变，只提升数值部分
- 强化等级在装备名称后显示（如"精钢枪+2"）

#### 5. Equipment Acquisition

| 获取方式 | 可获得类型 | 触发 |
|---------|-----------|------|
| 初始 | Basic Lv.1 | Run 开始时，君主自带 |
| 战斗掉落 | Basic / Advanced | 普通战斗后随机 |
| 商店购买 | Basic / Advanced | 市集节点 |
| 事件奖励 | Basic / Advanced | 特定事件 |
| Boss 掉落 | Advanced / Named | Boss 战后 |
| 历史事件 | Named | 特殊剧情 (e.g., 张飞获丈八蛇矛) |

### States and Transitions

无背包设计下，装备只存在于武将身上：

| State | Entry | Exit | Behavior |
|-------|-------|------|----------|
| **Equipped** | 获取时装备给武将 / 从其他武将转移来 | 卖出/拆解 → Destroyed / 转移给其他武将 | 属性加成和特殊效果生效 |
| **Destroyed** | 卖出 / 拆解 / 丢弃 / Run 结束 | — (终态) | 产出金币或材料（丢弃则无产出） |

**获取新装备流程**:
1. 获得新装备 → 显示装备信息
2. 选择目标武将和槽位
3. 如果槽位为空 → 直接装备
4. 如果槽位已有装备 → 显示新旧对比 → 确认替换 → 旧装备立即选择：卖出/拆解/丢弃
5. 也可以选择不装备新装备 → 直接卖出/拆解/丢弃

**武将间装备转移**:
- 编队界面可将 A 武将的装备转给 B 武将（同类型槽位）
- 如果 B 对应槽位为空 → 直接转移（A 槽位变空）
- 如果 B 对应槽位已有装备 → **两件装备交换**（A 的给 B，B 的给 A）
- 用途：招到关羽后，把之前给张飞的青龙偃月刀交换过来

**主动卖出/拆解**:
- 在武将详情界面，可以对该武将身上的装备执行：卖出(→Gold) / 拆解(→Material)
- 操作后该槽位变为空
- 名器不可卖出/拆解（UI 灰显）

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Hero System** | Equipment → Hero | 每次装备变更时重算 `equipBonus` = sum of all equipped items' stat bonuses |
| **Economy** | Equipment ↔ Economy | 卖出: `economy.earn(sellGold, 0)` / 拆解: `economy.earn(0, disassembleMat)` / 强化: `economy.spend(gold, material)` |
| **Battle Engine** | Equipment → Battle | 战斗开始时读取所有 Deployed 武将的装备效果列表，注册战斗触发器 |
| **Loot/Rewards** | Loot → Equipment | 战利品产出装备实例，调用 `addToBackpack(equipment)` |
| **Shop** | Shop → Equipment | 商店出售装备实例，购买后加入背包 |
| **Hero Detail UI** | Equipment → UI | 提供装备数据用于显示 |

**公共接口**:
```typescript
interface EquipmentAPI {
  equip(heroId: string, equipment: Equipment): ReplacedEquipment | null;
  swapEquip(heroIdA: string, heroIdB: string, slot: EquipSlot): void; // A↔B 交换同槽装备
  strengthen(heroId: string, slot: EquipSlot): void;  // consumes resources via Economy
  sell(heroId: string, slot: EquipSlot): void;         // 主动卖出武将身上的装备
  disassemble(heroId: string, slot: EquipSlot): void;  // 主动拆解武将身上的装备
  getEquipBonus(heroId: string): StatBonus;
  isNamedOwned(namedId: string): boolean;  // check if a unique Named weapon exists in this Run
}
```

## Formulas

### Equipment Stat Bonus

```
equipBonus[stat] = sum(equippedItems.map(item => item.baseStats[stat] * (1 + item.strengthenLevel * STRENGTHEN_BONUS_RATE)))
```

| Variable | Type | Value | Description |
|----------|------|-------|-------------|
| STRENGTHEN_BONUS_RATE | float | 0.2 | 每级强化的属性增幅 |
| strengthenLevel | int | 0-3 | 当前强化等级 |

### Sell / Disassemble (referenced from Economy GDD)

```
sellGold = equipBasePrice * SELL_RATIO (0.5)
disassembleMaterial = equipLevel * DISASSEMBLE_RATIO (3)
```

名器: sellGold = 0, disassembleMaterial = 0 (不可卖出/拆解)

### Strengthen Cost

```
strengthenGoldCost = 10 * targetLevel
strengthenMaterialCost = 5 * targetLevel
```

| targetLevel | Gold Cost | Material Cost |
|-------------|-----------|---------------|
| +1 | 10 | 5 |
| +2 | 20 | 10 |
| +3 | 30 | 15 |

### Base Prices (for sell value calculation)

| Category | Level | basePrice |
|----------|-------|-----------|
| Basic | Lv.1 | 15 |
| Basic | Lv.2 | 30 |
| Advanced | Lv.3 | 50 |
| Named | — | 0 (不可售) |

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| 替换装备时旧装备 | 立即弹出处理选择：卖出/拆解/丢弃 | 无背包设计，装备不存储 |
| 武将 A 装备转给武将 B，B 同槽位有装备 | 两件装备交换（A 的给 B，B 的给 A） | 无中间态，直接交换 |
| 武将 A 装备转给武将 B，B 同槽位为空 | 直接转移，A 槽位变空 | 简单转移 |
| 武将被移出阵容 | 装备保持在武将身上 | 装备跟随武将，非独立管理 |
| 获取名器但该名器已存在于某武将身上 | 不会发生——系统检查 `isNamedOwned`，已拥有的名器不会再次出现在掉落/事件中 | 名器全局唯一 |
| 获取通用装备但和现有完全相同 | 正常获取，通用装备可复数存在 | 两个武将可以各拿一把铁刀 |
| 名器的专属武将不在阵容中 | 名器可装备给其他人，没有专属加成 | 不限制使用自由度 |
| 尝试强化名器 | UI 灰显强化按钮，提示"名器无需强化" | 清晰反馈 |
| 尝试卖出/拆解名器 | UI 灰显，提示"名器不可出售" | 防止误操作 |
| +3 装备继续强化 | UI 灰显，提示"已达最高强化等级" | 清晰反馈 |
| 强化资源不足 | UI 灰显强化按钮 + 显示差额 | 与 Economy edge case 一致 |
| Run 结束时所有装备 | 全部销毁，不保留跨 Run | Roguelike 纯度 |
| 获取装备时选择不装也不处理 | 不允许——必须做出选择（装备/卖/拆/弃） | 无背包则无法悬而不决 |

## Dependencies

**上游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Hero System | depends on Hero | 装备附着在武将身上，需要武将数据和装备槽定义 | Hard |

**下游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Hero Growth | Growth depends on Equipment | 养成系统可能影响装备槽数或效果 | Soft |
| Battle Engine | Battle depends on Equipment | 战斗读取装备效果并执行 | Hard |
| Loot/Rewards | Loot produces Equipment | 战利品系统产出装备实例 | Hard |
| Shop | Shop sells Equipment | 商店提供装备购买 | Hard |
| Hero Detail UI | UI reads Equipment | 显示装备信息 | Hard |
| Economy | Economy ↔ Equipment | 卖出/拆解/强化的资源流动 | Hard |

## Tuning Knobs

| Parameter | Current | Safe Range | Effect of Increase | Effect of Decrease |
|-----------|---------|------------|-------------------|-------------------|
| `EQUIP_SLOTS` | 3 | 2-4 | 更多构筑选择 | 更简洁 |
| `MAX_STRENGTHEN_LEVEL` | 3 | 1-5 | 通用装备上限更高 | 强化影响更小 |
| `NAMED_OWNER_BONUS_MULT` | 2.0 | 1.5-3.0 | 专属加成更强，鼓励正确搭配 | 专属加成弱化，自由搭配更可行 |
| `LV1_STAT_RANGE` | 3-5 | 2-8 | 基础装备更强 | 基础装备更弱 |
| `LV2_STAT_RANGE` | 6-10 | 4-14 | 中级装备更强 | 中级装备更弱 |
| `LV3_STAT_RANGE` | 11-16 | 8-22 | 高级通用更强 | 高级通用更弱 |
| `NAMED_WEAPON_COUNT` | 5-8 (MVP) / 15-20 (Full) | — | 更多收集目标和历史沉浸 | MVP 更快完成 |

## Acceptance Criteria

- [ ] 3 个装备槽位正确显示和交互（武器/护甲/坐骑）
- [ ] 装备穿脱正确更新武将的 `equipBonus`
- [ ] 无背包：获取装备时强制选择去向（装备/卖/拆/弃）
- [ ] 通用装备可复数存在（多个武将可同时持有同种通用装备）
- [ ] 名器全局唯一（已拥有的名器不再出现在掉落池中）
- [ ] 通用装备强化正确计算加成 (base × (1 + level × 0.2))
- [ ] 强化消耗正确扣除 Gold 和 Material
- [ ] 名器特殊效果在战斗中正确触发
- [ ] 名器专属加成仅在对应武将装备时激活
- [ ] 名器不可强化/不可卖出/不可拆解（UI 正确灰显）
- [ ] 高级通用装备的轻微效果正确生效
- [ ] 卖出/拆解产出与 Economy GDD 公式一致
- [ ] 装备转移（武将间交换）流程正确：空槽直接转移，有装备则交换
- [ ] 主动卖出/拆解：可从武将详情界面对已装备物品执行，槽位正确清空
- [ ] Run 结束时所有装备正确清除
- [ ] 所有数值可通过配置文件调整，无硬编码
- [ ] Performance: 装备属性计算在 <1ms 内完成

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| 高级通用装备的具体效果列表需要扩展 | Game Designer | Vertical Slice | 随武将设计同步扩展 |
| 名器的获取条件和历史事件触发需配合 Campaign 设计 | Game Designer + Narrative | Campaign GDD | 设计剧本时确定 |
| 是否需要装备「套装效果」（同系列多件装备的额外加成） | Game Designer | Alpha | 视 playtest 反馈决定，当前不设计 |

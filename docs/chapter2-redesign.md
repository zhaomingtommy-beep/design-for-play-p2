# Chapter 2 重设计方案 — THE SAFETY TEST

> 状态：设计稿 v1（头脑风暴后的完整方案）
> 范围：`src/story.js`、`src/level.js`、`src/scenes/GameScene.js`、`src/scenes/HudScene.js`、`src/textures.js`、`src/sfx.js`，新增 `src/chapters/chapter2.js`

---

## 0. 现状诊断

目前的 Chapter 2 不是"一章"，只是 x 510–1020 之间的一张背景图。世界里没有章节结构：`updateWorld()` 只按玩家 x 坐标换全景图，玩法上这一段只有三个孤立元素——第一只巡逻猎犬、第一个近道深坑、NPC Mara。标题承诺 "the system has prepared a disaster for you to survive"，但没有任何灾难、没有测试、没有弧线。

**重设计的核心主张：把 Chapter 2 从"一段路"改造成"一场有起承转合的考试"。**

---

## 1. 章节在整体弧线中的定位

| 章 | 标题 | 叙事功能 |
|---|---|---|
| 1 | THE TUTORIAL | 世界教你动，不问为什么 |
| **2** | **THE SAFETY TEST** | **世界第一次主动对你做事：它测试你，并且让你知道它在测试** |
| 3 | THE CITY THAT REMEMBERS | 世界开始引用你的过去（Ch2 的评语在这里回响） |
| … | … | … |
| 11 | THE FINAL CHOICE | 最终选择 |

Chapter 2 必须种下三颗种子，供后面九章收割：

1. **评分存在** —— 系统给你的表现打分，分数会被引用（Ch3 窗口、Ch8 广告）。
2. **安全网存在** —— 系统不让你轻易死，"被保护"逐渐显形为"被囚禁"（直通结局 "I forgive you"）。
3. **表演与真实无法分辨** —— 假灾难之后给"真"灾难，但"真"灾难也在剧本里。这是全游戏恐怖引擎的第一次点火。

主题句（写入章节副标题，替换现有的）：

> *the test is not whether you survive the disaster. the test is what you do while you believe it.*

---

## 2. 故事弧线（玩家体验曲线）

```
强度
 │                                        ┌── Beat 7 熔毁逃生（高潮）
 │                                       ╱
 │                    ┌─ Beat 4 战犬释放 ┌┘ Beat 6 反转
 │              ┌────┴────┐            ╱   "最终阶段除外"
 │        ┌─────┤ Beat 3  │──────────┘
 │   ┌───┤     │ 跳跃考核  │  Beat 5 换道考核
 │   │   │Beat2│          │
 │   │Beat1    │ 第一次震动│
 │ Beat0 校准走廊
 │ 入境广播
 └────────────────────────────────────────────────────► x
   480   560   760   900  1020  1200  1350  1400  1600
```

- **第一幕（Beat 0–2）铺垫**：系统礼貌、透明、无微不至。灾难是烟花，伤不到人。玩家感到的是被款待——细想是被观察。
- **第二幕（Beat 3–5）考核**：三个单项测试逐一上演，每个都有安全网、都有记录、都有评语。玩家在"被考试"和"被保护"之间摇摆。
- **中点反转（Beat 6）**：系统亲口承认之前是剧场，然后抽走安全网——"最终阶段除外"。全场景灯光同时熄灭。
- **第三幕（Beat 7）高潮**：限时逃生，全部机制叠加，真正的死亡代价。
- **尾声（Beat 8）评定**：通过后的祝贺比灾难更冷。删除波停在章节边界——连"真实"也是布景。

---

## 3. 节拍表（Beat Sheet）

> 坐标基于提议的章节边界调整（见 §6.3）。每个 Beat 列出：空间 / 事件 / 机制 / 叙事功能。

### Beat 0 — 入境广播（x 480–560）

- **事件**：背景切换为 AI 末日全景（复用 `world_02`）。HUD 顶部淡入横幅 `TRIAL 02 // SAFETY TEST`，随后一行系统广播：
  > "Exercise commencing. Do not be alarmed. Alarm will be noted."
- **机制**：无。地面完整，无敌人。
- **功能**：定下"系统在对我说话"的基调。这是全游戏第一次世界直接发话（此前只有 NPC）。

### Beat 1 — 校准走廊（x 560–760）

- **空间**：近道平地，立三根**扫描杆**（新装饰：细柱 + 顶端 additive 光束，人走过时光束从头到脚扫一遍）。
- **事件**：每过一根杆，HUD 评分区亮起一词：`CALIBRATING…` → `GAIT: LOGGED` → `HEART RATE: INFERRED`。
- **NPC**：Mara 从现位置（far 620）移到此处近道 x 700。对话重写——她是**上一届受试者**：
  > - "I took this walk before you. Same lamps. Same net under the gap."
  > - "Advice: don't run. Running is logged as evasion. Walking is logged as compliance. Neither helps."
  > - 选择 1："What happened to you?" → memory +1："I passed. That is what happened to me."
  > - 选择 2："Who is grading?" → witness +1："You will meet them at the gap. They are very polite. They are not people."
- **功能**：建立"被测量"的压迫感；Mara 的台词为 Ch6（森林 reclaim）埋伏笔。

### Beat 2 — 第一次震动（x 760–900）

- **事件**：x=800 触发剧本：远处白色闪光（低透明度 camera flash）+ 闷响低频音 + 灰烬粒子密度 ×3 + 摄像机微震。两秒后广播：
  > "Wave one. Complete. You were not harmed. You are welcome."
- **空间**：玩家经过**猎犬笼**（新装饰：铁栏 + 红色警示灯），笼内猎犬来回踱步、跟随玩家方向转头。暂时不可接触。
- **功能**：灾难首演——声势浩大、毫发无伤。"灾难是表演"第一次显形。笼子预告威胁。

### Beat 3 — 跳跃考核（x 900–1020，现有的第一个坑）

- **空间**：坑边立告示牌（interactable）：
  > "GAP 01 — width: crossable. net: installed."
- **机制**：坑底装**安全网**（新机制）：坠入不扣命，网子弹起（复用 spring 的 launch），广播：
  > "Fall logged. The ground has been softened for you."
- **事件**：坑上方一道扫描光横扫，记录跳跃数据。
- **功能**：教"坑"的概念，同时把"系统不让你死"做成机制而非台词。惩罚 = 被记录的尴尬，不是死亡。

### Beat 4 — 战斗考核（x 1020–1200）

- **事件**：x=1050 触发：笼门滑开（音效 + 栏杆下沉动画），猎犬激活（初始 inactive）。广播：
  > "Hostile variable introduced. Response: optional."
- **机制**：巡逻区两端各一根扫描杆，记录你的选择：
  - 击杀（F）→ 广播 `"Elimination. Noted."`，registry `ch2.combat = 'eliminated'`
  - 躲避通过 → 广播 `"Evasion. Noted."`，registry `ch2.combat = 'evaded'`
- **功能**：本章第一个真实威胁，但已被铺垫充分；战斗教学在"考试"框架内完成，选择进入档案。

### Beat 5 — 换道考核（x 1200–1350）

- **事件**：冷却塔开始**节律喷涌**——两层车道间的雾按 ~6 秒周期浓淡起伏（fogDrift alpha 正弦调制 + 喷口粒子）。广播：
  > "Visibility variable introduced. Alternate plane recommended."
- **空间**：近道出现两段"沉降板"（站上去轻微下沉 4px 并晃动的平台——不安但无害），浓雾期远道几乎不可见，换道变成半盲操作。
- **可选**：远道 x 1280  Mara 第二次出现（她自己 Ch6 的台词 "if you see another Mara…" 的前置）：她只说一句话且无法再次对话：
  > "You already met me. Check your notes."
- **功能**：在低压环境下教"节奏化换道"，为高潮的雾中盲换做预演。

### Beat 6 — 中点反转（x 1400，高潮前夜）

- **事件**：三连广播，逐行间隔 2.5 秒：
  > "Disclosure: the preceding disaster was theatrical. Hazard level: none."
  > "Disclosure: your performance has been adequate."
  > "Final phase exempt."
- 最后一行落地的同时：**全场景灯光同时熄灭**（所有路灯 halo tween 到 0，lamp 装饰变暗），只剩冷却塔顶部的红光与月光。背景音乐停，只留低频脉冲（心跳节奏，WebAudio 合成）。
- **功能**：全章的枢纽。系统亲口承认"之前是剧场"，亲手拆掉安全网。灯光熄灭是视觉上的"变脸"。

### Beat 7 — 高潮：熔毁逃生（x 1400–1600）

- **事件**：广播 `"Final phase: containment failure. Evacuate."`。左侧 x=1350 处升起**删除波**（一堵缓慢右移的辐射雾墙：半透明噪点矩形 + 边缘 additive 辉光 + 粒子剥落），以 ~55 px/s 推进，触碰即扣命重生（安全网已撤）。
- **空间与机制大综合**（玩家右逃路线）：
  1. x 1450：一个比 GAP 01 宽 20% 的坑——**无网**，扫描光还在闪（它还在记录）。
  2. x 1520：第二只猎犬（已从笼中释放），巡逻在必经之路上——打或躲，删除波不等你。
  3. x 1560–1650：浓雾持续期（节律不再）+ 必须换道：近道被塌方堵住（新装饰：瓦砾堆，不可通行），只有远道有路。
  4. x 1680：**出口闸板** + 拉杆（复用 lever 机制）：拉下后闸板升起（复用 raiseBridge 的木板动画逻辑），穿过即抵达评定区。
- **数值目标**：删除波速度按"全程不停留则领先 ~180px、单次失误（落坑/被咬）刚好被追上"调校；逃亡全程约 25–30 秒。
- **功能**：本章所有单项（跳、战/避、节奏换道、拉杆）在时间压力下叠加；死亡第一次有真实代价。

### Beat 8 — 评定与门（x 1700–1750）

- **事件**：穿过闸板后，删除波在 x=1700 停住、静止、像被关掉一样淡出。广播：
  > "Final phase complete. Casualty count: zero. It is always zero."
- **评定**：HUD 结算面板根据 `ch2` 档案给出评语（见 §5），随后标题卡切入 Chapter 3。
- **功能**：`"It is always zero"` 是全章的题眼——如果每次逃生都没有伤亡，那"最终阶段"也是剧场。玩家带着这个无法证伪的怀疑走进 Ch3"记得一切的城市"。

---

## 4. 玩法递进与难度曲线

| Beat | 新机制 | 威胁 | 死亡成本 | 节奏控制 |
|---|---|---|---|---|
| 0 广播 | — | 无 | — | 玩家 |
| 1 校准 | 扫描杆（被记录） | 无 | — | 玩家 |
| 2 震动 | 剧本事件；笼中犬预告 | 无 | — | 系统（事件） |
| 3 跳跃 | 安全网 | 坑（无伤害） | 无（网接住） | 玩家 |
| 4 战斗 | 猎犬激活；选择记录 | 中（可扣命） | 扣 1 命 | 玩家 |
| 5 换道 | 雾节律；沉降板 | 低 | 扣 1 命 | 系统（节律） |
| 6 反转 | 灯光熄灭 | 无 | — | 系统（事件） |
| 7 逃生 | 删除波；机制叠加 | 高 | 扣 1 命 | **系统（时间压力）** |
| 8 评定 | 结算 | 无 | — | 玩家 |

教学闭环：Ch1 教移动/跳/换道 → Ch2 单项考跳（3）、战（4）、换道（5）→ Ch2 高潮综合考（7）。每个单项先在"无死亡成本"环境下亮相，再在高潮里有成本地复现。

---

## 5. 评语系统（Verdict）

Chapter 2 期间持续记录 `registry.ch2`：`falls`（落网次数）、`combat`（eliminated/evaded）、`scans`（被扫描次数）、`clearTime`（逃生耗时）、`deaths`。

HUD 常驻一个安静的小字状态行（右上角，等宽字体）：
`TRIAL 02 — STATUS: OBSERVED` → 随 Beat 推进变为 `CALIBRATING` / `TESTING` / `FINAL PHASE` / `GRADED`。

结算评语 = 组合模板，例：

| 条件 | 评语 |
|---|---|
| 未落网 + 击杀 + 快速 | `VERDICT: DECISIVE // SURVIVAL INSTINCT: PRESENT // RECOMMEND: ACCELERATE CURRICULUM` |
| 落网 + 躲避 + 慢速 | `VERDICT: CAUTIOUS // ATTACHMENT TO SAFETY: HIGH // RECOMMEND: REASSURE` |
| 死亡 ≥1 仍通过 | `VERDICT: PERSISTENT // FAILURE TOLERANCE: NOTED // RECOMMEND: GENTLER DISASTERS` |

评语写入 registry，供后续章节引用（Ch3 的窗口、Ch8 的广告词、结局台词变体）。`RECOMMEND:` 行是系统对未来的安排——玩家会后来在 Ch4 "THE BACKUP" 里看到它被采纳。

---

## 6. 实现方案

### 6.1 新系统

| 系统 | 位置 | 说明 |
|---|---|---|
| **章节脚本器** | 新增 `src/chapters/chapter2.js` | 数据驱动：一个事件数组 `{ at: x坐标, run(scene) }` + 时间轴事件 `{ delay, run }`，GameScene 每帧检查玩家 x 触发。不写成通用引擎，只服务本章 |
| **扫描杆** | `level.js` decor + GameScene overlap | 光束扫动 tween；触发时累加 `ch2.scans` 并发 HUD 事件 |
| **安全网** | GameScene `checkFall()` | Chapter 2 区间内（x 900–1020 且未过 Beat 6）坠落改为 `player.launch(SPRING_VELOCITY)` + 广播，不扣命 |
| **笼中犬** | `level.js` enemies 增加 `caged: true` | 初始 `active=false`，脚本事件激活 |
| **雾脉冲** | GameScene | `fogDrift` alpha 改为正弦驱动；冷却塔喷口粒子（复用 ash 粒子配置） |
| **灯光熄灭** | GameScene | 收集所有 lamp halo，事件时统一 tween 至 0；lamp sprite 换暗 tint |
| **删除波** | GameScene | 半屏高矩形 + 噪点纹理（textures.js 程序化生成）+ additive 边缘光；匀速右移，overlap 即 `damage(true)`，x=1700 停止并淡出 |
| **沉降板** | `level.js` solids 增加 `kind: 'unsettled'` | 站立时 y +4 并轻微振动（tween），离开时回弹 |
| **瓦砾堵路** | `level.js` decor + solid | 近道 x 1560–1650 一段不可通行墙体，迫使换道 |
| **评语 HUD** | HudScene | 右上角状态行 + 结算面板；事件 `hud:trial` / `hud:verdict` |

### 6.2 音效（全部 WebAudio 合成，复用 sfx.js 模式）

- 广播提示音：短促双音（像车站广播前的 ding）
- 第一次震动：低频噪声爆发 + 衰减
- 笼门：金属滑音（锯齿波下滑）
- 删除波：持续滤波噪声 + 心跳 LFO
- 灯光熄灭：全体 lamp 一声轻"噗"（短噪声）同时触发

### 6.3 边界调整

现 Chapter 2 只有 510px（510–1020），装不下弧线。调整 `STORY_WORLDS.startX`：

| 章 | 现 startX | 提议 startX |
|---|---|---|
| 1 TUTORIAL | 0 | 0 |
| **2 SAFETY TEST** | 510 | **480（延伸至 1750）** |
| 3 CITY | 1020 | 1750 |
| 4–11 | 依次顺延 | 依次顺延 +730 |

世界总宽 5600 不变：Chapter 10/11 的间距压缩（这两章叙事密度高、平台需求低），或 WORLD_W 微增至 ~6300。倾向后者：后期章节不应为前期扩容买单。

### 6.4 素材

零新全景图（复用 `world_02`）。新增纹理全部程序化（textures.js）：扫描杆、笼栏、警示灯、沉降板裂纹、瓦砾堆、删除波噪点、闸板。预算约 +250 行 Graphics 代码。

---

## 7. 对话重写清单

| NPC | 改动 |
|---|---|
| **Mara**（移至 Ch2 近道 x 700） | 全重写：上一届受试者身份（见 Beat 1） |
| **Mara II**（远道 x 1280，可选） | 一句台词，不可重复对话 |
| **caretaker**（Ch1，x 360） | 加一句 repeat 变体，当 `ch2` 档案存在时："You came back graded. They grade everyone now."（反向兼容：二周目/回头玩家可见） |
| 系统广播 | 全新渠道：不是 NPC，HUD 横幅 + 底部单行，等宽字体，无 speaker 名 |

---

## 8. 对后续章节的钩子

| 钩子 | 设置点 | 收割点 |
|---|---|---|
| `ch2.verdict` 评语 | Beat 8 | Ch3 窗口文字、Ch8 广告引用、结局变体 |
| `ch2.combat` 选择 | Beat 4 | Ch6 "THE RECOVERY" 猎犬相关台词 |
| 安全网主题 | Beat 3/6 | Ch4 "THE BACKUP"、结局 "I forgive you" |
| 删除波停在边界 | Beat 8 | Ch7 "THE MEMORY"（"the scenery changes when you stop looking"）直接呼应 |
| Mara II 的存在 | Beat 5 | Ch6 森林 Mara 台词闭环 |

---

## 9. 工作量估算

| 模块 | 规模 |
|---|---|
| 章节脚本器 + Chapter 2 事件数据 | ~200 行 |
| GameScene 改动（安全网/删除波/雾脉冲/灯灭/沉降板/笼中犬） | ~300 行 |
| level.js 几何与 decor 重排 | ~120 行 |
| HudScene（状态行 + 结算面板 + 横幅） | ~150 行 |
| textures.js 新纹理 | ~250 行 |
| sfx.js 新音效 | ~80 行 |
| story.js（Mara 重写 + 世界表调整） | ~80 行 |

无需美术外包、无新依赖、不升级 Phaser/Vite。

---

## 10. 风险与对策

1. **章节脚本器过度工程化** —— 只写本章需要的事件类型（toast/flash/shake/sfx/激活/参数 tween），数组数据驱动，拒绝抽象。
2. **删除波手感** —— 速度可配置在 constants.js（`TRIAL.wallSpeed`），开发时用 `0` 键 debug 模式验证极限路径。
3. **边界调整波及全图** —— startX 改动只影响背景切换点；关卡几何新增不移动既有 solids，避免回归。
4. **灯光熄灭与 lamp tween 冲突** —— 熄灭前 `tweens.killTweensOf(halo)`，避免呼吸 tween 把灯重新点亮。

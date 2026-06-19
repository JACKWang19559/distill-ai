# Phase 5: 知识图谱设计文档

> **创建日期**：2026-06-18
> **关联任务**：Task 5.1-5.4
> **状态**：已批准，待实现

---

## 1. 目标

为个人知识库提供图谱可视化，以**发现隐藏关联**为核心目的，兼顾可视化浏览和知识结构洞察。

**核心价值**：当两篇看似无关的知识提到了同一个实体（人物/概念/组织等），图谱自动建立关联并可视化呈现，帮助用户发现自己未意识到的知识联系。

---

## 2. 架构概览

```
蒸馏完成 → createConnections() → KnowledgeConnection 表
                                          ↓
GET /api/graph?filters ← graph.service.ts ← 查询 Knowledge + KnowledgeConnection
        ↓
   { nodes, edges }
        ↓
   @xyflow/react 力导向渲染
```

**三层架构：**

| 层 | 文件 | 职责 |
|----|------|------|
| Service 层 | `services/graph.service.ts` | 关联计算（实体共现）+ 图谱数据查询 |
| API 层 | `app/api/graph/route.ts` | 返回 `{ nodes, edges }`，支持过滤参数 |
| UI 层 | `app/(dashboard)/graph/page.tsx` | @xyflow/react 力导向可视化 + 过滤面板 |

---

## 3. 关联算法（实体共现）

### 3.1 触发时机

蒸馏完成后自动调用 `createConnections(newKnowledgeId, userId)`，在 `distill.service.ts` 的 `processDistillTask()` 中，蒸馏成功后、创建标签后调用。

### 3.2 算法逻辑

```
输入：newKnowledgeId, userId
输出：创建/更新 KnowledgeConnection 记录

1. 查询新知识的 distilledData.entities（数组：[{name, type}]）
   - 若 entities 为空，直接返回（无法建立关联）

2. 查询用户所有其他知识（未软删除）的 entities
   - 批量查询，提取 id + distilledData.entities

3. 对每条其他知识：
   - newEntities = 新知识的实体名集合（Set<string>）
   - existingEntities = 该知识的实体名集合
   - sharedEntities = newEntities ∩ existingEntities
   - 若 sharedEntities.size > 0：
     - weight = sharedEntities.size / min(newEntities.size, existingEntities.size)
     - reason = `共享实体: ${sharedEntities 列表（最多 5 个）}`
     - upsert KnowledgeConnection {
         source: newKnowledgeId,
         target: existingId,
         weight, reason
       }

4. 返回创建的关联数
```

### 3.3 权重语义

- **weight = 1**：一方的实体完全被另一方包含（最强关联）
- **weight = 0.5**：一半实体共享
- **weight 范围**：0-1（开区间，0 不创建边）

### 3.4 性能分析

- **时间复杂度**：O(n) per new knowledge（n = 用户知识总数）
- **空间复杂度**：O(n)（加载所有知识的 entities）
- **预期规模**：个人知识库 < 1000 条，entities 每条 < 20 个，可接受
- **优化**：entities 名集合用 Set 存储，交集计算 O(min(m, n))

### 3.5 边的方向

KnowledgeConnection 是有向边（source → target），但图谱可视化中按**无向边**处理（查询时 OR source/target）。创建时统一：新知识为 source，已有知识为 target。

---

## 4. API 设计

### 4.1 `GET /api/graph` — 获取图谱数据

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sourceTypes` | string (逗号分隔) | 全部 | 来源类型过滤：pdf,text,url,douyin,xiaohongshu |
| `entityTypes` | string (逗号分隔) | 全部 | 实体类型过滤：person,concept,organization,technology,location,event |
| `minWeight` | float | 0 | 最小关联强度阈值（0-1） |
| `startDate` | ISO date | 无 | 创建时间起始 |
| `endDate` | ISO date | 无 | 创建时间截止 |
| `limit` | int | 200 | 最大节点数（防止过大） |

**返回结构：**

```typescript
interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;      // 用户总知识数
    totalEdges: number;      // 用户总关联数
    filteredNodes: number;   // 过滤后节点数
    filteredEdges: number;   // 过滤后边数
  };
}

interface GraphNode {
  id: string;
  title: string;
  sourceType: "text" | "markdown" | "url" | "pdf" | "douyin" | "xiaohongshu";
  entityCount: number;       // 该知识的实体总数
  entities: Array<{ name: string; type: string }>;  // 实体列表（用于过滤和展示）
  createdAt: string;         // ISO date
}

interface GraphEdge {
  source: string;            // Knowledge ID
  target: string;            // Knowledge ID
  weight: number;            // 0-1
  sharedEntities: Array<{ name: string; type: string }>;  // 共享实体列表
}
```

**过滤逻辑：**
1. 先过滤节点（sourceType + entityType + dateRange）
2. 再过滤边（两端节点都在过滤后节点集中 + minWeight）
3. 若过滤后节点数 > limit，按度中心性（关联数）降序取前 limit 个

### 4.2 认证

所有端点需 `auth()` 校验，只返回当前用户的数据。

---

## 5. 可视化设计

### 5.1 布局

**力导向布局**（Force-directed），使用 `d3-force` 计算布局位置，@xyflow/react 负责渲染。

- 节点间排斥力（charge）：`d3.forceManyBody().strength(-300)`
- 边的弹簧吸引力（link distance）：`d3.forceLink().distance(80).strength(0.1)`
- 初始随机位置
- 布局稳定后停止计算（alpha decay 到 0），节省 CPU

### 5.2 节点设计

**视觉属性：**

| 属性 | 映射 | 说明 |
|------|------|------|
| 大小 | 度中心性 | 关联数越多越大，范围 24-48px |
| 图标 | 来源类型 | 几何图形（非 emoji） |
| 颜色 | 来源类型 | 见下表 |
| 标签 | 标题 | 下方显示，截断 15 字符 |

**来源类型 → 图标 + 颜色：**

| 来源类型 | 几何图标 | 颜色 |
|----------|----------|------|
| PDF | □ 方形 | #3b82f6 蓝 |
| Text/Markdown | ○ 圆形 | #8b5cf6 紫 |
| URL | ◇ 菱形 | #10b981 绿 |
| Douyin | △ 三角形 | #ec4899 粉 |
| Xiaohongshu | ⬡ 六边形 | #f59e0b 橙 |

**自定义节点组件** `GraphNode.tsx`：
- 圆形容器（border-color = 来源类型颜色）
- 中心几何图标（SVG，stroke = 来源类型颜色）
- 下方标题文本
- 悬停时显示完整标题（tooltip）

### 5.3 边设计

| 属性 | 映射 |
|------|------|
| 粗细 | weight（0.5px-3px） |
| 透明度 | weight（0.2-0.8） |
| 颜色 | 灰色 #333 |
| 悬停 | 显示共享实体列表 tooltip |

### 5.4 交互

| 操作 | 行为 |
|------|------|
| 点击节点 | 跳转 `/knowledge/[id]` |
| 悬停节点 | tooltip：完整标题、来源、实体数、创建时间 |
| 悬停边 | tooltip：共享实体列表 |
| 拖拽节点 | 调整位置（力导向重新布局） |
| 滚轮 | 缩放画布 |
| 右键拖拽 | 平移画布 |
| 双击空白 | 重置视图（fitView） |

### 5.5 控制面板

`GraphControls.tsx` — 浮动在图谱右上角：

- **缩放按钮**：放大 / 缩小 / 重置视图
- **布局按钮**：重新布局（重新用力导向算法排列）

### 5.6 过滤面板

浮动在图谱左侧：

- **来源类型**：多选 checkbox（PDF/文本/URL/抖音/小红书），带颜色标识
- **关联强度**：滑块（0-1，0.01 步进），实时过滤边，显示当前阈值
- **实体类型**：多选 checkbox（人物/概念/组织/技术/地点/事件）
- **时间范围**：两个日期选择器（起始/截止）
- **重置按钮**：清除所有过滤

**过滤逻辑：**
1. 节点过滤：sourceType ∈ 选中类型 AND entities 中至少一个 type ∈ 选中实体类型 AND createdAt ∈ 日期范围
2. 边过滤：weight ≥ minWeight AND 两端节点都在过滤后节点集中
3. 过滤后重新 fitView

---

## 6. 文件清单

### 新建文件

| 文件 | 说明 |
|------|------|
| `apps/web/src/services/graph.service.ts` | 关联计算 + 图谱查询 |
| `apps/web/src/app/api/graph/route.ts` | GET /api/graph 端点 |
| `apps/web/src/app/(dashboard)/graph/page.tsx` | 图谱页面（替换占位页） |
| `apps/web/src/components/graph/KnowledgeGraph.tsx` | @xyflow/react 图谱主组件 |
| `apps/web/src/components/graph/GraphNode.tsx` | 自定义节点组件 |
| `apps/web/src/components/graph/GraphEdge.tsx` | 自定义边组件（带 tooltip） |
| `apps/web/src/components/graph/GraphControls.tsx` | 缩放/重置控制 + 过滤面板 |
| `apps/web/src/lib/graph/types.ts` | GraphNode/GraphEdge/GraphResponse 类型定义 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `apps/web/src/services/distill.service.ts` | 蒸馏完成后调用 `createConnections()` |
| `apps/web/package.json` | 添加 `@xyflow/react`、`d3-force` 依赖 |

---

## 7. 数据流

### 7.1 关联创建流

```
用户蒸馏新知识
  → processDistillTask()
    → AI 蒸馏 → 解析结果 → 更新 Knowledge
    → createTagsFromDistill()
    → createConnections(newKnowledgeId, userId)  ← 新增
      → 提取新知识 entities
      → 查询用户所有其他知识 entities
      → 计算共享实体 → upsert KnowledgeConnection
```

### 7.2 图谱渲染流

```
用户打开 /graph
  → React 组件 mount
  → fetch GET /api/graph?filters...
  → 返回 { nodes, edges, stats }
  → @xyflow/react 渲染
  → 用户调整过滤 → 重新 fetch → 重新渲染
```

---

## 8. 错误处理

| 场景 | 处理 |
|------|------|
| 知识无 entities | 不创建关联，正常返回 |
| 用户无知识 | 返回空 nodes/edges，前端显示空状态 |
| API 请求失败 | 前端显示错误状态 + 重试按钮 |
| 节点过多（> limit） | 按度中心性截断，显示提示"已显示关联最多的 N 条知识" |
| createConnections 失败 | 不影响蒸馏主流程（catch + log，蒸馏仍成功） |

---

## 9. 测试策略

### 单元测试
- `calculateRelationWeight()`：验证权重计算（完全包含=1，无共享=0，部分共享）
- `createConnections()`：模拟 2 条知识有共享实体，验证 KnowledgeConnection 被创建

### 集成测试
- 蒸馏一条新知识后，验证 KnowledgeConnection 表有记录
- `GET /api/graph` 返回正确的 nodes/edges 结构

### 手动测试
1. 上传 3-5 条有共享实体的知识（如都提到 "OpenAI"）
2. 打开 /graph 页面
3. 验证：节点显示、边连接、颜色正确
4. 验证：过滤功能（来源类型、强度阈值、实体类型、时间范围）
5. 验证：交互（点击跳转、悬停 tooltip、拖拽、缩放）

---

## 10. 依赖

| 包 | 版本 | 用途 |
|----|------|------|
| `@xyflow/react` | ^12 | 图谱可视化框架 |
| `d3-force` | ^3 | 力导向布局计算 |
| `@types/d3-force` | ^3 | d3-force 类型定义（dev 依赖） |

无其他新依赖，复用现有的 Prisma、NextAuth、Tailwind、shadcn/ui。

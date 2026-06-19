/**
 * KnowledgeGraph - 知识图谱主组件。
 *
 * 职责：
 * 1. 从 GET /api/graph 获取图谱数据（带过滤参数）
 * 2. 用 d3-force 计算力导向布局
 * 3. 用 @xyflow/react 渲染图谱（自定义节点 + 边）
 * 4. 提供缩放、重置、重新布局、过滤交互
 *
 * 数据流：
 *   filters 变化 → fetch /api/graph → 转换为 ReactFlow nodes/edges
 *   → d3-force 布局计算 → 更新节点位置 → ReactFlow 渲染
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { Loader2, AlertCircle, RefreshCw, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraphNode, type KnowledgeNodeData } from "./GraphNode";
import { GraphEdge, type KnowledgeEdgeData } from "./GraphEdge";
import {
  GraphControls,
  DEFAULT_FILTERS,
  type GraphFilterState,
} from "./GraphControls";
import type { GraphResponse } from "@/lib/graph/types";

/** d3-force 节点类型（带 x, y 坐标） */
interface ForceNode extends SimulationNodeDatum {
  id: string;
  data: KnowledgeNodeData;
}

/** d3-force 边类型（需满足 SimulationLinkDatum<ForceNode> 结构约束） */
interface ForceLink extends SimulationLinkDatum<ForceNode> {
  weight: number;
  sharedEntityNames: string[];
}

/** React Flow 节点类型 */
type FlowNode = Node<KnowledgeNodeData, "knowledge">;
/** React Flow 边类型 */
type FlowEdge = Edge<KnowledgeEdgeData>;

/** 节点类型注册 */
const nodeTypes = { knowledge: GraphNode };
/** 边类型注册 */
const edgeTypes = { knowledge: GraphEdge };

/** 加载状态 */
type LoadState = "loading" | "success" | "error";

/** KnowledgeGraph 属性 */
interface KnowledgeGraphProps {
  /** 初始过滤参数（可选） */
  initialFilters?: GraphFilterState;
}

/**
 * 知识图谱主组件（外层）。
 *
 * 使用 ReactFlowProvider 包裹，使内层组件可以安全调用 useReactFlow()。
 */
export function KnowledgeGraph({ initialFilters }: KnowledgeGraphProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphInner initialFilters={initialFilters} />
    </ReactFlowProvider>
  );
}

/**
 * 知识图谱内部组件（实际逻辑）。
 *
 * 必须在 ReactFlowProvider 内部使用，以调用 useReactFlow()。
 */
function KnowledgeGraphInner({ initialFilters }: KnowledgeGraphProps) {
  const [filters, setFilters] = useState<GraphFilterState>(
    initialFilters ?? DEFAULT_FILTERS
  );
  const [data, setData] = useState<GraphResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // React Flow 状态
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  // React Flow 实例（用于缩放/重置）
  const reactFlow = useReactFlow();

  // d3-force 仿真器引用
  const simulationRef = useRef<Simulation<ForceNode, ForceLink> | null>(null);
  // 布局版本号（变化时触发重新布局）
  const [layoutVersion, setLayoutVersion] = useState(0);

  /** 获取图谱数据 */
  const fetchGraph = useCallback(async () => {
    setLoadState("loading");
    setErrorMsg("");

    try {
      const params = new URLSearchParams();
      if (filters.sourceTypes.length > 0) {
        params.set("sourceTypes", filters.sourceTypes.join(","));
      }
      if (filters.entityTypes.length > 0) {
        params.set("entityTypes", filters.entityTypes.join(","));
      }
      if (filters.minWeight > 0) {
        params.set("minWeight", String(filters.minWeight));
      }
      if (filters.startDate) {
        params.set("startDate", filters.startDate);
      }
      if (filters.endDate) {
        params.set("endDate", filters.endDate);
      }

      const res = await fetch(`/api/graph?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "获取失败");
      }

      setData(json.data);
      setLoadState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "未知错误");
      setLoadState("error");
    }
  }, [filters]);

  /** filters 变化时重新获取 */
  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  /** 计算度中心性（每个节点的关联数） */
  const degreeMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!data) return map;
    for (const edge of data.edges) {
      map.set(edge.source, (map.get(edge.source) ?? 0) + 1);
      map.set(edge.target, (map.get(edge.target) ?? 0) + 1);
    }
    return map;
  }, [data]);

  /** 数据变化时，转换为 ReactFlow 节点/边并运行 d3-force 布局 */
  useEffect(() => {
    if (!data || data.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // 转换为 ReactFlow 节点
    const flowNodes: FlowNode[] = data.nodes.map((node) => ({
      id: node.id,
      type: "knowledge",
      position: { x: 0, y: 0 },
      data: {
        id: node.id,
        title: node.title,
        sourceType: node.sourceType,
        degree: degreeMap.get(node.id) ?? 0,
        createdAt: node.createdAt,
      },
    }));

    // 转换为 ReactFlow 边
    const flowEdges: FlowEdge[] = data.edges.map((edge, idx) => ({
      id: `e-${edge.source}-${edge.target}-${idx}`,
      source: edge.source,
      target: edge.target,
      type: "knowledge",
      data: {
        weight: edge.weight,
        sharedEntityNames: edge.sharedEntities.map((e) => e.name),
      },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);

    // 运行 d3-force 布局
    runForceLayout(flowNodes, flowEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, layoutVersion]);

  /**
   * 运行 d3-force 力导向布局。
   */
  const runForceLayout = (flowNodes: FlowNode[], flowEdges: FlowEdge[]) => {
    // 停止旧的仿真
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // 准备 d3-force 节点（初始随机位置）
    const forceNodes: ForceNode[] = flowNodes.map((n) => ({
      id: n.id,
      data: n.data,
      x: Math.random() * 800 - 400,
      y: Math.random() * 600 - 300,
    }));

    // 准备 d3-force 边
    const forceLinks: ForceLink[] = flowEdges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.data?.weight ?? 0.5,
      sharedEntityNames: e.data?.sharedEntityNames ?? [],
    }));

    // 创建仿真（使用带 LinkDatum 的重载，得到 Simulation<ForceNode, ForceLink>）
    const simulation = forceSimulation<ForceNode, ForceLink>(forceNodes)
      .force(
        "charge",
        forceManyBody<ForceNode>().strength(-300)
      )
      .force(
        "link",
        forceLink<ForceNode, ForceLink>()
          .id((d) => d.id)
          .links(forceLinks)
          .distance(80)
          .strength(0.1)
      )
      .force("center", forceCenter<ForceNode>(0, 0))
      .force("x", forceX<ForceNode>(0).strength(0.05))
      .force("y", forceY<ForceNode>(0).strength(0.05))
      .alphaDecay(0.05);

    simulationRef.current = simulation;

    // 每帧更新节点位置
    simulation.on("tick", () => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          const forceNode = forceNodes.find((fn) => fn.id === node.id);
          if (!forceNode) return node;
          return {
            ...node,
            position: {
              x: forceNode.x ?? 0,
              y: forceNode.y ?? 0,
            },
          };
        })
      );
    });

    // 仿真结束后 fitView
    simulation.on("end", () => {
      setTimeout(() => reactFlow.fitView({ padding: 0.2 }), 50);
    });
  };

  /** 重新布局 */
  const handleRelayout = () => {
    if (data && data.nodes.length > 0) {
      setLayoutVersion((v) => v + 1);
    }
  };

  /** 节点点击 → 跳转知识详情 */
  const handleNodeClick: NodeMouseHandler<FlowNode> = (_event, node) => {
    window.open(`/knowledge/${node.id}`, "_self");
  };

  /** 组件卸载时停止仿真 */
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, []);

  // 渲染
  if (loadState === "loading") {
    return (
      <div className="flex h-[600px] flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="mb-3 h-8 w-8 animate-spin" />
        <p className="text-sm">加载图谱中...</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <Card className="h-[600px]">
        <CardContent className="flex h-full flex-col items-center justify-center">
          <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
          <p className="mb-4 text-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" size="sm" onClick={fetchGraph}>
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loadState === "success" && (!data || data.nodes.length === 0)) {
    return (
      <Card className="h-[600px]">
        <CardContent className="flex h-full flex-col items-center justify-center">
          <Network className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="mb-1 text-lg font-medium">暂无图谱数据</p>
          <p className="text-sm text-muted-foreground">
            蒸馏更多知识后，图谱将自动建立关联
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-lg border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#ccc" gap={16} />
      </ReactFlow>

      {/* 控制面板 + 过滤面板 */}
      <GraphControls
        filters={filters}
        onFiltersChange={setFilters}
        onZoomIn={() => reactFlow.zoomIn()}
        onZoomOut={() => reactFlow.zoomOut()}
        onFitView={() => reactFlow.fitView({ padding: 0.2 })}
        onRelayout={handleRelayout}
      />

      {/* 统计信息（左下角） */}
      {data && (
        <div className="absolute bottom-4 left-4 rounded-md border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
          节点 {data.stats.filteredNodes}/{data.stats.totalNodes} ·
          关联 {data.stats.filteredEdges}/{data.stats.totalEdges}
          {data.stats.filteredNodes < data.stats.totalNodes && (
            <span className="ml-1 text-amber-600">
              （已按关联强度截断）
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 知识图谱几何图标组件。
 *
 * 使用 SVG 绘制简笔几何图形（非 emoji），代表不同来源类型。
 * 所有图标接受 size 和 color 属性，stroke 风格统一。
 */

/** 图标属性 */
interface IconProps {
  /** 图标尺寸（px） */
  size?: number;
  /** 描边颜色 */
  color?: string;
  /** 描边宽度 */
  strokeWidth?: number;
}

/** 默认属性 */
const DEFAULT_PROPS = {
  size: 20,
  color: "currentColor",
  strokeWidth: 2,
};

/** 方形图标（PDF） */
export function SquareIcon({
  size = DEFAULT_PROPS.size,
  color = DEFAULT_PROPS.color,
  strokeWidth = DEFAULT_PROPS.strokeWidth,
}: IconProps) {
  const half = size / 2;
  const r = half - strokeWidth / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x={-r}
        y={-r}
        width={r * 2}
        height={r * 2}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

/** 圆形图标（Text/Markdown） */
export function CircleIcon({
  size = DEFAULT_PROPS.size,
  color = DEFAULT_PROPS.color,
  strokeWidth = DEFAULT_PROPS.strokeWidth,
}: IconProps) {
  const half = size / 2;
  const r = half - strokeWidth / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx={0} cy={0} r={r} stroke={color} strokeWidth={strokeWidth} />
    </svg>
  );
}

/** 菱形图标（URL） */
export function DiamondIcon({
  size = DEFAULT_PROPS.size,
  color = DEFAULT_PROPS.color,
  strokeWidth = DEFAULT_PROPS.strokeWidth,
}: IconProps) {
  const half = size / 2;
  const r = half - strokeWidth / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 三角形图标（Douyin） */
export function TriangleIcon({
  size = DEFAULT_PROPS.size,
  color = DEFAULT_PROPS.color,
  strokeWidth = DEFAULT_PROPS.strokeWidth,
}: IconProps) {
  const half = size / 2;
  const r = half - strokeWidth / 2;
  // 等边三角形，顶点朝上
  const h = r * Math.sqrt(3) / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={`M 0 ${-r} L ${h} ${r / 2} L ${-h} ${r / 2} Z`}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 六边形图标（Xiaohongshu） */
export function HexagonIcon({
  size = DEFAULT_PROPS.size,
  color = DEFAULT_PROPS.color,
  strokeWidth = DEFAULT_PROPS.strokeWidth,
}: IconProps) {
  const half = size / 2;
  const r = half - strokeWidth / 2;
  // 正六边形，顶点朝左右
  const h = r * Math.sqrt(3) / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={`M ${-r} 0 L ${-h} ${-r / 2} L ${h} ${-r / 2} L ${r} 0 L ${h} ${r / 2} L ${-h} ${r / 2} Z`}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 来源类型 → 图标 + 颜色配置 */
export const SOURCE_VISUAL_CONFIG: Record<
  string,
  { Icon: typeof SquareIcon; color: string; label: string }
> = {
  pdf: { Icon: SquareIcon, color: "#3b82f6", label: "PDF" },
  text: { Icon: CircleIcon, color: "#8b5cf6", label: "文本" },
  markdown: { Icon: CircleIcon, color: "#8b5cf6", label: "Markdown" },
  url: { Icon: DiamondIcon, color: "#10b981", label: "网页" },
  douyin: { Icon: TriangleIcon, color: "#ec4899", label: "抖音" },
  xiaohongshu: { Icon: HexagonIcon, color: "#f59e0b", label: "小红书" },
};

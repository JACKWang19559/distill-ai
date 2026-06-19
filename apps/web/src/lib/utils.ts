import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind CSS 类名工具函数。
 *
 * 结合 clsx 和 tailwind-merge，解决类名冲突问题。
 *
 * @param inputs - 类名输入（字符串、对象、数组等）
 * @returns 合并后的类名字符串
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

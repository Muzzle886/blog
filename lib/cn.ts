/** 类名合并工具（避免为一个小函数引入 clsx 依赖） */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

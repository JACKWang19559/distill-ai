/**
 * chrome.storage 封装。
 *
 * 提供类型安全的存储读写，封装 Promise 化的 API。
 */

/** 存储的数据结构 */
export interface StorageData {
  /** API token（登录后获得） */
  token?: string;
  /** 用户信息 */
  user?: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  /** Web 端地址 */
  apiBaseUrl: string;
}

/** 默认 Web 端地址 */
const DEFAULT_API_BASE_URL = "http://localhost:3000";

/**
 * 读取存储数据。
 *
 * @param keys - 要读取的键名数组，不传则读取全部
 * @returns 存储数据对象
 */
export function getStorage(keys?: string[]): Promise<Partial<StorageData>> {
  return new Promise((resolve) => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(keys ?? null, (result) => {
        const data = result as Partial<StorageData>;
        // 确保有默认的 apiBaseUrl
        if (!data.apiBaseUrl) {
          data.apiBaseUrl = DEFAULT_API_BASE_URL;
        }
        resolve(data);
      });
    } else {
      resolve({ apiBaseUrl: DEFAULT_API_BASE_URL });
    }
  });
}

/**
 * 写入存储数据。
 *
 * @param data - 要写入的数据
 */
export function setStorage(data: Partial<StorageData>): Promise<void> {
  return new Promise((resolve) => {
    if (chrome?.storage?.local) {
      chrome.storage.local.set(data, () => resolve());
    } else {
      resolve();
    }
  });
}

/**
 * 删除指定存储键。
 *
 * @param keys - 要删除的键名数组
 */
export function removeStorage(keys: string[]): Promise<void> {
  return new Promise((resolve) => {
    if (chrome?.storage?.local) {
      chrome.storage.local.remove(keys, () => resolve());
    } else {
      resolve();
    }
  });
}

/**
 * 获取 API 基础地址。
 */
export async function getApiBaseUrl(): Promise<string> {
  const { apiBaseUrl } = await getStorage(["apiBaseUrl"]);
  return apiBaseUrl || DEFAULT_API_BASE_URL;
}

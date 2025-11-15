/**
 * 通用类型定义
 */

/**
 * 成功响应
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  success: false;
  error: {
    type: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: number;
  };
}

/**
 * API 响应
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 时间戳
 */
export type Timestamp = number;

/**
 * ID 类型
 */
export type ID = string | number;


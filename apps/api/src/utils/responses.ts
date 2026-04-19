import { Response } from 'express';

/**
 * Resposta de sucesso padronizada
 */
export function successResponse<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Resposta de erro padronizada
 */
export function errorResponse(
  res: Response,
  error: {
    code: string;
    message: string;
    details?: any;
  },
  statusCode = 500
): void {
  res.status(statusCode).json({
    success: false,
    error,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Validação de parâmetros de paginação
 */
export function validatePagination(page?: string, limit?: string) {
  const pageNum = Math.max(1, parseInt(page || '1') || 1);
  const limitNum = Math.min(100, parseInt(limit || '10') || 10);

  return {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
  };
}

/**
 * Tratador genérico de erros
 */
export function handleError(err: any, functionName: string): { code: string; message: string } {
  console.error(`[${functionName}] Error:`, err);

  if (err.code === 'PGRST116') {
    return {
      code: 'NOT_FOUND',
      message: 'Resource not found',
    };
  }

  if (err.code === '23505') {
    return {
      code: 'DUPLICATE',
      message: 'Duplicate entry',
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: err.message || 'An error occurred',
  };
}

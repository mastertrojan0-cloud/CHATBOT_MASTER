import { z, ZodSchema } from 'zod'
import { Request, Response, NextFunction } from 'express'

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: result.error.flatten().fieldErrors,
        },
      })
      return
    }
    req.body = result.data
    next()
  }
}

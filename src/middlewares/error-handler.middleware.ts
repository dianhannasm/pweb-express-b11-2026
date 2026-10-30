
import { Request, Response, NextFunction } from 'express';
import HttpError from './http-error';

const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(error);

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      status: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    status: false,
    message: 'Terjadi kesalahan pada server',
  });
};

export default errorHandler;

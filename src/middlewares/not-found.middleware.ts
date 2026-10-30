
import { Request, Response, NextFunction } from 'express';

const notFound = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(404).json({
    status: false,
    message: 'Endpoint tidak ditemukan',
  });
};

export default notFound;

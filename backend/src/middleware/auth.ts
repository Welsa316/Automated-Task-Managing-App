import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip auth for health check
  if (req.path === '/api/health') return next();

  const apiSecret = process.env.API_SECRET;
  if (!apiSecret || apiSecret === 'change_me_to_a_random_string') {
    console.warn('WARNING: API_SECRET not configured. Set it in your .env file.');
    return next(); // Allow in development
  }

  const authHeader = req.headers.authorization;
  const queryKey = req.query.key as string;
  const token = authHeader?.replace('Bearer ', '') || queryKey;

  if (token !== apiSecret) {
    return res.status(401).json({ error: 'Unauthorized. Invalid API key.' });
  }

  next();
}

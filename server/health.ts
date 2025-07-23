
import { Request, Response } from 'express';

export const healthCheck = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
};
import { Request, Response } from "express";

export function setupHealthCheck(app: any) {
  // Health check endpoint pour Render
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'gbairai-pwa'
    });
  });
  
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'healthy', 
      api: 'operational',
      timestamp: new Date().toISOString() 
    });
  });
}

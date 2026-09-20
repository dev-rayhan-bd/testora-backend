
import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import config from './config';
import { errorHandler, successHandler } from './config/morgan';

import compression from 'compression';
import { BadRequestError } from './app/errors/request/apiError';
import { globalErrorHandler } from './app/middlewares/globalHandle.error';
import notFound from './app/middlewares/notFound.route';
import { applyRateLimit } from './app/middlewares/rateLimit.config';
import routers from './app/routers';
import { compressionOptions } from './config/compression.config';
import { helmetConfig } from './config/helmet.config';
import rootDesign from './helpers/rootDesign';

const app: Application = express();

// app.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
// global middlewares

app.use(express.static(path.resolve('./src/public')));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.use(
  cors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:3002',
      'http://10.10.28.81:3000',
      'http://10.10.28.81:3001',
      'http://10.10.28.81:3002',
      'https://testora-dashboard.vercel.app',
      'https://testora-dashboards.vercel.app',
      'https://testora-frontend.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

if (config.node_env !== 'test') {
  app.use(successHandler);
  app.use(errorHandler);
}

app.use(compression(compressionOptions));
app.use(helmetConfig);
app.use(applyRateLimit());

// application middleware
app.use('/api', routers);

// send html design with a button 'click to see server health' and integrate an api to check server health
app.get('/', rootDesign);

app.get('/health_check', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    message: 'Welcome to the server. Server health is good.',
  });
});

//
app.get('/plan', (_req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Example error logging
app.get('/error', (req, _res, next) => {
  next(new BadRequestError('Testing error'));
});

// Error handling middlewares
app.use(globalErrorHandler);
app.use(notFound);

export default app;

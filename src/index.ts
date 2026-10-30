
import express from 'express';
import dotenv from 'dotenv';

import heroRoutes from './routes/hero.routes';
import skinRoutes from './routes/skin.routes';

import logger from './middlewares/logger.middleware';
import notFound from './middlewares/not-found.middleware';
import errorHandler from './middlewares/error-handler.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Logger Middleware
app.use(logger);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: true,
    message: 'Server berjalan dengan baik',
  });
});

// Halaman utama
app.get('/', (req, res) => {
  res.json({
    status: true,
    message: 'Backend Express MLBB Shop Berjalan!',
  });
});

// Hero API
app.use('/api/heroes', heroRoutes);

// Skin API
app.use('/api/skins', skinRoutes);

// Not Found Middleware
app.use(notFound);

// Error Handler Middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

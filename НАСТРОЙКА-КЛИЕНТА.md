const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Загружаем конфигурацию клиента
let clientConfig = {};
try {
  const configPath = path.join(__dirname, 'client-config.json');
  if (fs.existsSync(configPath)) {
    clientConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ Конфигурация клиента загружена:', clientConfig.client_info?.name || 'Неизвестный клиент');
  } else {
    console.log('⚠️  Файл client-config.json не найден, используются переменные окружения');
  }
} catch (error) {
  console.error('❌ Ошибка загрузки client-config.json:', error.message);
}

const certificateRoutes = require('./routes/certificates');
const templateRoutes = require('./routes/templates');
const adminRoutes = require('./routes/admin');
const { initDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Безопасность
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // максимум 100 запросов с одного IP
});
app.use(limiter);

// Парсинг JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use('/static', express.static(path.join(__dirname, 'public')));

// Маршруты API
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/admin', adminRoutes);

// Главная страница - простая документация API
app.get('/', (req, res) => {
  res.json({
    name: 'Certificate Generator API',
    version: '1.0.0',
    client: clientConfig.client_info?.name || 'Не настроен',
    description: clientConfig.client_info?.description || 'Система генерации сертификатов',
    endpoints: {
      'POST /api/v1/certificates': 'Создать сертификат',
      'GET /api/v1/certificates/:id': 'Получить сертификат',
      'POST /api/v1/templates': 'Загрузить шаблон',
      'GET /api/v1/templates': 'Список шаблонов',
      'GET /admin': 'Админ панель',
      'GET /api/v1/verify/:code': 'Проверить сертификат (публичный)'
    },
    documentation: 'Используйте API_KEY в заголовке Authorization: Bearer YOUR_API_KEY',
    tilda_webhook_url: `${process.env.BASE_URL}/api/v1/certificates`
  });
});

// Проверка работоспособности
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка:', err);
  res.status(500).json({ 
    error: 'Внутренняя ошибка сервера',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Что-то пошло не так'
  });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Запуск сервера
async function startServer() {
  try {
    // Инициализация базы данных
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
      console.log(`📊 Админ панель: http://localhost:${PORT}/admin`);
      console.log(`📖 API документация: http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

startServer();

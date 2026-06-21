// Middleware для проверки API ключа

function authenticateAPI(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Отсутствует заголовок Authorization' 
    });
  }

  const token = authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Отсутствует API ключ в заголовке Authorization' 
    });
  }

  // Проверяем API ключ из переменных окружения
  const validApiKey = process.env.API_KEY;
  
  if (!validApiKey) {
    console.error('API_KEY не настроен в переменных окружения');
    return res.status(500).json({ 
      error: 'Конфигурация сервера некорректна' 
    });
  }

  if (token !== validApiKey) {
    return res.status(403).json({ 
      error: 'Недействительный API ключ' 
    });
  }

  // API ключ валиден, продолжаем
  next();
}

// Простая проверка для админ панели (базовая аутентификация)
function authenticateAdmin(req, res, next) {
  const auth = req.headers.authorization;
  
  if (!auth) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.status(401).send('Требуется аутентификация');
  }

  const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  const username = credentials[0];
  const password = credentials[1];

  // Простые учетные данные для админки (в продакшене лучше использовать более безопасный способ)
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'password';

  if (username === adminUser && password === adminPass) {
    next();
  } else {
    res.set('WWW-Authenticate', 'Basic realm="Admin Panel"');
    res.status(401).send('Неверные учетные данные');
  }
}

module.exports = {
  authenticateAPI,
  authenticateAdmin
};

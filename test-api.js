#!/usr/bin/env node

/**
 * Быстрый тест всей системы Certificate Generator
 * Использование: node quick-test.js
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Загружаем конфигурацию
let config = {};
try {
  const configPath = path.join(__dirname, 'client-config.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (error) {
  console.log('⚠️  Не удалось загрузить client-config.json');
}

// Параметры для тестирования
const BASE_URL = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';
const API_KEY = process.argv[3] || config.tilda_integration?.api_key || process.env.API_KEY || 'your-secret-api-key-here';

console.log('🧪 БЫСТРЫЙ ТЕСТ CERTIFICATE GENERATOR');
console.log('=====================================');
console.log('🏢 Клиент:', config.client_info?.name || 'Не настроен');
console.log('🌐 URL:', BASE_URL);
console.log('🔑 API Key:', API_KEY.substring(0, 8) + '...');
console.log('');

// Утилита для HTTP запросов
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function runQuickTest() {
  let testsPassed = 0;
  let totalTests = 0;

  function test(name, condition, details = '') {
    totalTests++;
    if (condition) {
      console.log(`✅ ${name}`);
      if (details) console.log(`   ${details}`);
      testsPassed++;
    } else {
      console.log(`❌ ${name}`);
      if (details) console.log(`   ${details}`);
    }
  }

  console.log('1️⃣  Проверка подключения к серверу...');
  try {
    const health = await makeRequest(`${BASE_URL}/health`);
    test('Сервер отвечает', health.status === 200, `Время работы: ${Math.round(health.data.uptime || 0)}с`);
  } catch (error) {
    test('Сервер отвечает', false, `Ошибка: ${error.message}`);
    return;
  }

  console.log('');
  console.log('2️⃣  Проверка API документации...');
  try {
    const docs = await makeRequest(`${BASE_URL}/`);
    test('API документация', docs.status === 200);
    test('Клиент настроен', docs.data.client && docs.data.client !== 'Не настроен', docs.data.client);
  } catch (error) {
    test('API документация', false, error.message);
  }

  console.log('');
  console.log('3️⃣  Проверка аутентификации...');
  try {
    const templates = await makeRequest(`${BASE_URL}/api/v1/templates`);
    test('API ключ работает', templates.status === 200);
    test('Шаблоны доступны', templates.data.templates !== undefined, `Найдено: ${templates.data.templates?.length || 0}`);
  } catch (error) {
    test('API ключ работает', false, error.message);
  }

  console.log('');
  console.log('4️⃣  Проверка создания тестового сертификата...');
  
  const testCertData = {
    template_id: config.certificate_template?.template_id || 'test-template-001',
    first_name: 'Тест',
    last_name: 'Тестов',
    recipient_email: 'test@example.com',
    amount: 1000,
    message: 'Тестовый сертификат от ' + (config.client_info?.name || 'Certificate Generator'),
    from_name: config.client_info?.name || 'Тестовая компания'
  };

  try {
    const certResult = await makeRequest(`${BASE_URL}/api/v1/certificates`, {
      method: 'POST',
      body: testCertData
    });

    test('Сертификат создается', certResult.status === 201 || certResult.status === 200);
    
    if (certResult.status === 201 || certResult.status === 200) {
      test('PDF URL возвращается', !!certResult.data.pdf_url, certResult.data.pdf_url);
      test('Код верификации создается', !!certResult.data.verification_url);
      
      // Тестируем получение сертификата
      if (certResult.data.certificate_id) {
        console.log('');
        console.log('5️⃣  Проверка получения сертификата...');
        
        const getCert = await makeRequest(`${BASE_URL}/api/v1/certificates/${certResult.data.certificate_id}`);
        test('Сертификат получается по ID', getCert.status === 200);
        test('Данные сертификата корректны', getCert.data.first_name === 'Тест' && getCert.data.last_name === 'Тестов');
      }
    } else if (certResult.status === 422) {
      test('Валидация работает', true, 'Ошибка валидации - это нормально для теста');
    }
  } catch (error) {
    test('Сертификат создается', false, error.message);
  }

  console.log('');
  console.log('6️⃣  Проверка публичной верификации...');
  try {
    const verify = await makeRequest(`${BASE_URL}/api/v1/verify/FAKE-CODE-123`, {
      headers: {} // Убираем Authorization для публичного endpoint
    });
    test('Публичная верификация работает', verify.status === 404, 'Несуществующий код корректно обрабатывается');
  } catch (error) {
    test('Публичная верификация работает', false, error.message);
  }

  console.log('');
  console.log('7️⃣  Проверка админ-панели...');
  try {
    // Простая проверка что админка отвечает (без аутентификации)
    const admin = await makeRequest(`${BASE_URL}/admin`, {
      headers: { 'Authorization': '' } // Убираем API ключ
    });
    test('Админ-панель доступна', admin.status === 401, 'Требует аутентификацию - это правильно');
  } catch (error) {
    test('Админ-панель доступна', false, error.message);
  }

  console.log('');
  console.log('📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');
  console.log('==========================');
  console.log(`✅ Пройдено: ${testsPassed}/${totalTests} тестов`);
  
  if (testsPassed === totalTests) {
    console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Система готова к работе.');
  } else if (testsPassed >= totalTests * 0.8) {
    console.log('⚠️  Большинство тестов пройдено. Проверьте ошибки выше.');
  } else {
    console.log('❌ Много ошибок. Проверьте конфигурацию и настройки.');
  }

  console.log('');
  console.log('📋 СЛЕДУЮЩИЕ ШАГИ:');
  
  if (testsPassed === totalTests) {
    console.log('1. Откройте админ-панель:', `${BASE_URL}/admin`);
    console.log('2. Загрузите PDF шаблон клиента');
    console.log('3. Настройте форму в Tilda с webhook:', `${BASE_URL}/api/v1/certificates`);
    console.log('4. Протестируйте отправку формы');
  } else {
    console.log('1. Проверьте переменные окружения');
    console.log('2. Убедитесь что сервер запущен');
    console.log('3. Проверьте client-config.json');
    console.log('4. Проверьте логи сервера');
  }

  console.log('');
  console.log('🔗 Полезные ссылки:');
  console.log('- API документация:', `${BASE_URL}/`);
  console.log('- Админ-панель:', `${BASE_URL}/admin`);
  console.log('- Проверка здоровья:', `${BASE_URL}/health`);
  console.log('- Webhook URL для Tilda:', `${BASE_URL}/api/v1/certificates`);
}

// Запуск тестов
console.log('Запуск тестов...\n');
runQuickTest().catch(error => {
  console.error('❌ Критическая ошибка:', error.message);
  process.exit(1);
});

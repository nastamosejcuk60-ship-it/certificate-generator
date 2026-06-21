const express = require('express');
const path = require('path');
const { getDatabase } = require('../database/init');
const { authenticateAdmin } = require('../middleware/auth');
const { testEmailConnection } = require('../services/emailService');
const { testGoogleSheetsConnection } = require('../services/googleSheets');

const router = express.Router();

// Применяем аутентификацию ко всем маршрутам админки
router.use(authenticateAdmin);

// Главная страница админки
router.get('/', (req, res) => {
  res.send(generateAdminHTML());
});

// API для получения статистики
router.get('/api/stats', (req, res) => {
  const db = getDatabase();
  
  // Получаем статистику
  const queries = [
    new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM certificates", (err, result) => {
        if (err) reject(err);
        else resolve({ total_certificates: result.count });
      });
    }),
    new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM certificates WHERE status = 'sent'", (err, result) => {
        if (err) reject(err);
        else resolve({ sent_certificates: result.count });
      });
    }),
    new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM templates", (err, result) => {
        if (err) reject(err);
        else resolve({ total_templates: result.count });
      });
    }),
    new Promise((resolve, reject) => {
      db.get("SELECT SUM(amount) as total FROM certificates", (err, result) => {
        if (err) reject(err);
        else resolve({ total_amount: result.total || 0 });
      });
    })
  ];

  Promise.all(queries)
    .then(results => {
      const stats = Object.assign({}, ...results);
      res.json(stats);
      db.close();
    })
    .catch(err => {
      console.error('Ошибка получения статистики:', err);
      res.status(500).json({ error: 'Ошибка получения статистики' });
      db.close();
    });
});

// API для получения списка сертификатов
router.get('/api/certificates', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const db = getDatabase();
  
  db.all(
    `SELECT id, first_name, last_name, recipient_email, amount, 
     certificate_code, status, created_at, sent_at 
     FROM certificates 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    [limit, offset],
    (err, certificates) => {
      if (err) {
        console.error('Ошибка получения сертификатов:', err);
        return res.status(500).json({ error: 'Ошибка базы данных' });
      }

      // Получаем общее количество для пагинации
      db.get("SELECT COUNT(*) as total FROM certificates", (err, countResult) => {
        if (err) {
          console.error('Ошибка подсчета сертификатов:', err);
          return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        res.json({
          certificates: certificates,
          pagination: {
            page: page,
            limit: limit,
            total: countResult.total,
            pages: Math.ceil(countResult.total / limit)
          }
        });

        db.close();
      });
    }
  );
});

// API для получения списка шаблонов
router.get('/api/templates', (req, res) => {
  const db = getDatabase();
  
  db.all(
    "SELECT id, name, filename, created_at FROM templates ORDER BY created_at DESC",
    (err, templates) => {
      if (err) {
        console.error('Ошибка получения шаблонов:', err);
        return res.status(500).json({ error: 'Ошибка базы данных' });
      }

      res.json({ templates: templates });
      db.close();
    }
  );
});

// API для проверки подключений
router.get('/api/health-check', async (req, res) => {
  const results = {
    database: false,
    email: false,
    google_sheets: false
  };

  try {
    // Проверка БД
    const db = getDatabase();
    await new Promise((resolve, reject) => {
      db.get("SELECT 1", (err) => {
        if (err) reject(err);
        else resolve();
      });
      db.close();
    });
    results.database = true;
  } catch (e) {
    console.error('Database check failed:', e);
  }

  // Проверка email
  try {
    results.email = await testEmailConnection();
  } catch (e) {
    console.error('Email check failed:', e);
  }

  // Проверка Google Sheets
  try {
    results.google_sheets = await testGoogleSheetsConnection();
  } catch (e) {
    console.error('Google Sheets check failed:', e);
  }

  res.json(results);
});

// Генерация HTML для админки
function generateAdminHTML() {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate Generator - Админ панель</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #007bff;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
        .section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section h2 {
            margin-top: 0;
            color: #333;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .table th,
        .table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        .table th {
            background: #f8f9fa;
            font-weight: 600;
        }
        .status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        .status-issued { background: #d4edda; color: #155724; }
        .status-sent { background: #d1ecf1; color: #0c5460; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .health-check {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .health-item {
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
        }
        .health-ok { background: #d4edda; color: #155724; }
        .health-error { background: #f8d7da; color: #721c24; }
        .loading {
            color: #666;
            font-style: italic;
        }
        .btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            font-size: 14px;
        }
        .btn:hover {
            background: #0056b3;
        }
        .pagination {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 20px;
        }
        .pagination button {
            padding: 8px 12px;
            border: 1px solid #ddd;
            background: white;
            cursor: pointer;
            border-radius: 4px;
        }
        .pagination button:hover {
            background: #f8f9fa;
        }
        .pagination button.active {
            background: #007bff;
            color: white;
            border-color: #007bff;
        }
        .api-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #007bff;
            margin-top: 20px;
        }
        .api-info h3 {
            margin-top: 0;
        }
        .api-info code {
            background: #e9ecef;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎫 Certificate Generator</h1>
            <p>Панель управления системой генерации сертификатов</p>
        </div>

        <!-- Статистика -->
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number" id="total-certificates">-</div>
                <div class="stat-label">Всего сертификатов</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="sent-certificates">-</div>
                <div class="stat-label">Отправлено</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="total-templates">-</div>
                <div class="stat-label">Шаблонов</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="total-amount">-</div>
                <div class="stat-label">Сумма сертификатов</div>
            </div>
        </div>

        <!-- Проверка подключений -->
        <div class="section">
            <h2>🔧 Статус подключений</h2>
            <div class="health-check" id="health-check">
                <div class="loading">Проверка...</div>
            </div>
        </div>

        <!-- Последние сертификаты -->
        <div class="section">
            <h2>📋 Последние сертификаты</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Сумма</th>
                        <th>Код</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody id="certificates-table">
                    <tr><td colspan="6" class="loading">Загрузка...</td></tr>
                </tbody>
            </table>
            <div class="pagination" id="certificates-pagination"></div>
        </div>

        <!-- Шаблоны -->
        <div class="section">
            <h2>🎨 Шаблоны</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Название</th>
                        <th>Файл</th>
                        <th>Дата создания</th>
                    </tr>
                </thead>
                <tbody id="templates-table">
                    <tr><td colspan="3" class="loading">Загрузка...</td></tr>
                </tbody>
            </table>
        </div>

        <!-- API информация -->
        <div class="section">
            <h2>🔌 API информация</h2>
            <div class="api-info">
                <h3>Создание сертификата</h3>
                <p><strong>POST</strong> <code>/api/v1/certificates</code></p>
                <p><strong>Headers:</strong> <code>Authorization: Bearer YOUR_API_KEY</code></p>
                
                <h3>Проверка сертификата (публичный)</h3>
                <p><strong>GET</strong> <code>/api/v1/verify/{certificate_code}</code></p>
                
                <h3>Загрузка шаблона</h3>
                <p><strong>POST</strong> <code>/api/v1/templates</code></p>
                <p><strong>Headers:</strong> <code>Authorization: Bearer YOUR_API_KEY</code></p>
            </div>
        </div>
    </div>

    <script>
        let currentPage = 1;

        // Загрузка статистики
        async function loadStats() {
            try {
                const response = await fetch('/admin/api/stats');
                const stats = await response.json();
                
                document.getElementById('total-certificates').textContent = stats.total_certificates || 0;
                document.getElementById('sent-certificates').textContent = stats.sent_certificates || 0;
                document.getElementById('total-templates').textContent = stats.total_templates || 0;
                document.getElementById('total-amount').textContent = (stats.total_amount || 0) + ' руб.';
            } catch (error) {
                console.error('Ошибка загрузки статистики:', error);
            }
        }

        // Проверка подключений
        async function checkHealth() {
            try {
                const response = await fetch('/admin/api/health-check');
                const health = await response.json();
                
                const healthDiv = document.getElementById('health-check');
                healthDiv.innerHTML = '';
                
                Object.entries(health).forEach(([service, status]) => {
                    const div = document.createElement('div');
                    div.className = \`health-item \${status ? 'health-ok' : 'health-error'}\`;
                    div.textContent = \`\${service}: \${status ? '✅ OK' : '❌ Error'}\`;
                    healthDiv.appendChild(div);
                });
            } catch (error) {
                console.error('Ошибка проверки подключений:', error);
            }
        }

        // Загрузка сертификатов
        async function loadCertificates(page = 1) {
            try {
                const response = await fetch(\`/admin/api/certificates?page=\${page}&limit=10\`);
                const data = await response.json();
                
                const tbody = document.getElementById('certificates-table');
                tbody.innerHTML = '';
                
                if (data.certificates.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6">Сертификаты не найдены</td></tr>';
                    return;
                }
                
                data.certificates.forEach(cert => {
                    const row = document.createElement('tr');
                    row.innerHTML = \`
                        <td>\${new Date(cert.created_at).toLocaleDateString('ru-RU')}</td>
                        <td>\${cert.first_name} \${cert.last_name}</td>
                        <td>\${cert.recipient_email}</td>
                        <td>\${cert.amount} руб.</td>
                        <td><code>\${cert.certificate_code}</code></td>
                        <td><span class="status status-\${cert.status}">\${cert.status}</span></td>
                    \`;
                    tbody.appendChild(row);
                });
                
                // Пагинация
                updatePagination(data.pagination);
                
            } catch (error) {
                console.error('Ошибка загрузки сертификатов:', error);
            }
        }

        // Обновление пагинации
        function updatePagination(pagination) {
            const paginationDiv = document.getElementById('certificates-pagination');
            paginationDiv.innerHTML = '';
            
            if (pagination.pages <= 1) return;
            
            for (let i = 1; i <= pagination.pages; i++) {
                const button = document.createElement('button');
                button.textContent = i;
                button.className = i === pagination.page ? 'active' : '';
                button.onclick = () => {
                    currentPage = i;
                    loadCertificates(i);
                };
                paginationDiv.appendChild(button);
            }
        }

        // Загрузка шаблонов
        async function loadTemplates() {
            try {
                const response = await fetch('/admin/api/templates');
                const data = await response.json();
                
                const tbody = document.getElementById('templates-table');
                tbody.innerHTML = '';
                
                if (data.templates.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3">Шаблоны не найдены</td></tr>';
                    return;
                }
                
                data.templates.forEach(template => {
                    const row = document.createElement('tr');
                    row.innerHTML = \`
                        <td>\${template.name}</td>
                        <td>\${template.filename}</td>
                        <td>\${new Date(template.created_at).toLocaleDateString('ru-RU')}</td>
                    \`;
                    tbody.appendChild(row);
                });
                
            } catch (error) {
                console.error('Ошибка загрузки шаблонов:', error);
            }
        }

        // Инициализация
        document.addEventListener('DOMContentLoaded', function() {
            loadStats();
            checkHealth();
            loadCertificates();
            loadTemplates();
            
            // Обновление каждые 30 секунд
            setInterval(() => {
                loadStats();
                checkHealth();
            }, 30000);
        });
    </script>
</body>
</html>
  `;
}

module.exports = router;

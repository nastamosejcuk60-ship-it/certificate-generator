const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

// Создание подключения к базе данных
function createConnection() {
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Ошибка подключения к БД:', err.message);
    } else {
      console.log('✅ Подключение к SQLite установлено');
    }
  });
}

// Инициализация базы данных и таблиц
function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = createConnection();
    
    // Создание таблиц
    const createTables = `
      -- Таблица шаблонов
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        field_mapping TEXT, -- JSON с координатами полей
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Таблица сертификатов
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        recipient_email TEXT NOT NULL,
        amount REAL,
        issue_date TEXT,
        expires_at TEXT,
        message TEXT,
        from_name TEXT,
        certificate_code TEXT UNIQUE,
        pdf_path TEXT,
        status TEXT DEFAULT 'issued', -- issued, sent, failed, expired
        idempotency_key TEXT UNIQUE,
        metadata TEXT, -- JSON для дополнительных данных
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME,
        FOREIGN KEY (template_id) REFERENCES templates (id)
      );

      -- Таблица логов email
      CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        certificate_id TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        status TEXT, -- sent, delivered, failed, bounced
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (certificate_id) REFERENCES certificates (id)
      );

      -- Индексы для быстрого поиска
      CREATE INDEX IF NOT EXISTS idx_certificates_email ON certificates(recipient_email);
      CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(certificate_code);
      CREATE INDEX IF NOT EXISTS idx_certificates_created ON certificates(created_at);
      CREATE INDEX IF NOT EXISTS idx_email_logs_certificate ON email_logs(certificate_id);
    `;

    db.exec(createTables, (err) => {
      if (err) {
        console.error('Ошибка создания таблиц:', err.message);
        reject(err);
      } else {
        console.log('✅ Таблицы БД созданы/обновлены');
        
        // Вставка тестового шаблона если таблица пустая
        db.get("SELECT COUNT(*) as count FROM templates", (err, row) => {
          if (!err && row.count === 0) {
            const testTemplate = {
              id: 'test-template-001',
              name: 'Тестовый шаблон сертификата',
              filename: 'test-template.pdf',
              file_path: './templates/test-template.pdf',
              field_mapping: JSON.stringify({
                first_name: { x: 300, y: 400, fontSize: 24, color: '#000000' },
                last_name: { x: 500, y: 400, fontSize: 24, color: '#000000' },
                amount: { x: 400, y: 300, fontSize: 20, color: '#ff0000' },
                issue_date: { x: 400, y: 200, fontSize: 16, color: '#666666' }
              })
            };
            
            db.run(
              "INSERT INTO templates (id, name, filename, file_path, field_mapping) VALUES (?, ?, ?, ?, ?)",
              [testTemplate.id, testTemplate.name, testTemplate.filename, testTemplate.file_path, testTemplate.field_mapping],
              (err) => {
                if (!err) {
                  console.log('✅ Тестовый шаблон добавлен');
                }
              }
            );
          }
        });
        
        resolve();
      }
      db.close();
    });
  });
}

// Получение подключения к БД для использования в других модулях
function getDatabase() {
  return createConnection();
}

module.exports = {
  initDatabase,
  getDatabase
};

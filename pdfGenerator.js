const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/init');
const { authenticateAPI } = require('../middleware/auth');

const router = express.Router();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'templates');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только PDF, PNG и JPEG файлы'));
    }
  }
});

// GET /api/v1/templates - Получить список шаблонов
router.get('/', authenticateAPI, (req, res) => {
  const db = getDatabase();
  
  db.all("SELECT id, name, filename, created_at FROM templates ORDER BY created_at DESC", (err, templates) => {
    if (err) {
      console.error('Ошибка получения шаблонов:', err);
      return res.status(500).json({ error: 'Ошибка базы данных' });
    }

    res.json({
      templates: templates,
      count: templates.length
    });

    db.close();
  });
});

// GET /api/v1/templates/:id - Получить конкретный шаблон
router.get('/:id', authenticateAPI, (req, res) => {
  const templateId = req.params.id;
  const db = getDatabase();

  db.get("SELECT * FROM templates WHERE id = ?", [templateId], (err, template) => {
    if (err) {
      console.error('Ошибка получения шаблона:', err);
      return res.status(500).json({ error: 'Ошибка базы данных' });
    }

    if (!template) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }

    // Парсим field_mapping из JSON
    let fieldMapping = {};
    if (template.field_mapping) {
      try {
        fieldMapping = JSON.parse(template.field_mapping);
      } catch (e) {
        console.error('Ошибка парсинга field_mapping:', e);
      }
    }

    res.json({
      id: template.id,
      name: template.name,
      filename: template.filename,
      field_mapping: fieldMapping,
      created_at: template.created_at,
      updated_at: template.updated_at
    });

    db.close();
  });
});

// POST /api/v1/templates - Загрузить новый шаблон
router.post('/', authenticateAPI, upload.single('template'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл шаблона обязателен' });
  }

  const { name, field_mapping } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Название шаблона обязательно' });
  }

  // Валидация field_mapping если передан
  let parsedFieldMapping = {};
  if (field_mapping) {
    try {
      parsedFieldMapping = JSON.parse(field_mapping);
    } catch (e) {
      return res.status(400).json({ error: 'Некорректный формат field_mapping (должен быть JSON)' });
    }
  }

  const templateId = uuidv4();
  const db = getDatabase();

  db.run(
    "INSERT INTO templates (id, name, filename, file_path, field_mapping) VALUES (?, ?, ?, ?, ?)",
    [
      templateId,
      name,
      req.file.originalname,
      req.file.path,
      JSON.stringify(parsedFieldMapping)
    ],
    function(err) {
      if (err) {
        console.error('Ошибка сохранения шаблона:', err);
        // Удаляем загруженный файл в случае ошибки
        fs.unlink(req.file.path, () => {});
        return res.status(500).json({ error: 'Ошибка сохранения шаблона' });
      }

      res.status(201).json({
        id: templateId,
        name: name,
        filename: req.file.originalname,
        field_mapping: parsedFieldMapping,
        message: 'Шаблон успешно загружен'
      });

      db.close();
    }
  );
});

// PUT /api/v1/templates/:id/mapping - Обновить mapping полей шаблона
router.put('/:id/mapping', authenticateAPI, (req, res) => {
  const templateId = req.params.id;
  const { field_mapping } = req.body;

  if (!field_mapping) {
    return res.status(400).json({ error: 'field_mapping обязателен' });
  }

  // Валидация JSON
  let parsedFieldMapping;
  try {
    parsedFieldMapping = JSON.parse(JSON.stringify(field_mapping));
  } catch (e) {
    return res.status(400).json({ error: 'Некорректный формат field_mapping' });
  }

  const db = getDatabase();

  // Проверяем существование шаблона
  db.get("SELECT id FROM templates WHERE id = ?", [templateId], (err, template) => {
    if (err) {
      console.error('Ошибка проверки шаблона:', err);
      return res.status(500).json({ error: 'Ошибка базы данных' });
    }

    if (!template) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }

    // Обновляем mapping
    db.run(
      "UPDATE templates SET field_mapping = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [JSON.stringify(parsedFieldMapping), templateId],
      function(err) {
        if (err) {
          console.error('Ошибка обновления mapping:', err);
          return res.status(500).json({ error: 'Ошибка обновления' });
        }

        res.json({
          id: templateId,
          field_mapping: parsedFieldMapping,
          message: 'Mapping полей обновлен'
        });

        db.close();
      }
    );
  });
});

// DELETE /api/v1/templates/:id - Удалить шаблон
router.delete('/:id', authenticateAPI, (req, res) => {
  const templateId = req.params.id;
  const db = getDatabase();

  // Получаем информацию о шаблоне для удаления файла
  db.get("SELECT file_path FROM templates WHERE id = ?", [templateId], (err, template) => {
    if (err) {
      console.error('Ошибка получения шаблона:', err);
      return res.status(500).json({ error: 'Ошибка базы данных' });
    }

    if (!template) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }

    // Проверяем, не используется ли шаблон в сертификатах
    db.get("SELECT COUNT(*) as count FROM certificates WHERE template_id = ?", [templateId], (err, result) => {
      if (err) {
        console.error('Ошибка проверки использования:', err);
        return res.status(500).json({ error: 'Ошибка базы данных' });
      }

      if (result.count > 0) {
        return res.status(400).json({ 
          error: 'Нельзя удалить шаблон, который используется в сертификатах',
          certificates_count: result.count
        });
      }

      // Удаляем шаблон из БД
      db.run("DELETE FROM templates WHERE id = ?", [templateId], function(err) {
        if (err) {
          console.error('Ошибка удаления шаблона:', err);
          return res.status(500).json({ error: 'Ошибка удаления' });
        }

        // Удаляем файл
        if (fs.existsSync(template.file_path)) {
          fs.unlink(template.file_path, (err) => {
            if (err) console.error('Ошибка удаления файла:', err);
          });
        }

        res.json({ message: 'Шаблон успешно удален' });
        db.close();
      });
    });
  });
});

module.exports = router;

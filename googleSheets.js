const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/init');
const { generatePDF } = require('../services/pdfGenerator');
const { sendEmail } = require('../services/emailService');
const { logToGoogleSheets } = require('../services/googleSheets');
const { authenticateAPI } = require('../middleware/auth');

const router = express.Router();

// Схема валидации для создания сертификата
const certificateSchema = Joi.object({
  template_id: Joi.string().required(),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  recipient_email: Joi.string().email().required(),
  amount: Joi.number().positive().required(),
  issue_date: Joi.string().optional(),
  expires_at: Joi.string().optional(),
  message: Joi.string().max(500).optional(),
  from_name: Joi.string().max(100).optional(),
  idempotency_key: Joi.string().optional(),
  metadata: Joi.object().optional()
});

// POST /api/v1/certificates - Создание сертификата
router.post('/', authenticateAPI, async (req, res) => {
  try {
    // Валидация данных
    const { error, value } = certificateSchema.validate(req.body);
    if (error) {
      return res.status(422).json({
        error: 'Ошибка валидации',
        details: error.details.map(d => d.message)
      });
    }

    const data = value;
    const db = getDatabase();
    
    // Генерируем ID и ключ идемпотентности если не переданы
    const certificateId = uuidv4();
    const idempotencyKey = data.idempotency_key || uuidv4();
    
    // Проверяем идемпотентность
    db.get(
      "SELECT * FROM certificates WHERE idempotency_key = ?",
      [idempotencyKey],
      async (err, existingCert) => {
        if (err) {
          console.error('Ошибка проверки идемпотентности:', err);
          return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        // Если сертификат уже существует, возвращаем его
        if (existingCert) {
          return res.status(200).json({
            certificate_id: existingCert.id,
            pdf_url: `${process.env.BASE_URL}/static/certificates/${existingCert.id}.pdf`,
            status: existingCert.status,
            message: 'Сертификат уже создан (идемпотентность)'
          });
        }

        try {
          // Проверяем существование шаблона
          db.get(
            "SELECT * FROM templates WHERE id = ?",
            [data.template_id],
            async (err, template) => {
              if (err) {
                console.error('Ошибка получения шаблона:', err);
                return res.status(500).json({ error: 'Ошибка базы данных' });
              }

              if (!template) {
                return res.status(422).json({ 
                  error: 'Шаблон не найден',
                  template_id: data.template_id
                });
              }

              try {
                // Генерируем уникальный код сертификата
                const certificateCode = `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                
                // Устанавливаем даты по умолчанию
                const issueDate = data.issue_date || new Date().toISOString().split('T')[0];
                const expiresAt = data.expires_at || new Date(Date.now() + (parseInt(process.env.CERTIFICATE_EXPIRY_DAYS) || 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                // Подготавливаем данные для PDF
                const pdfData = {
                  ...data,
                  certificate_id: certificateId,
                  certificate_code: certificateCode,
                  issue_date: issueDate,
                  expires_at: expiresAt
                };

                // Генерируем PDF
                const pdfPath = await generatePDF(template, pdfData);

                // Сохраняем сертификат в БД
                db.run(
                  `INSERT INTO certificates (
                    id, template_id, first_name, last_name, recipient_email, 
                    amount, issue_date, expires_at, message, from_name, 
                    certificate_code, pdf_path, idempotency_key, metadata
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    certificateId, data.template_id, data.first_name, data.last_name,
                    data.recipient_email, data.amount, issueDate, expiresAt,
                    data.message, data.from_name, certificateCode, pdfPath,
                    idempotencyKey, JSON.stringify(data.metadata || {})
                  ],
                  async function(err) {
                    if (err) {
                      console.error('Ошибка сохранения сертификата:', err);
                      return res.status(500).json({ error: 'Ошибка сохранения' });
                    }

                    // Отправляем email асинхронно
                    sendEmail(pdfData, pdfPath).catch(emailErr => {
                      console.error('Ошибка отправки email:', emailErr);
                      // Логируем ошибку в БД
                      db.run(
                        "INSERT INTO email_logs (certificate_id, recipient_email, status, error_message) VALUES (?, ?, ?, ?)",
                        [certificateId, data.recipient_email, 'failed', emailErr.message]
                      );
                    });

                    // Логируем в Google Sheets асинхронно
                    logToGoogleSheets(pdfData).catch(sheetsErr => {
                      console.error('Ошибка записи в Google Sheets:', sheetsErr);
                    });

                    // Возвращаем результат
                    res.status(201).json({
                      certificate_id: certificateId,
                      pdf_url: `${process.env.BASE_URL}/static/certificates/${certificateId}.pdf`,
                      verification_url: `${process.env.BASE_URL}/api/v1/verify/${certificateCode}`,
                      status: 'issued'
                    });
                  }
                );

              } catch (pdfError) {
                console.error('Ошибка генерации PDF:', pdfError);
                res.status(500).json({ 
                  error: 'Ошибка генерации PDF',
                  message: pdfError.message
                });
              }
            }
          );

        } catch (error) {
          console.error('Общая ошибка:', error);
          res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        } finally {
          db.close();
        }
      }
    );

  } catch (error) {
    console.error('Ошибка создания сертификата:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/v1/certificates/:id - Получение сертификата
router.get('/:id', authenticateAPI, (req, res) => {
  const certificateId = req.params.id;
  const db = getDatabase();

  db.get(
    "SELECT * FROM certificates WHERE id = ?",
    [certificateId],
    (err, certificate) => {
      if (err) {
        console.error('Ошибка получения сертификата:', err);
        return res.status(500).json({ error: 'Ошибка базы данных' });
      }

      if (!certificate) {
        return res.status(404).json({ error: 'Сертификат не найден' });
      }

      res.json({
        certificate_id: certificate.id,
        template_id: certificate.template_id,
        first_name: certificate.first_name,
        last_name: certificate.last_name,
        recipient_email: certificate.recipient_email,
        amount: certificate.amount,
        issue_date: certificate.issue_date,
        expires_at: certificate.expires_at,
        certificate_code: certificate.certificate_code,
        status: certificate.status,
        pdf_url: `${process.env.BASE_URL}/static/certificates/${certificate.id}.pdf`,
        verification_url: `${process.env.BASE_URL}/api/v1/verify/${certificate.certificate_code}`,
        created_at: certificate.created_at
      });

      db.close();
    }
  );
});

// GET /api/v1/verify/:code - Публичная проверка сертификата
router.get('/verify/:code', (req, res) => {
  const code = req.params.code;
  const db = getDatabase();

  db.get(
    "SELECT id, first_name, last_name, amount, issue_date, expires_at, status FROM certificates WHERE certificate_code = ?",
    [code],
    (err, certificate) => {
      if (err) {
        console.error('Ошибка проверки сертификата:', err);
        return res.status(500).json({ error: 'Ошибка проверки' });
      }

      if (!certificate) {
        return res.status(404).json({ 
          valid: false,
          message: 'Сертификат не найден' 
        });
      }

      const now = new Date();
      const expiresAt = new Date(certificate.expires_at);
      const isExpired = now > expiresAt;
      const isValid = certificate.status === 'issued' && !isExpired;

      res.json({
        valid: isValid,
        certificate: {
          id: certificate.id,
          holder: `${certificate.first_name} ${certificate.last_name}`,
          amount: certificate.amount,
          issue_date: certificate.issue_date,
          expires_at: certificate.expires_at,
          status: certificate.status,
          expired: isExpired
        }
      });

      db.close();
    }
  );
});

module.exports = router;

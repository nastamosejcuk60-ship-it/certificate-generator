const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../database/init');

/**
 * Создает транспорт для отправки email
 */
function createTransporter() {
  // Используем Gmail SMTP для простоты
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // App Password для Gmail
    }
  });
}

/**
 * Отправляет email с сертификатом
 * @param {Object} certificateData - Данные сертификата
 * @param {string} pdfPath - Путь к PDF файлу
 */
async function sendEmail(certificateData, pdfPath) {
  try {
    console.log('Отправка email для сертификата:', certificateData.certificate_id);

    // Проверяем настройки email
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('Email настройки не сконфигурированы');
    }

    // Проверяем существование PDF файла
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF файл не найден: ${pdfPath}`);
    }

    const transporter = createTransporter();
    
    // Формируем текст письма
    const emailText = generateEmailText(certificateData);
    const emailHtml = generateEmailHtml(certificateData);

    // Настройки письма
    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || 'Certificate Generator',
        address: process.env.EMAIL_USER
      },
      to: certificateData.recipient_email,
      subject: `Ваш подарочный сертификат на ${certificateData.amount} руб.`,
      text: emailText,
      html: emailHtml,
      attachments: [
        {
          filename: `certificate-${certificateData.certificate_code}.pdf`,
          path: pdfPath,
          contentType: 'application/pdf'
        }
      ]
    };

    // Отправляем email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email отправлен:', info.messageId);

    // Логируем успешную отправку в БД
    const db = getDatabase();
    db.run(
      "INSERT INTO email_logs (certificate_id, recipient_email, status) VALUES (?, ?, ?)",
      [certificateData.certificate_id, certificateData.recipient_email, 'sent'],
      (err) => {
        if (err) console.error('Ошибка логирования email:', err);
        db.close();
      }
    );

    // Обновляем статус сертификата
    const dbUpdate = getDatabase();
    dbUpdate.run(
      "UPDATE certificates SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = ?",
      [certificateData.certificate_id],
      (err) => {
        if (err) console.error('Ошибка обновления статуса сертификата:', err);
        dbUpdate.close();
      }
    );

    return info;

  } catch (error) {
    console.error('Ошибка отправки email:', error);
    
    // Логируем ошибку в БД
    const db = getDatabase();
    db.run(
      "INSERT INTO email_logs (certificate_id, recipient_email, status, error_message) VALUES (?, ?, ?, ?)",
      [certificateData.certificate_id, certificateData.recipient_email, 'failed', error.message],
      (err) => {
        if (err) console.error('Ошибка логирования ошибки email:', err);
        db.close();
      }
    );

    throw error;
  }
}

/**
 * Генерирует текстовую версию письма
 */
function generateEmailText(data) {
  return `
Здравствуйте, ${data.first_name} ${data.last_name}!

Поздравляем! Вы получили подарочный сертификат на сумму ${data.amount} руб.

${data.message ? `Сообщение: ${data.message}` : ''}

Детали сертификата:
- Номер: ${data.certificate_code}
- Дата выдачи: ${formatDate(data.issue_date)}
- Действителен до: ${formatDate(data.expires_at)}

${data.from_name ? `От: ${data.from_name}` : ''}

PDF сертификат прикреплен к этому письму.

Для проверки подлинности сертификата перейдите по ссылке:
${process.env.BASE_URL}/api/v1/verify/${data.certificate_code}

С уважением,
${process.env.EMAIL_FROM_NAME || 'Certificate Generator'}
  `.trim();
}

/**
 * Генерирует HTML версию письма
 */
function generateEmailHtml(data) {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ваш подарочный сертификат</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
        .certificate-info { background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .amount { font-size: 24px; font-weight: bold; color: #007bff; }
        .code { font-family: monospace; background: #f1f1f1; padding: 5px 10px; border-radius: 4px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
        .verify-link { display: inline-block; background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 Поздравляем!</h1>
        <p>Вы получили подарочный сертификат</p>
    </div>

    <p>Здравствуйте, <strong>${data.first_name} ${data.last_name}</strong>!</p>

    <div class="certificate-info">
        <p>Сумма сертификата: <span class="amount">${data.amount} руб.</span></p>
        ${data.message ? `<p><strong>Сообщение:</strong> ${data.message}</p>` : ''}
    </div>

    <h3>Детали сертификата:</h3>
    <ul>
        <li><strong>Номер:</strong> <span class="code">${data.certificate_code}</span></li>
        <li><strong>Дата выдачи:</strong> ${formatDate(data.issue_date)}</li>
        <li><strong>Действителен до:</strong> ${formatDate(data.expires_at)}</li>
        ${data.from_name ? `<li><strong>От:</strong> ${data.from_name}</li>` : ''}
    </ul>

    <p>PDF сертификат прикреплен к этому письму.</p>

    <p>
        <a href="${process.env.BASE_URL}/api/v1/verify/${data.certificate_code}" class="verify-link">
            Проверить подлинность сертификата
        </a>
    </p>

    <div class="footer">
        <p>С уважением,<br>
        ${process.env.EMAIL_FROM_NAME || 'Certificate Generator'}</p>
    </div>
</body>
</html>
  `.trim();
}

/**
 * Форматирует дату для отображения
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Проверяет настройки email
 */
async function testEmailConnection() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email настройки корректны');
    return true;
  } catch (error) {
    console.error('❌ Ошибка настроек email:', error.message);
    return false;
  }
}

module.exports = {
  sendEmail,
  testEmailConnection
};

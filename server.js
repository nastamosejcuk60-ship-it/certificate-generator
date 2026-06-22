const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const https = require('https');
const nodemailer = require('nodemailer');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Проверка работы сервера
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Сервер работает!' });
});

// Генерация сертификата
app.post('/api/v1/certificates', async (req, res) => {
    console.log('Получен запрос на сертификат:', req.body);
    
    const { first_name, last_name, recipient_email } = req.body;
    
    if (!first_name || !last_name || !recipient_email) {
        console.log('Ошибка: не все поля заполнены');
        return res.status(400).json({ 
            error: 'Пожалуйста, заполните все поля: имя, фамилия, email' 
        });
    }

    try {
        // Скачиваем картинку-шаблон с твоим сертификатом
        const imageUrl = 'https://i.ibb.co/0fP0v1R/Screenshot-2025-01-17-234027.jpg';
        const imageBuffer = await downloadImage(imageUrl);
        
        // Создаём PDF с картинкой
        const doc = new PDFDocument({ autoFirstPage: false });
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);
            
            // Отправляем письмо через SMTP (Brevo или другой)
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_EMAIL,
                    pass: process.env.SMTP_PASSWORD
                }
            });

            const mailOptions = {
                from: process.env.SMTP_EMAIL,
                to: recipient_email,
                subject: 'Ваш сертификат "Хранитель истории"',
                text: `Уважаемый(ая) ${first_name} ${last_name}! Поздравляем с прохождением игры и получением сертификата.`,
                attachments: [{
                    filename: 'certificate.pdf',
                    content: pdfData
                }]
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Ошибка отправки письма:', error);
                    return res.status(500).json({ error: 'Ошибка отправки письма' });
                }
                console.log('Письмо отправлено на', recipient_email);
                res.json({ 
                    status: 'success', 
                    message: 'Сертификат отправлен на почту',
                    data: { first_name, last_name, recipient_email }
                });
            });
        });

        // Вставляем картинку в PDF
        doc.addPage({ size: [800, 600] });
        doc.image(imageBuffer, 0, 0, { width: 800, height: 600 });
        
        // Накладываем имя поверх картинки (позиция 200, 300 — подбери под свой макет)
        doc.fontSize(28)
           .fillColor('#000000')
           .text(`${first_name} ${last_name}`, 200, 300, { 
               align: 'center',
               width: 400
           });
        
        doc.end();

    } catch (error) {
        console.log('Ошибка генерации:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Функция для скачивания картинки
function downloadImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
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
        // Создаём PDF
        const doc = new PDFDocument();
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);
            
            // Отправляем письмо
            const transporter = nodemailer.createTransport({
                service: 'gmail',
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

        // Заполняем PDF
        doc.fontSize(24).text('Сертификат "Хранитель истории"', { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).text(`Настоящий сертификат подтверждает, что`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(28).text(`${first_name} ${last_name}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).text(`прошёл(а) исследование истории своей семьи и стал(а) Хранителем памяти своего рода.`, { align: 'center' });
        doc.end();

    } catch (error) {
        console.log('Ошибка генерации:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});

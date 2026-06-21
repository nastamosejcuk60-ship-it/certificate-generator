const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Сервер работает!' });
});

app.post('/api/v1/certificates', async (req, res) => {
    console.log('Получен запрос на сертификат:', req.body);
    
    const { first_name, last_name, recipient_email } = req.body;
    
    if (!first_name || !last_name || !recipient_email) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }

    try {
        // Генерируем PDF
        const doc = new PDFDocument();
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', async () => {
            const pdfData = Buffer.concat(buffers);
            const base64PDF = pdfData.toString('base64');

            // Отправляем через Resend API
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: 'onboarding@resend.dev', // временный адрес Resend
                    to: [recipient_email],
                    subject: 'Ваш сертификат "Хранитель истории"',
                    text: `Уважаемый(ая) ${first_name} ${last_name}! Поздравляем с прохождением игры.`,
                    attachments: [{
                        filename: 'certificate.pdf',
                        content: base64PDF
                    }]
                })
            });

            if (response.ok) {
                console.log('Письмо отправлено на', recipient_email);
                res.json({ status: 'success', message: 'Сертификат отправлен на почту' });
            } else {
                const error = await response.text();
                console.log('Ошибка Resend:', error);
                res.status(500).json({ error: 'Ошибка отправки письма' });
            }
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
        console.log('Ошибка:', error);
        res.status(500).json({ error: 'Внутренняя ошибка' });
    }
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});

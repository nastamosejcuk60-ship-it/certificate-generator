const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Проверка работы сервера
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Сервер работает!' });
});

// Генерация сертификата
app.post('/api/v1/certificates', (req, res) => {
    console.log('Получен запрос на сертификат:', req.body);
    
    const { first_name, last_name, recipient_email } = req.body;
    
    if (!first_name || !last_name || !recipient_email) {
        console.log('Ошибка: не все поля заполнены');
        return res.status(400).json({ 
            error: 'Пожалуйста, заполните все поля: имя, фамилия, email' 
        });
    }

    // Имитация отправки сертификата (пока без реальной генерации PDF)
    console.log(`Генерация сертификата для: ${first_name} ${last_name} (${recipient_email})`);
    
    res.json({ 
        status: 'success', 
        message: 'Сертификат успешно сгенерирован',
        data: { first_name, last_name, recipient_email }
    });
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});

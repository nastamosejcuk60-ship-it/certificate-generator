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
  const { first_name, last_name, recipient_email } = req.body;
  
  if (!first_name || !last_name || !recipient_email) {
    return res.status(400).json({ 
      error: 'Пожалуйста, заполните все поля: имя, фамилия, email' 
    });
  }

  // Здесь будет генерация PDF и отправка письма
  res.json({ 
    status: 'success', 
    message: 'Сертификат отправлен на почту',
    data: { first_name, last_name, recipient_email }
  });
});

app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});

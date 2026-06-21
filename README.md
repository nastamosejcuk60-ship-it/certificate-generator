# 🚀 Инструкция по деплою Certificate Generator

## Вариант 1: Railway (Рекомендуется - самый простой)

### Преимущества:
- Автоматический деплой из GitHub
- Бесплатный план на старт
- Простая настройка переменных окружения
- Автоматические SSL сертификаты

### Шаги:

1. **Подготовка кода**
   ```bash
   # Убедитесь что код загружен на GitHub
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Регистрация на Railway**
   - Зайдите на [railway.app](https://railway.app)
   - Войдите через GitHub

3. **Создание проекта**
   - Нажмите "New Project"
   - Выберите "Deploy from GitHub repo"
   - Выберите ваш репозиторий certificate-generator

4. **Настройка переменных окружения**
   В разделе Variables добавьте:
   ```
   NODE_ENV=production
   API_KEY=your-super-secret-api-key-here
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_PASS=your-gmail-app-password
   EMAIL_FROM_NAME=Ваша компания
   BASE_URL=https://your-app.railway.app
   ```

   Опционально (для Google Sheets):
   ```
   GOOGLE_SHEETS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n
   GOOGLE_SHEETS_CLIENT_EMAIL=service@project.iam.gserviceaccount.com
   GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id
   ```

5. **Деплой**
   - Railway автоматически задеплоит приложение
   - Получите URL вашего приложения
   - Обновите `BASE_URL` в переменных окружения

## Вариант 2: Render

### Шаги:

1. **Регистрация**
   - Зайдите на [render.com](https://render.com)
   - Подключите GitHub

2. **Создание Web Service**
   - New → Web Service
   - Connect Repository
   - Настройки:
     - Build Command: `npm install`
     - Start Command: `npm start`
     - Node Version: 18

3. **Переменные окружения**
   Добавьте те же переменные что и для Railway

## Вариант 3: VPS (Ubuntu/CentOS)

### Для продвинутых пользователей

```bash
# 1. Подключитесь к серверу
ssh user@your-server-ip

# 2. Установите Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Установите PM2
sudo npm install -g pm2

# 4. Клонируйте проект
git clone https://github.com/yourusername/certificate-generator.git
cd certificate-generator

# 5. Установите зависимости
npm install

# 6. Настройте .env
nano .env
# Добавьте все необходимые переменные

# 7. Запустите приложение
pm2 start server.js --name certificate-generator
pm2 startup
pm2 save

# 8. Настройте Nginx (опционально)
sudo apt install nginx
sudo nano /etc/nginx/sites-available/certificate-generator
```

Конфиг Nginx:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔧 После деплоя

### 1. Проверьте работоспособность
```bash
# Проверка здоровья
curl https://your-app-url.com/health

# Проверка админки
# Откройте https://your-app-url.com/admin
```

### 2. Настройте Gmail App Password

1. Зайдите в [Google Account Settings](https://myaccount.google.com/)
2. Security → 2-Step Verification (включите если не включена)
3. App passwords → Generate password for "Mail"
4. Используйте этот пароль в `EMAIL_PASS`

### 3. Настройте Google Sheets (если нужно)

1. Создайте проект в [Google Cloud Console](https://console.cloud.google.com)
2. Включите Google Sheets API
3. Создайте Service Account
4. Скачайте JSON ключ
5. Создайте Google таблицу
6. Дайте доступ Service Account к таблице (поделиться → email сервисного аккаунта)

### 4. Загрузите тестовый шаблон

```bash
# Создайте тестовый PDF или используйте любой существующий
curl -X POST https://your-app-url.com/api/v1/templates \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "template=@your-template.pdf" \
  -F "name=Тестовый шаблон" \
  -F 'field_mapping={"first_name":{"x":300,"y":400,"fontSize":24,"color":"#000000"},"last_name":{"x":500,"y":400,"fontSize":24,"color":"#000000"},"amount":{"x":400,"y":300,"fontSize":20,"color":"#ff0000"}}'
```

### 5. Протестируйте создание сертификата

```bash
curl -X POST https://your-app-url.com/api/v1/certificates \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "test-template-001",
    "first_name": "Иван",
    "last_name": "Тестов",
    "recipient_email": "your-test-email@gmail.com",
    "amount": 1000,
    "message": "Тестовый сертификат"
  }'
```

## 🔗 Интеграция с Tilda

### После успешного деплоя:

1. **В Tilda создайте форму** с полями:
   - Name (Имя)
   - Surname (Фамилия) 
   - Email (Email)
   - Sum (Сумма)

2. **Настройте Webhook в Tilda:**
   - URL: `https://your-app-url.com/api/v1/certificates`
   - Метод: POST
   - Заголовки: 
     ```
     Authorization: Bearer YOUR_API_KEY
     Content-Type: application/json
     ```

3. **Добавьте скрытое поле** `template_id` с ID вашего шаблона

4. **Настройте маппинг полей:**
   - Name → first_name
   - Surname → last_name
   - Email → recipient_email
   - Sum → amount

## 🚨 Важные моменты безопасности

1. **Никогда не коммитьте .env файл в git**
2. **Используйте сложные API ключи**
3. **Ограничьте доступ к админ-панели**
4. **Регулярно обновляйте зависимости**

## 📊 Мониторинг

После деплоя следите за:
- Логами приложения
- Статусом в админ-панели (/admin)
- Отправкой email
- Записью в Google Sheets

## 🔄 Обновления

Для обновления приложения:

**Railway/Render:** Просто пушьте в GitHub - деплой автоматический

**VPS:**
```bash
cd certificate-generator
git pull
npm install
pm2 restart certificate-generator
```

## 🆘 Если что-то не работает

1. Проверьте логи
2. Убедитесь что все переменные окружения настроены
3. Проверьте /admin/api/health-check
4. Проверьте настройки Gmail/Google Sheets

Удачи с деплоем! 🚀

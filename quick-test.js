#!/usr/bin/env node

/**
 * Скрипт для создания тестового PDF шаблона сертификата
 * Использование: node create-test-template.js
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function createTestTemplate() {
  console.log('🎨 Создание тестового PDF шаблона...');

  try {
    // Создаем новый PDF документ
    const pdfDoc = await PDFDocument.create();
    
    // Добавляем страницу A4
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 в points
    const { width, height } = page.getSize();

    // Загружаем шрифты
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Цвета
    const darkBlue = rgb(0.1, 0.2, 0.5);
    const gold = rgb(0.8, 0.6, 0.1);
    const gray = rgb(0.4, 0.4, 0.4);

    // Рамка
    page.drawRectangle({
      x: 40,
      y: 40,
      width: width - 80,
      height: height - 80,
      borderColor: darkBlue,
      borderWidth: 3,
    });

    // Внутренняя рамка
    page.drawRectangle({
      x: 60,
      y: 60,
      width: width - 120,
      height: height - 120,
      borderColor: gold,
      borderWidth: 1,
    });

    // Заголовок
    page.drawText('ПОДАРОЧНЫЙ СЕРТИФИКАТ', {
      x: width / 2 - 180,
      y: height - 150,
      size: 28,
      font: titleFont,
      color: darkBlue,
    });

    // Подзаголовок
    page.drawText('на услуги компании', {
      x: width / 2 - 80,
      y: height - 190,
      size: 16,
      font: font,
      color: gray,
    });

    // Декоративная линия
    page.drawLine({
      start: { x: 100, y: height - 220 },
      end: { x: width - 100, y: height - 220 },
      thickness: 2,
      color: gold,
    });

    // Текст "Настоящий сертификат выдан"
    page.drawText('Настоящий сертификат выдан', {
      x: width / 2 - 120,
      y: height - 280,
      size: 16,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Место для имени (будет заполняться динамически)
    // Рисуем линию для наглядности где будет имя
    page.drawLine({
      start: { x: 200, y: height - 320 },
      end: { x: width - 200, y: height - 320 },
      thickness: 1,
      color: gray,
      dashArray: [3, 3],
    });
    
    page.drawText('[ИМЯ ФАМИЛИЯ]', {
      x: width / 2 - 60,
      y: height - 315,
      size: 12,
      font: font,
      color: rgb(0.7, 0.7, 0.7),
    });

    // Текст "на сумму"
    page.drawText('на сумму', {
      x: width / 2 - 40,
      y: height - 370,
      size: 16,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Место для суммы
    page.drawRectangle({
      x: width / 2 - 80,
      y: height - 420,
      width: 160,
      height: 40,
      borderColor: gold,
      borderWidth: 2,
    });

    page.drawText('[СУММА]', {
      x: width / 2 - 30,
      y: height - 405,
      size: 12,
      font: font,
      color: rgb(0.7, 0.7, 0.7),
    });

    // Условия использования
    page.drawText('Сертификат действителен в течение 1 года с даты выдачи', {
      x: width / 2 - 150,
      y: height - 480,
      size: 12,
      font: font,
      color: gray,
    });

    page.drawText('Сертификат не подлежит возврату и обмену на денежные средства', {
      x: width / 2 - 170,
      y: height - 500,
      size: 12,
      font: font,
      color: gray,
    });

    // Дата выдачи
    page.drawText('Дата выдачи: [ДАТА]', {
      x: 100,
      y: 150,
      size: 12,
      font: font,
      color: gray,
    });

    // Код сертификата
    page.drawText('Код: [КОД_СЕРТИФИКАТА]', {
      x: width - 200,
      y: 150,
      size: 10,
      font: font,
      color: gray,
    });

    // Подпись/печать место
    page.drawText('Подпись:', {
      x: 100,
      y: 100,
      size: 12,
      font: font,
      color: gray,
    });

    page.drawLine({
      start: { x: 160, y: 100 },
      end: { x: 300, y: 100 },
      thickness: 1,
      color: gray,
    });

    // Создаем папку templates если не существует
    const templatesDir = path.join(__dirname, 'templates');
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    // Сохраняем PDF
    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(templatesDir, 'test-template.pdf');
    fs.writeFileSync(outputPath, pdfBytes);

    console.log('✅ Тестовый шаблон создан:', outputPath);
    console.log('');
    console.log('📍 Координаты полей для field_mapping:');
    console.log(JSON.stringify({
      first_name: { x: 250, y: 515, fontSize: 20, color: '#000000' },
      last_name: { x: 350, y: 515, fontSize: 20, color: '#000000' },
      amount: { x: 275, y: 435, fontSize: 18, color: '#cc9900' },
      issue_date: { x: 180, y: 150, fontSize: 12, color: '#666666' },
      certificate_code: { x: 430, y: 150, fontSize: 10, color: '#666666' },
      message: { x: 100, y: 550, fontSize: 14, color: '#333333', maxWidth: 400 }
    }, null, 2));
    
    console.log('');
    console.log('🚀 Следующие шаги:');
    console.log('1. Запустите сервер: npm start');
    console.log('2. Откройте админку: http://localhost:3000/admin');
    console.log('3. Или загрузите через API:');
    console.log('   curl -X POST http://localhost:3000/api/v1/templates \\');
    console.log('     -H "Authorization: Bearer your-api-key" \\');
    console.log('     -F "template=@templates/test-template.pdf" \\');
    console.log('     -F "name=Тестовый шаблон" \\');
    console.log('     -F \'field_mapping={"first_name":{"x":250,"y":515,"fontSize":20,"color":"#000000"}}\'');

  } catch (error) {
    console.error('❌ Ошибка создания шаблона:', error);
  }
}

// Проверяем установлены ли зависимости
try {
  require('pdf-lib');
} catch (e) {
  console.error('❌ pdf-lib не установлен. Запустите: npm install');
  process.exit(1);
}

createTestTemplate();

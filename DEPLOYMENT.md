const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Генерирует PDF сертификат на основе шаблона и данных
 * @param {Object} template - Объект шаблона из БД
 * @param {Object} data - Данные для заполнения сертификата
 * @returns {Promise<string>} Путь к созданному PDF файлу
 */
async function generatePDF(template, data) {
  try {
    console.log('Генерация PDF для сертификата:', data.certificate_id);

    // Проверяем существование файла шаблона
    if (!fs.existsSync(template.file_path)) {
      throw new Error(`Файл шаблона не найден: ${template.file_path}`);
    }

    // Читаем шаблон
    const templateBytes = fs.readFileSync(template.file_path);
    
    // Загружаем PDF документ
    const pdfDoc = await PDFDocument.load(templateBytes);
    
    // Получаем первую страницу
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    console.log(`Размер страницы: ${width}x${height}`);

    // Загружаем стандартный шрифт (поддерживает кириллицу)
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Парсим mapping полей из шаблона
    let fieldMapping = {};
    if (template.field_mapping) {
      try {
        fieldMapping = JSON.parse(template.field_mapping);
      } catch (e) {
        console.error('Ошибка парсинга field_mapping:', e);
        // Используем дефолтное расположение полей
        fieldMapping = getDefaultFieldMapping(width, height);
      }
    } else {
      fieldMapping = getDefaultFieldMapping(width, height);
    }

    console.log('Field mapping:', fieldMapping);

    // Функция для отрисовки текста
    const drawText = (text, field, useFont = font) => {
      if (!text || !field) return;
      
      const fontSize = field.fontSize || 16;
      const color = parseColor(field.color) || rgb(0, 0, 0);
      const x = field.x || 100;
      const y = height - (field.y || 100); // PDF координаты идут снизу вверх

      firstPage.drawText(String(text), {
        x: x,
        y: y,
        size: fontSize,
        font: useFont,
        color: color,
      });
    };

    // Заполняем поля данными
    if (data.first_name && fieldMapping.first_name) {
      drawText(data.first_name, fieldMapping.first_name, boldFont);
    }

    if (data.last_name && fieldMapping.last_name) {
      drawText(data.last_name, fieldMapping.last_name, boldFont);
    }

    if (data.amount && fieldMapping.amount) {
      const amountText = `${data.amount} руб.`;
      drawText(amountText, fieldMapping.amount, boldFont);
    }

    if (data.issue_date && fieldMapping.issue_date) {
      const dateText = formatDate(data.issue_date);
      drawText(dateText, fieldMapping.issue_date);
    }

    if (data.expires_at && fieldMapping.expires_at) {
      const expiryText = `Действителен до: ${formatDate(data.expires_at)}`;
      drawText(expiryText, fieldMapping.expires_at);
    }

    if (data.certificate_code && fieldMapping.certificate_code) {
      drawText(data.certificate_code, fieldMapping.certificate_code);
    }

    if (data.message && fieldMapping.message) {
      // Для длинных сообщений можем разбить на строки
      const maxWidth = fieldMapping.message.maxWidth || 400;
      const lines = wrapText(data.message, maxWidth, fieldMapping.message.fontSize || 14);
      
      lines.forEach((line, index) => {
        const lineY = (fieldMapping.message.y || 200) + (index * 20);
        drawText(line, { ...fieldMapping.message, y: lineY });
      });
    }

    if (data.from_name && fieldMapping.from_name) {
      drawText(data.from_name, fieldMapping.from_name);
    }

    // Создаем папку для сертификатов если не существует
    const certificatesDir = path.join(__dirname, '..', 'public', 'certificates');
    if (!fs.existsSync(certificatesDir)) {
      fs.mkdirSync(certificatesDir, { recursive: true });
    }

    // Сохраняем PDF
    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(certificatesDir, `${data.certificate_id}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);

    console.log('PDF сертификат создан:', outputPath);
    return outputPath;

  } catch (error) {
    console.error('Ошибка генерации PDF:', error);
    throw new Error(`Ошибка генерации PDF: ${error.message}`);
  }
}

/**
 * Возвращает дефолтное расположение полей для сертификата
 */
function getDefaultFieldMapping(width, height) {
  const centerX = width / 2;
  const centerY = height / 2;

  return {
    first_name: { x: centerX - 100, y: centerY + 50, fontSize: 24, color: '#000000' },
    last_name: { x: centerX + 20, y: centerY + 50, fontSize: 24, color: '#000000' },
    amount: { x: centerX - 50, y: centerY, fontSize: 20, color: '#ff0000' },
    issue_date: { x: centerX - 100, y: centerY - 50, fontSize: 14, color: '#666666' },
    expires_at: { x: centerX - 100, y: centerY - 80, fontSize: 12, color: '#666666' },
    certificate_code: { x: 50, y: 50, fontSize: 10, color: '#999999' },
    message: { x: centerX - 200, y: centerY - 120, fontSize: 14, color: '#333333', maxWidth: 400 },
    from_name: { x: centerX - 50, y: centerY - 200, fontSize: 16, color: '#000000' }
  };
}

/**
 * Парсит цвет из строки в объект RGB
 */
function parseColor(colorString) {
  if (!colorString) return null;
  
  // Убираем # если есть
  const hex = colorString.replace('#', '');
  
  if (hex.length !== 6) return null;
  
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  return rgb(r, g, b);
}

/**
 * Форматирует дату в читаемый вид
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
 * Разбивает длинный текст на строки по ширине
 */
function wrapText(text, maxWidth, fontSize = 14) {
  // Упрощенная реализация - в реальном проекте нужно учитывать ширину символов
  const approximateCharWidth = fontSize * 0.6;
  const maxChars = Math.floor(maxWidth / approximateCharWidth);
  
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  words.forEach(word => {
    if ((currentLine + word).length <= maxChars) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  
  if (currentLine) lines.push(currentLine);
  
  return lines;
}

module.exports = {
  generatePDF
};

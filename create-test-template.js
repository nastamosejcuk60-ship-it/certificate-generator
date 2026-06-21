const { google } = require('googleapis');

/**
 * Создает авторизованный клиент для Google Sheets API
 */
function createGoogleSheetsClient() {
  try {
    // Проверяем наличие необходимых переменных окружения
    if (!process.env.GOOGLE_SHEETS_PRIVATE_KEY || !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      throw new Error('Google Sheets настройки не сконфигурированы');
    }

    // Создаем JWT клиент для авторизации
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'), // Обрабатываем переносы строк
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    // Создаем клиент для Google Sheets
    const sheets = google.sheets({ version: 'v4', auth });
    
    return sheets;
  } catch (error) {
    console.error('Ошибка создания Google Sheets клиента:', error);
    throw error;
  }
}

/**
 * Логирует данные сертификата в Google Sheets
 * @param {Object} certificateData - Данные сертификата
 */
async function logToGoogleSheets(certificateData) {
  try {
    console.log('Запись в Google Sheets для сертификата:', certificateData.certificate_id);

    // Проверяем наличие ID таблицы
    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID не настроен');
    }

    const sheets = createGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName = 'Сертификаты'; // Название листа

    // Подготавливаем данные для записи
    const rowData = [
      new Date().toLocaleString('ru-RU'), // Дата создания
      certificateData.certificate_id,
      certificateData.first_name,
      certificateData.last_name,
      certificateData.recipient_email,
      certificateData.amount,
      certificateData.issue_date,
      certificateData.expires_at,
      certificateData.certificate_code,
      certificateData.message || '',
      certificateData.from_name || '',
      'issued', // статус
      `${process.env.BASE_URL}/api/v1/verify/${certificateData.certificate_code}` // ссылка проверки
    ];

    // Проверяем существование листа и создаем заголовки если нужно
    await ensureSheetExists(sheets, spreadsheetId, sheetName);

    // Добавляем строку с данными
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:M`, // Диапазон от A до M (13 колонок)
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData]
      }
    });

    console.log('✅ Данные записаны в Google Sheets:', response.data.updates?.updatedCells);
    return response.data;

  } catch (error) {
    console.error('Ошибка записи в Google Sheets:', error);
    throw error;
  }
}

/**
 * Проверяет существование листа и создает заголовки если нужно
 */
async function ensureSheetExists(sheets, spreadsheetId, sheetName) {
  try {
    // Получаем информацию о таблице
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId
    });

    // Ищем нужный лист
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);

    if (!sheet) {
      // Создаем новый лист
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        }
      });

      console.log(`Создан новый лист: ${sheetName}`);
    }

    // Проверяем наличие заголовков
    const headerRange = `${sheetName}!A1:M1`;
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: headerRange
    });

    // Если заголовков нет, создаем их
    if (!headerResponse.data.values || headerResponse.data.values.length === 0) {
      const headers = [
        'Дата создания',
        'ID сертификата',
        'Имя',
        'Фамилия',
        'Email',
        'Сумма',
        'Дата выдачи',
        'Действителен до',
        'Код сертификата',
        'Сообщение',
        'От кого',
        'Статус',
        'Ссылка проверки'
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: headerRange,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });

      // Форматируем заголовки
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          requests: [{
            repeatCell: {
              range: {
                sheetId: sheet?.properties?.sheetId || 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 13
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                  textFormat: { bold: true }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          }]
        }
      });

      console.log('Заголовки таблицы созданы');
    }

  } catch (error) {
    console.error('Ошибка проверки/создания листа:', error);
    throw error;
  }
}

/**
 * Проверяет подключение к Google Sheets
 */
async function testGoogleSheetsConnection() {
  try {
    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      console.log('⚠️  Google Sheets не настроен (GOOGLE_SHEETS_SPREADSHEET_ID отсутствует)');
      return false;
    }

    const sheets = createGoogleSheetsClient();
    
    // Пробуем получить информацию о таблице
    const response = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    });

    console.log('✅ Google Sheets подключение работает:', response.data.properties?.title);
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к Google Sheets:', error.message);
    return false;
  }
}

/**
 * Обновляет статус сертификата в Google Sheets
 * @param {string} certificateId - ID сертификата
 * @param {string} status - Новый статус
 */
async function updateCertificateStatus(certificateId, status) {
  try {
    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      console.log('Google Sheets не настроен, пропускаем обновление статуса');
      return;
    }

    const sheets = createGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName = 'Сертификаты';

    // Ищем строку с нужным сертификатом
    const searchResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:L`
    });

    const rows = searchResponse.data.values || [];
    let rowIndex = -1;

    // Ищем строку с нужным certificate_id (колонка B, индекс 1)
    for (let i = 1; i < rows.length; i++) { // Начинаем с 1, чтобы пропустить заголовки
      if (rows[i][1] === certificateId) {
        rowIndex = i + 1; // +1 для Google Sheets нумерации (начинается с 1)
        break;
      }
    }

    if (rowIndex > 0) {
      // Обновляем статус в колонке L (индекс 11)
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!L${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[status]]
        }
      });

      console.log(`Статус сертификата ${certificateId} обновлен на ${status} в Google Sheets`);
    }

  } catch (error) {
    console.error('Ошибка обновления статуса в Google Sheets:', error);
  }
}

module.exports = {
  logToGoogleSheets,
  testGoogleSheetsConnection,
  updateCertificateStatus
};

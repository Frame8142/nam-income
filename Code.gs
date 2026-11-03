const SHEET_LIST = 'databaselist';
const COMMISSION_RATE = 0.10;

// แมปชื่อผู้ใช้ → ชื่อชีต
const USER_SHEETS = {
  'nam': 'databasenam'
};



/* =========================
   HELPER — เลือกชีต database ตาม user
========================= */

function getUserSheet(user) {

  const sheetName = USER_SHEETS[user];

  if (!sheetName) {
    throw new Error('ผู้ใช้ไม่ถูกต้อง');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('ไม่พบชีต ' + sheetName);
  }

  return sheet;

}


/* =========================
   WEB APP — GET (read-only API)
========================= */

function doGet(e) {

  const action = e.parameter.action;
  const user = e.parameter.user || '';

  // API รายการปุ่มบริการ
  if (action === 'list') {

    return jsonResponse({
      success: true,
      data: getList()
    });

  }


  // API ประวัติ (ของผู้ใช้คนเดียว)
  if (action === 'history') {

    return jsonResponse(
      getHistory(user)
    );

  }




  // API ประวัติเวลางาน (?action=historyAttendance&user=nam&month=9&year=2026)
  if (action === 'historyAttendance') {

    try {
      const monthNum = Number(e.parameter.month);
      const yearNum = Number(e.parameter.year);
      // กันค่าผิดแล้วคืนข้อมูลทั้งหมดแบบเงียบๆ — ให้ error ชัดเจนแทน
      if (e.parameter.month && (isNaN(monthNum) || monthNum < 1 || monthNum > 12)) {
        throw new Error('ระบุเดือนไม่ถูกต้อง');
      }
      if (e.parameter.year && (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100)) {
        throw new Error('ระบุปีไม่ถูกต้อง');
      }
      return jsonResponse(
        getAttendanceHistory(
          user,
          e.parameter.month ? monthNum : 0,
          e.parameter.year ? yearNum : 0
        )
      );
    } catch (err) {
      return jsonResponse({
        success: false,
        message: err.message
      });
    }

  }


  // Default: return API info
  return jsonResponse({
    success: true,
    message: 'API is running. Use ?action=list or ?action=history&user=nam'
  });

}


/* =========================
   WEB APP — POST (write API)
   รองรับการเรียกจากภายนอก (GitHub Pages)
========================= */

function doPost(e) {

  let body;

  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({
      success: false,
      message: 'Invalid JSON body'
    });
  }

  const action = body.action;
  const user = body.user || '';


  // บันทึกรายได้
  if (action === 'save') {

    try {
      const result = saveFromWeb(
        user,
        body.item,
        body.price,
        body.customDate || '',
        body.payment || ''
      );
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({
        success: false,
        message: err.message
      });
    }

  }


  // แก้ไขรายการ
  if (action === 'update') {

    try {
      const result = updateHistoryItem(
        user,
        body.rowIndex,
        body.item,
        body.price
      );
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({
        success: false,
        message: err.message
      });
    }

  }


  // ลบรายการ
  if (action === 'delete') {

    try {
      const result = deleteHistoryItem(
        user,
        body.rowIndex
      );
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({
        success: false,
        message: err.message
      });
    }

  }



  // เพิ่มบริการ
  if (action === 'addService') {

    try {
      const result = addService(
        body.name,
        body.category
      );
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({
        success: false,
        message: err.message
      });
    }

  }


  // แก้ไขบริการ
  if (action === 'updateService') {

    try {
      const result = updateService(
        body.rowIndex,
        body.name,
        body.category
      );
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({
        success: false,
        message: err.message
      });
    }

  }


  // ลบบริการ
  if (action === 'deleteService') {

    try {
      const result = deleteService(
        body.rowIndex
      );
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({
        success: false,
        message: err.message
      });
    }

  }


  // บันทึกเวลาเข้าออกงาน (ส่งซ้ำวันเดียวกัน = อัปเดตทับ)
  if (action === 'saveAttendance') {
    try {
      const result = saveAttendanceData(
        user,
        body.date,
        body.checkIn,
        body.checkOut,
        body.note,
        body.fullText,
        body.lateMin,
        body.fine,
        body.jobs,
        body.income,
        body.otMin,
        body.otPay
      );
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({
        success: false,
        message: err.message
      });
    }
  }


  // แก้ไขเวลาเข้าออกงานย้อนหลัง
  if (action === 'updateAttendance') {
    try {
      const result = updateAttendanceData(
        user,
        body.date,
        body.checkIn,
        body.checkOut,
        body.note,
        body.lateMin,
        body.fine,
        body.otMin,
        body.otPay
      );
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({
        success: false,
        message: err.message
      });
    }
  }


  // ลบบันทึกเวลา
  if (action === 'deleteAttendance') {
    try {
      const result = deleteAttendanceData(
        user,
        body.date
      );
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({
        success: false,
        message: err.message
      });
    }
  }


  return jsonResponse({
    success: false,
    message: 'Unknown action: ' + action
  });

}




/* =========================
   SAVE FROM WEB
========================= */

function normalizePaymentGS(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'transfer' || v === 'โอน') return 'transfer';
  if (v === 'cash' || v === 'เงินสด') return 'cash';
  return '';
}


function saveFromWeb(user, item, price, customDate, payment) {

  if (!item || String(item).trim() === '') {
    throw new Error('กรุณาเลือกรายการ');
  }

  if (price === '' || price === null || price === undefined) {
    throw new Error('กรุณาใส่ราคา');
  }

  const itemText = String(item).trim();
  const priceNumber = Number(price);

  if (isNaN(priceNumber) || priceNumber < 0) {
    throw new Error('ราคาต้องเป็นตัวเลข');
  }

  const paymentValue = normalizePaymentGS(payment);


  const database = getUserSheet(user);




  const now = new Date();

  const timeZone =
    Session.getScriptTimeZone();


  // ===== วันที่ =====
  // customDate มาจาก dropdown วัน/เดือน/ปี ฝั่งหน้าเว็บ รูปแบบ 'YYYY-MM-DD'
  // ถ้าไม่ได้ระบุ (ลงข้อมูลย้อนหลัง) จะใช้วันที่ปัจจุบัน

  let dateText;
  let isBackdated = false;

  if (customDate && String(customDate).trim() !== '') {

    const dateParts =
      String(customDate).trim().split('-');

    if (dateParts.length === 3) {

      const y = Number(dateParts[0]);
      const m = Number(dateParts[1]);
      const d = Number(dateParts[2]);

      const parsedDate =
        new Date(y, m - 1, d);

      if (isNaN(parsedDate.getTime())) {
        throw new Error('วันที่ไม่ถูกต้อง');
      }

      // กันไม่ให้เลือกวันในอนาคต
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (parsedDate.getTime() > today.getTime()) {
        throw new Error('เลือกวันในอนาคตไม่ได้');
      }

      dateText =
        String(d).padStart(2, '0') +
        '/' +
        String(m).padStart(2, '0') +
        '/' +
        y;

      isBackdated = true;

    } else {

      throw new Error('รูปแบบวันที่ไม่ถูกต้อง');

    }

  } else {

    dateText =
      Utilities.formatDate(
        now,
        timeZone,
        'dd/MM/yyyy'
      );

  }


  // ===== เวลา =====
  // ไม่ได้ให้ผู้ใช้เลือกเวลา:
  // รายการปกติใช้เวลาปัจจุบัน / รายการย้อนหลังใช้เวลากลางวัน (12:00:00) เป็นค่าเริ่มต้น

  const timeText =
    isBackdated
      ? '12:00:00'
      : Utilities.formatDate(
          now,
          timeZone,
          'HH:mm:ss'
        );


  const commission =
    priceNumber * COMMISSION_RATE;


  // บันทึกรายได้ (F = วิธีจ่าย: transfer/cash/ว่างสำหรับแถวเก่า)
  database.appendRow([
    dateText,
    timeText,
    itemText,
    priceNumber,
    commission,
    paymentValue
  ]);


  return {

    success: true,

    message: 'บันทึกข้อมูลเรียบร้อย',

    data: {

      date: dateText,

      time: timeText,

      item: itemText,

      price: priceNumber,

      commission: commission,

      payment: paymentValue

    }

  };

}


/* =========================
   UPDATE HISTORY ITEM
   (edit an existing income row, referenced by its
   absolute sheet row number)
========================= */

function updateHistoryItem(user, rowIndex, item, price) {

  const sheet = getUserSheet(user);

  const lastRow =
    sheet.getLastRow();

  rowIndex = Number(rowIndex);

  if (
    !rowIndex ||
    rowIndex < 2 ||
    rowIndex > lastRow
  ) {
    throw new Error('ไม่พบรายการนี้');
  }

  const itemText =
    String(item || '').trim();

  const priceNumber =
    Number(price);

  if (!itemText) {
    throw new Error('กรุณาเลือกรายการ');
  }

  if (
    isNaN(priceNumber) ||
    priceNumber < 0
  ) {
    throw new Error('ราคาต้องเป็นตัวเลข');
  }

  const commission =
    priceNumber * COMMISSION_RATE;

  // แก้ไขเฉพาะ รายการ / ราคา / commission (คอลัมน์ 3-5)
  // วันที่และเวลาของรายการเดิมยังคงเดิม
  sheet
    .getRange(rowIndex, 3, 1, 3)
    .setValues([[
      itemText,
      priceNumber,
      commission
    ]]);

  return {

    success: true,

    message: 'แก้ไขรายการเรียบร้อย'

  };

}


/* =========================
   DELETE HISTORY ITEM
   (remove an income row, referenced by its
   absolute sheet row number)
========================= */

function deleteHistoryItem(user, rowIndex) {

  const sheet = getUserSheet(user);

  const lastRow =
    sheet.getLastRow();

  rowIndex = Number(rowIndex);

  if (
    !rowIndex ||
    rowIndex < 2 ||
    rowIndex > lastRow
  ) {
    throw new Error('ไม่พบรายการนี้');
  }

  sheet.deleteRow(rowIndex);

  return {

    success: true,

    message: 'ลบรายการเรียบร้อย'

  };

}


/* =========================
   GET SERVICE BUTTONS
   Column A = ชื่อบริการ, Column B = หมวดหมู่
   คืนค่าเป็น [{row, name, category}, ...]
========================= */

function getList() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(SHEET_LIST);


  if (!sheet) {
    throw new Error(
      'ไม่พบชีต databaselist'
    );
  }


  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {
    return [];
  }


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        2
      )
      .getValues();


  return values

    .map(function(row, i) {

      return {

        row: i + 2,

        name: String(row[0] || '').trim(),

        category: String(row[1] || '').trim() || 'อื่นๆ'

      };

    })

    .filter(function(item) {

      return item.name !== '';

    });

}


/* =========================
   ADD SERVICE BUTTON
========================= */

function addService(name, category) {

  name =
    String(name || '').trim();

  category =
    String(category || '').trim() || 'อื่นๆ';


  if (!name) {
    throw new Error(
      'กรุณาระบุชื่อบริการ'
    );
  }


  const ss =
    SpreadsheetApp.getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(SHEET_LIST);


  if (!sheet) {
    throw new Error(
      'ไม่พบชีต databaselist'
    );
  }


  const list =
    getList();


  // ป้องกันรายการซ้ำ
  const exists =
    list.some(function(item) {

      return item.name === name;

    });


  if (exists) {

    return {

      success: false,

      message: 'มีบริการนี้อยู่แล้ว'

    };

  }


  sheet.appendRow([
    name,
    category
  ]);


  return {

    success: true,

    message: 'เพิ่มบริการเรียบร้อย',

    service: name

  };

}


/* =========================
   UPDATE SERVICE (name + category)
   referenced by its absolute sheet row number
========================= */

function updateService(rowIndex, name, category) {

  rowIndex = Number(rowIndex);

  name =
    String(name || '').trim();

  category =
    String(category || '').trim() || 'อื่นๆ';


  if (!name) {
    throw new Error(
      'กรุณาระบุชื่อบริการ'
    );
  }


  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(SHEET_LIST);


  if (!sheet) {
    throw new Error(
      'ไม่พบชีต databaselist'
    );
  }


  const lastRow =
    sheet.getLastRow();


  if (
    !rowIndex ||
    rowIndex < 2 ||
    rowIndex > lastRow
  ) {
    throw new Error(
      'ไม่พบรายการนี้'
    );
  }


  const list =
    getList();


  // ป้องกันชื่อซ้ำกับแถวอื่น (ไม่นับแถวตัวเอง)
  const duplicate =
    list.some(function(item) {

      return (
        item.name === name &&
        item.row !== rowIndex
      );

    });


  if (duplicate) {

    return {

      success: false,

      message: 'มีบริการชื่อนี้อยู่แล้ว'

    };

  }


  sheet
    .getRange(rowIndex, 1, 1, 2)
    .setValues([[
      name,
      category
    ]]);


  return {

    success: true,

    message: 'แก้ไขบริการเรียบร้อย'

  };

}


/* =========================
   DELETE SERVICE BUTTON
   referenced by its absolute sheet row number
========================= */

function deleteService(rowIndex) {

  rowIndex = Number(rowIndex);


  const ss =
    SpreadsheetApp.getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(SHEET_LIST);


  if (!sheet) {
    throw new Error(
      'ไม่พบชีต databaselist'
    );
  }


  const lastRow =
    sheet.getLastRow();


  if (
    !rowIndex ||
    rowIndex < 2 ||
    rowIndex > lastRow
  ) {

    throw new Error(
      'ไม่พบรายการนี้'
    );

  }


  sheet.deleteRow(rowIndex);


  return {

    success: true,

    message: 'ลบบริการเรียบร้อย'

  };

}


/* =========================
   HISTORY (ของผู้ใช้คนเดียว)
========================= */

function getHistory(user) {

  const sheet = getUserSheet(user);

  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {

    return {

      success: true,

      data: []

    };

  }


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        6
      )
      .getValues();

  const timeZone = Session.getScriptTimeZone();

  const data =
    values.map(function(row, i) {

      let dateVal = row[0];
      if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
        dateVal = Utilities.formatDate(dateVal, timeZone, 'dd/MM/yyyy');
      } else {
        dateVal = String(dateVal || '').trim();
      }

      let timeVal = row[1];
      if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
        timeVal = Utilities.formatDate(timeVal, timeZone, 'HH:mm:ss');
      } else {
        timeVal = String(timeVal || '').trim();
      }

      return {

        row: i + 2,

        date: dateVal,

        time: timeVal,

        item: row[2],

        price:
          Number(
            String(row[3] || '')
              .replace(/,/g, '')
          ) || 0,

        commission:
          Number(
            String(row[4] || '')
              .replace(/,/g, '')
          ) || 0,

        payment: normalizePaymentGS(row[5] || '')

      };

    });


  return {

    success: true,

    data: data

  };

}




/* =========================
   JSON
========================= */

function jsonResponse(data) {

  return ContentService

    .createTextOutput(
      JSON.stringify(data)
    )

    .setMimeType(
      ContentService.MimeType.JSON
    );

}


/* =========================
   ATTENDANCE — เวลาเข้าออกงาน
   ชีต 'attendance' (สร้างอัตโนมัติถ้ายังไม่มี)
   A=ผู้ใช้ | B=คีย์วันที่(yyyy-mm-dd) | C=วันที่(dd/mm/yyyy)
   D=เวลาเข้า | E=เวลาออก | F=สาย(นาที) | G=หัก(บาท)
   H=จำนวนงาน | I=รายได้ | J=โน้ต | K=ข้อความส่งยอด
   L=OT(นาที) | M=OT(บาท)
========================= */


// Google Sheets อาจ auto-convert "yyyy-mm-dd" เป็น Date object
// ฟังก์ชันนี้แปลงทั้ง Date object และ string กลับเป็น "yyyy-mm-dd" อย่างปลอดภัย
// ⚠️ ใช้ 'Asia/Bangkok' เสมอ เพราะ Session.getScriptTimeZone() อาจเป็น US timezone
var ATT_TZ = 'Asia/Bangkok';

function cellToDateKey(val) {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, ATT_TZ, 'yyyy-MM-dd');
  }
  var s = String(val || '').trim();
  // ถ้าเป็น yyyy-mm-dd อยู่แล้ว ใช้เลย
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // ❌ ห้ามใช้ new Date(s) กับ dd/mm/yyyy เพราะ JS จะตีความเป็น mm/dd/yyyy
  return s; // fallback คืนค่าเดิม
}


function getAttendanceSheet(user) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'attendance_' + user;
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      'ผู้ใช้', 'คีย์วันที่', 'วันที่',
      'เวลาเข้า', 'เวลาออก', 'สาย(นาที)', 'หัก(บาท)',
      'จำนวนงาน', 'รายได้', 'โน้ต', 'ข้อความส่งยอด',
      'OT(นาที)', 'OT(บาท)'
    ]);
  } else {
    // Migration: เพิ่ม header L/M ถ้ายังไม่มี
    var headerRow = sheet.getRange(1, 1, 1, 13).getValues()[0];
    if (!headerRow[11] || String(headerRow[11]).trim() === '') {
      sheet.getRange(1, 12).setValue('OT(นาที)');
      sheet.getRange(1, 13).setValue('OT(บาท)');
    }
  }

  return sheet;

}

/* =========================
   SETUP SHEETS (สำหรับกด Run ใน Apps Script)
========================= */
function setupSheets() {
  getAttendanceSheet('nam');
  return "สร้างชีต attendance_nam เรียบร้อย";
}


function checkAttUser(user) {
  if (!USER_SHEETS[user]) {
    throw new Error('ผู้ใช้ไม่ถูกต้อง');
  }
}


// แปลง 'yyyy-mm-dd' → 'dd/mm/yyyy' (เก็บแบบเดียวกับชีตรายได้)
function attDisplayDate(dateKey) {

  const parts = String(dateKey || '').trim().split('-');

  if (parts.length !== 3) {
    throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
  }

  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);

  if (!y || !m || !d) {
    throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
  }

  return (
    String(d).padStart(2, '0') + '/' +
    String(m).padStart(2, '0') + '/' +
    y
  );

}


// หาแถวของ user+วันนั้น (คืนเลขแถว absolute หรือ 0 ถ้ายังไม่มี)
function findAttendanceRow(sheet, values, user, dateKey) {

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === user &&
        cellToDateKey(values[i][1]) === dateKey) {
      return i + 2; // +1 หัวตาราง, +1 zero-index
    }
  }

  return 0;

}


function saveAttendanceData(user, dateKey, checkIn, checkOut, note, fullText, lateMin, fine, jobs, income, otMin, otPay) {

  checkAttUser(user);

  dateKey = String(dateKey || '').trim();
  const dateText = attDisplayDate(dateKey);

  // กันบันทึกวันในอนาคต (เทียบวันที่ใน timezone ไทย)
  const todayKey = Utilities.formatDate(new Date(), ATT_TZ, 'yyyy-MM-dd');
  if (dateKey > todayKey) {
    throw new Error('บันทึกวันในอนาคตไม่ได้');
  }
  const sheet = getAttendanceSheet(user);
  const lastRow = sheet.getLastRow();

  let values = [];
  if (lastRow >= 2) {
    values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  }

  const rowData = [
    user,
    dateKey,
    dateText,
    String(checkIn || '').trim(),
    String(checkOut || '').trim(),
    Number(lateMin) || 0,
    Number(fine) || 0,
    Number(jobs) || 0,
    Number(income) || 0,
    String(note || ''),
    String(fullText || ''),
    Number(otMin) || 0,
    Number(otPay) || 0
  ];

  const existingRow = findAttendanceRow(sheet, values, user, dateKey);

  if (existingRow > 0) {
    // ส่งซ้ำวันเดียวกัน = อัปเดตทับ (ไม่เบิ้ลแถว)
    sheet.getRange(existingRow, 1, 1, 13).setValues([rowData]);
    // Force คอลัมน์ B เป็น Plain Text กัน Sheets auto-convert เป็น Date
    sheet.getRange(existingRow, 2).setNumberFormat('@');
  } else {
    sheet.appendRow(rowData);
    // Force คอลัมน์ B เป็น Plain Text กัน Sheets auto-convert เป็น Date
    var newRow = sheet.getLastRow();
    sheet.getRange(newRow, 2).setNumberFormat('@').setValue(dateKey);
  }

  return {
    success: true,
    message: 'บันทึกเวลาเรียบร้อย'
  };

}


function updateAttendanceData(user, dateKey, checkIn, checkOut, note, lateMin, fine, otMin, otPay) {

  checkAttUser(user);

  dateKey = String(dateKey || '').trim();
  const sheet = getAttendanceSheet(user);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('ไม่พบบันทึกเวลานี้');
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const row = findAttendanceRow(sheet, values, user, dateKey);

  if (!row) {
    throw new Error('ไม่พบบันทึกเวลานี้');
  }

  // แก้เฉพาะ เวลาเข้า/ออก/สาย/หัก (คอลัมน์ D–G), โน้ต (J), OT (L–M)
  sheet.getRange(row, 4, 1, 4).setValues([[
    String(checkIn || '').trim(),
    String(checkOut || '').trim(),
    Number(lateMin) || 0,
    Number(fine) || 0
  ]]);
  sheet.getRange(row, 10).setValue(String(note || ''));
  sheet.getRange(row, 12, 1, 2).setValues([[Number(otMin) || 0, Number(otPay) || 0]]);

  return {
    success: true,
    message: 'แก้ไขเวลาเรียบร้อย'
  };

}


function deleteAttendanceData(user, dateKey) {

  checkAttUser(user);

  dateKey = String(dateKey || '').trim();
  const sheet = getAttendanceSheet(user);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('ไม่พบบันทึกเวลานี้');
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const row = findAttendanceRow(sheet, values, user, dateKey);

  if (!row) {
    throw new Error('ไม่พบบันทึกเวลานี้');
  }

  sheet.deleteRow(row);

  return {
    success: true,
    message: 'ลบบันทึกเวลาเรียบร้อย'
  };

}


function getAttendanceHistory(user, month, year) {

  checkAttUser(user);

  // month/year ที่ใช้กรองต้อง valid เท่านั้น (0/ว่าง = ไม่กรอง)
  if (month && (isNaN(month) || month < 1 || month > 12)) {
    throw new Error('ระบุเดือนไม่ถูกต้อง');
  }
  if (year && (isNaN(year) || year < 2000 || year > 2100)) {
    throw new Error('ระบุปีไม่ถูกต้อง');
  }

  const sheet = getAttendanceSheet(user);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { success: true, data: [] };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const data = [];

  values.forEach(function (r) {

    if (String(r[0]).trim() !== user) return;

    // กรองตามเดือน/ปี จากคีย์วันที่ (yyyy-mm-dd)
    // ⚠️ Google Sheets อาจ auto-convert เป็น Date object — ใช้ cellToDateKey แปลงกลับ
    const dk = cellToDateKey(r[1]);
    const parts = dk.split('-');
    if (parts.length === 3 && (month || year)) {
      if ((month && Number(parts[1]) !== month) ||
          (year && Number(parts[0]) !== year)) {
        return;
      }
    }

    // r[2] = dd/mm/yyyy display date — อาจเป็น Date object เหมือนกัน → derive จาก dk
    var displayDate = String(r[2] || '').trim();
    if (r[2] instanceof Date && !isNaN(r[2].getTime())) {
      displayDate = Utilities.formatDate(r[2], ATT_TZ, 'dd/MM/yyyy');
    } else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(displayDate) && dk) {
      // derive from dk (yyyy-mm-dd → dd/mm/yyyy)
      var dp = dk.split('-');
      if (dp.length === 3) displayDate = dp[2] + '/' + dp[1] + '/' + dp[0];
    }

    var inTime = String(r[3] != null ? r[3] : '').trim();
    var outTime = String(r[4] != null ? r[4] : '').trim();
    var lateMin = Number(r[5]) || 0;
    var fine = Number(r[6]) || 0;
    var otMin = Number(r[11]) || 0;
    var otPay = Number(r[12]) || 0;

    if (outTime && (!otPay || otPay === 0)) {
      var calcO = calcAttOt_(outTime);
      if (calcO.otPay > 0) {
        otMin = calcO.otMin;
        otPay = calcO.otPay;
      }
    }
    if (inTime && (!fine || fine === 0)) {
      var calcL = calcAttLate_(inTime);
      if (calcL.fine > 0) {
        lateMin = calcL.lateMin;
        fine = calcL.fine;
      }
    }

    data.push({
      user: String(r[0]).trim(),
      dateKey: dk,
      date: displayDate,
      checkIn: inTime,
      checkOut: outTime,
      lateMin: lateMin,
      fine: fine,
      jobs: Number(r[7]) || 0,
      income: Number(r[8]) || 0,
      note: String(r[9] || ''),
      fullText: String(r[10] || ''),
      otMin: otMin,
      otPay: otPay
    });

  });

  // ใหม่สุดก่อน
  data.sort(function (a, b) {
    return String(b.dateKey).localeCompare(String(a.dateKey));
  });

  return {
    success: true,
    data: data
  };

}


function timeStrToMinutes_(str) {
  if (str == null) return null;
  var s = String(str).trim().replace(',', '.').replace(':', '.').replace(' ', '.').replace('น', '').trim();
  if (!s) return null;
  if (/^\d{3,4}$/.test(s)) {
    var p = s.length === 3 ? '0' + s : s;
    var h = Number(p.slice(0, 2));
    var m = Number(p.slice(2, 4));
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }
  if (/^\d{1,2}$/.test(s)) {
    var h = Number(s);
    if (h < 0 || h > 23) return null;
    return h * 60;
  }
  var parts = s.split('.');
  if (parts.length !== 2) return null;
  var h = Number(parts[0]);
  var mStr = parts[1];
  if (mStr.length === 1) mStr += '0';
  var m = Number(mStr);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function calcAttOt_(checkOutStr) {
  var schedOut = 20 * 60; // 20.00 น.
  var actualOut = timeStrToMinutes_(checkOutStr);
  if (actualOut === null || actualOut <= schedOut) {
    return { otMin: 0, otPay: 0 };
  }
  var ot = actualOut - schedOut;
  return { otMin: ot, otPay: ot };
}

function calcAttLate_(checkInStr) {
  var schedIn = 10 * 60; // 10.00 น.
  var actualIn = timeStrToMinutes_(checkInStr);
  if (actualIn === null || actualIn <= schedIn) {
    return { lateMin: 0, fine: 0 };
  }
  var late = actualIn - schedIn;
  return { lateMin: late, fine: late };
}

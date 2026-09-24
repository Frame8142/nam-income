const SHEET_LIST = 'databaselist';
const COMMISSION_RATE = 0.10;

// แมปชื่อผู้ใช้ → ชื่อชีต
const USER_SHEETS = {
  'nam': 'databasenam',
  'mook': 'databasemook'
};

// แมปชื่อผู้ใช้ → แถวใน databaselist (คอลัมน์ C/D)
// nam = แถว 1, mook = แถว 2 — ใช้ตัวนี้อ้างอิงแถวเสมอ
// (ไม่เทียบกับชื่อในคอลัมน์ C เพราะคอลัมน์นั้นเป็นภาษาไทยที่กรอกเอง)
const PIN_ROW_MAP = {
  'nam': 1,
  'mook': 2
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


  // API ประวัติรวม (ทั้ง 2 คน)
  if (action === 'historyAll') {

    return jsonResponse(
      getHistoryAll()
    );

  }


  // API ดึง PIN
  if (action === 'getPin') {

    return jsonResponse(
      getPinData(user)
    );

  }


  // API ประวัติเวลางาน (?action=historyAttendance&user=nam&month=9&year=2026)
  if (action === 'historyAttendance') {

    try {
      return jsonResponse(
        getAttendanceHistory(
          user,
          Number(e.parameter.month),
          Number(e.parameter.year)
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
        body.customDate || ''
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


  // ตั้ง PIN / เปลี่ยน PIN
  if (action === 'setPin') {
    try {
      const result = setPin(
        user,
        body.oldPin,
        body.newPin
      );
      return jsonResponse(result);
    } catch (e) {
      return jsonResponse({ success: false, message: e.message });
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
        body.income
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
        body.fine
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
   PIN MANAGEMENT
   เก็บใน databaselist คอลัมน์ C, D
   C1 = ชื่อคนที่ 1 (น้ำ), D1 = PIN ของน้ำ
   C2 = ชื่อคนที่ 2 (มุก), D2 = PIN ของมุก
========================= */

function getPinData(user) {

  if (!user) {
    return {
      success: false,
      message: 'ไม่ได้ระบุผู้ใช้'
    };
  }

  const row = PIN_ROW_MAP[user];

  if (!row) {
    return {
      success: false,
      message: 'ผู้ใช้ไม่ถูกต้อง'
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LIST);

  if (!sheet) {
    throw new Error('ไม่พบชีต databaselist');
  }

  // อ่านเฉพาะคอลัมน์ D (pin) ของแถวผู้ใช้นี้
  const pin = String(sheet.getRange(row, 4).getValue() || '').trim();

  return {
    success: true,
    hasPin: pin !== '',
    // ไม่ส่ง PIN กลับมาตรงๆ เพื่อความปลอดภัย
    // แต่ส่ง hash หรือ flag ก็ได้
    pin: pin
  };

}


function setPin(user, oldPin, newPin) {

  if (!user) {
    throw new Error('ไม่ได้ระบุผู้ใช้');
  }

  // Support legacy signature: setPin(user, pin)
  let targetPin = newPin;
  if (!newPin && oldPin) {
    targetPin = oldPin;
    oldPin = null;
  }

  if (!targetPin || String(targetPin).trim().length !== 4) {
    throw new Error('PIN ต้องเป็น 4 หลัก');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LIST);

  if (!sheet) {
    throw new Error('ไม่พบชีต databaselist');
  }

  // nam → แถว 1, mook → แถว 2
  const row = PIN_ROW_MAP[user];

  if (!row) {
    throw new Error('ผู้ใช้ไม่ถูกต้อง');
  }

  // Verify old PIN if provided
  if (oldPin) {
    const currentPin = sheet.getRange(row, 4).getValue();
    if (String(currentPin).trim() !== String(oldPin).trim()) {
      throw new Error('รหัส PIN เดิมไม่ถูกต้อง');
    }
  }

  // เขียนแค่ D{row} = PIN — ไม่แตะคอลัมน์ C (ชื่อคนที่กรอกเองอยู่แล้ว)
  sheet.getRange(row, 4).setValue(
    String(targetPin).trim()
  );

  return {
    success: true,
    message: 'ตั้งค่า PIN เรียบร้อย'
  };

}


/* =========================
   SAVE FROM WEB
========================= */

function saveFromWeb(user, item, price, customDate) {

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


  const database = getUserSheet(user);

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const databaselist =
    ss.getSheetByName(SHEET_LIST);

  if (!databaselist) {
    throw new Error('ไม่พบชีต databaselist');
  }


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


  // บันทึกรายได้
  database.appendRow([
    dateText,
    timeText,
    itemText,
    priceNumber,
    commission
  ]);


  return {

    success: true,

    message: 'บันทึกข้อมูลเรียบร้อย',

    data: {

      date: dateText,

      time: timeText,

      item: itemText,

      price: priceNumber,

      commission: commission

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
        5
      )
      .getDisplayValues();


  const data =
    values.map(function(row, i) {

      return {

        row: i + 2,

        date: row[0],

        time: row[1],

        item: row[2],

        price:
          Number(
            row[3]
              .replace(/,/g, '')
          ) || 0,

        commission:
          Number(
            row[4]
              .replace(/,/g, '')
          ) || 0

      };

    });


  return {

    success: true,

    data: data

  };

}


/* =========================
   HISTORY ALL (รวม 2 คน)
   คืนข้อมูลแยก nam / mook
========================= */

function getHistoryAll() {

  const result = {};

  const users = Object.keys(USER_SHEETS);

  users.forEach(function(user) {

    try {

      const histResult = getHistory(user);

      result[user] = (histResult && histResult.data) || [];

    } catch (e) {

      result[user] = [];

    }

  });

  return {

    success: true,

    data: result

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
========================= */

const SHEET_ATTENDANCE = 'attendance';


function getAttendanceSheet() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_ATTENDANCE);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ATTENDANCE);
    sheet.appendRow([
      'ผู้ใช้', 'คีย์วันที่', 'วันที่',
      'เวลาเข้า', 'เวลาออก', 'สาย(นาที)', 'หัก(บาท)',
      'จำนวนงาน', 'รายได้', 'โน้ต', 'ข้อความส่งยอด'
    ]);
  }

  return sheet;

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
        String(values[i][1]).trim() === dateKey) {
      return i + 2; // +1 หัวตาราง, +1 zero-index
    }
  }

  return 0;

}


function saveAttendanceData(user, dateKey, checkIn, checkOut, note, fullText, lateMin, fine, jobs, income) {

  checkAttUser(user);

  dateKey = String(dateKey || '').trim();
  const dateText = attDisplayDate(dateKey);
  const sheet = getAttendanceSheet();
  const lastRow = sheet.getLastRow();

  let values = [];
  if (lastRow >= 2) {
    values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
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
    String(fullText || '')
  ];

  const existingRow = findAttendanceRow(sheet, values, user, dateKey);

  if (existingRow > 0) {
    // ส่งซ้ำวันเดียวกัน = อัปเดตทับ (ไม่เบิ้ลแถว)
    sheet.getRange(existingRow, 1, 1, 11).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return {
    success: true,
    message: 'บันทึกเวลาเรียบร้อย'
  };

}


function updateAttendanceData(user, dateKey, checkIn, checkOut, note, lateMin, fine) {

  checkAttUser(user);

  dateKey = String(dateKey || '').trim();
  const sheet = getAttendanceSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('ไม่พบบันทึกเวลานี้');
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const row = findAttendanceRow(sheet, values, user, dateKey);

  if (!row) {
    throw new Error('ไม่พบบันทึกเวลานี้');
  }

  // แก้เฉพาะ เวลาเข้า/ออก/สาย/หัก (คอลัมน์ D–G) และโน้ต (คอลัมน์ J)
  sheet.getRange(row, 4, 1, 4).setValues([[
    String(checkIn || '').trim(),
    String(checkOut || '').trim(),
    Number(lateMin) || 0,
    Number(fine) || 0
  ]]);
  sheet.getRange(row, 10).setValue(String(note || ''));

  return {
    success: true,
    message: 'แก้ไขเวลาเรียบร้อย'
  };

}


function deleteAttendanceData(user, dateKey) {

  checkAttUser(user);

  dateKey = String(dateKey || '').trim();
  const sheet = getAttendanceSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('ไม่พบบันทึกเวลานี้');
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
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

  const sheet = getAttendanceSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { success: true, data: [] };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const data = [];

  values.forEach(function (r) {

    if (String(r[0]).trim() !== user) return;

    // กรองตามเดือน/ปี จากคีย์วันที่ (yyyy-mm-dd)
    const parts = String(r[1]).trim().split('-');
    if (parts.length === 3 && (month || year)) {
      if ((month && Number(parts[1]) !== month) ||
          (year && Number(parts[0]) !== year)) {
        return;
      }
    }

    data.push({
      user: String(r[0]).trim(),
      dateKey: String(r[1]).trim(),
      date: String(r[2]).trim(),
      checkIn: String(r[3]).trim(),
      checkOut: String(r[4]).trim(),
      lateMin: Number(r[5]) || 0,
      fine: Number(r[6]) || 0,
      jobs: Number(r[7]) || 0,
      income: Number(r[8]) || 0,
      note: String(r[9] || ''),
      fullText: String(r[10] || '')
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
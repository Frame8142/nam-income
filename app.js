/* ==================================================
       CONFIG
    ================================================== */

const API_URL = 'https://script.google.com/macros/s/AKfycbzaFbh06fHyztZPrkuKRDsNBLy_oMZdiWuDfKyybxFjEOGI1Ggj8Z8U64dlOJ0DokHU/exec';

const COMMISSION_RATE = 0.10;

// Multi-user
let currentUser = '';
const USER_NAMES = {
  'nam': { thai: 'น้ำ', emoji: '💚' },
  'mook': { thai: 'มุก', emoji: '💜' }
};

let services = [];
let selectedServices = [];
let historyData = [];

// History month filter state
let historyFilterMonth = new Date().getMonth();
let historyFilterYear = new Date().getFullYear();

// PWA install
let deferredInstallPrompt = null;


/* ==================================================
   API HELPER — fetch wrapper
================================================== */

async function apiGet(action, extraParams) {

  let url = API_URL + '?action=' + encodeURIComponent(action) + '&_t=' + Date.now();

  if (currentUser) {
    url += '&user=' + encodeURIComponent(currentUser);
  }

  if (extraParams) {
    Object.keys(extraParams).forEach(function (key) {
      url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(extraParams[key]);
    });
  }

  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  }

  return response.json();

}


async function apiPost(body) {

  // Auto-inject current user
  if (currentUser && !body.user) {
    body.user = currentUser;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  }

  return response.json();

}


/* ==================================================
   OFFLINE DETECTION
================================================== */

function updateOnlineStatus() {

  const bar = document.getElementById('offlineBar');

  if (!navigator.onLine) {
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
    // Auto-sync offline queue when back online
    syncOfflineQueue();
  }

}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);


/* ==================================================
   LOAD SERVICES
================================================== */

async function loadServices() {

  renderServiceSkeleton();

  try {

    const result = await apiGet('list');

    services = (result && result.data) || [];

    renderServices();
    renderManage();
    populateCategorySelect(
      document.getElementById('newServiceCategory')
    );

  } catch (error) {

    showToast('โหลดรายการไม่สำเร็จ 🙀');

  }

}


function renderServiceSkeleton() {

  const grid = document.getElementById('serviceGrid');

  grid.innerHTML = '';

  for (let i = 0; i < 6; i++) {

    const sk = document.createElement('div');
    sk.className = 'skeleton skeleton-btn';
    grid.appendChild(sk);

  }

}


/* ==================================================
   USAGE FREQUENCY
================================================== */

function getServiceCounts() {

  try {
    return JSON.parse(
      localStorage.getItem('serviceCounts') || '{}'
    );
  } catch (e) {
    return {};
  }

}


function bumpServiceCounts(items) {

  const counts = getServiceCounts();

  items.forEach(function (name) {
    counts[name] = (counts[name] || 0) + 1;
  });

  try {
    localStorage.setItem(
      'serviceCounts',
      JSON.stringify(counts)
    );
  } catch (e) { }

}


/* ==================================================
   SERVICE BUTTONS
================================================== */

function renderServices() {

  const container = document.getElementById('serviceGrid');
  container.innerHTML = '';

  const counts = getServiceCounts();

  const categoryOrder = [];
  const grouped = {};

  services.forEach(function (item) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
      categoryOrder.push(item.category);
    }
    grouped[item.category].push(item.name);
  });

  categoryOrder.forEach(function (category) {

    const names = grouped[category].slice().sort(function (a, b) {
      return (counts[b] || 0) - (counts[a] || 0);
    });

    const group = document.createElement('div');
    group.className = 'service-category';

    const labelEl = document.createElement('div');
    labelEl.className = 'service-category-label';
    labelEl.innerText = category;
    group.appendChild(labelEl);

    const grid = document.createElement('div');
    grid.className = 'service-grid';

    names.forEach(function (name) {

      const button = document.createElement('button');
      button.className = 'service-btn';

      if (selectedServices.includes(name)) {
        button.classList.add('selected');
      }

      button.innerText = name;
      button.onclick = function () {
        toggleService(name);
      };

      grid.appendChild(button);

    });

    group.appendChild(grid);
    container.appendChild(group);

  });

}


function toggleService(service) {

  const index = selectedServices.indexOf(service);

  if (index === -1) {
    selectedServices.push(service);
  } else {
    selectedServices.splice(index, 1);
  }

  renderServices();
  updateSelected();

}


function updateSelected() {

  const box = document.getElementById('selectedBox');
  const text = document.getElementById('selectedText');
  const effective = getEffectiveServices();

  if (effective.length === 0) {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';
  text.innerText = effective.join(' + ');

}


function getEffectiveServices() {

  const customValue = document
    .getElementById('customServiceInput')
    .value
    .trim();

  const combined = selectedServices.slice();

  if (customValue && !combined.includes(customValue)) {
    combined.push(customValue);
  }

  return combined;

}


/* ==================================================
   COMMISSION
================================================== */

function calculateCommission() {

  const price = Number(
    document.getElementById('priceInput').value
  ) || 0;

  const commission = price * COMMISSION_RATE;

  document.getElementById('commissionPreview').innerText =
    '🎀 Commission 10% = ' + money(commission);

}


/* ==================================================
   SAVE
================================================== */

async function saveData() {

  const effectiveServices = getEffectiveServices();

  if (effectiveServices.length === 0) {
    showToast('เลือกหรือพิมพ์บริการก่อนนะ 🐱');
    return;
  }

  const price = Number(
    document.getElementById('priceInput').value
  );

  if (isNaN(price) || price < 0) {
    showToast('กรุณาใส่ราคาที่ลูกค้าจ่าย 💰');
    return;
  }

  const item = effectiveServices.join('+');
  const backdateDate = getBackdateValue();

  if (backdateDate && backdateDate > todayInputValue()) {
    showToast('เลือกวันในอนาคตไม่ได้ 🚫');
    return;
  }

  if (price > 2500) {
    showConfirmDialog(
      '⚠️ ยืนยันราคา',
      'ราคา ' + money(price) + ' สูงกว่าปกตินะ ยืนยันบันทึกไหม?',
      function () {
        doActualSave(item, price, backdateDate);
      }
    );
    return;
  }

  doActualSave(item, price, backdateDate);

}


async function doActualSave(item, price, backdateDate) {

  const btn = document.getElementById('saveBtn');

  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> กำลังบันทึก...';

  const itemsForCounting = getEffectiveServices();

  try {

    const result = await apiPost({
      action: 'save',
      item: item,
      price: price,
      customDate: backdateDate || ''
    });

    btn.disabled = false;
    btn.innerText = '✅ บันทึกรายการ';

    if (result && result.success) {

      bumpServiceCounts(itemsForCounting);

      showSuccessPopup(
        backdateDate
          ? 'บันทึกย้อนหลังเรียบร้อยแล้ว ✅'
          : 'บันทึกเรียบร้อยแล้ว ✅'
      );

      pawConfetti();

      selectedServices = [];
      document.getElementById('customServiceInput').value = '';
      renderServices();
      updateSelected();

      document.getElementById('priceInput').value = '';
      calculateCommission();
      resetBackdate();

      // อัปเดตรายได้ร้านรวมหน้า Login
      loadCombinedSummary();

    } else {

      showToast(result.message || 'เกิดข้อผิดพลาด');

    }

  } catch (error) {

    btn.disabled = false;
    btn.innerText = '✅ บันทึกรายการ';

    // ===== OFFLINE QUEUE =====
    // If network error, save to offline queue
    if (!navigator.onLine || error.message === 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้') {

      addToOfflineQueue({
        item: item,
        price: price,
        customDate: backdateDate || '',
        savedAt: new Date().toISOString()
      });

      bumpServiceCounts(itemsForCounting);

      showSuccessPopup('บันทึกไว้ในเครื่อง 📴 จะส่งเมื่อมีเน็ต');

      selectedServices = [];
      document.getElementById('customServiceInput').value = '';
      renderServices();
      updateSelected();

      document.getElementById('priceInput').value = '';
      calculateCommission();
      resetBackdate();

      renderPendingBanner();

    } else {
      showToast(error.message || 'บันทึกไม่สำเร็จ 🙀');
    }

  }

}


/* ==================================================
   OFFLINE QUEUE
================================================== */

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem('offlineQueue') || '[]');
  } catch (e) {
    return [];
  }
}


function addToOfflineQueue(entry) {
  const queue = getOfflineQueue();
  queue.push(entry);
  try {
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
  } catch (e) { }
}


function renderPendingBanner() {

  const queue = getOfflineQueue();
  const banner = document.getElementById('pendingBanner');
  const title = document.getElementById('pendingTitle');
  const sub = document.getElementById('pendingSub');
  const badge = document.getElementById('pendingBadge');

  if (queue.length > 0) {
    banner.classList.add('show');
    title.innerText = '📴 มี ' + queue.length + ' รายการรอส่ง';
    sub.innerText = navigator.onLine
      ? 'กดปุ่มเพื่อส่งข้อมูลไป Google Sheet'
      : 'จะส่งอัตโนมัติเมื่อมีเน็ต';

    if (badge) {
      badge.innerText = queue.length;
      badge.classList.add('show');
    }
  } else {
    banner.classList.remove('show');
    if (badge) {
      badge.classList.remove('show');
    }
  }

}


async function syncOfflineQueue() {

  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  if (!navigator.onLine) {
    showToast('ยังไม่มีเน็ต รอสักครู่นะ 📴');
    return;
  }

  showToast('กำลังส่งข้อมูล ' + queue.length + ' รายการ... ⏳');

  let successCount = 0;
  const failedItems = [];

  for (let i = 0; i < queue.length; i++) {

    const entry = queue[i];

    try {

      const result = await apiPost({
        action: 'save',
        item: entry.item,
        price: entry.price,
        customDate: entry.customDate || ''
      });

      if (result && result.success) {
        successCount++;
      } else {
        failedItems.push(entry);
      }

    } catch (err) {
      failedItems.push(entry);
    }

  }

  // Update queue with only failed items
  try {
    localStorage.setItem('offlineQueue', JSON.stringify(failedItems));
  } catch (e) { }

  renderPendingBanner();

  if (successCount > 0 && failedItems.length === 0) {
    showSuccessPopup('ซิงค์ข้อมูล ' + successCount + ' รายการเรียบร้อย ✅');
    pawConfetti();
    loadCombinedSummary();
  } else if (successCount > 0) {
    showToast('ส่งได้ ' + successCount + ' รายการ · เหลืออีก ' + failedItems.length + ' รายการ');
    loadCombinedSummary();
  } else {
    showToast('ส่งข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง 🙀');
  }

}


/* ==================================================
   BACKDATE
================================================== */

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];


function todayInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}


function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}


function initBackdateSelectors() {

  const now = new Date();
  const currentYearCE = now.getFullYear();

  const daySelect = document.getElementById('backdateDay');
  const monthSelect = document.getElementById('backdateMonth');
  const yearSelect = document.getElementById('backdateYear');

  daySelect.innerHTML = '<option value="">วัน</option>';
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.innerText = d;
    daySelect.appendChild(opt);
  }

  monthSelect.innerHTML = '<option value="">เดือน</option>';
  THAI_MONTHS.forEach(function (name, index) {
    const opt = document.createElement('option');
    opt.value = index + 1;
    opt.innerText = name;
    monthSelect.appendChild(opt);
  });

  yearSelect.innerHTML = '<option value="">ปี</option>';
  for (let i = 0; i <= 2; i++) {
    const yearCE = currentYearCE - i;
    const opt = document.createElement('option');
    opt.value = yearCE;
    opt.innerText = yearCE + 543;
    yearSelect.appendChild(opt);
  }

  daySelect.onchange = clampBackdateDay;
  monthSelect.onchange = clampBackdateDay;
  yearSelect.onchange = clampBackdateDay;

}


function clampBackdateDay() {

  const daySelect = document.getElementById('backdateDay');
  const monthSelect = document.getElementById('backdateMonth');
  const yearSelect = document.getElementById('backdateYear');

  const month = Number(monthSelect.value);
  const year = Number(yearSelect.value) || new Date().getFullYear();

  if (!month) return;

  const maxDay = daysInMonth(year, month);
  const selectedDay = Number(daySelect.value);

  if (selectedDay && selectedDay > maxDay) {
    daySelect.value = maxDay;
  }

}


function getBackdateValue() {

  const day = document.getElementById('backdateDay').value;
  const month = document.getElementById('backdateMonth').value;
  const year = document.getElementById('backdateYear').value;

  if (!day || !month || !year) return '';

  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');

}


function toggleBackdate() {

  const fields = document.getElementById('backdateFields');
  const arrow = document.getElementById('backdateArrow');
  fields.classList.toggle('open');
  arrow.classList.toggle('open');

}


function resetBackdate() {

  document.getElementById('backdateDay').value = '';
  document.getElementById('backdateMonth').value = '';
  document.getElementById('backdateYear').value = '';
  document.getElementById('backdateFields').classList.remove('open');
  document.getElementById('backdateArrow').classList.remove('open');

}


/* ==================================================
   PAW CONFETTI
================================================== */

function pawConfetti() {

  const count = 10;

  for (let i = 0; i < count; i++) {

    const paw = document.createElement('div');
    paw.className = 'paw-confetti';
    paw.innerText = '🐾';
    paw.style.left = (Math.random() * 90 + 5) + 'vw';
    paw.style.animationDelay = (Math.random() * .3) + 's';
    document.body.appendChild(paw);

    setTimeout(function () {
      paw.remove();
    }, 1400);

  }

}


/* ==================================================
   MODAL POPUPS
================================================== */

function showSuccessPopup(message) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  box.innerHTML =
    '<div class="modal-icon">🐾✅</div>' +
    '<div class="modal-title">' + escapeHtml(message) + '</div>';

  overlay.classList.add('show');

  clearTimeout(window._popupTimer);
  window._popupTimer = setTimeout(function () {
    overlay.classList.remove('show');
  }, 1800);

}


function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}


function showConfirmDialog(title, text, onConfirm) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  box.innerHTML =
    '<div class="modal-icon">🤔</div>' +
    '<div class="modal-title">' + escapeHtml(title) + '</div>' +
    '<div class="modal-text">' + escapeHtml(text) + '</div>' +
    '<div class="modal-actions">' +
    '<button class="modal-btn cancel" id="modalCancelBtn">ยกเลิก</button>' +
    '<button class="modal-btn ok" id="modalOkBtn">ยืนยัน</button>' +
    '</div>';

  overlay.classList.add('show');

  document.getElementById('modalCancelBtn').onclick = closeModal;
  document.getElementById('modalOkBtn').onclick = function () {
    closeModal();
    onConfirm();
  };

}


function showEditDialog(row, currentItem, currentPrice) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  box.innerHTML =
    '<div class="modal-icon">✏️</div>' +
    '<div class="modal-title">แก้ไขรายการ</div>' +
    '<input id="editItemInput" class="modal-input" value="' + escapeHtml(currentItem) + '">' +
    '<input id="editPriceInput" class="modal-input" type="number" inputmode="decimal" value="' + currentPrice + '">' +
    '<div class="modal-actions">' +
    '<button class="modal-btn cancel" id="modalCancelBtn">ยกเลิก</button>' +
    '<button class="modal-btn ok" id="modalOkBtn">บันทึก</button>' +
    '</div>';

  overlay.classList.add('show');

  document.getElementById('modalCancelBtn').onclick = closeModal;

  document.getElementById('modalOkBtn').onclick = function () {

    const newItem = document.getElementById('editItemInput').value.trim();
    const newPrice = Number(document.getElementById('editPriceInput').value);

    if (!newItem) {
      showToast('กรุณาใส่ชื่อรายการ 🐾');
      return;
    }

    if (isNaN(newPrice) || newPrice < 0) {
      showToast('ราคาต้องเป็นตัวเลข');
      return;
    }

    closeModal();
    updateHistoryRow(row, newItem, newPrice);

  };

}


async function updateHistoryRow(row, item, price) {

  try {

    const result = await apiPost({
      action: 'update',
      rowIndex: row,
      item: item,
      price: price
    });

    if (result && result.success) {
      showToast('แก้ไขรายการเรียบร้อย ✏️');
      loadSummary();
    } else {
      showToast(result.message || 'แก้ไขไม่สำเร็จ');
    }

  } catch (error) {
    showToast(error.message || 'แก้ไขไม่สำเร็จ');
  }

}


function deleteHistoryRow(row) {

  showConfirmDialog(
    '🗑️ ลบรายการ',
    'ต้องการลบรายการนี้ใช่ไหม?',
    async function () {

      try {

        const result = await apiPost({
          action: 'delete',
          rowIndex: row
        });

        if (result && result.success) {
          showToast('ลบรายการแล้ว 🗑️');
          loadSummary();
        } else {
          showToast(result.message || 'ลบไม่สำเร็จ');
        }

      } catch (error) {
        showToast(error.message || 'ลบไม่สำเร็จ');
      }

    }
  );

}


/* ==================================================
   LOAD HISTORY
================================================== */

async function loadSummary() {

  renderSummarySkeleton();

  try {

    const result = await apiGet('history');

    if (result && result.success) {
      historyData = result.data || [];
      renderSummary();
    }

  } catch (error) {
    showToast('โหลดข้อมูลไม่สำเร็จ 🙀');
  }

}


function renderSummarySkeleton() {

  const chart = document.getElementById('weekChart');
  chart.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const bar = document.createElement('div');
    bar.className = 'skeleton';
    bar.style.cssText = 'width:11%;height:' + (40 + Math.random() * 110) + 'px;border-radius:12px;';
    chart.appendChild(bar);
  }

  const hist = document.getElementById('historyList');
  hist.innerHTML =
    '<div class="skeleton skeleton-history"></div>' +
    '<div class="skeleton skeleton-history"></div>' +
    '<div class="skeleton skeleton-history"></div>';

}


/* ==================================================
   SUMMARY
================================================== */

function renderSummary() {

  const now = new Date();
  const today = dateKey(now);
  const currentWeek = getWeekRange(now);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let todayIncome = 0;
  let todayCommission = 0;
  let todayJobs = 0;

  let monthIncome = 0;
  let monthCommission = 0;
  let monthJobs = 0;

  historyData.forEach(function (row) {

    const d = parseRowDate(row);
    if (!d) return;

    const key = dateKey(d);

    if (key === today) {
      todayIncome += Number(row.price) || 0;
      todayCommission += Number(row.commission) || 0;
      todayJobs++;
    }

    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      monthIncome += Number(row.price) || 0;
      monthCommission += Number(row.commission) || 0;
      monthJobs++;
    }

  });

  document.getElementById('todayIncome').innerText = money(todayIncome);
  document.getElementById('todayMood').innerText =
    todayJobs > 0
      ? '😻 เก่งมาก วันนี้มีลูกค้าแล้ว!'
      : '😺 วันนี้ยังไม่มีรายการ';
  document.getElementById('todayCommission').innerText = money(todayCommission);
  document.getElementById('todayJobs').innerText = todayJobs + ' รายการ';

  document.getElementById('monthIncome').innerText = money(monthIncome);
  document.getElementById('monthCommission').innerText = money(monthCommission);
  document.getElementById('monthJobs').innerText = monthJobs;

  renderMonthCompare(monthIncome, currentMonth, currentYear);
  renderWeekChart(currentWeek.start, currentWeek.end);

  // New feature renderers
  renderIncomeCalendar(currentMonth, currentYear);

  renderHistory();

}


/* ==================================================
   MONTH COMPARISON
================================================== */

function renderMonthCompare(monthIncome, currentMonth, currentYear) {

  let prevMonth = currentMonth - 1;
  let prevMonthYear = currentYear;

  if (prevMonth < 0) {
    prevMonth = 11;
    prevMonthYear = currentYear - 1;
  }

  let prevMonthIncome = 0;

  historyData.forEach(function (row) {
    const d = parseRowDate(row);
    if (!d) return;

    if (d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear) {
      prevMonthIncome += Number(row.price) || 0;
    }
  });

  const el = document.getElementById('monthCompare');

  if (prevMonthIncome > 0) {

    const diffPercent = ((monthIncome - prevMonthIncome) / prevMonthIncome) * 100;
    const sign = diffPercent >= 0 ? '+' : '';

    el.classList.toggle('down', diffPercent < 0);
    el.innerText =
      (diffPercent >= 0 ? '📈 ' : '📉 ') +
      sign + diffPercent.toFixed(0) + '% จากเดือนที่แล้ว';

  } else if (monthIncome > 0) {
    el.classList.remove('down');
    el.innerText = '🎉 เริ่มต้นเดือนนี้ได้ดี!';
  } else {
    el.classList.remove('down');
    el.innerText = '';
  }

}


/* ==================================================
   WEEK RANGE
================================================== */

function getWeekRange(date) {

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  const start = new Date(d);
  start.setDate(d.getDate() + diff);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start: start, end: end };

}


/* ==================================================
   WEEK CHART
================================================== */

function renderWeekChart(start, end) {

  const container = document.getElementById('weekChart');
  container.innerHTML = '';

  const days = [];

  for (let i = 0; i < 7; i++) {

    const d = new Date(start);
    d.setDate(start.getDate() + i);

    let income = 0;
    let commission = 0;

    historyData.forEach(function (row) {
      const rowDate = parseRowDate(row);
      if (rowDate && dateKey(rowDate) === dateKey(d)) {
        income += Number(row.price) || 0;
        commission += Number(row.commission) || 0;
      }
    });

    days.push({
      date: d,
      income: income,
      commission: commission
    });

  }

  const max = Math.max(
    ...days.map(function (d) { return d.income; }),
    1
  );

  const weekCommissionTotal = days.reduce(function (sum, day) {
    return sum + day.commission;
  }, 0);

  days.forEach(function (day) {

    const wrapper = document.createElement('div');
    wrapper.className = 'chart-day';

    const barArea = document.createElement('div');
    barArea.className = 'bar-area';

    const bar = document.createElement('div');
    bar.className = 'bar';

    const height = day.income === 0
      ? 3
      : Math.max(8, (day.income / max) * 140);

    bar.style.height = height + 'px';

    bar.title = money(day.income) + ' (Commission ' + money(day.commission) + ')';

    const commissionRatio = day.income > 0 ? day.commission / day.income : 0;

    const commissionSegment = document.createElement('div');
    commissionSegment.className = 'bar-segment-commission';
    commissionSegment.style.height = Math.round(height * commissionRatio) + 'px';

    const incomeSegment = document.createElement('div');
    incomeSegment.className = 'bar-segment-income';

    bar.appendChild(commissionSegment);
    bar.appendChild(incomeSegment);
    barArea.appendChild(bar);

    if (day.income > 0 && day.income === max) {
      const star = document.createElement('div');
      star.className = 'best-day-star';
      star.innerText = '⭐';
      barArea.appendChild(star);
    }

    const moneyText = document.createElement('div');
    moneyText.className = 'day-money';
    moneyText.innerText = day.income > 0 ? moneyShort(day.income) : '';

    const label = document.createElement('div');
    label.className = 'day-label';
    label.innerText = thaiDay(day.date);

    wrapper.appendChild(barArea);
    wrapper.appendChild(moneyText);
    wrapper.appendChild(label);
    container.appendChild(wrapper);

  });

  const total = days.reduce(function (sum, day) {
    return sum + day.income;
  }, 0);

  document.getElementById('weekTotal').innerText =
    '🐾 รวมสัปดาห์นี้ ' + money(total) +
    ' · 🪙 Commission ' + money(weekCommissionTotal);

}


/* ==================================================
   INCOME CALENDAR (Contribution Graph)
================================================== */
function renderIncomeCalendar(currentMonth, currentYear) {

  const container = document.getElementById('incomeCalendar');
  const card = document.getElementById('calendarCard');

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  if (historyData.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  let html = '<div class="calendar-grid">';
  const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  days.forEach(function (day) {
    html += '<div class="calendar-day-label">' + day + '</div>';
  });

  // Pad empty cells before 1st day
  for (let i = 0; i < firstDay.getDay(); i++) {
    html += '<div class="calendar-cell empty"></div>';
  }

  // Group income by day
  const dailyIncome = {};
  let maxIncome = 0;

  historyData.forEach(function (row) {
    const d = parseRowDate(row);
    if (d && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      const date = d.getDate();
      dailyIncome[date] = (dailyIncome[date] || 0) + (Number(row.price) || 0);
      if (dailyIncome[date] > maxIncome) maxIncome = dailyIncome[date];
    }
  });

  // Create cells
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const income = dailyIncome[i] || 0;
    let level = 0;

    if (income > 0) {
      if (income < maxIncome * 0.25) level = 1;
      else if (income < maxIncome * 0.5) level = 2;
      else if (income < maxIncome * 0.75) level = 3;
      else level = 4;
    }

    html +=
      '<div class="calendar-cell level-' + level + (income > 0 ? ' has-date' : '') + '" ' +
      'onclick="changeHistoryMonthTo(' + currentMonth + ',' + currentYear + '); highlightHistoryDay(' + i + ')">' +
      '<span class="calendar-day-num">' + i + '</span>' +
      (income > 0 ? '<span class="calendar-day-amount">' + moneyShort(income) + '</span>' : '') +
      (income > 0 ? '<div class="calendar-tooltip">' + i + ' ' + THAI_MONTHS[currentMonth] + ': ' + money(income) + '</div>' : '') +
      '</div>';
  }

  html += '</div>';
  container.innerHTML = html;

}

// Helper to highlight a specific day in history list
window.highlightHistoryDay = function (day) {
  setTimeout(function () {
    const dayHeaders = Array.from(document.querySelectorAll('.history-day-header'));
    // Find header matching day (e.g. "5 กันยายน" or "15 กันยายน")
    const dayStr = day.toString() + ' ';
    const dayHeader = dayHeaders.find(function (el) {
      // Match at beginning or after a space to avoid matching 15 when looking for 5
      return el.innerText.indexOf(dayStr) === 0 || el.innerText.indexOf(' ' + dayStr) > -1;
    });

    if (dayHeader) {
      dayHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const parent = dayHeader.parentElement;
      if (parent) {
        parent.style.transition = 'background 0.5s';
        parent.style.background = 'rgba(238, 124, 149, 0.2)'; // pink-light with opacity
        setTimeout(function () {
          parent.style.background = 'transparent';
        }, 1000);
      }
    }
  }, 100);
};

// Helper to jump to a specific month in history filter
window.changeHistoryMonthTo = function (m, y) {
  historyFilterMonth = m;
  historyFilterYear = y;
  renderHistory();
};




/* ==================================================
   HISTORY BY DAY — filtered by month
================================================== */

function renderHistory() {

  const container = document.getElementById('historyList');
  container.innerHTML = '';

  // Update month label
  updateHistoryMonthLabel();

  if (historyData.length === 0) {
    container.innerHTML =
      '<div class="card empty-state">' +
      '<div class="empty-cat">😴🐱</div>' +
      'ยังไม่มีรายการ' +
      '<small>เริ่มบันทึกรายการแรกกันเถอะ 🐾</small>' +
      '</div>';
    return;
  }

  // Filter by selected month/year
  const filteredData = historyData.filter(function (row) {
    const d = parseRowDate(row);
    if (!d) return false;
    return d.getMonth() === historyFilterMonth && d.getFullYear() === historyFilterYear;
  });

  if (filteredData.length === 0) {
    container.innerHTML =
      '<div class="card empty-state">' +
      '<div class="empty-cat">😿</div>' +
      'เดือนนี้ยังไม่มีรายการ' +
      '<small>ลองเลือกเดือนอื่นดูนะ 🐾</small>' +
      '</div>';
    return;
  }

  const groups = {};

  filteredData.forEach(function (row) {
    const d = parseRowDate(row);
    if (!d) return;

    const key = dateKey(d);

    if (!groups[key]) {
      groups[key] = { date: d, rows: [] };
    }

    groups[key].rows.push(row);
  });

  const keys = Object.keys(groups).sort().reverse();

  // Show hint
  const hintEl = document.getElementById('historyFilterHint');
  hintEl.innerText = '🐾 ' + filteredData.length + ' รายการในเดือนนี้';

  keys.forEach(function (key) {

    const group = groups[key];

    let totalIncome = 0;
    let totalCommission = 0;

    group.rows.forEach(function (row) {
      totalIncome += Number(row.price) || 0;
      totalCommission += Number(row.commission) || 0;
    });

    const dayDiv = document.createElement('div');
    dayDiv.className = 'history-day';

    const header = document.createElement('div');
    header.className = 'history-day-header';

    header.innerHTML =
      '🐾 ' + thaiDate(group.date) +
      '<div class="history-day-total">' +
      group.rows.length + ' รายการ · ' +
      'รายได้ ' + money(totalIncome) +
      ' · Commission ' + money(totalCommission) +
      '</div>';

    dayDiv.appendChild(header);

    group.rows.slice().reverse().forEach(function (row) {

      const item = document.createElement('div');
      item.className = 'history-item';

      item.innerHTML =
        '<div class="history-time">' + escapeHtml(row.time) + '</div>' +
        '<div class="history-name">' + escapeHtml(row.item) + '</div>' +
        '<div class="history-money">' +
        '<span>ลูกค้าจ่าย <b>' + money(row.price) + '</b></span>' +
        '<span class="history-commission">+' + money(row.commission) + '</span>' +
        '</div>' +
        '<div class="history-actions">' +
        '<button class="history-action-btn edit">✏️ แก้ไข</button>' +
        '<button class="history-action-btn delete">🗑️ ลบ</button>' +
        '</div>';

      if (row.row) {
        item.querySelector('.edit').onclick = function () {
          showEditDialog(row.row, row.item, row.price);
        };
        item.querySelector('.delete').onclick = function () {
          deleteHistoryRow(row.row);
        };
      }

      dayDiv.appendChild(item);

    });

    container.appendChild(dayDiv);

  });

}


/* ==================================================
   HISTORY MONTH NAVIGATION
================================================== */

function changeHistoryMonth(direction) {

  historyFilterMonth += direction;

  if (historyFilterMonth > 11) {
    historyFilterMonth = 0;
    historyFilterYear++;
  } else if (historyFilterMonth < 0) {
    historyFilterMonth = 11;
    historyFilterYear--;
  }

  // Don't allow going into the future
  const now = new Date();
  if (historyFilterYear > now.getFullYear() ||
    (historyFilterYear === now.getFullYear() && historyFilterMonth > now.getMonth())) {
    historyFilterMonth = now.getMonth();
    historyFilterYear = now.getFullYear();
    return;
  }

  renderHistory();

}


function updateHistoryMonthLabel() {

  const label = document.getElementById('historyMonthLabel');
  const now = new Date();

  if (historyFilterMonth === now.getMonth() && historyFilterYear === now.getFullYear()) {
    label.innerText = '📅 เดือนนี้ — ' + THAI_MONTHS[historyFilterMonth] + ' ' + (historyFilterYear + 543);
  } else {
    label.innerText = '📅 ' + THAI_MONTHS[historyFilterMonth] + ' ' + (historyFilterYear + 543);
  }

}


/* ==================================================
   CATEGORY DROPDOWN
================================================== */

function populateCategorySelect(selectEl, selectedValue) {

  const categories = Array.from(
    new Set(
      services.map(function (s) { return s.category; })
    )
  );

  if (categories.length === 0) {
    categories.push('อื่นๆ');
  }

  selectEl.innerHTML = '';

  categories.forEach(function (cat) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.innerText = cat;
    selectEl.appendChild(opt);
  });

  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.innerText = '➕ เพิ่มหมวดหมู่ใหม่';
  selectEl.appendChild(newOpt);

  if (selectedValue && categories.includes(selectedValue)) {
    selectEl.value = selectedValue;
  }

  selectEl.onchange = function () {
    const wrap =
      selectEl.id === 'newServiceCategory'
        ? document.getElementById('newCategoryInput')
        : document.getElementById('editServiceNewCategory');
    if (wrap) {
      wrap.style.display = this.value === '__new__' ? 'block' : 'none';
    }
  };

}


/* ==================================================
   MANAGE SERVICES
================================================== */

function renderManage() {

  const container = document.getElementById('manageList');
  container.innerHTML = '';

  if (services.length === 0) {
    container.innerHTML =
      '<div class="card empty-state">' +
      '<div class="empty-cat">😴🐱</div>' +
      'ยังไม่มีบริการ' +
      '<small>เพิ่มบริการแรกกันเถอะ 🐾</small>' +
      '</div>';
    return;
  }

  const categoryOrder = [];
  const grouped = {};

  services.forEach(function (item) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
      categoryOrder.push(item.category);
    }
    grouped[item.category].push(item);
  });

  categoryOrder.forEach(function (category) {

    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('div');
    title.className = 'title';
    title.innerText = category;
    card.appendChild(title);

    grouped[category].forEach(function (item) {

      const div = document.createElement('div');
      div.className = 'manage-item';

      div.innerHTML =
        '<span class="manage-item-name">' + escapeHtml(item.name) + '</span>' +
        '<div class="manage-item-actions">' +
        '<button class="history-action-btn edit">✏️</button>' +
        '<button class="history-action-btn delete">🗑️</button>' +
        '</div>';

      div.querySelector('.edit').onclick = function () {
        showEditServiceDialog(item);
      };

      div.querySelector('.delete').onclick = function () {
        deleteServiceItem(item);
      };

      card.appendChild(div);

    });

    container.appendChild(card);

  });

}


async function addServiceAction() {

  const nameInput = document.getElementById('newServiceName');
  const categorySelect = document.getElementById('newServiceCategory');
  const newCategoryInput = document.getElementById('newCategoryInput');

  const name = nameInput.value.trim();

  if (!name) {
    showToast('กรุณาใส่ชื่อบริการ 🐾');
    return;
  }

  let category = categorySelect.value;

  if (category === '__new__') {
    category = newCategoryInput.value.trim();
    if (!category) {
      showToast('กรุณาใส่ชื่อหมวดหมู่ใหม่ 🐾');
      return;
    }
  }

  try {

    const result = await apiPost({
      action: 'addService',
      name: name,
      category: category
    });

    if (result.success) {
      nameInput.value = '';
      newCategoryInput.value = '';
      newCategoryInput.style.display = 'none';
      showToast('เพิ่มบริการเรียบร้อย 🐾✨');
      loadServices();
    } else {
      showToast(result.message);
    }

  } catch (error) {
    showToast(error.message || 'เพิ่มบริการไม่สำเร็จ');
  }

}


function showEditServiceDialog(item) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  const categories = Array.from(
    new Set(
      services.map(function (s) { return s.category; })
    )
  );

  let optionsHtml = categories.map(function (cat) {
    return '<option value="' + escapeHtml(cat) + '"' +
      (cat === item.category ? ' selected' : '') +
      '>' + escapeHtml(cat) + '</option>';
  }).join('');

  optionsHtml += '<option value="__new__">➕ เพิ่มหมวดหมู่ใหม่</option>';

  box.innerHTML =
    '<div class="modal-icon">✏️</div>' +
    '<div class="modal-title">แก้ไขบริการ</div>' +
    '<input id="editServiceName" class="modal-input" value="' + escapeHtml(item.name) + '">' +
    '<select id="editServiceCategory" class="thai-date-select" style="width:100%;margin-bottom:10px;">' + optionsHtml + '</select>' +
    '<input id="editServiceNewCategory" class="modal-input" placeholder="ชื่อหมวดหมู่ใหม่" style="display:none;">' +
    '<div class="modal-actions">' +
    '<button class="modal-btn cancel" id="modalCancelBtn">ยกเลิก</button>' +
    '<button class="modal-btn ok" id="modalOkBtn">บันทึก</button>' +
    '</div>';

  overlay.classList.add('show');

  document.getElementById('editServiceCategory').onchange = function () {
    document.getElementById('editServiceNewCategory').style.display =
      this.value === '__new__' ? 'block' : 'none';
  };

  document.getElementById('modalCancelBtn').onclick = closeModal;

  document.getElementById('modalOkBtn').onclick = async function () {

    const newName = document.getElementById('editServiceName').value.trim();
    let newCategory = document.getElementById('editServiceCategory').value;

    if (newCategory === '__new__') {
      newCategory = document.getElementById('editServiceNewCategory').value.trim();
    }

    if (!newName) {
      showToast('กรุณาใส่ชื่อบริการ 🐾');
      return;
    }

    if (!newCategory) {
      showToast('กรุณาใส่ชื่อหมวดหมู่ 🐾');
      return;
    }

    closeModal();

    try {

      const result = await apiPost({
        action: 'updateService',
        rowIndex: item.row,
        name: newName,
        category: newCategory
      });

      if (result.success) {
        showToast('แก้ไขบริการเรียบร้อย ✏️');
        loadServices();
      } else {
        showToast(result.message);
      }

    } catch (error) {
      showToast(error.message || 'แก้ไขไม่สำเร็จ');
    }

  };

}


function deleteServiceItem(item) {

  showConfirmDialog(
    '🗑️ ลบบริการ',
    'ต้องการลบ "' + item.name + '" ใช่ไหม?',
    async function () {

      try {

        const result = await apiPost({
          action: 'deleteService',
          rowIndex: item.row
        });

        if (result.success) {
          selectedServices = selectedServices.filter(function (name) {
            return name !== item.name;
          });
          showToast('ลบบริการแล้ว 🐾');
          loadServices();
        }

      } catch (error) {
        showToast(error.message || 'ลบไม่สำเร็จ');
      }

    }
  );

}


/* ==================================================
   PAGE NAVIGATION
================================================== */

function showPage(page) {

  document.querySelectorAll('.page').forEach(function (p) {
    p.classList.remove('active');
  });

  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.classList.remove('active');
  });

  if (page === 'save') {
    document.getElementById('savePage').classList.add('active');
    document.getElementById('navSave').classList.add('active');
  }

  if (page === 'summary') {
    document.getElementById('summaryPage').classList.add('active');
    document.getElementById('navSummary').classList.add('active');
    loadSummary();
  }

  if (page === 'manage') {
    document.getElementById('managePage').classList.add('active');
    document.getElementById('navManage').classList.add('active');
  }

  // scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

}


/* ==================================================
   DATE UTILITIES
================================================== */

function parseRowDate(row) {

  if (!row.date) return null;

  const parts = String(row.date).split('/');
  if (parts.length !== 3) return null;

  const day = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const year = Number(parts[2]);

  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;

  return date;

}


function dateKey(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}


function thaiDay(date) {
  const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  return days[date.getDay()];
}


function thaiDate(date) {
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return date.getDate() + ' ' + months[date.getMonth()] + ' ' + (date.getFullYear() + 543);
}


/* ==================================================
   MONEY FORMATTING
================================================== */

function money(value) {
  return '฿' + Number(value || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}


function moneyShort(value) {
  if (value >= 1000) {
    return '฿' + (value / 1000).toFixed(value >= 10000 ? 0 : 1) + 'k';
  }
  return '฿' + value;
}


/* ==================================================
   ESCAPE HTML
================================================== */

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


/* ==================================================
   TOAST
================================================== */

function showToast(message) {

  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.classList.add('show');

  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function () {
    toast.classList.remove('show');
  }, 2500);

}



/* ==================================================
   LOGIN / LOGOUT SYSTEM
================================================== */

let loginSelectedUser = '';
let pinBuffer = '';
let pinMode = ''; // 'login', 'setNew', 'confirmNew'
let pinNewValue = '';

function selectLoginUser(user) {

  loginSelectedUser = user;

  // Highlight selected card
  document.querySelectorAll('.user-card').forEach(function (card) {
    card.classList.remove('selected');
  });
  document.querySelector('.user-card.' + user).classList.add('selected');

  // Go to PIN step
  setTimeout(function () {
    document.getElementById('loginStep1').classList.remove('active');
    document.getElementById('loginStep2').classList.add('active');
    document.getElementById('loginSubtitle').style.display = 'none';

    // Check if user has PIN
    checkUserPin(user);
  }, 300);

}


async function checkUserPin(user) {

  pinBuffer = '';
  updatePinDots();
  document.getElementById('pinError').innerText = '';

  try {

    const url = API_URL + '?action=getPin&user=' + encodeURIComponent(user);
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    const result = await response.json();

    if (result && result.success && result.hasPin) {
      pinMode = 'login';
      document.getElementById('pinLabel').innerText =
        USER_NAMES[user].emoji + ' ' + USER_NAMES[user].thai + ' — ใส่ PIN 4 หลัก';
    } else {
      // ชีตบอกว่ายังไม่มี PIN — เคลียร์ PIN เก่าที่อาจค้างอยู่ในเครื่อง (จากการทดสอบก่อนหน้า)
      try { localStorage.removeItem('pin_' + user); } catch (e) { }
      pinMode = 'setNew';
      document.getElementById('pinLabel').innerText =
        USER_NAMES[user].emoji + ' ' + USER_NAMES[user].thai + ' — ตั้ง PIN ใหม่ (4 หลัก)';
    }

  } catch (err) {
    // Offline fallback: try localStorage
    const savedPin = localStorage.getItem('pin_' + user);
    if (savedPin) {
      pinMode = 'login';
      document.getElementById('pinLabel').innerText =
        USER_NAMES[user].emoji + ' ' + USER_NAMES[user].thai + ' — ใส่ PIN 4 หลัก';
    } else {
      pinMode = 'setNew';
      document.getElementById('pinLabel').innerText =
        USER_NAMES[user].emoji + ' ' + USER_NAMES[user].thai + ' — ตั้ง PIN ใหม่ (4 หลัก)';
    }
  }

}


function pinInput(digit) {

  if (pinBuffer.length >= 4) return;

  pinBuffer += digit;
  updatePinDots();
  document.getElementById('pinError').innerText = '';

  if (pinBuffer.length === 4) {
    setTimeout(function () { handlePinComplete(); }, 200);
  }

}


function pinBackspace() {

  if (pinBuffer.length === 0) return;

  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();

}


function updatePinDots() {

  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pinDot' + i);
    dot.classList.remove('filled', 'error');
    if (i < pinBuffer.length) {
      dot.classList.add('filled');
    }
  }

}


function showPinError(message) {

  document.getElementById('pinError').innerText = message;

  for (let i = 0; i < 4; i++) {
    document.getElementById('pinDot' + i).classList.add('error');
  }

  pinBuffer = '';

  setTimeout(function () {
    updatePinDots();
  }, 600);

}


async function handlePinComplete() {

  const user = loginSelectedUser;

  if (pinMode === 'setNew') {

    // ตั้ง PIN ใหม่ — จำไว้แล้วให้ยืนยัน
    pinNewValue = pinBuffer;
    pinBuffer = '';
    pinMode = 'confirmNew';
    updatePinDots();
    document.getElementById('pinLabel').innerText = '🔐 ยืนยัน PIN อีกครั้ง';
    return;

  }

  if (pinMode === 'confirmNew') {

    // ยืนยัน PIN
    if (pinBuffer !== pinNewValue) {
      showPinError('PIN ไม่ตรงกัน ลองใหม่');
      pinMode = 'setNew';
      document.getElementById('pinLabel').innerText =
        USER_NAMES[user].emoji + ' ' + USER_NAMES[user].thai + ' — ตั้ง PIN ใหม่ (4 หลัก)';
      return;
    }

    // บันทึก PIN ลง databaselist (ผ่าน API)
    try {

      const setPinResult = await apiPostRaw({
        action: 'setPin',
        user: user,
        newPin: pinBuffer
      });

      if (!setPinResult || !setPinResult.success) {
        console.warn('บันทึก PIN ไปที่ชีตไม่สำเร็จ:', setPinResult && setPinResult.message);
      }

    } catch (err) {
      // ออฟไลน์อยู่ — จะยังคง PIN ไว้ใน localStorage ก่อน แล้วลอง sync ใหม่ตอนออนไลน์
      console.warn('บันทึก PIN ไปที่ชีตไม่สำเร็จ (ออฟไลน์):', err);
    }

    // เก็บใน localStorage ด้วย
    try {
      localStorage.setItem('pin_' + user, pinBuffer);
    } catch (e) { }

    completeLogin(user);
    return;

  }

  if (pinMode === 'login') {

    // ตรวจ PIN
    let storedPin = '';

    try {

      const url = API_URL + '?action=getPin&user=' + encodeURIComponent(user);
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      const result = await response.json();

      if (result && result.success) {
        storedPin = String(result.pin || '');
      }

    } catch (err) {
      // Offline: check localStorage
      storedPin = localStorage.getItem('pin_' + user) || '';
    }

    if (pinBuffer === storedPin) {

      // เก็บใน localStorage
      try {
        localStorage.setItem('pin_' + user, pinBuffer);
      } catch (e) { }

      completeLogin(user);

    } else {

      showPinError('PIN ไม่ถูกต้อง');

    }

  }

}


// Raw apiPost (ไม่ inject user)
async function apiPostRaw(body) {

  const response = await fetch(API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(body)
  });

  return response.json();

}


function completeLogin(user) {

  currentUser = user;

  // Save login state
  try {
    localStorage.setItem('loggedInUser', user);
  } catch (e) { }

  // Update header
  updateHeaderForUser(user);

  // Hide login screen
  document.getElementById('loginScreen').classList.add('hidden');

  // Load data
  loadServices();
  renderPendingBanner();

}


function updateHeaderForUser(user) {

  const info = USER_NAMES[user];

  if (!info) return;

  document.getElementById('headerTitle').innerText = 'รายได้ของ' + info.thai;
  document.getElementById('headerUserBadge').innerText = info.emoji + ' ' + info.thai;

  // Update page title
  document.title = '🐾 รายได้ของ' + info.thai;

  // Update settings page label
  const settingsLabel = document.getElementById('settingsUserLabel');
  if (settingsLabel) {
    settingsLabel.innerText = 'เข้าสู่ระบบเป็น ' + info.thai;
  }

}


/* ==================================================
   CHANGE PIN
================================================== */
function showChangePinFlow() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  box.innerHTML =
    '<div class="modal-icon">🔐</div>' +
    '<div class="modal-title">เปลี่ยน PIN</div>' +
    '<div class="modal-text">กรอกรหัส PIN 4 หลักเดิมและรหัสใหม่</div>' +
    '<input id="oldPinInput" class="modal-input" type="password" inputmode="numeric" maxlength="4" placeholder="PIN เดิม" style="text-align:center; letter-spacing:10px; font-size:20px;">' +
    '<input id="newPinInput" class="modal-input" type="password" inputmode="numeric" maxlength="4" placeholder="PIN ใหม่" style="text-align:center; letter-spacing:10px; font-size:20px; margin-top:10px;">' +
    '<div class="modal-actions">' +
    '<button class="modal-btn cancel" id="modalCancelBtn">ยกเลิก</button>' +
    '<button class="modal-btn ok" id="modalOkBtn">บันทึก</button>' +
    '</div>';

  overlay.classList.add('show');

  document.getElementById('modalCancelBtn').onclick = closeModal;

  document.getElementById('modalOkBtn').onclick = async function () {
    const oldPin = document.getElementById('oldPinInput').value;
    const newPin = document.getElementById('newPinInput').value;

    if (oldPin.length !== 4 || newPin.length !== 4) {
      showToast('กรุณากรอก PIN ให้ครบ 4 หลัก ❌');
      return;
    }

    const btn = document.getElementById('modalOkBtn');
    btn.innerText = 'กำลังบันทึก...';
    btn.disabled = true;

    try {
      const result = await apiPost({
        action: 'setPin',
        user: currentUser,
        oldPin: oldPin,
        newPin: newPin
      });

      if (result && result.success) {
        closeModal();
        showToast('เปลี่ยน PIN สำเร็จ ✅');
      } else {
        btn.innerText = 'บันทึก';
        btn.disabled = false;
        showToast(result.message || 'รหัสผ่านเดิมไม่ถูกต้อง ❌');
      }
    } catch (error) {
      btn.innerText = 'บันทึก';
      btn.disabled = false;
      showToast('เปลี่ยน PIN ไม่สำเร็จ ❌');
    }
  };
}


/* ==================================================
   NOTIFICATIONS
================================================== */
function toggleNotification() {
  const sw = document.getElementById('notifSwitch');

  if (sw.checked) {
    if ('Notification' in window) {
      Notification.requestPermission().then(function (permission) {
        if (permission === 'granted') {
          localStorage.setItem('notifEnabled', 'true');
          showToast('เปิดการแจ้งเตือนแล้ว 🔔');
        } else {
          sw.checked = false;
          localStorage.setItem('notifEnabled', 'false');
          showToast('ต้องอนุญาตการแจ้งเตือนในเบราว์เซอร์ ❌');
        }
      });
    } else {
      sw.checked = false;
      showToast('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน ❌');
    }
  } else {
    localStorage.setItem('notifEnabled', 'false');
    showToast('ปิดการแจ้งเตือนแล้ว 🔕');
  }
}

function initNotification() {
  const isEnabled = localStorage.getItem('notifEnabled') === 'true';
  document.getElementById('notifSwitch').checked = isEnabled;

  if (isEnabled && 'Notification' in window && Notification.permission === 'granted') {
    checkDailyReminder();
    // Check every hour
    setInterval(checkDailyReminder, 60 * 60 * 1000);
  }
}

function checkDailyReminder() {
  const now = new Date();
  // Remind after 18:00
  if (now.getHours() >= 18) {
    const lastReminded = localStorage.getItem('lastRemindedDate');
    const todayStr = dateKey(now);

    if (lastReminded !== todayStr) {
      // Check if they already recorded today
      let hasRecordedToday = false;
      const today = dateKey(new Date());

      if (historyData) {
        hasRecordedToday = historyData.some(function (row) {
          const d = parseRowDate(row);
          return d && dateKey(d) === today;
        });
      }

      if (!hasRecordedToday) {
        try {
          new Notification('🐾 อย่าลืมบันทึกรายได้!', {
            body: 'วันนี้คุณยังไม่ได้บันทึกรายได้เลยนะ แวะมาบันทึกกันเถอะ 💰',
            icon: 'https://cdn-icons-png.flaticon.com/512/1046/1046374.png' // Cat paw icon
          });
          localStorage.setItem('lastRemindedDate', todayStr);
        } catch (e) { }
      }
    }
  }
}


function logoutUser() {

  showConfirmDialog(
    '🚪 ออกจากระบบ',
    'ต้องการออกจากระบบใช่ไหม?',
    function () {

      currentUser = '';

      try {
        localStorage.removeItem('loggedInUser');
      } catch (e) { }

      // Reset login screen
      document.getElementById('loginStep1').classList.add('active');
      document.getElementById('loginStep2').classList.remove('active');
      document.querySelectorAll('.user-card').forEach(function (card) {
        card.classList.remove('selected');
      });
      pinBuffer = '';
      updatePinDots();

      // Show login screen
      document.getElementById('loginScreen').classList.remove('hidden');

      // อัปเดตรายได้ร้านรวมหน้า Login
      loadCombinedSummary();

      // Reset to save page
      showPage('save');

    }
  );

}


function pinGoBack() {

  pinBuffer = '';
  pinMode = '';
  loginSelectedUser = '';
  updatePinDots();
  document.getElementById('pinError').innerText = '';

  document.getElementById('loginStep2').classList.remove('active');
  document.getElementById('loginStep1').classList.add('active');
  document.getElementById('loginSubtitle').style.display = '';

  document.querySelectorAll('.user-card').forEach(function (card) {
    card.classList.remove('selected');
  });

}


/* ==================================================
   COMBINED SUMMARY (สรุปรวม 2 คน)
================================================== */

async function loadCombinedSummary() {

  const card = document.getElementById('combinedCard');

  try {

    const url = API_URL + '?action=historyAll&_t=' + Date.now();
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    const result = await response.json();

    if (result && result.success && result.data) {

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      let namIncome = 0, namJobs = 0;
      let mookIncome = 0, mookJobs = 0;

      const serviceCounts = {};
      let totalJobsAll = 0;

      function tallyRow(row) {
        const d = parseRowDate(row);
        if (d && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          const item = row.item;
          serviceCounts[item] = (serviceCounts[item] || 0) + 1;
          totalJobsAll++;
        }
      }

      // คำนวณรายได้จริง (price - commission) + จำนวนงาน เดือนนี้
      if (result.data.nam) {
        result.data.nam.forEach(function (row) {
          const d = parseRowDate(row);
          if (d && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            const price = Number(row.price) || 0;
            const commission = Number(row.commission) || 0;
            namIncome += (price - commission);
            namJobs++;
          }
          tallyRow(row);
        });
      }

      if (result.data.mook) {
        result.data.mook.forEach(function (row) {
          const d = parseRowDate(row);
          if (d && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            const price = Number(row.price) || 0;
            const commission = Number(row.commission) || 0;
            mookIncome += (price - commission);
            mookJobs++;
          }
          tallyRow(row);
        });
      }

      document.getElementById('combinedNamIncome').innerText = money(namIncome);
      document.getElementById('combinedNamJobs').innerText = namJobs + ' งาน';
      document.getElementById('combinedMookIncome').innerText = money(mookIncome);
      document.getElementById('combinedMookJobs').innerText = mookJobs + ' งาน';
      document.getElementById('combinedTotalIncome').innerText = money(namIncome + mookIncome);
      document.getElementById('combinedTotalJobs').innerText = 'รวม ' + (namJobs + mookJobs) + ' งาน';

      renderCombinedTopServices(serviceCounts, totalJobsAll);

      card.style.display = 'block';

    }

  } catch (err) {
    // ถ้า error ไม่แสดง combined card
    card.style.display = 'none';
    const topCard = document.getElementById('topServicesCard');
    if (topCard) topCard.style.display = 'none';
  }

}


/* ==================================================
   COMBINED TOP SERVICES (รวม น้ำ + มุก, หน้า Login)
================================================== */
function renderCombinedTopServices(counts, totalJobs) {

  const sorted = Object.keys(counts)
    .map(function (key) { return { name: key, count: counts[key] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 5);

  const container = document.getElementById('topServicesList');
  const card = document.getElementById('topServicesCard');

  if (!container || !card) return;

  if (sorted.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  container.innerHTML = '';

  sorted.forEach(function (srv, index) {
    const percent = Math.round((srv.count / totalJobs) * 100) || 0;

    const el = document.createElement('div');
    el.className = 'top-service-item';
    el.innerHTML =
      '<div class="top-service-rank">#' + (index + 1) + '</div>' +
      '<div class="top-service-info">' +
      '<div class="top-service-name">' +
      '<span>' + escapeHtml(srv.name) + '</span>' +
      '<span class="top-service-count">' + srv.count + ' ครั้ง (' + percent + '%)</span>' +
      '</div>' +
      '<div class="top-service-bar-bg">' +
      '<div class="top-service-bar-fill" style="width: 0%"></div>' +
      '</div>' +
      '</div>';

    container.appendChild(el);

    // Animate bar
    setTimeout(function () {
      const bar = el.querySelector('.top-service-bar-fill');
      if (bar) bar.style.width = percent + '%';
    }, 100 + (index * 100));
  });

}


/* ==================================================
   START
================================================== */

initBackdateSelectors();
updateOnlineStatus();

// โหลดสรุปรวมสำหรับหน้า Login
loadCombinedSummary();

// Check if already logged in
(function () {

  const savedUser = localStorage.getItem('loggedInUser');

  if (savedUser && USER_NAMES[savedUser]) {
    // Auto-login
    currentUser = savedUser;
    updateHeaderForUser(savedUser);
    document.getElementById('loginScreen').classList.add('hidden');
    loadServices();
    renderPendingBanner();
  }
  // ถ้ายังไม่ได้ login จะแสดง login screen อยู่แล้ว

})();


/* ==================================================
   PWA — SERVICE WORKER REGISTRATION
================================================== */

if ('serviceWorker' in navigator) {

  navigator.serviceWorker
    .register('./sw.js')
    .then(function (reg) {
      console.log('✅ Service Worker registered');
    })
    .catch(function (err) {
      console.log('❌ SW registration failed:', err);
    });

}


/* ==================================================
   PWA — INSTALL PROMPT
================================================== */

window.addEventListener('beforeinstallprompt', function (e) {

  e.preventDefault();
  deferredInstallPrompt = e;

  // Don't show if user dismissed before
  if (localStorage.getItem('installDismissed')) return;

  // Don't show if already installed (standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  document.getElementById('installBanner').classList.add('show');

});


// Hide banner if already in standalone mode
if (window.matchMedia('(display-mode: standalone)').matches) {
  // already installed
}


function installApp() {

  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();

  deferredInstallPrompt.userChoice.then(function (choice) {

    if (choice.outcome === 'accepted') {
      showToast('ติดตั้งแอปเรียบร้อย 📱✨');
    }

    deferredInstallPrompt = null;
    document.getElementById('installBanner').classList.remove('show');

  });

}


function dismissInstall() {

  document.getElementById('installBanner').classList.remove('show');

  try {
    localStorage.setItem('installDismissed', '1');
  } catch (e) { }

}


/* ==================================================
   DARK MODE
================================================== */

function initDarkMode() {

  let darkMode = false;

  try {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      darkMode = saved === '1';
    } else {
      // ค่าเริ่มต้น: โหมดมืด
      darkMode = true;
    }
  } catch (e) { }

  applyDarkMode(darkMode);

}


function toggleDarkMode() {

  const sw = document.getElementById('darkSwitch');
  const isDark = sw ? sw.checked : !document.body.classList.contains('dark');
  applyDarkMode(isDark);

  try {
    localStorage.setItem('darkMode', isDark ? '1' : '0');
  } catch (e) { }

}


function applyDarkMode(isDark) {

  const sw = document.getElementById('darkSwitch');

  if (isDark) {
    document.body.classList.add('dark');
    document.querySelector('meta[name="theme-color"]').content = '#1C1618';
  } else {
    document.body.classList.remove('dark');
    document.querySelector('meta[name="theme-color"]').content = '#FAF4EA';
  }

  // Sync switch state
  if (sw) {
    sw.checked = isDark;
  }

}


initDarkMode();
initNotification();

/* ==================================================
   FORCE REFRESH (CLEAR CACHE)
================================================== */
async function forceRefreshApp() {
  const btn = document.querySelector('button[onclick="forceRefreshApp()"]');
  if (btn) btn.innerText = 'กำลังล้าง...';
  
  try {
    // 1. Unregister Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let reg of registrations) {
        await reg.unregister();
      }
    }
    // 2. Clear Caches API
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (let name of cacheNames) {
        await caches.delete(name);
      }
    }
    showToast('ล้างแคชสำเร็จ กำลังรีโหลด... 🔄');
  } catch (err) {
    showToast('ล้างแคชเสร็จสิ้น 🔄');
  }
  
  // 3. Reload from server
  setTimeout(function() {
    window.location.reload(true);
  }, 1000);
}

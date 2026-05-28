// ===== إعدادات النظام =====
let SYSTEM_SETTINGS = JSON.parse(localStorage.getItem("fuelSystemSettings") || JSON.stringify({
    systemName: "نظام تجهيز الوقود المتقدم",
    defaultCapacity: 33000,
    showNotifications: true,
    autoBackup: "daily",
    theme: "blue",
    language: "ar",
    quickAdd: true,
    autoSave: true
}));

// ===== بيانات النظام =====
let USERS = JSON.parse(localStorage.getItem("fuelSystemUsers") || JSON.stringify({
    admin: {
        pass: "admin123",
        role: "admin",
        name: "المدير العام",
        createdAt: new Date().toISOString(),
        lastLogin: null,
        permissions: ["all"]
    },
    supervisor: {
        pass: "super123",
        role: "supervisor",
        name: "المشرف الرئيسي",
        createdAt: new Date().toISOString(),
        lastLogin: null,
        permissions: ["view", "edit", "reports"]
    },
    user1: {
        pass: "user123",
        role: "user",
        name: "مستخدم 1",
        createdAt: new Date().toISOString(),
        lastLogin: null,
        permissions: ["view", "add"]
    },
    user2: {
        pass: "user456",
        role: "user",
        name: "مستخدم 2",
        createdAt: new Date().toISOString(),
        lastLogin: null,
        permissions: ["view", "add"]
    },
    user3: {
        pass: "user789",
        role: "user",
        name: "مستخدم 3",
        createdAt: new Date().toISOString(),
        lastLogin: null,
        permissions: ["view", "add"]
    }
}));

let CURRENT_USER = null;
let CURRENT_ROLE = null;
let LOGS = JSON.parse(localStorage.getItem("fuelLogs") || "[]");
let ENTITIES = JSON.parse(localStorage.getItem("fuelEntities") || "[]");
let NOTIFICATIONS = JSON.parse(localStorage.getItem("fuelNotifications") || "[]");
let ANNOUNCEMENTS = JSON.parse(localStorage.getItem("fuelAnnouncements") || "[]");

// ===== دوال مساعدة =====
function showNotification(message, type = 'info', duration = 5000) {
    if (!SYSTEM_SETTINGS.showNotifications && type !== 'danger') return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    notification.innerHTML = `
        ${icons[type] || 'ℹ️'}
        <span>${message}</span>
        <button class="close-btn" onclick="this.parentElement.remove()">×</button>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentElement) notification.remove();
    }, duration);
}

function getColorForPercentage(percent) {
    if (percent >= 80) return '#27ae60';
    if (percent >= 50) return '#f39c12';
    if (percent >= 20) return '#e67e22';
    return '#e74c3c';
}

function calculatePercentage(done, total) {
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
}

function getRoleName(role) {
    const roles = { admin: 'مدير النظام', supervisor: 'مشرف', user: 'مستخدم' };
    return roles[role] || role;
}

// ===== إدارة الجهات (الجدول الرئيسي) =====
function loadEntitiesToTable() {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    ENTITIES.forEach((entity, index) => {
        const entityLogs = LOGS.filter(l => l.entity === entity.name && l.type === 'fuel');
        const done = entityLogs.reduce((sum, l) => sum + (parseFloat(l.cars) || 0), 0);
        const percent = calculatePercentage(done, entity.total);
        const progressColor = getColorForPercentage(percent);
        const isReadonly = (CURRENT_ROLE === 'admin' || CURRENT_ROLE === 'supervisor') ? '' : 'readonly style="background: #f5f5f5;"';
        const clearBtn = CURRENT_ROLE === 'admin' ? `<button class="clear-btn" onclick="clearEntityTotal(${index})">مسح</button>` : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="text-align: right; font-weight: bold;">${entity.name}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="number" class="total-input" data-index="${index}" value="${entity.total}" min="0" ${isReadonly}>
                    ${clearBtn}
                </div>
            </td>
            <td><input type="number" class="today-input" data-index="${index}" value="0" min="0"></td>
            <td class="done" data-index="${index}">${done}</td>
            <td class="remain" data-index="${index}">${Math.max(0, entity.total - done)}</td>
            <td>
                <div class="progress-container">
                    <div class="progress-bar" data-index="${index}" style="width: ${percent}%; background: ${progressColor};">
                        <div class="progress-text">${percent}%</div>
                    </div>
                </div>
                <div class="percent">${done} / ${entity.total} (${percent}%)</div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    attachTableListeners();
    updateTotals();
}

function loadEntitiesToFilter() {
    const filterSelect = document.getElementById('filterEntity');
    filterSelect.innerHTML = '<option value="all">جميع الجهات</option>';
    ENTITIES.forEach(entity => {
        const option = document.createElement('option');
        option.value = entity.name;
        option.textContent = entity.name;
        filterSelect.appendChild(option);
    });
}

function filterTable() {
    const filterValue = document.getElementById('filterEntity').value;
    const searchValue = document.getElementById('searchEntity').value.toLowerCase();
    const rows = document.querySelectorAll('#tableBody tr');

    rows.forEach(row => {
        const entityName = row.cells[0].textContent.toLowerCase();
        const entityNameOriginal = row.cells[0].textContent;
        let shouldShow = true;
        if (filterValue !== 'all' && entityNameOriginal !== filterValue) shouldShow = false;
        if (searchValue && !entityName.includes(searchValue)) shouldShow = false;
        row.style.display = shouldShow ? '' : 'none';
    });
}

function attachTableListeners() {
    const tableBody = document.getElementById('tableBody');

    tableBody.addEventListener('change', function(e) {
        if (e.target.classList.contains('today-input')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            const todayVal = parseFloat(e.target.value) || 0;
            if (todayVal > 0 && index >= 0 && index < ENTITIES.length) {
                const entity = ENTITIES[index].name;
                const todayDate = document.getElementById('today').value;
                const capacity = parseFloat(document.getElementById('capacity').value) || 33000;

                LOGS.push({
                    type: 'fuel',
                    user: CURRENT_USER,
                    userDisplay: USERS[CURRENT_USER]?.name || CURRENT_USER,
                    date: todayDate,
                    time: new Date().toLocaleTimeString(),
                    entity: entity,
                    cars: todayVal,
                    liters: todayVal * capacity
                });
                localStorage.setItem("fuelLogs", JSON.stringify(LOGS));
                updateRow(index);
                e.target.value = 0;
                showNotification(`تم تسجيل ${todayVal} سيارة لـ ${entity}`, 'success');
            }
        }

        if (e.target.classList.contains('total-input')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            const newTotal = parseFloat(e.target.value) || 0;
            if ((CURRENT_ROLE === 'admin' || CURRENT_ROLE === 'supervisor') && index >= 0 && index < ENTITIES.length) {
                ENTITIES[index].total = newTotal;
                localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
                updateRow(index);
                if (SYSTEM_SETTINGS.autoSave) {
                    showNotification('تم حفظ التعديل تلقائياً', 'info', 2000);
                }
            }
        }
    });
}

function updateRow(index) {
    if (index < 0 || index >= ENTITIES.length) return;
    const entity = ENTITIES[index];
    const entityLogs = LOGS.filter(l => l.entity === entity.name && l.type === 'fuel');
    const done = entityLogs.reduce((sum, l) => sum + (parseFloat(l.cars) || 0), 0);
    const remain = Math.max(0, entity.total - done);
    const percent = calculatePercentage(done, entity.total);
    const progressColor = getColorForPercentage(percent);

    const doneCell = document.querySelector(`.done[data-index="${index}"]`);
    const remainCell = document.querySelector(`.remain[data-index="${index}"]`);
    const progressBar = document.querySelector(`.progress-bar[data-index="${index}"]`);
    const percentText = progressBar ? progressBar.closest('td').querySelector('.percent') : null;

    if (doneCell) doneCell.textContent = done;
    if (remainCell) remainCell.textContent = remain;
    if (progressBar) {
        progressBar.style.width = percent + '%';
        progressBar.style.background = progressColor;
        progressBar.querySelector('.progress-text').textContent = percent + '%';
    }
    if (percentText) percentText.textContent = `${done} / ${entity.total} (${percent}%)`;
    updateTotals();
}

function updateAllRows() {
    ENTITIES.forEach((_, index) => updateRow(index));
    updateTotals();
}

function updateTotals() {
    const totalTotal = ENTITIES.reduce((sum, entity) => sum + entity.total, 0);
    const totalDone = ENTITIES.reduce((sum, entity) => {
        const entityLogs = LOGS.filter(l => l.entity === entity.name && l.type === 'fuel');
        return sum + entityLogs.reduce((s, l) => s + (parseFloat(l.cars) || 0), 0);
    }, 0);
    const totalRemain = Math.max(0, totalTotal - totalDone);
    const totalPercent = calculatePercentage(totalDone, totalTotal);

    document.getElementById('totalTotal').textContent = totalTotal;
    document.getElementById('totalDone').textContent = totalDone;
    document.getElementById('totalRemain').textContent = totalRemain;
    document.getElementById('totalPercent').textContent = totalPercent + '%';
    document.getElementById('tableFooter').style.display = '';
}

// ===== إدارة الجهات المتقدمة =====
function loadEntitiesList() {
    const entitiesList = document.getElementById('entitiesList');
    if (!entitiesList) return;
    entitiesList.innerHTML = '';

    ENTITIES.forEach((entity, index) => {
        const entityItem = document.createElement('div');
        entityItem.className = 'entity-item';
        entityItem.innerHTML = `
            <div class="entity-name">${entity.name}</div>
            <div class="entity-actions">
                <input type="number" id="entityTotal${index}" value="${entity.total}" style="width: 100px;">
                <button class="primary-btn" onclick="updateEntity(${index})">تعديل</button>
                <button class="danger-btn" onclick="deleteEntity(${index})">حذف</button>
            </div>
        `;
        entitiesList.appendChild(entityItem);
    });
}

function filterEntities() {
    const searchValue = document.getElementById('searchEntityAdmin').value.toLowerCase();
    const entityItems = document.querySelectorAll('#entitiesList .entity-item');
    entityItems.forEach(item => {
        const entityName = item.querySelector('.entity-name').textContent.toLowerCase();
        item.style.display = (searchValue && !entityName.includes(searchValue)) ? 'none' : 'flex';
    });
}

function showAddEntityModal() {
    document.getElementById('addEntityModal').classList.remove('hidden');
}

function addEntityFromModal() {
    const name = document.getElementById('modalEntityName').value.trim();
    const total = parseInt(document.getElementById('modalEntityTotal').value) || 10;

    if (!name) { showNotification('يرجى إدخال اسم الجهة', 'error'); return; }
    if (ENTITIES.some(e => e.name === name)) { showNotification('هذه الجهة موجودة بالفعل', 'error'); return; }

    ENTITIES.push({ name, total });
    localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
    loadEntitiesToTable();
    loadEntitiesToFilter();
    loadEntitiesList();
    closeAddEntityModal();
    showNotification(`تم إضافة "${name}" بنجاح`, 'success');
}

function closeAddEntityModal() {
    document.getElementById('modalEntityName').value = '';
    document.getElementById('modalEntityTotal').value = '10';
    document.getElementById('addEntityModal').classList.add('hidden');
}

function updateEntity(index) {
    const newTotal = parseFloat(document.getElementById(`entityTotal${index}`).value) || 0;
    if (newTotal < 0) { showNotification("العدد يجب أن يكون موجباً", 'error'); return; }
    ENTITIES[index].total = newTotal;
    localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
    loadEntitiesToTable();
    updateAllRows();
    showNotification("تم تعديل الجهة بنجاح", 'success');
}

function deleteEntity(index) {
    if (confirm(`هل أنت متأكد من حذف جهة "${ENTITIES[index].name}"؟`)) {
        ENTITIES.splice(index, 1);
        localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
        loadEntitiesToTable();
        loadEntitiesToFilter();
        loadEntitiesList();
        showNotification("تم حذف الجهة بنجاح", 'success');
    }
}

function clearAllEntities() {
    if (confirm("هل أنت متأكد من حذف جميع الجهات؟ هذا الإجراء لا يمكن التراجع عنه.")) {
        ENTITIES = [];
        localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
        loadEntitiesToTable();
        loadEntitiesToFilter();
        loadEntitiesList();
        showNotification("تم حذف جميع الجهات", 'success');
    }
}

function saveAllEntities() {
    const totalInputs = document.querySelectorAll('.total-input');
    let hasChanges = false;
    totalInputs.forEach((input, index) => {
        const newTotal = parseFloat(input.value) || 0;
        if (index < ENTITIES.length && newTotal !== ENTITIES[index].total) {
            ENTITIES[index].total = newTotal;
            hasChanges = true;
        }
    });
    if (hasChanges) {
        localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
        LOGS.push({
            type: 'system', user: CURRENT_USER,
            userDisplay: USERS[CURRENT_USER]?.name || CURRENT_USER,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString(),
            action: 'تعديل جميع الجهات'
        });
        localStorage.setItem("fuelLogs", JSON.stringify(LOGS));
        updateAllRows();
        showNotification('تم حفظ جميع التعديلات بنجاح', 'success');
    } else {
        showNotification('لا توجد تغييرات للحفظ', 'info');
    }
}

function clearEntityTotal(index) {
    if (confirm(`هل تريد مسح العدد الإجمالي لـ "${ENTITIES[index].name}"؟`)) {
        ENTITIES[index].total = 0;
        localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
        updateRow(index);
        showNotification('تم مسح العدد الإجمالي', 'success');
    }
}

function clearAllEntityTotals() {
    if (confirm('هل تريد مسح جميع الأعداد الإجمالية للجهات؟')) {
        ENTITIES.forEach(entity => { entity.total = 0; });
        localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
        updateAllRows();
        showNotification('تم مسح جميع الأعداد الإجمالية', 'success');
    }
}

function clearAllTodayValues() {
    document.querySelectorAll('.today-input').forEach(input => { input.value = 0; });
    showNotification('تم مسح جميع قيم اليوم', 'success');
}

// ===== إضافة جهة سريعة =====
function addEntityQuick() {
    const name = document.getElementById('quickEntityName').value.trim();
    const total = parseInt(document.getElementById('quickEntityTotal').value) || 10;
    if (!name) { showNotification('يرجى إدخال اسم الجهة', 'error'); return; }
    if (ENTITIES.some(e => e.name === name)) { showNotification('هذه الجهة موجودة بالفعل', 'error'); return; }

    ENTITIES.push({ name, total });
    localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
    loadEntitiesToTable();
    loadEntitiesToFilter();
    if (CURRENT_ROLE === 'admin' || CURRENT_ROLE === 'supervisor') loadEntitiesList();
    document.getElementById('quickEntityName').value = '';
    document.getElementById('quickEntityTotal').value = '10';
    showNotification(`تم إضافة "${name}" بنجاح`, 'success');
}

// ===== دوال التصدير والاستيراد =====
function exportEntitiesToExcel() {
    const rows = [["اسم الجهة", "العدد الإجمالي", "المنجز", "المتبقي", "نسبة الإنجاز"]];
    ENTITIES.forEach(entity => {
        const entityLogs = LOGS.filter(l => l.entity === entity.name && l.type === 'fuel');
        const done = entityLogs.reduce((sum, l) => sum + (parseFloat(l.cars) || 0), 0);
        const remain = Math.max(0, entity.total - done);
        const percent = calculatePercentage(done, entity.total);
        rows.push([entity.name, entity.total, done, remain, percent + '%']);
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "الجهات");
    XLSX.writeFile(wb, `جهات_النظام_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showNotification("تم تصدير بيانات الجهات بنجاح", 'success');
}

function importEntitiesFromExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                const importedEntities = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (row && row[0]) {
                        let totalValue = parseFloat(row[1]) || 0;
                        totalValue = totalValue < 1 ? 1 : Math.round(totalValue);
                        importedEntities.push({ name: row[0].toString().trim(), total: totalValue });
                    }
                }
                if (confirm(`تم العثور على ${importedEntities.length} جهة. هل تريد استيرادها؟`)) {
                    ENTITIES = importedEntities;
                    localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
                    loadEntitiesToTable();
                    loadEntitiesToFilter();
                    loadEntitiesList();
                    showNotification(`تم استيراد ${importedEntities.length} جهة بنجاح`, 'success');
                }
            } catch (error) {
                showNotification("فشل في استيراد الملف. تأكد من صحة التنسيق", 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
}

function exportDailyExcel() {
    const day = document.getElementById('today').value;
    const capacity = parseFloat(document.getElementById('capacity').value) || 33000;
    const rows = [["المستخدم", "الاسم", "التاريخ", "الجهة", "تجهيز اليوم (سيارة)", "اللترات", "الوقت"]];
    const dailyLogs = LOGS.filter(l => l.date === day && l.type === 'fuel');

    if (dailyLogs.length === 0) { showNotification("لا توجد سجلات لهذا اليوم", 'warning'); return; }

    dailyLogs.forEach(l => {
        const liters = l.liters || (l.cars * capacity);
        rows.push([l.user, l.userDisplay, l.date, l.entity, l.cars, liters, l.time]);
    });

    rows.push([]);
    rows.push(["الجهة", "السيارات اليومية", "اللترات"]);
    const carTotals = {};
    const literTotals = {};
    dailyLogs.forEach(l => {
        if (!carTotals[l.entity]) carTotals[l.entity] = 0;
        if (!literTotals[l.entity]) literTotals[l.entity] = 0;
        carTotals[l.entity] += parseFloat(l.cars) || 0;
        literTotals[l.entity] += parseFloat(l.liters) || (l.cars * capacity);
    });
    Object.keys(carTotals).forEach(entity => {
        rows.push([entity, carTotals[entity], literTotals[entity]]);
    });

    const dayCarsTotal = dailyLogs.reduce((sum, l) => sum + (parseFloat(l.cars) || 0), 0);
    const dayLitersTotal = dailyLogs.reduce((sum, l) => sum + (parseFloat(l.liters) || (l.cars * capacity)), 0);
    rows.push([]);
    rows.push(["الإجمالي اليومي", dayCarsTotal + " سيارة", dayLitersTotal + " لتر"]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "تقرير يومي");
    XLSX.writeFile(wb, `تقرير_يومي_${day}.xlsx`);
    showNotification("تم تصدير التقرير اليومي بنجاح", 'success');
}

// ===== إدارة المستخدمين والصلاحيات =====
function loadUsersList() {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;
    usersList.innerHTML = '';

    Object.keys(USERS).forEach(username => {
        const user = USERS[username];
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        const deleteBtn = (username !== CURRENT_USER && username !== 'admin')
            ? `<button class="danger-btn" onclick="deleteUser('${username}')" style="padding: 5px 10px; font-size: 12px;">🗑️ حذف</button>`
            : '';
        userItem.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: bold; color: #2c3e50;">${user.name} (@${username})</div>
                <div style="font-size: 12px; color: #7f8c8d;">${getRoleName(user.role)}</div>
                <div style="font-size: 11px; color: #999;">آخر دخول: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString('ar-IQ') : 'لم يسجل دخول'}</div>
            </div>
            <div style="display: flex; gap: 5px;">
                <button class="primary-btn" onclick="editUserModal('${username}')" style="padding: 5px 10px; font-size: 12px;">✏️ تعديل</button>
                <button class="warning-btn" onclick="resetPasswordModal('${username}')" style="padding: 5px 10px; font-size: 12px;">🔑 كلمة مرور</button>
                ${deleteBtn}
            </div>
        `;
        usersList.appendChild(userItem);
    });
}

function togglePassword(fieldId, button) {
    const field = document.getElementById(fieldId);
    if (field.type === 'password') {
        field.type = 'text';
        button.textContent = '🙈';
    } else {
        field.type = 'password';
        button.textContent = '👁️';
    }
}

function addNewUser() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newUserPassword').value.trim();
    const role = document.getElementById('newUserRole').value;
    const name = document.getElementById('newUserName').value.trim();

    if (!username || !password || !name) { showNotification("يرجى ملء جميع الحقول", 'error'); return; }
    if (USERS[username]) { showNotification("اسم المستخدم موجود بالفعل", 'error'); return; }
    if (password.length < 6) { showNotification("كلمة المرور يجب أن تكون 6 أحرف على الأقل", 'error'); return; }

    USERS[username] = {
        pass: password, role: role, name: name,
        createdAt: new Date().toISOString(), lastLogin: null
    };
    localStorage.setItem("fuelSystemUsers", JSON.stringify(USERS));
    loadUsersList();
    document.getElementById('newUsername').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserName').value = '';
    showNotification(`تم إضافة المستخدم ${name} بنجاح`, 'success');
}

function editUserModal(username) {
    const user = USERS[username];
    const newName = prompt(`الاسم الجديد لـ ${username}:`, user.name);
    if (newName && newName.trim()) {
        const newRole = prompt(`الدور الجديد (admin/supervisor/user):`, user.role);
        if (newRole && ['admin', 'supervisor', 'user'].includes(newRole)) {
            USERS[username].name = newName.trim();
            USERS[username].role = newRole;
            localStorage.setItem("fuelSystemUsers", JSON.stringify(USERS));
            loadUsersList();
            showNotification(`تم تحديث بيانات ${username}`, 'success');
        }
    }
}

function resetPasswordModal(username) {
    const newPassword = prompt(`كلمة المرور الجديدة لـ ${username} (6 أحرف على الأقل):`, "");
    if (newPassword && newPassword.trim() && newPassword.length >= 6) {
        USERS[username].pass = newPassword.trim();
        localStorage.setItem("fuelSystemUsers", JSON.stringify(USERS));
        showNotification(`تم تحديث كلمة مرور ${username}`, 'success');
    } else if (newPassword) {
        showNotification("كلمة المرور يجب أن تكون 6 أحرف على الأقل", 'error');
    }
}

function resetAllPasswords() {
    if (confirm("هل أنت متأكد من إعادة تعيين كلمات مرور جميع المستخدمين؟ سيتم تعيين كلمة مرور '123456' للجميع.")) {
        Object.keys(USERS).forEach(username => { USERS[username].pass = "123456"; });
        localStorage.setItem("fuelSystemUsers", JSON.stringify(USERS));
        showNotification("تم إعادة تعيين كلمات مرور جميع المستخدمين إلى 123456", 'success');
    }
}

function deleteUser(username) {
    if (confirm(`هل أنت متأكد من حذف المستخدم ${username}؟`)) {
        delete USERS[username];
        localStorage.setItem("fuelSystemUsers", JSON.stringify(USERS));
        loadUsersList();
        showNotification(`تم حذف المستخدم ${username}`, 'success');
    }
}

// ===== تبديل المستخدم =====
function switchUser() {
    const modal = document.getElementById('switchUserModal');
    const list = document.getElementById('switchUserList');
    list.innerHTML = '';

    Object.keys(USERS).forEach(username => {
        const user = USERS[username];
        if (username !== CURRENT_USER) {
            const userItem = document.createElement('div');
            userItem.className = 'entity-item';
            userItem.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: bold;">${user.name} (@${username})</div>
                    <div style="font-size: 12px; color: #666;">${getRoleName(user.role)}</div>
                </div>
                <button class="primary-btn" onclick="loginAsUser('${username}')" style="padding: 5px 10px; font-size: 12px;">🔓 الدخول</button>
            `;
            list.appendChild(userItem);
        }
    });
    modal.classList.remove('hidden');
}

function loginAsUser(username) {
    CURRENT_USER = username;
    CURRENT_ROLE = USERS[username].role;
    updateUserDisplay();
    initSystem();
    closeSwitchUserModal();
    showNotification(`تم الدخول كـ ${USERS[username].name}`, 'success');
}

function closeSwitchUserModal() {
    document.getElementById('switchUserModal').classList.add('hidden');
}

function updateUserDisplay() {
    const user = USERS[CURRENT_USER];
    document.getElementById('currentUserDisplay').textContent = user.name;
    document.getElementById('userRoleDisplay').textContent = getRoleName(user.role);
    const roleBadge = document.getElementById('roleBadge');
    if (user.role === 'admin') {
        roleBadge.innerHTML = '<span class="admin-badge">👑 مدير النظام</span>';
    } else if (user.role === 'supervisor') {
        roleBadge.innerHTML = '<span class="user-badge" style="background: #9b59b6;">👔 مشرف</span>';
    } else {
        roleBadge.innerHTML = '<span class="user-badge">👤 مستخدم</span>';
    }
}

// ===== الإشعارات والإعلانات =====
function loadNotifications() {
    const container = document.getElementById('systemNotifications');
    if (!container) return;
    container.innerHTML = '';

    const userNotifications = NOTIFICATIONS.filter(n =>
        n.target === 'all' || n.target === CURRENT_ROLE || n.target === CURRENT_USER
    ).slice(-5);

    userNotifications.forEach(notification => {
        const item = document.createElement('div');
        item.className = `notification-item ${notification.type}`;
        item.innerHTML = `
            <div class="notification-header">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-time">${new Date(notification.timestamp).toLocaleTimeString('ar-IQ')}</div>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div>${notification.message}</div>
            <div style="font-size: 12px; color: #7f8c8d; margin-top: 5px;">من: ${notification.senderName}</div>
        `;
        container.appendChild(item);
    });
}

function loadAnnouncements() {
    const systemAnnouncement = document.getElementById('systemAnnouncement');
    const announcementsContainer = document.getElementById('activeAnnouncements');

    if (ANNOUNCEMENTS.length > 0) {
        systemAnnouncement.textContent = ANNOUNCEMENTS[ANNOUNCEMENTS.length - 1].message;
        systemAnnouncement.classList.remove('hidden');
    } else {
        systemAnnouncement.classList.add('hidden');
    }

    if (announcementsContainer) {
        announcementsContainer.innerHTML = '';
        ANNOUNCEMENTS.forEach((announcement, index) => {
            const announcementItem = document.createElement('div');
            announcementItem.className = 'entity-item';
            announcementItem.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: bold;">${announcement.title}</div>
                    <div style="font-size: 12px; color: #666;">${announcement.message}</div>
                    <div style="font-size: 11px; color: #999;">${new Date(announcement.date).toLocaleDateString('ar-IQ')}</div>
                </div>
                <button class="danger-btn" onclick="deleteAnnouncement(${index})" style="padding: 5px 10px; font-size: 12px;">حذف</button>
            `;
            announcementsContainer.appendChild(announcementItem);
        });
    }
}

function sendNotificationToAll() {
    const title = prompt('عنوان الإشعار:');
    if (!title) return;
    const message = prompt('نص الإشعار:');
    if (!message) return;

    NOTIFICATIONS.push({
        id: Date.now(), type: 'info', title, message,
        sender: CURRENT_USER, senderName: USERS[CURRENT_USER]?.name,
        timestamp: new Date().toISOString(), read: false, target: 'all'
    });
    localStorage.setItem("fuelNotifications", JSON.stringify(NOTIFICATIONS));
    loadNotifications();
    showNotification('تم إرسال الإشعار لجميع المستخدمين', 'success');
}

function sendCustomNotification() {
    const type = document.getElementById('notificationType').value;
    const title = document.getElementById('notificationTitle').value;
    const message = document.getElementById('notificationMessage').value;
    const target = document.getElementById('notificationTarget').value;

    if (!title || !message) { showNotification('يرجى تعبئة جميع الحقول', 'error'); return; }

    NOTIFICATIONS.push({
        id: Date.now(), type, title, message,
        sender: CURRENT_USER, senderName: USERS[CURRENT_USER]?.name,
        timestamp: new Date().toISOString(), read: false, target
    });
    localStorage.setItem("fuelNotifications", JSON.stringify(NOTIFICATIONS));
    loadNotifications();
    document.getElementById('notificationTitle').value = '';
    document.getElementById('notificationMessage').value = '';
    showNotification('تم إرسال الإشعار بنجاح', 'success');
}

function toggleSpecificUser() {
    const target = document.getElementById('notificationTarget').value;
    const specificUser = document.getElementById('specificUser');
    if (target === 'specific') {
        specificUser.style.display = 'block';
        specificUser.innerHTML = '';
        Object.keys(USERS).forEach(username => {
            const option = document.createElement('option');
            option.value = username;
            option.textContent = USERS[username].name + ' (@' + username + ')';
            specificUser.appendChild(option);
        });
    } else {
        specificUser.style.display = 'none';
    }
}

function addNewAnnouncement() {
    const title = prompt('عنوان الإعلان:');
    if (!title) return;
    const message = prompt('نص الإعلان:');
    if (!message) return;

    ANNOUNCEMENTS.push({
        title, message,
        date: new Date().toISOString(),
        createdBy: CURRENT_USER
    });
    localStorage.setItem("fuelAnnouncements", JSON.stringify(ANNOUNCEMENTS));
    loadAnnouncements();
    showNotification('تم إضافة الإعلان بنجاح', 'success');
}

function deleteAnnouncement(index) {
    if (confirm('هل تريد حذف هذا الإعلان؟')) {
        ANNOUNCEMENTS.splice(index, 1);
        localStorage.setItem("fuelAnnouncements", JSON.stringify(ANNOUNCEMENTS));
        loadAnnouncements();
        showNotification('تم حذف الإعلان', 'success');
    }
}

// ===== التقارير المتقدمة =====
function updateStatistics() {
    document.getElementById('totalEntities').textContent = ENTITIES.length;
    document.getElementById('totalUsers').textContent = Object.keys(USERS).length;
    document.getElementById('totalCars').textContent = ENTITIES.reduce((sum, e) => sum + e.total, 0);

    const today = document.getElementById('today').value;
    const todayLogs = LOGS.filter(l => l.date === today && l.type === 'fuel');
    document.getElementById('todayRecords').textContent = todayLogs.length;
    document.getElementById('todayCars').textContent = todayLogs.reduce((sum, l) => sum + (l.cars || 0), 0);

    const totalDone = ENTITIES.reduce((sum, entity) => {
        const entityLogs = LOGS.filter(l => l.entity === entity.name && l.type === 'fuel');
        return sum + entityLogs.reduce((s, l) => s + (parseFloat(l.cars) || 0), 0);
    }, 0);
    const totalTotal = ENTITIES.reduce((sum, entity) => sum + entity.total, 0);
    document.getElementById('overallProgress').textContent = calculatePercentage(totalDone, totalTotal) + '%';

    const activeUsersSet = new Set(todayLogs.map(l => l.user));
    document.getElementById('activeUsers').textContent = activeUsersSet.size;
}

function generateComprehensiveReport() {
    const today = document.getElementById('today').value;
    const capacity = parseFloat(document.getElementById('capacity').value) || 33000;
    const todayLogs = LOGS.filter(l => l.date === today && l.type === 'fuel');
    const month = today.substring(0, 7);
    const monthLogs = LOGS.filter(l => l.date.substring(0, 7) === month && l.type === 'fuel');

    const todayCars = todayLogs.reduce((sum, l) => sum + (parseFloat(l.cars) || 0), 0);
    const todayLiters = todayLogs.reduce((sum, l) => sum + (parseFloat(l.liters) || (l.cars * capacity)), 0);
    const monthCars = monthLogs.reduce((sum, l) => sum + (parseFloat(l.cars) || 0), 0);
    const monthLiters = monthLogs.reduce((sum, l) => sum + (parseFloat(l.liters) || (l.cars * capacity)), 0);

    let reportHTML = `
        <div style="padding: 20px;">
            <h2 style="text-align: center; color: #2c3e50;">${SYSTEM_SETTINGS.systemName}</h2>
            <h3 style="text-align: center; color: #666;">تقرير شامل - ${new Date().toLocaleDateString('ar-IQ')}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0;">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
                    <h4>📊 إحصائيات عامة</h4>
                    <p>عدد الجهات: <strong>${ENTITIES.length}</strong></p>
                    <p>إجمالي السيارات: <strong>${ENTITIES.reduce((sum, e) => sum + e.total, 0)}</strong></p>
                    <p>عدد المستخدمين: <strong>${Object.keys(USERS).length}</strong></p>
                    <p>إجمالي السجلات: <strong>${LOGS.filter(l => l.type === 'fuel').length}</strong></p>
                </div>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
                    <h4>📅 إحصائيات اليوم (${today})</h4>
                    <p>عدد السجلات: <strong>${todayLogs.length}</strong></p>
                    <p>السيارات المجهزة: <strong>${todayCars}</strong></p>
                    <p>اللترات المجهزة: <strong>${todayLiters.toLocaleString()} لتر</strong></p>
                    <p>متوسط السيارات/جهة: <strong>${todayLogs.length > 0 ? (todayCars / todayLogs.length).toFixed(1) : 0}</strong></p>
                </div>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
                    <h4>📈 إحصائيات الشهر (${month})</h4>
                    <p>عدد السجلات: <strong>${monthLogs.length}</strong></p>
                    <p>السيارات المجهزة: <strong>${monthCars}</strong></p>
                    <p>اللترات المجهزة: <strong>${monthLiters.toLocaleString()} لتر</strong></p>
                    <p>متوسط يومي: <strong>${(monthCars / 30).toFixed(1)} سيارة</strong></p>
                </div>
            </div>
            <h4>🏆 أفضل 5 جهات من حيث الإنجاز</h4>
            <table border="1" cellpadding="10" cellspacing="0" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead><tr style="background: #34495e; color: white;"><th>الترتيب</th><th>الجهة</th><th>المنجز</th><th>الإجمالي</th><th>النسبة</th></tr></thead>
                <tbody>`;

    const entityStats = ENTITIES.map(entity => {
        const entityLogs = LOGS.filter(l => l.entity === entity.name && l.type === 'fuel');
        const done = entityLogs.reduce((sum, l) => sum + (parseFloat(l.cars) || 0), 0);
        return { name: entity.name, done, total: entity.total, percent: calculatePercentage(done, entity.total) };
    }).sort((a, b) => b.percent - a.percent).slice(0, 5);

    entityStats.forEach((stat, i) => {
        reportHTML += `<tr><td>${i + 1}</td><td>${stat.name}</td><td>${stat.done}</td><td>${stat.total}</td><td>${stat.percent}%</td></tr>`;
    });

    reportHTML += `</tbody></table><h4>👥 نشاط المستخدمين اليوم</h4>
        <table border="1" cellpadding="10" cellspacing="0" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead><tr style="background: #34495e; color: white;"><th>المستخدم</th><th>عدد السجلات</th><th>السيارات</th><th>آخر نشاط</th></tr></thead>
            <tbody>`;

    const userActivity = {};
    todayLogs.forEach(log => {
        if (!userActivity[log.user]) userActivity[log.user] = { count: 0, cars: 0, lastTime: log.time };
        userActivity[log.user].count++;
        userActivity[log.user].cars += log.cars || 0;
        userActivity[log.user].lastTime = log.time;
    });

    Object.keys(userActivity).forEach(username => {
        const activity = userActivity[username];
        const user = USERS[username];
        reportHTML += `<tr><td>${user?.name || username}</td><td>${activity.count}</td><td>${activity.cars}</td><td>${activity.lastTime}</td></tr>`;
    });

    reportHTML += `</tbody></table></div>`;

    document.getElementById('summaryContent').innerHTML = reportHTML;
    document.getElementById('summaryModal').classList.remove('hidden');
}

function closeSummary() {
    document.getElementById('summaryModal').classList.add('hidden');
}

function showSummary() { generateComprehensiveReport(); }

function exportAllReports() {
    exportDailyExcel();
    exportEntitiesToExcel();
    showNotification('تم تصدير جميع التقارير بنجاح', 'success');
}

// ===== إعدادات النظام =====
function saveSystemSettings() {
    SYSTEM_SETTINGS.systemName = document.getElementById('systemName').value;
    SYSTEM_SETTINGS.defaultCapacity = parseInt(document.getElementById('defaultCapacity').value) || 33000;
    SYSTEM_SETTINGS.showNotifications = document.getElementById('showNotifications').value === 'true';
    SYSTEM_SETTINGS.autoBackup = document.getElementById('autoBackup').value;
    SYSTEM_SETTINGS.theme = document.getElementById('systemTheme').value;

    localStorage.setItem("fuelSystemSettings", JSON.stringify(SYSTEM_SETTINGS));
    document.getElementById('capacity').value = SYSTEM_SETTINGS.defaultCapacity;
    document.title = SYSTEM_SETTINGS.systemName;
    showNotification('تم حفظ إعدادات النظام بنجاح', 'success');
}

function resetSystemSettings() {
    showConfirmDialog('استعادة الإعدادات الافتراضية', 'هل تريد استعادة جميع إعدادات النظام إلى القيم الافتراضية؟', function() {
        SYSTEM_SETTINGS = {
            systemName: "نظام تجهيز الوقود المتقدم", defaultCapacity: 33000,
            showNotifications: true, autoBackup: "daily", theme: "blue",
            language: "ar", quickAdd: true, autoSave: true
        };
        localStorage.setItem("fuelSystemSettings", JSON.stringify(SYSTEM_SETTINGS));
        loadSettings();
        document.getElementById('capacity').value = SYSTEM_SETTINGS.defaultCapacity;
        document.title = SYSTEM_SETTINGS.systemName;
        showNotification('تم استعادة الإعدادات الافتراضية بنجاح', 'success');
    });
}

function loadSettings() {
    document.getElementById('systemName').value = SYSTEM_SETTINGS.systemName;
    document.getElementById('defaultCapacity').value = SYSTEM_SETTINGS.defaultCapacity;
    document.getElementById('showNotifications').value = SYSTEM_SETTINGS.showNotifications.toString();
    document.getElementById('autoBackup').value = SYSTEM_SETTINGS.autoBackup;
    document.getElementById('systemTheme').value = SYSTEM_SETTINGS.theme;
}

// ===== صيانة النظام =====
function showConfirmDialog(title, message, confirmCallback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmDialog').classList.remove('hidden');

    document.getElementById('confirmYes').onclick = function() {
        document.getElementById('confirmDialog').classList.add('hidden');
        confirmCallback();
    };
    document.getElementById('confirmNo').onclick = function() {
        document.getElementById('confirmDialog').classList.add('hidden');
    };
}

function deleteTodayData() {
    const today = document.getElementById('today').value;
    showConfirmDialog('مسح سجلات اليوم', `هل تريد مسح جميع سجلات اليوم (${today})؟`, function() {
        const initialLength = LOGS.length;
        LOGS = LOGS.filter(log => !(log.date === today && log.type === 'fuel'));
        if (LOGS.length < initialLength) {
            localStorage.setItem("fuelLogs", JSON.stringify(LOGS));
            updateAllRows();
            updateStatistics();
            showNotification(`تم مسح ${initialLength - LOGS.length} سجل من اليوم`, 'success');
        } else {
            showNotification('لا توجد سجلات لهذا اليوم', 'info');
        }
    });
}

function deleteAllLogs() {
    showConfirmDialog('مسح جميع السجلات', 'هل تريد مسح جميع سجلات النظام؟', function() {
        LOGS = [];
        localStorage.setItem("fuelLogs", JSON.stringify(LOGS));
        updateAllRows();
        updateStatistics();
        showNotification('تم مسح جميع السجلات بنجاح', 'success');
    });
}

function deleteAllEntities() {
    showConfirmDialog('مسح جميع الجهات', 'هل تريد مسح جميع الجهات؟', function() {
        ENTITIES = [];
        localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
        loadEntitiesToTable();
        loadEntitiesToFilter();
        if (CURRENT_ROLE === 'admin' || CURRENT_ROLE === 'supervisor') loadEntitiesList();
        showNotification('تم مسح جميع الجهات بنجاح', 'success');
    });
}

function deleteAllNotifications() {
    showConfirmDialog('مسح جميع الإشعارات', 'هل تريد مسح جميع الإشعارات والإعلانات؟', function() {
        NOTIFICATIONS = [];
        ANNOUNCEMENTS = [];
        localStorage.setItem("fuelNotifications", JSON.stringify(NOTIFICATIONS));
        localStorage.setItem("fuelAnnouncements", JSON.stringify(ANNOUNCEMENTS));
        loadNotifications();
        loadAnnouncements();
        showNotification('تم مسح جميع الإشعارات والإعلانات', 'success');
    });
}

function resetAllSettings() {
    resetSystemSettings();
}

function deleteAllData() {
    showConfirmDialog('مسح جميع بيانات النظام',
        '⚠️ تحذير شديد: هذا الإجراء سيحذف جميع الجهات، السجلات، الإشعارات، الإعلانات، والإعدادات. لا يمكن التراجع عنه!',
        function() {
            ENTITIES = [];
            LOGS = [];
            NOTIFICATIONS = [];
            ANNOUNCEMENTS = [];
            SYSTEM_SETTINGS = {
                systemName: "نظام تجهيز الوقود المتقدم", defaultCapacity: 33000,
                showNotifications: true, autoBackup: "daily", theme: "blue",
                language: "ar", quickAdd: true, autoSave: true
            };
            localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
            localStorage.setItem("fuelLogs", JSON.stringify(LOGS));
            localStorage.setItem("fuelNotifications", JSON.stringify(NOTIFICATIONS));
            localStorage.setItem("fuelAnnouncements", JSON.stringify(ANNOUNCEMENTS));
            localStorage.setItem("fuelSystemSettings", JSON.stringify(SYSTEM_SETTINGS));
            localStorage.setItem("lastCleanupDate", new Date().toISOString());

            loadEntitiesToTable();
            loadEntitiesToFilter();
            if (CURRENT_ROLE === 'admin' || CURRENT_ROLE === 'supervisor') loadEntitiesList();
            loadNotifications();
            loadAnnouncements();
            loadSettings();
            updateStatistics();
            showNotification('تم مسح جميع بيانات النظام بنجاح', 'success');
        }
    );
}

function exportCurrentData() {
    const data = {
        entities: ENTITIES, logs: LOGS,
        notifications: NOTIFICATIONS, announcements: ANNOUNCEMENTS,
        settings: SYSTEM_SETTINGS,
        exportDate: new Date().toISOString(), version: "1.0"
    };
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `نسخة_احتياطية_${new Date().toISOString().slice(0, 10)}.json`);
    linkElement.click();
    localStorage.setItem("lastBackupDate", new Date().toISOString());
    updateMaintenanceStats();
    showNotification("تم تصدير نسخة احتياطية من البيانات", 'success');
}

function importBackupData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const backup = JSON.parse(event.target.result);
                showConfirmDialog('استيراد نسخة احتياطية',
                    `هل تريد استيراد النسخة الاحتياطية بتاريخ ${new Date(backup.exportDate).toLocaleString('ar-IQ')}؟`,
                    function() {
                        ENTITIES = backup.entities || ENTITIES;
                        LOGS = backup.logs || LOGS;
                        NOTIFICATIONS = backup.notifications || NOTIFICATIONS;
                        ANNOUNCEMENTS = backup.announcements || ANNOUNCEMENTS;
                        SYSTEM_SETTINGS = backup.settings || SYSTEM_SETTINGS;
                        localStorage.setItem("fuelEntities", JSON.stringify(ENTITIES));
                        localStorage.setItem("fuelLogs", JSON.stringify(LOGS));
                        localStorage.setItem("fuelNotifications", JSON.stringify(NOTIFICATIONS));
                        localStorage.setItem("fuelAnnouncements", JSON.stringify(ANNOUNCEMENTS));
                        localStorage.setItem("fuelSystemSettings", JSON.stringify(SYSTEM_SETTINGS));
                        loadEntitiesToTable();
                        loadEntitiesToFilter();
                        if (CURRENT_ROLE === 'admin' || CURRENT_ROLE === 'supervisor') loadEntitiesList();
                        loadNotifications();
                        loadAnnouncements();
                        loadSettings();
                        updateStatistics();
                        showNotification('تم استيراد النسخة الاحتياطية بنجاح', 'success');
                    }
                );
            } catch (error) {
                showNotification("فشل في استيراد النسخة. تأكد من صحة الملف", 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function updateMaintenanceStats() {
    const totalSize = JSON.stringify(ENTITIES).length + JSON.stringify(LOGS).length +
        JSON.stringify(NOTIFICATIONS).length + JSON.stringify(ANNOUNCEMENTS).length +
        JSON.stringify(SYSTEM_SETTINGS).length + JSON.stringify(USERS).length;
    document.getElementById('dataSize').textContent = (totalSize / 1024).toFixed(2) + ' KB';

    const lastBackup = localStorage.getItem("lastBackupDate");
    document.getElementById('lastBackup').textContent = lastBackup
        ? new Date(lastBackup).toLocaleDateString('ar-IQ') : '--';

    const lastCleanup = localStorage.getItem("lastCleanupDate");
    document.getElementById('lastCleanup').textContent = lastCleanup
        ? new Date(lastCleanup).toLocaleDateString('ar-IQ') : '--';
}

// ===== دوال التبويب =====
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));

    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');

    if (tabName === 'maintenance') updateMaintenanceStats();
}

// ===== تسجيل الدخول والخروج =====
function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const loginMsg = document.getElementById('loginMsg');

    if (!username || !password) {
        loginMsg.textContent = "يرجى إدخال اسم المستخدم وكلمة المرور";
        loginMsg.style.display = 'block';
        return;
    }

    if (USERS[username] && USERS[username].pass === password) {
        CURRENT_USER = username;
        CURRENT_ROLE = USERS[username].role;

        LOGS.push({
            type: 'login', user: CURRENT_USER,
            userDisplay: USERS[CURRENT_USER]?.name || CURRENT_USER,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString(),
            action: 'تسجيل دخول'
        });
        localStorage.setItem("fuelLogs", JSON.stringify(LOGS));

        USERS[username].lastLogin = new Date().toISOString();
        localStorage.setItem("fuelSystemUsers", JSON.stringify(USERS));

        document.getElementById('loginBox').classList.add('hidden');
        document.getElementById('systemBox').classList.remove('hidden');
        initSystem();
        showNotification(`مرحباً ${USERS[username].name}!`, 'success');
    } else {
        loginMsg.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة";
        loginMsg.style.display = 'block';
    }
}

function logout() {
    if (confirm("هل أنت متأكد من تسجيل الخروج؟")) {
        LOGS.push({
            type: 'logout', user: CURRENT_USER,
            userDisplay: USERS[CURRENT_USER]?.name || CURRENT_USER,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString(),
            action: 'تسجيل خروج'
        });
        localStorage.setItem("fuelLogs", JSON.stringify(LOGS));

        CURRENT_USER = null;
        CURRENT_ROLE = null;
        document.getElementById('systemBox').classList.add('hidden');
        document.getElementById('loginBox').classList.remove('hidden');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('loginMsg').style.display = 'none';
    }
}

// ===== تهيئة النظام =====
function initSystem() {
    const todayInput = document.getElementById('today');
    todayInput.valueAsDate = new Date();

    loadEntitiesToTable();
    loadEntitiesToFilter();
    updateUserDisplay();

    if (CURRENT_ROLE === 'admin' || CURRENT_ROLE === 'supervisor') {
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('quickAddSection').classList.remove('hidden');
        loadUsersList();
        loadEntitiesList();
        loadNotifications();
        loadAnnouncements();
        loadSettings();
    }
    updateStatistics();
}

function saveAllChanges() {
    saveAllEntities();
    if (CURRENT_ROLE === 'admin' || CURRENT_ROLE === 'supervisor') saveSystemSettings();
    showNotification('تم حفظ جميع التغييرات في النظام', 'success');
}

// ===== تهيئة عند التحميل =====
window.addEventListener('load', function() {
    const todayInput = document.getElementById('today');
    if (todayInput) todayInput.valueAsDate = new Date();
    if (SYSTEM_SETTINGS.defaultCapacity) {
        document.getElementById('capacity').value = SYSTEM_SETTINGS.defaultCapacity;
    }
});
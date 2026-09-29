(() => {
  'use strict';

  const TIME_ZONE = 'Asia/Seoul';
  const STORAGE_PREFIX = 'lunchmoa:daily:v1:';
  const MAX_MENU_LENGTH = 60;

  const form = document.querySelector('#menu-form');
  const menuInput = document.querySelector('#menu-input');
  const menuList = document.querySelector('#menu-list');
  const emptyState = document.querySelector('#empty-state');
  const menuCount = document.querySelector('#menu-count');
  const feedback = document.querySelector('#form-feedback');
  const characterCount = document.querySelector('#char-count');
  const characterCounter = document.querySelector('#char-counter');
  const weekdayElement = document.querySelector('#today-weekday');
  const dateElement = document.querySelector('#today-date');
  const storageNoteTitle = document.querySelector('#storage-note-title');
  const storageNoteDescription = document.querySelector('#storage-note-description');

  if (
    !form || !menuInput || !menuList || !emptyState || !menuCount ||
    !feedback || !characterCount || !characterCounter || !weekdayElement ||
    !dateElement || !storageNoteTitle || !storageNoteDescription
  ) {
    return;
  }

  const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: TIME_ZONE,
    weekday: 'long'
  });
  const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit'
  });

  let todayKey = getKoreanDateKey(new Date());
  let storageAvailable = true;
  let state = readDailyState(todayKey);

  function getKoreanDateKey(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value])
    );
    return `${values.year}-${values.month}-${values.day}`;
  }

  function updateDateDisplay(date) {
    const dateKey = getKoreanDateKey(date);
    weekdayElement.textContent = weekdayFormatter.format(date);
    dateElement.textContent = dateFormatter.format(date);
    dateElement.dateTime = dateKey;
    return dateKey;
  }

  function dailyStorageKey(dateKey) {
    return `${STORAGE_PREFIX}${dateKey}`;
  }

  function createEmptyState() {
    return { menus: [] };
  }

  function normalizeMenuName(value) {
    return typeof value === 'string' ? value.trim().normalize('NFC') : '';
  }

  function menuNameKey(value) {
    return normalizeMenuName(value).toLocaleLowerCase('ko-KR');
  }

  function validIsoDate(value) {
    const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(timestamp)
      ? new Date(timestamp).toISOString()
      : new Date().toISOString();
  }

  function normalizeSavedState(saved) {
    if (!saved || typeof saved !== 'object') {
      return createEmptyState();
    }

    const menus = [];
    const menuIds = new Set();
    const menuNames = new Set();
    const savedMenus = Array.isArray(saved.menus) ? saved.menus : [];

    savedMenus.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }

      const name = normalizeMenuName(entry.name);
      if (!name || Array.from(name).length > MAX_MENU_LENGTH) {
        return;
      }

      const nameKey = menuNameKey(name);
      const id = typeof entry.id === 'string' ? entry.id.trim() : '';
      if (!id || menuIds.has(id) || menuNames.has(nameKey)) {
        return;
      }

      menus.push({
        id,
        name,
        createdAt: validIsoDate(entry.createdAt)
      });
      menuIds.add(id);
      menuNames.add(nameKey);
    });

    menus.sort((first, second) => {
      const timeDifference = Date.parse(first.createdAt) - Date.parse(second.createdAt);
      return timeDifference || first.id.localeCompare(second.id);
    });

    return { menus };
  }

  function readDailyState(dateKey) {
    let savedText;
    try {
      savedText = window.localStorage.getItem(dailyStorageKey(dateKey));
    } catch {
      storageAvailable = false;
      return createEmptyState();
    }

    if (!savedText) {
      return createEmptyState();
    }

    try {
      return normalizeSavedState(JSON.parse(savedText));
    } catch {
      return createEmptyState();
    }
  }

  function saveDailyState() {
    try {
      window.localStorage.setItem(
        dailyStorageKey(todayKey),
        JSON.stringify({ version: 1, menus: state.menus })
      );
      storageAvailable = true;
      return true;
    } catch {
      storageAvailable = false;
      return false;
    }
  }

  function updateStorageNote() {
    if (storageAvailable) {
      storageNoteTitle.textContent = '메뉴는 이 브라우저에 날짜별로 저장돼요.';
      storageNoteDescription.textContent = '다른 브라우저나 기기와 공유되지 않아요.';
      return;
    }

    storageNoteTitle.textContent = '브라우저 저장 공간을 사용할 수 없어요.';
    storageNoteDescription.textContent = '현재 화면에만 임시로 유지돼요. 새로고침하면 메뉴 목록이 사라질 수 있어요.';
  }

  function updateCharacterCount() {
    const length = Array.from(menuInput.value).length;
    characterCount.textContent = `${length} / ${MAX_MENU_LENGTH}`;
    characterCounter.classList.toggle('is-near-limit', length >= MAX_MENU_LENGTH - 5);
  }

  function setMenuFeedback(message, type = '', options = {}) {
    feedback.textContent = message;
    feedback.dataset.validation = options.validation ? 'true' : 'false';
    feedback.classList.toggle('is-error', type === 'error');
    feedback.classList.toggle('is-success', type === 'success');
    menuInput.setAttribute('aria-invalid', options.invalid ? 'true' : 'false');
  }

  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '방금 등록' : timeFormatter.format(date);
  }

  function createMenuItem(menu, index) {
    const item = document.createElement('li');
    item.className = 'menu-item';

    const number = document.createElement('span');
    number.className = 'menu-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = String(index + 1).padStart(2, '0');

    const copy = document.createElement('div');
    copy.className = 'menu-item-copy';

    const name = document.createElement('span');
    name.className = 'menu-name';
    name.textContent = menu.name;

    const meta = document.createElement('span');
    meta.className = 'menu-item-meta';
    const label = document.createElement('span');
    label.textContent = '오늘 등록';
    const separator = document.createElement('span');
    separator.className = 'meta-dot';
    separator.setAttribute('aria-hidden', 'true');
    const time = document.createElement('time');
    time.dateTime = menu.createdAt;
    time.textContent = formatTime(menu.createdAt);
    meta.append(label, separator, time);
    copy.append(name, meta);

    item.append(number, copy);
    return item;
  }

  function renderMenus() {
    const fragment = document.createDocumentFragment();

    state.menus.slice().reverse().forEach((menu, index) => {
      fragment.appendChild(createMenuItem(menu, index));
    });
    menuList.replaceChildren(fragment);

    const hasMenus = state.menus.length > 0;
    menuList.hidden = !hasMenus;
    emptyState.hidden = hasMenus;
    menuCount.textContent = String(state.menus.length);
    menuCount.setAttribute('aria-label', `${state.menus.length}개 메뉴`);
  }

  function handleKoreanDayChange() {
    const nextDateKey = updateDateDisplay(new Date());
    if (nextDateKey === todayKey) {
      return false;
    }

    todayKey = nextDateKey;
    state = readDailyState(todayKey);
    updateStorageNote();
    setMenuFeedback('');
    renderMenus();
    return true;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleKoreanDayChange();

    const name = normalizeMenuName(menuInput.value);
    const nameLength = Array.from(name).length;

    if (!name) {
      setMenuFeedback('메뉴 이름을 입력해 주세요.', 'error', { validation: true, invalid: true });
      menuInput.focus();
      return;
    }

    if (nameLength > MAX_MENU_LENGTH) {
      setMenuFeedback(`메뉴 이름은 ${MAX_MENU_LENGTH}자 이내로 입력해 주세요.`, 'error', {
        validation: true,
        invalid: true
      });
      menuInput.focus();
      return;
    }

    const nameKey = menuNameKey(name);
    if (state.menus.some((menu) => menuNameKey(menu.name) === nameKey)) {
      setMenuFeedback('오늘 이미 등록된 메뉴예요. 다른 메뉴를 입력해 주세요.', 'error', {
        validation: true,
        invalid: true
      });
      menuInput.focus();
      return;
    }

    const menu = {
      id: typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `menu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      name,
      createdAt: new Date().toISOString()
    };
    state.menus.push(menu);
    const saved = saveDailyState();
    updateStorageNote();
    renderMenus();

    menuInput.value = '';
    updateCharacterCount();
    if (saved) {
      setMenuFeedback(`‘${name}’ 메뉴를 오늘의 목록에 추가했어요.`, 'success');
    } else {
      setMenuFeedback(
        `‘${name}’ 메뉴를 화면에 추가했지만 저장하지 못했어요. 새로고침하면 사라질 수 있어요.`,
        'error'
      );
    }
    menuInput.focus();
  });

  menuInput.addEventListener('input', () => {
    updateCharacterCount();
    if (feedback.dataset.validation === 'true') {
      setMenuFeedback('');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      handleKoreanDayChange();
    }
  });
  window.addEventListener('focus', handleKoreanDayChange);
  window.setInterval(handleKoreanDayChange, 60_000);
  window.addEventListener('storage', (event) => {
    if (event.key === dailyStorageKey(todayKey) || event.key === null) {
      state = readDailyState(todayKey);
      updateStorageNote();
      renderMenus();
    }
  });

  updateDateDisplay(new Date());
  updateStorageNote();
  renderMenus();
  updateCharacterCount();
})();

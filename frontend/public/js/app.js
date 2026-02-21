// ====== Config ======
// Use environment config if available, fallback to defaults for development
const BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || "http://localhost:8082";
const API = `${BASE_URL}/api/v1`;
const STORAGE_TOKEN = "token";
const STORAGE_PROFILE = "wellnessProfile";
const STORAGE_NAMES_PREFIX = "wellnessProfileName:";
const STORAGE_POINTS = "wellnessPoints";
const STORAGE_STREAK = "wellnessStreak";
const STORAGE_LAST_CHECK = "wellnessLastCheckDate";
const STORAGE_THEME = "wellnessTheme";

// ====== Theme (Dark Mode) ======
const Theme = {
  init() {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;

    // Load saved theme or respect system preference
    const savedTheme = localStorage.getItem(STORAGE_THEME);
    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
    // If no saved theme, the CSS handles system preference automatically

    // Toggle handler
    toggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

      let newTheme;
      if (current === "dark") {
        newTheme = "light";
      } else if (current === "light") {
        newTheme = "dark";
      } else {
        // No explicit theme set, toggle from system preference
        newTheme = prefersDark ? "light" : "dark";
      }

      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem(STORAGE_THEME, newTheme);
    });

    // Listen for system preference changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      // Only apply if user hasn't manually set a preference
      // CSS handles this automatically via the media query
    });
  }
};

// Initialize theme immediately to prevent flash
Theme.init();

// ====== Mood Tracking ======
const Mood = {
  selectedScore: null,
  selectedTags: new Set(),
  selectedSleepQuality: null,
  selectedSleepHours: null,
  _bound: false,

  // Tag definitions by mood type
  tagSets: {
    positive: [ // For moods 4-5
      { id: 'exercise', emoji: '🏃', label: 'Ejercicio' },
      { id: 'social', emoji: '👥', label: 'Vida social' },
      { id: 'nature', emoji: '🌳', label: 'Naturaleza' },
      { id: 'achievement', emoji: '🎯', label: 'Logro personal' },
      { id: 'goodsleep', emoji: '😴', label: 'Buen descanso' },
      { id: 'hobby', emoji: '🎨', label: 'Hobby/Pasatiempo' },
    ],
    neutral: [ // For mood 3
      { id: 'work', emoji: '💼', label: 'Trabajo/Estudio' },
      { id: 'routine', emoji: '📋', label: 'Día normal' },
      { id: 'weather', emoji: '🌤️', label: 'Clima' },
      { id: 'social', emoji: '👥', label: 'Vida social' },
      { id: 'tired', emoji: '😪', label: 'Cansancio' },
    ],
    negative: [ // For moods 1-2
      { id: 'stress', emoji: '😰', label: 'Estrés' },
      { id: 'badsleep', emoji: '😫', label: 'Mal descanso' },
      { id: 'anxiety', emoji: '😟', label: 'Ansiedad' },
      { id: 'loneliness', emoji: '🫥', label: 'Soledad' },
      { id: 'overwork', emoji: '📚', label: 'Sobrecarga' },
      { id: 'conflict', emoji: '💢', label: 'Conflicto' },
    ]
  },

  async init() {
    if (!elements.moodOptions) return;

    // Bind event listeners only once
    if (!this._bound) {
      elements.moodOptions.querySelectorAll(".mood-btn").forEach(btn => {
        btn.addEventListener("click", () => this.selectMood(btn));
      });

      // Bind sleep quality button events
      document.querySelectorAll(".sleep-quality-btn").forEach(btn => {
        btn.addEventListener("click", () => this.toggleSleepQuality(btn));
      });

      // Bind sleep wheel controls
      const wheelUp = document.getElementById("sleepWheelUp");
      const wheelDown = document.getElementById("sleepWheelDown");
      const wheelDisplay = document.getElementById("sleepWheelDisplay");

      wheelUp?.addEventListener("click", () => this.adjustSleepHours(0.5));
      wheelDown?.addEventListener("click", () => this.adjustSleepHours(-0.5));

      // Add wheel scroll support
      wheelDisplay?.addEventListener("wheel", (e) => {
        e.preventDefault();
        this.adjustSleepHours(e.deltaY < 0 ? 0.5 : -0.5);
      });

      if (elements.btnSaveMood) {
        elements.btnSaveMood.addEventListener("click", () => this.saveMood());
      }
      if (elements.btnCancelMood) {
        elements.btnCancelMood.addEventListener("click", () => this.cancelMood());
      }
      this._bound = true;
    }

    // Reset UI state
    this.resetUI();

    // Check if already logged today and load history
    await this.checkTodayStatus();
    await this.loadRecentMoods();

    // Initialize calendar
    this.initCalendar();
  },

  resetUI() {
    this.selectedScore = null;
    this.selectedTags.clear();
    this.selectedSleepQuality = null;
    this.selectedSleepHours = null;
    elements.moodOptions?.classList.remove("hidden");
    elements.moodNotesPanel?.classList.add("hidden");
    elements.moodLoggedPanel?.classList.add("hidden");
    elements.moodOptions?.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("is-selected"));
    document.querySelectorAll(".mood-tag").forEach(t => t.classList.remove("is-selected"));
    document.querySelectorAll(".sleep-quality-btn").forEach(b => b.classList.remove("is-selected"));
    if (elements.moodNotes) elements.moodNotes.value = "";
    this.updateSleepDisplay();
    this.renderTags(null);
  },

  renderTags(score) {
    const container = document.getElementById("moodTagsOptions");
    const label = document.getElementById("moodTagsLabel");
    if (!container) return;

    // Clear previous tags and selection
    container.innerHTML = "";
    this.selectedTags.clear();

    if (!score) return;

    // Determine which tag set to use
    let tags, labelText;
    if (score >= 4) {
      tags = this.tagSets.positive;
      labelText = "¿Qué te hizo sentir bien? (opcional)";
    } else if (score === 3) {
      tags = this.tagSets.neutral;
      labelText = "¿Qué influyó en tu día? (opcional)";
    } else {
      tags = this.tagSets.negative;
      labelText = "¿Qué te afectó? (opcional)";
    }

    if (label) label.textContent = labelText;

    // Render tags
    tags.forEach(tag => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mood-tag";
      btn.dataset.tag = tag.id;
      btn.textContent = `${tag.emoji} ${tag.label}`;
      btn.addEventListener("click", () => this.toggleTag(btn));
      container.appendChild(btn);
    });
  },

  toggleTag(tagBtn) {
    const tag = tagBtn.dataset.tag;
    if (this.selectedTags.has(tag)) {
      this.selectedTags.delete(tag);
      tagBtn.classList.remove("is-selected");
    } else {
      this.selectedTags.add(tag);
      tagBtn.classList.add("is-selected");
    }
  },

  toggleSleepQuality(btn) {
    const quality = parseInt(btn.dataset.quality);
    document.querySelectorAll(".sleep-quality-btn").forEach(b => b.classList.remove("is-selected"));
    if (this.selectedSleepQuality === quality) {
      this.selectedSleepQuality = null;
    } else {
      this.selectedSleepQuality = quality;
      btn.classList.add("is-selected");
    }
  },

  adjustSleepHours(delta) {
    if (this.selectedSleepHours === null) {
      this.selectedSleepHours = 7; // Default starting value
    }
    this.selectedSleepHours = Math.max(0, Math.min(24, this.selectedSleepHours + delta));
    // Round to nearest 0.5
    this.selectedSleepHours = Math.round(this.selectedSleepHours * 2) / 2;
    this.updateSleepDisplay();
  },

  updateSleepDisplay() {
    const display = document.getElementById("sleepHoursValue");
    if (display) {
      display.textContent = this.selectedSleepHours !== null ? this.selectedSleepHours.toFixed(1) : "--";
    }
  },

  selectMood(btn) {
    // Clear previous selection
    elements.moodOptions.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("is-selected"));

    // Select this one
    btn.classList.add("is-selected");
    this.selectedScore = parseInt(btn.dataset.score);

    // Render appropriate tags for this mood
    this.renderTags(this.selectedScore);

    // Show notes panel
    elements.moodNotesPanel?.classList.remove("hidden");
  },

  cancelMood() {
    this.selectedScore = null;
    this.selectedTags.clear();
    this.selectedSleepQuality = null;
    this.selectedSleepHours = null;
    elements.moodOptions.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("is-selected"));
    document.querySelectorAll(".mood-tag").forEach(t => t.classList.remove("is-selected"));
    document.querySelectorAll(".sleep-quality-btn").forEach(b => b.classList.remove("is-selected"));
    elements.moodNotesPanel?.classList.add("hidden");
    if (elements.moodNotes) elements.moodNotes.value = "";
    this.updateSleepDisplay();
    this.renderTags(null);
  },

  async saveMood() {
    if (!this.selectedScore) return;

    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) return;

    const notes = elements.moodNotes?.value?.trim() || null;
    const tags = this.selectedTags.size > 0 ? [...this.selectedTags].join(',') : null;
    const sleepHours = this.selectedSleepHours;
    const sleepQuality = this.selectedSleepQuality;

    try {
      elements.btnSaveMood.disabled = true;
      elements.btnSaveMood.textContent = "Guardando...";

      const res = await fetch(`${API}/mood`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ score: this.selectedScore, notes, tags, sleepHours, sleepQuality })
      });

      if (res.ok) {
        const data = await res.json();
        this.showLoggedState(data.emoji);
        await this.loadRecentMoods();
        await this.loadCalendar();
        showToast("¡Estado de ánimo registrado!");
        // Check for new achievements
        Achievements.checkNew();
      } else {
        const err = await res.json();
        showToast(err.error || "Error al guardar");
      }
    } catch (e) {
      console.error("Mood save error:", e);
      showToast("Error de conexión");
    } finally {
      elements.btnSaveMood.disabled = false;
      elements.btnSaveMood.textContent = "Guardar";
    }
  },

  showLoggedState(emoji) {
    elements.moodOptions?.classList.add("hidden");
    elements.moodNotesPanel?.classList.add("hidden");
    elements.moodLoggedPanel?.classList.remove("hidden");
    if (elements.loggedMoodEmoji) elements.loggedMoodEmoji.textContent = emoji;
  },

  async checkTodayStatus() {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) return;

    try {
      const res = await fetch(`${API}/mood/today`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.emoji) {
          this.showLoggedState(data.emoji);
        }
      }
    } catch (e) {
      console.error("Check today mood error:", e);
    }
  },

  async loadRecentMoods() {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token || !elements.moodHistoryDots) return;

    try {
      const res = await fetch(`${API}/mood/recent`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const moods = await res.json();
        this.renderHistoryDots(moods);
      }
    } catch (e) {
      console.error("Load recent moods error:", e);
    }
  },

  renderHistoryDots(moods) {
    if (!elements.moodHistoryDots) return;

    if (!moods || moods.length === 0) {
      elements.moodHistoryDots.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem;">Últimos 7 días aparecerán aquí</p>';
      return;
    }

    // Show last 7 entries
    elements.moodHistoryDots.innerHTML = "";
    moods.slice(0, 7).forEach(mood => {
      const date = new Date(mood.createdAt);
      const dayName = date.toLocaleDateString("es", { weekday: "short" }).slice(0, 2);
      const dot = document.createElement("div");
      dot.className = "mood-dot";
      dot.dataset.score = mood.score;
      dot.dataset.date = dayName;
      dot.title = mood.label || "";
      dot.textContent = mood.emoji || "";
      elements.moodHistoryDots.appendChild(dot);
    });
  },

  // ===== Calendar =====
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth() + 1,
  calendarData: {},
  _calendarBound: false,
  isCompact: true,

  initCalendar() {
    if (!elements.moodCalendar || this._calendarBound) return;

    // Bind navigation buttons
    elements.btnPrevMonth?.addEventListener("click", () => this.prevMonth());
    elements.btnNextMonth?.addEventListener("click", () => this.nextMonth());
    elements.btnToggleCalendar?.addEventListener("click", () => this.toggleCalendar());

    this._calendarBound = true;
    this.loadCalendar();
  },

  toggleCalendar() {
    this.isCompact = !this.isCompact;
    elements.moodCalendar?.classList.toggle("mood-calendar--compact", this.isCompact);
    this.renderCalendar();
  },

  async loadCalendar() {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token || !elements.calendarGrid) return;

    try {
      const res = await fetch(`${API}/mood/calendar?year=${this.calendarYear}&month=${this.calendarMonth}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        this.calendarData = data.entries || {};
        this.renderCalendar();
      }
    } catch (e) {
      console.error("Load calendar error:", e);
    }
  },

  renderCalendar() {
    if (!elements.calendarGrid || !elements.calendarTitle) return;

    if (this.isCompact) {
      this.renderWeekView();
    } else {
      this.renderFullCalendar();
    }
  },

  renderWeekView() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    // Get Monday of current week (0=Sunday, so Monday=1)
    const monday = new Date(today);
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(today.getDate() + diff);

    elements.calendarTitle.textContent = "Esta semana";

    const dayNames = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
    let html = "";

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);

      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const moodData = this.calendarData[dateKey];
      const isToday = date.toDateString() === today.toDateString();
      const isFuture = date > today;

      let classes = "mood-calendar__day";
      if (isToday) classes += " mood-calendar__day--today";
      if (moodData) classes += " mood-calendar__day--has-mood mood-calendar__day--clickable";
      if (isFuture) classes += " mood-calendar__day--future";

      const dataAttrs = moodData ? `data-score="${moodData.score}" data-id="${moodData.id}" data-date="${dateKey}"` : "";
      const titleAttr = moodData ? `title="${dayNames[i]}: ${moodData.label}"` : `title="${dayNames[i]}"`;

      html += `<div class="${classes}" ${dataAttrs} ${titleAttr}>
        <span class="mood-calendar__day-number">${dayNames[i]}</span>
        ${moodData ? `<span class="mood-calendar__day-emoji">${moodData.emoji}</span>` : ""}
      </div>`;
    }

    elements.calendarGrid.innerHTML = html;
    this.bindDayClicks();
  },

  renderFullCalendar() {
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    elements.calendarTitle.textContent = `${monthNames[this.calendarMonth - 1]} ${this.calendarYear}`;

    const firstDay = new Date(this.calendarYear, this.calendarMonth - 1, 1);
    const lastDay = new Date(this.calendarYear, this.calendarMonth, 0);
    const totalDays = lastDay.getDate();

    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    let html = "";

    for (let i = 0; i < startDayOfWeek; i++) {
      html += '<div class="mood-calendar__day mood-calendar__day--empty"></div>';
    }

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === this.calendarYear && (today.getMonth() + 1) === this.calendarMonth;

    for (let day = 1; day <= totalDays; day++) {
      const dateKey = `${this.calendarYear}-${String(this.calendarMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const moodData = this.calendarData[dateKey];
      const isToday = isCurrentMonth && today.getDate() === day;

      let classes = "mood-calendar__day";
      if (isToday) classes += " mood-calendar__day--today";
      if (moodData) classes += " mood-calendar__day--has-mood mood-calendar__day--clickable";

      const dataAttrs = moodData ? `data-score="${moodData.score}" data-id="${moodData.id}" data-date="${dateKey}"` : "";
      const titleAttr = moodData ? `title="${moodData.label}${moodData.notes ? ': ' + moodData.notes : ''}"` : "";

      html += `<div class="${classes}" ${dataAttrs} ${titleAttr}>
        <span class="mood-calendar__day-number">${day}</span>
        ${moodData ? `<span class="mood-calendar__day-emoji">${moodData.emoji}</span>` : ""}
      </div>`;
    }

    elements.calendarGrid.innerHTML = html;
    this.updateNavButtons();
    this.bindDayClicks();
  },

  updateNavButtons() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (elements.btnNextMonth) {
      elements.btnNextMonth.disabled = (this.calendarYear === currentYear && this.calendarMonth === currentMonth);
    }

    if (elements.btnPrevMonth) {
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      const viewing = new Date(this.calendarYear, this.calendarMonth - 1, 1);
      elements.btnPrevMonth.disabled = (viewing <= oneYearAgo);
    }
  },

  prevMonth() {
    this.calendarMonth--;
    if (this.calendarMonth < 1) {
      this.calendarMonth = 12;
      this.calendarYear--;
    }
    this.loadCalendar();
  },

  nextMonth() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (this.calendarYear === currentYear && this.calendarMonth >= currentMonth) {
      return;
    }

    this.calendarMonth++;
    if (this.calendarMonth > 12) {
      this.calendarMonth = 1;
      this.calendarYear++;
    }
    this.loadCalendar();
  },

  bindDayClicks() {
    const days = document.querySelectorAll(".mood-calendar__day--clickable");
    days.forEach(day => {
      day.addEventListener("click", () => {
        const moodId = day.dataset.id;
        const dateKey = day.dataset.date;
        if (moodId && dateKey) {
          MoodDetailModal.open(moodId, dateKey, this.calendarData[dateKey]);
        }
      });
    });
  }
};

// ====== Mood Detail Modal ======
const MoodDetailModal = {
  currentMoodId: null,
  currentData: null,
  editScore: null,
  editSleepHours: null,
  editSleepQuality: null,
  _bound: false,

  init() {
    if (this._bound) return;

    // Detail modal bindings
    document.getElementById("moodDetailClose")?.addEventListener("click", () => this.close());
    document.getElementById("moodDetailBackdrop")?.addEventListener("click", () => this.close());
    document.getElementById("btnEditMood")?.addEventListener("click", () => this.openEditModal());
    document.getElementById("btnDeleteMood")?.addEventListener("click", () => this.deleteMood());

    // Edit modal bindings
    document.getElementById("moodEditClose")?.addEventListener("click", () => this.closeEdit());
    document.getElementById("btnCancelEdit")?.addEventListener("click", () => this.closeEdit());
    document.getElementById("btnSaveEdit")?.addEventListener("click", () => this.saveEdit());

    // Edit mood buttons
    document.querySelectorAll("#moodEditOptions .mood-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => this.selectEditScore(btn));
    });

    // Edit sleep controls
    document.getElementById("moodEditSleepUp")?.addEventListener("click", () => this.adjustEditSleep(0.5));
    document.getElementById("moodEditSleepDown")?.addEventListener("click", () => this.adjustEditSleep(-0.5));

    // Edit sleep quality buttons
    document.querySelectorAll("#moodEditQualityOptions .sleep-quality-btn").forEach(btn => {
      btn.addEventListener("click", () => this.selectEditQuality(btn));
    });

    // Keyboard close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeEdit();
        this.close();
      }
    });

    this._bound = true;
  },

  open(moodId, dateKey, data) {
    this.currentMoodId = moodId;
    this.currentData = data;

    // Format date
    const dateParts = dateKey.split("-");
    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = date.toLocaleDateString('es', options);

    // Populate modal
    document.getElementById("moodDetailDate").textContent = formattedDate;
    document.getElementById("moodDetailEmoji").textContent = data.emoji || "😐";
    document.getElementById("moodDetailLabel").textContent = data.label || "Sin registro";

    // Tags
    const tagsSection = document.getElementById("moodDetailTagsSection");
    const tagsContainer = document.getElementById("moodDetailTags");
    if (data.tags) {
      tagsContainer.innerHTML = "";
      data.tags.split(",").forEach(tag => {
        const span = document.createElement("span");
        span.className = "mood-detail__tag";
        span.textContent = this.getTagLabel(tag.trim(), data.score);
        tagsContainer.appendChild(span);
      });
      tagsSection.classList.remove("hidden");
    } else {
      tagsSection.classList.add("hidden");
    }

    // Sleep
    const sleepSection = document.getElementById("moodDetailSleepSection");
    if (data.sleepHours !== null && data.sleepHours !== undefined) {
      document.getElementById("moodDetailSleepHours").textContent = `${data.sleepHours} hrs`;
      if (data.sleepQuality) {
        const qualityEmojis = ["", "😫", "😴", "😐", "😊", "🌟"];
        document.getElementById("moodDetailSleepQuality").textContent = qualityEmojis[data.sleepQuality] || "";
      } else {
        document.getElementById("moodDetailSleepQuality").textContent = "";
      }
      sleepSection.classList.remove("hidden");
    } else {
      sleepSection.classList.add("hidden");
    }

    // Notes
    const notesSection = document.getElementById("moodDetailNotesSection");
    if (data.notes) {
      document.getElementById("moodDetailNotes").textContent = data.notes;
      notesSection.classList.remove("hidden");
    } else {
      notesSection.classList.add("hidden");
    }

    // Show modal
    document.getElementById("moodDetailBackdrop").classList.remove("hidden");
    document.getElementById("moodDetailModal").classList.remove("hidden");
  },

  close() {
    document.getElementById("moodDetailBackdrop")?.classList.add("hidden");
    document.getElementById("moodDetailModal")?.classList.add("hidden");
    this.currentMoodId = null;
    this.currentData = null;
  },

  getTagLabel(tagId, score) {
    // Determine which tag set to search
    let tagSet;
    if (score >= 4) {
      tagSet = Mood.tagSets.positive;
    } else if (score === 3) {
      tagSet = Mood.tagSets.neutral;
    } else {
      tagSet = Mood.tagSets.negative;
    }

    const tag = tagSet.find(t => t.id === tagId);
    return tag ? `${tag.emoji} ${tag.label}` : tagId;
  },

  openEditModal() {
    if (!this.currentData) return;

    // Initialize edit values
    this.editScore = this.currentData.score;
    this.editSleepHours = this.currentData.sleepHours;
    this.editSleepQuality = this.currentData.sleepQuality;

    // Set mood score
    document.querySelectorAll("#moodEditOptions .mood-edit-btn").forEach(btn => {
      btn.classList.toggle("is-selected", parseInt(btn.dataset.score) === this.editScore);
    });

    // Set notes
    document.getElementById("moodEditNotes").value = this.currentData.notes || "";

    // Set sleep hours
    this.updateEditSleepDisplay();

    // Set sleep quality
    document.querySelectorAll("#moodEditQualityOptions .sleep-quality-btn").forEach(btn => {
      btn.classList.toggle("is-selected", parseInt(btn.dataset.quality) === this.editSleepQuality);
    });

    // Close detail modal and show edit modal
    document.getElementById("moodDetailModal").classList.add("hidden");
    document.getElementById("moodEditModal").classList.remove("hidden");
  },

  closeEdit() {
    document.getElementById("moodEditModal")?.classList.add("hidden");
    // Re-open detail modal
    document.getElementById("moodDetailModal")?.classList.remove("hidden");
  },

  selectEditScore(btn) {
    document.querySelectorAll("#moodEditOptions .mood-edit-btn").forEach(b => b.classList.remove("is-selected"));
    btn.classList.add("is-selected");
    this.editScore = parseInt(btn.dataset.score);
  },

  adjustEditSleep(delta) {
    if (this.editSleepHours === null || this.editSleepHours === undefined) {
      this.editSleepHours = 7;
    }
    this.editSleepHours = Math.max(0, Math.min(24, this.editSleepHours + delta));
    this.editSleepHours = Math.round(this.editSleepHours * 2) / 2;
    this.updateEditSleepDisplay();
  },

  updateEditSleepDisplay() {
    const display = document.getElementById("moodEditSleepValue");
    if (display) {
      display.textContent = this.editSleepHours !== null && this.editSleepHours !== undefined
        ? this.editSleepHours.toFixed(1)
        : "--";
    }
  },

  selectEditQuality(btn) {
    document.querySelectorAll("#moodEditQualityOptions .sleep-quality-btn").forEach(b => b.classList.remove("is-selected"));
    btn.classList.add("is-selected");
    this.editSleepQuality = parseInt(btn.dataset.quality);
  },

  async saveEdit() {
    if (!this.currentMoodId || !this.editScore) return;

    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) return;

    const notes = document.getElementById("moodEditNotes")?.value?.trim() || null;

    try {
      const btnSave = document.getElementById("btnSaveEdit");
      btnSave.disabled = true;
      btnSave.textContent = "Guardando...";

      const res = await fetch(`${API}/mood/${this.currentMoodId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          score: this.editScore,
          notes: notes,
          tags: this.currentData.tags, // Keep original tags for now
          sleepHours: this.editSleepHours,
          sleepQuality: this.editSleepQuality
        })
      });

      if (res.ok) {
        showToast("Registro actualizado");
        this.closeEdit();
        this.close();
        // Reload calendar data
        await Mood.loadCalendar();
        await Mood.loadRecentMoods();
      } else {
        const err = await res.json();
        showToast(err.error || "Error al guardar");
      }
    } catch (e) {
      console.error("Update mood error:", e);
      showToast("Error de conexión");
    } finally {
      const btnSave = document.getElementById("btnSaveEdit");
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = "Guardar";
      }
    }
  },

  async deleteMood() {
    if (!this.currentMoodId) return;

    if (!confirm("¿Estás seguro de que quieres eliminar este registro?")) return;

    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) return;

    try {
      const btnDelete = document.getElementById("btnDeleteMood");
      btnDelete.disabled = true;
      btnDelete.textContent = "Eliminando...";

      const res = await fetch(`${API}/mood/${this.currentMoodId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.ok) {
        showToast("Registro eliminado");
        this.close();
        // Reload calendar data
        await Mood.loadCalendar();
        await Mood.loadRecentMoods();
        // Check achievements since count changed
        Achievements.checkNew();
      } else {
        const err = await res.json();
        showToast(err.error || "Error al eliminar");
      }
    } catch (e) {
      console.error("Delete mood error:", e);
      showToast("Error de conexión");
    } finally {
      const btnDelete = document.getElementById("btnDeleteMood");
      if (btnDelete) {
        btnDelete.disabled = false;
        btnDelete.textContent = "Eliminar";
      }
    }
  }
};

// Endpoints de recursos
const RESOURCES_PUBLIC_URL = `${API}/resources/public`;
const RESOURCES_ADMIN_URL  = `${API}/resources`;

// ====== Referencias UI ======

const elements = {
  // auth
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginStatus: document.getElementById("loginStatus"),
  googleLogin: document.getElementById("googleLogin"),
  registerForm: document.getElementById("registerForm"),
  registerStatus: document.getElementById("registerStatus"),

  // dashboard + historial
  dashboardGreeting: document.getElementById("dashboardGreeting"),
  dashboardDate: document.getElementById("dashboardDate"),
  btnLogout: document.getElementById("btnLogout"),
  btnStartGad7: document.getElementById("btnStartGad7"),
  btnStartPhq9: document.getElementById("btnStartPhq9"),
  btnOpenHistory: document.getElementById("btnOpenHistory"),
  btnCloseHistory: document.getElementById("btnCloseHistory"),
  historyPanel: document.getElementById("historyPanel"),
  historyList: document.getElementById("historyList"),
  btnOpenProgress: document.getElementById("btnOpenProgress"),
  btnCloseProgress: document.getElementById("btnCloseProgress"),
  progressPanel: document.getElementById("progressPanel"),
  historyFilterType: document.getElementById("historyFilterType"),
  historyFilterRange: document.getElementById("historyFilterRange"),
  heroPoints: document.querySelector("#view-dashboard .hero-points"),

  // mood tracker
  moodTracker: document.getElementById("moodTracker"),
  moodOptions: document.getElementById("moodOptions"),
  moodNotesPanel: document.getElementById("moodNotesPanel"),
  moodNotes: document.getElementById("moodNotes"),
  btnCancelMood: document.getElementById("btnCancelMood"),
  btnSaveMood: document.getElementById("btnSaveMood"),
  moodLoggedPanel: document.getElementById("moodLoggedPanel"),
  loggedMoodEmoji: document.getElementById("loggedMoodEmoji"),
  moodHistoryDots: document.getElementById("moodHistoryDots"),

  // mood calendar
  moodCalendar: document.getElementById("moodCalendar"),
  calendarTitle: document.getElementById("calendarTitle"),
  calendarGrid: document.getElementById("calendarGrid"),
  btnPrevMonth: document.getElementById("btnPrevMonth"),
  btnNextMonth: document.getElementById("btnNextMonth"),
  btnToggleCalendar: document.getElementById("btnToggleCalendar"),

  // assessment
  btnBackToDashboard: document.getElementById("btnBackToDashboard"),
  assessmentTitle: document.getElementById("assessmentTitle"),
  assessmentStep: document.getElementById("assessmentStep"),
  assessmentProgress: document.getElementById("assessmentProgress"),
  questionCard: document.getElementById("questionCard"),
  btnPrevQuestion: document.getElementById("btnPrevQuestion"),
  btnNextQuestion: document.getElementById("btnNextQuestion"),

  // results
  resultTitle: document.getElementById("resultTitle"),
  resultSummary: document.getElementById("resultSummary"),
  resultDetails: document.getElementById("resultDetails"),
  resultAnalytics: document.getElementById("resultAnalytics"),
  resultAnswersChart: document.getElementById("resultAnswersChart"),
  resultAverage: document.getElementById("resultAverage"),
  resultMax: document.getElementById("resultMax"),
  resultFocus: document.getElementById("resultFocus"),
  btnResultDashboard: document.getElementById("btnResultDashboard"),
  btnResultHistory: document.getElementById("btnResultHistory"),

  // insights
  insightsPanel: document.getElementById("insightsPanel"),
  cardGad7: document.getElementById("cardGad7"),
  cardPhq9: document.getElementById("cardPhq9"),
  chartGad7: document.getElementById("chartGad7"),
  chartPhq9: document.getElementById("chartPhq9"),
  gadCount: document.getElementById("gadCount"),
  gadAverage: document.getElementById("gadAverage"),
  gadTrend: document.getElementById("gadTrend"),
  gadLast: document.getElementById("gadLast"),
  phqCount: document.getElementById("phqCount"),
  phqAverage: document.getElementById("phqAverage"),
  phqTrend: document.getElementById("phqTrend"),
  phqLast: document.getElementById("phqLast"),

  // help
  toast: document.getElementById("toast"),
  helpFab: document.getElementById("helpFab"),
  helpPanel: document.getElementById("helpPanel"),
  helpBackdrop: document.getElementById("helpBackdrop"),
  helpClose: document.getElementById("helpClose"),
  introPanel: document.getElementById("introPanel"),
  coachingPanel: document.getElementById("coachingPanel"),
  openIntro: document.getElementById("openIntro"),
  openCoaching: document.getElementById("openCoaching"),

  // admin
  btnOpenAdmin: document.getElementById("btnOpenAdmin"),
  btnBackFromAdmin: document.getElementById("btnBackFromAdmin"),
  jwtPayload: document.getElementById("jwtPayload"),
  btnRefreshPayload: document.getElementById("btnRefreshPayload"),

  // resources
  btnOpenResources: document.getElementById("btnOpenResources"),
  btnBackFromResources: document.getElementById("btnBackFromResources"),
  resourcesList: document.getElementById("resourcesList"),
  resourceSearch: document.getElementById("resourceSearch"),
  resourceFilterCategory: document.getElementById("resourceFilterCategory"),
  resourceUploader: document.getElementById("resourceUploader"),
  formResourceUpload: document.getElementById("formResourceUpload"),
  resTitle: document.getElementById("resTitle"),
  resDesc: document.getElementById("resDesc"),
  resCat: document.getElementById("resCat"),
  resFile: document.getElementById("resFile"),
  resUploadStatus: document.getElementById("resUploadStatus"),

  // breathing exercises
  btnOpenBreathing: document.getElementById("btnOpenBreathing"),
  btnBackFromBreathing: document.getElementById("btnBackFromBreathing"),
  breathingExercises: document.getElementById("breathingExercises"),
  breathingActive: document.getElementById("breathingActive"),
  breathingComplete: document.getElementById("breathingComplete"),
  breathingCircle: document.getElementById("breathingCircle"),
  breathingInstruction: document.getElementById("breathingInstruction"),
  breathingTimer: document.getElementById("breathingTimer"),
  breathingExerciseName: document.getElementById("breathingExerciseName"),
  breathingCycle: document.getElementById("breathingCycle"),
  btnStopBreathing: document.getElementById("btnStopBreathing"),
  btnPauseBreathing: document.getElementById("btnPauseBreathing"),
  btnBreathingAgain: document.getElementById("btnBreathingAgain"),
  btnBreathingDone: document.getElementById("btnBreathingDone"),
  breathingCompleteDuration: document.getElementById("breathingCompleteDuration"),
  breathingCompleteCycles: document.getElementById("breathingCompleteCycles"),

  // settings
  btnOpenSettings: document.getElementById("btnOpenSettings"),
  btnBackFromSettings: document.getElementById("btnBackFromSettings"),
};

let currentUser = null;
let currentAssessment = null;
let cachedHistory = [];
let cachedResources = [];

// ====== Util ======

// HTML escape function to prevent XSS attacks
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function showView(id) {
  // Oculta todas las vistas y quita el flag de activa
  document.querySelectorAll('.view').forEach(v => {
    v.classList.add('hidden');
    v.classList.remove('view--active');
  });

  // Muestra la vista destino y márcala como activa
  const view = document.getElementById(id);
  if (view) {
    view.classList.remove('hidden');
    view.classList.add('view--active');
  } else {
    // fallback defensivo: vuelve al login si no existe la vista
    const login = document.getElementById('view-login');
    if (login) {
      login.classList.remove('hidden');
      login.classList.add('view--active');
    }
  }
      //  Renderizar botón Google cuando se muestra la vista login
    if (id === "view-login") {
        initGoogleLogin();
    }
    if (id === "view-register") initGoogleLoginRegister();

}


function getToken() { return localStorage.getItem(STORAGE_TOKEN) || ""; }
function setToken(t) { localStorage.setItem(STORAGE_TOKEN, t); }
function clearToken() { localStorage.removeItem(STORAGE_TOKEN); }
function storeProfile(p) { localStorage.setItem(STORAGE_PROFILE, JSON.stringify(p)); }
function loadStoredProfile() {
  const raw = localStorage.getItem(STORAGE_PROFILE);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function clearProfile() { localStorage.removeItem(STORAGE_PROFILE); }
function storeDisplayName(email, name) {
  if (!email || !name) return;
  localStorage.setItem(STORAGE_NAMES_PREFIX + email.toLowerCase(), name);
}
function getDisplayName(email) {
  if (!email) return "";
  return localStorage.getItem(STORAGE_NAMES_PREFIX + email.toLowerCase()) || email.split("@")[0];
}
function setStatus(el, message, type) {
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("is-error", "is-success");
  if (type === "error") el.classList.add("is-error");
  if (type === "success") el.classList.add("is-success");
}
function showToast(message, duration = 3000) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
}
function formatToday() {
  const now = new Date();
  return new Intl.DateTimeFormat("es-GT", { weekday: "long", day: "numeric", month: "long" }).format(now);
}
function decodeJwtPayload(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch { return null; }
}
function decodeJwtRole(token) {
  const p = decodeJwtPayload(token);
  return p && p.role ? String(p.role) : null;
}

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`; // ej: 2025-11-16
}

function parseDateKey(key) {
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function diffInDays(startKey, endKey) {
  const a = parseDateKey(startKey);
  const b = parseDateKey(endKey);
  if (!a || !b) return 0;
  const ms = b - a;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function loadGamificationState() {
  return {
    points: Number(localStorage.getItem(STORAGE_POINTS) || "0"),
    streak: Number(localStorage.getItem(STORAGE_STREAK) || "0"),
    lastDate: localStorage.getItem(STORAGE_LAST_CHECK) || ""
  };
}

function saveGamificationState(state) {
  localStorage.setItem(STORAGE_POINTS, String(state.points || 0));
  localStorage.setItem(STORAGE_STREAK, String(state.streak || 0));
  if (state.lastDate) {
    localStorage.setItem(STORAGE_LAST_CHECK, state.lastDate);
  }
}

function updateHeroGamification() {
  if (!elements.heroPoints) return;
  const { points, streak } = loadGamificationState();

  // limpiar clases antes
  elements.heroPoints.classList.remove("hot");

  if (!points && !streak) {
    elements.heroPoints.textContent = "+10 puntos al completar";
    return;
  }

  const sLabel = streak === 1 ? "día" : "días";
  elements.heroPoints.textContent = `Racha: ${streak} ${sLabel} · Puntos: ${points}`;

  if (streak >= 5) {
    elements.heroPoints.classList.add("hot");
  }
}

function registerCheckinGamification() {
  const today = getTodayKey();
  const state = loadGamificationState();
  let { points, streak, lastDate } = state;

  if (!lastDate) {
    // primera evaluación
    streak = 1;
  } else {
    const diff = diffInDays(lastDate, today);
    if (diff === 0) {
      // misma fecha: no se rompe la racha, pero tampoco se suma día
    } else if (diff === 1) {
      // siguiente día consecutivo
      streak += 1;
    } else if (diff > 1) {
      // se rompió la racha
      streak = 1;
    }
  }

  // +10 puntos por CADA evaluación completada
  points += 10;
  lastDate = today;

  saveGamificationState({ points, streak, lastDate });
  updateHeroGamification();
}



// ====== Auth bootstrap ======
function ensureAuth() {
  // Check for password reset token in URL first
  const resetToken = new URLSearchParams(window.location.search).get("token");
  if (resetToken) {
    checkResetPasswordToken();
    return;
  }

  const token = getToken();
  const profile = loadStoredProfile();
  if (token && profile) {
    currentUser = profile;
    updateDashboard();
    updateAdminVisibility();
    showView("view-dashboard");
    loadHistory();
  } else {
    showView("view-login");
    cachedHistory = [];
    renderInsights([]);
    initGoogleLogin();
  }
}
function updateDashboard() {
  if (!currentUser) return;
  elements.dashboardGreeting && (elements.dashboardGreeting.textContent = `Hola, ${currentUser.name}`);
  elements.dashboardDate && (elements.dashboardDate.textContent = formatToday());
  updateHeroGamification();

  // Initialize mood tracker
  Mood.init();
  MoodDetailModal.init();

  // Load achievements
  Achievements.render();

  // Load AI insights (non-blocking)
  AiInsights.load(false);
}

function updateAdminVisibility() {
  const isAdmin = currentUser && currentUser.role === "ADMIN";
  elements.btnOpenAdmin && elements.btnOpenAdmin.classList.toggle("hidden", !isAdmin);
}

// ====== fetch helper ======
async function fetchJson(url, { method="GET", headers={}, body, auth=false, timeoutMs=10000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const finalHeaders = { ...headers };
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }
  if (body && !finalHeaders["Content-Type"]) finalHeaders["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(url, { method, headers: finalHeaders, body, signal: controller.signal });
  } finally { clearTimeout(t); }

  if (res.status === 401) { clearToken(); clearProfile(); }
  const text = await res.text();
  const json = text ? ( (() => { try { return JSON.parse(text); } catch { return null; } })() ) : null;
  if (!res.ok) {
    const msg = (json && (json.message || json.error)) || text || `Error ${res.status}`;
    throw new Error(msg);
  }
  return json ?? {};
}

// ====== API ======
function apiLogin(email, password) {
  return fetchJson(`${API}/auth/login`, { method: "POST", body: JSON.stringify({ email, password }) });
}
function apiRegister(email, password) {
  return fetchJson(`${API}/auth/register`, { method: "POST", body: JSON.stringify({ email, password }) });
}
function apiGad7(answers, options = {}) {
  const payload = {
    answers,
    ...(typeof options.save === "boolean" ? { save: options.save } : {}),
    ...(options.notes ? { notes: options.notes } : {}),
  };
  return fetchJson(`${API}/assessments/gad7`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

function apiPhq9(answers, options={}) {
  const payload = { answers, ...(typeof options.save === "boolean" ? {save: options.save} : {}), ...(options.notes ? {notes: options.notes} : {}) };
  return fetchJson(`${API}/assessments/phq9`, { method: "POST", auth: true, body: JSON.stringify(payload) });
}
function apiHistory() {
  return fetchJson(`${API}/assessments/history`, { auth: true });
}
function apiGoogleLogin(idToken) {
  return fetchJson(`${API}/auth/google`, {
    method: "POST",
    body: JSON.stringify({ idToken })
  });
}

function apiAiInsights(refresh = false) {
  return fetchJson(`${API}/ai/insights?refresh=${refresh}`, { auth: true, timeoutMs: 30000 });
}
function apiAiAssessmentAnalysis(assessmentType, total, category, answers) {
  return fetchJson(`${API}/ai/assessment-analysis`, {
    method: "POST", auth: true, timeoutMs: 30000,
    body: JSON.stringify({ assessmentType, total, category, answers })
  });
}


// ====== Google Login ======
// Get Google Client ID from environment config
function getGoogleClientId() {
  return (window.APP_CONFIG && window.APP_CONFIG.GOOGLE_CLIENT_ID) || null;
}

function isGoogleLoginEnabled() {
  return window.APP_CONFIG && window.APP_CONFIG.ENABLE_GOOGLE_LOGIN && getGoogleClientId();
}

/**
 * Renderiza los botones de Google en login y registro.
 * Se llama cada vez que se entra a la vista de login.
 */
let googleInitialized = false;

function initGoogleLogin() {
  // Check if Google login is enabled
  if (!isGoogleLoginEnabled()) {
    const loginBtn = document.getElementById("googleLoginBtn");
    const registerBtn = document.getElementById("googleRegisterBtn");
    if (loginBtn) loginBtn.style.display = 'none';
    if (registerBtn) registerBtn.style.display = 'none';
    return;
  }

  // Esperar a que Google Identity cargue
  if (!window.google || !google.accounts || !google.accounts.id) {
    setTimeout(initGoogleLogin, 300);
    return;
  }

  // Inicializar Google Login (solo una vez)
  if (!googleInitialized) {
    google.accounts.id.initialize({
      client_id: getGoogleClientId(),
      callback: handleGoogleLogin,
      ux_mode: "popup", // Use popup instead of FedCM/redirect
    });
    googleInitialized = true;
  }

  // Render Google buttons in containers (they'll be visible and styled)
  const loginContainer = document.getElementById("googleLogin");
  const registerContainer = document.getElementById("googleLoginRegister");

  if (loginContainer && !loginContainer.hasChildNodes()) {
    google.accounts.id.renderButton(loginContainer, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: 280,
    });
  }

  if (registerContainer && !registerContainer.hasChildNodes()) {
    google.accounts.id.renderButton(registerContainer, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signup_with",
      shape: "rectangular",
      width: 280,
    });
  }

  // Hide custom buttons and show Google's native buttons
  const loginBtn = document.getElementById("googleLoginBtn");
  const registerBtn = document.getElementById("googleRegisterBtn");
  if (loginBtn) loginBtn.style.display = 'none';
  if (registerBtn) registerBtn.style.display = 'none';
}

/**
 * Callback cuando Google devuelve el token.
 */
async function handleGoogleLogin(response) {
  try {
    const idToken = response.credential;

    const data = await apiGoogleLogin(idToken);

    // Guardar sesión igual que login normal
    setToken(data.token);
    const name = data.name || getDisplayName(data.email);
    const role = data.role || "USER";

    currentUser = {
      email: data.email,
      userId: data.userId,
      name,
      role,
    };
    storeDisplayName(data.email, name);
    storeProfile(currentUser);
    updateDashboard();
    updateAdminVisibility();

    showToast("Inicio de sesión con Google exitoso ✨");
    showView("view-dashboard");
    loadHistory();

  } catch (err) {
    console.error("Error Google login:", err);
    showToast("No se pudo iniciar sesión con Google.");
  }
}

// Renderizar Google Login automáticamente al mostrar login
const originalShowView = showView;
showView = function (id) {
  originalShowView(id);
  if (id === "view-login" || id === "view-register") {
    initGoogleLogin();
  }
};

//RegistroGoogle - now handled by initGoogleLogin with custom buttons
function initGoogleLoginRegister() {
  // Custom buttons are now handled by initGoogleLogin
  initGoogleLogin();
}





// ====== Datos de cuestionarios ======

const DAILY_OPTIONS = [
  { value: 0, label: "Nada hoy" },
  { value: 1, label: "Un poco" },
  { value: 2, label: "Bastante" },
  { value: 3, label: "Mucho" }
];


const GAD7_QUESTIONS = [
  { emoji: "😟", title: "¿Te sentiste nervioso o ansioso hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #ffe9f3, #f3f4ff)" },

  { emoji: "🤯", title: "¿Hoy te costó controlar tus preocupaciones?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #e8f5ff, #f3edff)" },

  { emoji: "🔄", title: "¿Sentiste que te preocupaste más de lo normal hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #fff2de, #f7edff)" },

  { emoji: "😣", title: "¿Tuviste dificultad para relajarte durante el día?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #ffe8e8, #fff1f7)" },

  { emoji: "🪑", title: "¿Estuviste inquieto o te costó estar quieto hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #e9fff1, #f0f3ff)" },

  { emoji: "😠", title: "¿Te irritaste o te molestaste fácilmente hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #f0efff, #e0f7ff)" },

  { emoji: "⚠️", title: "¿Sentiste miedo o como que algo malo podía pasar hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #fff0e6, #f5ebff)" }
];
const PHQ9_QUESTIONS = [
  { emoji: "🌤️", title: "¿Hoy sentiste poco interés o motivación para hacer cosas?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #fff0e6, #f8e9ff)" },

  { emoji: "😞", title: "¿Te sentiste triste o desanimado hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #e8f4ff, #fff0f8)" },

  { emoji: "😴", title: "¿Tuviste problemas de sueño (o demasiado sueño) hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #f0f4ff, #fff3e6)" },

  { emoji: "🍽️", title: "¿Notaste cambios en tu apetito por cómo te sentías hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #fff0f5, #edf6ff)" },

  { emoji: "💨", title: "¿Sentiste poca energía o mucho cansancio hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #f4e9ff, #fff4ea)" },

  { emoji: "💭", title: "¿Te sentiste mal contigo mismo hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #f0ffef, #f4ebff)" },

  { emoji: "🧠", title: "¿Hoy te costó concentrarte?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #e8f9ff, #f5f0ff)" },

  { emoji: "🚶", title: "¿Estuviste inquieto o más lento de lo habitual hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #ffeef2, #eef6ff)" },

  { emoji: "❤️‍🩹", title: "¿Tuviste pensamientos negativos sobre ti o tu futuro hoy?", options: DAILY_OPTIONS, tint: "linear-gradient(160deg, #ffe8e8, #fff4f7)" }
];


// ====== Flujo de evaluación ======
function startAssessment(type) {
  const dataset = type === "phq9" ? PHQ9_QUESTIONS : GAD7_QUESTIONS;
  currentAssessment = {
    type,
    questions: dataset,
    answers: Array(dataset.length).fill(undefined),
    index: 0,
    title: type === "phq9" ? "Resultados PHQ-9" : "Check-in de Bienestar (GAD-7)",
  };
  renderAssessment();
  showView("view-assessment");
}

function renderAssessment() {
  if (!currentAssessment) return;
  const { questions, index, title, answers } = currentAssessment;
  const q = questions[index];

  elements.assessmentTitle.textContent = title;
  elements.assessmentStep.textContent = `Pregunta ${index + 1} de ${questions.length}`;
  elements.assessmentProgress.style.width = `${((index + 1) / questions.length) * 100}%`;

  elements.questionCard.innerHTML = "";
  // Only apply tint in light mode; in dark mode, let CSS handle the background
  const isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
  elements.questionCard.style.background = isDarkMode ? "" : (q.tint || "");
  elements.questionCard.style.color = "";

  const header = document.createElement("div");
  header.className = "question-header";
  const emoji = document.createElement("div");
  emoji.className = "question-emoji";
  emoji.textContent = q.emoji || "😊";
  const titleEl = document.createElement("h3");
  titleEl.className = "question-title";
  titleEl.textContent = q.title;
  const subtitleEl = document.createElement("p");
  subtitleEl.className = "question-subtitle";
  subtitleEl.textContent = q.subtitle || "";
  header.append(emoji, titleEl, subtitleEl);
  elements.questionCard.append(header);

  if (q.options) {
    const list = document.createElement("div");
    list.className = "option-list";
    q.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-button";
      btn.textContent = opt.label;
      if (answers[index] === opt.value) btn.classList.add("is-selected");
      btn.addEventListener("click", () => {
        currentAssessment.answers[index] = opt.value;
        renderAssessment();
        updateAssessmentControls();
      });
      list.append(btn);
    });
    elements.questionCard.append(list);
  }
  updateAssessmentControls();
}

function updateAssessmentControls() {
  if (!currentAssessment) return;
  const { index, answers, questions } = currentAssessment;
  const hasAnswer = typeof answers[index] === "number";
  elements.btnPrevQuestion && (elements.btnPrevQuestion.disabled = index === 0);
  if (elements.btnNextQuestion) {
    elements.btnNextQuestion.disabled = !hasAnswer;
    elements.btnNextQuestion.textContent = index === questions.length - 1 ? "Finalizar" : "Siguiente";
  }
}

async function submitAssessment() {
  if (!currentAssessment) return;
  const { type, answers } = currentAssessment;
  const payload = answers.map(a => Number(a ?? 0));
  try {
    if (elements.btnNextQuestion) {
      elements.btnNextQuestion.disabled = true;
      elements.btnNextQuestion.textContent = "Enviando...";
    }
    const response = type === "phq9" ? await apiPhq9(payload) : await apiGad7(payload);
    showResult(response, type, payload.slice());
    currentAssessment = null;
    registerCheckinGamification();
    await loadHistory();
    // Check for new achievements
    Achievements.checkNew();
  } catch (e) {
    console.error(e);
    showToast("No se pudo enviar la evaluación. Inténtalo nuevamente.");
    if (elements.btnNextQuestion) {
      elements.btnNextQuestion.disabled = false;
      updateAssessmentControls();
    }
  } finally {
    const assessmentView = document.getElementById("view-assessment");
    if (elements.btnNextQuestion && assessmentView && !assessmentView.classList.contains("hidden")) {
      elements.btnNextQuestion.textContent = "Finalizar";
    }
  }
}

function showResult(result, type, answers) {
  showView("view-result");

  // ==========================
  // 1) Calcular totalScore
  // ==========================
  const totalScore = Number(result.total || 0);

  // ==========================
  // 2) Obtener configuración dinámica (colores, emoji, nivel)
  // ==========================
  const cfg = getLevelConfig(totalScore, type); // <-- ahora funciona
  const card = document.querySelector(".result-card");

  // Fondo dinámico
  if (card) {
    card.style.background = "#ffffff";   // fondo blanco fijo
    card.style.border = "1px solid #eee"; // borde tenue opcional

  }

  // Título dinámico
  elements.resultTitle.textContent =
    `Resultado: ${cfg.level}`;

  // Resumen dinámico adaptado a check-in diario
  let dailyMsg = "";
  switch (cfg.level) {
    case "Mínimo":
      dailyMsg = "Hoy tuviste un día emocionalmente estable ✨🧘";
      break;
    case "Leve":
      dailyMsg = "Presentaste algunas molestias emocionales, nada grave 💛";
      break;
    case "Moderado":
      dailyMsg = "Tu día fue retador. Respira, estás haciendo un buen trabajo 🧡";
      break;
    case "Moderadamente severo":
      dailyMsg = "Ha sido un día difícil, gracias por registrarlo ❤️‍🩹";
      break;
    case "Severo":
      dailyMsg = "Tu estado fue muy intenso hoy. Considera hablar con alguien 💗";
      break;
  }
  elements.resultSummary.textContent = dailyMsg;

  // ==========================
  // 3) Detalles oficiales (backend)
  // ==========================
  elements.resultDetails.innerHTML = "";

  const items = [
    `Puntaje total: ${result.total} (${result.category})`,
    `Interpretación clínica: ${result.message || "Consulta con un especialista si lo necesitas."}`
  ];

  if (result.createdAt) {
    items.push(`Registrado el ${new Date(result.createdAt).toLocaleString("es-GT")}`);
  }

  items.forEach(t => {
    const li = document.createElement("li");
    li.textContent = t;
    elements.resultDetails.append(li);
  });

  // ==========================
  // 4) Analíticas + gráfica
  // ==========================
  renderResultAnalytics(type, answers);

  // ==========================
  // 5) Colorear la gráfica según el nivel
  // ==========================
  const chart = document.querySelectorAll("#resultAnswersChart div div:nth-child(2)");
  chart.forEach(bar => {
    bar.style.background = cfg.color;
  });

  // Trigger AI assessment analysis (non-blocking)
  AiInsights.loadAssessmentAnalysis(type, totalScore, result.category, answers);
}


function goToDashboard() { showView("view-dashboard"); updateDashboard(); }

async function loadHistory() {
  if (!currentUser) return;
  try {
    const items = await apiHistory();
    if (!getToken()) {
      showToast("Tu sesión expiró. Inicia sesión nuevamente.");
      showView("view-login");
      cachedHistory = [];
      renderInsights([]);
      return;
    }
    cachedHistory = Array.isArray(items) ? items : [];
    applyHistoryFilters();        
    renderInsights(cachedHistory);
  } catch (e) {
    if (!getToken()) {
      showToast("Tu sesión expiró. Inicia sesión nuevamente.");
      showView("view-login");
      cachedHistory = [];
      renderInsights([]);
      return;
    }
    console.error(e);
    showToast("No se pudo cargar el historial.");
  }
}
// Pagination state for history
let historyDisplayCount = 5;
const HISTORY_PAGE_SIZE = 5;

function renderHistory(items) {
  if (!elements.historyList) return;
  elements.historyList.innerHTML = "";

  if (!items || !items.length) {
    const li = document.createElement("li");
    li.textContent = "Aún no tienes evaluaciones registradas.";
    li.className = "history-empty";
    elements.historyList.append(li);
    return;
  }

  const reversedItems = items.slice().reverse();
  const itemsToShow = reversedItems.slice(0, historyDisplayCount);
  const hasMore = reversedItems.length > historyDisplayCount;

  itemsToShow.forEach(item => {
    const li = document.createElement("li");
    li.className = "history-item";

    const left = document.createElement("div");
    left.className = "history-item-left";

    const type = document.createElement("strong");
    type.className = "history-item-type";
    type.textContent = item.type;

    const date = document.createElement("small");
    date.className = "history-item-date";
    date.textContent = new Date(item.createdAt).toLocaleString("es-GT");

    left.append(type, date);

    const score = document.createElement("strong");
    score.className = "history-item-score";
    score.textContent = item.total;

    li.append(left, score);
    elements.historyList.append(li);
  });

  // Add "Load more" button if there are more items
  if (hasMore) {
    const loadMoreLi = document.createElement("li");
    loadMoreLi.className = "history-load-more";

    const loadMoreBtn = document.createElement("button");
    loadMoreBtn.className = "btn btn--light history-load-more-btn";
    loadMoreBtn.textContent = `Ver más (${reversedItems.length - historyDisplayCount} restantes)`;
    loadMoreBtn.addEventListener("click", () => {
      historyDisplayCount += HISTORY_PAGE_SIZE;
      renderHistory(items);
    });

    loadMoreLi.append(loadMoreBtn);
    elements.historyList.append(loadMoreLi);
  }

  // Add "Show less" button if showing more than initial
  if (historyDisplayCount > HISTORY_PAGE_SIZE && itemsToShow.length > HISTORY_PAGE_SIZE) {
    const showLessLi = document.createElement("li");
    showLessLi.className = "history-show-less";

    const showLessBtn = document.createElement("button");
    showLessBtn.className = "btn btn--secondary history-show-less-btn";
    showLessBtn.textContent = "Mostrar menos";
    showLessBtn.addEventListener("click", () => {
      historyDisplayCount = HISTORY_PAGE_SIZE;
      renderHistory(items);
    });

    showLessLi.append(showLessBtn);
    elements.historyList.append(showLessLi);
  }
}

// Reset pagination when filters change
function resetHistoryPagination() {
  historyDisplayCount = HISTORY_PAGE_SIZE;
}


function applyHistoryFilters(resetPagination = true) {
  if (resetPagination) {
    resetHistoryPagination();
  }

  if (!Array.isArray(cachedHistory)) {
    renderHistory([]);
    return;
  }

  const type = (elements.historyFilterType?.value || "").toUpperCase();
  const range = elements.historyFilterRange?.value || "all";

  let filtered = [...cachedHistory];

  // Filtrar por tipo: GAD7 / PHQ9
  if (type) {
    filtered = filtered.filter(item => {
      const t = String(item.type || "").toUpperCase();
      return t === type;
    });
  }

  // Filtrar por rango de días
  if (range !== "all") {
    const days = Number(range) || 0;
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    filtered = filtered.filter(item => {
      const rawDate = item.createdAt || item.date || item.timestamp;
      if (!rawDate) return false;
      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime())) return false;
      return d >= cutoff;
    });
  }

  renderHistory(filtered);
}


// ====== Insights helpers ======
function normalizeAssessmentType(value) {
  const t = String(value || "").toLowerCase();
  if (t.includes("phq")) return "phq9";
  if (t.includes("gad")) return "gad7";
  return null;
}
function formatInsightDate(d) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}
function capitalize(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : ""; }
function formatTrend(change) {
  if (change > 0) return `↑ +${change} pts (subió)`;
  if (change < 0) return `↓ ${Math.abs(change)} pts (mejoró)`;
  return "→ Sin cambios";
}
function drawLineChart(svg, values, { max } = {}) {
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (!values || !values.length) return;

  const ns = "http://www.w3.org/2000/svg";
  const height = 40, width = 100;
  const vmax = max || Math.max(...values, 1);
  const vals = values.map(v => Math.max(0, Number(v) || 0));
  const step = vals.length > 1 ? width / (vals.length - 1) : 0;
  const pts = vals.map((v, i) => ({ x: vals.length > 1 ? i * step : width / 2, y: height - (v / vmax) * height }));

  for (let i = 1; i < 4; i++) {
    const line = document.createElementNS(ns, "line");
    const y = (height / 4) * i;
    line.setAttribute("x1", "0"); line.setAttribute("y1", y);
    line.setAttribute("x2", String(width)); line.setAttribute("y2", y);
    svg.appendChild(line);
  }
  const area = document.createElementNS(ns, "polygon");
  const areaPts = pts.length > 1 ? [[pts[0].x, height], ...pts.map(p => [p.x, p.y]), [pts[pts.length - 1].x, height]] : [[0, height], [pts[0].x, pts[0].y], [width, height]];
  area.setAttribute("points", areaPts.map(p => `${p[0]},${p[1]}`).join(" "));
  svg.appendChild(area);

  const poly = document.createElementNS(ns, "polyline");
  poly.setAttribute("points", pts.map(p => `${p.x},${p.y}`).join(" "));
  svg.appendChild(poly);

  pts.forEach(p => {
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); c.setAttribute("r", 1.8);
    svg.appendChild(c);
  });
}

function renderInsightCard(key, data) {
  const isGad = key === "gad7";
  const card = isGad ? elements.cardGad7 : elements.cardPhq9;
  const chart = isGad ? elements.chartGad7 : elements.chartPhq9;
  const countEl = isGad ? elements.gadCount : elements.phqCount;
  const averageEl = isGad ? elements.gadAverage : elements.phqAverage;
  const trendEl = isGad ? elements.gadTrend : elements.phqTrend;
  const lastEl = isGad ? elements.gadLast : elements.phqLast;
  if (!card) return;

  if (!data || !data.length) {
    card.classList.add("insight-card--empty");
    if (chart) chart.innerHTML = "";
    if (countEl) countEl.textContent = "0";
    if (averageEl) averageEl.textContent = "0";
    if (trendEl) trendEl.textContent = "—";
    if (lastEl) lastEl.textContent = isGad
      ? "Cuando completes evaluaciones verás aquí el detalle más reciente."
      : "Tus resultados más recientes aparecerán aquí al completar evaluaciones.";
    return;
  }

  card.classList.remove("insight-card--empty");
  const sorted = data.slice().sort((a,b) => new Date(a.createdAt||a.date||0) - new Date(b.createdAt||b.date||0));
  const totalCount = sorted.length;
  const chartValues = sorted.slice(-8).map(i => Number(i.total) || 0);
  const avg = sorted.reduce((acc, v) => acc + (Number(v.total)||0), 0) / sorted.length;
  const last = sorted[sorted.length-1];
  const prev = sorted.length > 1 ? sorted[sorted.length-2] : null;
  const change = prev ? (Number(last.total)||0) - (Number(prev.total)||0) : 0;

  if (chart) drawLineChart(chart, chartValues, { max: isGad ? 21 : 27 });
  if (countEl) countEl.textContent = String(totalCount);
  if (averageEl) averageEl.textContent = avg.toFixed(1);
  if (trendEl) trendEl.textContent = totalCount > 1 ? formatTrend(Math.round(change)) : "→ Sin cambios";
  if (lastEl) {
    const category = capitalize(last.category || "");
    const dateText = formatInsightDate(last.createdAt || last.date);
    const pieces = [`Último: ${last.total}`];
    if (category) pieces.push(`(${category})`);
    if (dateText) pieces.push(`· ${dateText}`);
    lastEl.textContent = pieces.join(" ");
  }
}

function renderInsights(items=[]) {
  if (!elements.insightsPanel) return;
  const grouped = { gad7: [], phq9: [] };
  items.forEach(it => {
    const n = normalizeAssessmentType(it.type);
    if (!n) return;
    grouped[n].push({ total: Number(it.total)||0, category: it.category, createdAt: it.createdAt });
  });
  renderInsightCard("gad7", grouped.gad7);
  renderInsightCard("phq9", grouped.phq9);

  // Update data visualization charts
  DataViz.updateAssessmentChart(grouped);
}

// ====== Achievements Module ======
const Achievements = {
  // Define all achievements
  definitions: [
    { id: 'first_mood', icon: '🌟', name: 'Primer Paso', desc: 'Registra tu primer estado de ánimo', check: (stats) => stats.totalMoods >= 1 },
    { id: 'week_streak', icon: '🔥', name: 'En Racha', desc: 'Mantén una racha de 7 días', check: (stats) => stats.currentStreak >= 7 },
    { id: 'month_streak', icon: '💪', name: 'Imparable', desc: 'Mantén una racha de 30 días', check: (stats) => stats.currentStreak >= 30 },
    { id: 'first_gad7', icon: '📋', name: 'Autoconciencia', desc: 'Completa tu primera evaluación GAD-7', check: (stats) => stats.gad7Count >= 1 },
    { id: 'first_phq9', icon: '📝', name: 'Introspección', desc: 'Completa tu primera evaluación PHQ-9', check: (stats) => stats.phq9Count >= 1 },
    { id: 'both_assessments', icon: '🎯', name: 'Explorador', desc: 'Completa ambas evaluaciones', check: (stats) => stats.gad7Count >= 1 && stats.phq9Count >= 1 },
    { id: 'ten_moods', icon: '📊', name: 'Constante', desc: 'Registra 10 estados de ánimo', check: (stats) => stats.totalMoods >= 10 },
    { id: 'fifty_moods', icon: '🏆', name: 'Dedicado', desc: 'Registra 50 estados de ánimo', check: (stats) => stats.totalMoods >= 50 },
    { id: 'five_assessments', icon: '🔬', name: 'Investigador', desc: 'Completa 5 evaluaciones en total', check: (stats) => (stats.gad7Count + stats.phq9Count) >= 5 },
    { id: 'improving', icon: '📈', name: 'Mejorando', desc: 'Tu tendencia de ánimo es positiva', check: (stats) => stats.trend > 0.2 },
  ],

  // Track which achievements were shown as new
  shownAsNew: new Set(JSON.parse(localStorage.getItem('achievementsShown') || '[]')),

  // Get user stats from various sources
  async getStats() {
    const stats = {
      totalMoods: 0,
      currentStreak: 0,
      longestStreak: 0,
      gad7Count: 0,
      phq9Count: 0,
      trend: 0
    };

    try {
      const token = localStorage.getItem(STORAGE_TOKEN);
      const headers = token ? { "Authorization": `Bearer ${token}` } : {};

      // Get mood stats
      const moodRes = await fetch(`${API}/mood/stats?days=365`, { headers });
      if (moodRes.ok) {
        const moodData = await moodRes.json();
        stats.totalMoods = moodData.totalEntries || 0;
        stats.currentStreak = moodData.currentStreak || 0;
        stats.longestStreak = moodData.longestStreak || 0;
        stats.trend = moodData.trend || 0;
      }

      // Get assessment counts
      const histRes = await fetch(`${API}/assessments/history`, { headers });
      if (histRes.ok) {
        const histData = await histRes.json();
        if (Array.isArray(histData)) {
          histData.forEach(item => {
            const type = (item.type || '').toLowerCase();
            if (type.includes('gad')) stats.gad7Count++;
            else if (type.includes('phq')) stats.phq9Count++;
          });
        }
      }
    } catch (e) {
      console.warn('[Achievements] Error fetching stats:', e);
    }

    return stats;
  },

  // Render achievements grid
  async render() {
    const grid = document.getElementById('achievementsGrid');
    const countEl = document.getElementById('achievementsCount');
    if (!grid) return;

    const stats = await this.getStats();
    let unlockedCount = 0;

    grid.innerHTML = '';

    this.definitions.forEach(achievement => {
      const isUnlocked = achievement.check(stats);
      if (isUnlocked) unlockedCount++;

      const isNew = isUnlocked && !this.shownAsNew.has(achievement.id);

      const el = document.createElement('div');
      el.className = `achievement ${isUnlocked ? 'achievement--unlocked' : 'achievement--locked'}${isNew ? ' achievement--new' : ''}`;
      el.innerHTML = `
        <span class="achievement__icon">${achievement.icon}</span>
        <span class="achievement__name">${achievement.name}</span>
        <span class="achievement__tooltip">${isUnlocked ? achievement.desc : '???'}</span>
      `;
      grid.appendChild(el);

      // Mark as shown
      if (isNew) {
        this.shownAsNew.add(achievement.id);
      }
    });

    // Save shown state
    localStorage.setItem('achievementsShown', JSON.stringify([...this.shownAsNew]));

    // Update count
    if (countEl) {
      countEl.textContent = `${unlockedCount}/${this.definitions.length}`;
    }
  },

  // Check for new achievements (call after actions)
  async checkNew() {
    await this.render();
  }
};

// ====== Breathing Exercises Module ======
const Breathing = {
  exercises: {
    box: {
      name: 'Respiración Cuadrada',
      cycles: 4,
      phases: [
        { instruction: 'Inhala', duration: 4 },
        { instruction: 'Retén', duration: 4 },
        { instruction: 'Exhala', duration: 4 },
        { instruction: 'Retén', duration: 4 }
      ]
    },
    '478': {
      name: 'Técnica 4-7-8',
      cycles: 4,
      phases: [
        { instruction: 'Inhala', duration: 4 },
        { instruction: 'Retén', duration: 7 },
        { instruction: 'Exhala', duration: 8 }
      ]
    },
    relaxing: {
      name: 'Respiración Relajante',
      cycles: 6,
      phases: [
        { instruction: 'Inhala', duration: 4 },
        { instruction: 'Exhala', duration: 6 }
      ]
    }
  },

  currentExercise: null,
  currentCycle: 0,
  currentPhase: 0,
  isPaused: false,
  timer: null,
  phaseTimer: null,
  totalSeconds: 0,
  startTime: null,

  init() {
    // Bind exercise card clicks
    document.querySelectorAll('.breathing-card').forEach(card => {
      card.addEventListener('click', () => this.startExercise(card.dataset.exercise));
    });

    // Bind control buttons
    elements.btnStopBreathing?.addEventListener('click', () => this.stop());
    elements.btnPauseBreathing?.addEventListener('click', () => this.togglePause());
    elements.btnBreathingAgain?.addEventListener('click', () => this.reset());
    elements.btnBreathingDone?.addEventListener('click', () => this.finish());
  },

  startExercise(exerciseId) {
    const exercise = this.exercises[exerciseId];
    if (!exercise) return;

    this.currentExercise = { id: exerciseId, ...exercise };
    this.currentCycle = 1;
    this.currentPhase = 0;
    this.isPaused = false;
    this.totalSeconds = 0;
    this.startTime = Date.now();

    // Update UI
    elements.breathingExerciseName.textContent = exercise.name;
    this.updateCycleDisplay();

    // Show active view
    elements.breathingExercises?.classList.add('hidden');
    elements.breathingActive?.classList.remove('hidden');
    elements.breathingComplete?.classList.add('hidden');

    // Start timer
    this.timer = setInterval(() => this.updateTimer(), 1000);

    // Start breathing cycle
    this.runPhase();
  },

  runPhase() {
    if (!this.currentExercise || this.isPaused) return;

    const phase = this.currentExercise.phases[this.currentPhase];
    const circle = elements.breathingCircle;
    const instruction = elements.breathingInstruction;

    // Update instruction
    instruction.textContent = phase.instruction;

    // Remove all animation classes
    circle.classList.remove('inhale', 'hold', 'exhale');

    // Force reflow to reset animation
    void circle.offsetWidth;

    // Set duration and apply new animation
    circle.style.setProperty('--breath-duration', `${phase.duration}s`);

    // Use requestAnimationFrame to ensure the class removal is processed
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (phase.instruction === 'Inhala') {
          circle.classList.add('inhale');
        } else if (phase.instruction === 'Exhala') {
          circle.classList.add('exhale');
        } else {
          circle.classList.add('hold');
        }
      });
    });

    // Schedule next phase
    this.phaseTimer = setTimeout(() => {
      this.currentPhase++;
      if (this.currentPhase >= this.currentExercise.phases.length) {
        this.currentPhase = 0;
        this.currentCycle++;
        if (this.currentCycle > this.currentExercise.cycles) {
          this.complete();
          return;
        }
        this.updateCycleDisplay();
      }
      this.runPhase();
    }, phase.duration * 1000);
  },

  updateTimer() {
    if (this.isPaused) return;
    this.totalSeconds++;
    const mins = Math.floor(this.totalSeconds / 60);
    const secs = this.totalSeconds % 60;
    elements.breathingTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  updateCycleDisplay() {
    elements.breathingCycle.textContent = `Ciclo ${this.currentCycle} de ${this.currentExercise.cycles}`;
  },

  togglePause() {
    this.isPaused = !this.isPaused;
    elements.btnPauseBreathing.textContent = this.isPaused ? 'Continuar' : 'Pausar';

    if (this.isPaused) {
      clearTimeout(this.phaseTimer);
      elements.breathingCircle.style.animationPlayState = 'paused';
    } else {
      elements.breathingCircle.style.animationPlayState = 'running';
      this.runPhase();
    }
  },

  stop() {
    clearInterval(this.timer);
    clearTimeout(this.phaseTimer);
    this.reset();
  },

  complete() {
    clearInterval(this.timer);
    clearTimeout(this.phaseTimer);

    // Show completion
    elements.breathingActive?.classList.add('hidden');
    elements.breathingComplete?.classList.remove('hidden');

    // Update stats
    const mins = Math.floor(this.totalSeconds / 60);
    const secs = this.totalSeconds % 60;
    elements.breathingCompleteDuration.textContent = mins > 0 ? `${mins} min ${secs} seg` : `${secs} segundos`;
    elements.breathingCompleteCycles.textContent = `${this.currentExercise.cycles} ciclos`;
  },

  reset() {
    clearInterval(this.timer);
    clearTimeout(this.phaseTimer);

    this.currentExercise = null;
    this.currentCycle = 0;
    this.currentPhase = 0;
    this.isPaused = false;
    this.totalSeconds = 0;

    // Reset UI
    elements.breathingCircle?.classList.remove('inhale', 'hold', 'exhale');
    elements.breathingTimer.textContent = '0:00';
    elements.btnPauseBreathing.textContent = 'Pausar';

    // Show exercise selection
    elements.breathingExercises?.classList.remove('hidden');
    elements.breathingActive?.classList.add('hidden');
    elements.breathingComplete?.classList.add('hidden');
  },

  finish() {
    this.reset();
    showView('view-dashboard');
  }
};

// ====== Settings Module ======
const Settings = {
  _bound: false,

  init() {
    if (this._bound) return;

    // Theme toggle
    const themeToggle = document.getElementById('settingsThemeToggle');
    if (themeToggle) {
      // Set initial state
      const currentTheme = document.documentElement.getAttribute('data-theme');
      themeToggle.checked = currentTheme === 'dark';

      themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem(STORAGE_THEME, newTheme);
      });
    }

    // Export data button
    document.getElementById('btnExportData')?.addEventListener('click', () => this.exportData());

    // Delete account button
    document.getElementById('btnDeleteAccount')?.addEventListener('click', () => this.openDeleteModal());
    document.getElementById('btnCloseDeleteModal')?.addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('btnCancelDelete')?.addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('deleteAccountBackdrop')?.addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('btnConfirmDelete')?.addEventListener('click', () => this.deleteAccount());

    // Delete confirmation input
    document.getElementById('deleteConfirmation')?.addEventListener('input', (e) => {
      const btn = document.getElementById('btnConfirmDelete');
      if (btn) btn.disabled = e.target.value !== 'ELIMINAR';
    });

    // Change password button - send reset email
    document.getElementById('btnChangePassword')?.addEventListener('click', () => this.sendPasswordResetEmail());

    // Settings logout
    document.getElementById('btnSettingsLogout')?.addEventListener('click', () => {
      logout();
    });

    this._bound = true;
  },

  loadUserData() {
    if (!currentUser) return;

    // Basic info from stored profile
    document.getElementById('settingsName').textContent = currentUser.name || '--';
    document.getElementById('settingsEmail').textContent = currentUser.email || '--';
    document.getElementById('settingsRole').textContent = currentUser.role === 'ADMIN' ? 'Administrador' : 'Usuario';

    // Update theme toggle state
    const themeToggle = document.getElementById('settingsThemeToggle');
    if (themeToggle) {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      themeToggle.checked = currentTheme === 'dark';
    }

    // Load additional user data from API
    this.fetchUserProfile();
  },

  async fetchUserProfile() {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) return;

    try {
      const res = await fetch(`${API}/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        document.getElementById('settingsAge').textContent = data.age || '--';
        document.getElementById('settingsEducation').textContent = data.educationLevel || '--';
        if (data.createdAt) {
          const date = new Date(data.createdAt);
          document.getElementById('settingsMemberSince').textContent = date.toLocaleDateString('es', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      }
    } catch (e) {
      // Silently fail - user info will show defaults
    }
  },

  async exportData() {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) return;

    const btn = document.getElementById('btnExportData');
    const originalText = btn.textContent;
    btn.textContent = 'Exportando...';
    btn.disabled = true;

    try {
      const res = await fetch(`${API}/user/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wellnessapp-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Datos exportados correctamente');
      } else {
        showToast('Error al exportar datos');
      }
    } catch (e) {
      showToast('Error de conexión');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  },

  openDeleteModal() {
    document.getElementById('deleteAccountBackdrop')?.classList.remove('hidden');
    document.getElementById('deleteAccountModal')?.classList.remove('hidden');
    document.getElementById('deleteConfirmation').value = '';
    document.getElementById('btnConfirmDelete').disabled = true;
  },

  closeDeleteModal() {
    document.getElementById('deleteAccountBackdrop')?.classList.add('hidden');
    document.getElementById('deleteAccountModal')?.classList.add('hidden');
  },

  async deleteAccount() {
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!token) return;

    const btn = document.getElementById('btnConfirmDelete');
    btn.textContent = 'Eliminando...';
    btn.disabled = true;

    try {
      const res = await fetch(`${API}/user/account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showToast('Cuenta eliminada. Hasta pronto...');
        this.closeDeleteModal();
        setTimeout(() => {
          logout();
        }, 1500);
      } else {
        const err = await res.json();
        document.getElementById('deleteAccountStatus').textContent = err.error || 'Error al eliminar cuenta';
        document.getElementById('deleteAccountStatus').className = 'status status--error';
        btn.textContent = 'Eliminar mi cuenta';
        btn.disabled = false;
      }
    } catch (e) {
      document.getElementById('deleteAccountStatus').textContent = 'Error de conexión';
      document.getElementById('deleteAccountStatus').className = 'status status--error';
      btn.textContent = 'Eliminar mi cuenta';
      btn.disabled = false;
    }
  },

  async sendPasswordResetEmail() {
    if (!currentUser || !currentUser.email) {
      showToast('Error: no se encontró el email del usuario');
      return;
    }

    const btn = document.getElementById('btnChangePassword');
    const originalText = btn?.textContent;
    if (btn) {
      btn.textContent = 'Enviando...';
      btn.disabled = true;
    }

    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });

      if (res.ok) {
        showToast('Se envió un enlace a tu correo para cambiar tu contraseña');
      } else {
        showToast('Error al enviar el correo. Intenta nuevamente.');
      }
    } catch (e) {
      showToast('Error de conexión');
    } finally {
      if (btn) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }
  }
};

// ====== Data Visualization Module ======
const DataViz = {
  moodChart: null,
  assessmentChart: null,
  currentPeriod: 7,

  init() {
    this.setupPeriodButtons();
    this.loadMoodData();
  },

  setupPeriodButtons() {
    const buttons = document.querySelectorAll('.chart-period-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentPeriod = parseInt(btn.dataset.period);
        this.loadMoodData();
      });
    });
  },

  async loadMoodData() {
    if (!currentUser) return;

    try {
      // Get mood stats for the selected period
      const stats = await fetchJson(`${API}/mood/stats?days=${this.currentPeriod}`, { auth: true });
      this.updateStatsCards(stats);

      // Get recent mood entries for the chart
      const recentMoods = await fetchJson(`${API}/mood/recent`, { auth: true });
      this.renderMoodChart(recentMoods || []);
    } catch (err) {
      console.warn('Could not load mood data:', err);
      this.updateStatsCards(null);
    }
  },

  previousStreak: 0,

  updateStatsCards(stats) {
    // Mini stats (always visible on dashboard)
    const totalEl = document.getElementById('statTotalEntries');
    const streakEl = document.getElementById('statCurrentStreak');
    const avgEl = document.getElementById('statAvgMood');

    // Panel stats (in progress panel)
    const totalElPanel = document.getElementById('statTotalEntriesPanel');
    const streakElPanel = document.getElementById('statCurrentStreakPanel');
    const longestStreakEl = document.getElementById('statLongestStreak');
    const trendElPanel = document.getElementById('statTrendPanel');

    if (!stats || stats.totalEntries === 0) {
      // Reset mini stats
      if (totalEl) totalEl.textContent = '0';
      if (streakEl) streakEl.textContent = '0';
      if (avgEl) avgEl.textContent = '--';
      // Reset panel stats
      if (totalElPanel) totalElPanel.textContent = '0';
      if (streakElPanel) streakElPanel.textContent = '0';
      if (longestStreakEl) longestStreakEl.textContent = '0';
      if (trendElPanel) trendElPanel.textContent = '--';
      return;
    }

    const currentStreak = stats.currentStreak || 0;
    const longestStreak = stats.longestStreak || 0;

    // Update mini stats
    if (totalEl) totalEl.textContent = stats.totalEntries;
    if (avgEl) avgEl.textContent = stats.average.toFixed(1);
    if (streakEl) streakEl.textContent = currentStreak;

    // Update panel stats
    if (totalElPanel) totalElPanel.textContent = stats.totalEntries;
    if (streakElPanel) streakElPanel.textContent = currentStreak;
    if (longestStreakEl) longestStreakEl.textContent = longestStreak;

    // Calculate trend emoji/text for panel
    if (trendElPanel) {
      if (stats.trend > 0.2) {
        trendElPanel.textContent = '↑ Mejorando';
        trendElPanel.style.color = '#22c55e';
      } else if (stats.trend < -0.2) {
        trendElPanel.textContent = '↓ Bajando';
        trendElPanel.style.color = '#ef4444';
      } else {
        trendElPanel.textContent = '→ Estable';
        trendElPanel.style.color = 'var(--accent)';
      }
    }

    // Celebrate if streak increased
    if (currentStreak > this.previousStreak && this.previousStreak > 0) {
      this.celebrateStreak(currentStreak);
    }
    this.previousStreak = currentStreak;

    // Update streak icons in mini-stat and panel
    this.updateStreakIcon(streakEl, currentStreak);
    this.updateStreakIcon(streakElPanel, currentStreak);
  },

  updateStreakIcon(streakEl, currentStreak) {
    if (!streakEl) return;

    // Check for mini-stat (different structure)
    const miniStat = streakEl.closest('.mini-stat');
    if (miniStat) {
      const iconEl = miniStat.querySelector('.mini-stat__icon');
      if (iconEl) {
        if (currentStreak >= 7) {
          iconEl.textContent = '🔥';
          miniStat.classList.add('streak-hot');
        } else if (currentStreak >= 3) {
          iconEl.textContent = '🔥';
          miniStat.classList.remove('streak-hot');
        } else {
          iconEl.textContent = '📅';
          miniStat.classList.remove('streak-hot');
        }
      }
      return;
    }

    // Check for stat-card (panel)
    const statCard = streakEl.closest('.stat-card');
    if (statCard) {
      const iconEl = statCard.querySelector('.stat-card__icon');
      if (iconEl) {
        if (currentStreak >= 7) {
          iconEl.textContent = '🔥';
          statCard.classList.add('streak-hot');
        } else if (currentStreak >= 3) {
          iconEl.textContent = '🔥';
          statCard.classList.remove('streak-hot');
        } else {
          iconEl.textContent = '📅';
          statCard.classList.remove('streak-hot');
        }
      }
    }
  },

  celebrateStreak(streak) {
    // Show toast with celebration
    const messages = [
      `¡${streak} días seguidos! 🎉 ¡Sigue así!`,
      `¡Racha de ${streak} días! 🔥 ¡Increíble!`,
      `¡${streak} días consecutivos! ⭐ ¡Eres constante!`
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    showToast(msg);

    // Add confetti effect to streak card
    const streakCard = document.getElementById('statCurrentStreak')?.closest('.stat-card');
    if (streakCard) {
      streakCard.classList.add('streak-celebrate');
      setTimeout(() => streakCard.classList.remove('streak-celebrate'), 1500);
    }
  },

  renderMoodChart(moodData) {
    const canvas = document.getElementById('moodTrendChart');
    const emptyEl = document.getElementById('moodChartEmpty');

    if (!canvas) return;

    if (!moodData || moodData.length === 0) {
      canvas.style.display = 'none';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    canvas.style.display = 'block';
    if (emptyEl) emptyEl.classList.add('hidden');

    // Prepare data - reverse to show oldest first
    const reversedData = [...moodData].reverse();
    const labels = reversedData.map(m => {
      const date = new Date(m.createdAt);
      return date.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric' });
    });
    const scores = reversedData.map(m => m.score);
    const emojis = reversedData.map(m => m.emoji);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#9ca3af' : '#6b7280';

    // Destroy existing chart if any
    if (this.moodChart) {
      this.moodChart.destroy();
    }

    this.moodChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Estado de ánimo',
          data: scores,
          borderColor: '#3db8b9',
          backgroundColor: 'rgba(61, 184, 185, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3db8b9',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: isDark ? '#1e2332' : '#fff',
            titleColor: isDark ? '#fff' : '#1f2937',
            bodyColor: isDark ? '#9ca3af' : '#6b7280',
            borderColor: isDark ? '#374151' : '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => {
                const emoji = emojis[item.dataIndex] || '';
                return `${emoji} Puntuación: ${item.raw}/5`;
              }
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 5,
            ticks: {
              stepSize: 1,
              color: textColor,
              callback: (value) => {
                const labels = ['', '😢', '😔', '😐', '😊', '😄'];
                return labels[value] || value;
              }
            },
            grid: {
              color: gridColor
            }
          },
          x: {
            ticks: {
              color: textColor
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  },

  updateAssessmentChart(grouped) {
    const canvas = document.getElementById('assessmentChart');
    const emptyEl = document.getElementById('assessmentChartEmpty');

    if (!canvas) return;

    const gad7Data = (grouped.gad7 || []).slice(-5);
    const phq9Data = (grouped.phq9 || []).slice(-5);

    if (gad7Data.length === 0 && phq9Data.length === 0) {
      canvas.style.display = 'none';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    canvas.style.display = 'block';
    if (emptyEl) emptyEl.classList.add('hidden');

    // Prepare labels - use dates from both datasets
    const allDates = new Set();
    gad7Data.forEach(d => allDates.add(new Date(d.createdAt).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })));
    phq9Data.forEach(d => allDates.add(new Date(d.createdAt).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })));
    const labels = Array.from(allDates).slice(-5);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#9ca3af' : '#6b7280';

    // Destroy existing chart if any
    if (this.assessmentChart) {
      this.assessmentChart.destroy();
    }

    this.assessmentChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['Sin datos'],
        datasets: [
          {
            label: 'GAD-7 (Ansiedad)',
            data: gad7Data.map(d => d.total),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'PHQ-9 (Depresión)',
            data: phq9Data.map(d => d.total),
            backgroundColor: 'rgba(168, 85, 247, 0.7)',
            borderColor: 'rgba(168, 85, 247, 1)',
            borderWidth: 1,
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#1e2332' : '#fff',
            titleColor: isDark ? '#fff' : '#1f2937',
            bodyColor: isDark ? '#9ca3af' : '#6b7280',
            borderColor: isDark ? '#374151' : '#e5e7eb',
            borderWidth: 1,
            padding: 12,
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 27,
            ticks: {
              color: textColor
            },
            grid: {
              color: gridColor
            }
          },
          x: {
            ticks: {
              color: textColor
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  },

  // Refresh charts when theme changes
  refreshCharts() {
    this.loadMoodData();
    // Assessment chart will be refreshed via renderInsights
  }
};

// Initialize DataViz when dashboard loads
const originalUpdateDashboard = updateDashboard;
updateDashboard = function() {
  originalUpdateDashboard();
  DataViz.init();
};

// Refresh charts when theme changes
document.addEventListener('themeChanged', () => {
  DataViz.refreshCharts();
});

// ====== Eventos auth / navegación ======
elements.loginForm && elements.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;
  setStatus(elements.loginStatus, "Iniciando sesión...");
  try {
    const data = await apiLogin(email, password);
    setToken(data.token);
    const name = getDisplayName(data.email);
    const role = data.role || decodeJwtRole(data.token) || "USER";
    currentUser = { email: data.email, userId: data.userId, name, role };
    storeProfile(currentUser);
    updateDashboard();
    updateAdminVisibility();
    showToast("¡Bienvenido de vuelta!");
    showView("view-dashboard");
    loadHistory();
    elements.loginForm.reset();
    setStatus(elements.loginStatus, "", null);
  } catch (err) {
    console.error(err);
    setStatus(elements.loginStatus, `No se pudo iniciar sesión: ${err.message || "Error desconocido"}`, "error");
  }
});

elements.registerForm && elements.registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirm = document.getElementById("registerConfirm").value;
  const name = document.getElementById("registerName").value.trim();
  if (password !== confirm) { setStatus(elements.registerStatus, "Las contraseñas no coinciden.", "error"); return; }
  setStatus(elements.registerStatus, "Creando cuenta...");
  try {
    await apiRegister(email, password);
    if (name) storeDisplayName(email, name);
    setStatus(elements.registerStatus, "Cuenta creada. Ahora puedes iniciar sesión.", "success");
    elements.registerForm.reset();
    setTimeout(() => { showView("view-login"); setStatus(elements.registerStatus, "", null); }, 1200);
  } catch (err) {
    console.error(err);
    setStatus(elements.registerStatus, "No se pudo registrar. ¿El correo ya existe?", "error");
  }
});

// ====== Forgot Password ======
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const forgotPasswordStatus = document.getElementById("forgotPasswordStatus");

forgotPasswordForm && forgotPasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("forgotEmail").value.trim();
  setStatus(forgotPasswordStatus, "Enviando enlace...");

  try {
    const response = await fetch(`${API}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (response.ok) {
      setStatus(forgotPasswordStatus, "Si el email existe, recibirás un enlace para restablecer tu contraseña.", "success");
      forgotPasswordForm.reset();
    } else {
      setStatus(forgotPasswordStatus, data.error || "Error al enviar el enlace", "error");
    }
  } catch (err) {
    console.error(err);
    setStatus(forgotPasswordStatus, "Error de conexión. Intenta nuevamente.", "error");
  }
});

// ====== Reset Password ======
const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetPasswordStatus = document.getElementById("resetPasswordStatus");
const resetPasswordSuccess = document.getElementById("resetPasswordSuccess");
const resetPasswordError = document.getElementById("resetPasswordError");

// Get token from URL on page load
function getResetTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

// Validate token when navigating to reset password view
async function validateResetToken(token) {
  try {
    const response = await fetch(`${API}/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
    const data = await response.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

// Check if URL has reset token on page load
async function checkResetPasswordToken() {
  const token = getResetTokenFromUrl();
  if (token) {
    showView("view-reset-password");
    const isValid = await validateResetToken(token);

    if (!isValid) {
      resetPasswordForm.classList.add("hidden");
      resetPasswordError.classList.remove("hidden");
    } else {
      resetPasswordForm.classList.remove("hidden");
      resetPasswordError.classList.add("hidden");
    }
  }
}

resetPasswordForm && resetPasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = getResetTokenFromUrl();
  const newPassword = document.getElementById("resetNewPassword").value;
  const confirmPassword = document.getElementById("resetConfirmPassword").value;

  if (newPassword !== confirmPassword) {
    setStatus(resetPasswordStatus, "Las contraseñas no coinciden", "error");
    return;
  }

  if (newPassword.length < 6) {
    setStatus(resetPasswordStatus, "La contraseña debe tener al menos 6 caracteres", "error");
    return;
  }

  setStatus(resetPasswordStatus, "Actualizando contraseña...");

  try {
    const response = await fetch(`${API}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword })
    });

    const data = await response.json();
    if (response.ok) {
      resetPasswordForm.classList.add("hidden");
      resetPasswordSuccess.classList.remove("hidden");
      // Clear token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      setStatus(resetPasswordStatus, data.error || "Error al restablecer contraseña", "error");
    }
  } catch (err) {
    console.error(err);
    setStatus(resetPasswordStatus, "Error de conexión. Intenta nuevamente.", "error");
  }
});

Array.from(document.querySelectorAll("[data-switch]")).forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-switch");
    const viewMap = {
      "register": "view-register",
      "login": "view-login",
      "forgot-password": "view-forgot-password",
      "reset-password": "view-reset-password"
    };
    showView(viewMap[target] || "view-login");
  });
});

elements.btnLogout && elements.btnLogout.addEventListener("click", () => {
  clearToken(); clearProfile(); currentUser = null; cachedHistory = [];
  renderInsights([]); elements.historyPanel?.classList.add("hidden");
  showView("view-login"); showToast("Sesión cerrada.");
});

elements.btnStartGad7 && elements.btnStartGad7.addEventListener("click", () => startAssessment("gad7"));
elements.btnStartPhq9 && elements.btnStartPhq9.addEventListener("click", () => startAssessment("phq9"));

elements.btnBackToDashboard && elements.btnBackToDashboard.addEventListener("click", () => {
  if (!currentAssessment) { showView("view-dashboard"); return; }
  const hasProgress = currentAssessment.answers.some(a => typeof a === "number");
  if (!hasProgress || confirm("¿Deseas salir de la evaluación actual?")) {
    currentAssessment = null; showView("view-dashboard");
  }
});

elements.btnPrevQuestion && elements.btnPrevQuestion.addEventListener("click", () => {
  if (!currentAssessment || currentAssessment.index===0) return;
  currentAssessment.index--; renderAssessment();
});
elements.btnNextQuestion && elements.btnNextQuestion.addEventListener("click", () => {
  if (!currentAssessment) return;
  const { index, questions, answers } = currentAssessment;
  if (typeof answers[index] !== "number") return;
  if (index === questions.length - 1) submitAssessment(); else { currentAssessment.index++; renderAssessment(); }
});

elements.btnOpenHistory && elements.btnOpenHistory.addEventListener("click", () => {
  elements.historyPanel?.classList.toggle("hidden");
  if (!elements.historyPanel?.classList.contains("hidden")) {
    loadHistory();
  }
});
elements.btnCloseHistory && elements.btnCloseHistory.addEventListener("click", () => elements.historyPanel?.classList.add("hidden"));

// Progress panel
elements.btnOpenProgress && elements.btnOpenProgress.addEventListener("click", () => {
  elements.progressPanel?.classList.toggle("hidden");
  if (!elements.progressPanel?.classList.contains("hidden")) {
    DataViz.loadMoodData(); // Refresh charts when opening panel
  }
});
elements.btnCloseProgress && elements.btnCloseProgress.addEventListener("click", () => elements.progressPanel?.classList.add("hidden"));

elements.btnResultDashboard && elements.btnResultDashboard.addEventListener("click", () => goToDashboard());
elements.btnResultHistory && elements.btnResultHistory.addEventListener("click", () => { goToDashboard(); elements.historyPanel?.classList.remove("hidden"); });


elements.historyFilterType &&
  elements.historyFilterType.addEventListener("change", () => {
    applyHistoryFilters();
  });

elements.historyFilterRange &&
  elements.historyFilterRange.addEventListener("change", () => {
    applyHistoryFilters();
  });


// ====== Ayuda ======
let _helpLastFocus = null;
function openHelp() {
  if (!elements.helpPanel) return;
  _helpLastFocus = document.activeElement;
  elements.helpBackdrop.hidden = false;
  elements.helpPanel.hidden = false;
  (elements.helpPanel.querySelector("#helpTitle") || elements.helpPanel).focus?.();
  elements.helpPanel.scrollTop = 0;
}
function closeHelp() {
  if (!elements.helpPanel) return;
  elements.helpBackdrop.hidden = true;
  elements.helpPanel.hidden = true;
  _helpLastFocus?.focus?.();
}
elements.helpFab && elements.helpFab.addEventListener("click", openHelp);
elements.helpClose && elements.helpClose.addEventListener("click", closeHelp);
elements.helpBackdrop && elements.helpBackdrop.addEventListener("click", closeHelp);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && elements.helpPanel && !elements.helpPanel.hidden) closeHelp(); });
// mini-panels
function openPanel(panel){ elements.helpBackdrop.hidden = false; panel.hidden = false; panel.scrollTop = 0; }
function closeAllPanels(){ elements.helpBackdrop.hidden = true; elements.helpPanel.hidden = true; elements.introPanel.hidden = true; elements.coachingPanel.hidden = true; }
elements.openIntro?.addEventListener("click", () => { closeAllPanels(); openPanel(elements.introPanel); });
elements.openCoaching?.addEventListener("click", () => { closeAllPanels(); openPanel(elements.coachingPanel); });
document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", closeAllPanels));

// ====== Admin ======
elements.btnOpenAdmin && elements.btnOpenAdmin.addEventListener("click", () => { renderJwtPayload(); showView("view-admin"); });
elements.btnBackFromAdmin && elements.btnBackFromAdmin.addEventListener("click", () => showView("view-dashboard"));
elements.btnRefreshPayload && elements.btnRefreshPayload.addEventListener("click", () => { renderJwtPayload(); showToast("Payload actualizado"); });
function renderJwtPayload() {
  if (!elements.jwtPayload) return;
  const payload = decodeJwtPayload(getToken());
  elements.jwtPayload.textContent = payload ? JSON.stringify(payload, null, 2) : "—";
}
const promoteForm = document.getElementById("formPromote");
if (promoteForm) {
  promoteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = Number(document.getElementById("promoteUserId").value);
    const status = document.getElementById("promoteStatus");
    setStatus(status, "Promoviendo...");
    try {
      const res = await fetch(`${API}/users/${id}/make-admin`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(await res.text() || `Error ${res.status}`);
      setStatus(status, `Usuario ${id} promovido a ADMIN ✔`, "success");
      showToast("Promoción exitosa");
    } catch (err) {
      console.error(err);
      setStatus(status, "No se pudo promover: verifica token ADMIN y el ID.", "error");
    }
  });
}

// ====== Recursos ======
async function apiResourcesList() {
  let res;
  try {
    res = await fetch(RESOURCES_PUBLIC_URL, { headers: { "Accept": "application/json" } });
  } catch (e) {
    console.error("[resources] Error de red:", e);
    throw new Error("NETWORK");
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[resources] HTTP", res.status, txt);
    throw new Error(String(res.status));
  }

  try {
    return await res.json();
  } catch (e) {
    const body = await res.clone().text().catch(() => "");
    console.error("[resources] JSON inválido. Body:", body);
    throw new Error("BAD_JSON");
  }
}
async function apiResourceCreate({ title, description, category, file }) {
  const token = getToken();
  if (!token) throw new Error("Necesitas iniciar sesión");
  const fd = new FormData();
  fd.append("title", title);
  if (description) fd.append("description", description);
  if (category) fd.append("category", category);
  if (file) fd.append("file", file);
  const res = await fetch(RESOURCES_ADMIN_URL, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
  if (res.status === 401 || res.status === 403) throw new Error("No autorizado para crear recursos");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[resources] create HTTP", res.status, txt);
    throw new Error("Error al crear recurso");
  }
  return res.json();
}
async function apiResourceDelete(id) {
  const token = getToken();
  if (!token) throw new Error("Necesitas iniciar sesión");
  const res = await fetch(`${RESOURCES_ADMIN_URL}/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) throw new Error("No autorizado para eliminar");
  if (res.status !== 204 && !res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[resources] delete HTTP", res.status, txt);
    throw new Error("Error al eliminar recurso");
  }
}

function openResourcesView() {
  showView("view-resources");
  const isAdmin = currentUser && currentUser.role === "ADMIN";
  elements.resourceUploader && elements.resourceUploader.classList.toggle("hidden", !isAdmin);

  // reset de filtros al entrar
  if (elements.resourceSearch) elements.resourceSearch.value = "";
  if (elements.resourceFilterCategory) elements.resourceFilterCategory.value = "";

  loadAndRenderResources();
}

async function loadAndRenderResources() {
  try {
    const items = await apiResourcesList();
    cachedResources = Array.isArray(items) ? items : [];
    applyResourceFilters(); // ⬅️ en lugar de renderResources(items)
  } catch (e) {
    if (e.message === "NETWORK") {
      showToast("No hay conexión con el API de recursos.");
    } else if (e.message === "BAD_JSON") {
      showToast("Respuesta inválida del servidor de recursos.");
    } else if (e.message === "403") {
      showToast("No autorizado para ver los recursos.");
    } else {
      showToast("No se pudieron cargar los recursos.");
    }
    cachedResources = [];
    renderResources([]);
  }
}

function applyResourceFilters() {
  if (!Array.isArray(cachedResources)) {
    renderResources([]);
    return;
  }
  const q = (elements.resourceSearch?.value || "").toLowerCase().trim();
  const cat = (elements.resourceFilterCategory?.value || "").toLowerCase().trim();

  const filtered = cachedResources.filter(r => {
    const title = (r.title || "").toLowerCase();
    const desc = (r.description || "").toLowerCase();
    const rCat = (r.category || "").toLowerCase();

    if (q && !(title.includes(q) || desc.includes(q))) return false;
    if (cat && !rCat.includes(cat)) return false;
    return true;
  });

  renderResources(filtered);
}

function renderResources(items) {
  const list = elements.resourcesList;
  if (!list) return;
  if (!items || !items.length) {
    list.innerHTML = `
      <article class="insight-card insight-card--empty">
        <header class="insight-head">
          <div>
            <h3>No hay recursos aún</h3>
            <p class="insight-subtitle">Cuando se publiquen, aparecerán aquí.</p>
          </div>
          <span class="insight-badge">Recursos</span>
        </header>
      </article>`;
    return;
  }
  list.innerHTML = items.map(r => {
    // Sanitize all user-provided content to prevent XSS
    const safeTitle = escapeHtml(r.title ?? "Recurso");
    const safeCategory = escapeHtml(r.category ?? "General");
    const safeStatus = escapeHtml(r.status ?? "APPROVED");
    const safeDescription = escapeHtml(r.description ?? "");
    // Validate fileUrl is a safe path (starts with /files/)
    const safeFileUrl = r.fileUrl && r.fileUrl.startsWith('/files/') ? encodeURI(r.fileUrl) : null;
    const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleString("es-GT") : "";

    return `
    <article class="insight-card">
      <header class="insight-head">
        <div>
          <h3>${safeTitle}</h3>
          <p class="insight-subtitle">${safeCategory}</p>
        </div>
        <span class="insight-badge">${safeStatus}</span>
      </header>
      <div class="insight-body">
        <p>${safeDescription}</p>
        ${safeFileUrl ? `<a class="btn btn--light" href="${BASE_URL}${safeFileUrl}" target="_blank" rel="noopener">Abrir archivo</a>` : ""}
        <p class="insight-last">Publicado: ${escapeHtml(dateStr)}</p>
      </div>
    </article>
  `;
  }).join("");
}

// ====== Analytics de resultados para <div id="resultAnswersChart"> ======
function renderResultAnalytics(type, answers) {
  // Reset seguro
  elements.resultAverage && (elements.resultAverage.textContent = "-");
  elements.resultMax && (elements.resultMax.textContent = "-");
  elements.resultFocus && (elements.resultFocus.textContent = "-");
  if (elements.resultAnswersChart) elements.resultAnswersChart.innerHTML = "";

  if (!Array.isArray(answers) || !answers.length) return;

  const vals = answers.map(v => Number(v) || 0);  // 0..3
  const total = vals.reduce((a,b)=>a+b,0);
  const avg = (total / vals.length).toFixed(2);
  const max = Math.max(...vals);

  elements.resultAverage && (elements.resultAverage.textContent = String(avg));
  elements.resultMax && (elements.resultMax.textContent = String(max));

  // Foco
  const maxIdxs = vals.map((v,i)=>({v,i})).filter(x=>x.v===max).map(x=>x.i+1);
  const scale = type==="phq9" ? "PHQ-9" : "GAD-7";
  if (elements.resultFocus) {
    elements.resultFocus.textContent = max > 0
      ? `Puntos a observar (${scale}): pregunta(s) ${maxIdxs.join(", ")} con ${max}.`
      : "Sin focos marcados (todas ≤ 0).";
  }

  // Gráfico de barras dentro del DIV (sin canvas ni librerías)
  const container = elements.resultAnswersChart;
  if (!container) return;

  // Estilos base del contenedor (por si CSS no los define)
  container.style.display = "grid";
  container.style.gridTemplateColumns = `repeat(${vals.length}, 1fr)`;
  container.style.gap = "8px";
  container.style.alignItems = "end";
  container.style.height = "140px";

  const maxVal = Math.max(1, max);
  vals.forEach((v, i) => {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "flex-end";
    wrapper.style.height = "100%";

    const bar = document.createElement("div");
    const hPct = (v / maxVal) * 100;
    bar.style.height = `${Math.max(4, Math.round(hPct))}%`;
    bar.style.width = "100%";
    bar.style.minWidth = "10px";
    bar.style.borderRadius = "8px";
    bar.style.background = "#6aa9ff";
    bar.style.boxShadow = "0 1px 2px rgba(0,0,0,.06)";

    const value = document.createElement("div");
    value.textContent = String(v);
    value.style.fontSize = "12px";
    value.style.color = "#333";
    value.style.marginBottom = "4px";

    const label = document.createElement("div");
    label.textContent = `P${i+1}`;
    label.style.fontSize = "11px";
    label.style.color = "#666";
    label.style.marginTop = "6px";

    wrapper.append(value, bar, label);
    container.appendChild(wrapper);
  });
}

// ====== Binds de recursos ======
elements.btnOpenResources && elements.btnOpenResources.addEventListener("click", openResourcesView);
elements.btnBackFromResources && elements.btnBackFromResources.addEventListener("click", () => showView("view-dashboard"));
elements.resourceSearch && elements.resourceSearch.addEventListener("input", () => applyResourceFilters());

// ====== Binds de respiración ======
elements.btnOpenBreathing?.addEventListener("click", () => {
  showView("view-breathing");
  Breathing.init();
});
elements.btnBackFromBreathing?.addEventListener("click", () => {
  Breathing.stop();
  showView("view-dashboard");
});
elements.resourceFilterCategory && elements.resourceFilterCategory.addEventListener("change", () => applyResourceFilters());

// ====== Binds de configuración ======
elements.btnOpenSettings?.addEventListener("click", () => {
  showView("view-settings");
  Settings.init();
  Settings.loadUserData();
});
document.getElementById("btnBackFromSettings")?.addEventListener("click", () => showView("view-dashboard"));

// ====== Uploader ADMIN ======
if (elements.formResourceUpload) {
  elements.formResourceUpload.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = elements.resTitle?.value.trim();
    const description = elements.resDesc?.value.trim();
    const category = elements.resCat?.value.trim();
    const file = elements.resFile?.files[0];
    const status = elements.resUploadStatus;

    if (!title) { setStatus(status, "Título requerido", "error"); return; }
    setStatus(status, "Publicando...");
    try {
      await apiResourceCreate({ title, description, category, file });
      elements.formResourceUpload.reset();
      setStatus(status, "Publicado ✔", "success");
      loadAndRenderResources();
    } catch (err) {
      console.error(err);
      setStatus(status, "No se pudo publicar", "error");
    }
  });
}
function getLevelConfig(score, type) {
  let levels = [];

  if (type === "gad7") {
    levels = [
      { max: 4, level: "Mínimo", color: "#6ee7b7", emoji: "🟢",
        gradient: "linear-gradient(180deg, #d1fae5, #a7f3d0)" },
      { max: 9, level: "Leve", color: "#fde047", emoji: "🟡",
        gradient: "linear-gradient(180deg, #fef9c3, #fef08a)" },
      { max: 14, level: "Moderado", color: "#fb923c", emoji: "🟠",
        gradient: "linear-gradient(180deg, #ffedd5, #fed7aa)" },
      { max: 19, level: "Moderadamente severo", color: "#f87171", emoji: "🟥",
        gradient: "linear-gradient(180deg, #fee2e2, #fecaca)" },
      { max: 99, level: "Severo", color: "#e11d48", emoji: "🔴",
        gradient: "linear-gradient(180deg, #ffe4e6, #fecdd3)" }
    ];
  } else {
    // PHQ9
    levels = [
      { max: 4, level: "Mínimo", color: "#6ee7b7", emoji: "🟢",
        gradient: "linear-gradient(180deg, #d1fae5, #a7f3d0)" },
      { max: 9, level: "Leve", color: "#fde047", emoji: "🟡",
        gradient: "linear-gradient(180deg, #fef9c3, #fef08a)" },
      { max: 14, level: "Moderado", color: "#fb923c", emoji: "🟠",
        gradient: "linear-gradient(180deg, #ffedd5, #fed7aa)" },
      { max: 19, level: "Moderadamente severo", color: "#f87171", emoji: "🟥",
        gradient: "linear-gradient(180deg, #fee2e2, #fecaca)" },
      { max: 99, level: "Severo", color: "#e11d48", emoji: "🔴",
        gradient: "linear-gradient(180deg, #ffe4e6, #fecdd3)" }
    ];
  }

  return levels.find(l => score <= l.max);
}



 
// ====== AI Insights ======
const AiInsights = (() => {
  const $ = id => document.getElementById(id);

  function showEl(id, show) { const el = $(id); if (el) el.style.display = show ? "" : "none"; }

  async function load(refresh) {
    const section = $("aiInsightsSection");
    if (!section) return;
    section.style.display = "";
    showEl("aiInsightsLoading", true);
    showEl("aiInsightsGrid", false);
    showEl("aiInsightsError", false);
    showEl("aiRiskAlert", false);
    showEl("aiDisclaimer", false);

    try {
      const data = await apiAiInsights(refresh);
      if (!data || data.disponible === false) { section.style.display = "none"; return; }

      showEl("aiInsightsLoading", false);

      // Handle "no data" or "error" responses from backend
      if (data.sinDatos || data.error) {
        showEl("aiInsightsError", true);
        const errEl = $("aiInsightsError");
        if (errEl) {
          const msg = data.mensaje || "No se pudieron cargar los insights.";
          errEl.innerHTML = `<p>${msg} ${data.error ? '<a href="#" id="btnRetryAiInsights">Reintentar</a>' : ''}</p>`;
          const retry = $("btnRetryAiInsights");
          if (retry) retry.addEventListener("click", e => { e.preventDefault(); load(true); });
        }
        return;
      }

      // Has actual AI data — show the grid
      if (!data.patrones && !data.correlacionSueno && !data.analisisTags) {
        section.style.display = "none"; return;
      }

      showEl("aiInsightsGrid", true);

      const p = $("aiPatterns"); if (p) p.textContent = data.patrones || "--";
      const s = $("aiSleep"); if (s) s.textContent = data.correlacionSueno || "--";
      const t = $("aiTags"); if (t) t.textContent = data.analisisTags || "--";

      const recList = $("aiRecommendations");
      if (recList && Array.isArray(data.recomendaciones)) {
        recList.innerHTML = "";
        data.recomendaciones.forEach(r => {
          const li = document.createElement("li");
          li.textContent = r;
          recList.appendChild(li);
        });
      }

      if (data.riesgo && data.riesgo.nivel && data.riesgo.nivel !== "bajo") {
        showEl("aiRiskAlert", true);
        const msg = $("aiRiskMessage");
        if (msg) msg.textContent = data.riesgo.mensaje || "Se detectaron indicadores que merecen atención.";
      }

      if (data.disclaimer) {
        showEl("aiDisclaimer", true);
        const d = $("aiDisclaimer"); if (d) d.textContent = data.disclaimer;
      }
    } catch (e) {
      showEl("aiInsightsLoading", false);
      showEl("aiInsightsError", true);
      const errEl = $("aiInsightsError");
      if (errEl) errEl.innerHTML = '<p>No se pudieron cargar los insights. <a href="#" id="btnRetryAiInsights">Reintentar</a></p>';
      const retry = $("btnRetryAiInsights");
      if (retry) retry.addEventListener("click", ev => { ev.preventDefault(); load(true); });
      console.warn("AI insights error:", e);
    }
  }

  async function loadAssessmentAnalysis(type, total, category, answers) {
    const section = $("aiAssessmentSection");
    if (!section) return;
    section.style.display = "";
    showEl("aiAssessmentLoading", true);
    showEl("aiAssessmentContent", false);
    showEl("aiAssessmentError", false);

    try {
      const data = await apiAiAssessmentAnalysis(type, total, category, answers);
      if (!data || data.disponible === false) { section.style.display = "none"; return; }

      showEl("aiAssessmentLoading", false);
      showEl("aiAssessmentContent", true);

      const a = $("aiAssessmentAnalysis"); if (a) a.textContent = data.analisis || "";
      const c = $("aiAssessmentComparison"); if (c) c.textContent = data.comparacion || "";

      if (Array.isArray(data.areasPreocupacion) && data.areasPreocupacion.length > 0) {
        showEl("aiConcernBlock", true);
        const ul = $("aiConcernList");
        if (ul) { ul.innerHTML = ""; data.areasPreocupacion.forEach(t => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); }); }
      }

      if (Array.isArray(data.areasMejora) && data.areasMejora.length > 0) {
        showEl("aiImproveBlock", true);
        const ul = $("aiImproveList");
        if (ul) { ul.innerHTML = ""; data.areasMejora.forEach(t => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); }); }
      }

      const recList = $("aiAssessmentRecommendations");
      if (recList && Array.isArray(data.recomendaciones)) {
        recList.innerHTML = "";
        data.recomendaciones.forEach(r => { const li = document.createElement("li"); li.textContent = r; recList.appendChild(li); });
      }

      const d = $("aiAssessmentDisclaimer"); if (d) d.textContent = data.disclaimer || "";
    } catch (e) {
      showEl("aiAssessmentLoading", false);
      showEl("aiAssessmentError", true);
      console.warn("AI assessment error:", e);
    }
  }

  // Wire up buttons after DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    const btnRefresh = $("btnRefreshAiInsights");
    if (btnRefresh) btnRefresh.addEventListener("click", () => load(true));
    const btnRetry = $("btnRetryAiInsights");
    if (btnRetry) btnRetry.addEventListener("click", e => { e.preventDefault(); load(false); });
  });

  return { load, loadAssessmentAnalysis };
})();

// ====== Inicio ======
ensureAuth();

window.addEventListener("load", () => {
  // Si el script de Google ya está listo, se dibuja el botón
  try {
    initGoogleLogin();
  } catch (e) {
    console.warn("No se pudo inicializar Google Login todavía:", e);
  }
});
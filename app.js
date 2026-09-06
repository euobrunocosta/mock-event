const App = (() => {
  const STORAGE_KEY = "nfc_target_route";
  const TIME_KEY = "nfc_event_time";
  const DEFAULT_ROUTE = "pre-evento.html";
  const VALID_ROUTES = [
    "pre-evento.html",
    "dia1.html",
    "dia2.html",
    "dia3.html",
    "pos-evento.html",
  ];
  const ROUTE_LABELS = {
    "pre-evento.html": "Pré-evento",
    "dia1.html": "Dia 1 — Programação",
    "dia2.html": "Dia 2 — Programação",
    "dia3.html": "Dia 3 — Programação",
    "pos-evento.html": "Pós-evento",
  };
  const EVENT_START = new Date("2026-10-08T08:00:00-03:00");

  function getRoute() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return VALID_ROUTES.includes(saved) ? saved : DEFAULT_ROUTE;
  }

  function setRoute(route) {
    if (!VALID_ROUTES.includes(route)) {
      return DEFAULT_ROUTE;
    }
    localStorage.setItem(STORAGE_KEY, route);
    return route;
  }

  function redirectFromNfc() {
    window.location.replace(getRoute());
  }

  function normalizeTime(value) {
    const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)/);
    return match ? `${match[1]}:${match[2]}` : "";
  }

  function isValidTime(value) {
    return Boolean(normalizeTime(value));
  }

  function getEventTime() {
    return normalizeTime(localStorage.getItem(TIME_KEY));
  }

  function setEventTime(value) {
    const time = normalizeTime(value);
    if (!time) {
      localStorage.removeItem(TIME_KEY);
      return "";
    }
    localStorage.setItem(TIME_KEY, time);
    return time;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function parseTime(value) {
    const [hours, minutes] = value.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  function getNow() {
    const configured = getEventTime();
    return configured ? parseTime(configured) : new Date();
  }

  function timeLabel() {
    return getEventTime() || "relógio do celular";
  }

  function updateCountdown() {
    const root = document.querySelector("[data-countdown]");
    if (!root) {
      return;
    }

    const now = new Date();
    let diff = EVENT_START.getTime() - now.getTime();

    if (diff <= 0) {
      root.innerHTML = "<p class='lead'>O simpósio já começou. Acesse a programação do dia.</p>";
      return;
    }

    const days = Math.floor(diff / 86400000);
    diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000);
    diff -= hours * 3600000;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff - minutes * 60000) / 1000);

    root.querySelector("[data-days]").textContent = pad(days);
    root.querySelector("[data-hours]").textContent = pad(hours);
    root.querySelector("[data-minutes]").textContent = pad(minutes);
    root.querySelector("[data-seconds]").textContent = pad(seconds);
  }

  function formatDuration(ms) {
    const totalMinutes = Math.max(1, Math.round(Math.abs(ms) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${totalMinutes}m`;
    }

    if (minutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${minutes}m`;
  }

  function updateSchedule() {
    const talks = document.querySelectorAll("[data-start][data-end]");
    if (!talks.length) {
      return;
    }

    const now = getNow();

    talks.forEach((talk) => {
      const start = parseTime(talk.dataset.start);
      const end = parseTime(talk.dataset.end);
      const badge = talk.querySelector("[data-status-badge]");

      talk.classList.remove("is-past", "is-now", "is-future");
      if (badge) {
        badge.classList.remove("is-past", "is-now", "is-future");
      }

      if (now >= end) {
        talk.classList.add("is-past");
        if (badge) {
          badge.classList.add("is-past");
          badge.textContent = `há ${formatDuration(now - end)}`;
        }
      } else if (now >= start && now < end) {
        talk.classList.add("is-now");
        if (badge) {
          badge.classList.add("is-now");
          badge.textContent = "Acontecendo agora";
        }
      } else {
        talk.classList.add("is-future");
        if (badge) {
          badge.classList.add("is-future");
          badge.textContent = `em ${formatDuration(start - now)}`;
        }
      }
    });
  }

  function refreshAdminStatus() {
    const currentRoute = document.querySelector("[data-current-route]");
    const currentTime = document.querySelector("[data-current-time]");
    if (currentRoute) {
      currentRoute.textContent = ROUTE_LABELS[getRoute()];
    }
    if (currentTime) {
      currentTime.textContent = timeLabel();
    }
  }

  function syncTimeMode(form) {
    const mode = form.querySelector("input[name='time_mode']:checked");
    const timeInput = form.querySelector("[data-time-input]");
    if (!mode || !timeInput) {
      return;
    }
    timeInput.disabled = mode.value === "auto";
  }

  function initAdmin() {
    const form = document.querySelector("[data-admin-form]");
    const feedback = document.querySelector("[data-feedback]");
    if (!form) {
      return;
    }

    const timeInput = form.querySelector("[data-time-input]");
    const activeRoute = getRoute();
    const selected = form.querySelector(`input[value="${activeRoute}"]`);
    if (selected) {
      selected.checked = true;
    }

    const savedTime = getEventTime();
    const modeValue = savedTime ? "manual" : "auto";
    const modeInput = form.querySelector(`input[name='time_mode'][value='${modeValue}']`);
    if (modeInput) {
      modeInput.checked = true;
    }
    if (timeInput) {
      timeInput.value = savedTime || "09:30";
    }

    refreshAdminStatus();
    syncTimeMode(form);

    form.querySelectorAll("input[name='time_mode']").forEach((input) => {
      input.addEventListener("change", () => syncTimeMode(form));
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      setRoute(data.get("route"));
      setEventTime(data.get("time_mode") === "manual" ? data.get("event_time") : "");
      refreshAdminStatus();
      if (feedback) {
        feedback.textContent = "Configuração salva. O chaveiro NFC usa esta rota e este horário.";
      }
    });
  }

  function init() {
    const page = document.body.dataset.page;

    if (page === "router") {
      redirectFromNfc();
      return;
    }

    if (page === "admin") {
      initAdmin();
    }

    if (page === "pre-evento") {
      updateCountdown();
      setInterval(updateCountdown, 1000);
    }

    if (document.querySelector("[data-start][data-end]")) {
      updateSchedule();
      setInterval(updateSchedule, 30000);
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    getRoute,
    setRoute,
    getEventTime,
    setEventTime,
    redirectFromNfc,
    VALID_ROUTES,
    ROUTE_LABELS,
  };
})();

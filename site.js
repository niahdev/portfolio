const statusLabels = {
  operational: "Operational",
  degraded: "Degraded",
  offline: "Offline",
  pending: "Pending"
};

function formatStatusTime(value) {
  if (!value) return "배포 후 상태가 갱신됩니다.";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 시각을 표시할 수 없습니다.";
  return `최근 확인 ${new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date)}`;
}

async function loadHomeStatus() {
  const list = document.querySelector("#home-status-list");
  const updated = document.querySelector("#home-status-updated");
  if (!list || !updated) return;

  try {
    const response = await fetch(`./status.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("status request failed");
    const payload = await response.json();
    const services = Array.isArray(payload.services) ? payload.services : [];

    list.replaceChildren(...services.map((service) => {
      const row = document.createElement("a");
      const state = statusLabels[service.status] ? service.status : "pending";
      row.className = `status-row ${state}`;
      row.href = service.url;
      row.target = "_blank";
      row.rel = "noreferrer";

      const identity = document.createElement("span");
      identity.className = "status-identity";
      const dot = document.createElement("i");
      const name = document.createElement("b");
      name.textContent = service.name;
      identity.append(dot, name);

      const value = document.createElement("span");
      value.className = "status-value";
      value.textContent = Number.isFinite(service.responseMs)
        ? `${service.responseMs} ms`
        : "—";

      const label = document.createElement("small");
      label.textContent = statusLabels[state];
      value.append(label);
      row.append(identity, value);
      return row;
    }));

    if (!services.length) list.innerHTML = '<div class="status-skeleton">표시할 서비스가 없습니다.</div>';
    updated.textContent = formatStatusTime(payload.generatedAt);
  } catch (error) {
    list.innerHTML = '<div class="status-skeleton error">운영 상태를 불러오지 못했습니다.</div>';
    updated.textContent = "Systems 페이지에서 상태를 다시 확인해 주세요.";
  }
}

function setupIncidentDeck() {
  const layout = document.querySelector(".incident-article-layout");
  const article = layout?.querySelector(".article-body");
  const slides = article ? [...article.querySelectorAll(":scope > .article-block")] : [];
  if (!layout || !article || slides.length < 2) return;

  document.body.classList.add("incident-deck-active");
  article.setAttribute("aria-live", "polite");

  const controls = document.createElement("div");
  controls.className = "deck-controls";
  controls.innerHTML = `
    <button class="deck-button deck-prev" type="button" aria-label="이전 단계">← 이전</button>
    <div class="deck-progress-wrap">
      <span class="deck-counter"></span>
      <div class="deck-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${slides.length}"><i></i></div>
    </div>
    <button class="deck-button deck-next" type="button" aria-label="다음 단계">다음 →</button>`;
  layout.insertBefore(controls, article);

  const counter = controls.querySelector(".deck-counter");
  const progress = controls.querySelector(".deck-progress");
  const progressBar = progress.querySelector("i");
  const prev = controls.querySelector(".deck-prev");
  const next = controls.querySelector(".deck-next");
  const navLinks = [...layout.querySelectorAll('.article-nav a[href^="#"]')];
  let current = Math.max(0, slides.findIndex((slide) => `#${slide.id}` === location.hash));

  function showSlide(index, updateHash = true) {
    current = Math.min(Math.max(index, 0), slides.length - 1);
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === current;
      slide.hidden = !active;
      slide.classList.toggle("is-active", active);
    });
    navLinks.forEach((link) => link.classList.toggle("is-active", link.hash === `#${slides[current].id}`));
    counter.textContent = `${String(current + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")} · ${slides[current].querySelector("h2")?.textContent || ""}`;
    progress.setAttribute("aria-valuenow", String(current + 1));
    progressBar.style.width = `${((current + 1) / slides.length) * 100}%`;
    prev.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    next.textContent = current === slides.length - 1 ? "마지막 단계" : "다음 →";
    if (updateHash) history.replaceState(null, "", `#${slides[current].id}`);
  }

  function revealArticle(behavior = "smooth") {
    controls.scrollIntoView({ behavior, block: "start" });
  }

  prev.addEventListener("click", () => {
    showSlide(current - 1);
    revealArticle();
  });
  next.addEventListener("click", () => {
    showSlide(current + 1);
    revealArticle();
  });
  navLinks.forEach((link) => link.addEventListener("click", (event) => {
    const index = slides.findIndex((slide) => `#${slide.id}` === link.hash);
    if (index < 0) return;
    event.preventDefault();
    showSlide(index);
    revealArticle();
  }));
  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") showSlide(current - 1);
    if (event.key === "ArrowRight") showSlide(current + 1);
  });
  window.addEventListener("hashchange", () => {
    const index = slides.findIndex((slide) => `#${slide.id}` === location.hash);
    if (index >= 0) showSlide(index, false);
  });

  let dragStartX = 0;
  let dragPointerId = null;
  article.classList.add("is-draggable");
  article.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragStartX = event.clientX;
    dragPointerId = event.pointerId;
    article.setPointerCapture(event.pointerId);
    article.classList.add("is-dragging");
  });
  article.addEventListener("pointerup", (event) => {
    if (dragPointerId !== event.pointerId) return;
    const distance = event.clientX - dragStartX;
    article.classList.remove("is-dragging");
    dragPointerId = null;
    if (distance <= -60) showSlide(current + 1);
    if (distance >= 60) showSlide(current - 1);
  });
  article.addEventListener("pointercancel", () => {
    article.classList.remove("is-dragging");
    dragPointerId = null;
  });

  showSlide(current, false);
}

function setupDragTrack() {
  const track = document.querySelector(".troubleshooting-grid");
  if (!track) return;

  let startX = 0;
  let startScroll = 0;
  let pointerId = null;
  let moved = false;

  track.classList.add("is-draggable");
  track.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    startX = event.clientX;
    startScroll = track.scrollLeft;
    pointerId = event.pointerId;
    moved = false;
    track.setPointerCapture(event.pointerId);
    track.classList.add("is-dragging");
  });
  track.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) return;
    const distance = event.clientX - startX;
    if (Math.abs(distance) > 6) moved = true;
    track.scrollLeft = startScroll - distance;
  });
  const finishDrag = () => {
    track.classList.remove("is-dragging");
    pointerId = null;
  };
  track.addEventListener("pointerup", finishDrag);
  track.addEventListener("pointercancel", finishDrag);
  track.addEventListener("click", (event) => {
    if (!moved) return;
    event.preventDefault();
    event.stopPropagation();
    moved = false;
  }, true);
}

loadHomeStatus();
setupIncidentDeck();
setupDragTrack();

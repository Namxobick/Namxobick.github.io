(() => {
  "use strict";

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];
  const root = document.documentElement;
  const projectDialog = $("#project-dialog");
  const imageDialog = $("#image-dialog");
  const content = $("#dialog-content");
  const gallery = window.PORTFOLIO_GALLERY || {};
  const projects = new Map(
    $$(".project-case").map((article) => [
      article.id.replace("case-", ""),
      article,
    ]),
  );
  let currentProject = null;
  let lightbox = { paths: [], index: 0, title: "" };
  let toastTimer;

  function notify(message) {
    clearTimeout(toastTimer);
    $("#toast").textContent = message;
    $("#toast").classList.add("visible");
    toastTimer = setTimeout(
      () => $("#toast").classList.remove("visible"),
      3500,
    );
  }

  function setTheme(dark, persist = false) {
    root.dataset.theme = dark ? "dark" : "light";
    const toggle = $(".theme-toggle");
    toggle.setAttribute("aria-pressed", String(dark));
    toggle.setAttribute(
      "aria-label",
      dark ? "Включить дневной режим" : "Включить ночной режим",
    );
    toggle.title = dark ? "Дневной режим" : "Ночной режим";
    $('meta[name="theme-color"]').content = dark ? "#17271f" : "#f6f5ed";
    if (persist) {
      try {
        localStorage.setItem("andrey-portfolio-theme", root.dataset.theme);
      } catch {}
    }
  }
  try {
    setTheme(localStorage.getItem("andrey-portfolio-theme") === "dark");
  } catch {
    setTheme(false);
  }
  $(".theme-toggle").addEventListener("click", () =>
    setTheme(root.dataset.theme !== "dark", true),
  );
  $("#current-year").textContent = String(new Date().getFullYear());

  function closeMenu() {
    $("#mobile-nav").hidden = true;
    $(".menu-toggle").setAttribute("aria-expanded", "false");
    $(".menu-toggle").setAttribute("aria-label", "Открыть меню");
  }
  $(".menu-toggle").addEventListener("click", () => {
    const open = $("#mobile-nav").hidden;
    $("#mobile-nav").hidden = !open;
    $(".menu-toggle").setAttribute("aria-expanded", String(open));
    $(".menu-toggle").setAttribute(
      "aria-label",
      open ? "Закрыть меню" : "Открыть меню",
    );
  });
  $$("#mobile-nav a").forEach((link) =>
    link.addEventListener("click", closeMenu),
  );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
  const desktopSize = window.matchMedia("(min-width: 681px)");
  desktopSize.addEventListener("change", (event) => {
    if (event.matches) closeMenu();
  });

  $$(".filter[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      const category = button.dataset.filter;
      $$(".filter[data-filter]").forEach((filter) => {
        const selected = filter === button;
        filter.classList.toggle("active", selected);
        filter.setAttribute("aria-pressed", String(selected));
      });
      let count = 0;
      $$(".project-card").forEach((card) => {
        card.hidden =
          category !== "all" &&
          !card.dataset.categories.split(" ").includes(category);
        if (!card.hidden) count++;
      });
      $(".result-count").textContent =
        `${count} ${count === 1 ? "ПРОЕКТ" : "ПРОЕКТА"}`;
    }),
  );

  $("[data-copy-email]").addEventListener("click", async () => {
    const email = "andreyyurin@icloud.com";
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(email);
      notify("Email скопирован");
    } catch {
      const button = $("[data-copy-email]");
      button.textContent = email;
      const range = document.createRange();
      range.selectNodeContents(button);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      notify("Email выделен — нажмите Ctrl+C или ⌘C");
    }
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          $$(".desktop-nav a").forEach((link) =>
            link.classList.toggle(
              "active",
              link.hash === `#${entry.target.id}`,
            ),
          );
        });
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: 0 },
    );
    ["about", "projects", "experience", "contacts"].forEach((id) =>
      observer.observe(document.getElementById(id)),
    );
  }

  if (typeof projectDialog.showModal !== "function") return;

  function updateScrollLock() {
    document.body.classList.toggle(
      "modal-open",
      projectDialog.open || imageDialog.open,
    );
  }

  function createScreenshot(path, alt) {
    const image = document.createElement("img");
    image.decoding = "sync";
    image.loading = "eager";
    image.alt = alt;
    image.src = path;
    return image;
  }

  function renderTourismGallery(container, paths, title) {
    let index = 0;
    let touchStart = null;
    let lastSwipe = 0;
    const viewer = document.createElement("div");
    viewer.className = "tourism-viewer";
    viewer.setAttribute("role", "region");
    viewer.setAttribute("aria-roledescription", "карусель");
    viewer.setAttribute("aria-label", `Скриншоты ${title}`);
    const bar = document.createElement("div");
    bar.className = "tourism-viewer-bar";
    const label = document.createElement("span");
    label.className = "tiny-label";
    label.textContent = "NN-TOURIST / ИНТЕРФЕЙС";
    const enlarge = document.createElement("span");
    enlarge.textContent = "Нажмите, чтобы увеличить ↗";
    bar.append(label, enlarge);
    const stage = document.createElement("button");
    stage.className = "tourism-slide";
    const images = paths.map((path, imageIndex) => {
      const image = createScreenshot(
        path,
        `${title} — скриншот ${imageIndex + 1}`,
      );
      image.width = 1536;
      image.height = 872;
      return image;
    });
    stage.addEventListener("click", () => {
      if (Date.now() - lastSwipe < 400) return;
      openLightbox(paths, index, title);
    });
    const controls = document.createElement("div");
    controls.className = "tourism-controls";
    const previous = document.createElement("button");
    previous.className = "icon-button tourism-prev";
    previous.textContent = "←";
    previous.setAttribute("aria-label", "Предыдущий скриншот");
    const next = document.createElement("button");
    next.className = "icon-button tourism-next";
    next.textContent = "→";
    next.setAttribute("aria-label", "Следующий скриншот");
    const dots = document.createElement("div");
    dots.className = "tourism-dots";
    dots.setAttribute("role", "group");
    dots.setAttribute("aria-label", "Выбрать скриншот");
    const counter = document.createElement("span");
    counter.className = "tourism-counter pixel";
    counter.setAttribute("aria-live", "polite");

    function show(nextIndex) {
      index = (nextIndex + paths.length) % paths.length;
      stage.replaceChildren(images[index]);
      stage.setAttribute(
        "aria-label",
        `Увеличить скриншот ${index + 1} из ${paths.length}`,
      );
      counter.textContent = `${String(index + 1).padStart(2, "0")} / ${String(paths.length).padStart(2, "0")}`;
      $$("button", dots).forEach((dot, dotIndex) => {
        dot.classList.toggle("active", dotIndex === index);
        dot.setAttribute("aria-pressed", String(dotIndex === index));
      });
    }
    paths.forEach((_, dotIndex) => {
      const dot = document.createElement("button");
      dot.setAttribute("aria-label", `Скриншот ${dotIndex + 1}`);
      dot.addEventListener("click", () => show(dotIndex));
      dots.append(dot);
    });
    previous.addEventListener("click", () => show(index - 1));
    next.addEventListener("click", () => show(index + 1));
    viewer.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        show(index + (event.key === "ArrowLeft" ? -1 : 1));
      }
    });
    stage.addEventListener(
      "touchstart",
      (event) => {
        const touch = event.touches[0];
        touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
      },
      { passive: true },
    );
    stage.addEventListener(
      "touchend",
      (event) => {
        const touch = event.changedTouches[0];
        if (!touch || !touchStart) return;
        const dx = touch.clientX - touchStart.x;
        const dy = touch.clientY - touchStart.y;
        touchStart = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          lastSwipe = Date.now();
          show(index + (dx < 0 ? 1 : -1));
        }
      },
      { passive: true },
    );
    stage.addEventListener("touchcancel", () => {
      touchStart = null;
    });
    previous.hidden = next.hidden = paths.length < 2;
    controls.append(previous, dots, counter, next);
    viewer.append(bar, stage, controls);
    container.append(viewer);
    show(0);
  }

  function renderGallery(container, projectKey, title) {
    const groups =
      projectKey === "zalesnoe"
        ? [
            {
              key: "zalesnoe-desktop",
              label: "Компьютерная версия",
              mobile: false,
            },
            { key: "zalesnoe-mobile", label: "Мобильная версия", mobile: true },
          ]
        : [
            {
              key: projectKey,
              label: "Скриншоты",
              mobile: projectKey === "unn",
            },
          ];
    container.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = "Интерфейс";
    container.append(heading);
    if (projectKey === "tourism" && gallery.tourism?.length) {
      renderTourismGallery(container, gallery.tourism, title);
      return;
    }
    const display = document.createElement("div");

    function showGroup(group) {
      display.replaceChildren();
      const paths = gallery[group.key] || [];
      if (!paths.length) {
        display.className = "gallery-empty";
        const label = document.createElement("span");
        label.className = "pixel";
        label.textContent = "[ СКОРО ЗДЕСЬ ]";
        const description = document.createElement("p");
        description.textContent =
          projectKey === "unn"
            ? "Скриншоты приложения появятся позже."
            : `Скриншоты ${group.mobile ? "мобильной" : "компьютерной"} версии появятся позже.`;
        display.append(label, description);
        return;
      }
      display.className = "gallery-grid";
      paths.forEach((path, index) => {
        const button = document.createElement("button");
        button.className = `gallery-thumb${group.mobile ? " mobile" : ""}`;
        button.setAttribute(
          "aria-label",
          `Увеличить скриншот ${index + 1} — ${title}`,
        );
        const image = document.createElement("img");
        image.src = path;
        image.alt = `${title} — скриншот ${index + 1}`;
        image.loading = "lazy";
        button.append(image);
        button.addEventListener("click", () =>
          openLightbox(paths, index, title),
        );
        display.append(button);
      });
    }

    if (groups.length > 1) {
      const tabs = document.createElement("div");
      tabs.className = "gallery-tabs";
      tabs.setAttribute("role", "group");
      tabs.setAttribute("aria-label", "Версия интерфейса");
      groups.forEach((group, index) => {
        const button = document.createElement("button");
        button.className = `filter${index === 0 ? " active" : ""}`;
        button.textContent = group.label;
        button.setAttribute("aria-pressed", String(index === 0));
        button.addEventListener("click", () => {
          $$("button", tabs).forEach((tab) => {
            tab.classList.toggle("active", tab === button);
            tab.setAttribute("aria-pressed", String(tab === button));
          });
          showGroup(group);
        });
        tabs.append(button);
      });
      container.append(tabs);
    }
    container.append(display);
    showGroup(groups[0]);
  }

  function openProject(key) {
    if (!projects.has(key) || (currentProject === key && projectDialog.open))
      return;
    currentProject = key;
    const article = projects.get(key).cloneNode(true);
    article.removeAttribute("id");
    const title = $("h2", article);
    title.id = "dialog-title";
    title.tabIndex = -1;
    const galleryContainer = $("[data-gallery]", article);
    if (galleryContainer)
      renderGallery(
        galleryContainer,
        galleryContainer.dataset.gallery,
        title.textContent,
      );
    content.replaceChildren(article);
    if (imageDialog.open) imageDialog.close();
    if (!projectDialog.open) projectDialog.showModal();
    projectDialog.scrollTop = 0;
    title.focus({ preventScroll: true });
    updateScrollLock();
  }

  function closeProject() {
    if (imageDialog.open) imageDialog.close();
    if (history.state?.portfolioProject) {
      history.back();
    } else {
      history.replaceState(
        null,
        "",
        `${location.pathname}${location.search}#projects`,
      );
      projectDialog.close();
      currentProject = null;
      updateScrollLock();
    }
  }

  function syncRoute() {
    const key = location.hash.replace(/^#case-/, "");
    if (location.hash.startsWith("#case-") && projects.has(key)) {
      openProject(key);
    } else {
      if (imageDialog.open) imageDialog.close();
      if (projectDialog.open) projectDialog.close();
      currentProject = null;
      updateScrollLock();
    }
  }

  $$("[data-open-project]").forEach((link) =>
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      event.preventDefault();
      const key = link.dataset.openProject;
      history.pushState({ portfolioProject: key }, "", `#case-${key}`);
      openProject(key);
    }),
  );
  $("[data-close-project]").addEventListener("click", closeProject);
  projectDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeProject();
  });
  projectDialog.addEventListener("close", updateScrollLock);
  window.addEventListener("popstate", syncRoute);
  window.addEventListener("hashchange", syncRoute);

  function updateLightbox() {
    const { paths, index, title } = lightbox;
    const image = createScreenshot(
      paths[index],
      `${title} — скриншот ${index + 1} из ${paths.length}`,
    );
    image.id = "lightbox-image";
    $("#lightbox-image").replaceWith(image);
    $("#image-counter").textContent =
      `${title} / ${index + 1} из ${paths.length}`;
    $(".lightbox-prev").hidden = paths.length < 2;
    $(".lightbox-next").hidden = paths.length < 2;
  }

  function openLightbox(paths, index, title) {
    lightbox = { paths, index, title };
    updateLightbox();
    imageDialog.showModal();
    updateScrollLock();
  }

  function stepLightbox(direction) {
    lightbox.index =
      (lightbox.index + direction + lightbox.paths.length) %
      lightbox.paths.length;
    updateLightbox();
  }
  $(".lightbox-prev").addEventListener("click", () => stepLightbox(-1));
  $(".lightbox-next").addEventListener("click", () => stepLightbox(1));
  $("[data-close-image]").addEventListener("click", () => imageDialog.close());
  imageDialog.addEventListener("close", updateScrollLock);
  imageDialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      stepLightbox(event.key === "ArrowLeft" ? -1 : 1);
    }
  });
  [projectDialog, imageDialog].forEach((dialog) =>
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      ) {
        if (dialog === imageDialog) imageDialog.close();
        else closeProject();
      }
    }),
  );

  root.classList.add("enhanced");
  syncRoute();
})();

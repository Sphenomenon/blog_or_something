(() => {
  const pageType = document.body.dataset.page || "daily";
  const storageKey = document.body.dataset.storageKey || `emei-internship-${location.pathname}`;
  const editButton = document.querySelector("#edit-toggle");
  const saveStatus = document.querySelector("#save-status");
  const editables = [...document.querySelectorAll(".editable[data-field]")];
  const quoteChecks = [...document.querySelectorAll(".quote-check")];
  const checklist = [...document.querySelectorAll("[data-check]")];
  let editing = false;
  let saveTimer;

  const defaultData = {
    fields: Object.fromEntries(editables.map((node) => [node.dataset.field, node.innerHTML])),
    quotes: Object.fromEntries(quoteChecks.map((node, index) => [node.dataset.quoteId || String(index + 1), false])),
    checks: Object.fromEntries(checklist.map((node) => [node.dataset.check, false]))
  };

  function readStoredData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey));
      return parsed && parsed.fields ? parsed : defaultData;
    } catch {
      return defaultData;
    }
  }

  function collectData() {
    return {
      fields: Object.fromEntries(editables.map((node) => [node.dataset.field, node.innerHTML])),
      quotes: Object.fromEntries(quoteChecks.map((node, index) => [node.dataset.quoteId || String(index + 1), node.checked])),
      checks: Object.fromEntries(checklist.map((node) => [node.dataset.check, node.checked]))
    };
  }

  function save() {
    if (!editables.length && !checklist.length) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(collectData()));
      if (saveStatus) saveStatus.textContent = `已自动保存 · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      if (saveStatus) saveStatus.textContent = "自动保存失败";
    }
  }

  function queueSave() {
    if (saveStatus) saveStatus.textContent = "正在保存…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  }

  function updateVerification() {
    const count = quoteChecks.filter((node) => node.checked).length;
    const scenesVerified = Boolean(document.querySelector('[data-check="scene"]')?.checked);
    const quotesVerified = quoteChecks.length === 3 && quoteChecks.every((node, index) => {
      const text = document.querySelector(`[data-field="quote-${index + 1}"]`)?.textContent.trim() || "";
      return node.checked && !text.includes("待录入") && text.length > 3;
    });
    const completionCount = document.querySelector("#completion-count");
    const state = document.querySelector("#verification-state");
    const documentStatus = document.querySelector("#document-status");
    if (completionCount) completionCount.textContent = `${count} / ${quoteChecks.length || 3}`;
    if (state) {
      state.textContent = quotesVerified && scenesVerified ? "真实场景与三句原话均已核实" : "当前仍含待核实内容";
      state.classList.toggle("warning-text", !(quotesVerified && scenesVerified));
    }
    if (documentStatus) documentStatus.textContent = quotesVerified && scenesVerified ? "内容已核实" : "待补充真实记录";
    document.querySelectorAll(".scene-draft-badge").forEach((badge) => {
      badge.textContent = scenesVerified ? "已替换为真实观察" : "待核实草稿";
      badge.classList.toggle("verified-badge", scenesVerified);
    });
    quoteChecks.forEach((node) => node.closest(".quote-card")?.classList.toggle("verified", node.checked));
  }

  function applyData(data) {
    editables.forEach((node) => {
      if (Object.prototype.hasOwnProperty.call(data.fields || {}, node.dataset.field)) node.innerHTML = data.fields[node.dataset.field];
    });
    quoteChecks.forEach((node, index) => { node.checked = Boolean(data.quotes?.[node.dataset.quoteId || String(index + 1)] ?? data.quotes?.[index]); });
    checklist.forEach((node) => { node.checked = Boolean(data.checks?.[node.dataset.check]); });
    updateVerification();
  }

  function setEditing(nextState) {
    editing = nextState;
    document.body.classList.toggle("editing", editing);
    editables.forEach((node) => node.contentEditable = String(editing));
    if (editButton) {
      editButton.textContent = editing ? "结束编辑" : "编辑内容";
      editButton.setAttribute("aria-pressed", String(editing));
    }
    if (!editing) save();
  }

  const sections = [...document.querySelectorAll(".prose section[data-toc]")];
  const toc = document.querySelector("#toc");
  if (toc) {
    sections.forEach((section, index) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${section.id}`;
      link.innerHTML = `<span class="toc-index">${String(index + 1).padStart(2, "0")}</span><span>${section.dataset.toc}</span>`;
      item.append(link);
      toc.append(item);
    });
    const tocLinks = [...toc.querySelectorAll("a")];
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        tocLinks.forEach((link) => {
          const active = link.hash === `#${visible.target.id}`;
          link.classList.toggle("active", active);
          if (active) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current");
        });
      }, { rootMargin: "-12% 0px -70%", threshold: 0 });
      sections.forEach((section) => observer.observe(section));
    }
  }

  editButton?.addEventListener("click", () => setEditing(!editing));
  document.querySelector("#print-button")?.addEventListener("click", () => window.print());
  document.querySelector("#reset-button")?.addEventListener("click", () => {
    if (!window.confirm("恢复当前页面的初始内容？浏览器中保存的修改将被清除。")) return;
    localStorage.removeItem(storageKey);
    applyData(defaultData);
    if (saveStatus) saveStatus.textContent = "已恢复初始内容";
  });
  document.querySelector("#back-to-top")?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  editables.forEach((node) => node.addEventListener("input", () => { updateVerification(); queueSave(); }));
  [...quoteChecks, ...checklist].forEach((node) => node.addEventListener("change", () => { updateVerification(); save(); }));
  window.addEventListener("beforeprint", () => setEditing(false));
  if (pageType === "daily") applyData(readStoredData());
})();

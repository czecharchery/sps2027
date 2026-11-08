(function () {
  "use strict";

  const METRIC_DEFINITIONS = [
    {
      key: "total6Plus",
      title: "Soutěžící mládež",
      tooltip:
        "Počet mládeže s alespoň 6 absolvovanými závody napříč disciplínami a divizemi",
      isPrimary: true,
      filterFn: (archer) => archer.totalRaces >= 6,
      subBadgeFn: (archer) => formatRaces(archer.totalRaces) + " celkem",
    },
    {
      key: "divRL",
      title: "Soutěžící mládež (RL)",
      tooltip:
        "Počet mládeže s alespoň 6 absolvovanými závody napříč disciplínami a divizemi, kteří mají alespoň 1 závod v divizi RL",
      isPrimary: false,
      filterFn: (archer) => (archer.divisions.RL || 0) >= 1,
      subBadgeFn: (archer) =>
        `RL: ${formatRaces(archer.divisions.RL || 0)} (celkem ${archer.totalRaces})`,
    },
    {
      key: "divKL",
      title: "Soutěžící mládež (KL)",
      tooltip:
        "Počet mládeže s alespoň 6 absolvovanými závody napříč disciplínami a divizemi, kteří mají alespoň 1 závod v divizi KL",
      isPrimary: false,
      filterFn: (archer) => (archer.divisions.KL || 0) >= 1,
      subBadgeFn: (archer) =>
        `KL: ${formatRaces(archer.divisions.KL || 0)} (celkem ${archer.totalRaces})`,
    },
    {
      key: "divHL",
      title: "Soutěžící mládež (HL)",
      tooltip:
        "Počet mládeže s alespoň 6 absolvovanými závody napříč disciplínami a divizemi, kteří mají alespoň 1 závod v divizi HL",
      isPrimary: false,
      filterFn: (archer) => (archer.divisions.HL || 0) >= 1,
      subBadgeFn: (archer) =>
        `HL: ${formatRaces(archer.divisions.HL || 0)} (celkem ${archer.totalRaces})`,
    },
    {
      key: "divTL",
      title: "Soutěžící mládež (TL)",
      tooltip:
        "Počet mládeže s alespoň 6 absolvovanými závody napříč disciplínami a divizemi, kteří mají alespoň 1 závod v divizi TL",
      isPrimary: false,
      filterFn: (archer) => (archer.divisions.TL || 0) >= 1,
      subBadgeFn: (archer) =>
        `TL: ${formatRaces(archer.divisions.TL || 0)} (celkem ${archer.totalRaces})`,
    },
    {
      key: "discHalova",
      title: "Soutěžící mládež (hala)",
      tooltip:
        "Počet mládeže s alespoň 6 absolvovanými závody napříč disciplínami a divizemi, kteří mají alespoň 1 závod v disciplíně halová lukostřelba",
      isPrimary: false,
      filterFn: (archer) => (archer.disciplines.halova || 0) >= 1,
      subBadgeFn: (archer) =>
        `Hala: ${formatRaces(archer.disciplines.halova || 0)} (celkem ${archer.totalRaces})`,
    },
    {
      key: "discTercova",
      title: "Soutěžící mládež (terčová)",
      tooltip:
        "Počet mládeže s alespoň 6 absolvovanými závody napříč disciplínami a divizemi, kteří mají alespoň 1 závod v disciplíně terčová lukostřelba",
      isPrimary: false,
      filterFn: (archer) => (archer.disciplines.tercova || 0) >= 1,
      subBadgeFn: (archer) =>
        `Terčová: ${formatRaces(archer.disciplines.tercova || 0)} (celkem ${archer.totalRaces})`,
    },
    {
      key: "discTerenni",
      title: "Soutěžící mládež (terénní)",
      tooltip:
        "Počet mládeže s alespoň 6 absolvovanými závody napříč disciplínami a divizemi, kteří mají alespoň 1 závod v disciplíně terénní lukostřelba",
      isPrimary: false,
      filterFn: (archer) => (archer.disciplines.terenni || 0) >= 1,
      subBadgeFn: (archer) =>
        `Terénní: ${formatRaces(archer.disciplines.terenni || 0)} (celkem ${archer.totalRaces})`,
    },
    {
      key: "disc3D",
      title: "Soutěžící mládež (3D)",
      tooltip:
        "Počet mládeže s alespoň 6 absolvovanými závody napříč disciplínami a divizemi, kteří mají alespoň 1 závod v disciplíně 3D lukostřelba",
      isPrimary: false,
      filterFn: (archer) => (archer.disciplines["3d"] || 0) >= 1,
      subBadgeFn: (archer) =>
        `3D: ${formatRaces(archer.disciplines["3d"] || 0)} (celkem ${archer.totalRaces})`,
    },
  ];

  let appData = null;
  let searchQuery = "";

  function formatRaces(n) {
    if (n === 1) return "1 závod";
    if (n >= 2 && n <= 4) return `${n} závody`;
    return `${n} závodů`;
  }

  function formatArchersCount(n) {
    if (n === 1) return "1 závodník";
    if (n >= 2 && n <= 4) return `${n} závodníci`;
    return `${n} závodníků`;
  }

  function formatClubsCount(n) {
    if (n === 1) return "1 klub";
    if (n >= 2 && n <= 4) return `${n} kluby`;
    return `${n} klubů`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeText(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function formatCellValue(val, isHighlight = false) {
    if (isHighlight) {
      return `<span>${val}</span>`;
    }
    if (!val || val === 0) {
      return `<span class="val-zero">0</span>`;
    }
    return `<span class="val-positive">${val}</span>`;
  }

  function getClubSpsLabel(club) {
    if (!club || !club.counts) return null;
    const total = club.counts.total6Plus || 0;
    const limitMet = club.counts.cupLimitMet || 0;
    if (total < 10) return null;
    return limitMet >= 6 ? "SpS A" : "SpS B";
  }

  function renderSpsBadge(club) {
    const label = getClubSpsLabel(club);
    if (!label) return "";
    const isA = label === "SpS A";
    const cls = isA ? "sps-badge sps-badge-a" : "sps-badge sps-badge-b";
    const title = isA
      ? "SpS A: Soutěžící mládež ≥ 10 a Splněný limit (Pohár) ≥ 6"
      : "SpS B: Soutěžící mládež ≥ 10 a Splněný limit (Pohár) < 6";
    return `<span class="${cls}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
  }

  function renderOverviewKpis(clubs) {
    const totalClubsEl = document.getElementById("kpiTotalClubs");
    const totalArchersEl = document.getElementById("kpiTotalArchers");
    const divisionsEl = document.getElementById("kpiDivisions");
    const disciplinesEl = document.getElementById("kpiDisciplines");
    const cupEl = document.getElementById("kpiCup");

    const sum = (key) => clubs.reduce((acc, c) => acc + (c.counts[key] || 0), 0);

    totalClubsEl.textContent = clubs.length;
    totalArchersEl.textContent = sum("total6Plus");
    divisionsEl.textContent = `${sum("divRL")} / ${sum("divKL")} / ${sum("divHL")} / ${sum("divTL")}`;
    disciplinesEl.textContent = `${sum("discHalova")} / ${sum("discTercova")} / ${sum("discTerenni")} / ${sum("disc3D")}`;
    if (cupEl) {
      cupEl.textContent = `${sum("cupParticipants")} / ${sum("cupLimitMet")}`;
    }
  }

  function renderMainTable() {
    if (!appData) return;

    const tbody = document.getElementById("clubsTableBody");
    const tfoot = document.getElementById("clubsTableFoot");
    const countInfo = document.getElementById("tableCountInfo");

    const q = normalizeText(searchQuery.trim());
    const filteredClubs = appData.clubs.filter((club) => {
      if (!q) return true;
      if (normalizeText(club.name).includes(q)) return true;
      if ((club.archers || []).some((a) => normalizeText(a.name).includes(q)))
        return true;
      return (club.cupArchers || []).some((a) =>
        normalizeText(a.name).includes(q)
      );
    });

    countInfo.textContent = q
      ? `Nalezeno: ${formatClubsCount(filteredClubs.length)} (z celkem ${appData.clubs.length})`
      : `Zobrazeno ${formatClubsCount(filteredClubs.length)}`;

    if (filteredClubs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="13" class="empty-cell">
            Žádný klub ani závodník neodpovídá hledanému výrazu „${escapeHtml(searchQuery)}“.
          </td>
        </tr>
      `;
      tfoot.innerHTML = "";
      return;
    }

    tbody.innerHTML = filteredClubs
      .map((club, idx) => {
        const c = club.counts;
        const rowClass = c.total6Plus >= 10 ? ' class="row-10plus"' : "";
        return `
          <tr${rowClass}>
            <td class="col-rank">${idx + 1}.</td>
            <td class="col-club">
              <div class="club-cell-inner">
                <a href="#club=${encodeURIComponent(club.id)}" class="club-link" data-club-id="${club.id}">
                  ${escapeHtml(club.name)}
                </a>
                ${renderSpsBadge(club)}
              </div>
            </td>
            <td class="col-num col-highlight">${formatCellValue(c.total6Plus, true)}</td>
            <td class="col-num">${formatCellValue(c.divRL)}</td>
            <td class="col-num">${formatCellValue(c.divKL)}</td>
            <td class="col-num">${formatCellValue(c.divHL)}</td>
            <td class="col-num">${formatCellValue(c.divTL)}</td>
            <td class="col-num">${formatCellValue(c.discHalova)}</td>
            <td class="col-num">${formatCellValue(c.discTercova)}</td>
            <td class="col-num">${formatCellValue(c.discTerenni)}</td>
            <td class="col-num">${formatCellValue(c.disc3D)}</td>
            <td class="col-num col-cup">${formatCellValue(c.cupParticipants)}</td>
            <td class="col-num col-cup">${formatCellValue(c.cupLimitMet)}</td>
          </tr>
        `;
      })
      .join("");

    const sum = (key) =>
      filteredClubs.reduce((acc, c) => acc + (c.counts[key] || 0), 0);

    tfoot.innerHTML = `
      <tr>
        <td class="col-rank"></td>
        <td class="col-club">Celkem (${formatClubsCount(filteredClubs.length)})</td>
        <td class="col-num col-highlight">${sum("total6Plus")}</td>
        <td class="col-num">${sum("divRL")}</td>
        <td class="col-num">${sum("divKL")}</td>
        <td class="col-num">${sum("divHL")}</td>
        <td class="col-num">${sum("divTL")}</td>
        <td class="col-num">${sum("discHalova")}</td>
        <td class="col-num">${sum("discTercova")}</td>
        <td class="col-num">${sum("discTerenni")}</td>
        <td class="col-num">${sum("disc3D")}</td>
        <td class="col-num col-cup">${sum("cupParticipants")}</td>
        <td class="col-num col-cup">${sum("cupLimitMet")}</td>
      </tr>
    `;
  }

  function buildArcherBreakdownTags(archer) {
    const tags = [];
    if (archer.ageCategories && archer.ageCategories.length > 0) {
      tags.push(
        `<span class="archer-tag" title="Věková třída">${escapeHtml(
          archer.ageCategories.join(", ")
        )}</span>`
      );
    }

    const divParts = [];
    for (const [divName, cnt] of Object.entries(archer.divisions || {})) {
      if (cnt > 0) divParts.push(`${divName}: ${cnt}`);
    }
    if (divParts.length > 0) {
      tags.push(
        `<span class="archer-tag" title="Závody podle divizí">Divize: ${escapeHtml(
          divParts.join(", ")
        )}</span>`
      );
    }

    const discLabels = {
      halova: "Hala",
      tercova: "Terčová",
      terenni: "Terénní",
      "3d": "3D",
    };
    const discParts = [];
    for (const [key, label] of Object.entries(discLabels)) {
      const cnt = (archer.disciplines && archer.disciplines[key]) || 0;
      if (cnt > 0) discParts.push(`${label}: ${cnt}`);
    }
    if (discParts.length > 0) {
      tags.push(
        `<span class="archer-tag" title="Závody podle disciplín">${escapeHtml(
          discParts.join(" • ")
        )}</span>`
      );
    }

    return tags.join("");
  }

  function renderClubDetail(clubId) {
    if (!appData) return;

    const club = appData.clubs.find(
      (c) => String(c.id) === String(clubId) || c.slug === String(clubId)
    );

    const overviewSection = document.getElementById("clubsOverviewSection");
    const detailSection = document.getElementById("clubDetailSection");

    if (!club) {
      overviewSection.classList.remove("hidden");
      detailSection.classList.add("hidden");
      return;
    }

    overviewSection.classList.add("hidden");
    detailSection.classList.remove("hidden");

    document.getElementById("detailClubName").innerHTML = `
      <span>${escapeHtml(club.name)}</span>
      ${renderSpsBadge(club)}
    `;
    document.getElementById("detailClubTotal").textContent =
      club.counts.total6Plus;

    const c = club.counts;
    document.getElementById("detailSummaryRow").innerHTML = `
      <tr>
        <td class="col-club">
          <div class="club-cell-inner">
            <strong>${escapeHtml(club.name)}</strong>
            ${renderSpsBadge(club)}
          </div>
        </td>
        <td class="col-num col-highlight">${formatCellValue(c.total6Plus, true)}</td>
        <td class="col-num">${formatCellValue(c.divRL)}</td>
        <td class="col-num">${formatCellValue(c.divKL)}</td>
        <td class="col-num">${formatCellValue(c.divHL)}</td>
        <td class="col-num">${formatCellValue(c.divTL)}</td>
        <td class="col-num">${formatCellValue(c.discHalova)}</td>
        <td class="col-num">${formatCellValue(c.discTercova)}</td>
        <td class="col-num">${formatCellValue(c.discTerenni)}</td>
        <td class="col-num">${formatCellValue(c.disc3D)}</td>
        <td class="col-num col-cup">${formatCellValue(c.cupParticipants)}</td>
        <td class="col-num col-cup">${formatCellValue(c.cupLimitMet)}</td>
      </tr>
    `;

    const container = document.getElementById("detailCategoriesContainer");
    const rankingCardsHtml = METRIC_DEFINITIONS.map((metric) => {
      const matchingArchers = club.archers.filter(metric.filterFn);
      const count = matchingArchers.length;
      const countClass = count === 0 ? "category-count-pill count-zero" : "category-count-pill";
      const cardClass = metric.isPrimary
        ? "category-card category-card-primary"
        : "category-card";

      const archersHtml =
        count === 0
          ? `<p class="empty-category-msg">Žádný závodník v této kategorii.</p>`
          : `<ul class="archer-list">
              ${matchingArchers
                .map(
                  (archer) => `
                  <li class="archer-item">
                    <div class="archer-top">
                      <span class="archer-name">${escapeHtml(archer.name)}</span>
                      <span class="archer-races-badge">${escapeHtml(
                        metric.subBadgeFn(archer)
                      )}</span>
                    </div>
                    <div class="archer-meta">
                      ${buildArcherBreakdownTags(archer)}
                    </div>
                  </li>
                `
                )
                .join("")}
            </ul>`;

      return `
        <article class="${cardClass}">
          <header class="category-card-header">
            <h3 class="category-title" title="${escapeHtml(metric.tooltip || metric.title)}">${escapeHtml(metric.title)}</h3>
            <span class="${countClass}">${formatArchersCount(count)}</span>
          </header>
          <div class="category-body">
            ${archersHtml}
          </div>
        </article>
      `;
    }).join("");

    const cupArchers = club.cupArchers || [];
    const cupSections = [
      {
        title: "Účastníci Poháru",
        tooltip:
          "Počet závodníků, kteří se zúčastnili Poháru v terčové lukostřelbě",
        list: cupArchers,
      },
      {
        title: "Splněný limit (Pohár)",
        tooltip:
          "Počet závodníků, kteří v Poháru v terčové lukostřelbě splnili Limit SpS (Splněno = ANO)",
        list: cupArchers.filter((a) => a.limitMet),
      },
    ];

    const cupCardsHtml = cupSections
      .map((sec) => {
        const count = sec.list.length;
        const countClass =
          count === 0
            ? "category-count-pill count-zero"
            : "category-count-pill";

        const listHtml =
          count === 0
            ? `<p class="empty-category-msg">Žádný závodník v této kategorii.</p>`
            : `<ul class="archer-list">
                ${sec.list
                  .map((ca) => {
                    const badgeClass = ca.limitMet
                      ? "archer-races-badge badge-met-yes"
                      : "archer-races-badge badge-met-no";
                    const badgeText = ca.limitMet
                      ? "Splněno: ANO"
                      : "Splněno: NE";
                    const entriesTags = (ca.entries || [])
                      .map((e) => {
                        const limStr =
                          e.limit && e.limit < 999
                            ? ` (limit ${e.limit})`
                            : "";
                        return `<span class="archer-tag">${escapeHtml(
                          `${e.code}: Ø ${e.average}${limStr}`
                        )}</span>`;
                      })
                      .join("");

                    return `
                      <li class="archer-item">
                        <div class="archer-top">
                          <span class="archer-name">${escapeHtml(ca.name)}</span>
                          <span class="${badgeClass}">${badgeText}</span>
                        </div>
                        <div class="archer-meta">
                          ${entriesTags}
                        </div>
                      </li>
                    `;
                  })
                  .join("")}
              </ul>`;

        return `
          <article class="category-card category-card-cup">
            <header class="category-card-header">
              <h3 class="category-title" title="${escapeHtml(sec.tooltip)}">${escapeHtml(sec.title)}</h3>
              <span class="${countClass}">${formatArchersCount(count)}</span>
            </header>
            <div class="category-body">
              ${listHtml}
            </div>
          </article>
        `;
      })
      .join("");

    container.innerHTML = rankingCardsHtml + cupCardsHtml;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleRoute() {
    if (!appData) return;
    const hash = window.location.hash || "";
    const match = hash.match(/^#club=(.+)$/);

    if (match && match[1]) {
      const clubId = decodeURIComponent(match[1]);
      renderClubDetail(clubId);
    } else {
      document.getElementById("clubDetailSection").classList.add("hidden");
      document.getElementById("clubsOverviewSection").classList.remove("hidden");
      renderMainTable();
    }
  }

  function initApp(data) {
    data.clubs = (data.clubs || []).filter(
      (c) => c.slug !== "neregistrovani" && c.name !== "Neregistrovaní"
    );
    appData = data;

    if (data.season) {
      document.getElementById("seasonLabel").textContent = data.season;
      document
        .querySelectorAll(".detail-season")
        .forEach((el) => (el.textContent = data.season));
    }

    if (data.generatedAt) {
      const d = new Date(data.generatedAt);
      if (!isNaN(d.getTime())) {
        document.getElementById("generatedAtPill").textContent =
          "Data uložena: " +
          d.toLocaleDateString("cs-CZ") +
          " " +
          d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
      }
    }

    renderOverviewKpis(data.clubs || []);
    renderMainTable();
    handleRoute();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("clubSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value || "";
        renderMainTable();
      });
    }

    window.addEventListener("hashchange", handleRoute);

    if (window.SPS_DATA) {
      initApp(window.SPS_DATA);
    } else {
      fetch("data.json")
        .then((res) => res.json())
        .then((data) => initApp(data))
        .catch((err) => {
          console.error("Chyba při načítání lokálních dat:", err);
          const tbody = document.getElementById("clubsTableBody");
          if (tbody) {
            tbody.innerHTML = `
              <tr>
                <td colspan="10" class="empty-cell">
                  Nepodařilo se načíst lokální data (data.js / data.json).
                </td>
              </tr>
            `;
          }
        });
    }
  });
})();

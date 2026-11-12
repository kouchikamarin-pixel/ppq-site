/*
 * Contenu du site, chargé depuis le dossier data/ :
 *   site.json        coordonnées et réseaux (pied de page, page Contact)
 *   evenements.json  événements (accueil et page Évènements) ; une date
 *                    « dateAutomatique » affiche le mois de la prochaine date de ciel-ouvert.json
 *   faq.json         questions fréquentes (page FAQ)
 *   priere.json      programme de prière du mois (page Prières)
 *   ciel-ouvert.json prochaines dates de Ciel Ouvert (page Ciel Ouvert)
 * Modifier ces fichiers suffit à mettre à jour les pages.
 * Si un fichier ne se charge pas (ex. page ouverte directement depuis le disque),
 * les coordonnées écrites dans le HTML restent affichées ; les listes affichent un message.
 */
(function () {
  "use strict";

  const DATA_DIR = "data/";

  const MONTHS_FR = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];

  // Devant une voyelle on écrit « d'Avril », « d'Août », « d'Octobre ».
  const VOWEL_START = /^[AEIOU]/i;

  async function fetchJson(fileName) {
    const response = await fetch(DATA_DIR + fileName, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Impossible de charger ${fileName} (HTTP ${response.status})`);
    }
    return response.json();
  }

  function requireValue(source, key) {
    if (!(key in source)) {
      throw new Error(`Clé manquante : ${key}`);
    }
    return source[key];
  }

  function fieldOf(card, field) {
    const element = card.querySelector(`[data-field="${field}"]`);
    if (!element) {
      throw new Error(`Champ manquant dans le modèle : ${field}`);
    }
    return element;
  }

  function cloneTemplate(template) {
    return template.content.firstElementChild.cloneNode(true);
  }

  function showError(container, message) {
    const paragraph = document.createElement("p");
    paragraph.className = "col-12 text-center";
    paragraph.textContent = message;
    container.replaceChildren(paragraph);
  }

  // Coordonnées : [data-bind] reçoit un texte, [data-bind-href] reçoit un lien.
  function bindSiteInfo(site) {
    document.querySelectorAll("[data-bind]").forEach((element) => {
      element.textContent = requireValue(site, element.dataset.bind);
    });
    document.querySelectorAll("[data-bind-href]").forEach((element) => {
      element.setAttribute("href", requireValue(site, element.dataset.bindHref));
    });
  }

  // Une date « dateAutomatique » affiche le mois de la prochaine date de Ciel Ouvert.
  // Sans date à venir, on affiche le texte de secours écrit dans evenements.json.
  function dateAffichee(evenement, prochaineDate) {
    if (evenement.dateAutomatique && prochaineDate) {
      return monthYearFr(prochaineDate);
    }
    return requireValue(evenement, "date");
  }

  async function renderEvents(evenements, container, template) {
    const limit = Number(container.dataset.limit) || evenements.length;
    const prochaineDate = await prochaineDateCielOuvert();
    const cards = evenements.slice(0, limit).map((evenement) => {
      const card = cloneTemplate(template);
      const image = fieldOf(card, "image");
      image.src = requireValue(evenement, "image");
      image.alt = requireValue(evenement, "titre");
      card.querySelectorAll("a").forEach((link) => {
        link.setAttribute("href", requireValue(evenement, "lien"));
      });
      fieldOf(card, "titre").textContent = requireValue(evenement, "titre");
      fieldOf(card, "lieu").textContent = requireValue(evenement, "lieu");
      const dateText = dateAffichee(evenement, prochaineDate);
      if (dateText) {
        fieldOf(card, "date").textContent = dateText;
      } else {
        // Sans date, on retire la ligne entière (icône comprise).
        fieldOf(card, "date").closest(".job-date")?.remove();
      }
      fieldOf(card, "description").textContent = requireValue(evenement, "description");
      return card;
    });
    container.replaceChildren(...cards);
  }

  function renderFaq(questions, container, template) {
    const items = questions.map((question) => {
      const item = cloneTemplate(template);
      fieldOf(item, "question").textContent = requireValue(question, "question");
      fieldOf(item, "reponse").textContent = requireValue(question, "reponse");

      const list = fieldOf(item, "points");
      if (question.points && question.points.length > 0) {
        list.replaceChildren(
          ...question.points.map((point) => {
            const li = document.createElement("li");
            li.textContent = point;
            return li;
          }),
        );
      } else {
        list.remove();
      }
      return item;
    });
    container.replaceChildren(...items);
  }

  function getYearAndMonthIndex(timeZone, date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "numeric",
    }).formatToParts(date);
    const findPart = (type) => {
      const part = parts.find((p) => p.type === type);
      if (!part) {
        throw new Error("Format de date inattendu : " + type);
      }
      return Number(part.value);
    };
    return { year: findPart("year"), monthIndex: findPart("month") - 1 };
  }

  function prayerTitle(monthName, year) {
    const connector = VOWEL_START.test(monthName) ? "d'" : "de ";
    return `Prière du Mois ${connector}${monthName} (1er ${monthName} ${year})`;
  }

  function renderPrayer(priere, container, template) {
    const now = getYearAndMonthIndex(requireValue(priere, "fuseau"), new Date());
    const card = cloneTemplate(template);
    fieldOf(card, "title").textContent = prayerTitle(MONTHS_FR[now.monthIndex], now.year);
    fieldOf(card, "location").textContent = requireValue(priere, "lieu");
    fieldOf(card, "time").textContent = requireValue(priere, "heure");
    fieldOf(card, "text").textContent = requireValue(priere, "description");
    fieldOf(card, "facebook").setAttribute("href", requireValue(priere, "facebook"));
    fieldOf(card, "zoom").setAttribute("href", requireValue(priere, "zoom"));
    container.replaceChildren(card);
  }

  // « novembre 2026 » avec une majuscule : « Novembre 2026 ».
  function monthYearFr(isoDate) {
    const text = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    }).format(new Date(`${isoDate}T12:00:00Z`));
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function formatDateFr(isoDate) {
    // Midi UTC : le jour affiché ne change pas selon le fuseau.
    return new Intl.DateTimeFormat("fr-CA", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${isoDate}T12:00:00Z`));
  }

  // Date du jour à Montréal, au format AAAA-MM-JJ (comparable à une date ISO).
  function todayInMontreal() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  // Dates à venir (à partir d'aujourd'hui, à Montréal), de la plus proche à la plus lointaine.
  function upcomingCielDates(dates) {
    const today = todayInMontreal();
    return dates
      .filter((entry) => requireValue(entry, "date") >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Première date à venir de ciel-ouvert.json, ou null si le fichier est absent ou sans date à venir.
  async function prochaineDateCielOuvert() {
    try {
      const dates = upcomingCielDates(await fetchJson("ciel-ouvert.json"));
      return dates.length > 0 ? dates[0].date : null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function renderCielDates(dates, container, template) {
    const upcoming = upcomingCielDates(dates);
    if (upcoming.length === 0) {
      const message = document.createElement("p");
      message.textContent = "Les prochaines dates seront annoncées bientôt.";
      container.replaceChildren(message);
      return;
    }
    const items = upcoming.map((entry) => {
      const item = cloneTemplate(template);
      fieldOf(item, "date").textContent = formatDateFr(entry.date);
      // L'heure et le lieu sont facultatifs : on n'affiche que ceux qui sont remplis.
      fieldOf(item, "details").textContent = [entry.heure, entry.lieu].filter(Boolean).join(" · ");
      return item;
    });
    container.replaceChildren(...items);
  }

  async function renderSection({ containerId, templateId, fileName, render, errorMessage }) {
    const container = document.getElementById(containerId);
    const template = document.getElementById(templateId);
    if (!container || !template) {
      return;
    }
    try {
      const data = await fetchJson(fileName);
      await render(data, container, template);
    } catch (error) {
      console.error(error);
      showError(container, errorMessage);
    }
  }

  // Affiche le programme sur l'accueil seulement si aujourd'hui (à Montréal) est un jour listé dans ciel-ouvert.json.
  async function showCielProgrammeToday() {
    const banner = document.getElementById("ciel-programme");
    if (!banner) {
      return;
    }
    try {
      const dates = await fetchJson("ciel-ouvert.json");
      const today = todayInMontreal();
      banner.hidden = !dates.some((entry) => requireValue(entry, "date") === today);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadSiteInfo() {
    try {
      bindSiteInfo(await fetchJson("site.json"));
    } catch (error) {
      console.error(error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderSection({
      containerId: "ciel-dates",
      templateId: "ciel-dates-template",
      fileName: "ciel-ouvert.json",
      render: renderCielDates,
      errorMessage: "Les prochaines dates sont momentanément indisponibles.",
    });
    loadSiteInfo();
    showCielProgrammeToday();
    renderSection({
      containerId: "events-list",
      templateId: "event-template",
      fileName: "evenements.json",
      render: renderEvents,
      errorMessage: "Les événements sont momentanément indisponibles.",
    });
    renderSection({
      containerId: "faq-list",
      templateId: "faq-template",
      fileName: "faq.json",
      render: renderFaq,
      errorMessage: "Les questions fréquentes sont momentanément indisponibles.",
    });
    renderSection({
      containerId: "prayer-current",
      templateId: "prayer-template",
      fileName: "priere.json",
      render: renderPrayer,
      errorMessage: "Le programme de prière est momentanément indisponible.",
    });
  });
})();

/*
 * Visionneuse de photos de la page Galeries.
 * Un clic sur une photo ouvre la visionneuse avec les photos de son album.
 * On défile avec les flèches (boutons ou clavier), les miniatures ou un balayage tactile.
 * Elle utilise l'élément <dialog> : Échap ferme, et le focus reste à l'intérieur.
 */
(function () {
  "use strict";

  const SWIPE_THRESHOLD_PX = 50;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const viewer = document.getElementById("photo-viewer");
  const stage = viewer && viewer.querySelector(".photo-viewer-stage");
  const viewerImage = document.getElementById("photo-viewer-image");
  const viewerCount = document.getElementById("photo-viewer-count");
  const thumbList = document.getElementById("photo-viewer-thumbs");
  if (!viewer || !stage || !viewerImage || !viewerCount || !thumbList) {
    return;
  }

  let currentAlbum = null; // { title, photos: [{ src, alt }] }
  let currentIndex = 0;
  let touchStartX = null;

  function titleOf(section) {
    const heading = section.querySelector("h2");
    return heading ? heading.textContent.trim() : "Galerie";
  }

  function photosOf(gallery) {
    return Array.from(gallery.querySelectorAll("img"), (img) => ({
      src: img.getAttribute("src"),
      alt: img.getAttribute("alt") || "",
    }));
  }

  function buildThumbs(photos) {
    const items = photos.map((photo, position) => {
      const thumb = document.createElement("img");
      thumb.src = photo.src;
      thumb.alt = "";
      thumb.loading = "lazy";
      thumb.decoding = "async";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "photo-viewer-thumb";
      button.dataset.index = String(position);
      button.setAttribute("aria-label", `Voir la photo ${position + 1}`);
      button.append(thumb);

      const item = document.createElement("li");
      item.append(button);
      return item;
    });
    thumbList.replaceChildren(...items);
  }

  function markActiveThumb() {
    thumbList.querySelectorAll(".photo-viewer-thumb").forEach((button) => {
      const isActive = Number(button.dataset.index) === currentIndex;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-current", String(isActive));
    });
    const active = thumbList.querySelector(".is-active");
    if (active) {
      active.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: reducedMotion.matches ? "auto" : "smooth",
      });
    }
  }

  // Défiler boucle : après la dernière photo, on revient à la première.
  function showPhoto(index) {
    const total = currentAlbum.photos.length;
    currentIndex = (index + total) % total;
    const photo = currentAlbum.photos[currentIndex];
    viewerImage.src = photo.src;
    viewerImage.alt = photo.alt;
    viewerCount.textContent = `${currentAlbum.title} · ${currentIndex + 1} / ${total}`;
    markActiveThumb();
  }

  function openViewer(album, index) {
    currentAlbum = album;
    buildThumbs(album.photos);
    viewer.showModal();
    showPhoto(index);
  }

  // Remplace chaque photo par un bouton qui contient la même image : utilisable au clavier.
  function enhanceGallery(section) {
    const gallery = section.querySelector(".gallery");
    if (!gallery) {
      return;
    }
    const album = { title: titleOf(section), photos: photosOf(gallery) };
    gallery.querySelectorAll("img").forEach((img, position) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-open";
      button.setAttribute("aria-label", `Agrandir la photo ${position + 1} : ${album.title}`);
      img.replaceWith(button);
      button.append(img);
      button.addEventListener("click", () => openViewer(album, position));
    });
  }

  function onKeydown(event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPhoto(currentIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showPhoto(currentIndex + 1);
    }
  }

  // Le balayage ne doit pas changer de photo quand on fait défiler la bande de miniatures.
  function onTouchStart(event) {
    touchStartX = event.target.closest(".photo-viewer-thumbs")
      ? null
      : event.changedTouches[0].clientX;
  }

  function onTouchEnd(event) {
    if (touchStartX === null) {
      return;
    }
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) {
      showPhoto(currentIndex + (deltaX < 0 ? 1 : -1));
    }
  }

  viewer.querySelector(".photo-viewer-prev").addEventListener("click", () => showPhoto(currentIndex - 1));
  viewer.querySelector(".photo-viewer-next").addEventListener("click", () => showPhoto(currentIndex + 1));
  viewer.querySelector(".photo-viewer-close").addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer || event.target === stage) {
      viewer.close();
    }
  });
  thumbList.addEventListener("click", (event) => {
    const button = event.target.closest(".photo-viewer-thumb");
    if (button) {
      showPhoto(Number(button.dataset.index));
    }
  });
  viewer.addEventListener("keydown", onKeydown);
  viewer.addEventListener("touchstart", onTouchStart, { passive: true });
  viewer.addEventListener("touchend", onTouchEnd, { passive: true });

  document.querySelectorAll(".album").forEach(enhanceGallery);
})();

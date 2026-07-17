import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { resolveArticleImage } from "../article-image-resolver.js";

const ArticleLightboxContext = createContext(null);
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function focalValue(focal, axis) {
  return focal ? focal[axis] : undefined;
}

function mediaOrientation(width, height) {
  if (!width || !height) return undefined;
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

function createLightboxItem(image, mediaOrder, galleryId, galleryIndex) {
  const resolvedImage = resolveArticleImage(image);

  return {
    alt: image.alt,
    caption: image.caption,
    fullSource: resolvedImage.fullSource,
    galleryId,
    galleryIndex,
    mediaOrder
  };
}

export function ArticleMediaLightbox({ ownerKey, children }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const openerRef = useRef(null);
  const bodyStateRef = useRef(null);
  const [viewerState, setViewerState] = useState(null);
  const activeItem = viewerState?.items[viewerState.index] ?? null;
  const isGallery = (viewerState?.items.length ?? 0) > 1;

  const restorePageState = useCallback((restoreFocus = true) => {
    const bodyState = bodyStateRef.current;
    bodyStateRef.current = null;

    if (bodyState) {
      if (bodyState.styleAttribute === null) {
        document.body.removeAttribute("style");
      } else {
        document.body.setAttribute("style", bodyState.styleAttribute);
      }
      window.scrollTo(bodyState.scrollX, bodyState.scrollY);
    }

    const opener = openerRef.current;
    openerRef.current = null;
    if (restoreFocus && opener?.isConnected) {
      opener.focus({ preventScroll: true });
    }
  }, []);

  const closeLightbox = useCallback((restoreFocus = true) => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    }
    setViewerState(null);
    restorePageState(restoreFocus);
  }, [restorePageState]);

  const openLightbox = useCallback(({ item, items }, opener) => {
    if (!bodyStateRef.current) {
      bodyStateRef.current = {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        styleAttribute: document.body.getAttribute("style")
      };
    }

    openerRef.current = opener;
    const itemIndex = Math.max(0, items.findIndex((candidate) => candidate.mediaOrder === item.mediaOrder));
    setViewerState({ items, index: itemIndex });
  }, []);

  const navigateGallery = useCallback((direction) => {
    setViewerState((current) => {
      if (!current || current.items.length < 2) return current;
      const nextIndex = (current.index + direction + current.items.length) % current.items.length;
      return { ...current, index: nextIndex };
    });
  }, []);

  useEffect(() => {
    if (!viewerState) return undefined;

    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const bodyStyle = document.body.style;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    bodyStyle.position = "fixed";
    bodyStyle.top = `${-bodyStateRef.current.scrollY}px`;
    bodyStyle.left = `${-bodyStateRef.current.scrollX}px`;
    bodyStyle.width = "100%";
    bodyStyle.overflow = "hidden";
    if (scrollbarWidth > 0) bodyStyle.paddingRight = `${scrollbarWidth}px`;

    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus({ preventScroll: true });

    return undefined;
  }, [Boolean(viewerState)]);

  useEffect(() => {
    if (!viewerState) return undefined;

    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    function handleKeyDown(event) {
      if (event.key === "ArrowLeft" && viewerState.items.length > 1) {
        event.preventDefault();
        navigateGallery(-1);
        return;
      }
      if (event.key === "ArrowRight" && viewerState.items.length > 1) {
        event.preventDefault();
        navigateGallery(1);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("keydown", handleKeyDown);
    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, [navigateGallery, viewerState]);

  useEffect(() => {
    if (viewerState) closeLightbox(false);
  }, [ownerKey]);

  useEffect(() => () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    restorePageState(false);
  }, [restorePageState]);

  function handleCancel(event) {
    event.preventDefault();
    closeLightbox();
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) closeLightbox();
  }

  return (
    <ArticleLightboxContext.Provider value={openLightbox}>
      {children}
      <dialog
        ref={dialogRef}
        className="article-lightbox"
        data-testid="article-media-dialog"
        data-state={viewerState ? "open" : "closed"}
        aria-labelledby="article-lightbox-title"
        onCancel={handleCancel}
        onClick={handleBackdropClick}
      >
        {activeItem ? (
          <div className="article-lightbox__panel" data-testid="article-media-dialog-content">
            <header className="article-lightbox__header">
              <h2 id="article-lightbox-title">Image viewer</h2>
              <button
                ref={closeButtonRef}
                className="article-lightbox__control article-lightbox__close"
                type="button"
                data-testid="article-media-dialog-close"
                onClick={() => closeLightbox()}
              >
                Close
              </button>
            </header>
            <figure className="article-lightbox__figure">
              <img
                key={`${activeItem.mediaOrder}:${activeItem.fullSource}`}
                className="article-lightbox__image"
                data-testid="article-media-dialog-image"
                data-media-order={activeItem.mediaOrder}
                data-media-full-source={activeItem.fullSource}
                data-gallery-index={activeItem.galleryIndex}
                src={activeItem.fullSource}
                alt={activeItem.alt}
                draggable="false"
              />
              {activeItem.caption !== null ? <figcaption>{activeItem.caption}</figcaption> : null}
            </figure>
            {isGallery ? (
              <footer className="article-lightbox__navigation">
                <button
                  className="article-lightbox__control"
                  type="button"
                  data-testid="article-media-dialog-previous"
                  onClick={() => navigateGallery(-1)}
                >
                  Previous
                </button>
                <p className="article-lightbox__status" data-testid="article-media-dialog-status" aria-live="polite">
                  {`Image ${viewerState.index + 1} of ${viewerState.items.length}`}
                </p>
                <button
                  className="article-lightbox__control"
                  type="button"
                  data-testid="article-media-dialog-next"
                  onClick={() => navigateGallery(1)}
                >
                  Next
                </button>
              </footer>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </ArticleLightboxContext.Provider>
  );
}

export function ArticleMediaFigure({
  image,
  mediaOrder,
  galleryId = undefined,
  galleryOrder = undefined,
  galleryIndex = undefined,
  galleryItems = undefined
}) {
  const openLightbox = useContext(ArticleLightboxContext);
  const mediaId = `article-media-${mediaOrder}`;
  const mediaTestId = `article-media-${image.mode}-${mediaOrder}`;
  const resolvedImage = resolveArticleImage(image);
  const focalX = focalValue(image.focal, "x");
  const focalY = focalValue(image.focal, "y");
  const focalStyle = image.mode === "panorama"
    ? {
        "--article-media-focal-x": `${focalX}%`,
        "--article-media-focal-y": `${focalY}%`
      }
    : undefined;
  const lightboxItem = createLightboxItem(image, mediaOrder, galleryId, galleryIndex);

  function handleOpen(event) {
    openLightbox?.({ item: lightboxItem, items: galleryItems ?? [lightboxItem] }, event.currentTarget);
  }

  return (
    <figure
      id={mediaId}
      className={`article-media article-media--${image.mode}`}
      data-testid={mediaTestId}
      data-media-order={mediaOrder}
      data-media-mode={image.mode}
      data-media-source-type={image.sourceType}
      data-media-source={image.source}
      data-media-focal-x={focalX}
      data-media-focal-y={focalY}
      data-media-orientation={mediaOrientation(resolvedImage.width, resolvedImage.height)}
      data-gallery-id={galleryId}
      data-gallery-order={galleryOrder}
      data-gallery-index={galleryIndex}
      style={focalStyle}
    >
      <button
        className="article-media__opener"
        type="button"
        aria-label={`Open image: ${image.alt}`}
        data-testid={`article-media-opener-${mediaOrder}`}
        data-media-order={mediaOrder}
        data-media-mode={image.mode}
        data-media-source-type={image.sourceType}
        data-media-source={image.source}
        data-media-full-source={resolvedImage.fullSource}
        data-media-focal-x={focalX}
        data-media-focal-y={focalY}
        data-gallery-id={galleryId}
        data-gallery-order={galleryOrder}
        data-gallery-index={galleryIndex}
        onClick={handleOpen}
      >
        <img
          className="article-media__image"
          src={resolvedImage.src}
          srcSet={resolvedImage.srcSet}
          sizes={resolvedImage.sizes}
          width={resolvedImage.width}
          height={resolvedImage.height}
          loading={resolvedImage.loading}
          decoding={resolvedImage.decoding}
          alt={image.alt}
        />
      </button>
      {image.caption !== null ? <figcaption>{image.caption}</figcaption> : null}
    </figure>
  );
}

export function ArticleMediaGallery({ block, galleryOrder, mediaStartOrder, articleSource }) {
  const galleryId = `article-gallery-${galleryOrder}`;
  const galleryTestId = `article-media-gallery-${galleryOrder}`;
  const galleryImages = block.images.map((image, itemIndex) => ({
    image: { ...image, mode: "gallery", focal: null, articleSource },
    galleryIndex: itemIndex + 1,
    mediaOrder: mediaStartOrder + itemIndex
  }));
  const galleryItems = galleryImages.map(({ image, galleryIndex, mediaOrder }) => (
    createLightboxItem(image, mediaOrder, galleryId, galleryIndex)
  ));

  return (
    <section
      id={galleryId}
      className="article-gallery"
      aria-label={`Image gallery ${galleryOrder}`}
      data-testid={galleryTestId}
      data-gallery-id={galleryId}
      data-gallery-order={galleryOrder}
      data-gallery-size={block.images.length}
    >
      <ul className="article-gallery__list">
        {galleryImages.map(({ image, galleryIndex, mediaOrder }) => {
          return (
            <li
              key={`${galleryId}-item-${galleryIndex}`}
              id={`${galleryId}-item-${galleryIndex}`}
              className="article-gallery__item"
              data-testid={`${galleryTestId}-item-${galleryIndex}`}
              data-gallery-id={galleryId}
              data-gallery-order={galleryOrder}
              data-gallery-index={galleryIndex}
              data-media-order={mediaOrder}
            >
              <ArticleMediaFigure
                image={image}
                mediaOrder={mediaOrder}
                galleryId={galleryId}
                galleryOrder={galleryOrder}
                galleryIndex={galleryIndex}
                galleryItems={galleryItems}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

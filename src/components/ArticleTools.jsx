import { useEffect, useRef, useState } from "react";

function CopyButton({ text, label, onUnavailable }) {
  const [state, setState] = useState("idle");
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (state !== "copied") return undefined;
    const timer = window.setTimeout(() => setState("idle"), 2400);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function handleCopy() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if (mountedRef.current) setState("copied");
    } catch {
      if (mountedRef.current) {
        setState("unavailable");
        onUnavailable?.();
      }
    } finally {
      pendingRef.current = false;
    }
  }

  return (
    <span className="article-copy-action">
      <button type="button" className="article-copy-button" onClick={handleCopy} aria-label={label}>
        {state === "copied" ? "已复制 ✓" : label}
      </button>
      <span className={state === "unavailable" ? "article-copy-hint" : "sr-only"} role="status">
        {state === "copied" ? `${label}成功` : state === "unavailable" ? "未能复制，请手动复制选中的内容。" : ""}
      </span>
    </span>
  );
}

export function ArticleCodeBlock({ code, language }) {
  const codeRef = useRef(null);

  function selectCode() {
    if (!codeRef.current) return;
    codeRef.current.parentElement.focus({ preventScroll: true });
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(codeRef.current);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  return (
    <div className="article-code-block" data-testid="article-code-block">
      <div className="article-code-toolbar">
        <span>{language || "text"}</span>
        <CopyButton text={code} label="复制代码" onUnavailable={selectCode} />
      </div>
      <pre tabIndex={0} aria-label={`${language || "文本"}代码`}><code ref={codeRef} data-language={language || undefined}>{code}</code></pre>
    </div>
  );
}

export function ArticleEndnote({ post }) {
  const [showManualLink, setShowManualLink] = useState(false);
  const inputRef = useRef(null);
  const url = new URL(`/posts/${post.slug}`, window.location.origin).href;

  useEffect(() => {
    if (showManualLink) {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    }
  }, [showManualLink]);

  return (
    <footer className="article-endnote" data-testid="article-endnote" data-article-reading-end>
      <span className="article-endnote__label">正文完 <span aria-hidden="true">/ END OF ENTRY</span></span>
      <CopyButton text={url} label="复制文章链接" onUnavailable={() => {
        setShowManualLink(true);
        inputRef.current?.focus({ preventScroll: true });
        inputRef.current?.select();
      }} />
      {showManualLink ? <input ref={inputRef} className="article-manual-link" aria-label="文章链接，可手动复制"
        readOnly value={url} onFocus={(event) => event.target.select()} /> : null}
    </footer>
  );
}

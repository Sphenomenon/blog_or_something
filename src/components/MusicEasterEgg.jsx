import { useMemo, useState } from "react";
import { music } from "../data/yaml-loader.js";

const NETEASE_PLAYER_HEIGHT = "66";

function parseNetEaseSongId(embedUrl) {
  if (typeof embedUrl !== "string" || embedUrl.trim() === "") {
    return null;
  }

  try {
    const url = new URL(embedUrl);
    const isNetEaseHost = url.hostname === "music.163.com" || url.hostname === "www.music.163.com";
    const songId = url.searchParams.get("id");

    if (!isNetEaseHost || !/^\d+$/.test(songId ?? "")) {
      return null;
    }

    return songId;
  } catch {
    return null;
  }
}

function buildNetEasePlayerUrl(songId) {
  const playerUrl = new URL("https://music.163.com/outchain/player");

  playerUrl.searchParams.set("type", "2");
  playerUrl.searchParams.set("id", songId);
  playerUrl.searchParams.set("auto", "0");
  playerUrl.searchParams.set("height", NETEASE_PLAYER_HEIGHT);

  return playerUrl.toString();
}

export function MusicEasterEgg() {
  const [isExpanded, setIsExpanded] = useState(false);

  const songId = useMemo(() => parseNetEaseSongId(music.embed_url), []);
  const playerUrl = useMemo(() => (songId ? buildNetEasePlayerUrl(songId) : null), [songId]);

  const availability = useMemo(() => {
    if (playerUrl) {
      return {
        state: "ready",
        copy: "展开后可在网易云播放器中手动播放；若加载失败，请使用外部链接打开。"
      };
    }

    return {
      state: "unavailable",
      copy: "当前音乐链接暂时无法嵌入，这里保留标题、描述和外部访问入口。"
    };
  }, [playerUrl]);

  return (
    <section className="music-easter-egg reveal" aria-label="音乐彩蛋">
      <button
        type="button"
        className="music-easter-egg__toggle"
        data-testid="music-easter-egg-toggle"
        aria-expanded={isExpanded}
        aria-controls="music-easter-egg-panel"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span className="music-easter-egg__kicker">HIDDEN TRACK</span>
        <span className="music-easter-egg__title">{music.title}</span>
      </button>

      {isExpanded && (
        <div id="music-easter-egg-panel" className="music-easter-egg__panel" data-testid="music-easter-egg-panel">
          <div className="music-easter-egg__panel-copy">
            <p className="music-easter-egg__label">{music.provider}</p>
            <h2>{music.title}</h2>
            <p>{music.description}</p>
            <p className={`music-easter-egg__status music-easter-egg__status--${availability.state}`}>
              {availability.copy}
            </p>
          </div>

          <div className="music-easter-egg__player-shell">
            {playerUrl ? (
              <iframe
                className="music-easter-egg__player"
                data-testid="music-easter-egg-player"
                src={playerUrl}
                title={`NetEase Cloud Music player: ${music.title}`}
                loading="lazy"
              />
            ) : (
              <p className="music-easter-egg__player-unavailable">播放器暂不可用。</p>
            )}
          </div>

          {music.embed_url ? (
            <a
              className="music-easter-egg__fallback-link"
              data-testid="music-easter-egg-fallback-link"
              href={music.embed_url}
              target="_blank"
              rel="noreferrer"
            >
              在网易云音乐打开
            </a>
          ) : null}
        </div>
      )}
    </section>
  );
}

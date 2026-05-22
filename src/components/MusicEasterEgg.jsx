import React, { useMemo, useState } from "react";
import { music } from "../data/yaml-loader.js";

export function MusicEasterEgg() {
  const [isExpanded, setIsExpanded] = useState(false);

  const availability = useMemo(() => {
    if (music.embed_url && music.playlist_id) {
      return {
        state: "ready",
        copy: "音乐模块已就绪，但仍保持手动展开，不会在页面载入时自动播放。"
      };
    }

    return {
      state: "unavailable",
      copy: "当前未配置歌单或歌曲 ID，因此这里只保留一个安静的占位入口。"
    };
  }, []);

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
        <span className="music-easter-egg__meta">点击展开一个安静的音乐彩蛋</span>
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

          <dl className="music-easter-egg__facts" aria-label="音乐配置状态">
            <div>
              <dt>Playlist</dt>
              <dd>{music.playlist_id ?? "未提供"}</dd>
            </div>
            <div>
              <dt>Embed</dt>
              <dd>{music.embed_url ?? "未提供"}</dd>
            </div>
            <div>
              <dt>Autoplay</dt>
              <dd>关闭</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}

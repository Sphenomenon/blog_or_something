import { DecorativeAccent } from "../components/DecorativeAccent.jsx";
import { about } from "../data/yaml-loader.js";

export function AboutView() {
  return (
    <section className="page-panel page-panel--about about-panel" aria-labelledby="about-title">
      <p className="hero-code">{about.code_header}</p>
      <div className="page-panel-header page-panel-header--stacked">
        <div>
          <h1 id="about-title">{about.page_title}</h1>
          <p className="page-panel-lead">{about.lead_text}</p>
        </div>
      </div>
      <p>{about.body_text}</p>
      <dl>
        {about.design_system.map((entry, i) => (
          <div key={i}>
            <dt>{entry.term}</dt>
            <dd>{entry.description}</dd>
          </div>
        ))}
      </dl>
      <DecorativeAccent id="about-endpoint" />
      <div className="about-cc-note">
        <p>
          视觉素材遵守
          {" "}
          <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a> 协议。
        </p>
      </div>
    </section>
  );
}

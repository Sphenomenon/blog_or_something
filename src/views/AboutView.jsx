import { SharedText } from "../components/SharedText.jsx";
import { DecorativeAccent } from "../components/DecorativeAccent.jsx";
import { about } from "../data/yaml-loader.js";

export function AboutView() {
  return (
    <section className="page-panel page-panel--about about-panel" aria-labelledby="about-title">
      <p className="hero-code"><SharedText>{about.code_header}</SharedText></p>
      <div className="page-panel-header page-panel-header--stacked">
        <div>
          <h1 id="about-title"><SharedText>{about.page_title}</SharedText></h1>
          <p className="page-panel-lead"><SharedText>{about.lead_text}</SharedText></p>
        </div>
      </div>
      <p><SharedText>{about.body_text}</SharedText></p>
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
        <p><SharedText>
          视觉素材遵守
          </SharedText><SharedText>{" "}</SharedText>
          <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a><SharedText> 协议。
        </SharedText></p>
      </div>
    </section>
  );
}

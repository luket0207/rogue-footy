import { useCallback } from "react";
import Button, { BUTTON_VARIANT } from "../../engine/ui/button/button";
import UiSections from "./components/uiSections";
import GameFeatureSections from "./components/gameFeatureSections";
import MovingBackground from "./components/movingBackground/movingBackground";
import "./info.scss";

const Info = () => {
  const { sections: uiSections } = UiSections();
  const { sections: gameFeatureSections } = GameFeatureSections();

  const handleScrollTo = useCallback((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const CatalogLinks = () => (
    <div className="info__navCatalogLinks">
      <div className="info__navTitle info__navTitle--small">Catalogs</div>
      <div className="info__navCatalogList">
        <Button
          variant={BUTTON_VARIANT.TERTIARY}
          onClick={() => handleScrollTo("ui-catalog")}
          className="info__navCatalogBtn"
        >
          UI Catalog
        </Button>

        <Button
          variant={BUTTON_VARIANT.TERTIARY}
          onClick={() => handleScrollTo("game-features")}
          className="info__navCatalogBtn"
        >
          Game Features
        </Button>
      </div>
    </div>
  );

  const SideNav = ({ title, sections, idPrefix }) => (
    <aside className="info__nav">
      <div className="info__navTitle">{title}</div>

      <nav className="info__navList" aria-label={`${title} navigation`}>
        {sections.map((s) => (
          <button
            key={`${idPrefix}-nav-${s.id}`}
            type="button"
            className="info__navItem"
            onClick={() => handleScrollTo(`${idPrefix}-${s.id}`)}
          >
            {s.navLabel}
          </button>
        ))}
      </nav>

      <CatalogLinks />

      <div className="info__navFooter">
        <Button variant={BUTTON_VARIANT.TERTIARY} to="/">
          Back to Home
        </Button>
      </div>
    </aside>
  );

  return (
    <MovingBackground overlayOpacity={0.6} zoomPercentVisible={80} path="curve">
      <div className="info">
        {/* UI Catalog */}
        <header className="info__header" id="ui-catalog">
          <h1 className="info__title">UI Catalog</h1>
          <p className="info__subtitle">
            A living reference page for engine UI components. Add new sections over time and keep
            examples in one place.
          </p>
        </header>

        <div className="info__layout">
          <SideNav title="UI Components" sections={uiSections} idPrefix="ui" />

          <main className="info__content">
            {uiSections.map((s) => (
              <section key={`ui-section-${s.id}`} id={`ui-${s.id}`} className="info__section">
                <div className="info__sectionCard">
                  <div className="info__sectionHeader">
                    <h2 className="info__sectionTitle">{s.title}</h2>
                    <p className="info__sectionDesc">{s.description}</p>
                  </div>

                  <div className="info__sectionBody">{s.render()}</div>
                </div>
              </section>
            ))}
          </main>
        </div>

        {/* Game Features */}
        <header className="info__header info__header--spaced" id="game-features">
          <h1 className="info__title">Game Features</h1>
          <p className="info__subtitle">
            Engine-level gameplay systems and patterns. Use this section to document and validate
            reusable game mechanics and helpers.
          </p>
        </header>

        <div className="info__layout">
          <SideNav title="Game Features" sections={gameFeatureSections} idPrefix="gf" />

          <main className="info__content">
            {gameFeatureSections.map((s) => (
              <section key={`gf-section-${s.id}`} id={`gf-${s.id}`} className="info__section">
                <div className="info__sectionCard">
                  <div className="info__sectionHeader">
                    <h2 className="info__sectionTitle">{s.title}</h2>
                    <p className="info__sectionDesc">{s.description}</p>
                  </div>

                  <div className="info__sectionBody">{s.render()}</div>
                </div>
              </section>
            ))}
          </main>
        </div>
      </div>
    </MovingBackground>
  );
};

export default Info;

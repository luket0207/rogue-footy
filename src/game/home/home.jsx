import Button, { BUTTON_VARIANT } from "../../engine/ui/button/button";
import "./home.scss";

const Home = () => {
  return (
    <div className="home">
      <div className="home_content">
        <h1>Mini React Game Engine</h1>
        <div className="home_actions">
          <Button variant={BUTTON_VARIANT.PRIMARY} to="/team-selection">
            Debug Team Selection
          </Button>
          <Button variant={BUTTON_VARIANT.SECONDARY} to="/info">
            Go to Info
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Home;

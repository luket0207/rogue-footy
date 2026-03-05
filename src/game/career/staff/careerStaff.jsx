import { useEffect } from "react";
import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";
import { useGame } from "../../../engine/gameContext/gameContext";
import "./careerStaff.scss";

const CareerStaff = () => {
  const { setGameValue } = useGame();

  useEffect(() => {
    setGameValue("mode", "career");
  }, [setGameValue]);

  return (
    <div className="careerStaff">
      <section className="careerStaff__panel">
        <h1>Staff</h1>
        <p>Staff page placeholder. Deeper staff systems will be implemented later.</p>

        <div className="careerStaff__actions">
          <Button variant={BUTTON_VARIANT.SECONDARY} to="/career/calendar">
            Back to Calendar
          </Button>
        </div>
      </section>
    </div>
  );
};

export default CareerStaff;


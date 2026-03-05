import Button, { BUTTON_VARIANT } from "../../../engine/ui/button/button";

const ControlPanel = ({ continueLabel, canContinue, onContinue, onQuit }) => {
  return (
    <section className="careerCalendar__hubCard">
      <h2>Control Panel</h2>
      <div className="careerCalendar__controlActions">
        <Button variant={BUTTON_VARIANT.PRIMARY} onClick={onContinue} disabled={!canContinue}>
          {continueLabel}
        </Button>
        <Button variant={BUTTON_VARIANT.SECONDARY} to="/career/team-management">
          Team Management
        </Button>
        <Button variant={BUTTON_VARIANT.TERTIARY} to="/career/staff">
          Staff
        </Button>
        <Button variant={BUTTON_VARIANT.TERTIARY} onClick={onQuit}>
          Quit
        </Button>
      </div>
    </section>
  );
};

export default ControlPanel;

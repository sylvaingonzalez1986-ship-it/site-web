/** A real control to point out. The guide never performs the action for the player. */
export type ReleveGuideStep = {
  id: string;
  title: string;
  instruction: string;
  selector?: string;
  text?: string;
  kind?: 'button' | 'summary' | 'input' | 'select' | 'element';
  scope?: string;
  /** Keep this explanation visible while the player edits the native control. */
  checkpoint?: {
    label: string;
    readySelector?: string;
    pendingLabel?: string;
  };
  progressLabel?: string;
};

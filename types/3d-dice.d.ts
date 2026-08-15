declare module "@3d-dice/dice-box-threejs" {
  export type DiceBoxConfig = {
    sounds?: boolean;
    shadows?: boolean;
    theme_surface?: string;
    theme_customColorset?: {
      name: string;
      foreground: string;
      background: string | string[];
      outline: string;
      texture?: string;
      material?: string;
    };
    gravity_multiplier?: number;
    light_intensity?: number;
    baseScale?: number;
    strength?: number;
    iterationLimit?: number;
  };

  export default class DiceBox {
    constructor(selector: string, config?: DiceBoxConfig);
    initialize(): Promise<void>;
    roll(notation: string): Promise<unknown>;
  }
}

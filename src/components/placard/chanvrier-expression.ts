export type ChanvrierExpression = "neutral" | "smile" | "surprise" | "focus";

export const CHANVRIER_EXPRESSION_TARGETS = ["smile", "surprise", "focus"] as const;

export const CHANVRIER_FACE_POSES = {
  neutral: { eyeTop: 1, eyeBottom: 1, eyeTilt: 0, browHeight: 0, browTilt: 0, browCurve: 0 },
  smile: { eyeTop: .95, eyeBottom: .74, eyeTilt: .003, browHeight: .004, browTilt: .006, browCurve: .004 },
  surprise: { eyeTop: 1.24, eyeBottom: 1.21, eyeTilt: -.002, browHeight: .023, browTilt: -.004, browCurve: .006 },
  focus: { eyeTop: .68, eyeBottom: .84, eyeTilt: .004, browHeight: -.014, browTilt: .019, browCurve: -.007 },
} satisfies Record<ChanvrierExpression, Record<string, number>>;

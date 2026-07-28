// Route tests exercise an already-approved launch configuration unless a test
// explicitly overrides the legal gate.
process.env.KQ_PUBLIC_RULES_APPROVED = "true";

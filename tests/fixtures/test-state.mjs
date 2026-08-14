import { buildSeedState } from "../../apps/api/src/data/seed.mjs";

export const TEST_PASSWORD = "Test-only_Password_2026!";
export const TEST_RESET_PASSWORD = "Changed_Test_Password_2026!";
export const testState = buildSeedState({
  admin: TEST_PASSWORD,
  operator: TEST_PASSWORD,
  approver: TEST_PASSWORD,
  auditor: TEST_PASSWORD,
  viewer: TEST_PASSWORD
});

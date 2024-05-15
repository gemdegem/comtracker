// testCoinPathsScript.ts

require("dotenv").config({ path: "../../.env.local" });
import { testCoinPaths } from "../../lib/api/pathApi";

const runTest = async () => {
  try {
    const result = await testCoinPaths();
    console.log("Test CoinPaths Data:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test CoinPaths Error:", error);
  }
};

runTest();

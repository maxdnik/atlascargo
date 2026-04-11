import "dotenv/config";
import { runScheduledAlertChecksForAllCompanies } from "@/lib/alerts";

async function main() {
  const result = await runScheduledAlertChecksForAllCompanies();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

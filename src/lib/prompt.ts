import select from "@inquirer/select";
import type { EnvFile } from "../types.js";

export async function promptEnvSelection(envFiles: EnvFile[]): Promise<string> {
  const answer = await select({
    message: "Select an environment:",
    choices: envFiles.map((file) => ({
      name: file.active ? `${file.env} (active)` : file.env,
      value: file.env,
    })),
  });
  return answer;
}

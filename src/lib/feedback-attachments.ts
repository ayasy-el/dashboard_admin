import { readFile } from "node:fs/promises";
import path from "node:path";

const ATTACHMENTS_DIR = path.resolve(process.cwd(), "..", ".feedback-attachments");

export async function readFeedbackAttachment(key: string) {
  const filePath = path.join(ATTACHMENTS_DIR, key);
  const content = await readFile(filePath);

  return {
    filePath,
    content,
  };
}

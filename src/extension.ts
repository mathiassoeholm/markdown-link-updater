// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { promises as fs } from "fs";
import * as path from "path";

// prettier-ignore
const mdLinkRegex = new RegExp(
  '\\['         + // Literal opening bracket
    '('         + // Capture what we find in here
      '[^\\]]+' + // One or more characters other than close bracket
    ')'         + // Stop capturing
  '\\]'         + // Literal closing bracket
  '\\('         + // Literal opening parenthesis
    '('         + // Capture what we find in here
      '[^\\)]+' + // One or more characters other than close parenthesis
    ')'         + // Stop capturing
  '\\)'        ); // Literal closing parenthesis

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onDidRenameFiles(async (e) => {
    console.log("I was renamed");
    const targetFilesPromises = e.files.map(async (f) => {
      const oldTargetFilePath = path.normalize(f.oldUri.fsPath);
      const newTargetFilePath = path.normalize(f.newUri.fsPath);

      // 1. Find all markdown files
      const markdownFiles = await vscode.workspace.findFiles(
        "**/*.md",
        "**/node_modules/**"
      );

      // 2. Parse markdown files, and get links
      const promises = markdownFiles.map(async (mdFile) => {
        const text = await fs.readFile(mdFile.fsPath, "utf8");

        const modifedText = text.replace(mdLinkRegex, (match, g1, g2) => {
          const isLinkToMovedFile =
            path.normalize(path.join(path.dirname(mdFile.fsPath), g2)) ===
            oldTargetFilePath;

          if (isLinkToMovedFile) {
            const newLink = path.normalize(
              path.relative(path.dirname(mdFile.fsPath), newTargetFilePath)
            );

            return `[${g1}](${newLink})`;
          } else {
            return match;
          }
        });

        if (text !== modifedText) {
          await fs.writeFile(mdFile.fsPath, modifedText, "utf8");
        }
      });

      await Promise.all(promises);

      // 3. Update links if it links to this file
    });

    await Promise.all(targetFilesPromises);
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

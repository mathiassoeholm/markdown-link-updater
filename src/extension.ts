// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { promises as fs } from "fs";
import * as fse from "fs-extra";
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
  '\\)',          // Literal closing parenthesis
  'g');

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onDidRenameFiles(async (e) => {
    const processRenamedFiles = e.files.map(async (renamedFile) => {
      const newFilePath = renamedFile.newUri.fsPath;
      const text = await fs.readFile(newFilePath, "utf8");

      console.log("text", text);
      const modifedText = text.replace(mdLinkRegex, (match, g1, g2) => {
        const absoluteLinkPath = path.join(
          path.dirname(renamedFile.oldUri.fsPath),
          g2
        );
        console.log("absoluteLinkPath", absoluteLinkPath);
        const linkedResourceExists = fse.pathExistsSync(absoluteLinkPath);
        console.log("linkedResourceExists", linkedResourceExists);

        if (linkedResourceExists) {
          const newLink = path.normalize(
            path.relative(path.dirname(newFilePath), absoluteLinkPath)
          );
          return `[${g1}](${newLink})`;
        } else {
          return match;
        }
      });
      console.log("modifedText", modifedText);

      if (text !== modifedText) {
        await fs.writeFile(newFilePath, modifedText, "utf8");
      }
    });

    const targetFilesPromises = e.files.map(async (f) => {
      const oldTargetFilePath = path.normalize(f.oldUri.fsPath);
      const newTargetFilePath = path.normalize(f.newUri.fsPath);

      const markdownFiles = await vscode.workspace.findFiles(
        "**/*.md",
        "**/node_modules/**"
      );

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
    });

    await Promise.all([...targetFilesPromises, ...processRenamedFiles]);
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

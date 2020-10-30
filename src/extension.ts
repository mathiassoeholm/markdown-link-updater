// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { promises as fs } from "fs";
import * as path from "path";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "my-first-code-extension" is now active!'
  );

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
      console.log("Markdown files", markdownFiles);

      // 2. Parse markdown files, and get links
      const promises = markdownFiles.map(async (mdFile) => {
        const text = await fs.readFile(mdFile.fsPath, "utf8");

        // prettier-ignore
        const mdLinkRegex = new RegExp(
          '\\['         + // Literal opening bracket
            '('        + // Capture what we find in here
              '[^\\]]+' + // One or more characters other than close bracket
            ')'        + // Stop capturing
          '\\]'         + // Literal closing bracket
          '\\('         + // Literal opening parenthesis
            '('        + // Capture what we find in here
              '[^\\)]+'  + // One or more characters other than close parenthesis
            ')'        + // Stop capturing
          '\\)'        ); // Literal closing parenthesis

        console.log("text before", text);

        const modifedText = text.replace(mdLinkRegex, (match, g1, g2) => {
          console.log("match", match);
          console.log("g1", g1);
          console.log("g2", g2);
          const isLinkToMovedFile =
            path.normalize(path.join(path.dirname(mdFile.fsPath), g2)) ===
            oldTargetFilePath;

          if (isLinkToMovedFile) {
            console.log("moved file is referenced in link!");
            const newLink = path.normalize(
              path.relative(path.dirname(mdFile.fsPath), newTargetFilePath)
            );

            return `[${g1}](${newLink})`;
          } else {
            return match;
          }
        });

        if (text !== modifedText) {
          console.log("Text is different for", mdFile.fsPath);
          await fs.writeFile(mdFile.fsPath, modifedText, "utf8");
        }
      });

      await Promise.all(promises);

      // 3. Update links if it links to this file
    });

    await Promise.all(targetFilesPromises);

    console.log("Done");
    // Object
    //   files:Array[1]
    //   0:Object
    //   $mid:1
    //   fsPath:"/Users/dkmasjso/Desktop/hello"
    //   external:"file:///Users/dkmasjso/Desktop/hello"
    //   path:"/Users/dkmasjso/Desktop/hello"
    //   scheme:"file"
  });

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  // let disposable = vscode.commands.registerCommand(
  //   "my-first-code-extension.helloWorld",
  //   () => {
  //     // The code you place here will be executed every time your command is executed

  //     // Display a message box to the user
  //     vscode.window.showInformationMessage("Hello World from VS Code");
  //   }
  // );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

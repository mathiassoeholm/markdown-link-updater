import * as vscode from "vscode";
import { promises as fs } from "fs";
import * as fse from "fs-extra";
import * as path from "path";
import { exec } from "child_process";
import { glob } from "glob";
import * as minimatch from "minimatch";
import { diffLines } from "diff";
import { headingToAnchor } from "./heading-to-anchor";

// prettier-ignore
const mdLinkRegex = new RegExp(
  '\\['         + // Literal opening bracket
    '('         + // Capture what we find in here
      '[^\\]]*' + // Any other characters than close bracket
    ')'         + // Stop capturing
  '\\]'         + // Literal closing bracket
  '\\('         + // Literal opening parenthesis
    '('         + // Capture what we find in here
      '[^\\)]+' + // One or more characters other than close parenthesis
    ')'         + // Stop capturing
  '\\)',          // Literal closing parenthesis
  'g');

function getConfig() {
  return vscode.workspace.getConfiguration("markdownLinkUpdater");
}

export function activate(context: vscode.ExtensionContext) {
  const textBeforeSave = new Map();

  const onWillSaveDisposable = vscode.workspace.onWillSaveTextDocument(
    async (e) => {
      const experimentalRenameHeadings = getConfig().get(
        "experimentalRenameHeadings",
        false
      );

      if (!experimentalRenameHeadings) {
        return;
      }

      if (e.document.fileName.endsWith(".md")) {
        const text = await fs.readFile(e.document.fileName, "utf8");
        textBeforeSave.set(e.document.fileName, text);
      }
    }
  );

  const onDidSaveDisposable = vscode.workspace.onDidSaveTextDocument(
    async (e) => {
      const experimentalRenameHeadings = getConfig().get(
        "experimentalRenameHeadings",
        false
      );

      if (!experimentalRenameHeadings) {
        return;
      }

      const textBefore = textBeforeSave.get(e.fileName);

      if (textBefore === undefined) {
        return;
      }

      try {
        const diff = diffLines(textBefore, e.getText(), {});

        const renamedHeadings = diff
          .map((change, index) => {
            const nextChange = diff[index + 1];

            if (!nextChange) {
              return null;
            }

            const removedAndAddedLine =
              change.removed === true && nextChange.added === true;

            if (removedAndAddedLine) {
              const oldLine = change.value;
              const newLine = nextChange.value;

              const headingRegex = /^(#+ )(.+)/;
              const oldLineMatch = oldLine.match(headingRegex);
              const newLineMatch = newLine.match(headingRegex);

              if (
                oldLineMatch &&
                newLineMatch &&
                // Check if same header type
                oldLineMatch[1] === newLineMatch[1]
              ) {
                return {
                  oldHeader: oldLineMatch[2],
                  newHeader: newLineMatch[2],
                };
              }
            }

            return null;
          })
          .filter(Boolean) as Array<{ oldHeader: string; newHeader: string }>;

        const modifiedText = renamedHeadings.reduce(
          (text, { oldHeader, newHeader }) => {
            return text.replace(mdLinkRegex, (match, name, link) => {
              const oldHeaderAnchor = headingToAnchor(oldHeader);
              const newHeaderAnchor = headingToAnchor(newHeader);

              if (link === `#${oldHeaderAnchor}`) {
                return `[${name}](#${newHeaderAnchor})`;
              } else {
                return match;
              }
            });
          },
          e.getText()
        );

        if (e.getText() !== modifiedText) {
          await fs.writeFile(e.fileName, modifiedText, "utf8");
        }
      } finally {
        textBeforeSave.delete(e.fileName);
      }
    }
  );

  const disposable = vscode.workspace.onDidRenameFiles(async (e) => {
    const exclude = getConfig().get("exclude", ["**/node_modules/**"]);
    const include = getConfig().get("include", []);

    const renamedFiles: { oldPath: string; newPath: string }[] = [];

    const shouldIncludePath = (filePath: string) => {
      const relativePath = vscode.workspace.asRelativePath(filePath);
      const matchesIncludeList = include.some((pattern) => {
        return minimatch(relativePath, pattern);
      });

      if (matchesIncludeList) {
        return true;
      }

      if (include.length > 0) {
        return false;
      }

      const matchesExcludeList = exclude.some((pattern) => {
        return minimatch(relativePath, pattern);
      });

      return !matchesExcludeList;
    };

    const collectFilesPromises = e.files
      .filter((f) => shouldIncludePath(f.oldUri.fsPath))
      .map(async (renamedFileOrDir) => {
        const isDirectory = (
          await fs.lstat(renamedFileOrDir.newUri.fsPath)
        ).isDirectory();
        if (isDirectory) {
          if (
            !shouldIncludePath(
              path.join(
                renamedFileOrDir.oldUri.fsPath,
                "____random-test-file____"
              )
            )
          ) {
            // We land in this case when for example the pattern '**/node_modules/**' is used and someone
            // renames the node_modules directory. '/node_modules' is not matched by **/node_modules/**
            // but all files beneath it is.
            return;
          }

          await new Promise<void>((resolve, reject) => {
            glob(
              renamedFileOrDir.newUri.fsPath + "/**/*.*",
              { nodir: true },
              (err, matches) => {
                if (err) {
                  reject(err);
                } else {
                  matches.forEach((match) => {
                    const relative = path.relative(
                      renamedFileOrDir.newUri.fsPath,
                      match
                    );
                    const oldPath = path.join(
                      renamedFileOrDir.oldUri.fsPath,
                      relative
                    );

                    renamedFiles.push({
                      oldPath: path.normalize(oldPath),
                      newPath: path.normalize(match),
                    });
                  });

                  resolve();
                }
              }
            );
          });
        } else {
          renamedFiles.push({
            oldPath: path.normalize(renamedFileOrDir.oldUri.fsPath),
            newPath: path.normalize(renamedFileOrDir.newUri.fsPath),
          });
        }
      });

    await Promise.all(collectFilesPromises);

    const renamedFilePromises = renamedFiles.map(async (renamedFile) => {
      if (await fileIsIgnoredByGit(renamedFile.oldPath)) {
        return;
      }

      const newFilePath = renamedFile.newPath;
      const text = await fs.readFile(newFilePath, "utf8");

      const modifedText = text.replace(mdLinkRegex, (match, name, link) => {
        const linkWithSectionMatch = link.match(/(.+\.md)(#[^\s\/]+)/);
        let section = "";

        if (linkWithSectionMatch) {
          link = linkWithSectionMatch[1];
          section = linkWithSectionMatch[2];
        }

        const absoluteLinkPath = path.join(
          path.dirname(renamedFile.oldPath),
          link
        );

        const linkedResourceExists = fse.pathExistsSync(absoluteLinkPath);

        if (linkedResourceExists) {
          const newLink = path.normalize(
            path.relative(path.dirname(newFilePath), absoluteLinkPath)
          );
          return `[${name}](${newLink.replace(/\\/g, "/")}${section})`;
        } else {
          return match;
        }
      });

      if (text !== modifedText) {
        await fs.writeFile(newFilePath, modifedText, "utf8");
      }
    });

    let markdownFiles = await vscode.workspace.findFiles(
      "**/*.md",
      `{${exclude.join(",")}}`
    );

    if (include.length > 0) {
      markdownFiles = markdownFiles.filter((file) =>
        shouldIncludePath(file.fsPath)
      );
    }

    const markdownFilePromises = markdownFiles.map(async (mdFile) => {
      if (await fileIsIgnoredByGit(mdFile.fsPath)) {
        return;
      }

      const text = await fs.readFile(mdFile.fsPath, "utf8");

      const modifedText = text.replace(mdLinkRegex, (match, name, link) => {
        for (const { oldPath, newPath } of renamedFiles) {
          const linkWithSectionMatch = link.match(/(.+\.md)(#[^\s\/]+)/);
          let section = "";

          if (linkWithSectionMatch) {
            link = linkWithSectionMatch[1];
            section = linkWithSectionMatch[2];
          }

          const isLinkToMovedFile =
            path.normalize(path.join(path.dirname(mdFile.fsPath), link)) ===
            oldPath;

          if (isLinkToMovedFile) {
            const newLink = path.normalize(
              path.relative(path.dirname(mdFile.fsPath), newPath)
            );

            return `[${name}](${newLink.replace(/\\/g, "/")}${section})`;
          } else {
            continue;
          }
        }

        return match;
      });

      if (text !== modifedText) {
        await fs.writeFile(mdFile.fsPath, modifedText, "utf8");
      }
    });

    await Promise.all([...markdownFilePromises, ...renamedFilePromises]);
  });

  context.subscriptions.push(onWillSaveDisposable);
  context.subscriptions.push(onDidSaveDisposable);
  context.subscriptions.push(disposable);
}

const fileIsIgnoredByGit = async (file: string) => {
  const config = vscode.workspace.getConfiguration("markdownLinkUpdater");
  const useGitIgnore = config.get("slowUseGitIgnore", false);

  if (!useGitIgnore) {
    return false;
  }

  return await new Promise((resolve) => {
    const process = exec(
      `cd ${path.dirname(file)} && git check-ignore ${file}`,
      () => {
        resolve(process.exitCode === 0);
      }
    );
  });
};

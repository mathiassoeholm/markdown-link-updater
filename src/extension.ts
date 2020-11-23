import * as vscode from "vscode";
import { promises as fs } from "fs";
import * as fse from "fs-extra";
import * as path from "path";
import { exec } from "child_process";
import { glob } from "glob";
import * as minimatch from "minimatch";

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

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onDidRenameFiles(async (e) => {
    const config = vscode.workspace.getConfiguration("markdownLinkUpdater");
    const excludeDirs = config.get("excludeDirs", ["**/node_modules/**"]);

    const renamedFiles: { oldPath: string; newPath: string }[] = [];

    const pathMatchesExcludePattern = (filePath: string) => {
      return excludeDirs.some((excludedDir) => {
        return minimatch(filePath, excludedDir);
      });
    };

    const collectFilesPromises = e.files
      .filter((f) => !pathMatchesExcludePattern(f.oldUri.fsPath))
      .map(async (renamedFileOrDir) => {
        const isDirectory = (
          await fs.lstat(renamedFileOrDir.newUri.fsPath)
        ).isDirectory();
        if (isDirectory) {
          if (
            pathMatchesExcludePattern(
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

          await new Promise((resolve, reject) => {
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

      const modifedText = text.replace(mdLinkRegex, (match, g1, g2) => {
        const absoluteLinkPath = path.join(
          path.dirname(renamedFile.oldPath),
          g2
        );

        const linkedResourceExists = fse.pathExistsSync(absoluteLinkPath);

        if (linkedResourceExists) {
          const newLink = path.normalize(
            path.relative(path.dirname(newFilePath), absoluteLinkPath)
          );
          return `[${g1}](${newLink})`;
        } else {
          return match;
        }
      });

      if (text !== modifedText) {
        await fs.writeFile(newFilePath, modifedText, "utf8");
      }
    });

    const markdownFiles = await vscode.workspace.findFiles(
      "**/*.md",
      `{${excludeDirs.join(",")}}`
    );

    const markdownFilePromises = markdownFiles.map(async (mdFile) => {
      if (await fileIsIgnoredByGit(mdFile.fsPath)) {
        return;
      }

      const text = await fs.readFile(mdFile.fsPath, "utf8");

      const modifedText = text.replace(mdLinkRegex, (match, g1, g2) => {
        for (const { oldPath, newPath } of renamedFiles) {
          const isLinkToMovedFile =
            path.normalize(path.join(path.dirname(mdFile.fsPath), g2)) ===
            oldPath;

          if (isLinkToMovedFile) {
            const newLink = path.normalize(
              path.relative(path.dirname(mdFile.fsPath), newPath)
            );

            return `[${g1}](${newLink})`;
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

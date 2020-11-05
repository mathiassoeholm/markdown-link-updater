import * as path from "path";
import * as fse from "fs-extra";
import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import { glob } from "glob";
import { waitFor } from "../wait-for";

interface FileSystemDescription {
  [name: string]: string | FileSystemDescription;
}

const tempTestFilesPath = path.resolve("./temp-test-files");

async function generateFileSystem(node: string | FileSystemDescription) {
  for (const { filePath, fileContent } of collectFilesRecursiveley(node)) {
    await fse.ensureFile(filePath);
    await fse.writeFile(filePath, fileContent);
  }
}

async function verifyFileSystem(node: string | FileSystemDescription) {
  const paths = [...collectFilesRecursiveley(node)];

  for (const { filePath, fileContent: expectedFileContent } of paths) {
    const actualFileContent = await fse.readFile(filePath, "utf8");
    if (expectedFileContent !== actualFileContent) {
      assert.strictEqual(expectedFileContent, actualFileContent);
    }
  }

  await new Promise((resolve, reject) =>
    glob(tempTestFilesPath + "/**/*.*", (err, matches) => {
      if (err) {
        reject(err);
      } else {
        matches.forEach((file) => {
          if (
            !paths.some(({ filePath }) => filePath === path.normalize(file))
          ) {
            throw new Error(
              `Found file ${file}, which was not part of the expected file system`
            );
          }
        });
        resolve();
      }
    })
  );
}

function* collectFilesRecursiveley(
  node: string | FileSystemDescription,
  currentPath: string = tempTestFilesPath
): Generator<{
  filePath: string;
  fileContent: string;
}> {
  if (typeof node === "string") {
    yield { filePath: path.normalize(currentPath), fileContent: node };
  } else {
    for (const key of Object.keys(node)) {
      yield* collectFilesRecursiveley(node[key], path.join(currentPath, key));
    }
  }
}

describe("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  beforeEach(() => {
    fse.removeSync(tempTestFilesPath);
  });

  afterEach(() => {
    fse.removeSync(tempTestFilesPath);
  });

  it("updates files linking to the renamed file", async () => {
    const startFileSystem: FileSystemDescription = {
      ["file-1.md"]: `[link to file-2](./folder/file-2.md)`,
      ["folder"]: {
        ["file-2.md"]: `# Just some markdown file`,
      },
    };

    const edit = new vscode.WorkspaceEdit();
    edit.renameFile(
      vscode.Uri.file(path.join(tempTestFilesPath, "folder/file-2.md")),
      vscode.Uri.file(path.join(tempTestFilesPath, "folder/new-name.md"))
    );

    const expectedFileSystem = {
      ["file-1.md"]: `[link to file-2](folder/new-name.md)`,
      ["folder"]: {
        ["new-name.md"]: `# Just some markdown file`,
      },
    };

    await generateFileSystem(startFileSystem);
    await vscode.commands.executeCommand(
      "vscode.openFolder",
      vscode.Uri.file(tempTestFilesPath)
    );

    await vscode.workspace.applyEdit(edit);

    await waitFor(() => verifyFileSystem(expectedFileSystem), {
      interval: 500,
      timeout: 5000,
    });
  }).timeout(10000);

  it("updates the renamed files own links when it is moved", async () => {
    const startFileSystem: FileSystemDescription = {
      ["file-1.md"]: `[link to file-2](file-2.md)\n[link to a website](http://www.example.com)`,
      ["file-2.md"]: `# Just some markdown file`,
    };

    const edit = new vscode.WorkspaceEdit();
    edit.renameFile(
      vscode.Uri.file(path.join(tempTestFilesPath, "file-1.md")),
      vscode.Uri.file(path.join(tempTestFilesPath, "folder/file-1.md"))
    );

    const expectedFileSystem = {
      ["folder"]: {
        ["file-1.md"]: `[link to file-2](../file-2.md)\n[link to a website](http://www.example.com)`,
      },
      ["file-2.md"]: `# Just some markdown file`,
    };

    await generateFileSystem(startFileSystem);
    await vscode.commands.executeCommand(
      "vscode.openFolder",
      vscode.Uri.file(tempTestFilesPath)
    );

    await vscode.workspace.applyEdit(edit);

    await waitFor(() => verifyFileSystem(expectedFileSystem), {
      interval: 500,
      timeout: 5000,
    });
  }).timeout(10000);

  it("can update multiple links in the same file", async () => {
    const startFileSystem: FileSystemDescription = {
      ["links.md"]: `[a](old-a.txt)\n[b](old-b.txt)\n[c](old-c.txt)`,
      ["old-a.txt"]: `a`,
      ["old-b.txt"]: `b`,
      ["old-c.txt"]: `c`,
    };

    const edit = new vscode.WorkspaceEdit();
    edit.renameFile(
      vscode.Uri.file(path.join(tempTestFilesPath, "old-a.txt")),
      vscode.Uri.file(path.join(tempTestFilesPath, "new-a.txt"))
    );
    edit.renameFile(
      vscode.Uri.file(path.join(tempTestFilesPath, "old-b.txt")),
      vscode.Uri.file(path.join(tempTestFilesPath, "new-b.txt"))
    );
    edit.renameFile(
      vscode.Uri.file(path.join(tempTestFilesPath, "old-c.txt")),
      vscode.Uri.file(path.join(tempTestFilesPath, "new-c.txt"))
    );

    const expectedFileSystem = {
      ["links.md"]: `[a](new-a.txt)\n[b](new-b.txt)\n[c](new-c.txt)`,
      ["new-a.txt"]: `a`,
      ["new-b.txt"]: `b`,
      ["new-c.txt"]: `c`,
    };

    await generateFileSystem(startFileSystem);
    await vscode.commands.executeCommand(
      "vscode.openFolder",
      vscode.Uri.file(tempTestFilesPath)
    );

    await vscode.workspace.applyEdit(edit);

    await waitFor(() => verifyFileSystem(expectedFileSystem), {
      interval: 500,
      timeout: 5000,
    });
  }).timeout(10000);
});

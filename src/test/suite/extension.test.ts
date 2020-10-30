import * as path from "path";
import * as fse from "fs-extra";
import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import { glob } from "glob";
// import * as myExtension from '../../extension';

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

  for (const { filePath, fileContent } of paths) {
    assert.strictEqual(fileContent, await fse.readFile(filePath, "utf8"));
  }

  console.log("paths", paths);

  await new Promise((resolve, reject) =>
    glob(tempTestFilesPath + "/**/*.*", (err, matches) => {
      if (err) {
        reject(err);
      } else {
        matches.forEach((file) => {
          console.log("Match", path.normalize(file));
          assert.strictEqual(
            true,
            paths.some(({ filePath }) => filePath === path.normalize(file))
          );
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

  // Copy test folders to temporary location
  // Open temporary location
  //

  after(() => {
    //fse.removeSync(tempTestFilesPath);
  });

  it("Sample test", async () => {
    const startFileSystem: FileSystemDescription = {
      ["file-1.md"]: `[link to file-2](./folder/file-2.md)`,
      ["folder"]: {
        ["file-2.md"]: `# Just some markdown file`,
      },
    };

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

    const edit = new vscode.WorkspaceEdit();

    edit.renameFile(
      vscode.Uri.file(path.join(tempTestFilesPath, "folder/file-2.md")),
      vscode.Uri.file(path.join(tempTestFilesPath, "folder/new-name.md"))
    );

    console.log("Will edit");
    await vscode.workspace.applyEdit(edit);
    console.log("Did edit");

    await new Promise((resolve) => setTimeout(resolve, 5000));
    await verifyFileSystem(expectedFileSystem);
  }).timeout(10000);
});

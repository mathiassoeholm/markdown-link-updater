import * as path from "path";
import * as fse from "fs-extra";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
// import * as myExtension from '../../extension';

const expectedFileSystem = {
  ["file-1.md"]: `[link to file-2](new-name.md)`,
  ["new-name.md"]: `# Just some markdown file`,
};

interface FileSystemDescription {
  [name: string]: string | FileSystemDescription;
}

const tempTestFilesPath = path.resolve("./temp-test-files");

function generateFileSystem(node: string | FileSystemDescription) {
  for (const { filePath, fileContent } of collectFilesRecursiveley(node)) {
    fse.ensureDirSync(path.dirname(filePath));
    fse.ensureFileSync(filePath);
    fse.writeFileSync(filePath, fileContent);
  }
}

function* collectFilesRecursiveley(
  node: string | FileSystemDescription,
  currentPath: string = tempTestFilesPath
): Generator<{
  filePath: string;
  fileContent: string;
}> {
  if (typeof node === "string") {
    yield { filePath: currentPath, fileContent: node };
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

    generateFileSystem(startFileSystem);
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
  }).timeout(10000);
});

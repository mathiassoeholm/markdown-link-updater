import * as path from "path";
import * as fse from "fs-extra";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
// import * as myExtension from '../../extension';

describe("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  // Copy test folders to temporary location
  // Open temporary location
  //

  const testFilesPath = path.join(
    __dirname,
    "../../../src/test/suite/test-files"
  );

  const tempTestFilesPath = path.join(testFilesPath, "../test-files-temp");

  after(() => {
    fse.removeSync(tempTestFilesPath);
  });

  it("Sample test", async () => {
    fse.copySync(testFilesPath, tempTestFilesPath);
    const uri = vscode.Uri.file(tempTestFilesPath);
    await vscode.commands.executeCommand("vscode.openFolder", uri);
    console.log("test");
  });
});

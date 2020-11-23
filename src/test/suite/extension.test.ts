import * as path from "path";
import * as fse from "fs-extra";
import * as assert from "assert";
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
      assert.strictEqual(actualFileContent, expectedFileContent);
    }
  }

  await new Promise((resolve, reject) =>
    glob(tempTestFilesPath + "/**/*.*", { nodir: true }, (err, matches) => {
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

interface TestConfig {
  title: string;
  startFileSystem: FileSystemDescription;
  renames: Array<{ from: string; to: string }>;
  expectedEndFileSystem: FileSystemDescription;
  mockSettings?: { [key: string]: any };
}

describe("Extension Test Suite", () => {
  let originalGetConfiguration: typeof vscode.workspace.getConfiguration;
  let mockSettings: { [key: string]: any };

  const test = (config: TestConfig) => {
    it(config.title, async () => {
      mockSettings = { slowUseGitIgnore: false, ...config.mockSettings };
      const edit = new vscode.WorkspaceEdit();
      config.renames.forEach(({ from, to }) => {
        edit.renameFile(
          vscode.Uri.file(path.join(tempTestFilesPath, from)),
          vscode.Uri.file(path.join(tempTestFilesPath, to))
        );
      });

      await generateFileSystem(config.startFileSystem);
      await vscode.commands.executeCommand(
        "vscode.openFolder",
        vscode.Uri.file(tempTestFilesPath)
      );

      await vscode.workspace.applyEdit(edit);

      await waitFor(() => verifyFileSystem(config.expectedEndFileSystem), {
        interval: 500,
        timeout: 5000,
      });
    }).timeout(10000);
  };

  beforeEach(() => {
    originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section, ...restArgs) => {
      if (section === "markdownLinkUpdater") {
        return {
          get(key: string, defaultValue: any) {
            return mockSettings[key] ?? defaultValue;
          },
        } as any;
      } else {
        return originalGetConfiguration(section, ...restArgs);
      }
    };

    fse.removeSync(tempTestFilesPath);
  });

  afterEach(() => {
    vscode.workspace.getConfiguration = originalGetConfiguration;
    fse.removeSync(tempTestFilesPath);
  });

  test({
    title: "updates files linking to the renamed file",
    startFileSystem: {
      ["file-1.md"]: `[link to file-2](./folder/file-2.md)`,
      ["folder"]: {
        ["file-2.md"]: `# Just some markdown file`,
      },
    },
    renames: [{ from: "folder/file-2.md", to: "folder/new-name.md" }],
    expectedEndFileSystem: {
      ["file-1.md"]: `[link to file-2](folder/new-name.md)`,
      ["folder"]: {
        ["new-name.md"]: `# Just some markdown file`,
      },
    },
  });

  test({
    title: "updates the renamed files own links when it is moved",
    startFileSystem: {
      ["file-1.md"]: `[link to file-2](file-2.md)\n[link to a website](http://www.example.com)`,
      ["file-2.md"]: `# Just some markdown file`,
    },
    renames: [{ from: "file-1.md", to: "folder/file-1.md" }],
    expectedEndFileSystem: {
      ["folder"]: {
        ["file-1.md"]: `[link to file-2](../file-2.md)\n[link to a website](http://www.example.com)`,
      },
      ["file-2.md"]: `# Just some markdown file`,
    },
  });

  test({
    title: "can update multiple links in the same file",
    startFileSystem: {
      ["links.md"]: `[a](old-a.txt)\n[b](old-b.txt)\n[c](old-c.txt)`,
      ["old-a.txt"]: `a`,
      ["old-b.txt"]: `b`,
      ["old-c.txt"]: `c`,
    },
    renames: [
      { from: "old-a.txt", to: "new-a.txt" },
      { from: "old-b.txt", to: "new-b.txt" },
      { from: "old-c.txt", to: "new-c.txt" },
    ],
    expectedEndFileSystem: {
      ["links.md"]: `[a](new-a.txt)\n[b](new-b.txt)\n[c](new-c.txt)`,
      ["new-a.txt"]: `a`,
      ["new-b.txt"]: `b`,
      ["new-c.txt"]: `c`,
    },
  });

  test({
    title: "ignores node_modules",
    startFileSystem: {
      ["node_modules"]: {
        ["file-1.md"]: "[link to file-2](file-2.md)",
        ["file-2.md"]: "# Just some markdown file",
        ["file-3.md"]: "[link to file-1](file-1.md)",
      },
    },
    renames: [
      { from: "node_modules/file-2.md", to: "node_modules/file-2-changed.md" },
      {
        from: "node_modules/file-3.md",
        to: "node_modules/subfolder/file-3.md",
      },
    ],
    expectedEndFileSystem: {
      ["node_modules"]: {
        ["file-1.md"]: "[link to file-2](file-2.md)",
        ["file-2-changed.md"]: "# Just some markdown file",
        ["subfolder"]: {
          ["file-3.md"]: "[link to file-1](file-1.md)",
        },
      },
    },
  });

  test({
    title: "updates links with empty text",
    startFileSystem: {
      ["file-1.md"]: `![](an-image.svg)`,
      ["an-image.svg"]: `<svg />`,
    },
    renames: [{ from: "an-image.svg", to: "an-image-changed.svg" }],
    expectedEndFileSystem: {
      ["file-1.md"]: `![](an-image-changed.svg)`,
      ["an-image-changed.svg"]: `<svg />`,
    },
  });

  test({
    title: "works when renaming folders",
    startFileSystem: {
      ["file-1.md"]:
        "[link-1](before/1.txt)\n[link-2](before/2.txt)\n[link-3](before/sub/3.txt)",
      ["before"]: {
        ["1.txt"]: "file 1",
        ["2.txt"]: "file 2",
        ["sub"]: {
          ["3.txt"]: "file 3",
        },
      },
    },
    renames: [{ from: "before", to: "after" }],
    expectedEndFileSystem: {
      ["file-1.md"]:
        "[link-1](after/1.txt)\n[link-2](after/2.txt)\n[link-3](after/sub/3.txt)",
      ["after"]: {
        ["1.txt"]: "file 1",
        ["2.txt"]: "file 2",
        ["sub"]: {
          ["3.txt"]: "file 3",
        },
      },
    },
  });

  test({
    title: "can handle folders with names that look like files",
    startFileSystem: {
      ["file-1.md"]: "[hello](folder.txt/subfolder.txt/hello.txt)",
      ["folder.txt"]: {
        ["subfolder.txt"]: {
          "hello.txt": "hello",
        },
      },
    },
    renames: [{ from: "folder.txt", to: "folder-changed.txt" }],
    expectedEndFileSystem: {
      ["file-1.md"]: "[hello](folder-changed.txt/subfolder.txt/hello.txt)",
      ["folder-changed.txt"]: {
        ["subfolder.txt"]: {
          "hello.txt": "hello",
        },
      },
    },
  });

  test({
    title: "ignores markdown files in excluded directories",
    startFileSystem: {
      ["ignored-1"]: {
        ["file-1.md"]: "[](../hello.txt)",
      },
      ["ignored-2"]: {
        ["file-2.md"]: "[](../hello.txt)",
      },
      ["hello.txt"]: "hello",
    },
    renames: [{ from: "hello.txt", to: "hello-changed.txt" }],
    expectedEndFileSystem: {
      ["ignored-1"]: {
        ["file-1.md"]: "[](../hello.txt)",
      },
      ["ignored-2"]: {
        ["file-2.md"]: "[](../hello.txt)",
      },
      ["hello-changed.txt"]: "hello",
    },
    mockSettings: {
      excludeDirs: ["**/ignored-1/**", "**/ignored-2/**"],
    },
  });

  test({
    title: "ignores changes from excluded directories",
    startFileSystem: {
      ["ignored-1"]: {
        ["hello.txt"]: "hello",
      },
      ["ignored-2"]: {
        ["howdy.txt"]: "howdy",
      },
      ["file-1.md"]: "[](ignored-1/hello.txt)\n[](ignored-2/howdy.txt)",
    },
    renames: [
      { from: "ignored-1/hello.txt", to: "ignored-1/hello-changed.txt" },
      { from: "ignored-2", to: "ignored-2-changed" },
    ],
    expectedEndFileSystem: {
      ["ignored-1"]: {
        ["hello-changed.txt"]: "hello",
      },
      ["ignored-2-changed"]: {
        ["howdy.txt"]: "howdy",
      },
      ["file-1.md"]: "[](ignored-1/hello.txt)\n[](ignored-2/howdy.txt)",
    },
    mockSettings: {
      excludeDirs: ["**/ignored-1/**", "**/ignored-2/**"],
    },
  });
});

import { promises as fs } from "fs";
import { ChangeEventPayload, FileList } from "./models";
import { pureGetEdits } from "./pure-get-edits";
import { executeEdits } from "./execute-edits";
import { ExtensionContext, workspace } from "vscode";

function activate(context: ExtensionContext) {
  let payloads: Array<Partial<ChangeEventPayload["save"]>> = [];

  const onDidRenameDisposable = workspace.onDidRenameFiles(async (e) => {
    const payloads: Array<ChangeEventPayload["rename"]> = e.files.map(
      (file) => ({
        pathBefore: file.oldUri.fsPath,
        pathAfter: file.newUri.fsPath,
      })
    );

    for (const payload of payloads) {
      const fileListPromises = (await workspace.findFiles("**/*.md")).map(
        async (f) => ({
          path: f.fsPath,
          content: await fs.readFile(f.fsPath, "utf-8"),
        })
      );

      const markdownFiles = await Promise.all(fileListPromises);

      const edits = pureGetEdits({ type: "rename", payload }, markdownFiles);

      await executeEdits(edits);
    }
  });

  const onWillSaveDisposable = workspace.onWillSaveTextDocument(async (e) => {
    if (e.document.fileName.endsWith(".md")) {
      const contentBefore = await fs.readFile(e.document.fileName, "utf-8");

      payloads.push({
        path: e.document.fileName,
        contentBefore,
      });
    }
  });

  const onDidSaveDisposable = workspace.onDidSaveTextDocument(async (e) => {
    const payload = payloads.find((p) => p.path === e.fileName);
    if (!payload) {
      return;
    }
    try {
      payload.contentAfter = await fs.readFile(e.fileName, "utf-8");

      const edits = pureGetEdits(
        { type: "save", payload: payload as ChangeEventPayload["save"] },
        [] // TODO: Pass in filelist
      );

      executeEdits(edits);
    } finally {
      payloads = payloads.filter((p) => p.path !== p.path);
    }
  });

  context.subscriptions.push(onWillSaveDisposable);
  context.subscriptions.push(onDidSaveDisposable);
  context.subscriptions.push(onDidRenameDisposable);
}

export { activate };

import { promises as fs } from "fs";
import { ChangeEventPayload, FileList } from "./models";
import { pureGetEdits } from "./pure-get-edits";
import { executeEdits } from "./execute-edits";
import { ExtensionContext, workspace } from "vscode";
import { config, getOptions } from "./config";

function activate(context: ExtensionContext) {
  let payloads: Array<Partial<ChangeEventPayload["save"]>> = [];

  const getMarkdownFiles = async () => {
    return await Promise.all(
      (await workspace.findFiles("**/*.md", config.exclude.join(","))).map(
        async (f) => ({
          path: f.fsPath,
          content: await fs.readFile(f.fsPath, "utf-8"),
        })
      )
    );
  };

  const onDidRenameDisposable = workspace.onDidRenameFiles(async (e) => {
    const payloads: Array<ChangeEventPayload["rename"]> = e.files.map(
      (file) => ({
        pathBefore: file.oldUri.fsPath,
        pathAfter: file.newUri.fsPath,
      })
    );

    for (const payload of payloads) {
      const edits = pureGetEdits(
        { type: "rename", payload },
        await getMarkdownFiles(),
        getOptions(payload.pathBefore)
      );

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
        await getMarkdownFiles(),
        getOptions(payload.path!)
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

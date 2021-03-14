import * as vscode from "vscode";
import { promises as fs } from "fs";
import { ChangeEventPayload } from "./models";
import { pureGetEdits } from "./put-get-edits";
import { executeEdits } from "./execute-edits";

function activate(context: vscode.ExtensionContext) {
  let payloads: Array<Partial<ChangeEventPayload["save"]>> = [];

  const onWillSaveDisposable = vscode.workspace.onWillSaveTextDocument(
    async (e) => {
      if (e.document.fileName.endsWith(".md")) {
        const contentBefore = await fs.readFile(e.document.fileName, "utf-8");

        payloads.push({
          path: e.document.fileName,
          contentBefore,
        });
      }
    }
  );

  const onDidSaveDisposable = vscode.workspace.onDidSaveTextDocument(
    async (e) => {
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
    }
  );

  context.subscriptions.push(onWillSaveDisposable);
  context.subscriptions.push(onDidSaveDisposable);
}

export { activate };

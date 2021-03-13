import * as vscode from "vscode";
import { promises as fs } from "fs";
import { ChangeEvent, ChangeEventPayload, Path } from "./models";
import { pureGetActions } from "./put-get-actions";

function activate(context: vscode.ExtensionContext) {
  const payloads: Array<Partial<ChangeEventPayload["save"]>> = [];

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

      payload.contentAfter = await fs.readFile(e.fileName, "utf-8");

      const actions = pureGetActions(
        { type: "save", payload: payload as ChangeEventPayload["save"] },
        [] // TODO: Pass in filelist
      );
    }
  );

  context.subscriptions.push(onWillSaveDisposable);
  context.subscriptions.push(onDidSaveDisposable);
}

export { activate };

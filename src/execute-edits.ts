import { pathExistsSync } from "fs-extra";
import { Position, Range, Uri, window, workspace, WorkspaceEdit } from "vscode";
import { Edit } from "./models";

async function executeEdits(edits: Edit[]) {
  const shouldExecute =
    edits.length > 5
      ? await window.showInformationMessage(
          `Update ${edits.length} Markdown links?`,
          { modal: true },
          "Yes",
          "No"
        )
      : "Yes";

  if (shouldExecute === "Yes") {
    for (const edit of edits) {
      await executeEdit(edit);
    }

    if (edits.length > 1) {
      window.showInformationMessage(`Updated ${edits.length} Markdown links.`);
    } else if (edits.length === 1) {
      window.showInformationMessage(
        `Updated a Markdown link in ${workspace.asRelativePath(edits[0].path)}`
      );
    }
  }
}

async function executeEdit(edit: Edit) {
  if (edit.requiresPathToExist && !pathExistsSync(edit.requiresPathToExist)) {
    return;
  }

  const workspaceEdit = new WorkspaceEdit();
  const range = new Range(
    new Position(edit.range.start.line, edit.range.start.character),
    new Position(edit.range.end.line, edit.range.end.character)
  );

  workspaceEdit.replace(Uri.file(edit.path), range, edit.newText);

  await workspace.applyEdit(workspaceEdit);
}

export { executeEdit, executeEdits };

import { Position, Range, Uri, workspace, WorkspaceEdit } from "vscode";
import { Edit } from "./models";

async function executeEdits(edits: Edit[]) {
  for (const edit of edits) {
    await executeEdit(edit);
  }
}

function executeEdit(edit: Edit) {
  const workspaceEdit = new WorkspaceEdit();
  const range = new Range(
    new Position(edit.range.start.line, edit.range.start.character),
    new Position(edit.range.end.line, edit.range.end.character)
  );

  workspaceEdit.replace(Uri.file(edit.path), range, edit.newText);

  return workspace.applyEdit(workspaceEdit);
}

export { executeEdit, executeEdits };

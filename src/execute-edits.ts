import { Position, Range, Uri, workspace, WorkspaceEdit } from "vscode";
import { Edit } from "./models";

function executeEdits(edits: Edit[]) {
  edits.forEach(executeEdit);
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

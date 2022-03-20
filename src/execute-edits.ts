import { pathExistsSync } from "fs-extra";
import { Position, Range, Uri, window, workspace, WorkspaceEdit } from "vscode";
import { Edit } from "./models";

async function executeEdits(edits: Edit[]) {
  edits = edits.filter(
    (edit) =>
      !edit.requiresPathToExist || pathExistsSync(edit.requiresPathToExist)
  );

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
    const editsByPath = edits.reduce(
      (editsByPath: { [_: string]: Edit[] }, edit) => ({
        ...editsByPath,
        [edit.path]: [...(editsByPath[edit.path] || []), edit],
      }),
      {}
    );

    for (const edits of Object.values(editsByPath)) {
      const lineOffsets = {} as { [_: number]: number };
      for (const edit of edits) {
        await executeEdit(edit, lineOffsets);
      }
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

async function executeEdit(
  { range: { start, end }, path, newText }: Edit,
  lineOffsets: { [_: number]: number }
) {
  const workspaceEdit = new WorkspaceEdit();

  let offset = 0;
  if (start.line === end.line) {
    offset = lineOffsets[start.line] || 0;
    lineOffsets[start.line] =
      offset + newText.length - (end.character - start.character);
  }

  const range = new Range(
    new Position(start.line, start.character + offset),
    new Position(end.line, end.character + offset)
  );

  workspaceEdit.replace(Uri.file(path), range, newText);

  await workspace.applyEdit(workspaceEdit);
}

export { executeEdits };

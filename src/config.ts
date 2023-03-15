import { Uri, workspace } from "vscode";
import { Path } from "./models";
import { Options } from "./pure-get-edits";

function getConfig() {
  return workspace.getConfiguration("markdownLinkUpdater");
}

const config = {
  get exclude() {
    return getConfig().get<string[]>("exclude", []);
  },
  get include() {
    return getConfig().get<string[]>("include", []);
  },
  get disableConfirmationPrompt() {
    return getConfig().get<boolean>("disableConfirmationPrompt", false);
  },
};

function getOptions(targetFile: Path): Options {
  return {
    exclude: config.exclude,
    include: config.include,
    workspacePath: workspace.getWorkspaceFolder(Uri.file(targetFile))?.uri
      .fsPath,
  };
}

export { config, getOptions };

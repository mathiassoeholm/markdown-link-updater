import {
  ChangeEvent,
  ChangeEventPayload,
  ChangeEventType,
  Edit,
  FileList,
} from "../models";
import { Options, pureGetEdits } from "../pure-get-edits";

const trim = (s: string) => s.trim();
const trimLines = (s: string) => s.trim().split("\n").map(trim).join("\n");

describe("pureGetEdits", () => {
  describe("rename", () => {
    interface TestRenameOptions extends Partial<Options> {
      payload: ChangeEventPayload["rename"];
      markdownFiles: FileList;
      expectedEdits: Edit[];
    }

    const testRename = ({
      payload,
      markdownFiles,
      expectedEdits,
      ...options
    }: TestRenameOptions) => {
      const event: ChangeEvent<"rename"> = {
        type: "rename",
        payload,
      };

      const edits = pureGetEdits(event, markdownFiles, options);

      expect(edits).toEqual(expectedEdits);
    };

    it("updates the renamed files own links when it is moved", () => {
      testRename({
        payload: {
          pathBefore: "file-1.md",
          pathAfter: "folder/file-1.md",
        },
        markdownFiles: [
          {
            path: "folder/file-1.md",
            content: trimLines(`
              [link to a website](http://www.example.com)
              [link to file-2](file-2.md)
            `),
          },
          {
            path: "file-2.md",
            content: "# Just some markdown file",
          },
        ],
        expectedEdits: [
          {
            path: "folder/file-1.md",
            range: {
              start: { character: 0, line: 0 },
              end: { character: 43, line: 0 },
            },
            newText: "[link to a website](../http:/www.example.com)",
            // This link will not actually be updated, because it requires this path to exist
            requiresPathToExist: "http:/www.example.com",
          },
          {
            path: "folder/file-1.md",
            range: {
              start: {
                line: 1,
                character: 0,
              },
              end: {
                line: 1,
                character: 27,
              },
            },
            newText: "[link to file-2](../file-2.md)",
            requiresPathToExist: "file-2.md",
          },
        ],
      });
    });

    it("updates files linking to the renamed file", () => {
      testRename({
        payload: {
          pathBefore: "folder/file-2.md",
          pathAfter: "folder/new-name.md",
        },
        markdownFiles: [
          {
            path: "file-1.md",
            content:
              "# File 1\na link [link to file-2](./folder/file-2.md) is here",
          },
          {
            path: "folder/new-name.md",
            content: "# Just some markdown file",
          },
        ],
        expectedEdits: [
          {
            path: "file-1.md",
            range: {
              start: {
                line: 1,
                character: 7,
              },
              end: {
                line: 1,
                character: 43,
              },
            },
            newText: `[link to file-2](folder/new-name.md)`,
          },
        ],
      });
    });
    it("can update multiple links in the same file", () => {
      testRename({
        payload: {
          pathBefore: "old.txt",
          pathAfter: "new.txt",
        },
        markdownFiles: [
          {
            path: "file.md",
            content: trimLines(`
              - Link one: [link no. 1](./old.txt)
              - Link two: [link no. 2](old.txt)
            `),
          },
        ],
        expectedEdits: [
          {
            path: "file.md",
            range: {
              start: {
                line: 0,
                character: 12,
              },
              end: {
                line: 0,
                character: 35,
              },
            },
            newText: "[link no. 1](new.txt)",
          },
          {
            path: "file.md",
            range: {
              start: {
                line: 1,
                character: 12,
              },
              end: {
                line: 1,
                character: 33,
              },
            },
            newText: "[link no. 2](new.txt)",
          },
        ],
      });
    });

    it("uses exclude glob", () => {
      testRename({
        payload: {
          pathBefore: "workspace/node_modules/file-2.md",
          pathAfter: "workspace/node_modules/file-2-changed.md",
        },
        markdownFiles: [
          {
            path: "workspace/file-1.md",
            content: "[link](node_modules/file-2.md)",
          },
          {
            path: "workspace/node_modules/file-2-changed.md",
            content: "# Just some markdow file",
          },
        ],
        workspacePath: "workspace/",
        // Exclude node_modules at any level
        exclude: ["**/node_modules/**"],
        expectedEdits: [],
      });
    });

    it("uses relative path in exclude", () => {
      testRename({
        payload: {
          pathBefore: "workspace/node_modules/file-2.md",
          pathAfter: "workspace/node_modules/file-2-changed.md",
        },
        markdownFiles: [
          {
            path: "workspace/file-1.md",
            content: "[link](node_modules/file-2.md)",
          },
          {
            path: "workspace/node_modules/file-2-changed.md",
            content: "# Just some markdow file",
          },
        ],
        workspacePath: "workspace/",
        // Exclude node_modules at top level
        exclude: ["node_modules/**"],
        expectedEdits: [],
      });
    });
  });

  describe("save", () => {
    it.each`
      oldHeader        | oldLink       | newHeader         | newLink
      ${"old text"}    | ${"old-text"} | ${"the new txt"}  | ${"the-new-txt"}
      ${"halløjs's"}   | ${"halløjss"} | ${"dåv    dav"}   | ${"dåv-dav"}
      ${"emoji 👍 np"} | ${"emoji-np"} | ${"emoji 😃-yay"} | ${"emoji--yay"}
    `(
      "renames link when header changes from '$oldHeader' to '$newHeader'",
      ({ oldHeader, oldLink, newHeader, newLink }) => {
        const event: ChangeEvent<"save"> = {
          type: "save",
          payload: {
            path: "/files/foo.md",
            contentBefore: trimLines(`
              Link:
              [link](#${oldLink})

              ## ${oldHeader}
            `),
            contentAfter: trimLines(`
              Link:
              [link](#${oldLink})

              ## ${newHeader}
            `),
          },
        };

        const markdownFiles: FileList = [
          {
            path: event.payload.path,
            content: event.payload.contentAfter,
          },
        ];

        expect(
          pureGetEdits(event, markdownFiles, { workspacePath: "/" })[0]
        ).toEqual({
          path: event.payload.path,
          range: {
            start: {
              line: 1,
              character: 0,
            },
            end: {
              line: 1,
              character: `[link](#${oldLink})`.length,
            },
          },
          newText: `[link](#${newLink})`,
        });
      }
    );
  });
});

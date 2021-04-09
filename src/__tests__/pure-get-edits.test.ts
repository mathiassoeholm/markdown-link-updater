import { ChangeEvent, ChangeEventPayload, Edit, FileList } from "../models";
import { Options, pureGetEdits } from "../pure-get-edits";

const trim = (s: string) => s.trim();
const trimLines = (s: string) => s.trim().split("\n").map(trim).join("\n");

describe("pureGetEdits", () => {
  describe("rename", () => {
    interface CompactEdit extends Omit<Edit, "range"> {
      range: string;
    }

    interface TestRenameOptions extends Partial<Options> {
      payload: ChangeEventPayload["rename"];
      markdownFiles: FileList;
      expectedEdits: CompactEdit[];
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

      expect(edits).toEqual(
        expectedEdits.map((e) => {
          const [start, end] = e.range.split("-");
          const [startLine, startCharacter] = start.split(":");
          const [endLine, endCharacter] = end.split(":");

          const edit: Edit = {
            ...e,
            range: {
              start: {
                line: parseInt(startLine),
                character: parseInt(startCharacter),
              },
              end: {
                line: parseInt(endLine),
                character: parseInt(endCharacter),
              },
            },
          };

          return edit;
        })
      );
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
            range: "0:20-0:42",
            newText: "../http:/www.example.com",
            // This link will not actually be updated, because it requires this path to exist
            requiresPathToExist: "http:/www.example.com",
          },
          {
            path: "folder/file-1.md",
            range: "1:17-1:26",
            newText: "../file-2.md",
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
              "# File 1\na link [link to file-2](folder/file-2.md) is here",
          },
          {
            path: "folder/new-name.md",
            content: "# Just some markdown file",
          },
        ],
        expectedEdits: [
          {
            path: "file-1.md",
            range: "1:24-1:40",
            newText: "folder/new-name.md",
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
            range: "0:25-0:34",
            newText: "new.txt",
          },
          {
            path: "file.md",
            range: "1:25-1:32",
            newText: "new.txt",
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

    it("ignores markdown files in excluded directories", () => {
      testRename({
        payload: {
          pathBefore: "hello.txt",
          pathAfter: "hello-changed.txt",
        },
        markdownFiles: [
          {
            path: "ignored-1/file-1.md",
            content: "[](../hello.txt)",
          },
          {
            path: "ignored-2/file-2.md",
            content: "[](../hello.txt)",
          },
        ],
        exclude: ["**/ignored-1/**", "**/ignored-2/**"],
        expectedEdits: [],
      });
    });

    it("works when renaming folders", () => {
      testRename({
        payload: {
          pathBefore: "my/workspace/before",
          pathAfter: "my/workspace/after",
        },
        markdownFiles: [
          {
            path: "my/workspace/file-1.md",
            content: trimLines(`
              [link-1](before/1.txt)
              [link-2](before/2.txt)
              [link-3](before/sub/3.txt)
            `),
          },
        ],
        workspacePath: "my/workspace/",
        expectedEdits: [
          {
            path: "my/workspace/file-1.md",
            range: "0:9-0:21",
            newText: "after/1.txt",
            requiresPathToExist: "my/workspace/after/1.txt",
          },
          {
            path: "my/workspace/file-1.md",
            range: "1:9-1:21",
            newText: "after/2.txt",
            requiresPathToExist: "my/workspace/after/2.txt",
          },
          {
            path: "my/workspace/file-1.md",
            range: "2:9-2:25",
            newText: "after/sub/3.txt",
            requiresPathToExist: "my/workspace/after/sub/3.txt",
          },
        ],
      });
    });

    it("can handle folders with names that look like files", () => {
      testRename({
        payload: {
          pathBefore: "folder.txt",
          pathAfter: "folder-changed.txt",
        },
        markdownFiles: [
          {
            path: "file-1.md",
            content: "[hello](folder.txt/subfolder.txt/hello.txt)",
          },
        ],
        expectedEdits: [
          {
            path: "file-1.md",
            range: "0:8-0:42",
            newText: "folder-changed.txt/subfolder.txt/hello.txt",
            requiresPathToExist: "folder-changed.txt/subfolder.txt/hello.txt",
          },
        ],
      });
    });

    it("does not include markdown files outside the include pattern", () => {
      testRename({
        payload: {
          pathBefore: "included/hello.txt",
          pathAfter: "included/hello-changed.txt",
        },
        markdownFiles: [
          {
            path: "not-included.md",
            content: "[](included/hello.txt)",
          },
          {
            path: "included/file.md",
            content: "[](hello.txt)",
          },
        ],
        expectedEdits: [
          {
            path: "included/file.md",
            range: "0:3-0:12",
            newText: "hello-changed.txt",
          },
        ],
        include: ["**/included/**"],
      });
    });

    it("does not process the renamed file if it is outside the include pattern", () => {
      testRename({
        payload: {
          pathBefore: "not-included.txt",
          pathAfter: "not-included-changed.txt",
        },
        markdownFiles: [
          {
            path: "included/file.md",
            content: "[](../not-included.txt)",
          },
        ],
        expectedEdits: [],
        include: ["**/included/**"],
      });
    });

    it("can use multiple include patterns", () => {
      testRename({
        payload: {
          pathBefore: "included/hello.txt",
          pathAfter: "included/hello-changed.txt",
        },
        markdownFiles: [
          {
            path: "included/file.md",
            content: "[](hello.txt)",
          },
          {
            path: "included-file.md",
            content: "[](included/hello.txt)",
          },
        ],
        expectedEdits: [
          {
            path: "included/file.md",
            range: "0:3-0:12",
            newText: "hello-changed.txt",
          },
          {
            path: "included-file.md",
            range: "0:3-0:21",
            newText: "included/hello-changed.txt",
          },
        ],
        include: ["**/included/**", "included-file.md"],
      });
    });

    it("updates the renamed files own links with section reference", () => {
      testRename({
        payload: {
          pathBefore: "file-1.md",
          pathAfter: "folder/file-1.md",
        },
        markdownFiles: [
          {
            path: "folder/file-1.md",
            content: "[link to file-2](file-2.md#test)",
          },
          {
            path: "file-2.md",
            content: "# test",
          },
        ],
        expectedEdits: [
          {
            path: "folder/file-1.md",
            range: "0:17-0:26",
            newText: "../file-2.md",
            requiresPathToExist: "file-2.md",
          },
        ],
      });
    });

    it("can update links in other files with a section reference", () => {
      testRename({
        payload: {
          pathBefore: "file2.md",
          pathAfter: "file2-changed.md",
        },
        markdownFiles: [
          {
            path: "file1.md",
            content: "[link to file 2](file2.md#Title)",
          },
          {
            path: "file2-changed.md",
            content: "## Title",
          },
        ],
        expectedEdits: [
          {
            path: "file1.md",
            range: "0:17-0:25",
            newText: "file2-changed.md",
          },
        ],
      });
    });

    it("does not produce an edit if the link is unmodified", () => {
      testRename({
        payload: {
          pathBefore: "file-1.md",
          pathAfter: "file-1-renamed.md",
        },
        markdownFiles: [
          {
            path: "file-1-renamed.md",
            content: "![](./image.png)",
          },
        ],
        expectedEdits: [],
      });
    });

    it("converts Windows paths to POSIX", () => {
      testRename({
        payload: {
          pathBefore: "folder\\file-2.md",
          pathAfter: "folder\\new-name.md",
        },
        markdownFiles: [
          {
            path: "file-1.md",
            content:
              "# File 1\na link [link to file-2](./folder/file-2.md) is here",
          },
          {
            path: "folder\\new-name.md",
            content: "# Just some markdown file",
          },
        ],
        expectedEdits: [
          {
            path: "file-1.md",
            range: "1:24-1:42",
            newText: "folder/new-name.md",
          },
        ],
      });
    });

    it("updates two links on the same line", () => {
      testRename({
        payload: {
          pathBefore: "img.png",
          pathAfter: "pic.png",
        },
        markdownFiles: [
          {
            path: "file.md",
            content: "![](img.png) and ![](img.png)",
          },
        ],
        expectedEdits: [
          {
            path: "file.md",
            range: "0:4-0:11",
            newText: "pic.png",
          },
          {
            path: "file.md",
            range: "0:21-0:28",
            newText: "pic.png",
          },
        ],
      });
    });

    it("updates its own two links on the same line", () => {
      testRename({
        payload: {
          pathBefore: "file.md",
          pathAfter: "folder/file.md",
        },
        markdownFiles: [
          {
            path: "folder/file.md",
            content: "![](img1.png) and ![](img2.png)",
          },
        ],
        expectedEdits: [
          {
            path: "folder/file.md",
            range: "0:4-0:12",
            newText: "../img1.png",
            requiresPathToExist: "img1.png",
          },
          {
            path: "folder/file.md",
            range: "0:22-0:30",
            newText: "../img2.png",
            requiresPathToExist: "img2.png",
          },
        ],
      });
    });

    it("updates the src attribute on img tags", () => {
      testRename({
        payload: {
          pathBefore: "image.png",
          pathAfter: "folder/image.png",
        },
        markdownFiles: [
          {
            path: "file-1.md",
            content: `<img src="image.png" />`,
          },
          {
            path: "folder/file-2.md",
            content: trimLines(`
              # Header
              <img
                alt="some image"
                src="../image.png"
              ></img>
            `),
          },
          {
            path: "file-2.md",
            content: trimLines(`
              # Two links
              <img src="image.png" />
              <img src="image.png" />
            `),
          },
        ],
        expectedEdits: [
          {
            path: "file-1.md",
            range: "0:10-0:19",
            newText: "folder/image.png",
          },
          {
            path: "folder/file-2.md",
            range: "3:5-3:12",
            newText: "image.png",
          },
          {
            path: "file-3.md",
            range: "1:10-1:19",
            newText: "folder/image.png",
          },
          {
            path: "file-3.md",
            range: "2:10-2:19",
            newText: "folder/image.png",
          },
        ],
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

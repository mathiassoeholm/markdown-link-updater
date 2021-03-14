import { ChangeEvent, ChangeEventType, FileList } from "../models";
import { pureGetEdits } from "../pure-get-edits";

const trim = (s: string) => s.trim();
const trimLines = (s: string) => s.trim().split("\n").map(trim).join("\n");

describe("pureGetEdits", () => {
  describe("rename", () => {
    it("updates the renamed files own links when it is moved", () => {
      const markdownFiles: FileList = [
        {
          path: "file-1.md",
          content:
            "[link to a website](http://www.example.com)\n[link to file-2](file-2.md)",
        },
        {
          path: "file-2.md",
          content: "# Just some markdown file",
        },
      ];

      const event: ChangeEvent<"rename"> = {
        type: "rename",
        payload: {
          pathBefore: "file-1.md",
          pathAfter: "folder/file-1.md",
        },
      };

      const edits = pureGetEdits(event, markdownFiles);

      expect(edits).toHaveLength(1);
      expect(edits[0]).toEqual({
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
      });
    });

    it("updates files linking to the renamed file", () => {
      const file1 = {
        path: "file-1.md",
        content:
          "# File 1\na link [link to file-2](./folder/file-2.md) is here",
      };

      const file2 = {
        path: "folder/file-2.md",
        content: "# Just some markdown file",
      };

      const event: ChangeEvent<"rename"> = {
        type: "rename",
        payload: {
          pathBefore: file2.path,
          pathAfter: "folder/new-name.md",
        },
      };

      const markdownFiles: FileList = [file1, file2];

      const edits = pureGetEdits(event, markdownFiles);

      expect(edits).toHaveLength(1);
      expect(edits[0]).toEqual({
        path: file1.path,
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
        newText: `[link to file-2](${event.payload.pathAfter})`,
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

        expect(pureGetEdits(event, markdownFiles)[0]).toEqual({
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

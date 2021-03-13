import { ChangeEvent, ChangeEventType, FileList } from "./models";

function pureGetActions<T extends ChangeEventType>(
  event: ChangeEvent<T>,
  fileList: FileList
) {
  return [];
}

export { pureGetActions };

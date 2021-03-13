type Path = string;

export enum ChangeEventType {
  save = "save",
}

export interface ChangeEventPayload {
  [ChangeEventType.save]: {
    path: Path;
    contentBefore: string;
    contentAfter: string;
  };
}

export interface ChangeEvent<T extends ChangeEventType> {
  type: T;
  payload: ChangeEventPayload[T];
}

export type FileList = Array<{ path: Path; content: string }>;

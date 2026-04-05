export type MonacoFile = {
  name: string;
  language: string;
  value: string;
};

export type MonacoFiles = Record<string, MonacoFile>;

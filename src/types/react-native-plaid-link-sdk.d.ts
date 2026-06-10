declare module "react-native-plaid-link-sdk" {
  export enum LinkIOSPresentationStyle {
    FULL_SCREEN = "FULL_SCREEN",
    MODAL = "MODAL",
  }

  export enum LinkLogLevel {
    ERROR = "ERROR",
    WARN = "WARN",
    INFO = "INFO",
    DEBUG = "DEBUG",
  }

  export type LinkSuccess = {
    publicToken: string;
    metadata: {
      institution?: {
        id?: string;
        name?: string;
      };
      accounts: Array<{
        id?: string;
        name?: string;
        mask?: string;
        type?: string;
        subtype?: string | { type?: string; value?: string };
        verificationStatus?: string;
      }>;
      linkSessionId?: string;
    };
  };

  export type LinkExit = {
    error?: {
      displayMessage?: string;
      errorMessage?: string;
      errorCode?: string;
      errorType?: string;
    };
    metadata: {
      linkSessionId?: string;
      requestId?: string;
    };
  };

  export function create(config: { token: string; noLoadingState?: boolean }): void;

  export function open(props: {
    onSuccess: (success: LinkSuccess) => void;
    onExit?: (exit: LinkExit) => void;
    iOSPresentationStyle?: LinkIOSPresentationStyle;
    logLevel?: LinkLogLevel;
  }): void;

  export function destroy(): Promise<void>;
}

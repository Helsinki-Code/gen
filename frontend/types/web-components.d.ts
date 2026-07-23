import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "amrobot-chat": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        "bot-id"?: string;
        theme?: string;
        position?: string;
        "primary-color"?: string;
      };
    }
  }
}

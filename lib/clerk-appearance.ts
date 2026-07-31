/** Clerk UI tokens aligned with KlikCollect marketplace chrome. */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#0a0a0a",
    colorDanger: "#0a0a0a",
    colorSuccess: "#0a0a0a",
    colorWarning: "#3a3a3a",
    colorNeutral: "#0a0a0a",
    colorText: "#0a0a0a",
    colorTextSecondary: "rgba(10, 10, 10, 0.5)",
    colorTextOnPrimaryBackground: "#f7f7f5",
    colorBackground: "#f7f7f5",
    colorInputBackground: "#f7f7f5",
    colorInputText: "#0a0a0a",
    colorBorder: "rgba(10, 10, 10, 0.12)",
    colorMutedForeground: "rgba(10, 10, 10, 0.4)",
    borderRadius: "0px",
    fontFamily: "var(--font-montreal), NeueMontreal, Arial, sans-serif",
    fontFamilyButtons: "var(--font-montreal), NeueMontreal, Arial, sans-serif",
    fontSize: "15px",
    fontWeight: {
      normal: 500,
      medium: 500,
      bold: 500,
    },
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full border-0 bg-transparent p-0 shadow-none",
    headerTitle:
      "text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight text-black",
    headerSubtitle: "text-[14px] text-black/45",
    socialButtonsBlockButton:
      "border border-black/15 bg-transparent text-[13px] font-medium uppercase tracking-[0.12em] text-black shadow-none hover:border-black hover:bg-black hover:text-white",
    socialButtonsBlockButtonText: "font-medium",
    dividerLine: "bg-black/10",
    dividerText: "text-[11px] uppercase tracking-[0.16em] text-black/35",
    formFieldLabel:
      "text-[11px] font-medium uppercase tracking-[0.16em] text-black/40",
    formFieldInput:
      "border border-black/15 bg-transparent px-4 py-3 text-[15px] text-black shadow-none outline-none focus:border-black/45",
    formButtonPrimary:
      "bg-black text-[12px] font-medium uppercase tracking-[0.16em] text-white shadow-none hover:opacity-80",
    footerActionLink: "text-black underline underline-offset-4 decoration-black/25 hover:decoration-black",
    footerActionText: "text-[13px] text-black/45",
    identityPreviewEditButton: "text-black",
    formFieldInputShowPasswordButton: "text-black/40 hover:text-black",
    otpCodeFieldInput:
      "border border-black/15 bg-transparent text-black focus:border-black/45",
    alternativeMethodsBlockButton:
      "border border-black/15 bg-transparent text-[13px] text-black hover:border-black",
    alertText: "text-[13px] text-black/60",
    formFieldErrorText: "text-[12px] text-black/55",
    logoBox: "hidden",
    footer: "bg-transparent",
    footerPages: "hidden",
  },
  layout: {
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
    showOptionalFields: false,
  },
};

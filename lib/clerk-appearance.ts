/** Clerk UI — seamless marketplace canvas + matching account popover */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#0a0a0a",
    colorDanger: "#0a0a0a",
    colorSuccess: "#0a0a0a",
    colorWarning: "#3a3a3a",
    colorNeutral: "#0a0a0a",
    colorText: "#0a0a0a",
    colorTextSecondary: "rgba(10, 10, 10, 0.45)",
    colorTextOnPrimaryBackground: "#f7f7f5",
    colorBackground: "transparent",
    colorInputBackground: "transparent",
    colorInputText: "#0a0a0a",
    colorBorder: "rgba(10, 10, 10, 0.12)",
    colorMutedForeground: "rgba(10, 10, 10, 0.35)",
    borderRadius: "0px",
    fontFamily: "var(--font-montreal), NeueMontreal, Arial, sans-serif",
    fontFamilyButtons: "var(--font-montreal), NeueMontreal, Arial, sans-serif",
    fontSize: "14px",
    spacingUnit: "0.85rem",
    fontWeight: {
      normal: 500,
      medium: 500,
      bold: 500,
    },
  },
  elements: {
    rootBox: "w-full !bg-transparent",
    cardBox: "w-full !bg-transparent !shadow-none !p-0 !rounded-none",
    card: "w-full !border-0 !bg-transparent !p-0 !shadow-none !rounded-none",
    main: "!gap-4 !bg-transparent",
    header: "!hidden",
    headerTitle: "!hidden",
    headerSubtitle: "!hidden",
    logoBox: "!hidden",
    logoImage: "!hidden",
    socialButtons: "!gap-2.5",
    socialButtonsBlockButton:
      "!h-12 !rounded-none !border !border-black/12 !bg-transparent !px-4 !text-[11px] !font-medium !uppercase !tracking-[0.12em] !text-black !shadow-none hover:!border-black hover:!bg-black hover:!text-white",
    socialButtonsBlockButtonText: "!font-medium",
    socialButtonsProviderIcon: "!opacity-70",
    dividerRow: "!my-5",
    dividerLine: "!bg-black/[0.08]",
    dividerText: "!text-[10px] !uppercase !tracking-[0.18em] !text-black/30",
    form: "!gap-4",
    formFieldRow: "!gap-1.5",
    formFieldLabelRow: "!mb-1.5",
    formFieldLabel:
      "!text-[10px] !font-medium !uppercase !tracking-[0.16em] !text-black/35",
    formFieldInput:
      "!h-12 !rounded-none !border !border-black/12 !bg-transparent !px-3.5 !text-[14px] !text-black !shadow-none !outline-none focus:!border-black focus:!bg-black/[0.02] focus:!shadow-none focus:!ring-0",
    formFieldInputShowPasswordButton: "!text-black/35 hover:!text-black",
    formFieldAction: "!text-[11px] !text-black/40 hover:!text-black",
    formButtonPrimary:
      "!mt-1 !h-12 !rounded-none !bg-black !text-[11px] !font-medium !uppercase !tracking-[0.16em] !text-white !shadow-none hover:!opacity-80",
    footer: "!hidden",
    footerAction: "!hidden",
    footerActionLink: "!hidden",
    footerActionText: "!hidden",
    footerPages: "!hidden",
    identityPreview:
      "!border !border-black/12 !bg-transparent !px-3.5 !py-2.5 !rounded-none !shadow-none",
    identityPreviewText: "!text-[13px] !text-black",
    identityPreviewEditButton: "!text-black/40 hover:!text-black",
    otpCodeFieldInput:
      "!border !border-black/12 !bg-transparent !text-black focus:!border-black !rounded-none",
    alternativeMethodsBlockButton:
      "!border !border-black/12 !bg-transparent !text-[12px] !text-black hover:!border-black !rounded-none !shadow-none",
    alert: "!bg-transparent !px-0 !shadow-none",
    alertText: "!text-[12px] !text-black/50",
    formFieldErrorText: "!text-[11px] !text-black/50",
    formFieldSuccessText: "!text-[11px] !text-black/50",
    navbar: "!hidden",
    scrollBox: "!bg-transparent !shadow-none",

    /* Account popup — same canvas language as auth */
    userButtonAvatarBox:
      "!h-8 !w-8 !rounded-none !border !border-black/10 !shadow-none",
    userButtonPopoverCard:
      "!rounded-none !border !border-black/10 !bg-[#f7f7f5] !shadow-none !p-0",
    userButtonPopoverMain: "!bg-[#f7f7f5]",
    userButtonPopoverFooter: "!hidden",
    userButtonPopoverActionButton:
      "!rounded-none !text-[12px] !font-medium !uppercase !tracking-[0.12em] !text-black hover:!bg-black/[0.04]",
    userButtonPopoverActionButtonText: "!text-black",
    userButtonPopoverActionButtonIcon: "!text-black/40",
    userPreviewMainIdentifier: "!text-[13px] !font-medium !text-black",
    userPreviewSecondaryIdentifier: "!text-[12px] !text-black/40",
    userButtonPopoverCustomItemButton:
      "!rounded-none !text-[12px] !font-medium !uppercase !tracking-[0.12em]",
  },
  layout: {
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
    showOptionalFields: false,
  },
  options: {
    unsafe_disableDevelopmentModeWarnings: true,
  },
};

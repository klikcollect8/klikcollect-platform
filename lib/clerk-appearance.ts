/**
 * KlikCollect Clerk chrome - marketplace canvas.
 * Clerk Next.js v7: structural prefs live under `options`.
 */
const ink = "#0a0a0a";
const canvas = "#f7f7f5";

export const clerkAppearance = {
  variables: {
    colorPrimary: ink,
    colorDanger: "#8e1b0d",
    colorSuccess: ink,
    colorWarning: "#3a3a3a",
    colorNeutral: ink,
    colorText: ink,
    colorTextSecondary: "rgba(10, 10, 10, 0.45)",
    colorTextOnPrimaryBackground: canvas,
    colorBackground: "transparent",
    colorInputBackground: "transparent",
    colorInputText: ink,
    colorBorder: "rgba(10, 10, 10, 0.15)",
    colorMutedForeground: "rgba(10, 10, 10, 0.38)",
    borderRadius: "0px",
    fontFamily:
      "var(--font-sans), 'Plus Jakarta Sans', ui-sans-serif, sans-serif",
    fontFamilyButtons:
      "var(--font-sans), 'Plus Jakarta Sans', ui-sans-serif, sans-serif",
    fontSize: "15px",
    spacingUnit: "0.85rem",
    fontWeight: {
      normal: 500,
      medium: 500,
      bold: 500,
    },
  },
  elements: {
    rootBox: "!w-full !max-w-full !bg-transparent",
    cardBox:
      "!w-full !max-w-full !bg-transparent !shadow-none !p-0 !m-0 !rounded-none !border-0",
    card: "!w-full !max-w-full !border-0 !bg-transparent !p-0 !m-0 !shadow-none !rounded-none",
    main: "!w-full !gap-6 !bg-transparent",
    header: "!hidden",
    headerTitle: "!hidden",
    headerSubtitle: "!hidden",
    logoBox: "!hidden",
    logoImage: "!hidden",

    /* Three equal icon buttons in one row - no provider labels */
    socialButtonsRoot: "!w-full",
    socialButtons:
      "!flex !w-full !flex-row !items-stretch !justify-between !gap-3",
    socialButtonsBlockButton:
      "!m-0 !flex !h-12 !min-w-0 !flex-1 !items-center !justify-center !overflow-hidden !rounded-none !border !border-black/12 !bg-transparent !px-0 !shadow-none hover:!border-black/40 hover:!bg-transparent",
    socialButtonsBlockButtonText:
      "!hidden !m-0 !h-0 !w-0 !overflow-hidden !p-0 !opacity-0",
    socialButtonsBlockButtonArrow: "!hidden",
    socialButtonsIconButton:
      "!m-0 !flex !h-12 !min-w-0 !flex-1 !items-center !justify-center !overflow-hidden !rounded-none !border !border-black/12 !bg-transparent !px-0 !shadow-none hover:!border-black/40",
    socialButtonsProviderIcon: "!m-0 !h-[18px] !w-[18px] !shrink-0 !opacity-80",

    dividerRow: "!w-full !my-0",
    dividerLine: "!bg-black/[0.08]",
    dividerText:
      "!px-3 !text-[10px] !font-medium !uppercase !tracking-[0.2em] !text-black/30",

    form: "!w-full !gap-5",
    formFieldRow: "!w-full",
    formFieldLabelRow: "!mb-2 !w-full !items-center !justify-between",
    formFieldLabel:
      "!text-[11px] !font-medium !uppercase !tracking-[0.18em] !text-black/35",
    formFieldInput:
      "!h-auto !w-full !rounded-none !border-0 !border-b !border-black/15 !bg-transparent !px-0 !py-3.5 !text-[16px] !text-black !shadow-none !outline-none placeholder:!text-black/30 focus:!border-black/50 focus:!bg-transparent focus:!shadow-none focus:!ring-0",
    formFieldInputShowPasswordButton: "!text-black/35 hover:!text-black",
    formFieldAction: "!hidden",
    formButtonPrimary:
      "!mt-2 !h-12 !w-full !rounded-none !bg-black !text-[12px] !font-medium !uppercase !tracking-[0.14em] !text-white !shadow-none hover:!opacity-80",

    footer: "!hidden",
    footerAction: "!hidden",
    footerActionLink: "!hidden",
    footerActionText: "!hidden",
    footerPages: "!hidden",
    footerPagesLink: "!hidden",

    identityPreview:
      "!w-full !rounded-none !border-0 !border-b !border-black/15 !bg-transparent !px-0 !py-3 !shadow-none",
    identityPreviewText: "!text-[15px] !text-black",
    identityPreviewEditButton: "!text-black/40 hover:!text-black",
    otpCodeFieldInput:
      "!rounded-none !border-0 !border-b !border-black/15 !bg-transparent !text-black focus:!border-black/50",
    alternativeMethodsBlockButton:
      "!w-full !rounded-none !border-0 !border-b !border-black/15 !bg-transparent !text-[13px] !text-black !shadow-none hover:!border-black/40",

    alert: "!bg-transparent !px-0 !shadow-none",
    alertText: "!text-[13px] !text-black/50",
    formFieldErrorText: "!text-[12px] !text-black/55",
    formFieldSuccessText: "!text-[12px] !text-black/45",
    navbar: "!hidden",
    scrollBox: "!w-full !bg-transparent !shadow-none",
    badge: "!hidden",

    userButtonAvatarBox:
      "!h-8 !w-8 !rounded-none !border !border-black/12 !shadow-none",
    userButtonPopoverRootBox: "!z-[9999]",
    userButtonPopoverCard:
      "!rounded-none !border !border-black/10 !bg-[#f7f7f5] !p-0 !shadow-none",
    userButtonPopoverMain: "!bg-[#f7f7f5] !px-1 !py-1",
    userButtonPopoverActions: "!gap-0",
    userButtonPopoverFooter: "!hidden",
    userButtonPopoverActionButton:
      "!rounded-none !border-0 !border-b !border-black/[0.08] !px-4 !py-3.5 !text-[12px] !font-medium !uppercase !tracking-[0.14em] !text-black/70 hover:!bg-transparent hover:!text-black",
    userButtonPopoverActionButtonText: "!text-inherit",
    userButtonPopoverActionButtonIconBox: "!hidden",
    userButtonPopoverActionButtonIcon: "!hidden",
    userPreview: "!gap-3 !px-4 !py-4",
    userPreviewAvatarBox: "!h-10 !w-10 !rounded-none !border !border-black/12",
    userPreviewMainIdentifier: "!text-[14px] !font-medium !text-black",
    userPreviewSecondaryIdentifier: "!text-[12px] !text-black/40",
    userButtonPopoverCustomItemButton:
      "!rounded-none !border-0 !border-b !border-black/[0.08] !px-4 !py-3.5 !text-[12px] !font-medium !uppercase !tracking-[0.14em]",
  },
  options: {
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "iconButton" as const,
    showOptionalFields: false,
    animations: true,
    unsafe_disableDevelopmentModeWarnings: true,
  },
};

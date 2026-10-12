import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { useSocialSignIn } from "@/hooks/use-social-sign-in";
import { FieldSeparator } from "@repo/ui/field";
import { webConfig } from "@/configs/web-config";
import { useTranslations } from "@/i18n";
import { EmailSignInForm } from "./email/email-sign-in-form";
import { TermsAgreement } from "./terms-agreement";

let dialogOpen = false;
const listeners = new Set<() => void>();

function setDialogOpen(open: boolean) {
  dialogOpen = open;
  for (const listener of listeners) listener();
}

export function openSignInDialog() {
  setDialogOpen(true);
}

export function SignInDialogRoot() {
  const [open, setOpen] = useState(dialogOpen);

  useEffect(() => {
    const listener = () => setOpen(dialogOpen);
    listeners.add(listener);
    setOpen(dialogOpen);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return <SignInDialog open={open} onOpenChange={setDialogOpen} />;
}

function GoogleMark() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <title>Google</title>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.16-4.06 1.16-3.12 0-5.77-2.11-6.71-4.94H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.38-2.31V6.6H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.4l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.14 15.24 0 12 0 7.31 0 3.23 2.69 1.29 6.6l4 3.09C6.23 6.86 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
}

function SignInDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("signIn");
  const authT = useTranslations("auth");
  const { signIn, loading } = useSocialSignIn();
  const [isEnteringCode, setIsEnteringCode] = useState(false);

  // The email form remounts on reopen, so start again from the email step.
  useEffect(() => {
    if (!open) setIsEnteringCode(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl sm:max-w-[24rem]">
        <div className="bg-primary/10 px-6 pt-8 pb-6">
          <DialogHeader className="items-center gap-2 text-center sm:items-center sm:text-center">
            <DialogTitle className="text-xl tracking-tight">{t("dialogTitle")}</DialogTitle>
            <DialogDescription className="max-w-xs text-balance leading-6">
              {t("dialogDescription")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 px-6 py-5">
          {isEnteringCode ? null : (
            <button
              type="button"
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-[15px] font-medium text-neutral-900 shadow-sm ring-1 ring-black/10 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
              disabled={loading !== null}
              onClick={() => signIn("google")}
            >
              {loading === "google" ? (
                <Loader2Icon className="size-4 animate-spin text-neutral-700" />
              ) : (
                <GoogleMark />
              )}
              {authT("loginWithGoogle")}
            </button>
          )}
          {webConfig.auth.methods.emailOtpEnabled ? (
            <>
              {isEnteringCode ? null : (
                <FieldSeparator className="my-1">{authT("orContinueWith")}</FieldSeparator>
              )}
              <EmailSignInForm
                mode="otp"
                onOtpVerificationChange={setIsEnteringCode}
                onSignedIn={() => onOpenChange(false)}
              />
            </>
          ) : null}
          <TermsAgreement onNavigate={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { motion } from "motion/react";
import { FaGithub, FaGoogle } from "react-icons/fa";
import { Button } from "@repo/ui/button";
import { Card, CardContent } from "@repo/ui/card";
import { Field, FieldDescription, FieldGroup, FieldSeparator } from "@repo/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { webConfig } from "@/configs/web-config";
import { useSocialSignIn } from "@/hooks/use-social-sign-in";
import { useTranslations } from "@/i18n";
import { cn } from "@/lib/utils";
import { EmailSignInForm } from "./email/email-sign-in-form";
import { PhoneSignInForm } from "./phone/phone-sign-in-form";
import { TermsAgreement } from "./terms-agreement";

type SignInFormProps = React.ComponentProps<"div"> & {
  initialMethod?: SignInMethod;
};

type SignInMethod = "email" | "phone" | "otp";

const enabledSignInMethods = [
  webConfig.auth.methods.emailPasswordEnabled ? "email" : null,
  webConfig.auth.methods.smsEnabled ? "phone" : null,
  webConfig.auth.methods.emailOtpEnabled ? "otp" : null,
].filter((method): method is SignInMethod => method !== null);
const defaultSignInMethod = enabledSignInMethods[0] ?? "email";
const hasSocialSignInMethods =
  webConfig.auth.methods.githubEnabled || webConfig.auth.methods.googleEnabled;

export function SignInForm({ initialMethod = "email", className, ...props }: SignInFormProps) {
  const t = useTranslations();
  const { signIn: socialSignIn, loading: socialLoading } = useSocialSignIn();
  const [activeMethod, setActiveMethod] = useState<SignInMethod>(
    enabledSignInMethods.includes(initialMethod) ? initialMethod : defaultSignInMethod,
  );
  const [isEmailOtpVerifying, setIsEmailOtpVerifying] = useState(false);

  function getDescription(method: SignInMethod) {
    switch (method) {
      case "email":
        return t("signIn.description");
      case "phone":
        return t("signIn.phoneDescription");
      case "otp":
        return t("signIn.emailOtpDescription");
    }
  }

  const description = getDescription(activeMethod);
  const hasAuthMethods = enabledSignInMethods.length > 0;
  const shouldShowAuthTabs = enabledSignInMethods.length > 1;

  function handleMethodChange(value: string) {
    if (!enabledSignInMethods.includes(value as SignInMethod)) return;
    setActiveMethod(value as SignInMethod);
    setIsEmailOtpVerifying(false);
  }

  function renderSignInMethodContent(method: SignInMethod) {
    switch (method) {
      case "email":
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <EmailSignInForm mode="password" />
          </motion.div>
        );
      case "phone":
        return (
          <motion.div
            key="phone-otp"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <PhoneSignInForm />
          </motion.div>
        );
      case "otp":
        return (
          <motion.div
            key="email-otp"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <EmailSignInForm mode="otp" onOtpVerificationChange={setIsEmailOtpVerifying} />
          </motion.div>
        );
    }
  }

  return (
    <div className={cn("flex w-full max-w-md flex-col gap-4", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="p-6">
          <FieldGroup>
            {!isEmailOtpVerifying ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">{t("signIn.title")}</h1>
                {hasAuthMethods ? (
                  <p className="text-muted-foreground text-sm text-balance">{description}</p>
                ) : null}
              </div>
            ) : null}
            {hasAuthMethods && shouldShowAuthTabs ? (
              <Tabs
                value={activeMethod}
                onValueChange={handleMethodChange}
                className={cn("gap-4", isEmailOtpVerifying && "gap-0")}
              >
                {!isEmailOtpVerifying ? (
                  <TabsList
                    className="grid h-10 w-full rounded-full bg-muted p-1"
                    style={{ gridTemplateColumns: `repeat(${enabledSignInMethods.length}, 1fr)` }}
                  >
                    {webConfig.auth.methods.emailPasswordEnabled ? (
                      <TabsTrigger value="email" className="rounded-full">
                        {t("signIn.emailTab")}
                      </TabsTrigger>
                    ) : null}
                    {webConfig.auth.methods.smsEnabled ? (
                      <TabsTrigger value="phone" className="rounded-full">
                        {t("signIn.phoneTab")}
                      </TabsTrigger>
                    ) : null}
                    {webConfig.auth.methods.emailOtpEnabled ? (
                      <TabsTrigger value="otp" className="rounded-full">
                        {t("auth.emailOtpMode")}
                      </TabsTrigger>
                    ) : null}
                  </TabsList>
                ) : null}
                {webConfig.auth.methods.emailPasswordEnabled ? (
                  <TabsContent value="email" className={cn(!isEmailOtpVerifying && "mt-4")}>
                    {renderSignInMethodContent("email")}
                  </TabsContent>
                ) : null}
                {webConfig.auth.methods.smsEnabled ? (
                  <TabsContent value="phone" className="mt-4">
                    {renderSignInMethodContent("phone")}
                  </TabsContent>
                ) : null}
                {webConfig.auth.methods.emailOtpEnabled ? (
                  <TabsContent value="otp" className={cn(!isEmailOtpVerifying && "mt-4")}>
                    {renderSignInMethodContent("otp")}
                  </TabsContent>
                ) : null}
              </Tabs>
            ) : null}
            {hasAuthMethods && !shouldShowAuthTabs ? (
              <div className={cn(!isEmailOtpVerifying && "mt-4")}>
                {renderSignInMethodContent(activeMethod)}
              </div>
            ) : null}
            {!isEmailOtpVerifying ? (
              <>
                {hasSocialSignInMethods ? (
                  <>
                    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                      {t("auth.orContinueWith")}
                    </FieldSeparator>
                    <Field
                      className={cn(
                        "grid gap-4",
                        webConfig.auth.methods.githubEnabled &&
                          webConfig.auth.methods.googleEnabled &&
                          "grid-cols-2",
                      )}
                    >
                      {webConfig.auth.methods.githubEnabled ? (
                        <Button
                          variant="outline"
                          type="button"
                          disabled={socialLoading !== null}
                          onClick={() => socialSignIn("github")}
                        >
                          {socialLoading === "github" && (
                            <Loader2Icon className="size-4 animate-spin" />
                          )}
                          <FaGithub className="mr-2" />
                          {t("auth.loginWithGithub")}
                        </Button>
                      ) : null}
                      {webConfig.auth.methods.googleEnabled ? (
                        <Button
                          variant="outline"
                          type="button"
                          disabled={socialLoading !== null}
                          onClick={() => socialSignIn("google")}
                        >
                          {socialLoading === "google" && (
                            <Loader2Icon className="size-4 animate-spin" />
                          )}
                          <FaGoogle className="mr-2" />
                          {t("auth.loginWithGoogle")}
                        </Button>
                      ) : null}
                    </Field>
                  </>
                ) : null}
                {webConfig.auth.methods.emailPasswordEnabled ? (
                  <FieldDescription className="text-center">
                    {t("signIn.noAccount")} <Link to="/auth/sign-up">{t("signIn.signUp")}</Link>
                  </FieldDescription>
                ) : null}
              </>
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>
      {!isEmailOtpVerifying ? <TermsAgreement /> : null}
    </div>
  );
}

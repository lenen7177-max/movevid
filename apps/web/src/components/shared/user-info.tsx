import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar";
import type { CurrentUser } from "@/lib/auth/auth-server";
import { getVisibleUserEmail, getVisibleUserName, isPhoneUser } from "@repo/shared";

type UserInfoProps = {
  user: CurrentUser;
};

export function UserInfo({ user }: UserInfoProps) {
  const visibleName = getVisibleUserName(user);
  const secondaryIdentity = isPhoneUser(user) ? user.phoneNumber : getVisibleUserEmail(user);

  return (
    <>
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarImage alt={visibleName ?? ""} src={user.image ?? ""} />
        <AvatarFallback className="rounded-lg">
          {visibleName?.slice(0, 2).toUpperCase() || "CN"}
        </AvatarFallback>
      </Avatar>
      <div className="grid gap-1 flex-1 text-left text-sm leading-tight">
        <div className="flex gap-2 items-center">
          <span className="truncate max-w-14 font-medium">{visibleName}</span>
        </div>

        {secondaryIdentity ? (
          <span className="truncate text-muted-foreground text-xs">{secondaryIdentity}</span>
        ) : null}
      </div>
    </>
  );
}

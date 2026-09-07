import Image from "next/image";

// Shared between login/register cards so both stay in sync — extracted once
// it needed to render identically in two places instead of one. The banner
// image already bakes in the icon mark, "Macra" wordmark, and tagline, so
// there's no separate text alongside it here.
export function AuthLogo() {
  return (
    <Image
      src="/banner-icon.png"
      alt="Macra — Track Your Macros"
      width={512}
      height={512}
      priority
      className="h-40 w-40"
    />
  );
}

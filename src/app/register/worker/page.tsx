import Link from "next/link";
import { Logo } from "@/components/Logo";
import { checkInvite } from "@/app/actions/registerWorker";
import { WorkerForm } from "./WorkerForm";

export default async function WorkerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const invite = token
    ? await checkInvite(token)
    : { valid: false as const, reason: "not_found" };

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo className="text-2xl" />
        </div>
        <div className="card">
          {invite.valid ? (
            <>
              <h1 className="text-xl font-bold">Join the Paws Playcare team 🐾</h1>
              <p className="mt-1 text-sm text-muted">
                Set up your walker account to start picking up walks.
              </p>
              <div className="mt-5">
                <WorkerForm
                  token={token!}
                  presetName={invite.name}
                  presetEmail={invite.email}
                />
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-4xl">🔗</div>
              <h1 className="mt-3 text-xl font-bold">Invite link not valid</h1>
              <p className="mt-2 text-muted">
                {invite.reason === "used"
                  ? "This invite has already been used."
                  : invite.reason === "expired"
                  ? "This invite link has expired. Ask an admin for a new one."
                  : "This invite link is invalid. Please check with your admin."}
              </p>
              <Link href="/login" className="btn-primary mt-6 w-full">
                Go to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
